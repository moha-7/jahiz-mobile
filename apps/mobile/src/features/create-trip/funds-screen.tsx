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
import {
  useRouter,
  type Href,
} from 'expo-router';
import * as Haptics from 'expo-haptics';
import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import {
  isDuplicateMoneySource,
  type TripMoneyInAvailability,
  type TripMoneyInCategoryId,
  type TripMoneyInCertainty,
  type TripMoneyInExpectedTiming,
  type TripMoneyInItem,
  type TripMoneyInMonthlyRecurrence,
} from '@jahiz/api-contracts';
import { JzCalendarModal } from '@/components/jz-calendar-modal';
import { JzFlowAppBar } from '@/components/jz-flow-app-bar';
import { JzFlowFooter } from '@/components/jz-flow-footer';
import { JzActionMenuSheet } from '@/components/jz-action-menu-sheet';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { JzIcon } from '@/components/jz-icon';
import { JzShellSurface } from '@/components/jz-shell-surface';
import { Screen } from '@/components/screen';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import {
  selectAvailableNowMoneyInTotal,
  selectTripWindowCommitmentsTotal,
  selectCommitmentDisplayCount,
  selectExpectedByReturnMoneyInTotal,
  selectReadyMoney,
  selectUsableTripMoneyTotal,
  useTripWorkspaceStore,
} from '@/features/trip-workspace';
import { formatMoney } from '@/utils/format-money';
import {
  tripMoneyInCategories,
  type TripMoneyInCategoryMeta,
} from './trip-money-in-categories';

type MoneyInDraft = {
  title: string;
  categoryId: TripMoneyInCategoryId | null;
  amount: string;
  availability: TripMoneyInAvailability;
  expectedTiming: TripMoneyInExpectedTiming | null;
  expectedDate: string | null;
  certainty: TripMoneyInCertainty;
  repeatsMonthly: boolean;
  nextSalaryDate: string | null;
  includeInReadiness: boolean;
  notes: string;
};

type MoneyInEditorModalProps = {
  visible: boolean;
  item: TripMoneyInItem | null;
  currency: string;
  departureDate: string | null;
  returnDate: string | null;
  existingItems: TripMoneyInItem[];
  isRtl: boolean;
  locale: 'ar' | 'en';
  onClose: () => void;
  onSave: (draft: {
    title: string;
    categoryId: TripMoneyInCategoryId;
    amount: number;
    availability: TripMoneyInAvailability;
    expectedTiming: TripMoneyInExpectedTiming | null;
    expectedDate: string | null;
    certainty: TripMoneyInCertainty;
    recurrence:
      | TripMoneyInMonthlyRecurrence
      | null;
    includeInReadiness: boolean;
    notes: string | null;
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

function parseNonNegativeAmount(
  value: string,
): number | null {
  if (!value.trim()) {
    return 0;
  }

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return Math.round(parsed * 100) / 100;
}

function todayIso(): string {
  const today = new Date();

  return [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
}

function createEmptyDraft(): MoneyInDraft {
  return {
    title: '',
    categoryId: null,
    amount: '',
    availability: 'available-now',
    expectedTiming: null,
    expectedDate: null,
    certainty: 'guaranteed',
    repeatsMonthly: false,
    nextSalaryDate: null,
    includeInReadiness: true,
    notes: '',
  };
}

function categoryFor(
  categoryId: TripMoneyInCategoryId,
): TripMoneyInCategoryMeta {
  const category = tripMoneyInCategories.find(
    (item) => item.id === categoryId,
  );

  if (!category) {
    throw new Error(
      `Unknown Money In category: ${categoryId}`,
    );
  }

  return category;
}

function MoneyInEditorModal({
  visible,
  item,
  currency,
  departureDate,
  returnDate,
  existingItems,
  isRtl,
  locale,
  onClose,
  onSave,
}: MoneyInEditorModalProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const [draft, setDraft] =
    useState<MoneyInDraft>(
      createEmptyDraft,
    );
  const [
    calendarTarget,
    setCalendarTarget,
  ] = useState<
    'expected-date' | 'next-salary' | null
  >(null);

  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';
  const tripReadinessCutoffDate =
    returnDate ?? departureDate;
  const amount = parsePositiveAmount(
    draft.amount,
  );

  const isSalary =
    draft.categoryId ===
    'money-in-salary';
  const recurringSalary =
    isSalary &&
    draft.repeatsMonthly;
  const effectiveExpectedTiming =
    recurringSalary &&
    draft.nextSalaryDate
      ? tripReadinessCutoffDate &&
        draft.nextSalaryDate >
          tripReadinessCutoffDate
        ? 'after-travel'
        : 'before-travel'
      : draft.expectedTiming;
  const duplicateSource =
    Boolean(
      draft.categoryId &&
        draft.title.trim() &&
        isDuplicateMoneySource(
          existingItems,
          {
            categoryId:
              draft.categoryId,
            title: draft.title,
          },
          item?.id,
        ),
    );

  const canSave = Boolean(
    draft.title.trim() &&
      draft.categoryId &&
      amount &&
      !duplicateSource &&
      (
        !recurringSalary ||
        draft.nextSalaryDate
      ) &&
      (
        draft.availability === 'available-now' ||
        effectiveExpectedTiming
      ),
  );

  useEffect(() => {
    if (!visible) {
      return;
    }

    setCalendarTarget(null);

    if (item) {
      const recurringSalary =
        item.categoryId ===
          'money-in-salary' &&
        item.recurrence?.cadence ===
          'monthly';
      const recurringExpectedTiming =
        recurringSalary &&
        item.recurrence?.nextDate
          ? tripReadinessCutoffDate &&
            item.recurrence.nextDate >
              tripReadinessCutoffDate
            ? 'after-travel'
            : 'before-travel'
          : item.expectedTiming;

      setDraft({
        title: item.title,
        categoryId: item.categoryId,
        amount: String(item.amount),
        availability: recurringSalary
          ? 'expected'
          : item.availability,
        expectedTiming:
          recurringExpectedTiming,
        expectedDate: recurringSalary
          ? null
          : item.expectedDate,
        certainty: recurringSalary
          ? 'guaranteed'
          : item.certainty,
        repeatsMonthly: recurringSalary,
        nextSalaryDate:
          item.recurrence?.nextDate ??
          null,
        includeInReadiness:
          recurringSalary &&
          recurringExpectedTiming ===
            'after-travel'
            ? false
            : item.includeInReadiness,
        notes: item.notes ?? '',
      });
      return;
    }

    setDraft(createEmptyDraft());
  }, [
    item,
    tripReadinessCutoffDate,
    visible,
  ]);

  function closeEditor() {
    setCalendarTarget(null);
    onClose();
  }

  function selectCategory(
    category: TripMoneyInCategoryMeta,
  ) {
    setDraft((current) => ({
      ...current,
      categoryId: category.id,
      title: t(category.defaultTitleKey),
      repeatsMonthly:
        category.id ===
          'money-in-salary'
          ? current.repeatsMonthly
          : false,
      nextSalaryDate:
        category.id ===
          'money-in-salary'
          ? current.nextSalaryDate
          : null,
    }));

    void Haptics.selectionAsync();
  }

  function selectMonthlySalary(
    repeatsMonthly: boolean,
  ) {
    setDraft((current) => {
      if (!repeatsMonthly) {
        return {
          ...current,
          repeatsMonthly: false,
          nextSalaryDate: null,
        };
      }

      const recurringTiming =
        current.nextSalaryDate &&
        tripReadinessCutoffDate &&
        current.nextSalaryDate >
          tripReadinessCutoffDate
          ? 'after-travel'
          : 'before-travel';

      return {
        ...current,
        repeatsMonthly: true,
        availability: 'expected',
        expectedTiming:
          recurringTiming,
        expectedDate: null,
        certainty: 'guaranteed',
        nextSalaryDate:
          current.nextSalaryDate,
        includeInReadiness:
          recurringTiming !==
          'after-travel',
      };
    });

    void Haptics.selectionAsync();
  }

  function selectAvailability(
    availability: TripMoneyInAvailability,
  ) {
    setDraft((current) => {
      if (availability === 'available-now') {
        return {
          ...current,
          availability,
          expectedTiming: null,
          expectedDate: null,
          certainty: 'guaranteed',
          includeInReadiness: true,
        };
      }

      const recurringTiming =
        current.repeatsMonthly &&
        current.nextSalaryDate
          ? tripReadinessCutoffDate &&
            current.nextSalaryDate >
              tripReadinessCutoffDate
            ? 'after-travel'
            : 'before-travel'
          : current.expectedTiming ??
            'before-travel';

      return {
        ...current,
        availability,
        expectedTiming:
          recurringTiming,
        certainty:
          current.certainty === 'guaranteed'
            ? 'guaranteed'
            : 'non-guaranteed',
        includeInReadiness:
          current.repeatsMonthly
            ? current.includeInReadiness
            : recurringTiming ===
                'after-travel'
              ? false
              : current.includeInReadiness,
      };
    });

    void Haptics.selectionAsync();
  }

  function selectExpectedTiming(
    expectedTiming: TripMoneyInExpectedTiming,
  ) {
    setDraft((current) => ({
      ...current,
      expectedTiming,
      includeInReadiness:
        expectedTiming === 'after-travel'
          ? false
          : current.includeInReadiness,
    }));

    void Haptics.selectionAsync();
  }

  function save() {
    if (
      !canSave ||
      !draft.categoryId ||
      !amount
    ) {
      return;
    }

    const availableNow =
      draft.availability === 'available-now';
    const recurrence =
      recurringSalary &&
      draft.nextSalaryDate
        ? {
            cadence:
              'monthly' as const,
            nextDate:
              draft.nextSalaryDate,
          }
        : null;
    const resolvedExpectedTiming =
      availableNow
        ? null
        : effectiveExpectedTiming;
    const resolvedExpectedDate =
      availableNow
        ? null
        : recurringSalary
          ? draft.nextSalaryDate
          : draft.expectedDate;

    onSave({
      title: draft.title.trim(),
      categoryId: draft.categoryId,
      amount,
      availability: draft.availability,
      expectedTiming:
        resolvedExpectedTiming,
      expectedDate:
        resolvedExpectedDate,
      certainty: availableNow
        ? 'guaranteed'
        : draft.certainty,
      recurrence,
      includeInReadiness:
        !recurringSalary &&
        !availableNow &&
        resolvedExpectedTiming ===
          'after-travel'
          ? false
          : draft.includeInReadiness,
      notes: draft.notes.trim()
        ? draft.notes.trim()
        : null,
    });
  }

  return (
    <>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeEditor}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === 'ios'
              ? 'padding'
              : undefined
          }
          style={styles.modalRoot}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('close')}
            onPress={closeEditor}
            style={styles.modalBackdrop}
          />

          <View
            style={[
              styles.modalSheet,
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
                styles.modalHandle,
                {
                  backgroundColor:
                    palette.borderStrong,
                },
              ]}
            />

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                styles.modalContent
              }
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
                      color:
                        palette.textPrimary,
                    }}
                  >
                    {item
                      ? t('editMoneySource')
                      : t('addMoneySource')}
                  </JzText>

                  <JzText
                    variant="bodySmall"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t('moneyInEditorHelper')}
                  </JzText>
                </YStack>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('close')}
                  onPress={closeEditor}
                  style={[
                    styles.roundButton,
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
                  {t('moneyInCategory')}
                </JzText>

                <View
                  style={[
                    styles.categoryGrid,
                    {
                      flexDirection: direction,
                    },
                  ]}
                >
                  {tripMoneyInCategories.map(
                    (category) => {
                      const selected =
                        draft.categoryId ===
                        category.id;

                      return (
                        <Pressable
                          key={category.id}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected,
                          }}
                          accessibilityLabel={t(
                            category.labelKey,
                          )}
                          onPress={() =>
                            selectCategory(
                              category,
                            )
                          }
                          style={({ pressed }) => [
                            styles.categoryChoice,
                            {
                              opacity:
                                pressed
                                  ? 0.80
                                  : 1,
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
                            name={category.icon}
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
                            style={{
                              color: selected
                                ? colors.mint600
                                : palette.textPrimary,
                            }}
                          >
                            {t(category.labelKey)}
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
                  {t('moneyInName')}
                </JzText>

                <TextInput
                  value={draft.title}
                  maxLength={120}
                  autoCorrect
                  returnKeyType="next"
                  placeholder={t(
                    'moneyInNamePlaceholder',
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
                    styles.textInput,
                    {
                      color:
                        palette.textPrimary,
                      backgroundColor:
                        palette.inputBackground,
                      borderColor:
                        duplicateSource
                          ? '#DC3545'
                          : palette.borderStrong,
                      textAlign: isRtl
                        ? 'right'
                        : 'left',
                    },
                  ]}
                />

                {duplicateSource ? (
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color: '#DC3545',
                    }}
                  >
                    {t(
                      'moneyInDuplicateSource',
                    )}
                  </JzText>
                ) : null}
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
                  {t('moneyInAmount')}
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
                    returnKeyType="done"
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
                        color:
                          palette.textPrimary,
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

              {!recurringSalary ? (
                <YStack gap={spacing[2]}>
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t('moneyInAvailability')}
                  </JzText>

                  <XStack
                    flexDirection={direction}
                    gap={spacing[2]}
                  >
                    {(
                      [
                        'available-now',
                        'expected',
                      ] as const
                    ).map((availability) => {
                      const selected =
                        draft.availability ===
                        availability;

                      return (
                        <Pressable
                          key={availability}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected,
                          }}
                          onPress={() =>
                            selectAvailability(
                              availability,
                            )
                          }
                          style={[
                            styles.optionChip,
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
                            textDirection={
                              textDirection
                            }
                            textAlign="center"
                            style={{
                              color: selected
                                ? colors.mint600
                                : palette.textPrimary,
                              fontWeight: '700',
                            }}
                          >
                            {availability ===
                            'available-now'
                              ? t(
                                  'moneyInAvailableNowOption',
                                )
                              : t(
                                  'moneyInExpectedOption',
                                )}
                          </JzText>
                        </Pressable>
                      );
                    })}
                  </XStack>
                </YStack>


              ) : null}

              {isSalary ? (
                <YStack gap={spacing[2]}>
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t('moneyInMonthlySalary')}
                  </JzText>

                  <XStack
                    flexDirection={direction}
                    gap={spacing[2]}
                  >
                    {(
                      [
                        true,
                        false,
                      ] as const
                    ).map((value) => {
                      const selected =
                        draft.repeatsMonthly ===
                        value;

                      return (
                        <Pressable
                          key={String(value)}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected,
                          }}
                          onPress={() =>
                            selectMonthlySalary(
                              value,
                            )
                          }
                          style={[
                            styles.optionChip,
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
                            textDirection={
                              textDirection
                            }
                            textAlign="center"
                            style={{
                              color: selected
                                ? colors.mint600
                                : palette.textPrimary,
                              fontWeight: '700',
                            }}
                          >
                            {value
                              ? t('yes')
                              : t('no')}
                          </JzText>
                        </Pressable>
                      );
                    })}
                  </XStack>

                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color: palette.textMuted,
                    }}
                  >
                    {t(
                      'moneyInMonthlySalaryHelper',
                    )}
                  </JzText>
                </YStack>
              ) : null}

              {recurringSalary ? (
                <YStack gap={spacing[2]}>
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t('moneyInNextSalaryDate')}
                  </JzText>

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      'chooseMoneyInNextSalaryDate',
                    )}
                    onPress={() => {
                      setCalendarTarget(
                        'next-salary',
                      );
                      void Haptics.selectionAsync();
                    }}
                    style={[
                      styles.dateButton,
                      {
                        flexDirection: direction,
                        backgroundColor:
                          palette.inputBackground,
                        borderColor:
                          palette.borderStrong,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.dateIcon,
                        {
                          backgroundColor:
                            palette.successSurface,
                        },
                      ]}
                    >
                      <JzIcon
                        name="calendar"
                        size={20}
                        color={colors.mint600}
                        strokeWidth={2.1}
                      />
                    </View>

                    <JzText
                      flex={1}
                      variant="body"
                      textDirection={
                        draft.nextSalaryDate
                          ? 'ltr'
                          : textDirection
                      }
                      style={{
                        color:
                          draft.nextSalaryDate
                            ? palette.textPrimary
                            : palette.textMuted,
                      }}
                    >
                      {draft.nextSalaryDate ??
                        t(
                          'chooseMoneyInNextSalaryDate',
                        )}
                    </JzText>

                    <JzIcon
                      name="next"
                      size={18}
                      color={palette.textMuted}
                      strokeWidth={2.1}
                      isRtl={isRtl}
                    />
                  </Pressable>

                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color: palette.textMuted,
                    }}
                  >
                    {t(
                      'moneyInNextSalaryDateHelper',
                    )}
                  </JzText>
                </YStack>
              ) : null}

              {draft.availability ===
              'expected' &&
              !recurringSalary ? (
                <>
                  <YStack gap={spacing[2]}>
                    <JzText
                      variant="caption"
                      textDirection={textDirection}
                      style={{
                        color:
                          palette.textSecondary,
                      }}
                    >
                      {t('moneyInExpectedTiming')}
                    </JzText>

                    <XStack
                      flexDirection={direction}
                      gap={spacing[2]}
                    >
                      {(
                        [
                          'before-travel',
                          'after-travel',
                        ] as const
                      ).map((timing) => {
                        const selected =
                          draft.expectedTiming ===
                          timing;

                        return (
                          <Pressable
                            key={timing}
                            accessibilityRole="button"
                            accessibilityState={{
                              selected,
                            }}
                            onPress={() =>
                              selectExpectedTiming(
                                timing,
                              )
                            }
                            style={[
                              styles.optionChip,
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
                              textDirection={
                                textDirection
                              }
                              textAlign="center"
                              style={{
                                color: selected
                                  ? colors.mint600
                                  : palette.textPrimary,
                                fontWeight:
                                  '700',
                              }}
                            >
                              {timing ===
                              'before-travel'
                                ? t(
                                    'moneyInBeforeTravelOption',
                                  )
                                : t(
                                    'moneyInAfterTravelOption',
                                  )}
                            </JzText>
                          </Pressable>
                        );
                      })}
                    </XStack>
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
                      {t('moneyInExpectedDate')}
                    </JzText>

                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t(
                        'chooseMoneyInExpectedDate',
                      )}
                      onPress={() => {
                        setCalendarTarget(
                          'expected-date',
                        );
                        void Haptics.selectionAsync();
                      }}
                      style={[
                        styles.dateButton,
                        {
                          flexDirection: direction,
                          backgroundColor:
                            palette.inputBackground,
                          borderColor:
                            palette.borderStrong,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.dateIcon,
                          {
                            backgroundColor:
                              palette.infoSurface,
                          },
                        ]}
                      >
                        <JzIcon
                          name="calendar"
                          size={20}
                          color={colors.sky500}
                          strokeWidth={2.1}
                        />
                      </View>

                      <JzText
                        flex={1}
                        variant="body"
                        textDirection={
                          draft.expectedDate
                            ? 'ltr'
                            : textDirection
                        }
                        style={{
                          color:
                            draft.expectedDate
                              ? palette.textPrimary
                              : palette.textMuted,
                        }}
                      >
                        {draft.expectedDate ??
                          t(
                            'chooseMoneyInExpectedDate',
                          )}
                      </JzText>

                      <JzIcon
                        name="next"
                        size={18}
                        color={palette.textMuted}
                        strokeWidth={2.1}
                        isRtl={isRtl}
                      />
                    </Pressable>
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
                      {t('moneyInCertainty')}
                    </JzText>

                    <XStack
                      flexDirection={direction}
                      gap={spacing[2]}
                    >
                      {(
                        [
                          'guaranteed',
                          'non-guaranteed',
                        ] as const
                      ).map((certainty) => {
                        const selected =
                          draft.certainty ===
                          certainty;

                        return (
                          <Pressable
                            key={certainty}
                            accessibilityRole="button"
                            accessibilityState={{
                              selected,
                            }}
                            onPress={() => {
                              setDraft(
                                (current) => ({
                                  ...current,
                                  certainty,
                                }),
                              );
                              void Haptics
                                .selectionAsync();
                            }}
                            style={[
                              styles.optionChip,
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
                              textDirection={
                                textDirection
                              }
                              textAlign="center"
                              style={{
                                color: selected
                                  ? colors.mint600
                                  : palette.textPrimary,
                                fontWeight:
                                  '700',
                              }}
                            >
                              {certainty ===
                              'guaranteed'
                                ? t(
                                    'moneyInGuaranteed',
                                  )
                                : t(
                                    'moneyInNonGuaranteed',
                                  )}
                            </JzText>
                          </Pressable>
                        );
                      })}
                    </XStack>
                  </YStack>
                </>
              ) : null}

              <YStack gap={spacing[2]}>
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t('moneyInIncludeReadiness')}
                </JzText>

                <XStack
                  flexDirection={direction}
                  gap={spacing[2]}
                >
                  {(
                    [
                      true,
                      false,
                    ] as const
                  ).map((value) => {
                    const afterTravel =
                      !recurringSalary &&
                      draft.availability ===
                        'expected' &&
                      effectiveExpectedTiming ===
                        'after-travel';
                    const disabled =
                      afterTravel && value;
                    const selected =
                      draft.includeInReadiness ===
                      value;

                    return (
                      <Pressable
                        key={String(value)}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected,
                          disabled,
                        }}
                        disabled={disabled}
                        onPress={() => {
                          setDraft(
                            (current) => ({
                              ...current,
                              includeInReadiness:
                                value,
                            }),
                          );
                          void Haptics
                            .selectionAsync();
                        }}
                        style={[
                          styles.optionChip,
                          {
                            opacity: disabled
                              ? 0.38
                              : 1,
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
                          textDirection={
                            textDirection
                          }
                          textAlign="center"
                          style={{
                            color: selected
                              ? colors.mint600
                              : palette.textPrimary,
                            fontWeight: '700',
                          }}
                        >
                          {value
                            ? t('yes')
                            : t('no')}
                        </JzText>
                      </Pressable>
                    );
                  })}
                </XStack>

                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color: palette.textMuted,
                  }}
                >
                  {recurringSalary
                    ? t(
                        'moneyInMonthlyReadinessHelper',
                      )
                    : draft.availability ===
                        'expected' &&
                      effectiveExpectedTiming ===
                        'after-travel'
                      ? t(
                          'moneyInAfterTravelReadinessHelper',
                        )
                      : t(
                          'moneyInIncludeReadinessHelper',
                        )}
                </JzText>
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
                  {t('moneyInNotes')}
                </JzText>

                <TextInput
                  value={draft.notes}
                  maxLength={500}
                  multiline
                  placeholder={t(
                    'moneyInNotesPlaceholder',
                  )}
                  placeholderTextColor={
                    palette.textMuted
                  }
                  onChangeText={(notes) =>
                    setDraft((current) => ({
                      ...current,
                      notes,
                    }))
                  }
                  style={[
                    styles.notesInput,
                    {
                      color:
                        palette.textPrimary,
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

              <View
                style={[
                  styles.editorInfo,
                  {
                    flexDirection: direction,
                    backgroundColor:
                      palette.infoSurface,
                    borderColor:
                      palette.border,
                  },
                ]}
              >
                <JzIcon
                  name="info"
                  size={18}
                  color={colors.sky500}
                  strokeWidth={2.1}
                />

                <JzText
                  flex={1}
                  variant="bodySmall"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t('moneyInEditorTruthHelper')}
                </JzText>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityState={{
                  disabled: !canSave,
                }}
                disabled={!canSave}
                onPress={save}
                style={({ pressed }) => [
                  styles.modalPrimary,
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
                  {item
                    ? t(
                        'saveMoneySourceChanges',
                      )
                    : t('addMoneySource')}
                </JzText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={closeEditor}
                style={[
                  styles.modalSecondary,
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
                    color:
                      palette.textPrimary,
                    textAlign: 'center',
                  }}
                >
                  {t('cancel')}
                </JzText>
              </Pressable>
            </ScrollView>
          </View>

      <JzCalendarModal
        presentation="overlay"
        visible={calendarTarget !== null}
        title={
          calendarTarget ===
          'next-salary'
            ? t('moneyInNextSalaryDate')
            : t('moneyInExpectedDate')
        }
        locale={locale}
        isRtl={isRtl}
        selectedDate={
          calendarTarget ===
          'next-salary'
            ? draft.nextSalaryDate
            : draft.expectedDate
        }
        minimumDate={todayIso()}
        todayLabel={t('todayDate')}
        closeLabel={t('close')}
        previousMonthLabel={t(
          'previousMonth',
        )}
        nextMonthLabel={t('nextMonth')}
        onClose={() =>
          setCalendarTarget(null)
        }
        onSelect={(selectedDate) => {
          setDraft((current) => {
            if (
              calendarTarget ===
              'next-salary'
            ) {
              const recurringTiming =
                current.availability ===
                  'expected' &&
                tripReadinessCutoffDate &&
                selectedDate >
                  tripReadinessCutoffDate
                  ? 'after-travel'
                  : 'before-travel';

              return {
                ...current,
                nextSalaryDate:
                  selectedDate,
                expectedTiming:
                  current.availability ===
                  'expected'
                    ? recurringTiming
                    : null,
                includeInReadiness:
                  current.includeInReadiness,
              };
            }

            return {
              ...current,
              expectedDate:
                selectedDate,
            };
          });
          setCalendarTarget(null);
        }}
      />
        </KeyboardAvoidingView>
      </Modal>

    </>
  );
}

type MoneyInRowProps = {
  item: TripMoneyInItem;
  isRtl: boolean;
  locale: 'ar' | 'en';
  currency: string;
  onEdit: () => void;
  onToggleIncluded: () => void;
  onDelete: () => void;
};

function MoneyInRow({
  item,
  isRtl,
  locale,
  currency,
  onEdit,
  onToggleIncluded,
  onDelete,
}: MoneyInRowProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const [menuOpen, setMenuOpen] =
    useState(false);

  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';
  const category = categoryFor(
    item.categoryId,
  );

  const recurringSalary =
    item.categoryId ===
      'money-in-salary' &&
    item.recurrence?.cadence ===
      'monthly';
  const displayAvailability =
    recurringSalary
      ? 'expected'
      : item.availability;
  const timingLabel = recurringSalary
    ? t('moneyInExpectedOption')
    : displayAvailability ===
        'available-now'
      ? t('moneyInAvailableNowOption')
      : item.expectedTiming ===
          'before-travel'
        ? t('moneyInBeforeTravelOption')
        : t('moneyInAfterTravelOption');

  return (
    <>
      <JzGlassPanel
      tone="surface"
      style={[
        styles.moneyRow,
        {
          borderColor:
            palette.borderStrong,
        },
      ]}
    >
      <XStack
        flexDirection={direction}
        alignItems="center"
        gap={spacing[3]}
      >
        <View
          style={[
            styles.rowIcon,
            {
              backgroundColor:
                item.includeInReadiness
                  ? palette.successSurface
                  : palette.surfaceMuted,
            },
          ]}
        >
          <JzIcon
            name={category.icon}
            size={22}
            color={
              item.includeInReadiness
                ? colors.mint600
                : palette.textSecondary
            }
            strokeWidth={2.1}
          />
        </View>

        <YStack
          flex={1}
          minWidth={0}
          gap={4}
        >
          <JzText
            variant="title"
            textDirection={textDirection}
            numberOfLines={1}
            style={{
              color: palette.textPrimary,
            }}
          >
            {item.title}
          </JzText>

          <JzText
            variant="moneyMedium"
            textDirection="ltr"
            style={{
              color: palette.textPrimary,
            }}
          >
            {formatMoney(
              item.amount,
              locale,
              currency,
            )}
          </JzText>

          <XStack
            flexDirection={direction}
            alignItems="center"
            gap={spacing[2]}
            flexWrap="wrap"
          >
            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    displayAvailability ===
                    'available-now'
                      ? palette.successSurface
                      : palette.infoSurface,
                },
              ]}
            >
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    displayAvailability ===
                    'available-now'
                      ? colors.mint600
                      : colors.sky500,
                }}
              >
                {timingLabel}
              </JzText>
            </View>

            {item.recurrence ? (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      palette.successSurface,
                  },
                ]}
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color: colors.mint600,
                  }}
                >
                  {t('moneyInMonthly')}
                </JzText>
              </View>
            ) : null}

            {displayAvailability ===
            'expected' ? (
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor:
                      item.certainty ===
                      'guaranteed'
                        ? palette.successSurface
                        : palette.warningSurface,
                  },
                ]}
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      item.certainty ===
                      'guaranteed'
                        ? colors.mint600
                        : '#B26A00',
                  }}
                >
                  {item.certainty ===
                  'guaranteed'
                    ? t(
                        'moneyInGuaranteed',
                      )
                    : t(
                        'moneyInNonGuaranteed',
                      )}
                </JzText>
              </View>
            ) : null}

            <View
              style={[
                styles.statusPill,
                {
                  backgroundColor:
                    item.includeInReadiness
                      ? palette.successSurface
                      : palette.surfaceMuted,
                },
              ]}
            >
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    item.includeInReadiness
                      ? colors.mint600
                      : palette.textSecondary,
                }}
              >
                {item.includeInReadiness
                  ? t('moneyInIncluded')
                  : t('moneyInExcluded')}
              </JzText>
            </View>
          </XStack>

          {item.recurrence ? (
            <JzText
              variant="caption"
              textDirection="ltr"
              style={{
                color: palette.textMuted,
              }}
            >
              {t(
                'moneyInNextSalaryDateValue',
                {
                  date:
                    item.recurrence.nextDate,
                },
              )}
            </JzText>
          ) : item.expectedDate ? (
            <JzText
              variant="caption"
              textDirection="ltr"
              style={{
                color: palette.textMuted,
              }}
            >
              {t(
                'moneyInExpectedDateValue',
                {
                  date: item.expectedDate,
                },
              )}
            </JzText>
          ) : null}
        </YStack>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('moreActions')}
          onPress={() => {
            setMenuOpen(true);
            void Haptics.selectionAsync();
          }}
          style={[
            styles.rowAction,
            {
              backgroundColor:
                palette.surfaceMuted,
              borderColor:
                palette.border,
            },
          ]}
        >
          <JzIcon
            name="more"
            size={18}
            color={palette.textPrimary}
            strokeWidth={2.2}
          />
        </Pressable>
      </XStack>
      </JzGlassPanel>

      <JzActionMenuSheet
        visible={menuOpen}
        title={item.title}
        helper={t('moneySourceActionHelper')}
        isRtl={isRtl}
        onClose={() => setMenuOpen(false)}
        actions={[
          {
            key: 'edit-source',
            label: t('editMoneySource'),
            icon: 'edit' as const,
            onPress: onEdit,
          },
          {
            key: 'toggle-readiness',
            label: item.includeInReadiness
              ? t('excludeMoneySource')
              : t('includeMoneySource'),
            icon: item.includeInReadiness
              ? ('warning' as const)
              : ('check' as const),
            onPress: onToggleIncluded,
          },
          {
            key: 'remove-source',
            label: t('removeMoneySource'),
            icon: 'delete' as const,
            tone: 'danger' as const,
            onPress: onDelete,
          },
        ]}
      />
    </>
  );
}

export function FundsScreen() {
  const router = useRouter();
  const {
    isRtl,
    locale,
    t,
  } = useJahizLocale();
  const { palette } = useJahizTheme();

  const workspace = useTripWorkspaceStore(
    (state) => state.workspace,
  );
  const addMoneyInItem =
    useTripWorkspaceStore(
      (state) => state.addMoneyInItem,
    );
  const updateMoneyInItem =
    useTripWorkspaceStore(
      (state) => state.updateMoneyInItem,
    );
  const removeMoneyInItem =
    useTripWorkspaceStore(
      (state) => state.removeMoneyInItem,
    );
  const markMoneyInReviewed =
    useTripWorkspaceStore(
      (state) => state.markMoneyInReviewed,
    );
  const setSafetyReserve =
    useTripWorkspaceStore(
      (state) => state.setSafetyReserve,
    );

  const [editorVisible, setEditorVisible] =
    useState(false);
  const [
    editingMoneyIn,
    setEditingMoneyIn,
  ] = useState<TripMoneyInItem | null>(
    null,
  );
  const [
    safetyReserveInput,
    setSafetyReserveInput,
  ] = useState('');

  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  useEffect(() => {
    setSafetyReserveInput(
      workspace.funds.safetyReserve > 0
        ? String(
            workspace.funds.safetyReserve,
          )
        : '',
    );
  }, [workspace.funds.safetyReserve]);

  const safetyReserve =
    parseNonNegativeAmount(
      safetyReserveInput,
    );
  const reserveValid =
    safetyReserve !== null;
  const hasMoneySource =
    workspace.moneyInItems.length > 0;
  const canContinue =
    reserveValid && hasMoneySource;

  const availableNowTotal = useMemo(
    () =>
      selectAvailableNowMoneyInTotal(
        workspace,
      ),
    [workspace],
  );

  const expectedByReturnTotal = useMemo(
    () =>
      selectExpectedByReturnMoneyInTotal(
        workspace,
      ),
    [workspace],
  );

  const commitmentsTotal = useMemo(
    () =>
      selectTripWindowCommitmentsTotal(
        workspace,
      ),
    [workspace],
  );

  const persistedReadyMoney = useMemo(
    () => selectReadyMoney(workspace),
    [workspace],
  );

  const readyMoney =
    safetyReserve === null
      ? persistedReadyMoney
      : persistedReadyMoney +
        workspace.funds.safetyReserve -
        safetyReserve;

  const includedForTripTotal =
    useMemo(
      () =>
        selectUsableTripMoneyTotal(
          workspace,
        ),
      [workspace],
    );

  const effectiveReserve =
    safetyReserve ??
    workspace.funds.safetyReserve;

  const sortedMoneyIn = useMemo(
    () =>
      [...workspace.moneyInItems].sort(
        (left, right) => {
          const leftRank =
            left.availability ===
            'available-now'
              ? 0
              : left.expectedTiming ===
                  'before-travel'
                ? 1
                : 2;
          const rightRank =
            right.availability ===
            'available-now'
              ? 0
              : right.expectedTiming ===
                  'before-travel'
                ? 1
                : 2;

          if (leftRank !== rightRank) {
            return leftRank - rightRank;
          }

          return String(
            left.expectedDate ??
              '9999-12-31',
          ).localeCompare(
            String(
              right.expectedDate ??
                '9999-12-31',
            ),
          );
        },
      ),
    [workspace.moneyInItems],
  );

  function closeEditor() {
    setEditorVisible(false);
    setEditingMoneyIn(null);
  }

  function openCreate() {
    setEditingMoneyIn(null);
    setEditorVisible(true);
    void Haptics.selectionAsync();
  }

  function openEdit(
    item: TripMoneyInItem,
  ) {
    setEditingMoneyIn(item);
    setEditorVisible(true);
    void Haptics.selectionAsync();
  }

  function saveMoneySource(
    draft: {
      title: string;
      categoryId:
        TripMoneyInCategoryId;
      amount: number;
      availability:
        TripMoneyInAvailability;
      expectedTiming:
        TripMoneyInExpectedTiming | null;
      expectedDate: string | null;
      certainty: TripMoneyInCertainty;
      recurrence:
        | TripMoneyInMonthlyRecurrence
        | null;
      includeInReadiness: boolean;
      notes: string | null;
    },
  ) {
    if (editingMoneyIn) {
      updateMoneyInItem(
        editingMoneyIn.id,
        draft,
      );
    } else {
      addMoneyInItem(draft);
    }

    closeEditor();

    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType
        .Success,
    );
  }

  function saveSafetyReserve(): boolean {
    if (safetyReserve === null) {
      return false;
    }

    setSafetyReserve(safetyReserve);
    return true;
  }

  function handleContinue() {
    if (
      !hasMoneySource ||
      !saveSafetyReserve()
    ) {
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      return;
    }

    markMoneyInReviewed(true);

    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType.Success,
    );

    router.replace(
      '/trip/create/commitments' as Href,
    );
  }

  function handleSaveAndExit() {
    if (saveSafetyReserve()) {
      markMoneyInReviewed(true);
      void Haptics.selectionAsync();
    }

    router.replace('/plan');
  }

  return (
    <>
      <Screen
        topColor={palette.background}
        contentColor={palette.background}
        fixedHeader={
          <JzFlowAppBar
            title={t('createTrip')}
            eyebrow={t('fundsStep')}
            isRtl={isRtl}
            backLabel={t('back')}
            onBackPress={() =>
              router.back()
            }
          />
        }
        fixedFooter={
          <JzFlowFooter
            primaryLabel={t('continue')}
            secondaryLabel={t(
              'saveAndExit',
            )}
            primaryDisabled={!canContinue}
            isRtl={isRtl}
            onPrimaryPress={handleContinue}
            onSecondaryPress={
              handleSaveAndExit
            }
          />
        }
      >
        <JzShellSurface
          isRtl={isRtl}
          style={styles.hero}
        >
          <JzText
            variant="heading1"
            textDirection={textDirection}
            style={{
              color: palette.heroText,
            }}
          >
            {t('moneyReadyQuestion')}
          </JzText>

          <JzText
            textDirection={textDirection}
            style={{
              color:
                palette.heroSecondary,
            }}
          >
            {t('moneyInScreenHelper')}
          </JzText>
        </JzShellSurface>

        <YStack
          marginTop={-24}
          paddingHorizontal={spacing[4]}
          paddingBottom={spacing[6]}
          gap={spacing[4]}
        >
          <JzGlassPanel
            tone="mint"
            style={styles.summaryCard}
          >
            <XStack
              flexDirection={direction}
              alignItems="center"
              gap={spacing[3]}
            >
              <View
                style={[
                  styles.summaryIcon,
                  {
                    backgroundColor:
                      palette.successSurface,
                  },
                ]}
              >
                <JzIcon
                  name="sparkles"
                  size={25}
                  color={colors.mint600}
                  strokeWidth={2.1}
                />
              </View>

              <YStack
                flex={1}
                minWidth={0}
                alignItems={align}
                gap={3}
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color: colors.mint600,
                  }}
                >
                  {t('moneyInReadySummary')}
                </JzText>

                <JzText
                  variant="moneyMedium"
                  textDirection="ltr"
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {formatMoney(
                    readyMoney,
                    locale,
                    workspace.currency,
                  )}
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
                    'moneyInReadySummaryHelper',
                  )}
                </JzText>
              </YStack>
            </XStack>

            <View
              style={[
                styles.summaryDivider,
                {
                  backgroundColor:
                    palette.border,
                },
              ]}
            />

            <XStack
              flexDirection={direction}
              gap={spacing[2]}
            >
              <View
                style={[
                  styles.metricCard,
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
                  textAlign="center"
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t('availableNow')}
                </JzText>

                <JzText
                  variant="title"
                  textDirection="ltr"
                  textAlign="center"
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {formatMoney(
                    availableNowTotal,
                    locale,
                    workspace.currency,
                  )}
                </JzText>
              </View>

              <View
                style={[
                  styles.metricCard,
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
                  textAlign="center"
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t('expectedByReturn')}
                </JzText>

                <JzText
                  variant="title"
                  textDirection="ltr"
                  textAlign="center"
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {formatMoney(
                    expectedByReturnTotal,
                    locale,
                    workspace.currency,
                  )}
                </JzText>
              </View>
            </XStack>

            <View
              style={[
                styles.summaryDivider,
                {
                  backgroundColor:
                    palette.border,
                },
              ]}
            />

            <YStack
              gap={spacing[2]}
              style={[
                styles.readyBreakdown,
                {
                  backgroundColor:
                    palette.surfaceMuted,
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
                {t('readyMoneyCalculation')}
              </JzText>

              <XStack
                flexDirection={direction}
                justifyContent="space-between"
                gap={spacing[3]}
              >
                <JzText
                  flex={1}
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textMuted,
                  }}
                >
                  {t('includedBeforeTravel')}
                </JzText>

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
                    includedForTripTotal,
                    locale,
                    workspace.currency,
                  )}
                </JzText>
              </XStack>

              <XStack
                flexDirection={direction}
                justifyContent="space-between"
                gap={spacing[3]}
              >
                <JzText
                  flex={1}
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textMuted,
                  }}
                >
                  {t('safetyReserve')}
                </JzText>

                <JzText
                  variant="bodySmall"
                  textDirection="ltr"
                  style={{
                    color:
                      palette.textPrimary,
                    fontWeight: '800',
                  }}
                >
                  {effectiveReserve > 0
                    ? `−${formatMoney(
                        effectiveReserve,
                        locale,
                        workspace.currency,
                      )}`
                    : formatMoney(
                        0,
                        locale,
                        workspace.currency,
                      )}
                </JzText>
              </XStack>

              <XStack
                flexDirection={direction}
                justifyContent="space-between"
                gap={spacing[3]}
              >
                <JzText
                  flex={1}
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textMuted,
                  }}
                >
                  {t(
                    'readyMoneyCommitmentsDeduction',
                  )}
                </JzText>

                <JzText
                  variant="bodySmall"
                  textDirection="ltr"
                  style={{
                    color:
                      palette.textPrimary,
                    fontWeight: '800',
                  }}
                >
                  {commitmentsTotal > 0
                    ? `−${formatMoney(
                        commitmentsTotal,
                        locale,
                        workspace.currency,
                      )}`
                    : formatMoney(
                        0,
                        locale,
                        workspace.currency,
                      )}
                </JzText>
              </XStack>
            </YStack>
          </JzGlassPanel>

          <JzGlassPanel
            tone="surface"
            style={styles.reserveCard}
          >
            <XStack
              flexDirection={direction}
              alignItems="center"
              gap={spacing[3]}
            >
              <View
                style={[
                  styles.reserveIcon,
                  {
                    backgroundColor:
                      palette.infoSurface,
                  },
                ]}
              >
                <JzIcon
                  name="check"
                  size={21}
                  color={colors.sky500}
                  strokeWidth={2.1}
                />
              </View>

              <YStack
                flex={1}
                minWidth={0}
                alignItems={align}
                gap={3}
              >
                <JzText
                  variant="title"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {t('safetyReserve')}
                </JzText>

                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t('safetyReserveHelper')}
                </JzText>
              </YStack>
            </XStack>

            <View
              style={[
                styles.reserveInputShell,
                {
                  flexDirection: direction,
                  backgroundColor:
                    palette.inputBackground,
                  borderColor: reserveValid
                    ? palette.borderStrong
                    : colors.danger,
                },
              ]}
            >
              <TextInput
                value={safetyReserveInput}
                maxLength={13}
                keyboardType="decimal-pad"
                returnKeyType="done"
                placeholder="0"
                placeholderTextColor={
                  palette.textMuted
                }
                onChangeText={(value) =>
                  setSafetyReserveInput(
                    sanitizeMoneyInput(
                      value,
                    ),
                  )
                }
                style={[
                  styles.reserveInput,
                  {
                    color:
                      palette.textPrimary,
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
                  {workspace.currency}
                </JzText>
              </View>
            </View>

            {!reserveValid ? (
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: colors.danger,
                }}
              >
                {t('invalidMoney')}
              </JzText>
            ) : null}
          </JzGlassPanel>

          <XStack
            flexDirection={direction}
            alignItems="center"
            justifyContent="space-between"
            gap={spacing[3]}
          >
            <YStack
              flex={1}
              alignItems={align}
              gap={3}
            >
              <JzText
                variant="heading2"
                textDirection={textDirection}
                style={{
                  color: palette.textPrimary,
                }}
              >
                {t('moneyInSources')}
              </JzText>

              <JzText
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('moneyInSourcesHelper')}
              </JzText>
            </YStack>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t(
                'addMoneySource',
              )}
              onPress={openCreate}
              style={({ pressed }) => [
                styles.addButton,
                {
                  opacity: pressed
                    ? 0.82
                    : 1,
                  backgroundColor:
                    colors.mint500,
                },
              ]}
            >
              <JzIcon
                name="add"
                size={19}
                color={colors.navy950}
                strokeWidth={2.2}
              />

              <JzText
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color: colors.navy950,
                  fontWeight: '800',
                }}
              >
                {t('add')}
              </JzText>
            </Pressable>
          </XStack>

          {sortedMoneyIn.length > 0 ? (
            <YStack gap={spacing[3]}>
              {sortedMoneyIn.map(
                (item) => (
                  <MoneyInRow
                    key={item.id}
                    item={item}
                    isRtl={isRtl}
                    locale={locale}
                    currency={
                      workspace.currency
                    }
                    onEdit={() =>
                      openEdit(item)
                    }
                    onToggleIncluded={() => {
                      updateMoneyInItem(
                        item.id,
                        {
                          includeInReadiness:
                            !item.includeInReadiness,
                        },
                      );
                      void Haptics.selectionAsync();
                    }}
                    onDelete={() => {
                      removeMoneyInItem(
                        item.id,
                      );

                      void Haptics
                        .notificationAsync(
                          Haptics
                            .NotificationFeedbackType
                            .Warning,
                        );
                    }}
                  />
                ),
              )}
            </YStack>
          ) : (
            <JzGlassPanel
              tone="surface"
              style={styles.emptyCard}
            >
              <View
                style={[
                  styles.emptyIcon,
                  {
                    backgroundColor:
                      palette.successSurface,
                  },
                ]}
              >
                <JzIcon
                  name="money"
                  size={30}
                  color={colors.mint600}
                  strokeWidth={2.1}
                />
              </View>

              <YStack
                alignItems="center"
                gap={spacing[2]}
              >
                <JzText
                  variant="title"
                  textDirection={textDirection}
                  textAlign="center"
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {t(
                    'moneyInNoSourcesTitle',
                  )}
                </JzText>

                <JzText
                  variant="bodySmall"
                  textDirection={textDirection}
                  textAlign="center"
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t(
                    'moneyInNoSourcesHelper',
                  )}
                </JzText>

                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  textAlign="center"
                  style={{
                    color: '#F5B94C',
                    fontWeight: '800',
                  }}
                >
                  {t('moneySourceRequired')}
                </JzText>
              </YStack>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  'addMoneySource',
                )}
                onPress={openCreate}
                style={[
                  styles.emptyAction,
                  {
                    backgroundColor:
                      palette.surfaceMuted,
                    borderColor:
                      palette.borderStrong,
                  },
                ]}
              >
                <JzText
                  variant="title"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {t('addMoneySource')}
                </JzText>
              </Pressable>
            </JzGlassPanel>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(
              'manageCommitments',
            )}
            accessibilityState={{
              disabled: !hasMoneySource,
            }}
            onPress={() => {
              if (!hasMoneySource) {
                void Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Error,
                );
                return;
              }

              router.push(
                '/trip/create/commitments' as Href,
              );
            }}
            style={({ pressed }) => ({
              opacity: !hasMoneySource
                ? 0.46
                : pressed
                  ? 0.82
                  : 1,
            })}
          >
            <JzGlassPanel
              tone="sky"
              style={styles.commitmentsLink}
            >
              <XStack
                flexDirection={direction}
                alignItems="center"
                gap={spacing[3]}
              >
                <View
                  style={[
                    styles.summaryIcon,
                    {
                      backgroundColor:
                        palette.infoSurface,
                    },
                  ]}
                >
                  <JzIcon
                    name="receipt"
                    size={23}
                    color={colors.sky500}
                    strokeWidth={2.1}
                  />
                </View>

                <YStack
                  flex={1}
                  minWidth={0}
                  alignItems={align}
                  gap={3}
                >
                  <JzText
                    variant="title"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textPrimary,
                    }}
                  >
                    {t('manageCommitments')}
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
                      'commitmentsFundsSummary',
                      {
                        count:
                          selectCommitmentDisplayCount(
                            workspace,
                          ),
                        amount: formatMoney(
                          commitmentsTotal,
                          locale,
                          workspace.currency,
                        ),
                      },
                    )}
                  </JzText>
                </YStack>

                <JzIcon
                  name="next"
                  size={20}
                  color={palette.textMuted}
                  strokeWidth={2.1}
                  isRtl={isRtl}
                />
              </XStack>
            </JzGlassPanel>
          </Pressable>

          <JzGlassPanel
            tone="sky"
            style={styles.infoCard}
          >
            <XStack
              flexDirection={direction}
              alignItems="center"
              gap={spacing[3]}
            >
              <JzIcon
                name="info"
                size={20}
                color={colors.sky500}
                strokeWidth={2.1}
              />

              <JzText
                flex={1}
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textSecondary,
                }}
              >
                {t('moneyInTruthHelper')}
              </JzText>
            </XStack>
          </JzGlassPanel>
        </YStack>
      </Screen>

      <MoneyInEditorModal
        key={`${editorVisible}-${editingMoneyIn?.id ?? 'new'}`}
        visible={editorVisible}
        item={editingMoneyIn}
        currency={workspace.currency}
        departureDate={
          workspace.dates.departureDate
        }
        returnDate={workspace.dates.returnDate}
        existingItems={
          workspace.moneyInItems
        }
        isRtl={isRtl}
        locale={locale}
        onClose={closeEditor}
        onSave={saveMoneySource}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    paddingBottom: 44,
    gap: spacing[2],
  },
  summaryCard: {
    padding: spacing[4],
    gap: spacing[3],
    borderRadius: radius.xl,
  },
  summaryIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
  },
  metricCard: {
    flex: 1,
    minHeight: 74,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    padding: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  readyBreakdown: {
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  reserveCard: {
    padding: spacing[4],
    gap: spacing[3],
    borderRadius: radius.xl,
  },
  reserveIcon: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  reserveInputShell: {
    minHeight: 56,
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  reserveInput: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 0,
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  addButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
  },
  moneyRow: {
    padding: spacing[4],
    borderRadius: radius.xl,
  },
  rowIcon: {
    width: 54,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  statusPill: {
    minHeight: 28,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
  },
  rowAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
  },
  emptyCard: {
    padding: spacing[6],
    gap: spacing[4],
    alignItems: 'center',
    borderRadius: radius.xl,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  emptyAction: {
    minHeight: 48,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  commitmentsLink: {
    padding: spacing[4],
    borderRadius: radius.xl,
  },
  infoCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(2,8,18,0.64)',
  },
  modalSheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderWidth: 1,
    overflow: 'hidden',
  },
  modalHandle: {
    width: 48,
    height: 5,
    alignSelf: 'center',
    marginTop: spacing[2],
    borderRadius: radius.full,
  },
  modalContent: {
    gap: spacing[4],
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[6],
  },
  roundButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
  },
  categoryGrid: {
    flexWrap: 'wrap',
    gap: spacing[2],
  },
  categoryChoice: {
    width: '48%',
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    padding: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  textInput: {
    minHeight: 54,
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    fontSize: 16,
  },
  amountShell: {
    minHeight: 58,
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  amountInput: {
    flex: 1,
    minHeight: 56,
    paddingVertical: 0,
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'left',
    writingDirection: 'ltr',
  },
  currencyChip: {
    minWidth: 62,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  optionChip: {
    flex: 1,
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  dateButton: {
    minHeight: 58,
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  dateIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  notesInput: {
    minHeight: 92,
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    fontSize: 15,
    textAlignVertical: 'top',
  },
  editorInfo: {
    alignItems: 'center',
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  modalPrimary: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
  },
  modalSecondary: {
    minHeight: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
  },
});
