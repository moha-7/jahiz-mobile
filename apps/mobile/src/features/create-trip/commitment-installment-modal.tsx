import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import {
  classifyTripDateTiming,
  type TripCommitmentCategoryId,
  type TripCommitmentInstallmentCadence,
} from '@jahiz/api-contracts';
import { JzInlineDatePicker } from '@/components/jz-inline-date-picker';
import { JzIcon } from '@/components/jz-icon';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import { formatMoney } from '@/utils/format-money';
import {
  tripCommitmentCategories,
} from './trip-commitment-categories';

type InstallmentDraft = {
  title: string;
  categoryId: TripCommitmentCategoryId | null;
  amount: string;
  installmentCount: number;
  cadence: TripCommitmentInstallmentCadence;
  firstDueDate: string | null;
};

type InstallmentPreset = {
  id:
    | 'tabby'
    | 'tamara'
    | 'loan'
    | 'car-finance'
    | 'academic-fees'
    | 'credit-card'
    | 'rent-installment'
    | 'other';
  labelKey:
    | 'installmentPresetTabby'
    | 'installmentPresetTamara'
    | 'installmentPresetLoan'
    | 'installmentPresetCarFinance'
    | 'installmentPresetAcademicFees'
    | 'installmentPresetCreditCard'
    | 'installmentPresetRent'
    | 'installmentPresetOther';
  categoryId: TripCommitmentCategoryId;
};

const installmentPresets: readonly InstallmentPreset[] = [
  {
    id: 'tabby',
    labelKey: 'installmentPresetTabby',
    categoryId: 'commitment-credit-card',
  },
  {
    id: 'tamara',
    labelKey: 'installmentPresetTamara',
    categoryId: 'commitment-credit-card',
  },
  {
    id: 'loan',
    labelKey: 'installmentPresetLoan',
    categoryId: 'commitment-other',
  },
  {
    id: 'car-finance',
    labelKey: 'installmentPresetCarFinance',
    categoryId: 'commitment-car-installment',
  },
  {
    id: 'academic-fees',
    labelKey: 'installmentPresetAcademicFees',
    categoryId: 'commitment-other',
  },
  {
    id: 'credit-card',
    labelKey: 'installmentPresetCreditCard',
    categoryId: 'commitment-credit-card',
  },
  {
    id: 'rent-installment',
    labelKey: 'installmentPresetRent',
    categoryId: 'commitment-rent',
  },
  {
    id: 'other',
    labelKey: 'installmentPresetOther',
    categoryId: 'commitment-other',
  },
];

type CommitmentInstallmentModalProps = {
  visible: boolean;
  currency: string;
  locale: 'ar' | 'en';
  isRtl: boolean;
  departureDate: string | null;
  returnDate: string | null;
  onClose: () => void;
  onSave: (draft: {
    title: string;
    categoryId: TripCommitmentCategoryId;
    amount: number;
    installmentCount: number;
    cadence: TripCommitmentInstallmentCadence;
    firstDueDate: string;
  }) => void;
};

function normalizeLocalizedDigits(
  value: string,
): string {
  const arabicDigits = '٠١٢٣٤٥٦٧٨٩';
  const persianDigits = '۰۱۲۳۴۵۶۷۸۹';

  return [...value]
    .map((character) => {
      const arabicIndex =
        arabicDigits.indexOf(character);
      if (arabicIndex >= 0) {
        return String(arabicIndex);
      }

      const persianIndex =
        persianDigits.indexOf(character);
      if (persianIndex >= 0) {
        return String(persianIndex);
      }

      return character;
    })
    .join('');
}

function sanitizeMoneyInput(
  value: string,
): string {
  const normalized = normalizeLocalizedDigits(
    value,
  )
    .replace(/[,\u066B]/g, '.')
    .replace(/[^\d.]/g, '');
  const [whole = '', ...decimalParts] =
    normalized.split('.');
  const decimal = decimalParts
    .join('')
    .slice(0, 2);
  const safeWhole = whole.slice(0, 10);

  return decimalParts.length > 0
    ? `${safeWhole || '0'}.${decimal}`
    : safeWhole;
}

function parsePositiveAmount(
  value: string,
): number | null {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  if (
    !Number.isFinite(parsed) ||
    parsed <= 0
  ) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function addDaysToIsoDate(
  isoDate: string,
  days: number,
): string {
  const date = new Date(
    `${isoDate}T00:00:00.000Z`,
  );
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function addMonthsToIsoDate(
  isoDate: string,
  months: number,
): string {
  const [year, month, day] =
    isoDate.split('-').map(Number);
  const monthIndex =
    (month ?? 1) - 1 + months;
  const firstOfTarget = new Date(
    Date.UTC(year ?? 1970, monthIndex, 1),
  );
  const targetYear =
    firstOfTarget.getUTCFullYear();
  const targetMonth =
    firstOfTarget.getUTCMonth();
  const lastDay = new Date(
    Date.UTC(
      targetYear,
      targetMonth + 1,
      0,
    ),
  ).getUTCDate();
  const safeDay = Math.min(day ?? 1, lastDay);

  return new Date(
    Date.UTC(
      targetYear,
      targetMonth,
      safeDay,
    ),
  )
    .toISOString()
    .slice(0, 10);
}

function buildInstallmentAmounts(
  amount: number,
  count: number,
): number[] {
  const totalCents = Math.round(amount * 100);
  const baseCents = Math.floor(
    totalCents / count,
  );
  const remainder =
    totalCents - baseCents * count;

  return Array.from(
    { length: count },
    (_, index) =>
      (baseCents +
        (index < remainder ? 1 : 0)) /
      100,
  );
}

function emptyDraft(): InstallmentDraft {
  return {
    title: '',
    categoryId: null,
    amount: '',
    installmentCount: 4,
    cadence: 'monthly',
    firstDueDate: null,
  };
}

export function CommitmentInstallmentModal({
  visible,
  currency,
  locale,
  isRtl,
  departureDate,
  returnDate,
  onClose,
  onSave,
}: CommitmentInstallmentModalProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const [draft, setDraft] =
    useState<InstallmentDraft>(
      emptyDraft,
    );
  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';
  const amount = parsePositiveAmount(
    draft.amount,
  );
  const canSave = Boolean(
    draft.title.trim() &&
      draft.categoryId &&
      amount &&
      draft.firstDueDate,
  );

  const installmentAverage = useMemo(
    () =>
      amount
        ? Math.round(
            (amount /
              draft.installmentCount) *
              100,
          ) / 100
        : 0,
    [amount, draft.installmentCount],
  );

  const installmentSchedule = useMemo(
    () => {
      if (!amount || !draft.firstDueDate) {
        return [];
      }

      const firstDueDate =
        draft.firstDueDate;

      const amounts =
        buildInstallmentAmounts(
          amount,
          draft.installmentCount,
        );

      return amounts.map(
        (installmentAmount, index) => ({
          number: index + 1,
          amount: installmentAmount,
          dueDate:
            draft.cadence === 'biweekly'
              ? addDaysToIsoDate(
                  firstDueDate,
                  index * 14,
                )
              : addMonthsToIsoDate(
                  firstDueDate,
                  index,
                ),
        }),
      );
    },
    [
      amount,
      draft.cadence,
      draft.firstDueDate,
      draft.installmentCount,
    ],
  );

  useEffect(() => {
    if (visible) {
      setDraft(emptyDraft());
    }
  }, [visible]);

  function selectPreset(
    preset: InstallmentPreset,
  ) {
    setDraft((current) => ({
      ...current,
      categoryId: preset.categoryId,
      title: t(preset.labelKey),
    }));
    void Haptics.selectionAsync();
  }

  function save() {
    if (
      !canSave ||
      !draft.categoryId ||
      !amount ||
      !draft.firstDueDate
    ) {
      return;
    }

    onSave({
      title: draft.title.trim(),
      categoryId: draft.categoryId,
      amount,
      installmentCount:
        draft.installmentCount,
      cadence: draft.cadence,
      firstDueDate: draft.firstDueDate,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS === 'ios'
            ? 'padding'
            : undefined
        }
        style={styles.root}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('close')}
          onPress={onClose}
          style={styles.backdrop}
        />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor:
                palette.background,
              borderColor:
                palette.borderStrong,
            },
          ]}
        >
          <View
            style={[
              styles.handle,
              {
                backgroundColor:
                  palette.borderStrong,
              },
            ]}
          />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <XStack
              flexDirection={direction}
              alignItems="center"
              justifyContent="space-between"
              gap={spacing[3]}
            >
              <YStack flex={1} gap={3}>
                <JzText
                  variant="heading2"
                  textDirection={textDirection}
                  style={{
                    color: palette.textPrimary,
                  }}
                >
                  {t('addCommitmentInstallments')}
                </JzText>

                <JzText
                  variant="bodySmall"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t(
                    'commitmentInstallmentEditorHelper',
                  )}
                </JzText>
              </YStack>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('close')}
                onPress={onClose}
                style={[
                  styles.closeButton,
                  {
                    backgroundColor:
                      palette.surfaceMuted,
                    borderColor:
                      palette.border,
                  },
                ]}
              >
                <JzIcon
                  name="close"
                  size={20}
                  color={palette.textPrimary}
                  strokeWidth={2.1}
                />
              </Pressable>
            </XStack>

            <YStack gap={spacing[2]}>
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('commitmentInstallmentType')}
              </JzText>

              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: palette.textMuted,
                }}
              >
                {t('installmentPresetHelper')}
              </JzText>

              <View
                style={[
                  styles.categoryGrid,
                  {
                    flexDirection: direction,
                  },
                ]}
              >
                {installmentPresets.map(
                  (preset) => {
                    const selected =
                      draft.categoryId ===
                        preset.categoryId &&
                      draft.title ===
                        t(preset.labelKey);
                    const category =
                      tripCommitmentCategories.find(
                        (candidate) =>
                          candidate.id ===
                          preset.categoryId,
                      );

                    return (
                      <Pressable
                        key={preset.id}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected,
                        }}
                        accessibilityLabel={t(
                          preset.labelKey,
                        )}
                        onPress={() =>
                          selectPreset(preset)
                        }
                        style={({ pressed }) => [
                          styles.categoryChoice,
                          {
                            opacity:
                              pressed ? 0.8 : 1,
                            backgroundColor:
                              selected
                                ? palette.successSurface
                                : palette.surface,
                            borderColor:
                              selected
                                ? colors.mint500
                                : palette.border,
                          },
                        ]}
                      >
                        <JzIcon
                          name={
                            category?.icon ??
                            'money'
                          }
                          size={19}
                          color={
                            selected
                              ? colors.mint600
                              : palette.textSecondary
                          }
                          strokeWidth={2.1}
                        />

                        <JzText
                          variant="caption"
                          textDirection={
                            textDirection
                          }
                          textAlign="center"
                          numberOfLines={2}
                          style={{
                            color: selected
                              ? colors.mint600
                              : palette.textPrimary,
                            fontWeight: selected
                              ? '800'
                              : '600',
                          }}
                        >
                          {t(preset.labelKey)}
                        </JzText>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </YStack>

            <YStack gap={spacing[2]}>
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('commitmentName')}
              </JzText>

              <TextInput
                value={draft.title}
                maxLength={120}
                placeholder={t(
                  'commitmentNamePlaceholder',
                )}
                placeholderTextColor={
                  palette.textMuted
                }
                onChangeText={(title) =>
                  setDraft((current) => ({
                    ...current,
                    title,
                  }))
                }
                style={[
                  styles.input,
                  {
                    color: palette.textPrimary,
                    backgroundColor:
                      palette.inputBackground,
                    borderColor:
                      palette.borderStrong,
                    textAlign: isRtl
                      ? 'right'
                      : 'left',
                  },
                ]}
              />
            </YStack>

            <YStack gap={spacing[2]}>
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('commitmentPlanTotal')}
              </JzText>

              <View
                style={[
                  styles.amountShell,
                  {
                    flexDirection: direction,
                    backgroundColor:
                      palette.inputBackground,
                    borderColor:
                      palette.borderStrong,
                  },
                ]}
              >
                <TextInput
                  value={draft.amount}
                  maxLength={13}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={
                    palette.textMuted
                  }
                  onChangeText={(value) =>
                    setDraft((current) => ({
                      ...current,
                      amount:
                        sanitizeMoneyInput(
                          value,
                        ),
                    }))
                  }
                  style={[
                    styles.amountInput,
                    {
                      color: palette.textPrimary,
                    },
                  ]}
                />

                <View
                  style={[
                    styles.currencyChip,
                    {
                      backgroundColor:
                        palette.surface,
                      borderColor:
                        palette.border,
                    },
                  ]}
                >
                  <JzText
                    variant="caption"
                    textDirection="ltr"
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {currency}
                  </JzText>
                </View>
              </View>
            </YStack>

            <YStack gap={spacing[2]}>
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('commitmentInstallmentCount')}
              </JzText>

              <View
                style={[
                  styles.choiceWrap,
                  {
                    flexDirection: direction,
                  },
                ]}
              >
                {[2, 3, 4, 6, 12].map(
                  (count) => {
                    const selected =
                      draft.installmentCount ===
                      count;

                    return (
                      <Pressable
                        key={count}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected,
                        }}
                        onPress={() => {
                          setDraft((current) => ({
                            ...current,
                            installmentCount:
                              count,
                          }));
                          void Haptics.selectionAsync();
                        }}
                        style={[
                          styles.countChoice,
                          {
                            backgroundColor:
                              selected
                                ? palette.successSurface
                                : palette.surface,
                            borderColor:
                              selected
                                ? colors.mint500
                                : palette.border,
                          },
                        ]}
                      >
                        <JzText
                          variant="bodySmall"
                          textDirection="ltr"
                          style={{
                            color: selected
                              ? colors.mint600
                              : palette.textPrimary,
                            fontWeight: '800',
                          }}
                        >
                          {count}
                        </JzText>
                      </Pressable>
                    );
                  },
                )}
              </View>
            </YStack>

            <YStack gap={spacing[2]}>
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('commitmentInstallmentCadence')}
              </JzText>

              <XStack
                flexDirection={direction}
                gap={spacing[2]}
              >
                {(
                  [
                    'monthly',
                    'biweekly',
                  ] as const
                ).map((cadence) => {
                  const selected =
                    draft.cadence === cadence;

                  return (
                    <Pressable
                      key={cadence}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected,
                      }}
                      onPress={() => {
                        setDraft((current) => ({
                          ...current,
                          cadence,
                        }));
                        void Haptics.selectionAsync();
                      }}
                      style={[
                        styles.cadenceChoice,
                        {
                          backgroundColor:
                            selected
                              ? palette.successSurface
                              : palette.surface,
                          borderColor:
                            selected
                              ? colors.mint500
                              : palette.border,
                        },
                      ]}
                    >
                      <JzText
                        variant="bodySmall"
                        textDirection={textDirection}
                        textAlign="center"
                        style={{
                          color: selected
                            ? colors.mint600
                            : palette.textPrimary,
                          fontWeight: '800',
                        }}
                      >
                        {cadence === 'monthly'
                          ? t(
                              'commitmentInstallmentMonthly',
                            )
                          : t(
                              'commitmentInstallmentBiweekly',
                            )}
                      </JzText>
                    </Pressable>
                  );
                })}
              </XStack>
            </YStack>

            <JzInlineDatePicker
              selectedDate={draft.firstDueDate}
              locale={locale}
              isRtl={isRtl}
              onSelect={(firstDueDate) =>
                setDraft((current) => ({
                  ...current,
                  firstDueDate,
                }))
              }
              label={t(
                'commitmentFirstDueDate',
              )}
              customLabel={t(
                'paymentCustomDate',
              )}
              chooseLabel={t(
                'chooseCommitmentDueDate',
              )}
              todayLabel={t('todayDate')}
              tomorrowLabel={t(
                'paymentTomorrow',
              )}
              inDaysLabel={(days) =>
                t('paymentInDays', {
                  days,
                })
              }
              previousMonthLabel={t(
                'previousMonth',
              )}
              nextMonthLabel={t(
                'nextMonth',
              )}
            />

            {installmentSchedule.length > 0 ? (
              <View
                style={[
                  styles.preview,
                  {
                    backgroundColor:
                      palette.warningSurface,
                    borderColor:
                      'rgba(245,185,76,0.26)',
                  },
                ]}
              >
                <XStack
                  flexDirection={direction}
                  alignItems="center"
                  gap={spacing[3]}
                >
                  <JzIcon
                    name="payments"
                    size={19}
                    color="#F5B94C"
                    strokeWidth={2.1}
                  />
                  <YStack flex={1} gap={2}>
                    <JzText
                      variant="bodySmall"
                      textDirection={textDirection}
                      style={{
                        color: palette.textPrimary,
                        fontWeight: '800',
                      }}
                    >
                      {t(
                        'commitmentInstallmentPreviewWithFrequency',
                        {
                          count:
                            draft.installmentCount,
                          frequency: t(
                            draft.cadence ===
                            'biweekly'
                              ? 'commitmentInstallmentBiweekly'
                              : 'commitmentInstallmentMonthly',
                          ),
                        },
                      )}
                    </JzText>
                    <JzText
                      variant="caption"
                      textDirection={textDirection}
                      style={{
                        color:
                          palette.textSecondary,
                      }}
                    >
                      {t(
                        'commitmentInstallmentAverage',
                        {
                          amount: formatMoney(
                            installmentAverage,
                            locale,
                            currency,
                          ),
                        },
                      )}
                    </JzText>
                  </YStack>
                </XStack>

                <YStack
                  gap={spacing[1]}
                  style={[
                    styles.schedulePreview,
                    {
                      backgroundColor:
                        palette.surface,
                      borderColor:
                        palette.border,
                    },
                  ]}
                >
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                      fontWeight: '800',
                    }}
                  >
                    {t('paymentSchedulePreview')}
                  </JzText>

                  {installmentSchedule.map(
                    (scheduleItem) => {
                      const timing =
                        departureDate &&
                        returnDate
                          ? classifyTripDateTiming(
                              scheduleItem.dueDate,
                              'undated',
                              {
                                departureDate,
                                returnDate,
                              },
                            )
                          : 'undated';

                      const timingKey =
                        timing ===
                        'before-trip'
                          ? 'beforeTravelShort'
                          : timing ===
                              'during-trip'
                            ? 'duringTravelShort'
                            : timing ===
                                'after-trip'
                              ? 'afterTravelShort'
                              : null;

                      const timingColor =
                        timing ===
                        'before-trip'
                          ? colors.sky500
                          : timing ===
                              'during-trip'
                            ? colors.mint600
                            : palette.textMuted;

                      return (
                        <XStack
                          key={`${scheduleItem.number}-${scheduleItem.dueDate}`}
                          flexDirection={direction}
                          alignItems="center"
                          justifyContent="space-between"
                          gap={spacing[2]}
                          style={styles.scheduleRow}
                        >
                          <YStack
                            flex={1}
                            minWidth={0}
                            alignItems={
                              isRtl
                                ? 'flex-end'
                                : 'flex-start'
                            }
                            gap={1}
                          >
                            <JzText
                              variant="bodySmall"
                              textDirection="ltr"
                              style={{
                                color:
                                  palette.textPrimary,
                                fontWeight: '700',
                              }}
                            >
                              {scheduleItem.dueDate}
                            </JzText>
                            {timingKey ? (
                              <JzText
                                variant="caption"
                                textDirection={textDirection}
                                style={{
                                  color:
                                    timingColor,
                                }}
                              >
                                {t(timingKey)}
                              </JzText>
                            ) : null}
                          </YStack>
                          <JzText
                            variant="bodySmall"
                            textDirection="ltr"
                            style={{
                              color:
                                palette.textPrimary,
                              fontWeight: '800',
                            }}
                          >
                            {formatMoney(
                              scheduleItem.amount,
                              locale,
                              currency,
                            )}
                          </JzText>
                        </XStack>
                      );
                    },
                  )}
                </YStack>

                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {departureDate
                    ? t(
                        'commitmentInstallmentReadinessHelper',
                        { date: departureDate },
                      )
                    : t(
                        'commitmentInstallmentReadinessNoDate',
                      )}
                </JzText>
              </View>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled: !canSave,
              }}
              disabled={!canSave}
              onPress={save}
              style={({ pressed }) => [
                styles.primary,
                {
                  opacity: !canSave
                    ? 0.42
                    : pressed
                      ? 0.82
                      : 1,
                  backgroundColor:
                    colors.mint500,
                },
              ]}
            >
              <JzText
                variant="title"
                textDirection={textDirection}
                style={{
                  color: colors.navy950,
                  textAlign: 'center',
                }}
              >
                {t(
                  'createCommitmentInstallmentPlan',
                )}
              </JzText>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={[
                styles.secondary,
                {
                  backgroundColor:
                    palette.surface,
                  borderColor:
                    palette.borderStrong,
                },
              ]}
            >
              <JzText
                variant="title"
                textDirection={textDirection}
                style={{
                  color: palette.textPrimary,
                  textAlign: 'center',
                }}
              >
                {t('cancel')}
              </JzText>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor:
      'rgba(2,8,18,0.72)',
  },
  sheet: {
    maxHeight: '91%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    paddingTop: spacing[2],
  },
  handle: {
    width: 76,
    height: 6,
    alignSelf: 'center',
    borderRadius: radius.full,
    opacity: 0.9,
  },
  content: {
    padding: spacing[4],
    paddingBottom: spacing[8],
    gap: spacing[4],
  },
  closeButton: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
  },
  categoryGrid: {
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing[2],
  },
  categoryChoice: {
    width: '48.7%',
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[2],
    borderRadius: 18,
    borderWidth: 1,
  },
  input: {
    minHeight: 58,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
    fontSize: 17,
    fontWeight: '600',
  },
  amountShell: {
    minHeight: 64,
    alignItems: 'center',
    gap: spacing[2],
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
  },
  amountInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 25,
    fontWeight: '800',
  },
  currencyChip: {
    minWidth: 72,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
  },
  choiceWrap: {
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  countChoice: {
    minWidth: 54,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
  },
  cadenceChoice: {
    flex: 1,
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: spacing[2],
  },
  preview: {
    minHeight: 80,
    gap: spacing[3],
    borderRadius: 18,
    borderWidth: 1,
    padding: spacing[3],
  },
  schedulePreview: {
    gap: spacing[1],
    padding: spacing[3],
    borderRadius: 14,
    borderWidth: 1,
  },
  scheduleRow: {
    minHeight: 42,
    paddingVertical: spacing[1],
  },
  primary: {
    minHeight: 58,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingHorizontal: spacing[4],
  },
  secondary: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
  },
});
