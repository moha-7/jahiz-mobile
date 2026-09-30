import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tripWorkspaceSchema,
  type TripPaymentStatus,
  type TripWorkspace,
} from '../packages/api-contracts/src/index.ts';
import {
  selectNeedToSave,
  selectPaidTotal,
  selectReadyMoney,
  selectRemainingTotal,
  selectTripSteps,
} from '../apps/mobile/src/features/trip-workspace/trip-workspace-selectors.ts';

const createdAt = '2026-09-04T00:00:00.000Z';

function payment(
  status: TripPaymentStatus,
  amount = 1000,
) {
  return {
    id: `payment-${status}`,
    costItemId: 'flight',
    amount,
    currency: 'AED',
    status,
    paidAt:
      status === 'paid'
        ? '2026-09-03T12:00:00.000Z'
        : null,
    dueDate:
      status === 'scheduled'
        ? '2026-09-08'
        : null,
    method: null,
    notes: null,
    createdAt,
    updatedAt: createdAt,
  };
}

function createWorkspace(
  options: {
    paymentStatus?: TripPaymentStatus | null;
    moneyInReviewed?: boolean;
  } = {},
): TripWorkspace {
  const {
    paymentStatus = null,
    moneyInReviewed = true,
  } = options;

  return tripWorkspaceSchema.parse({
    id: 'trip-need-to-save',
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
    moneyInItems: moneyInReviewed
      ? [
          {
            id: 'current-cash',
            title: 'Current cash',
            categoryId: 'money-in-savings',
            amount: 1500,
            currency: 'AED',
            availability: 'available-now',
            expectedTiming: null,
            expectedDate: null,
            certainty: 'guaranteed',
            includeInReadiness: true,
            notes: null,
            createdAt,
            updatedAt: createdAt,
          },
        ]
      : [],
    moneyInReviewed,
    commitments: [],
    commitmentsReviewed: true,
    costsReviewed: true,
    costItems: [
      {
        id: 'flight',
        title: 'Flight',
        categoryId: 'cat-flight',
        amount: 3000,
        currency: 'AED',
        status: 'confirmed',
        dueDate: null,
        notes: null,
        createdAt,
        updatedAt: createdAt,
      },
    ],
    payments:
      paymentStatus === null
        ? []
        : [payment(paymentStatus)],
    createdAt,
    updatedAt: createdAt,
  });
}

test('Need to Save is unchanged when no trip cost has been paid', () => {
  const workspace = createWorkspace();

  assert.equal(selectPaidTotal(workspace), 0);
  assert.equal(selectRemainingTotal(workspace), 3000);
  assert.equal(selectReadyMoney(workspace), 1500);
  assert.equal(selectNeedToSave(workspace), 1500);
});

test('paid booking lowers Remaining total and Need to Save by the same amount', () => {
  const workspace = createWorkspace({
    paymentStatus: 'paid',
  });

  assert.equal(selectPaidTotal(workspace), 1000);
  assert.equal(selectRemainingTotal(workspace), 2000);
  assert.equal(selectReadyMoney(workspace), 1500);
  assert.equal(selectNeedToSave(workspace), 500);
});

test('scheduled booking stays unpaid and does not lower Need to Save', () => {
  const workspace = createWorkspace({
    paymentStatus: 'scheduled',
  });

  assert.equal(selectPaidTotal(workspace), 0);
  assert.equal(selectRemainingTotal(workspace), 3000);
  assert.equal(selectReadyMoney(workspace), 1500);
  assert.equal(selectNeedToSave(workspace), 1500);
});

test('payment status never changes Ready Money or infers a funding source', () => {
  const scheduled = createWorkspace({
    paymentStatus: 'scheduled',
  });
  const paid = createWorkspace({
    paymentStatus: 'paid',
  });

  assert.equal(
    selectReadyMoney(scheduled),
    selectReadyMoney(paid),
  );
  assert.equal(selectReadyMoney(paid), 1500);
});

test('current funds after a partial payment report only the true remaining gap', () => {
  const workspace = createWorkspace({
    paymentStatus: 'paid',
  });

  assert.deepEqual(
    {
      totalCost: 3000,
      paid: selectPaidTotal(workspace),
      remaining: selectRemainingTotal(workspace),
      currentReadyMoney: selectReadyMoney(workspace),
      needToSave: selectNeedToSave(workspace),
    },
    {
      totalCost: 3000,
      paid: 1000,
      remaining: 2000,
      currentReadyMoney: 1500,
      needToSave: 500,
    },
  );
});

test('missing Money review remains explicitly incomplete instead of becoming a completed financial fact', () => {
  const workspace = createWorkspace({
    moneyInReviewed: false,
  });

  const fundsStep = selectTripSteps(workspace).find(
    (step) => step.key === 'funds',
  );

  assert.equal(fundsStep?.status, 'incomplete');
});
