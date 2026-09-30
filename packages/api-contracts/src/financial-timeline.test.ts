import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addMonthsToIsoDateClamped,
  buildFinancialTimeline,
  buildMoveTripRecommendation,
  classifyTripDateTiming,
  compareFinancialTimelineScenario,
  expandMonthlyMoneyDates,
  isDuplicateMoneySource,
  summarizeFinancialTimeline,
  tripMoneyInItemSchema,
  tripWorkspaceSchema,
  type TripWorkspace,
} from './index.ts';

const createdAt = '2026-08-13T08:00:00.000Z';

function createWorkspace(
  overrides: Partial<TripWorkspace> = {},
): TripWorkspace {
  return tripWorkspaceSchema.parse({
    id: 'trip-financial-timeline',
    version: 1,
    currency: 'AED',
    route: null,
    dates: {
      departureDate: '2026-09-10',
      returnDate: '2026-09-17',
      flexibility: 'flexible',
    },
    funds: {
      availableNow: null,
      expectedBeforeTravel: 0,
      expectedAfterTravel: 0,
      safetyReserve: 0,
      originCommitments: 0,
    },
    moneyInItems: [],
    moneyInReviewed: true,
    commitments: [],
    commitmentsReviewed: true,
    costItems: [],
    payments: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

test('legacy Money In items remain valid without recurrence metadata', () => {
  const item = tripMoneyInItemSchema.parse({
    id: 'freelance-legacy',
    title: 'Freelance',
    categoryId:
      'money-in-freelance-business',
    amount: 4000,
    currency: 'AED',
    availability: 'available-now',
    expectedTiming: null,
    expectedDate: null,
    certainty: 'guaranteed',
    includeInReadiness: true,
    notes: null,
    createdAt,
    updatedAt: createdAt,
  });

  assert.equal(
    item.recurrence,
    undefined,
  );
});

test('monthly recurrence stays intentionally limited to salary', () => {
  const result =
    tripMoneyInItemSchema.safeParse({
      id: 'freelance-recurring',
      title: 'Freelance',
      categoryId:
        'money-in-freelance-business',
      amount: 2500,
      currency: 'AED',
      availability: 'expected',
      expectedTiming: 'before-travel',
      expectedDate: '2026-08-28',
      certainty: 'guaranteed',
      recurrence: {
        cadence: 'monthly',
        nextDate: '2026-08-28',
      },
      includeInReadiness: true,
      notes: null,
      createdAt,
      updatedAt: createdAt,
    });

  assert.equal(
    result.success,
    false,
  );
});

test('recurring expected date cannot contradict the next salary date', () => {
  const result =
    tripMoneyInItemSchema.safeParse({
      id: 'salary-mismatch',
      title: 'Salary',
      categoryId: 'money-in-salary',
      amount: 4000,
      currency: 'AED',
      availability: 'expected',
      expectedTiming: 'before-travel',
      expectedDate: '2026-08-27',
      certainty: 'guaranteed',
      recurrence: {
        cadence: 'monthly',
        nextDate: '2026-08-28',
      },
      includeInReadiness: true,
      notes: null,
      createdAt,
      updatedAt: createdAt,
    });

  assert.equal(
    result.success,
    false,
  );
});

test('monthly dates clamp safely at month end', () => {
  assert.equal(
    addMonthsToIsoDateClamped(
      '2026-01-31',
      1,
    ),
    '2026-02-28',
  );

  assert.deepEqual(
    expandMonthlyMoneyDates(
      '2026-01-31',
      '2026-04-30',
    ),
    [
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ],
  );
});

test('recurring salary never synthesizes an on-hand amount from the same source', () => {
  const workspace =
    createWorkspace({
      moneyInItems: [
        {
          id: 'salary',
          title: 'Salary',
          categoryId: 'money-in-salary',
          amount: 4000,
          currency: 'AED',
          availability: 'available-now',
          expectedTiming: null,
          expectedDate: null,
          certainty: 'guaranteed',
          recurrence: {
            cadence: 'monthly',
            nextDate: '2026-08-28',
          },
          includeInReadiness: true,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

  const events =
    buildFinancialTimeline(
      workspace,
    );

  assert.deepEqual(
    events
      .filter(
        (event) =>
          event.kind === 'money-in',
      )
      .map(
        (event) => ({
          date: event.date,
          timing: event.timing,
          amount: event.amount,
        }),
      ),
    [
      {
        date: '2026-08-28',
        timing: 'before-trip',
        amount: 4000,
      },
    ],
  );
});

test('expected recurring salary does not double count a synthetic one-time amount', () => {
  const workspace =
    createWorkspace({
      moneyInItems: [
        {
          id: 'salary',
          title: 'Salary',
          categoryId: 'money-in-salary',
          amount: 4000,
          currency: 'AED',
          availability: 'expected',
          expectedTiming: 'before-travel',
          expectedDate: '2026-08-28',
          certainty: 'guaranteed',
          recurrence: {
            cadence: 'monthly',
            nextDate: '2026-08-28',
          },
          includeInReadiness: true,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

  const summary =
    summarizeFinancialTimeline(
      buildFinancialTimeline(
        workspace,
      ),
    );

  assert.equal(
    summary.inflowBeforeTrip,
    4000,
  );
});

test('timeline classifies commitment and scheduled payment timing from exact dates', () => {
  const workspace =
    createWorkspace({
      commitments: [
        {
          id: 'rent-before',
          title: 'Rent',
          categoryId: 'commitment-rent',
          amount: 1700,
          currency: 'AED',
          dueDate: '2026-09-05',
          dueBeforeTravel: true,
          status: 'unpaid',
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
        {
          id: 'tabby-during',
          title: 'Tabby',
          categoryId:
            'commitment-credit-card',
          amount: 300,
          currency: 'AED',
          dueDate: '2026-09-12',
          dueBeforeTravel: false,
          status: 'unpaid',
          notes: null,
          installmentPlanId: 'plan-tabby',
          installmentCadence: 'monthly',
          installmentNumber: 1,
          installmentCount: 4,
          createdAt,
          updatedAt: createdAt,
        },
        {
          id: 'tabby-after',
          title: 'Tabby',
          categoryId:
            'commitment-credit-card',
          amount: 300,
          currency: 'AED',
          dueDate: '2026-10-12',
          dueBeforeTravel: false,
          status: 'unpaid',
          notes: null,
          installmentPlanId: 'plan-tabby',
          installmentCadence: 'monthly',
          installmentNumber: 2,
          installmentCount: 4,
          createdAt,
          updatedAt: createdAt,
        },
      ],
      costItems: [
        {
          id: 'flight',
          title: 'Flight',
          categoryId: 'cat-flight',
          amount: 1200,
          currency: 'AED',
          status: 'confirmed',
          dueDate: null,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
      payments: [
        {
          id: 'flight-payment',
          costItemId: 'flight',
          amount: 400,
          currency: 'AED',
          status: 'scheduled',
          paidAt: null,
          dueDate: '2026-09-13',
          method: null,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

  const events =
    buildFinancialTimeline(
      workspace,
    );

  assert.equal(
    events.find(
      (event) =>
        event.sourceId ===
        'rent-before',
    )?.timing,
    'before-trip',
  );
  assert.equal(
    events.find(
      (event) =>
        event.sourceId ===
        'tabby-during',
    )?.timing,
    'during-trip',
  );
  assert.equal(
    events.find(
      (event) =>
        event.sourceId ===
        'tabby-after',
    )?.timing,
    'after-trip',
  );
  assert.equal(
    events.find(
      (event) =>
        event.sourceId ===
        'flight-payment',
    )?.timing,
    'during-trip',
  );
});

test('moving a trip recalculates salary and commitments without changing Ready Money truth', () => {
  const workspace =
    createWorkspace({
      moneyInItems: [
        {
          id: 'salary',
          title: 'Salary',
          categoryId: 'money-in-salary',
          amount: 4000,
          currency: 'AED',
          availability: 'available-now',
          expectedTiming: null,
          expectedDate: null,
          certainty: 'guaranteed',
          recurrence: {
            cadence: 'monthly',
            nextDate: '2026-08-28',
          },
          includeInReadiness: true,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
      commitments: [
        {
          id: 'rent-sep',
          title: 'Rent',
          categoryId: 'commitment-rent',
          amount: 1700,
          currency: 'AED',
          dueDate: '2026-09-28',
          dueBeforeTravel: false,
          status: 'unpaid',
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

  const comparison =
    compareFinancialTimelineScenario(
      workspace,
      {
        departureDate: '2026-10-10',
        returnDate: '2026-10-17',
      },
    );

  assert.equal(
    comparison.deltaInflowBeforeTrip,
    4000,
  );
  assert.equal(
    comparison.deltaOutflowBeforeTrip,
    1700,
  );
  assert.equal(
    comparison.deltaNetBeforeTrip,
    2300,
  );
  assert.deepEqual(
    comparison.unknowns,
    [],
  );
});

test('scenario comparison never assumes trip repricing is zero', () => {
  const workspace =
    createWorkspace({
      costItems: [
        {
          id: 'hotel',
          title: 'Hotel',
          categoryId: 'cat-accommodation',
          amount: 2000,
          currency: 'AED',
          status: 'estimated',
          dueDate: null,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

  const comparison =
    compareFinancialTimelineScenario(
      workspace,
      {
        departureDate: '2026-10-10',
        returnDate: '2026-10-17',
      },
    );

  assert.deepEqual(
    comparison.unknowns,
    ['trip-cost-repricing'],
  );
});

test('timeline building does not mutate the workspace', () => {
  const workspace =
    createWorkspace({
      moneyInItems: [
        {
          id: 'salary',
          title: 'Salary',
          categoryId: 'money-in-salary',
          amount: 4000,
          currency: 'AED',
          availability: 'expected',
          expectedTiming: 'before-travel',
          expectedDate: '2026-08-28',
          certainty: 'guaranteed',
          recurrence: {
            cadence: 'monthly',
            nextDate: '2026-08-28',
          },
          includeInReadiness: true,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });
  const before = JSON.stringify(
    workspace,
  );

  buildFinancialTimeline(
    workspace,
    {
      departureDate: '2026-10-10',
      returnDate: '2026-10-17',
    },
  );

  assert.equal(
    JSON.stringify(workspace),
    before,
  );
});

test('excluded recurring salary remains outside readiness timeline inflow', () => {
  const workspace =
    createWorkspace({
      moneyInItems: [
        {
          id: 'salary-excluded',
          title: 'Salary',
          categoryId: 'money-in-salary',
          amount: 4000,
          currency: 'AED',
          availability: 'available-now',
          expectedTiming: null,
          expectedDate: null,
          certainty: 'guaranteed',
          recurrence: {
            cadence: 'monthly',
            nextDate: '2026-08-28',
          },
          includeInReadiness: false,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

  const summary =
    summarizeFinancialTimeline(
      buildFinancialTimeline(
        workspace,
      ),
    );

  assert.equal(
    summary.inflowBeforeTrip,
    0,
  );
});

test('move-trip recommendation ranks the strongest positive known cash-flow option', () => {
  const workspace =
    createWorkspace({
      dates: {
        departureDate: '2026-09-10',
        returnDate: '2026-09-17',
        flexibility: 'flexible',
      },
      moneyInItems: [
        {
          id: 'salary',
          title: 'Salary',
          categoryId: 'money-in-salary',
          amount: 4000,
          currency: 'AED',
          availability: 'available-now',
          expectedTiming: null,
          expectedDate: null,
          certainty: 'guaranteed',
          recurrence: {
            cadence: 'monthly',
            nextDate: '2026-09-28',
          },
          includeInReadiness: true,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
      commitments: [
        {
          id: 'rent',
          title: 'Rent',
          categoryId: 'commitment-rent',
          amount: 1700,
          currency: 'AED',
          dueDate: '2026-09-28',
          dueBeforeTravel: false,
          status: 'unpaid',
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

  const recommendation =
    buildMoveTripRecommendation(
      workspace,
      undefined,
      '2026-08-14',
    );

  assert.deepEqual(
    recommendation.checkedOffsets,
    [7, 14, 30],
  );
  assert.equal(
    recommendation.best?.offsetDays,
    30,
  );
  assert.equal(
    recommendation.best?.comparison
      .deltaInflowBeforeTrip,
    4000,
  );
  assert.equal(
    recommendation.best?.comparison
      .deltaOutflowBeforeTrip,
    1700,
  );
  assert.equal(
    recommendation.best?.comparison
      .deltaNetBeforeTrip,
    2300,
  );
  const addedEvents =
    recommendation.best
      ?.addedBeforeTripEvents
      .map((event) => [
        event.kind,
        event.title,
        event.amount,
      ] as const)
      .sort((left, right) =>
        left[0].localeCompare(
          right[0],
        ),
      ) ?? [];

  assert.deepEqual(
    addedEvents,
    [
      ['commitment', 'Rent', 1700],
      ['money-in', 'Salary', 4000],
    ],
  );
});

test('move-trip recommendation keeps repricing uncertainty explicit', () => {
  const workspace =
    createWorkspace({
      dates: {
        departureDate: '2026-09-10',
        returnDate: '2026-09-17',
        flexibility: 'flexible',
      },
      moneyInItems: [
        {
          id: 'salary',
          title: 'Salary',
          categoryId: 'money-in-salary',
          amount: 4000,
          currency: 'AED',
          availability: 'available-now',
          expectedTiming: null,
          expectedDate: null,
          certainty: 'guaranteed',
          recurrence: {
            cadence: 'monthly',
            nextDate: '2026-09-28',
          },
          includeInReadiness: true,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
      costItems: [
        {
          id: 'flight',
          title: 'Flight',
          categoryId: 'cat-flight',
          amount: 1200,
          currency: 'AED',
          status: 'estimated',
          dueDate: null,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

  const recommendation =
    buildMoveTripRecommendation(
      workspace,
      undefined,
      '2026-08-14',
    );

  assert.deepEqual(
    recommendation.best?.comparison
      .unknowns,
    ['trip-cost-repricing'],
  );
});

test('move-trip recommendation stays silent when no tested date improves known cash flow', () => {
  const workspace =
    createWorkspace({
      dates: {
        departureDate: '2026-09-10',
        returnDate: '2026-09-17',
        flexibility: 'flexible',
      },
    });

  const recommendation =
    buildMoveTripRecommendation(
      workspace,
      undefined,
      '2026-08-14',
    );

  assert.equal(
    recommendation.best,
    null,
  );
  assert.equal(
    recommendation.candidates.length,
    3,
  );
});

test('move-trip recommendation respects fixed dates', () => {
  const workspace =
    createWorkspace({
      dates: {
        departureDate: '2026-09-10',
        returnDate: '2026-09-17',
        flexibility: 'fixed',
      },
      moneyInItems: [
        {
          id: 'salary-fixed',
          title: 'Salary',
          categoryId: 'money-in-salary',
          amount: 4000,
          currency: 'AED',
          availability: 'available-now',
          expectedTiming: null,
          expectedDate: null,
          certainty: 'guaranteed',
          recurrence: {
            cadence: 'monthly',
            nextDate: '2026-09-28',
          },
          includeInReadiness: true,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

  const recommendation =
    buildMoveTripRecommendation(
      workspace,
      undefined,
      '2026-08-14',
    );

  assert.equal(recommendation.best, null);
  assert.equal(recommendation.candidates.length, 0);
});

test('move-trip recommendation stays off after departure', () => {
  const workspace =
    createWorkspace({
      dates: {
        departureDate: '2026-08-13',
        returnDate: '2026-08-17',
        flexibility: 'flexible',
      },
      moneyInItems: [
        {
          id: 'salary-started',
          title: 'Salary',
          categoryId: 'money-in-salary',
          amount: 4000,
          currency: 'AED',
          availability: 'available-now',
          expectedTiming: null,
          expectedDate: null,
          certainty: 'guaranteed',
          recurrence: {
            cadence: 'monthly',
            nextDate: '2026-08-25',
          },
          includeInReadiness: true,
          notes: null,
          createdAt,
          updatedAt: createdAt,
        },
      ],
    });

  const recommendation =
    buildMoveTripRecommendation(
      workspace,
      undefined,
      '2026-08-14',
    );

  assert.equal(recommendation.best, null);
  assert.equal(recommendation.candidates.length, 0);
});

test('money source duplicate guard blocks only the same category and normalized name', () => {
  const salary = tripMoneyInItemSchema.parse({
    id: 'salary-main',
    title: 'Main Salary',
    categoryId: 'money-in-salary',
    amount: 4000,
    currency: 'AED',
    availability: 'available-now',
    expectedTiming: null,
    expectedDate: null,
    certainty: 'guaranteed',
    includeInReadiness: true,
    notes: null,
    createdAt,
    updatedAt: createdAt,
  });

  assert.equal(
    isDuplicateMoneySource(
      [salary],
      {
        categoryId: 'money-in-salary',
        title: '  main   salary  ',
      },
    ),
    true,
  );

  assert.equal(
    isDuplicateMoneySource(
      [salary],
      {
        categoryId: 'money-in-salary',
        title: 'Second Salary',
      },
    ),
    false,
  );

  assert.equal(
    isDuplicateMoneySource(
      [salary],
      {
        categoryId: 'money-in-savings',
        title: 'Main Salary',
      },
    ),
    false,
  );

  assert.equal(
    isDuplicateMoneySource(
      [salary],
      {
        categoryId: 'money-in-salary',
        title: 'Main Salary',
      },
      'salary-main',
    ),
    false,
  );
});

test(
  'trip date timing classification is canonical at departure and return boundaries',
  () => {
    const dates = {
      departureDate:
        '2026-12-19',
      returnDate:
        '2026-12-26',
    };

    assert.equal(
      classifyTripDateTiming(
        '2026-12-18',
        'undated',
        dates,
      ),
      'before-trip',
    );

    assert.equal(
      classifyTripDateTiming(
        '2026-12-19',
        'undated',
        dates,
      ),
      'before-trip',
    );

    assert.equal(
      classifyTripDateTiming(
        '2026-12-20',
        'undated',
        dates,
      ),
      'during-trip',
    );

    assert.equal(
      classifyTripDateTiming(
        '2026-12-26',
        'undated',
        dates,
      ),
      'during-trip',
    );

    assert.equal(
      classifyTripDateTiming(
        '2026-12-27',
        'undated',
        dates,
      ),
      'after-trip',
    );
  },
);

test(
  'paid commitment remains a readiness outflow until paid amount is reflected in Money',
  () => {
    const baseCommitment = {
      id: 'commitment-readiness',
      title: 'Card payment',
      categoryId:
        'commitment-credit-card' as const,
      amount: 500,
      currency: 'AED',
      dueDate: '2026-09-12',
      dueBeforeTravel: false,
      notes: null,
      createdAt,
      updatedAt: createdAt,
    };

    const unpaidEvents =
      buildFinancialTimeline(
        createWorkspace({
          commitments: [
            {
              ...baseCommitment,
              status: 'unpaid',
            },
          ],
        }),
      );

    const paidUnreconciledEvents =
      buildFinancialTimeline(
        createWorkspace({
          commitments: [
            {
              ...baseCommitment,
              status: 'paid',
              paidAmountReflectedInMoney: false,
            },
          ],
        }),
      );

    const legacyPaidEvents =
      buildFinancialTimeline(
        createWorkspace({
          commitments: [
            {
              ...baseCommitment,
              status: 'paid',
            },
          ],
        }),
      );

    const reconciledEvents =
      buildFinancialTimeline(
        createWorkspace({
          commitments: [
            {
              ...baseCommitment,
              status: 'paid',
              paidAmountReflectedInMoney: true,
            },
          ],
        }),
      );

    const commitmentAmount = (
      events: ReturnType<
        typeof buildFinancialTimeline
      >,
    ) =>
      events
        .filter(
          (event) =>
            event.kind === 'commitment',
        )
        .reduce(
          (sum, event) =>
            sum + event.amount,
          0,
        );

    assert.equal(
      commitmentAmount(unpaidEvents),
      500,
    );

    assert.equal(
      commitmentAmount(
        paidUnreconciledEvents,
      ),
      500,
      'Changing status to paid alone must not erase the readiness outflow.',
    );

    assert.equal(
      commitmentAmount(
        legacyPaidEvents,
      ),
      500,
      'Missing legacy reconciliation metadata must fail closed.',
    );

    assert.equal(
      commitmentAmount(
        reconciledEvents,
      ),
      0,
      'Only explicit reconciliation may remove the paid commitment from readiness outflows.',
    );
  },
);

test(
  'paid early commitment ignores its original after-return due date until Money reflects the payment',
  () => {
    const events =
      buildFinancialTimeline(
        createWorkspace({
          commitments: [
            {
              id: 'paid-early',
              title: 'Card payment',
              categoryId:
                'commitment-credit-card',
              amount: 500,
              currency: 'AED',
              dueDate: '2026-10-01',
              dueBeforeTravel: false,
              status: 'paid',
              paidAmountReflectedInMoney: false,
              notes: null,
              createdAt,
              updatedAt: createdAt,
            },
          ],
        }),
      );

    const event =
      events.find(
        (candidate) =>
          candidate.sourceId ===
          'paid-early',
      );

    assert.ok(event);

    assert.equal(
      event.date,
      null,
      'Once already paid, the original due date is not the cash-event date.',
    );

    assert.equal(
      event.timing,
      'before-trip',
      'Unreflected paid cash must reduce current readiness regardless of the original due date.',
    );

    assert.equal(
      event.dateConfidence,
      'window-only',
    );
  },
);
