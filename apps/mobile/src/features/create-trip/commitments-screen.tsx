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
  useLocalSearchParams,
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
import type {
  TripCommitmentCategoryId,
  TripCommitmentItem,
  TripCommitmentStatus,
  TripRecurringCommitment,
} from '@jahiz/api-contracts';
import { JzInlineDatePicker } from '@/components/jz-inline-date-picker';
import { JzFlowAppBar } from '@/components/jz-flow-app-bar';
import { JzFlowFooter } from '@/components/jz-flow-footer';
import { JzActionMenuSheet } from '@/components/jz-action-menu-sheet';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { JzFocusHighlight } from '@/components/jz-focus-highlight';
import { JzIcon } from '@/components/jz-icon';
import { JzShellSurface } from '@/components/jz-shell-surface';
import { Screen } from '@/components/screen';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import {
  isCommitmentDueBeforeTravel,
  isCommitmentDueDuringTrip,
  selectTripWindowCommitmentsTotal,
  selectCommitmentDisplayCount,
  selectCommitmentInstallmentPlans,
  selectNextTripWindowCommitmentGroup,
  selectPaidPendingCountedCommitmentsTotal,
  selectTripWindowUnpaidCommitmentsTotal,
  useTripWorkspaceStore,
} from '@/features/trip-workspace';
import { formatMoney } from '@/utils/format-money';
import {
  isCommitmentInstallmentStatusTransitionAllowed,
} from '@/features/trip-workspace/commitment-installment-sequence';
import {
  tripCommitmentCategories,
  type TripCommitmentCategoryMeta,
} from './trip-commitment-categories';
import { CommitmentInstallmentModal } from './commitment-installment-modal';
import { CommitmentInstallmentPlanCard } from './commitment-installment-plan-card';
import { CommitmentRecurringImpactModal } from './commitment-recurring-impact-modal';
import { CommitmentRecurringModal } from './commitment-recurring-modal';
import { CommitmentRecurringPlanCard } from './commitment-recurring-plan-card';

type CommitmentDraft = {
  title: string;
  categoryId: TripCommitmentCategoryId | null;
  amount: string;
  dueDate: string | null;
  status: TripCommitmentStatus;
  paidAmountReflectedInMoney:
    boolean | null;
};

type CommitmentEditorModalProps = {
  visible: boolean;
  item: TripCommitmentItem | null;
  currency: string;
  departureDate: string | null;
  isRtl: boolean;
  locale: 'ar' | 'en';
  onClose: () => void;
  onSave: (draft: {
    title: string;
    categoryId: TripCommitmentCategoryId;
    amount: number;
    dueDate: string | null;
    dueBeforeTravel: boolean;
    status: TripCommitmentStatus;
    paidAmountReflectedInMoney: boolean;
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

function createEmptyDraft(): CommitmentDraft {
  return {
    title: '',
    categoryId: null,
    amount: '',
    dueDate: null,
    status: 'unpaid',
    paidAmountReflectedInMoney: null,
  };
}

function categoryFor(
  categoryId: TripCommitmentCategoryId,
): TripCommitmentCategoryMeta {
  const category = tripCommitmentCategories.find(
    (item) => item.id === categoryId,
  );

  if (!category) {
    throw new Error(
      `Unknown commitment category: ${categoryId}`,
    );
  }

  return category;
}

function CommitmentEditorModal({
  visible,
  item,
  currency,
  departureDate,
  isRtl,
  locale,
  onClose,
  onSave,
}: CommitmentEditorModalProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const [draft, setDraft] =
    useState<CommitmentDraft>(
      createEmptyDraft,
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
  const effectiveStatus:
    TripCommitmentStatus =
      item
        ? draft.status
        : 'unpaid';

  const requiresDueDate =
    effectiveStatus ===
      'unpaid';
  const canSave = Boolean(
    draft.title.trim() &&
      draft.categoryId &&
      amount &&
      (!requiresDueDate || draft.dueDate),
  );

  useEffect(() => {
    if (!visible) {
      return;
    }


    if (item) {
      setDraft({
        title: item.title,
        categoryId: item.categoryId,
        amount: String(item.amount),
        dueDate: item.dueDate,
        status: item.status,
        paidAmountReflectedInMoney:
          item.status === 'paid'
            ? item.paidAmountReflectedInMoney ===
              undefined
              ? null
              : item
                  .paidAmountReflectedInMoney
            : null,
      });
      return;
    }

    setDraft(createEmptyDraft());
  }, [item, visible]);

  function closeEditor() {
    onClose();
  }

  function selectCategory(
    category: TripCommitmentCategoryMeta,
  ) {
    setDraft((current) => ({
      ...current,
      categoryId: category.id,
      title: t(category.defaultTitleKey),
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

    onSave({
      title: draft.title.trim(),
      categoryId: draft.categoryId,
      amount,
      dueDate: draft.dueDate,
      dueBeforeTravel:
        Boolean(
          draft.dueDate &&
          departureDate &&
          draft.dueDate <=
            departureDate,
        ),
      status: effectiveStatus,
      paidAmountReflectedInMoney:
        effectiveStatus === 'paid'
          ? draft.paidAmountReflectedInMoney ===
            true
          : false,
    });
  }

  return (
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
                      ? t('editCommitment')
                      : t('addCommitment')}
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
                      'commitmentEditorHelper',
                    )}
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
                  {t('commitmentCategory')}
                </JzText>

                <View
                  style={[
                    styles.categoryGrid,
                    {
                      flexDirection: direction,
                    },
                  ]}
                >
                  {tripCommitmentCategories.map(
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
                                  ? 0.8
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
                            {t(
                              category.labelKey,
                            )}
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
                  autoCorrect
                  returnKeyType="next"
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
                    styles.textInput,
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

              <YStack gap={spacing[2]}>
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t('commitmentAmount')}
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
                    onChangeText={(value) => {
                      const nextAmount =
                        sanitizeMoneyInput(
                          value,
                        );
                      const parsedNextAmount =
                        parsePositiveAmount(
                          nextAmount,
                        );
                      const paidAmountChanged =
                        Boolean(
                          item &&
                          parsedNextAmount !==
                            item.amount,
                        );

                      setDraft((current) => ({
                        ...current,
                        amount: nextAmount,
                        paidAmountReflectedInMoney:
                          current.status === 'paid' &&
                          paidAmountChanged
                            ? null
                            : current
                                .paidAmountReflectedInMoney,
                      }));
                    }}
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

              {item ? (
                <YStack gap={spacing[2]}>
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t('commitmentStatus')}
                  </JzText>

                  <XStack
                    flexDirection={direction}
                    gap={spacing[2]}
                  >
                    {(
                      [
                        'unpaid',
                        'paid',
                      ] as const
                    ).map((status) => {
                      const selected =
                        draft.status === status;

                      return (
                        <Pressable
                          key={status}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected,
                          }}
                          onPress={() =>
                            setDraft(
                              (current) => ({
                                ...current,
                                status,
                                paidAmountReflectedInMoney:
                                  status === 'paid'
                                    ? current.status ===
                                      'paid'
                                      ? current
                                          .paidAmountReflectedInMoney
                                      : null
                                    : null,
                              }),
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
                            style={{
                              color: selected
                                ? colors.mint600
                                : palette.textPrimary,
                              fontWeight: '700',
                            }}
                          >
                            {status === 'paid'
                              ? t(
                                  'commitmentPaid',
                                )
                              : t(
                                  'commitmentUnpaid',
                                )}
                          </JzText>
                        </Pressable>
                      );
                    })}
                  </XStack>
                </YStack>


              ) : null}

              <JzInlineDatePicker
                selectedDate={draft.dueDate}
                locale={locale}
                isRtl={isRtl}
                onSelect={(dueDate) =>
                  setDraft((current) => ({
                    ...current,
                    dueDate,
                  }))
                }
                label={t('commitmentDueDate')}
                customLabel={t('paymentCustomDate')}
                chooseLabel={t('chooseCommitmentDueDate')}
                todayLabel={t('todayDate')}
                tomorrowLabel={t('paymentTomorrow')}
                inDaysLabel={(days) =>
                  t('paymentInDays', { days })
                }
                previousMonthLabel={t('previousMonth')}
                nextMonthLabel={t('nextMonth')}
              />

              {requiresDueDate &&
              !draft.dueDate ? (
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color: '#DC3545',
                  }}
                >
                  {t('commitmentDueDateRequired')}
                </JzText>
              ) : null}

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
                  {t(
                    'commitmentDeductionHelper',
                  )}
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
                        'saveCommitmentChanges',
                      )
                    : t('addCommitment')}
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
        </KeyboardAvoidingView>
      </Modal>
  );
}

type CommitmentRowProps = {
  item: TripCommitmentItem;
  isRtl: boolean;
  locale: 'ar' | 'en';
  currency: string;
  dueBeforeTravel: boolean;
  onReviewPaidImpact: () => void;
  onActions: () => void;
};

function CommitmentRow({
  item,
  isRtl,
  locale,
  currency,
  dueBeforeTravel,
  onReviewPaidImpact,
  onActions,
}: CommitmentRowProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';
  const category = categoryFor(
    item.categoryId,
  );
  const paid = item.status === 'paid';

  return (
    <JzGlassPanel
      tone="surface"
      style={[
        styles.commitmentRow,
        {
          borderColor: palette.border,
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
              backgroundColor: paid
                ? palette.successSurface
                : palette.warningSurface,
            },
          ]}
        >
          <JzIcon
            name={category.icon}
            size={19}
            color={
              paid
                ? colors.mint600
                : '#C77800'
            }
            strokeWidth={2.1}
          />
        </View>

        <YStack
          flex={1}
          minWidth={0}
          alignItems={align}
          gap={3}
        >
          <XStack
            width="100%"
            flexDirection={direction}
            alignItems="center"
            justifyContent="space-between"
            gap={spacing[2]}
          >
            <JzText
              flex={1}
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
              variant="title"
              textDirection="ltr"
              numberOfLines={1}
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
          </XStack>

          <XStack
            width="100%"
            flexDirection={direction}
            alignItems="center"
            justifyContent="space-between"
            gap={spacing[2]}
          >
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
                    backgroundColor: paid
                      ? palette.successSurface
                      : palette.warningSurface,
                  },
                ]}
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color: paid
                      ? colors.mint600
                      : '#C77800',
                    fontWeight: '700',
                  }}
                >
                  {paid
                    ? t(
                        item
                          .paidAmountReflectedInMoney ===
                        true
                          ? 'commitmentPaidMoneyUpdatedShort'
                          : 'commitmentPaidStillDeductedShort',
                      )
                    : t('commitmentUnpaid')}
                </JzText>
              </View>

              {dueBeforeTravel &&
              !paid ? (
                <View
                  style={[
                    styles.statusPill,
                    {
                      backgroundColor:
                        palette.infoSurface,
                    },
                  ]}
                >
                  <JzText
                    variant="caption"
                    textDirection={
                      textDirection
                    }
                    style={{
                      color: colors.sky500,
                      fontWeight: '700',
                    }}
                  >
                    {t('dueBeforeTravel')}
                  </JzText>
                </View>
              ) : null}
            </XStack>

            <JzText
              variant="caption"
              textDirection={
                item.dueDate
                  ? 'ltr'
                  : textDirection
              }
              numberOfLines={1}
              style={{
                color: palette.textMuted,
              }}
            >
              {item.dueDate ??
                t(
                  'commitmentDueDateMissing',
                )}
            </JzText>
          </XStack>
        </YStack>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('moreActions')}
          onPress={onActions}
          style={[
            styles.rowAction,
            {
              backgroundColor:
                palette.surfaceMuted,
              borderColor: palette.border,
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
      {paid ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(
            'commitmentPaidImpactAction',
          )}
          onPress={onReviewPaidImpact}
          style={[
            styles.reviewImpactButton,
            {
              backgroundColor:
                palette.infoSurface,
              borderColor:
                'rgba(66,181,255,0.30)',
            },
          ]}
        >
          <JzIcon
            name="info"
            size={16}
            color={colors.sky500}
            strokeWidth={2.1}
          />
          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            style={{
              color: colors.sky500,
              fontWeight: '800',
            }}
          >
            {t(
              'commitmentPaidImpactAction',
            )}
          </JzText>
        </Pressable>
      ) : null}
    </JzGlassPanel>
  );
}

export function CommitmentsScreen() {
  const router = useRouter();
  const {
    isRtl,
    locale,
    t,
  } = useJahizLocale();
  const { palette } = useJahizTheme();
  const params = useLocalSearchParams<{
    focus?: string;
    id?: string;
  }>();
  const workspace = useTripWorkspaceStore(
    (state) => state.workspace,
  );
  const addCommitment =
    useTripWorkspaceStore(
      (state) => state.addCommitment,
    );
  const updateCommitment =
    useTripWorkspaceStore(
      (state) => state.updateCommitment,
    );
  const removeCommitment =
    useTripWorkspaceStore(
      (state) => state.removeCommitment,
    );
  const createCommitmentInstallmentSchedule =
    useTripWorkspaceStore(
      (state) =>
        state.createCommitmentInstallmentSchedule,
    );
  const removeCommitmentInstallmentPlan =
    useTripWorkspaceStore(
      (state) =>
        state.removeCommitmentInstallmentPlan,
    );
  const addRecurringCommitment =
    useTripWorkspaceStore(
      (state) =>
        state.addRecurringCommitment,
    );

  const updateRecurringCommitment =
    useTripWorkspaceStore(
      (state) =>
        state.updateRecurringCommitment,
    );

  const markRecurringCommitmentOccurrencePaid =
    useTripWorkspaceStore(
      (state) =>
        state
          .markRecurringCommitmentOccurrencePaid,
    );

  const setRecurringCommitmentOccurrenceMoneyReflected =
    useTripWorkspaceStore(
      (state) =>
        state
          .setRecurringCommitmentOccurrenceMoneyReflected,
    );

  const markRecurringCommitmentOccurrenceUnpaid =
    useTripWorkspaceStore(
      (state) =>
        state
          .markRecurringCommitmentOccurrenceUnpaid,
    );

  const markCommitmentsReviewed =
    useTripWorkspaceStore(
      (state) =>
        state.markCommitmentsReviewed,
    );

  const [editorVisible, setEditorVisible] =
    useState(false);
  const [addModeVisible, setAddModeVisible] =
    useState(false);
  const [
    installmentEditorVisible,
    setInstallmentEditorVisible,
  ] = useState(false);
  const [
    recurringEditorVisible,
    setRecurringEditorVisible,
  ] = useState(false);

  const [
    editingRecurringCommitment,
    setEditingRecurringCommitment,
  ] =
    useState<TripRecurringCommitment | null>(
      null,
    );

  const [
    recurringPaidImpactTarget,
    setRecurringPaidImpactTarget,
  ] = useState<{
    id: string;
    dueDate: string;
  } | null>(
    null,
  );

  const [
    editingCommitment,
    setEditingCommitment,
  ] = useState<TripCommitmentItem | null>(
    null,
  );
  const [
    actionCommitment,
    setActionCommitment,
  ] = useState<TripCommitmentItem | null>(
    null,
  );
  const [
    paidReflectionTarget,
    setPaidReflectionTarget,
  ] = useState<TripCommitmentItem | null>(
    null,
  );

  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  const unpaidTotal = useMemo(
    () =>
      selectTripWindowUnpaidCommitmentsTotal(
        workspace,
      ),
    [workspace],
  );
  const tripWindowTotal = useMemo(
    () =>
      selectTripWindowCommitmentsTotal(
        workspace,
      ),
    [workspace],
  );
  const paidPendingCountedTotal =
    useMemo(
      () =>
        selectPaidPendingCountedCommitmentsTotal(
          workspace,
        ),
      [workspace],
    );

  const unpaidCountedTotal =
    Math.max(
      0,
      Math.round(
        (
          tripWindowTotal -
          paidPendingCountedTotal
        ) * 100,
      ) / 100,
    );
  const nextCommitmentGroup = useMemo(
    () =>
      selectNextTripWindowCommitmentGroup(
        workspace,
      ),
    [workspace],
  );
  const nextCommitment =
    nextCommitmentGroup?.items[0] ?? null;
  const focusMatchesNextCommitment =
    Boolean(
      nextCommitment &&
      params.focus ===
        'next-commitment' &&
      (
        !params.id ||
        nextCommitment.id === params.id
      ),
    );
  const commitmentDisplayCount = useMemo(
    () =>
      selectCommitmentDisplayCount(
        workspace,
      ),
    [workspace],
  );
  const installmentPlans = useMemo(
    () =>
      selectCommitmentInstallmentPlans(
        workspace,
      ),
    [workspace],
  );
  const recurringCommitments =
    useMemo(
      () =>
        [
          ...workspace
            .recurringCommitments,
        ].sort(
          (left, right) =>
            left.recurrence
              .firstDueDate
              .localeCompare(
                right.recurrence
                  .firstDueDate,
              ),
        ),
      [
        workspace
          .recurringCommitments,
      ],
    );

  const recurringPaidImpactPlan =
    useMemo(
      () =>
        recurringPaidImpactTarget
          ? workspace
              .recurringCommitments
              .find(
                (item) =>
                  item.id ===
                  recurringPaidImpactTarget
                    .id,
              ) ?? null
          : null,
      [
        recurringPaidImpactTarget,
        workspace
          .recurringCommitments,
      ],
    );

  const recurringPaidImpactOccurrence =
    useMemo(
      () =>
        recurringPaidImpactTarget &&
        recurringPaidImpactPlan
          ? recurringPaidImpactPlan
              .paidOccurrences
              .find(
                (occurrence) =>
                  occurrence
                    .dueDate ===
                  recurringPaidImpactTarget
                    .dueDate,
              ) ?? null
          : null,
      [
        recurringPaidImpactPlan,
        recurringPaidImpactTarget,
      ],
    );

  const canCompleteReview = useMemo(
    () =>
      workspace.commitments.every(
        (item) =>
          item.status === 'paid' ||
          Boolean(item.dueDate),
      ),
    [workspace.commitments],
  );

  const sortedCommitments = useMemo(
    () =>
      workspace.commitments
        .filter(
          (item) => !item.installmentPlanId,
        )
        .sort((left, right) => {
          if (
            left.status !== right.status
          ) {
            return left.status === 'unpaid'
              ? -1
              : 1;
          }

          return String(
            left.dueDate ?? '9999-12-31',
          ).localeCompare(
            String(
              right.dueDate ??
                '9999-12-31',
            ),
          );
        },
      ),
    [workspace.commitments],
  );

  const beforeTravelItems = useMemo(
    () =>
      sortedCommitments.filter(
        (item) =>
          item.status === 'unpaid' &&
          isCommitmentDueBeforeTravel(
            workspace,
            item,
          ),
      ),
    [sortedCommitments, workspace],
  );

  const duringTripItems = useMemo(
    () =>
      sortedCommitments.filter(
        (item) =>
          item.status === 'unpaid' &&
          isCommitmentDueDuringTrip(
            workspace,
            item,
          ),
      ),
    [sortedCommitments, workspace],
  );

  const otherItems = useMemo(
    () =>
      sortedCommitments.filter(
        (item) =>
          item.status !== 'unpaid' ||
          (
            !isCommitmentDueBeforeTravel(
              workspace,
              item,
            ) &&
            !isCommitmentDueDuringTrip(
              workspace,
              item,
            )
          ),
      ),
    [sortedCommitments, workspace],
  );

  function closeEditor() {
    setEditorVisible(false);
    setEditingCommitment(null);
  }

  function openAddMode() {
    setAddModeVisible(true);
    void Haptics.selectionAsync();
  }

  function openCreate() {
    setEditingCommitment(null);
    setEditorVisible(true);
    void Haptics.selectionAsync();
  }

  function openInstallments() {
    setInstallmentEditorVisible(true);
    void Haptics.selectionAsync();
  }

  function openMonthly() {
    setEditingRecurringCommitment(
      null,
    );
    setRecurringEditorVisible(
      true,
    );
    void Haptics.selectionAsync();
  }

  function openEditRecurring(
    item:
      TripRecurringCommitment,
  ) {
    setEditingRecurringCommitment(
      item,
    );
    setRecurringEditorVisible(
      true,
    );
    void Haptics.selectionAsync();
  }

  function closeRecurringEditor() {
    setRecurringEditorVisible(
      false,
    );
    setEditingRecurringCommitment(
      null,
    );
  }

  function openEdit(
    item: TripCommitmentItem,
  ) {
    setEditingCommitment(item);
    setEditorVisible(true);
    void Haptics.selectionAsync();
  }

  function markPaidConservatively(
    item: TripCommitmentItem,
  ) {
    updateCommitment(item.id, {
      status: 'paid',
      paidAmountReflectedInMoney: false,
    });
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType
        .Success,
    );
  }

  function reviewPaidImpact(
    item: TripCommitmentItem,
  ) {
    setPaidReflectionTarget(item);
    void Haptics.selectionAsync();
  }

  function applyPaidReflection(
    item: TripCommitmentItem,
    reflectedInMoney: boolean,
  ) {
    updateCommitment(item.id, {
      status: 'paid',
      paidAmountReflectedInMoney:
        reflectedInMoney,
    });
    setPaidReflectionTarget(null);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType
        .Success,
    );
  }

  function saveCommitment(
    draft: {
      title: string;
      categoryId:
        TripCommitmentCategoryId;
      amount: number;
      dueDate: string | null;
      dueBeforeTravel: boolean;
      status: TripCommitmentStatus;
      paidAmountReflectedInMoney: boolean;
    },
  ) {
    if (editingCommitment) {
      updateCommitment(
        editingCommitment.id,
        draft,
      );
    } else {
      addCommitment(draft);
    }

    closeEditor();
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType
        .Success,
    );
  }

  function markMonthlyOccurrencePaid(
    item:
      TripRecurringCommitment,
    dueDate: string,
  ) {
    markRecurringCommitmentOccurrencePaid(
      item.id,
      dueDate,
    );

    void Haptics
      .notificationAsync(
        Haptics
          .NotificationFeedbackType
          .Success,
      );
  }

  function reviewMonthlyOccurrenceImpact(
    item:
      TripRecurringCommitment,
    dueDate: string,
  ) {
    setRecurringPaidImpactTarget({
      id: item.id,
      dueDate,
    });

    void Haptics
      .selectionAsync();
  }

  function closeRecurringPaidImpact() {
    setRecurringPaidImpactTarget(
      null,
    );
  }

  function applyRecurringPaidReflection(
    reflected: boolean,
  ) {
    if (
      !recurringPaidImpactTarget ||
      !recurringPaidImpactOccurrence
    ) {
      return;
    }

    setRecurringCommitmentOccurrenceMoneyReflected(
      recurringPaidImpactTarget.id,
      recurringPaidImpactTarget
        .dueDate,
      reflected,
    );

    closeRecurringPaidImpact();

    void Haptics
      .notificationAsync(
        Haptics
          .NotificationFeedbackType
          .Success,
      );
  }

  function undoRecurringOccurrencePaid() {
    if (
      !recurringPaidImpactTarget ||
      !recurringPaidImpactOccurrence
    ) {
      return;
    }

    markRecurringCommitmentOccurrenceUnpaid(
      recurringPaidImpactTarget.id,
      recurringPaidImpactTarget
        .dueDate,
    );

    closeRecurringPaidImpact();

    void Haptics
      .notificationAsync(
        Haptics
          .NotificationFeedbackType
          .Success,
      );
  }

  function saveRecurringCommitment(
    draft: {
      title: string;
      categoryId:
        TripCommitmentCategoryId;
      amount: number;
      firstDueDate: string;
      endDate: string | null;
    },
  ) {
    if (
      editingRecurringCommitment
    ) {
      updateRecurringCommitment(
        editingRecurringCommitment.id,
        draft,
      );
    } else {
      addRecurringCommitment(
        draft,
      );
    }

    closeRecurringEditor();

    void Haptics
      .notificationAsync(
        Haptics
          .NotificationFeedbackType
          .Success,
      );
  }

  function saveInstallmentPlan(
    draft: {
      title: string;
      categoryId:
        TripCommitmentCategoryId;
      amount: number;
      installmentCount: number;
      cadence: 'monthly' | 'biweekly';
      firstDueDate: string;
    },
  ) {
    createCommitmentInstallmentSchedule(
      draft,
    );
    setInstallmentEditorVisible(false);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType
        .Success,
    );
  }

  function continueToCosts() {
    if (!canCompleteReview) {
      void Haptics.notificationAsync(
        Haptics.NotificationFeedbackType.Error,
      );
      return;
    }

    markCommitmentsReviewed(true);
    void Haptics.notificationAsync(
      Haptics.NotificationFeedbackType
        .Success,
    );
    router.replace(
      '/trip/create/costs' as Href,
    );
  }

  function saveAndExit() {
    markCommitmentsReviewed(
      canCompleteReview,
    );
    void Haptics.selectionAsync();
    router.replace('/plan' as Href);
  }

  function renderCommitmentList(
    items: TripCommitmentItem[],
  ) {
    return (
      <YStack gap={spacing[2]}>
        {items.map((item) => (
          <CommitmentRow
            key={item.id}
            item={item}
            isRtl={isRtl}
            locale={locale}
            currency={workspace.currency}
            dueBeforeTravel={
              isCommitmentDueBeforeTravel(
                workspace,
                item,
              )
            }
            onReviewPaidImpact={() =>
              reviewPaidImpact(item)
            }
            onActions={() => {
              setActionCommitment(item);
              void Haptics.selectionAsync();
            }}
          />
        ))}
      </YStack>
    );
  }

  return (
    <>
      <Screen
        topColor={palette.background}
        contentColor={palette.background}
        fixedHeader={
          <JzFlowAppBar
            title={t(
              'commitmentsStepTitle',
            )}
            eyebrow={t('yourPlan')}
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
            primaryDisabled={
              !canCompleteReview
            }
            isRtl={isRtl}
            onPrimaryPress={
              continueToCosts
            }
            onSecondaryPress={
              saveAndExit
            }
          />
        }
      >
        <JzShellSurface
          isRtl={isRtl}
          style={styles.hero}
        >
          <JzText
            variant="heading2"
            textDirection={textDirection}
            style={{
              color: palette.heroText,
            }}
          >
            {t('commitmentsQuestion')}
          </JzText>

          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            numberOfLines={2}
            style={{
              color:
                palette.heroSecondary,
            }}
          >
            {t('commitmentsHelper')}
          </JzText>
        </JzShellSurface>

        <YStack
          marginTop={-14}
          paddingHorizontal={spacing[4]}
          paddingBottom={spacing[5]}
          gap={spacing[3]}
        >
          <JzGlassPanel
            tone="surface"
            style={[
              styles.summaryCard,
              {
                borderColor:
                  palette.border,
              },
            ]}
          >
            <XStack
              flexDirection={direction}
              gap={spacing[2]}
            >
              <View
                style={[
                  styles.metricTile,
                  {
                    backgroundColor:
                      palette.warningSurface,
                  },
                ]}
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color: '#C77800',
                    fontWeight: '700',
                  }}
                >
                  {t('commitmentsReadyMoneyDeduction')}
                </JzText>

                <JzText
                  variant="title"
                  textDirection="ltr"
                  numberOfLines={1}
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {formatMoney(
                    tripWindowTotal,
                    locale,
                    workspace.currency,
                  )}
                </JzText>
              </View>

              <View
                style={[
                  styles.metricTile,
                  {
                    backgroundColor:
                      palette.infoSurface,
                  },
                ]}
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color: colors.sky500,
                    fontWeight: '700',
                  }}
                >
                  {t('commitmentsAllUnpaid')}
                </JzText>

                <JzText
                  variant="title"
                  textDirection="ltr"
                  numberOfLines={1}
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {formatMoney(
                    unpaidTotal,
                    locale,
                    workspace.currency,
                  )}
                </JzText>
              </View>

              <View
                style={[
                  styles.metricTile,
                  {
                    backgroundColor:
                      palette.surfaceMuted,
                  },
                ]}
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textMuted,
                  }}
                >
                  {t('commitmentsItemsMetric')}
                </JzText>

                <JzText
                  variant="title"
                  textDirection="ltr"
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {commitmentDisplayCount}
                </JzText>
              </View>
            </XStack>

            {paidPendingCountedTotal > 0 ? (
              <View
                style={[
                  styles.countedBreakdown,
                  {
                    backgroundColor:
                      palette.surfaceMuted,
                    borderColor:
                      palette.border,
                  },
                ]}
              >
                <JzIcon
                  name="info"
                  size={16}
                  color={colors.sky500}
                  strokeWidth={2}
                />
                <JzText
                  flex={1}
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t(
                    'commitmentsReadyMoneyBreakdown',
                    {
                      total: formatMoney(
                        tripWindowTotal,
                        locale,
                        workspace.currency,
                      ),
                      unpaid: formatMoney(
                        unpaidCountedTotal,
                        locale,
                        workspace.currency,
                      ),
                      paid: formatMoney(
                        paidPendingCountedTotal,
                        locale,
                        workspace.currency,
                      ),
                    },
                  )}
                </JzText>
              </View>
            ) : null}
          </JzGlassPanel>

          {nextCommitment ? (
            <JzFocusHighlight
              active={
                focusMatchesNextCommitment
              }
              borderRadius={20}
            >
              <JzGlassPanel
                tone="sky"
                style={styles.nextCard}
              >
              <XStack
                flexDirection={direction}
                alignItems="center"
                gap={spacing[3]}
              >
                <View
                  style={[
                    styles.nextIcon,
                    {
                      backgroundColor:
                        palette.infoSurface,
                    },
                  ]}
                >
                  <JzIcon
                    name="calendar"
                    size={19}
                    color={colors.sky500}
                    strokeWidth={2.1}
                  />
                </View>

                <YStack
                  flex={1}
                  minWidth={0}
                  alignItems={align}
                  gap={2}
                >
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    style={{
                      color: colors.sky500,
                      fontWeight: '700',
                    }}
                  >
                    {t('nextCommitment')}
                  </JzText>

                  <JzText
                    variant="bodySmall"
                    textDirection={textDirection}
                    numberOfLines={1}
                    style={{
                      color:
                        palette.textPrimary,
                      fontWeight: '700',
                    }}
                  >
                    {nextCommitment.title}
                  </JzText>

                  <JzText
                    variant="caption"
                    textDirection="ltr"
                    style={{
                      color:
                        palette.textMuted,
                    }}
                  >
                    {nextCommitment.dueDate}
                  </JzText>

                  {nextCommitmentGroup &&
                  nextCommitmentGroup.itemCount > 1 ? (
                    <JzText
                      variant="caption"
                      textDirection={textDirection}
                      numberOfLines={1}
                      style={{
                        color:
                          palette.textSecondary,
                      }}
                    >
                      {`${t(
                        'nextCommitmentGroupTitle',
                        {
                          count:
                            nextCommitmentGroup
                              .itemCount,
                        },
                      )} · ${formatMoney(
                        nextCommitmentGroup
                          .totalAmount,
                        locale,
                        workspace.currency,
                      )}`}
                    </JzText>
                  ) : null}
                </YStack>

                <JzText
                  variant="title"
                  textDirection="ltr"
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {formatMoney(
                    nextCommitment.amount,
                    locale,
                    workspace.currency,
                  )}
                </JzText>
              </XStack>
              </JzGlassPanel>
            </JzFocusHighlight>
          ) : null}

          <XStack
            flexDirection={direction}
            alignItems="center"
            justifyContent="space-between"
            gap={spacing[3]}
          >
            <YStack
              flex={1}
              alignItems={align}
              gap={2}
            >
              <JzText
                variant="title"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textPrimary,
                }}
              >
                {t('yourCommitments')}
              </JzText>

              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color:
                    palette.textMuted,
                }}
              >
                {t(
                  'yourCommitmentsHelper',
                )}
              </JzText>
            </YStack>

            {commitmentDisplayCount > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  'addCommitment',
                )}
                onPress={openAddMode}
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
                  size={17}
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
                  {t('addCommitment')}
                </JzText>
              </Pressable>
            ) : null}
          </XStack>

          {recurringCommitments.length > 0 ? (
            <YStack
              gap={spacing[2]}
            >
              <JzText
                variant="caption"
                textDirection={
                  textDirection
                }
                style={{
                  color:
                    colors.sky500,
                  fontWeight:
                    '800',
                }}
              >
                {t(
                  'monthlyCommitments',
                )}
              </JzText>

              {recurringCommitments
                .map(
                  (item) => (
                    <CommitmentRecurringPlanCard
                      key={item.id}
                      item={item}
                      returnDate={
                        workspace
                          .dates
                          .returnDate
                      }
                      locale={locale}
                      isRtl={isRtl}
                      onEdit={
                        openEditRecurring
                      }
                      onMarkOccurrencePaid={
                        markMonthlyOccurrencePaid
                      }
                      onReviewOccurrenceImpact={
                        reviewMonthlyOccurrenceImpact
                      }
                    />
                  ),
                )}
            </YStack>
          ) : null}

          {installmentPlans.length > 0 ? (
            <YStack gap={spacing[2]}>
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: '#F5B94C',
                  fontWeight: '800',
                }}
              >
                {t('commitmentInstallmentPlans')}
              </JzText>

              {installmentPlans.map((plan) => (
                <CommitmentInstallmentPlanCard
                  key={plan.planId}
                  plan={plan}
                  isRtl={isRtl}
                  locale={locale}
                  currency={workspace.currency}
                  onMarkPaid={
                    markPaidConservatively
                  }
                  onReviewPaidImpact={
                    reviewPaidImpact
                  }
                  onDeletePlan={(planId) => {
                    removeCommitmentInstallmentPlan(
                      planId,
                    );
                    void Haptics.notificationAsync(
                      Haptics
                        .NotificationFeedbackType
                        .Warning,
                    );
                  }}
                />
              ))}
            </YStack>
          ) : null}

          {beforeTravelItems.length > 0 ? (
            <YStack gap={spacing[2]}>
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: '#C77800',
                  fontWeight: '800',
                }}
              >
                {t(
                  'commitmentsBeforeTravel',
                )}
              </JzText>

              {renderCommitmentList(
                beforeTravelItems,
              )}
            </YStack>
          ) : null}

          {duringTripItems.length > 0 ? (
            <YStack gap={spacing[2]}>
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: colors.sky500,
                  fontWeight: '800',
                }}
              >
                {t('commitmentsDuringTrip')}
              </JzText>

              {renderCommitmentList(
                duringTripItems,
              )}
            </YStack>
          ) : null}

          {otherItems.length > 0 ? (
            <YStack gap={spacing[2]}>
              {(
                beforeTravelItems.length > 0 ||
                duringTripItems.length > 0
              ) ? (
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textMuted,
                    fontWeight: '800',
                  }}
                >
                  {t('commitmentCategoryOther')}
                </JzText>
              ) : null}

              {renderCommitmentList(
                otherItems,
              )}
            </YStack>
          ) : null}

          {commitmentDisplayCount === 0 ? (
            <JzGlassPanel
              tone="surface"
              style={[
                styles.emptyCard,
                {
                  borderColor:
                    palette.border,
                },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  'addCommitment',
                )}
                onPress={openAddMode}
                style={({ pressed }) => [
                  styles.emptyAddContent,
                  {
                    opacity:
                      pressed ? 0.78 : 1,
                  },
                ]}
              >
                <View
                  style={[
                    styles.emptyPlus,
                    {
                      backgroundColor:
                        palette.successSurface,
                      borderColor:
                        'rgba(70,214,164,0.28)',
                    },
                  ]}
                >
                  <JzIcon
                    name="add"
                    size={24}
                    color={colors.mint600}
                    strokeWidth={2.2}
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
                    {t('noCommitmentsTitle')}
                  </JzText>
                  <JzText
                    variant="caption"
                    textDirection={textDirection}
                    textAlign="center"
                    style={{
                      color:
                        palette.textSecondary,
                    }}
                  >
                    {t('noCommitmentsHelper')}
                  </JzText>
                  <JzText
                    variant="bodySmall"
                    textDirection={textDirection}
                    textAlign="center"
                    style={{
                      color: colors.mint600,
                      fontWeight: '800',
                    }}
                  >
                    {t('addCommitment')}
                  </JzText>
                </YStack>
              </Pressable>
            </JzGlassPanel>
          ) : null}

          {(!workspace.commitmentsReviewed ||
          !canCompleteReview) ? (
            <JzGlassPanel
              tone="amber"
              style={styles.reviewCard}
            >
              <XStack
                flexDirection={direction}
                alignItems="center"
                gap={spacing[3]}
              >
                <JzIcon
                  name="warning"
                  size={19}
                  color="#C77800"
                  strokeWidth={2.1}
                />

                <JzText
                  flex={1}
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {t(
                    'commitmentsReviewHelper',
                  )}
                </JzText>
              </XStack>
            </JzGlassPanel>
          ) : null}
        </YStack>
      </Screen>

      <CommitmentRecurringImpactModal
        visible={
          Boolean(
            recurringPaidImpactTarget &&
            recurringPaidImpactPlan &&
            recurringPaidImpactOccurrence,
          )
        }
        amount={
          recurringPaidImpactOccurrence
            ?.amount ?? 0
        }
        currency={
          recurringPaidImpactPlan
            ?.currency ??
          workspace.currency
        }
        dueDate={
          recurringPaidImpactTarget
            ?.dueDate ?? ''
        }
        locale={locale}
        isRtl={isRtl}
        reflected={
          recurringPaidImpactOccurrence
            ?.paidAmountReflectedInMoney ===
          true
        }
        onClose={
          closeRecurringPaidImpact
        }
        onSetReflected={
          applyRecurringPaidReflection
        }
        onMarkUnpaid={
          undoRecurringOccurrencePaid
        }
      />

      <CommitmentRecurringModal
        visible={
          recurringEditorVisible
        }
        item={
          editingRecurringCommitment
        }
        currency={
          workspace.currency
        }
        locale={locale}
        isRtl={isRtl}
        returnDate={
          workspace.dates.returnDate
        }
        onClose={
          closeRecurringEditor
        }
        onSave={
          saveRecurringCommitment
        }
      />

      <CommitmentInstallmentModal
        visible={installmentEditorVisible}
        currency={workspace.currency}
        locale={locale}
        isRtl={isRtl}
        departureDate={
          workspace.dates.departureDate
        }
        returnDate={
          workspace.dates.returnDate
        }
        onClose={() =>
          setInstallmentEditorVisible(false)
        }
        onSave={saveInstallmentPlan}
      />

      <JzActionMenuSheet
        visible={addModeVisible}
        title={t('addCommitment')}
        helper={t('commitmentAddTypeHelper')}
        isRtl={isRtl}
        onClose={() =>
          setAddModeVisible(false)
        }
        actions={[
          {
            key: 'one-time',
            label: t('oneTimeCommitment'),
            icon: 'receipt',
            onPress: openCreate,
          },
          {
            key: 'installments',
            label: t('installmentPlanOption'),
            icon: 'payments',
            onPress: openInstallments,
          },
          {
            key: 'monthly',
            label: t('monthlyCommitmentOption'),
            icon: 'calendar',
            onPress: openMonthly,
          },
        ]}
      />

      <JzActionMenuSheet
        visible={actionCommitment !== null}
        title={
          actionCommitment?.title ??
          t('moreActions')
        }
        helper={t('commitmentActionHelper')}
        isRtl={isRtl}
        onClose={() =>
          setActionCommitment(null)
        }
        actions={
          actionCommitment
            ? [
                {
                  key: 'edit',
                  label: t('editCommitment'),
                  icon: 'edit' as const,
                  onPress: () =>
                    openEdit(actionCommitment),
                },
                {
                  key: 'status',
                  label:
                    actionCommitment.status ===
                    'paid'
                      ? t('markCommitmentUnpaid')
                      : t('markCommitmentPaid'),
                  icon: 'check' as const,
                  tone:
                    actionCommitment.status ===
                    'paid'
                      ? 'default' as const
                      : 'success' as const,
                  onPress: () => {
                    if (
                      actionCommitment.status ===
                      'paid'
                    ) {
                      updateCommitment(
                        actionCommitment.id,
                        {
                          status: 'unpaid',
                          paidAmountReflectedInMoney:
                            false,
                        },
                      );
                      void Haptics.notificationAsync(
                        Haptics
                          .NotificationFeedbackType
                          .Success,
                      );
                      return;
                    }

                    markPaidConservatively(
                      actionCommitment,
                    );
                  },
                },
                {
                  key: 'delete',
                  label: t('removeCommitment'),
                  icon: 'delete' as const,
                  tone: 'danger' as const,
                  onPress: () => {
                    removeCommitment(
                      actionCommitment.id,
                    );
                    void Haptics.notificationAsync(
                      Haptics
                        .NotificationFeedbackType
                        .Warning,
                    );
                  },
                },
              ]
            : []
        }
      />

      <JzActionMenuSheet
        visible={
          paidReflectionTarget !== null
        }
        title={
          paidReflectionTarget
            ? t(
                'commitmentPaidMoneyQuestion',
                {
                  amount:
                    paidReflectionTarget.amount
                      .toLocaleString(
                        'en-US',
                        {
                          maximumFractionDigits: 2,
                        },
                      ),
                  currency:
                    workspace.currency,
                },
              )
            : ''
        }
        helper={t(
          'commitmentPaidMoneyHelper',
        )}
        isRtl={isRtl}
        onClose={() =>
          setPaidReflectionTarget(null)
        }
        actions={
          paidReflectionTarget
            ? [
                {
                  key: 'keep-counted',
                  label: t(
                    'commitmentPaidKeepDeducted',
                    {
                      amount:
                        paidReflectionTarget.amount
                          .toLocaleString(
                            'en-US',
                            {
                              maximumFractionDigits: 2,
                            },
                          ),
                      currency:
                        workspace.currency,
                    },
                  ),
                  icon: 'receipt' as const,
                  onPress: () =>
                    applyPaidReflection(
                      paidReflectionTarget,
                      false,
                    ),
                },
                {
                  key: 'stop-counting',
                  label: t(
                    'commitmentPaidMoneyUpdated',
                    {
                      amount:
                        paidReflectionTarget.amount
                          .toLocaleString(
                            'en-US',
                            {
                              maximumFractionDigits: 2,
                            },
                          ),
                      currency:
                        workspace.currency,
                    },
                  ),
                  icon: 'check' as const,
                  onPress: () =>
                    applyPaidReflection(
                      paidReflectionTarget,
                      true,
                    ),
                },
                ...(
                  isCommitmentInstallmentStatusTransitionAllowed(
                    workspace.commitments,
                    paidReflectionTarget.id,
                    'unpaid',
                  )
                    ? [
                        {
                          key: 'mark-unpaid',
                          label: t(
                            'commitmentPaidUndoPayment',
                          ),
                          icon: 'edit' as const,
                          onPress: () => {
                            updateCommitment(
                              paidReflectionTarget.id,
                              {
                                status:
                                  'unpaid',
                                paidAmountReflectedInMoney:
                                  false,
                              },
                            );
                            setPaidReflectionTarget(
                              null,
                            );
                            void Haptics.notificationAsync(
                              Haptics
                                .NotificationFeedbackType
                                .Success,
                            );
                          },
                        },
                      ]
                    : []
                ),
              ]
            : []
        }
      />
      <CommitmentEditorModal
        key={`${editorVisible}-${editingCommitment?.id ?? 'new'}`}
        visible={editorVisible}
        item={editingCommitment}
        currency={workspace.currency}
        departureDate={
          workspace.dates.departureDate
        }
        isRtl={isRtl}
        locale={locale}
        onClose={closeEditor}
        onSave={saveCommitment}
      />
    </>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    paddingBottom: 30,
    gap: spacing[2],
  },
  summaryCard: {
    padding: spacing[2],
    borderRadius: 22,
  },
  metricTile: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    padding: spacing[3],
    borderRadius: 16,
  },
  countedBreakdown: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
    paddingHorizontal: spacing[3],
    paddingVertical: spacing[2],
    borderRadius: 14,
    borderWidth: 1,
  },
  nextCard: {
    padding: spacing[3],
    borderRadius: 20,
  },
  nextIcon: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  installmentAddButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  addButton: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
  },
  commitmentRow: {
    padding: spacing[3],
    borderRadius: 20,
  },
  rowIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  statusPill: {
    minHeight: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    borderRadius: radius.full,
  },
  reviewImpactButton: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    marginTop: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 14,
    borderWidth: 1,
  },
  rowAction: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  emptyCard: {
    padding: spacing[4],
    gap: spacing[3],
    alignItems: 'stretch',
    borderRadius: 20,
  },
  emptyAddContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[3],
    paddingVertical: spacing[2],
  },
  emptyPlus: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
  },
  emptyAction: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 13,
    borderWidth: 1,
  },
  reviewCard: {
    padding: spacing[3],
    borderRadius: 18,
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
