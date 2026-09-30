import type { MessageKey } from '@jahiz/i18n';
import type { TripCostCategoryId } from '@jahiz/api-contracts';
import type { JzIconName } from '@/components/jz-icon';

export type TripCostCategoryMeta = {
  id: TripCostCategoryId;
  labelKey: MessageKey;
  defaultTitleKey: MessageKey;
  icon: JzIconName;
};

export const tripCostCategories: readonly TripCostCategoryMeta[] = [
  {
    id: 'cat-flight',
    labelKey: 'costCategoryFlight',
    defaultTitleKey: 'costDefaultFlight',
    icon: 'origin',
  },
  {
    id: 'cat-accommodation',
    labelKey: 'costCategoryAccommodation',
    defaultTitleKey: 'costDefaultAccommodation',
    icon: 'plan',
  },
  {
    id: 'cat-visa',
    labelKey: 'costCategoryVisa',
    defaultTitleKey: 'costDefaultVisa',
    icon: 'check',
  },
  {
    id: 'cat-transport',
    labelKey: 'costCategoryTransport',
    defaultTitleKey: 'costDefaultTransport',
    icon: 'route',
  },
  {
    id: 'cat-food',
    labelKey: 'costCategoryFood',
    defaultTitleKey: 'costDefaultFood',
    icon: 'receipt',
  },
  {
    id: 'cat-car',
    labelKey: 'costCategoryCar',
    defaultTitleKey: 'costDefaultCar',
    icon: 'route',
  },
  {
    id: 'cat-insurance',
    labelKey: 'costCategoryInsurance',
    defaultTitleKey: 'costDefaultInsurance',
    icon: 'check',
  },
  {
    id: 'cat-activities',
    labelKey: 'costCategoryActivities',
    defaultTitleKey: 'costDefaultActivities',
    icon: 'sparkles',
  },
  {
    id: 'cat-shopping',
    labelKey: 'costCategoryShopping',
    defaultTitleKey: 'costDefaultShopping',
    icon: 'receipt',
  },
  {
    id: 'cat-emergency',
    labelKey: 'costCategoryEmergency',
    defaultTitleKey: 'costDefaultEmergency',
    icon: 'info',
  },
  {
    id: 'cat-other-trip',
    labelKey: 'costCategoryOther',
    defaultTitleKey: 'costDefaultOther',
    icon: 'money',
  },
] as const;
