import type { SupportedLocale } from '@jahiz/config';

export function formatMoney(
  amount: number,
  locale: SupportedLocale,
  currency: string,
): string {
  const formattedAmount = new Intl.NumberFormat(
    locale === 'ar' ? 'ar-AE' : 'en-US',
    {
      maximumFractionDigits: 2,
    },
  ).format(amount);

  return `${formattedAmount} ${currency}`;
}
