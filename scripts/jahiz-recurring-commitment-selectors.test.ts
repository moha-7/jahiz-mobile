import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tripRecurringCommitmentSchema,
  tripWorkspaceSchema,
  type TripWorkspace,
} from '../packages/api-contracts/src/index.ts';

import {
  selectBeforeTravelCommitmentsTotal,
  selectCommitmentDisplayCount,
  selectNextTripWindowCommitmentGroup,
  selectOverdueCommitmentDueItem,
  selectPaidPendingCountedCommitmentsTotal,
  selectReadyMoney,
  selectRecurringCommitmentOccurrencesThrough,
  selectTripWindowUnpaidCommitmentsTotal,
} from '../apps/mobile/src/features/trip-workspace/trip-workspace-selectors.ts';

const createdAt =
  '2026-09-15T08:00:00.000Z';

function recurring(
  overrides = {},
) {
  return tripRecurringCommitmentSchema.parse({
    id: 'rent-monthly',
    title: 'Rent',
    categoryId: 'commitment-rent',
    amount: 2500,
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

function regular(
  id: string,
  amount: number,
  dueDate: string,
) {
  return {
    id,
    title: id,
    categoryId: 'commitment-bills',
    amount,
    currency: 'AED',
    dueDate,
    dueBeforeTravel: true,
    status: 'unpaid',
    paidAmountReflectedInMoney:
      false,
    notes: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function workspace(
  overrides: Partial<TripWorkspace> = {},
): TripWorkspace {
  return tripWorkspaceSchema.parse({
    id: 'recurring-read-model',
    version: 1,
    currency: 'AED',
    route: null,
    dates: {
      departureDate: '2026-10-10',
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
    costsReviewed: true,
    costItems: [],
    payments: [],
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

test(
  'one recurring series counts as one displayed commitment',
  () => {
    const value =
      workspace({
        commitments: [
          regular(
            'electricity',
            200,
            '2026-09-28',
          ),
        ],
        recurringCommitments: [
          recurring(),
        ],
      });

    assert.equal(
      selectCommitmentDisplayCount(
        value,
      ),
      2,
    );
  },
);

test(
  'legacy aggregate turns off once recurring structured truth exists',
  () => {
    const value =
      workspace({
        funds: {
          availableNow: null,
          expectedBeforeTravel: 0,
          expectedAfterTravel: 0,
          safetyReserve: 0,
          originCommitments: 9999,
        },
        recurringCommitments: [
          recurring(),
        ],
      });

    assert.equal(
      selectBeforeTravelCommitmentsTotal(
        value,
      ),
      2500,
    );
  },
);

test(
  'Next due groups regular and recurring obligations sharing the same date',
  () => {
    const value =
      workspace({
        commitments: [
          regular(
            'phone',
            200,
            '2026-09-25',
          ),
        ],
        recurringCommitments: [
          recurring(),
        ],
      });

    const group =
      selectNextTripWindowCommitmentGroup(
        value,
      );

    assert.ok(group);
    assert.equal(
      group.dueDate,
      '2026-09-25',
    );
    assert.equal(
      group.itemCount,
      2,
    );
    assert.equal(
      group.totalAmount,
      2700,
    );
    assert.deepEqual(
      group.items.map(
        (item) =>
          item.sourceKind,
      ),
      [
        'regular',
        'recurring',
      ],
    );
  },
);

test(
  'paid recurring month is not presented as the next unpaid due',
  () => {
    const value =
      workspace({
        recurringCommitments: [
          recurring({
            paidOccurrences: [
              {
                dueDate:
                  '2026-09-25',
                amount: 2500,
                paidAmountReflectedInMoney:
                  false,
              },
            ],
          }),
        ],
      });

    const group =
      selectNextTripWindowCommitmentGroup(
        value,
      );

    assert.ok(group);

    assert.equal(
      group.dueDate,
      '2026-10-25',
    );
  },
);

test(
  'before-travel total combines unpaid recurring months with future paid cash still pending Money reconciliation',
  () => {
    const value =
      workspace({
        recurringCommitments: [
          recurring({
            paidOccurrences: [
              {
                dueDate:
                  '2026-11-25',
                amount: 2400,
                paidAmountReflectedInMoney:
                  false,
              },
            ],
          }),
        ],
      });

    assert.equal(
      selectBeforeTravelCommitmentsTotal(
        value,
      ),
      4900,
    );

    assert.equal(
      selectPaidPendingCountedCommitmentsTotal(
        value,
      ),
      2400,
    );
  },
);

test(
  'trip-window unpaid total is bounded through return rather than infinite',
  () => {
    const value =
      workspace({
        dates: {
          departureDate:
            '2026-09-20',
          returnDate:
            '2026-10-30',
          flexibility:
            'flexible',
        },
        recurringCommitments: [
          recurring(),
        ],
      });

    assert.equal(
      selectTripWindowUnpaidCommitmentsTotal(
        value,
      ),
      5000,
    );
  },
);

test(
  'oldest overdue truth can come from a recurring occurrence',
  () => {
    const value =
      workspace({
        commitments: [
          regular(
            'later-bill',
            100,
            '2026-10-01',
          ),
        ],
        recurringCommitments: [
          recurring(),
        ],
      });

    const overdue =
      selectOverdueCommitmentDueItem(
        value,
        '2026-10-20',
      );

    assert.ok(overdue);
    assert.equal(
      overdue.sourceKind,
      'recurring',
    );
    assert.equal(
      overdue.id,
      'rent-monthly',
    );
    assert.equal(
      overdue.dueDate,
      '2026-09-25',
    );
    assert.equal(
      overdue.amount,
      2500,
    );
  },
);

test(
  'paid recurring occurrence is not overdue while cash impact may remain counted',
  () => {
    const value =
      workspace({
        recurringCommitments: [
          recurring({
            paidOccurrences: [
              {
                dueDate:
                  '2026-09-25',
                amount: 2500,
                paidAmountReflectedInMoney:
                  false,
              },
            ],
          }),
        ],
      });

    const overdue =
      selectOverdueCommitmentDueItem(
        value,
        '2026-10-20',
      );

    assert.equal(
      overdue,
      null,
    );
  },
);

test(
  'Ready Money consumes recurring commitment timeline truth',
  () => {
    const value =
      workspace({
        moneyInItems: [
          {
            id: 'cash',
            title: 'Cash',
            categoryId:
              'money-in-other',
            amount: 12000,
            currency: 'AED',
            availability:
              'available-now',
            expectedTiming: null,
            expectedDate: null,
            certainty:
              'guaranteed',
            includeInReadiness:
              true,
            notes: null,
            createdAt,
            updatedAt: createdAt,
          },
        ],
        recurringCommitments: [
          recurring(),
        ],
      });

    assert.equal(
      selectReadyMoney(value),
      2000,
    );
  },
);


test(
  'D1B end date: central recurring read model stops at series end',
  () => {
    const value =
      workspace({
        recurringCommitments: [
          recurring({
            recurrence: {
              cadence: 'monthly',
              firstDueDate:
                '2026-09-25',
              endDate:
                '2026-10-31',
            },
          }),
        ],
      });

    const occurrences =
      selectRecurringCommitmentOccurrencesThrough(
        value,
        '2026-12-26',
      );

    assert.deepEqual(
      occurrences.map(
        (item) =>
          item.dueDate,
      ),
      [
        '2026-09-25',
        '2026-10-25',
      ],
    );
  },
);

test(
  'D1B end date: trip-window unpaid total excludes months after series end',
  () => {
    const value =
      workspace({
        recurringCommitments: [
          recurring({
            recurrence: {
              cadence: 'monthly',
              firstDueDate:
                '2026-09-25',
              endDate:
                '2026-10-31',
            },
          }),
        ],
      });

    assert.equal(
      selectTripWindowUnpaidCommitmentsTotal(
        value,
      ),
      5000,
    );
  },
);

test(
  'D1B end date: before-travel total excludes ended future monthly occurrences',
  () => {
    const value =
      workspace({
        dates: {
          departureDate:
            '2026-12-10',
          returnDate:
            '2026-12-26',
          flexibility:
            'flexible',
        },

        recurringCommitments: [
          recurring({
            recurrence: {
              cadence: 'monthly',
              firstDueDate:
                '2026-09-25',
              endDate:
                '2026-10-31',
            },
          }),
        ],
      });

    assert.equal(
      selectBeforeTravelCommitmentsTotal(
        value,
      ),
      5000,
    );
  },
);

test(
  'D1B end date: next due does not invent an unpaid month after an ended paid series',
  () => {
    const value =
      workspace({
        recurringCommitments: [
          recurring({
            recurrence: {
              cadence: 'monthly',
              firstDueDate:
                '2026-09-25',
              endDate:
                '2026-10-31',
            },

            paidOccurrences: [
              {
                dueDate:
                  '2026-09-25',
                amount: 2500,
                paidAmountReflectedInMoney:
                  true,
              },
              {
                dueDate:
                  '2026-10-25',
                amount: 2500,
                paidAmountReflectedInMoney:
                  true,
              },
            ],
          }),
        ],
      });

    assert.equal(
      selectNextTripWindowCommitmentGroup(
        value,
      ),
      null,
    );
  },
);

test(
  'D1B end date: overdue truth does not invent occurrences after series end',
  () => {
    const value =
      workspace({
        recurringCommitments: [
          recurring({
            recurrence: {
              cadence: 'monthly',
              firstDueDate:
                '2026-09-25',
              endDate:
                '2026-10-31',
            },

            paidOccurrences: [
              {
                dueDate:
                  '2026-09-25',
                amount: 2500,
                paidAmountReflectedInMoney:
                  true,
              },
              {
                dueDate:
                  '2026-10-25',
                amount: 2500,
                paidAmountReflectedInMoney:
                  true,
              },
            ],
          }),
        ],
      });

    assert.equal(
      selectOverdueCommitmentDueItem(
        value,
        '2026-12-20',
      ),
      null,
    );
  },
);

test(
  'D1B end date: paid cash pending inside the ended series remains counted',
  () => {
    const value =
      workspace({
        recurringCommitments: [
          recurring({
            recurrence: {
              cadence: 'monthly',
              firstDueDate:
                '2026-09-25',
              endDate:
                '2026-10-31',
            },

            paidOccurrences: [
              {
                dueDate:
                  '2026-09-25',
                amount: 2500,
                paidAmountReflectedInMoney:
                  false,
              },
              {
                dueDate:
                  '2026-10-25',
                amount: 2500,
                paidAmountReflectedInMoney:
                  false,
              },
            ],
          }),
        ],
      });

    assert.equal(
      selectPaidPendingCountedCommitmentsTotal(
        value,
      ),
      5000,
    );
  },
);
