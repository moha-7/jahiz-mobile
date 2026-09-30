import type {
  TripMoneyInCategoryId,
} from '@jahiz/api-contracts';
import type {
  MessageKey,
} from '@jahiz/i18n';
import type {
  JzIconName,
} from '@/components/jz-icon';

export type TripMoneyInCategoryMeta = {
  id: TripMoneyInCategoryId;
  labelKey: MessageKey;
  defaultTitleKey: MessageKey;
  icon: JzIconName;
};

export const tripMoneyInCategories:
  readonly TripMoneyInCategoryMeta[] = [
    {
      id: 'money-in-savings',
      labelKey: 'moneyInCategorySavings',
      defaultTitleKey:
        'moneyInDefaultSavings',
      icon: 'money',
    },
    {
      id: 'money-in-salary',
      labelKey: 'moneyInCategorySalary',
      defaultTitleKey:
        'moneyInDefaultSalary',
      icon: 'payments',
    },
    {
      id: 'money-in-freelance-business',
      labelKey:
        'moneyInCategoryFreelanceBusiness',
      defaultTitleKey:
        'moneyInDefaultFreelanceBusiness',
      icon: 'sparkles',
    },
    {
      id: 'money-in-family-support',
      labelKey:
        'moneyInCategoryFamilySupport',
      defaultTitleKey:
        'moneyInDefaultFamilySupport',
      icon: 'home',
    },
    {
      id: 'money-in-bonus-commission',
      labelKey:
        'moneyInCategoryBonusCommission',
      defaultTitleKey:
        'moneyInDefaultBonusCommission',
      icon: 'sparkles',
    },
    {
      id: 'money-in-refund',
      labelKey: 'moneyInCategoryRefund',
      defaultTitleKey:
        'moneyInDefaultRefund',
      icon: 'receipt',
    },
    {
      id: 'money-in-asset-sale',
      labelKey: 'moneyInCategoryAssetSale',
      defaultTitleKey:
        'moneyInDefaultAssetSale',
      icon: 'money',
    },
    {
      id: 'money-in-other',
      labelKey: 'moneyInCategoryOther',
      defaultTitleKey:
        'moneyInDefaultOther',
      icon: 'money',
    },
  ];
