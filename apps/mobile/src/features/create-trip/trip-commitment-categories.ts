import type { MessageKey } from '@jahiz/i18n';
import type { TripCommitmentCategoryId } from '@jahiz/api-contracts';
import type { JzIconName } from '@/components/jz-icon';

export type TripCommitmentCategoryMeta = {
  id: TripCommitmentCategoryId;
  labelKey: MessageKey;
  defaultTitleKey: MessageKey;
  icon: JzIconName;
};

export const tripCommitmentCategories:
  readonly TripCommitmentCategoryMeta[] = [
    {
      id: 'commitment-rent',
      labelKey: 'commitmentCategoryRent',
      defaultTitleKey: 'commitmentDefaultRent',
      icon: 'home',
    },
    {
      id: 'commitment-car-installment',
      labelKey: 'commitmentCategoryCar',
      defaultTitleKey: 'commitmentDefaultCar',
      icon: 'route',
    },
    {
      id: 'commitment-credit-card',
      labelKey: 'commitmentCategoryCreditCard',
      defaultTitleKey: 'commitmentDefaultCreditCard',
      icon: 'payments',
    },
    {
      id: 'commitment-bills',
      labelKey: 'commitmentCategoryBills',
      defaultTitleKey: 'commitmentDefaultBills',
      icon: 'receipt',
    },
    {
      id: 'commitment-family',
      labelKey: 'commitmentCategoryFamily',
      defaultTitleKey: 'commitmentDefaultFamily',
      icon: 'profile',
    },
    {
      id: 'commitment-other',
      labelKey: 'commitmentCategoryOther',
      defaultTitleKey: 'commitmentDefaultOther',
      icon: 'money',
    },
  ] as const;
