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
import {
  XStack,
  YStack,
} from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import type {
  TripCommitmentCategoryId,
  TripRecurringCommitment,
} from '@jahiz/api-contracts';
import { JzInlineDatePicker } from '@/components/jz-inline-date-picker';
import { JzIcon } from '@/components/jz-icon';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import { formatMoney } from '@/utils/format-money';
import {
  tripCommitmentCategories,
} from './trip-commitment-categories';
import {
  buildRecurringCommitmentWindowPreview,
} from './commitment-recurring-preview';
import {
  parseRecurringCommitmentAmount,
} from './commitment-recurring-money';
import {
  getRecurringCommitmentEndDateError,
  type RecurringEndMode,
} from './commitment-recurring-end-date';

type RecurringDraft = {
  title: string;
  categoryId:
    TripCommitmentCategoryId | null;
  amount: string;
  firstDueDate: string | null;
  endMode: RecurringEndMode;
  endDate: string | null;
};

type Props = {
  visible: boolean;
  item:
    TripRecurringCommitment | null;
  currency: string;
  locale: 'ar' | 'en';
  isRtl: boolean;
  returnDate: string | null;

  onClose: () => void;

  onSave: (draft: {
    title: string;
    categoryId:
      TripCommitmentCategoryId;
    amount: number;
    firstDueDate: string;
    endDate: string | null;
  }) => void;
};

function emptyDraft():
  RecurringDraft {
  return {
    title: '',
    categoryId: null,
    amount: '',
    firstDueDate: null,
    endMode: 'ongoing',
    endDate: null,
  };
}

export function CommitmentRecurringModal({
  visible,
  item,
  currency,
  locale,
  isRtl,
  returnDate,
  onClose,
  onSave,
}: Props) {
  const { t } =
    useJahizLocale();

  const { palette } =
    useJahizTheme();

  const [draft, setDraft] =
    useState<RecurringDraft>(
      emptyDraft,
    );

  const direction =
    isRtl
      ? 'row-reverse'
      : 'row';

  const textDirection =
    isRtl
      ? 'rtl'
      : 'ltr';

  const amount =
    parseRecurringCommitmentAmount(
      draft.amount,
    );

  // Once payment history exists,
  // changing the cadence anchor could rewrite
  // occurrence identity. V1 keeps it fixed.
  const dateLocked =
    Boolean(
      item &&
      item.paidOccurrences
        .length > 0,
    );

  const hasValidTitle =
    Boolean(
      draft.title.trim(),
    );

  const hasCategory =
    Boolean(
      draft.categoryId,
    );

  const hasValidAmount =
    amount !== null;

  const hasFirstDueDate =
    Boolean(
      draft.firstDueDate,
    );

  const endDateError =
    getRecurringCommitmentEndDateError({
      endMode:
        draft.endMode,
      endDate:
        draft.endDate,
      firstDueDate:
        draft.firstDueDate,
      paidDates:
        item?.paidOccurrences.map(
          (occurrence) =>
            occurrence.dueDate,
        ) ?? [],
    });

  const effectiveEndDate =
    draft.endMode === 'ongoing'
      ? null
      : draft.endDate;

  const canSave =
    hasValidTitle &&
    hasCategory &&
    hasValidAmount &&
    hasFirstDueDate &&
    endDateError === null;

  const preview =
    useMemo(
      () => {
        if (
          !amount ||
          !draft.firstDueDate ||
          endDateError !== null
        ) {
          return null;
        }

        return buildRecurringCommitmentWindowPreview({
          firstDueDate:
            draft.firstDueDate,
          amount,
          returnDate,
          endDate:
            effectiveEndDate,
          paidOccurrences:
            item?.paidOccurrences ??
            [],
        });
      },
      [
        amount,
        draft.firstDueDate,
        effectiveEndDate,
        endDateError,
        item?.paidOccurrences,
        returnDate,
      ],
    );

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (item) {
      setDraft({
        title:
          item.title,
        categoryId:
          item.categoryId,
        amount:
          String(
            item.amount,
          ),
        firstDueDate:
          item.recurrence
            .firstDueDate,
        endMode:
          item.recurrence
            .endDate === null
            ? 'ongoing'
            : 'date',
        endDate:
          item.recurrence
            .endDate,
      });

      return;
    }

    setDraft(
      emptyDraft(),
    );
  }, [
    item,
    visible,
  ]);

  function selectCategory(
    categoryId:
      TripCommitmentCategoryId,
  ) {
    const category =
      tripCommitmentCategories
        .find(
          (candidate) =>
            candidate.id ===
            categoryId,
        );

    setDraft(
      (current) => {
        const currentCategory =
          tripCommitmentCategories
            .find(
              (candidate) =>
                candidate.id ===
                current.categoryId,
            );

        const currentDefaultTitle =
          currentCategory
            ? t(
                currentCategory
                  .defaultTitleKey,
              )
            : '';

        const nextDefaultTitle =
          category
            ? t(
                category
                  .defaultTitleKey,
              )
            : current.title;

        const shouldFollowCategory =
          !current.title.trim() ||
          current.title.trim() ===
            currentDefaultTitle.trim();

        return {
          ...current,
          categoryId,
          title:
            shouldFollowCategory
              ? nextDefaultTitle
              : current.title,
        };
      },
    );

    void Haptics
      .selectionAsync();
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
      title:
        draft.title.trim(),
      categoryId:
        draft.categoryId,
      amount,
      firstDueDate:
        draft.firstDueDate,
      endDate:
        effectiveEndDate,
    });
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={
        onClose
      }
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
          accessibilityLabel={
            t('close')
          }
          onPress={onClose}
          style={
            styles.backdrop
          }
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
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.content
            }
          >
            <XStack
              flexDirection={
                direction
              }
              alignItems="center"
              justifyContent="space-between"
              gap={spacing[3]}
            >
              <YStack
                flex={1}
                gap={3}
              >
                <JzText
                  variant="heading2"
                  textDirection={
                    textDirection
                  }
                  style={{
                    color:
                      palette
                        .textPrimary,
                  }}
                >
                  {t(
                    item
                      ? 'editMonthlyCommitment'
                      : 'addMonthlyCommitment',
                  )}
                </JzText>

                <JzText
                  variant="bodySmall"
                  textDirection={
                    textDirection
                  }
                  style={{
                    color:
                      palette
                        .textSecondary,
                  }}
                >
                  {t(
                    'monthlyCommitmentEditorHelper',
                  )}
                </JzText>
              </YStack>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  t('close')
                }
                onPress={
                  onClose
                }
                style={[
                  styles.iconButton,
                  {
                    backgroundColor:
                      palette
                        .surfaceMuted,
                    borderColor:
                      palette.border,
                  },
                ]}
              >
                <JzIcon
                  name="close"
                  size={20}
                  color={
                    palette
                      .textPrimary
                  }
                  strokeWidth={
                    2.1
                  }
                />
              </Pressable>
            </XStack>

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
                    palette
                      .textSecondary,
                }}
              >
                {t(
                  'commitmentCategory',
                )}
              </JzText>

              <View
                style={[
                  styles.categoryGrid,
                  {
                    flexDirection:
                      direction,
                  },
                ]}
              >
                {tripCommitmentCategories
                  .map(
                    (category) => {
                      const selected =
                        draft
                          .categoryId ===
                        category.id;

                      return (
                        <Pressable
                          key={
                            category.id
                          }
                          accessibilityRole="button"
                          accessibilityState={{
                            selected,
                          }}
                          accessibilityLabel={
                            t(
                              category
                                .labelKey,
                            )
                          }
                          onPress={() =>
                            selectCategory(
                              category.id,
                            )
                          }
                          style={({
                            pressed,
                          }) => [
                            styles.categoryChoice,
                            {
                              opacity:
                                pressed
                                  ? 0.8
                                  : 1,
                              backgroundColor:
                                selected
                                  ? palette
                                      .successSurface
                                  : palette
                                      .surface,
                              borderColor:
                                selected
                                  ? colors
                                      .mint500
                                  : palette
                                      .border,
                            },
                          ]}
                        >
                          <JzIcon
                            name={
                              category.icon
                            }
                            size={19}
                            color={
                              selected
                                ? colors
                                    .mint600
                                : palette
                                    .textSecondary
                            }
                            strokeWidth={
                              2.1
                            }
                          />

                          <JzText
                            variant="caption"
                            textDirection={
                              textDirection
                            }
                            textAlign="center"
                            numberOfLines={
                              2
                            }
                            style={{
                              color:
                                selected
                                  ? colors
                                      .mint600
                                  : palette
                                      .textPrimary,
                              fontWeight:
                                selected
                                  ? '800'
                                  : '600',
                            }}
                          >
                            {t(
                              category
                                .labelKey,
                            )}
                          </JzText>
                        </Pressable>
                      );
                    },
                  )}
              </View>
            </YStack>

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
                    palette
                      .textSecondary,
                }}
              >
                {t(
                  'commitmentName',
                )}
              </JzText>

              <TextInput
                value={
                  draft.title
                }
                maxLength={120}
                autoCorrect
                placeholder={t(
                  'monthlyCommitmentNamePlaceholder',
                )}
                placeholderTextColor={
                  palette.textMuted
                }
                onChangeText={(
                  title,
                ) =>
                  setDraft(
                    (current) => ({
                      ...current,
                      title,
                    }),
                  )
                }
                style={[
                  styles.textInput,
                  {
                    color:
                      palette
                        .textPrimary,
                    backgroundColor:
                      palette
                        .inputBackground,
                    borderColor:
                      palette
                        .borderStrong,
                    textAlign:
                      isRtl
                        ? 'right'
                        : 'left',
                  },
                ]}
              />
            </YStack>

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
                    palette
                      .textSecondary,
                }}
              >
                {t(
                  'monthlyCommitmentAmount',
                )}
              </JzText>

              <View
                style={[
                  styles.amountShell,
                  {
                    flexDirection:
                      direction,
                    backgroundColor:
                      palette
                        .inputBackground,
                    borderColor:
                      palette
                        .borderStrong,
                  },
                ]}
              >
                <TextInput
                  value={
                    draft.amount
                  }
                  maxLength={13}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={
                    palette.textMuted
                  }
                  onChangeText={(
                    value,
                  ) =>
                    setDraft(
                      (current) => ({
                        ...current,
                        amount: value,
                      }),
                    )
                  }
                  style={[
                    styles.amountInput,
                    {
                      color:
                        palette
                          .textPrimary,
                    },
                  ]}
                />

                <View
                  style={[
                    styles.currencyChip,
                    {
                      backgroundColor:
                        palette
                          .surface,
                      borderColor:
                        palette
                          .border,
                    },
                  ]}
                >
                  <JzText
                    variant="caption"
                    textDirection="ltr"
                    style={{
                      color:
                        palette
                          .textSecondary,
                    }}
                  >
                    {currency}
                  </JzText>
                </View>
              </View>
            </YStack>

            <View
              style={[
                styles.repeatCard,
                {
                  backgroundColor:
                    palette
                      .surfaceMuted,
                  borderColor:
                    palette.border,
                },
              ]}
            >
              <XStack
                flexDirection={
                  direction
                }
                alignItems="center"
                gap={spacing[2]}
              >
                <JzIcon
                  name="calendar"
                  size={19}
                  color={
                    colors.sky500
                  }
                  strokeWidth={2}
                />

                <YStack
                  flex={1}
                  gap={2}
                >
                  <JzText
                    variant="bodySmall"
                    textDirection={
                      textDirection
                    }
                    style={{
                      color:
                        palette
                          .textPrimary,
                      fontWeight:
                        '800',
                    }}
                  >
                    {t(
                      'monthlyCommitmentEveryMonth',
                    )}
                  </JzText>

                  <JzText
                    variant="caption"
                    textDirection={
                      textDirection
                    }
                    style={{
                      color:
                        palette
                          .textMuted,
                    }}
                  >
                    {t(
                      'monthlyCommitmentEveryMonthHelper',
                    )}
                  </JzText>
                </YStack>
              </XStack>
            </View>

            {dateLocked ? (
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
                      palette
                        .textSecondary,
                  }}
                >
                  {t(
                    'monthlyCommitmentNextDueDate',
                  )}
                </JzText>

                <View
                  style={[
                    styles.lockedDate,
                    {
                      backgroundColor:
                        palette
                          .surfaceMuted,
                      borderColor:
                        palette
                          .border,
                    },
                  ]}
                >
                  <JzText
                    variant="bodySmall"
                    textDirection="ltr"
                    style={{
                      color:
                        palette
                          .textPrimary,
                      fontWeight:
                        '700',
                    }}
                  >
                    {
                      draft
                        .firstDueDate
                    }
                  </JzText>

                  <JzText
                    variant="caption"
                    textDirection={
                      textDirection
                    }
                    style={{
                      color:
                        palette
                          .textMuted,
                    }}
                  >
                    {t(
                      'monthlyCommitmentDateLocked',
                    )}
                  </JzText>
                </View>
              </YStack>
            ) : (
              <JzInlineDatePicker
                selectedDate={
                  draft.firstDueDate
                }
                locale={locale}
                isRtl={isRtl}
                onSelect={(
                  firstDueDate,
                ) =>
                  setDraft(
                    (current) => ({
                      ...current,
                      firstDueDate,
                    }),
                  )
                }
                label={t(
                  'monthlyCommitmentNextDueDate',
                )}
                customLabel={t(
                  'paymentCustomDate',
                )}
                chooseLabel={t(
                  'choosePaymentDueDate',
                )}
                todayLabel={t(
                  'todayDate',
                )}
                tomorrowLabel={t(
                  'paymentTomorrow',
                )}
                inDaysLabel={(days) =>
                  t(
                    'paymentInDays',
                    { days },
                  )
                }
                previousMonthLabel={t(
                  'previousMonth',
                )}
                nextMonthLabel={t(
                  'nextMonth',
                )}
              />
            )}
            <YStack
              gap={spacing[2]}
            >
              <JzText
                variant="bodySmall"
                textDirection={
                  textDirection
                }
                style={{
                  color:
                    palette.textPrimary,
                  fontWeight:
                    '800',
                }}
              >
                {t(
                  'monthlyCommitmentEnds',
                )}
              </JzText>

              <XStack
                flexDirection={
                  direction
                }
                gap={spacing[2]}
              >
                {(
                  [
                    'ongoing',
                    'date',
                  ] as const
                ).map(
                  (mode) => {
                    const selected =
                      draft.endMode ===
                      mode;

                    return (
                      <Pressable
                        key={mode}
                        accessibilityRole="radio"
                        accessibilityState={{
                          selected,
                        }}
                        accessibilityLabel={t(
                          mode ===
                            'ongoing'
                            ? 'monthlyCommitmentOngoing'
                            : 'monthlyCommitmentOnDate',
                        )}
                        onPress={() =>
                          setDraft(
                            (current) => ({
                              ...current,
                              endMode:
                                mode,
                            }),
                          )
                        }
                        style={[
                          styles.endModeChoice,
                          {
                            flex: 1,
                            borderColor:
                              selected
                                ? colors.mint500
                                : palette.border,
                            backgroundColor:
                              selected
                                ? palette.successSurface
                                : palette.surfaceMuted,
                          },
                        ]}
                      >
                        <JzText
                          variant="bodySmall"
                          textDirection={
                            textDirection
                          }
                          style={{
                            color:
                              selected
                                ? colors.mint600
                                : palette.textPrimary,
                            fontWeight:
                              selected
                                ? '800'
                                : '600',
                          }}
                        >
                          {t(
                            mode ===
                              'ongoing'
                              ? 'monthlyCommitmentOngoing'
                              : 'monthlyCommitmentOnDate',
                          )}
                        </JzText>
                      </Pressable>
                    );
                  },
                )}
              </XStack>

              {draft.endMode ===
              'date' ? (
                <YStack
                  gap={spacing[2]}
                >
                  <JzInlineDatePicker
                selectedDate={
                  draft.endDate
                }
                locale={locale}
                isRtl={isRtl}
                onSelect={(
                  endDate,
                ) =>
                  setDraft(
                    (current) => ({
                      ...current,
                      endDate,
                    }),
                  )
                }
                label={t(
                  'monthlyCommitmentEndDate',
                )}
                customLabel={t(
                  'paymentCustomDate',
                )}
                chooseLabel={t(
                  'monthlyCommitmentChooseEndDate',
                )}
                todayLabel={t(
                  'todayDate',
                )}
                tomorrowLabel={t(
                  'paymentTomorrow',
                )}
                inDaysLabel={(days) =>
                  t(
                    'paymentInDays',
                    { days },
                  )
                }
                previousMonthLabel={t(
                  'previousMonth',
                )}
                nextMonthLabel={t(
                  'nextMonth',
                )}
              />

                  {endDateError ? (
                    <JzText
                      variant="caption"
                      textDirection={
                        textDirection
                      }
                      style={{
                        color:
                          palette.textSecondary,
                      }}
                    >
                      {t(
                        endDateError ===
                          'required'
                          ? 'monthlyCommitmentEndRequired'
                          : endDateError ===
                              'beforeFirstDue'
                            ? 'monthlyCommitmentEndBeforeFirstDue'
                            : 'monthlyCommitmentEndBeforePaid',
                      )}
                    </JzText>
                  ) : null}
                </YStack>
              ) : null}
            </YStack>



            <View
              style={[
                styles.previewCard,
                {
                  backgroundColor:
                    palette
                      .surfaceMuted,
                  borderColor:
                    palette.border,
                },
              ]}
            >
              <JzText
                variant="caption"
                textDirection={
                  textDirection
                }
                style={{
                  color:
                    palette
                      .textSecondary,
                }}
              >
                {preview
                  ? t(
                      'monthlyCommitmentTripPreview',
                      {
                        count:
                          preview.count,
                        total:
                          formatMoney(
                            preview
                              .total,
                            locale,
                            currency,
                          ),
                      },
                    )
                  : endDateError
                    ? t(
                        'monthlyCommitmentPreviewFixEnd',
                      )
                    : t(
                        'monthlyCommitmentTripPreviewNoDates',
                      )}
              </JzText>
            </View>

            {!hasFirstDueDate &&
            hasCategory &&
            hasValidTitle &&
            hasValidAmount ? (
              <JzText
                variant="caption"
                textDirection={
                  textDirection
                }
                style={{
                  color:
                    palette.textMuted,
                  textAlign:
                    isRtl
                      ? 'right'
                      : 'left',
                }}
              >
                {t(
                  'choosePaymentDueDate',
                )}
              </JzText>
            ) : null}

            <Pressable
              accessibilityRole="button"
              accessibilityState={{
                disabled:
                  !canSave,
              }}
              disabled={
                !canSave
              }
              onPress={save}
              style={({
                pressed,
              }) => [
                styles.saveButton,
                {
                  opacity:
                    !canSave
                      ? 0.45
                      : pressed
                        ? 0.82
                        : 1,
                  backgroundColor:
                    colors.mint500,
                },
              ]}
            >
              <JzText
                variant="body"
                textDirection={
                  textDirection
                }
                style={{
                  color:
                    colors.navy950,
                  fontWeight:
                    '800',
                }}
              >
                {t(
                  'saveMonthlyCommitment',
                )}
              </JzText>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles =
  StyleSheet.create({
    root: {
      flex: 1,
      justifyContent:
        'flex-end',
    },
    backdrop: {
      ...StyleSheet
        .absoluteFill,
      backgroundColor:
        'rgba(0,0,0,0.45)',
    },
    sheet: {
      maxHeight: '92%',
      borderTopLeftRadius: 30,
      borderTopRightRadius: 30,
      borderWidth: 1,
      paddingTop:
        spacing[2],
    },
    handle: {
      alignSelf: 'center',
      width: 42,
      height: 4,
      borderRadius:
        radius.full,
      marginBottom:
        spacing[2],
    },
    content: {
      paddingHorizontal:
        spacing[4],
      paddingBottom:
        spacing[6],
      gap: spacing[4],
    },
    iconButton: {
      width: 42,
      height: 42,
      borderRadius:
        radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },
    categoryGrid: {
      flexWrap: 'wrap',
      gap: spacing[2],
    },
    categoryChoice: {
      width: '31%',
      minHeight: 82,
      borderRadius: 18,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      gap: spacing[1],
      paddingHorizontal:
        spacing[1],
      paddingVertical:
        spacing[2],
    },
    textInput: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      paddingHorizontal:
        spacing[3],
      fontSize: 16,
    },
    amountShell: {
      minHeight: 56,
      borderRadius: 16,
      borderWidth: 1,
      alignItems: 'center',
      paddingHorizontal:
        spacing[2],
    },
    amountInput: {
      flex: 1,
      minHeight: 54,
      fontSize: 22,
      fontWeight: '800',
    },
    currencyChip: {
      borderRadius:
        radius.full,
      borderWidth: 1,
      paddingHorizontal:
        spacing[2],
      paddingVertical:
        spacing[1],
    },
    repeatCard: {
      borderRadius: 18,
      borderWidth: 1,
      padding: spacing[3],
    },
    lockedDate: {
      borderRadius: 16,
      borderWidth: 1,
      padding: spacing[3],
      gap: spacing[1],
    },
    endModeChoice: {
      minHeight: 48,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal:
        spacing[2],
    },
    previewCard: {
      borderRadius: 16,
      borderWidth: 1,
      padding: spacing[3],
    },
    saveButton: {
      minHeight: 52,
      borderRadius:
        radius.full,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal:
        spacing[4],
    },
  });
