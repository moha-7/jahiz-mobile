import { JzInlineDatePicker } from '@/components/jz-inline-date-picker';
import { useJahizLocale } from '@/providers/locale-provider';

type PaymentDatePickerProps = {
  selectedDate: string | null;
  locale: 'ar' | 'en';
  isRtl: boolean;
  onSelect: (date: string) => void;
};

export function PaymentDatePicker(
  props: PaymentDatePickerProps,
) {
  const { t } = useJahizLocale();

  return (
    <JzInlineDatePicker
      {...props}
      label={t('paymentDueDate')}
      customLabel={t('paymentCustomDate')}
      chooseLabel={t('choosePaymentDueDate')}
      todayLabel={t('todayDate')}
      tomorrowLabel={t('paymentTomorrow')}
      inDaysLabel={(days) =>
        t('paymentInDays', { days })
      }
      previousMonthLabel={t('previousMonth')}
      nextMonthLabel={t('nextMonth')}
    />
  );
}
