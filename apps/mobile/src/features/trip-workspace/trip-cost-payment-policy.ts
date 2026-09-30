import type {
  TripCostCategoryId,
  TripCostItem,
} from '@jahiz/api-contracts';

const PAYMENT_TRACKABLE_COST_CATEGORIES =
  new Set<TripCostCategoryId>([
    'cat-flight',
    'cat-accommodation',
    'cat-visa',
    'cat-car',
    'cat-insurance',
    'cat-activities',
  ]);

export function isPaymentTrackableCostCategory(
  categoryId: TripCostCategoryId,
): boolean {
  return PAYMENT_TRACKABLE_COST_CATEGORIES.has(
    categoryId,
  );
}

export function isPaymentTrackableCost(
  cost: TripCostItem,
): boolean {
  return isPaymentTrackableCostCategory(
    cost.categoryId,
  );
}
