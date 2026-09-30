import assert from 'node:assert/strict';
import test from 'node:test';
import {
  tripWorkspaceSchema,
  type TripWorkspace,
} from '../packages/api-contracts/src/index.ts';
import {
  selectAvailableNowMoneyInTotal,
  selectExpectedByReturnMoneyInTotal,
  selectNextTripWindowCommitmentGroup,
  selectReadyMoney,
  selectReadyMoneyBreakdown,
  selectTripWindowCommitmentsTotal,
  selectUsableTripMoneyTotal,
} from '../apps/mobile/src/features/trip-workspace/trip-workspace-selectors.ts';

const createdAt = '2026-08-25T00:00:00.000Z';

function createWorkspace(
  overrides: Partial<TripWorkspace> = {},
): TripWorkspace {
  return tripWorkspaceSchema.parse({
    id: 'trip-money-timing',
    version: 1,
    currency: 'AED',
    route: null,
    dates: {
      departureDate: '2026-09-10',
      returnDate: '2026-09-17',
      flexibility: 'fixed',
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

function availableMoney(
  id: string,
  amount: number,
) {
  return {
    id,
    title: id,
    categoryId: 'money-in-savings' as const,
    amount,
    currency: 'AED',
    availability: 'available-now' as const,
    expectedTiming: null,
    expectedDate: null,
    certainty: 'guaranteed' as const,
    includeInReadiness: true,
    notes: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function expectedMoney(
  id: string,
  amount: number,
  date: string,
  expectedTiming:
    | 'before-travel'
    | 'after-travel' = 'before-travel',
) {
  return {
    id,
    title: id,
    categoryId: 'money-in-other' as const,
    amount,
    currency: 'AED',
    availability: 'expected' as const,
    expectedTiming,
    expectedDate: date,
    certainty: 'guaranteed' as const,
    includeInReadiness: true,
    notes: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function recurringSalary(
  id: string,
  amount: number,
  nextDate: string,
  expectedTiming:
    | 'before-travel'
    | 'after-travel' = 'before-travel',
) {
  return {
    id,
    title: 'Salary',
    categoryId: 'money-in-salary' as const,
    amount,
    currency: 'AED',
    availability: 'expected' as const,
    expectedTiming,
    expectedDate: nextDate,
    certainty: 'guaranteed' as const,
    recurrence: {
      cadence: 'monthly' as const,
      nextDate,
    },
    includeInReadiness: true,
    notes: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function commitment(
  id: string,
  amount: number,
  dueDate: string | null,
  dueBeforeTravel: boolean,
  status: 'paid' | 'unpaid' = 'unpaid',
  paidAmountReflectedInMoney?: boolean,
) {
  return {
    id,
    title: id,
    categoryId: 'commitment-other' as const,
    amount,
    currency: 'AED',
    dueDate,
    dueBeforeTravel,
    status,
    paidAmountReflectedInMoney,
    notes: null,
    createdAt,
    updatedAt: createdAt,
  };
}

test('usable trip money includes exact inflows through the inclusive return date', () => {
  const workspace = createWorkspace({
    moneyInItems: [
      availableMoney('on-hand', 100),
      expectedMoney('before', 200, '2026-09-09'),
      expectedMoney('departure', 300, '2026-09-10'),
      expectedMoney(
        'during-stale-coarse-timing',
        400,
        '2026-09-13',
        'after-travel',
      ),
      expectedMoney('return', 500, '2026-09-17'),
      expectedMoney(
        'after',
        600,
        '2026-09-18',
        'after-travel',
      ),
    ],
  });

  assert.equal(
    selectUsableTripMoneyTotal(workspace),
    1500,
  );
});

test('recurring salary counts every payday through return and excludes later occurrences', () => {
  const workspace = createWorkspace({
    dates: {
      departureDate: '2026-09-10',
      returnDate: '2026-11-30',
      flexibility: 'fixed',
    },
    moneyInItems: [
      recurringSalary(
        'salary-long-trip',
        1000,
        '2026-09-15',
        'after-travel',
      ),
    ],
  });

  assert.equal(
    selectUsableTripMoneyTotal(workspace),
    3000,
  );
});

test('legacy recurring salary marked available-now is treated as future salary only', () => {
  const workspace = createWorkspace({
    moneyInItems: [
      {
        ...recurringSalary(
          'salary-no-double-count',
          4000,
          '2026-09-05',
        ),
        availability:
          'available-now' as const,
        expectedTiming: null,
        expectedDate: null,
      },
    ],
  });

  assert.equal(
    selectAvailableNowMoneyInTotal(
      workspace,
    ),
    0,
  );
  assert.equal(
    selectExpectedByReturnMoneyInTotal(
      workspace,
    ),
    4000,
  );
  assert.equal(
    selectUsableTripMoneyTotal(
      workspace,
    ),
    4000,
  );
});

test('recurring salary whose next payday is after return contributes zero to this trip', () => {
  const workspace = createWorkspace({
    moneyInItems: [
      recurringSalary(
        'salary-after-return',
        1000,
        '2026-09-20',
        'after-travel',
      ),
    ],
  });

  assert.equal(
    selectUsableTripMoneyTotal(workspace),
    0,
  );
});

test('trip-window commitments include before, departure, during and return day only', () => {
  const workspace = createWorkspace({
    commitments: [
      commitment('before', 100, '2026-09-09', true),
      commitment('departure', 200, '2026-09-10', true),
      commitment('during', 300, '2026-09-13', false),
      commitment('return', 400, '2026-09-17', false),
      commitment('after', 500, '2026-09-18', false),
      commitment('undated', 600, null, false),
      commitment(
        'paid-during',
        700,
        '2026-09-14',
        false,
        'paid',
        true,
      ),
    ],
  });

  assert.equal(
    selectTripWindowCommitmentsTotal(workspace),
    1000,
  );
});

test('scheduled booking payments are not double-deducted as commitments', () => {
  const workspace = createWorkspace({
    commitments: [
      commitment(
        'home-during',
        300,
        '2026-09-13',
        false,
      ),
    ],
    costItems: [
      {
        id: 'hotel',
        title: 'Hotel',
        categoryId: 'cat-accommodation',
        amount: 1000,
        currency: 'AED',
        status: 'estimated',
        dueDate: null,
        notes: null,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    payments: [
      {
        id: 'hotel-payment',
        costItemId: 'hotel',
        amount: 800,
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

  assert.equal(
    selectTripWindowCommitmentsTotal(workspace),
    300,
  );
});

test('next due group aggregates every unpaid commitment sharing the earliest trip-window date', () => {
  const workspace = createWorkspace({
    commitments: [
      commitment(
        'rent',
        1700,
        '2026-09-05',
        true,
      ),
      commitment(
        'bills',
        300,
        '2026-09-05',
        true,
      ),
      commitment(
        'installment-a',
        76.36,
        '2026-09-05',
        true,
      ),
      commitment(
        'later',
        500,
        '2026-09-12',
        false,
      ),
      commitment(
        'paid-same-day',
        999,
        '2026-09-05',
        true,
        'paid',
      ),
    ],
  });

  const group =
    selectNextTripWindowCommitmentGroup(
      workspace,
    );

  assert.ok(group);
  assert.equal(
    group?.dueDate,
    '2026-09-05',
  );
  assert.equal(
    group?.itemCount,
    3,
  );
  assert.equal(
    group?.totalAmount,
    2076.36,
  );
  assert.deepEqual(
    group?.items.map(
      (item) => item.id,
    ),
    [
      'rent',
      'bills',
      'installment-a',
    ],
  );
});

test('Ready Money uses trip-window inflows and commitments with reserve exactly once', () => {
  const workspace = createWorkspace({
    funds: {
      availableNow: null,
      expectedBeforeTravel: 0,
      expectedAfterTravel: 0,
      safetyReserve: 250,
      originCommitments: 0,
    },
    moneyInItems: [
      availableMoney('cash', 1000),
      expectedMoney(
        'during-income',
        700,
        '2026-09-12',
        'after-travel',
      ),
      expectedMoney(
        'after-income',
        900,
        '2026-09-20',
        'after-travel',
      ),
    ],
    commitments: [
      commitment(
        'during-obligation',
        300,
        '2026-09-15',
        false,
      ),
      commitment(
        'after-obligation',
        600,
        '2026-09-20',
        false,
      ),
    ],
  });

  assert.equal(
    selectUsableTripMoneyTotal(workspace),
    1700,
  );
  assert.equal(
    selectTripWindowCommitmentsTotal(workspace),
    300,
  );
  assert.equal(
    selectReadyMoney(workspace),
    1150,
  );
  assert.deepEqual(
    selectReadyMoneyBreakdown(
      workspace,
    ),
    {
      usableThroughReturn: 1700,
      safetyReserve: 250,
      commitmentsThroughReturn: 300,
      readyMoney: 1150,
    },
  );
});

test('incomplete trip dates keep the conservative pre-travel fallback', () => {
  const workspace = createWorkspace({
    dates: {
      departureDate: '2026-09-10',
      returnDate: null,
      flexibility: 'fixed',
    },
    moneyInItems: [
      availableMoney('cash', 100),
      expectedMoney('before', 200, '2026-09-09'),
      expectedMoney(
        'later',
        300,
        '2026-09-13',
        'after-travel',
      ),
    ],
    commitments: [
      commitment('before', 50, '2026-09-09', true),
      commitment('later', 70, '2026-09-13', false),
    ],
  });

  assert.equal(
    selectUsableTripMoneyTotal(workspace),
    300,
  );
  assert.equal(
    selectTripWindowCommitmentsTotal(workspace),
    50,
  );
});

test(
  'paid status alone never creates Ready Money',
  () => {
    const moneyInItems = [
      availableMoney(
        'current-money',
        2000,
      ),
    ];

    const unpaid =
      createWorkspace({
        moneyInItems,
        commitments: [
          commitment(
            'card',
            500,
            '2026-09-12',
            false,
            'unpaid',
          ),
        ],
      });

    const paidUnreconciled =
      createWorkspace({
        moneyInItems,
        commitments: [
          commitment(
            'card',
            500,
            '2026-09-12',
            false,
            'paid',
            false,
          ),
        ],
      });

    const legacyPaid =
      createWorkspace({
        moneyInItems,
        commitments: [
          commitment(
            'card',
            500,
            '2026-09-12',
            false,
            'paid',
          ),
        ],
      });

    const paidReconciled =
      createWorkspace({
        moneyInItems,
        commitments: [
          commitment(
            'card',
            500,
            '2026-09-12',
            false,
            'paid',
            true,
          ),
        ],
      });

    assert.equal(
      selectReadyMoney(unpaid),
      1500,
    );

    assert.equal(
      selectReadyMoney(
        paidUnreconciled,
      ),
      1500,
      'Marking paid must not create 500 AED of Ready Money.',
    );

    assert.equal(
      selectReadyMoney(
        legacyPaid,
      ),
      1500,
      'Legacy paid items without metadata must fail closed.',
    );

    assert.equal(
      selectReadyMoney(
        paidReconciled,
      ),
      2000,
      'Ready Money may increase only after explicit paid-amount reflection.',
    );

    assert.equal(
      selectTripWindowCommitmentsTotal(
        paidUnreconciled,
      ),
      500,
    );

    assert.equal(
      selectTripWindowCommitmentsTotal(
        paidReconciled,
      ),
      0,
    );
  },
);

test(
  'an early paid commitment still reduces Ready Money when its original due date is after return',
  () => {
    const moneyInItems = [
      availableMoney(
        'current-money',
        2000,
      ),
    ];

    const pendingReflection =
      createWorkspace({
        moneyInItems,
        commitments: [
          commitment(
            'future-card',
            500,
            '2026-09-20',
            false,
            'paid',
            false,
          ),
        ],
      });

    const reflected =
      createWorkspace({
        moneyInItems,
        commitments: [
          commitment(
            'future-card',
            500,
            '2026-09-20',
            false,
            'paid',
            true,
          ),
        ],
      });

    assert.equal(
      selectTripWindowCommitmentsTotal(
        pendingReflection,
      ),
      500,
    );

    assert.equal(
      selectReadyMoney(
        pendingReflection,
      ),
      1500,
    );

    assert.equal(
      selectTripWindowCommitmentsTotal(
        reflected,
      ),
      0,
    );

    assert.equal(
      selectReadyMoney(
        reflected,
      ),
      2000,
    );
  },
);
