import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildFinancialTimeline,
  compareFinancialTimelineScenario,
  expandMonthlyDates,
  tripRecurringCommitmentSchema,
  tripWorkspaceSchema,
  type TripRecurringCommitment,
  type TripWorkspace,
} from './index.ts';

const createdAt =
  '2026-09-14T08:00:00.000Z';

function makeRecurringCommitment(
  overrides:
    Partial<TripRecurringCommitment> = {},
): TripRecurringCommitment {
  return tripRecurringCommitmentSchema.parse({
    id: 'rent-monthly',
    title: 'Rent',
    categoryId: 'commitment-rent',
    amount: 1700,
    currency: 'AED',
    recurrence: {
      cadence: 'monthly',
      firstDueDate: '2026-09-25',
    },
    paidOccurrences: [],
    notes: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

function createWorkspace(
  overrides: Partial<TripWorkspace> = {},
): TripWorkspace {
  return tripWorkspaceSchema.parse({
    id: 'trip-recurring-commitments',
    version: 1,
    currency: 'AED',
    route: null,
    dates: {
      departureDate: '2026-12-19',
      returnDate: '2026-12-26',
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
    recurringCommitments: [],
    commitmentsReviewed: true,
    costItems: [],
    payments: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

test(
  'legacy workspaces default recurring commitments to empty',
  () => {
    const legacy = {
      ...createWorkspace(),
    } as Record<string, unknown>;

    delete legacy.recurringCommitments;

    const result =
      tripWorkspaceSchema.parse(
        legacy,
      );

    assert.deepEqual(
      result.recurringCommitments,
      [],
    );
  },
);

test(
  'monthly recurrence clamps safely at month end',
  () => {
    assert.deepEqual(
      expandMonthlyDates(
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
  },
);

test(
  'recurring paid occurrences must be unique and on cadence',
  () => {
    const duplicate =
      tripRecurringCommitmentSchema.safeParse({
        ...makeRecurringCommitment({
          recurrence: {
            cadence: 'monthly',
            firstDueDate: '2026-01-31',
          },
        }),
        paidOccurrences: [
          {
            dueDate: '2026-02-28',
            amount: 1700,
            paidAmountReflectedInMoney:
              false,
          },
          {
            dueDate: '2026-02-28',
            amount: 1700,
            paidAmountReflectedInMoney:
              true,
          },
        ],
      });

    assert.equal(
      duplicate.success,
      false,
    );

    const offCadence =
      tripRecurringCommitmentSchema.safeParse({
        ...makeRecurringCommitment({
          recurrence: {
            cadence: 'monthly',
            firstDueDate: '2026-01-31',
          },
        }),
        paidOccurrences: [
          {
            dueDate: '2026-02-27',
            amount: 1700,
            paidAmountReflectedInMoney:
              false,
          },
        ],
      });

    assert.equal(
      offCadence.success,
      false,
    );
  },
);

test(
  'workspace rejects recurring commitment currency mismatch',
  () => {
    assert.throws(
      () =>
        createWorkspace({
          recurringCommitments: [
            makeRecurringCommitment({
              currency: 'BHD',
            }),
          ],
        }),
    );
  },
);

test(
  'recurring commitment expands only through the trip return horizon',
  () => {
    const events =
      buildFinancialTimeline(
        createWorkspace({
          recurringCommitments: [
            makeRecurringCommitment(),
          ],
        }),
      ).filter(
        (event) =>
          event.sourceId ===
          'rent-monthly',
      );

    assert.deepEqual(
      events.map(
        (event) => [
          event.date,
          event.timing,
          event.recurrenceIndex,
        ],
      ),
      [
        [
          '2026-09-25',
          'before-trip',
          1,
        ],
        [
          '2026-10-25',
          'before-trip',
          2,
        ],
        [
          '2026-11-25',
          'before-trip',
          3,
        ],
        [
          '2026-12-25',
          'during-trip',
          4,
        ],
      ],
    );
  },
);

test(
  'paid recurring occurrence stays counted until Money reflection is explicit',
  () => {
    const events =
      buildFinancialTimeline(
        createWorkspace({
          recurringCommitments: [
            makeRecurringCommitment({
              paidOccurrences: [
                {
                  dueDate:
                    '2026-09-25',
                  amount: 1700,
                  paidAmountReflectedInMoney:
                    false,
                },
                {
                  dueDate:
                    '2026-10-25',
                  amount: 1700,
                  paidAmountReflectedInMoney:
                    true,
                },
              ],
            }),
          ],
        }),
      ).filter(
        (event) =>
          event.sourceId ===
          'rent-monthly',
      );

    assert.deepEqual(
      events.map(
        (event) => [
          event.date,
          event.timing,
          event.recurrenceIndex,
        ],
      ),
      [
        [
          null,
          'before-trip',
          1,
        ],
        [
          '2026-11-25',
          'before-trip',
          3,
        ],
        [
          '2026-12-25',
          'during-trip',
          4,
        ],
      ],
    );

    const pendingPaid =
      events.find(
        (event) =>
          event.recurrenceIndex ===
          1,
      );

    assert.ok(pendingPaid);

    assert.equal(
      pendingPaid.amount,
      1700,
      'Paid status alone must not create Money.',
    );

    assert.equal(
      events.some(
        (event) =>
          event.recurrenceIndex ===
          2,
      ),
      false,
      'Only explicit Money reflection may release the paid occurrence.',
    );
  },
);

test(
  'paid recurring occurrence after the trip still counts when Money has not reflected it',
  () => {
    const events =
      buildFinancialTimeline(
        createWorkspace({
          recurringCommitments: [
            makeRecurringCommitment({
              paidOccurrences: [
                {
                  dueDate:
                    '2027-01-25',
                  amount: 1700,
                  paidAmountReflectedInMoney:
                    false,
                },
              ],
            }),
          ],
        }),
      ).filter(
        (event) =>
          event.sourceId ===
          'rent-monthly',
      );

    const earlyPaid =
      events.find(
        (event) =>
          event.recurrenceIndex ===
          5,
      );

    assert.ok(earlyPaid);

    assert.equal(
      earlyPaid.date,
      null,
    );

    assert.equal(
      earlyPaid.timing,
      'before-trip',
    );

    assert.equal(
      earlyPaid.dateConfidence,
      'window-only',
    );
  },
);

test(
  'moving a trip later adds recurring obligations without mutating source truth',
  () => {
    const workspace =
      createWorkspace({
        dates: {
          departureDate:
            '2026-09-10',
          returnDate:
            '2026-09-17',
          flexibility: 'flexible',
        },
        recurringCommitments: [
          makeRecurringCommitment(),
        ],
      });

    const comparison =
      compareFinancialTimelineScenario(
        workspace,
        {
          departureDate:
            '2026-10-10',
          returnDate:
            '2026-10-17',
        },
      );

    assert.equal(
      comparison.current
        .outflowBeforeTrip,
      0,
    );

    assert.equal(
      comparison.proposed
        .outflowBeforeTrip,
      1700,
    );

    assert.equal(
      comparison.deltaOutflowBeforeTrip,
      1700,
    );

    assert.equal(
      workspace
        .recurringCommitments[0]
        ?.recurrence.firstDueDate,
      '2026-09-25',
      'Scenario comparison must not mutate recurring source truth.',
    );
  },
);

test(
  'editing the recurring plan amount never rewrites a paid occurrence cash snapshot',
  () => {
    const events =
      buildFinancialTimeline(
        createWorkspace({
          recurringCommitments: [
            makeRecurringCommitment({
              amount: 1900,
              paidOccurrences: [
                {
                  dueDate:
                    '2026-09-25',
                  amount: 1700,
                  paidAmountReflectedInMoney:
                    false,
                },
              ],
            }),
          ],
        }),
      ).filter(
        (event) =>
          event.sourceId ===
          'rent-monthly',
      );

    const paidSeptember =
      events.find(
        (event) =>
          event.recurrenceIndex === 1,
      );

    const unpaidOctober =
      events.find(
        (event) =>
          event.recurrenceIndex === 2,
      );

    assert.ok(paidSeptember);
    assert.ok(unpaidOctober);

    assert.equal(
      paidSeptember.amount,
      1700,
      'Historical paid cash must keep the amount that was actually paid.',
    );

    assert.equal(
      unpaidOctober.amount,
      1900,
      'Future unpaid occurrences use the current recurring plan amount.',
    );
  },
);

test(
  'regular and recurring commitments cannot share the same identity',
  () => {
    assert.throws(
      () =>
        createWorkspace({
          commitments: [
            {
              id: 'shared-commitment-id',
              title: 'One-time bill',
              categoryId:
                'commitment-bills',
              amount: 200,
              currency: 'AED',
              dueDate:
                '2026-10-01',
              dueBeforeTravel: true,
              status: 'unpaid',
              notes: null,
              createdAt,
              updatedAt: createdAt,
            },
          ],
          recurringCommitments: [
            makeRecurringCommitment({
              id: 'shared-commitment-id',
            }),
          ],
        }),
    );
  },
);


test(
  'D1A end date: legacy monthly commitments normalize to ongoing',
  () => {
    const item =
      makeRecurringCommitment();

    assert.equal(
      item.recurrence.endDate,
      null,
    );
  },
);

test(
  'D1A end date: end cannot precede first due date',
  () => {
    const base =
      makeRecurringCommitment();

    const parsed =
      tripRecurringCommitmentSchema.safeParse({
        ...base,
        recurrence: {
          ...base.recurrence,
          endDate:
            '2026-09-24',
        },
      });

    assert.equal(
      parsed.success,
      false,
    );
  },
);

test(
  'D1A end date: paid history cannot exist after series end',
  () => {
    const base =
      makeRecurringCommitment();

    const parsed =
      tripRecurringCommitmentSchema.safeParse({
        ...base,
        recurrence: {
          ...base.recurrence,
          endDate:
            '2026-10-31',
        },
        paidOccurrences: [
          {
            dueDate:
              '2026-11-25',
            amount: 1700,
            paidAmountReflectedInMoney:
              false,
          },
        ],
      });

    assert.equal(
      parsed.success,
      false,
    );
  },
);

test(
  'D1A end date: financial timeline stops unpaid occurrences after series end',
  () => {
    const events =
      buildFinancialTimeline(
        createWorkspace({
          recurringCommitments: [
            makeRecurringCommitment({
              recurrence: {
                cadence: 'monthly',
                firstDueDate:
                  '2026-09-25',
                endDate:
                  '2026-10-31',
              },
            }),
          ],
        }),
      ).filter(
        (event) =>
          event.id.startsWith(
            'recurring-commitment:rent-monthly:',
          ),
      );

    assert.deepEqual(
      events.map(
        (event) =>
          event.id,
      ),
      [
        'recurring-commitment:rent-monthly:2026-09-25',
        'recurring-commitment:rent-monthly:2026-10-25',
      ],
    );
  },
);
