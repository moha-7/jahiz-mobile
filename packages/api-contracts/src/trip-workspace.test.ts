import assert from 'node:assert/strict';
import test from 'node:test';
import {
  tripCommitmentCategoryIdSchema,
  tripCommitmentInstallmentCadenceSchema,
  tripCostCategoryIdSchema,
  tripMoneyInCategoryIdSchema,
  tripWorkspaceSchema,
  type TripWorkspace,
} from './index.ts';

const timestamp = '2026-08-05T12:00:00.000Z';

function makeWorkspace(): TripWorkspace {
  return {
    id: 'trip-local-1',
    version: 1,
    currency: 'BHD',
    route: null,
    dates: {
      departureDate: null,
      returnDate: null,
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
    moneyInReviewed: false,
    commitments: [],
    commitmentsReviewed: false,
    costItems: [],
    payments: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

test('empty trip workspace is valid and preserves incomplete state', () => {
  const result = tripWorkspaceSchema.safeParse(makeWorkspace());

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.route, null);
  assert.equal(result.data.funds.availableNow, null);
  assert.deepEqual(result.data.costItems, []);
});

test('workspace categories include quick-add travel categories', () => {
  for (const categoryId of [
    'cat-flight',
    'cat-accommodation',
    'cat-visa',
    'cat-transport',
    'cat-food',
    'cat-car',
    'cat-insurance',
    'cat-activities',
    'cat-shopping',
    'cat-emergency',
    'cat-other-trip',
  ]) {
    assert.equal(tripCostCategoryIdSchema.safeParse(categoryId).success, true);
  }
});

test('return date cannot be before departure date', () => {
  const workspace = makeWorkspace();
  workspace.dates = {
    departureDate: '2026-08-20',
    returnDate: '2026-08-10',
    flexibility: 'fixed',
  };

  assert.equal(tripWorkspaceSchema.safeParse(workspace).success, false);
});

test('payment must reference an existing cost item', () => {
  const workspace = makeWorkspace();
  workspace.payments.push({
    id: 'payment-1',
    costItemId: 'missing-cost',
    amount: 20,
    currency: 'BHD',
    status: 'paid',
    paidAt: timestamp,
    dueDate: null,
    method: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assert.equal(tripWorkspaceSchema.safeParse(workspace).success, false);
});

test('paid total cannot exceed its cost item amount', () => {
  const workspace = makeWorkspace();
  workspace.costItems.push({
    id: 'cost-flight',
    title: 'Flight',
    categoryId: 'cat-flight',
    amount: 100,
    currency: 'BHD',
    status: 'confirmed',
    dueDate: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  workspace.payments.push({
    id: 'payment-flight',
    costItemId: 'cost-flight',
    amount: 120,
    currency: 'BHD',
    status: 'paid',
    paidAt: timestamp,
    dueDate: null,
    method: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assert.equal(tripWorkspaceSchema.safeParse(workspace).success, false);
});

test('scheduled payments require a due date', () => {
  const workspace = makeWorkspace();
  workspace.costItems.push({
    id: 'cost-hotel',
    title: 'Hotel',
    categoryId: 'cat-accommodation',
    amount: 250,
    currency: 'BHD',
    status: 'estimated',
    dueDate: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  workspace.payments.push({
    id: 'payment-hotel',
    costItemId: 'cost-hotel',
    amount: 50,
    currency: 'BHD',
    status: 'scheduled',
    paidAt: null,
    dueDate: null,
    method: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assert.equal(tripWorkspaceSchema.safeParse(workspace).success, false);
});

test('valid dates preserve flexibility in the workspace contract', () => {
  const workspace = makeWorkspace();
  workspace.dates = {
    departureDate: '2026-08-20',
    returnDate: '2026-08-29',
    flexibility: 'flexible',
  };

  const result = tripWorkspaceSchema.safeParse(workspace);

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.dates.flexibility, 'flexible');
});

test('zero ready money is a valid explicit funds value', () => {
  const workspace = makeWorkspace();
  workspace.funds = {
    availableNow: 0,
    expectedBeforeTravel: 0,
    expectedAfterTravel: 0,
    safetyReserve: 0,
    originCommitments: 0,
  };

  const result = tripWorkspaceSchema.safeParse(workspace);

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.funds.availableNow, 0);
});

test('negative funds are rejected by the workspace contract', () => {
  const workspace = makeWorkspace();
  workspace.funds = {
    availableNow: 100,
    expectedBeforeTravel: 0,
    expectedAfterTravel: 0,
    safetyReserve: -1,
    originCommitments: 0,
  };

  assert.equal(tripWorkspaceSchema.safeParse(workspace).success, false);
});

test('quick-add cost items preserve category and estimated status', () => {
  const workspace = makeWorkspace();
  workspace.costItems.push({
    id: 'cost-quick-add',
    title: 'Airport taxi',
    categoryId: 'cat-transport',
    amount: 25.5,
    currency: 'BHD',
    status: 'estimated',
    dueDate: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const result = tripWorkspaceSchema.safeParse(workspace);

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(
    result.data.costItems[0]?.categoryId,
    'cat-transport',
  );
  assert.equal(
    result.data.costItems[0]?.status,
    'estimated',
  );
});

test('quick-add cost amount must be greater than zero', () => {
  const workspace = makeWorkspace();
  workspace.costItems.push({
    id: 'cost-zero',
    title: 'Invalid cost',
    categoryId: 'cat-other-trip',
    amount: 0,
    currency: 'BHD',
    status: 'estimated',
    dueDate: null,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assert.equal(tripWorkspaceSchema.safeParse(workspace).success, false);
});

test('legacy workspaces receive commitment defaults', () => {
  const legacy = {
    ...makeWorkspace(),
  } as Record<string, unknown>;

  delete legacy.moneyInItems;
  delete legacy.moneyInReviewed;
  delete legacy.commitments;
  delete legacy.commitmentsReviewed;

  const result = tripWorkspaceSchema.safeParse(legacy);

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.deepEqual(result.data.moneyInItems, []);
  assert.equal(result.data.moneyInReviewed, false);
  assert.deepEqual(result.data.commitments, []);
  assert.equal(
    result.data.commitmentsReviewed,
    false,
  );
});

test('workspace includes structured commitment categories', () => {
  for (const categoryId of [
    'commitment-rent',
    'commitment-car-installment',
    'commitment-credit-card',
    'commitment-bills',
    'commitment-family',
    'commitment-other',
  ]) {
    assert.equal(
      tripCommitmentCategoryIdSchema.safeParse(
        categoryId,
      ).success,
      true,
    );
  }
});

test('structured commitment preserves review and due-before-travel data', () => {
  const workspace = makeWorkspace();
  workspace.commitmentsReviewed = true;
  workspace.commitments.push({
    id: 'commitment-rent',
    title: 'Rent',
    categoryId: 'commitment-rent',
    amount: 500,
    currency: 'BHD',
    dueDate: '2026-08-15',
    dueBeforeTravel: true,
    status: 'unpaid',
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const result = tripWorkspaceSchema.safeParse(
    workspace,
  );

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(
    result.data.commitments[0]?.dueBeforeTravel,
    true,
  );
  assert.equal(
    result.data.commitmentsReviewed,
    true,
  );
});

test('commitments must use the workspace currency', () => {
  const workspace = makeWorkspace();
  workspace.commitments.push({
    id: 'commitment-card',
    title: 'Credit card',
    categoryId: 'commitment-credit-card',
    amount: 40,
    currency: 'AED',
    dueDate: '2026-08-18',
    dueBeforeTravel: true,
    status: 'unpaid',
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assert.equal(
    tripWorkspaceSchema.safeParse(workspace)
      .success,
    false,
  );
});

test('commitment ids must be unique', () => {
  const workspace = makeWorkspace();
  const item = {
    id: 'commitment-bills',
    title: 'Bills',
    categoryId: 'commitment-bills' as const,
    amount: 25,
    currency: 'BHD',
    dueDate: '2026-08-16',
    dueBeforeTravel: true,
    status: 'unpaid' as const,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  workspace.commitments.push(item, {
    ...item,
    title: 'Other bills',
  });

  assert.equal(
    tripWorkspaceSchema.safeParse(workspace)
      .success,
    false,
  );
});

test('workspace includes structured Money In categories', () => {
  for (const categoryId of [
    'money-in-savings',
    'money-in-salary',
    'money-in-freelance-business',
    'money-in-family-support',
    'money-in-bonus-commission',
    'money-in-refund',
    'money-in-asset-sale',
    'money-in-other',
  ]) {
    assert.equal(
      tripMoneyInCategoryIdSchema.safeParse(categoryId).success,
      true,
    );
  }
});

test('structured Money In preserves readiness and timing data', () => {
  const workspace = makeWorkspace();
  workspace.moneyInReviewed = true;
  workspace.moneyInItems.push({
    id: 'money-in-salary',
    title: 'August salary',
    categoryId: 'money-in-salary',
    amount: 900,
    currency: 'BHD',
    availability: 'expected',
    expectedTiming: 'before-travel',
    expectedDate: '2026-08-18',
    certainty: 'guaranteed',
    includeInReadiness: true,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const result = tripWorkspaceSchema.safeParse(workspace);

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(result.data.moneyInReviewed, true);
  assert.equal(
    result.data.moneyInItems[0]?.expectedTiming,
    'before-travel',
  );
  assert.equal(
    result.data.moneyInItems[0]?.includeInReadiness,
    true,
  );
});

test('available Money In cannot carry expected timing or date', () => {
  const workspace = makeWorkspace();
  workspace.moneyInItems.push({
    id: 'money-in-invalid-available',
    title: 'Cash',
    categoryId: 'money-in-savings',
    amount: 100,
    currency: 'BHD',
    availability: 'available-now',
    expectedTiming: 'before-travel',
    expectedDate: '2026-08-18',
    certainty: 'guaranteed',
    includeInReadiness: true,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assert.equal(tripWorkspaceSchema.safeParse(workspace).success, false);
});

test('expected Money In requires before- or after-travel timing', () => {
  const workspace = makeWorkspace();
  workspace.moneyInItems.push({
    id: 'money-in-invalid-expected',
    title: 'Expected transfer',
    categoryId: 'money-in-other',
    amount: 100,
    currency: 'BHD',
    availability: 'expected',
    expectedTiming: null,
    expectedDate: null,
    certainty: 'non-guaranteed',
    includeInReadiness: false,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assert.equal(tripWorkspaceSchema.safeParse(workspace).success, false);
});

test('Money In items must use the workspace currency', () => {
  const workspace = makeWorkspace();
  workspace.moneyInItems.push({
    id: 'money-in-wrong-currency',
    title: 'Savings',
    categoryId: 'money-in-savings',
    amount: 100,
    currency: 'AED',
    availability: 'available-now',
    expectedTiming: null,
    expectedDate: null,
    certainty: 'guaranteed',
    includeInReadiness: true,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assert.equal(tripWorkspaceSchema.safeParse(workspace).success, false);
});

test('Money In item ids must be unique', () => {
  const workspace = makeWorkspace();
  const item = {
    id: 'money-in-duplicate',
    title: 'Savings',
    categoryId: 'money-in-savings' as const,
    amount: 100,
    currency: 'BHD',
    availability: 'available-now' as const,
    expectedTiming: null,
    expectedDate: null,
    certainty: 'guaranteed' as const,
    includeInReadiness: true,
    notes: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  workspace.moneyInItems.push(item, {
    ...item,
    title: 'Other savings',
  });

  assert.equal(tripWorkspaceSchema.safeParse(workspace).success, false);
});

test('workspace supports commitment installment cadences', () => {
  for (const cadence of ['monthly', 'biweekly']) {
    assert.equal(
      tripCommitmentInstallmentCadenceSchema.safeParse(cadence).success,
      true,
    );
  }

  assert.equal(
    tripCommitmentInstallmentCadenceSchema.safeParse('weekly').success,
    false,
  );
});

test('commitment installment metadata is preserved when complete', () => {
  const workspace = makeWorkspace();

  workspace.commitments.push({
    id: 'commitment-installment-1',
    title: 'Car installment',
    categoryId: 'commitment-car-installment',
    amount: 100,
    currency: 'BHD',
    dueDate: '2026-08-20',
    dueBeforeTravel: true,
    status: 'unpaid',
    notes: null,
    installmentPlanId: 'commitment-plan-1',
    installmentCadence: 'monthly',
    installmentNumber: 1,
    installmentCount: 4,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  const result = tripWorkspaceSchema.safeParse(workspace);

  assert.equal(result.success, true);
  if (!result.success) return;

  assert.equal(
    result.data.commitments[0]?.installmentPlanId,
    'commitment-plan-1',
  );
  assert.equal(
    result.data.commitments[0]?.installmentCadence,
    'monthly',
  );
});

test('partial commitment installment metadata is rejected', () => {
  const workspace = makeWorkspace();

  workspace.commitments.push({
    id: 'commitment-installment-partial',
    title: 'Rent',
    categoryId: 'commitment-rent',
    amount: 100,
    currency: 'BHD',
    dueDate: '2026-08-20',
    dueBeforeTravel: true,
    status: 'unpaid',
    notes: null,
    installmentPlanId: 'commitment-plan-partial',
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assert.equal(
    tripWorkspaceSchema.safeParse(workspace).success,
    false,
  );
});

test('commitment installment number cannot exceed installment count', () => {
  const workspace = makeWorkspace();

  workspace.commitments.push({
    id: 'commitment-installment-invalid-number',
    title: 'Credit card',
    categoryId: 'commitment-credit-card',
    amount: 100,
    currency: 'BHD',
    dueDate: '2026-08-20',
    dueBeforeTravel: true,
    status: 'unpaid',
    notes: null,
    installmentPlanId: 'commitment-plan-invalid',
    installmentCadence: 'monthly',
    installmentNumber: 5,
    installmentCount: 4,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  assert.equal(
    tripWorkspaceSchema.safeParse(workspace).success,
    false,
  );
});

test(
  'commitment paid-amount reflection stays backward compatible and paid-only',
  () => {
    const legacyWorkspace =
      makeWorkspace();

    legacyWorkspace.commitments.push({
      id: 'legacy-paid',
      title: 'Legacy paid commitment',
      categoryId: 'commitment-other',
      amount: 100,
      currency: legacyWorkspace.currency,
      dueDate: '2026-08-15',
      dueBeforeTravel: true,
      status: 'paid',
      notes: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const legacyResult =
      tripWorkspaceSchema.safeParse(
        legacyWorkspace,
      );

    assert.equal(
      legacyResult.success,
      true,
      'Legacy commitments without reconciliation metadata must remain valid.',
    );

    const invalidWorkspace =
      makeWorkspace();

    invalidWorkspace.commitments.push({
      id: 'invalid-unpaid-reconciled',
      title: 'Invalid commitment',
      categoryId: 'commitment-other',
      amount: 100,
      currency: invalidWorkspace.currency,
      dueDate: '2026-08-15',
      dueBeforeTravel: true,
      status: 'unpaid',
      paidAmountReflectedInMoney: true,
      notes: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    assert.equal(
      tripWorkspaceSchema.safeParse(
        invalidWorkspace,
      ).success,
      false,
      'An unpaid commitment cannot claim that a paid cash impact was reconciled.',
    );
  },
);
