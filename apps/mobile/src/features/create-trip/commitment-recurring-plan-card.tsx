import {
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
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
  TripRecurringCommitment,
} from '@jahiz/api-contracts';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { JzIcon } from '@/components/jz-icon';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import { formatMoney } from '@/utils/format-money';
import {
  buildRecurringCommitmentOccurrencePreview,
  buildRecurringCommitmentWindowPreview,
} from './commitment-recurring-preview';

type Props = {
  item:
    TripRecurringCommitment;
  returnDate:
    string | null;
  locale:
    'ar' | 'en';
  isRtl: boolean;
  onEdit: (
    item:
      TripRecurringCommitment,
  ) => void;

  onMarkOccurrencePaid?: (
    item:
      TripRecurringCommitment,
    dueDate: string,
  ) => void;

  onReviewOccurrenceImpact?: (
    item:
      TripRecurringCommitment,
    dueDate: string,
  ) => void;
};

export function CommitmentRecurringPlanCard({
  item,
  returnDate,
  locale,
  isRtl,
  onEdit,
  onMarkOccurrencePaid,
  onReviewOccurrenceImpact,
}: Props) {
  const { t } =
    useJahizLocale();

  const { palette } =
    useJahizTheme();

  const [
    detailsVisible,
    setDetailsVisible,
  ] = useState(false);

  const direction =
    isRtl
      ? 'row-reverse'
      : 'row';

  const textDirection =
    isRtl
      ? 'rtl'
      : 'ltr';

  const preview =
    buildRecurringCommitmentWindowPreview({
      firstDueDate:
        item.recurrence
          .firstDueDate,
      amount:
        item.amount,
      returnDate,
      endDate:
        item.recurrence.endDate,
      paidOccurrences:
        item.paidOccurrences,
    });

  const occurrences =
    buildRecurringCommitmentOccurrencePreview({
      firstDueDate:
        item.recurrence
          .firstDueDate,
      amount:
        item.amount,
      returnDate,
      endDate:
        item.recurrence.endDate,
      paidOccurrences:
        item.paidOccurrences,
    });

  const nextDue =
    preview
      ? preview.nextUnpaidDate
      : (
          item.paidOccurrences
            .some(
              (occurrence) =>
                occurrence.dueDate ===
                item.recurrence
                  .firstDueDate,
            )
            ? null
            : item.recurrence
                .firstDueDate
        );

  return (
    <JzGlassPanel
      tone="surface"
      style={[
        styles.card,
        {
          borderColor:
            palette.border,
        },
      ]}
    >
      <XStack
        flexDirection={
          direction
        }
        alignItems="flex-start"
        gap={spacing[3]}
      >
        <View
          style={[
            styles.icon,
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
            name="calendar"
            size={20}
            color={
              colors.sky500
            }
            strokeWidth={2.1}
          />
        </View>

        <YStack
          flex={1}
          gap={spacing[1]}
        >
          <JzText
            variant="body"
            textDirection={
              textDirection
            }
            numberOfLines={2}
            style={{
              color:
                palette
                  .textPrimary,
              fontWeight:
                '800',
            }}
          >
            {item.title}
          </JzText>

          <JzText
            variant="bodySmall"
            textDirection={
              textDirection
            }
            style={{
              color:
                colors.mint600,
              fontWeight:
                '800',
            }}
          >
            {t(
              'monthlyCommitmentPerMonth',
              {
                amount:
                  formatMoney(
                    item.amount,
                    locale,
                    item.currency,
                  ),
              },
            )}
          </JzText>

           <JzText
             variant="caption"
             textDirection={
               textDirection
             }
             style={{
               color:
                 palette.textSecondary,
               fontWeight: '600',
             }}
           >
             {item.recurrence.endDate ===
             null
               ? t(
                   'monthlyCommitmentOngoing',
                 )
               : t(
                   'monthlyCommitmentEndsOn',
                   {
                     date:
                       item.recurrence
                         .endDate,
                   },
                 )}
           </JzText>

          <JzText
            variant="caption"
            textDirection={
              textDirection
            }
            style={{
              color:
                palette.textMuted,
            }}
          >
            {nextDue
              ? t(
                  'monthlyCommitmentNextDue',
                  {
                    date:
                      nextDue,
                  },
                )
              : t(
                  'monthlyCommitmentNoUnpaidInWindow',
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
                  .textSecondary,
            }}
          >
            {preview
              ? t(
                  'monthlyCommitmentWindowImpact',
                  {
                    count:
                      preview.count,
                    total:
                      formatMoney(
                        preview.total,
                        locale,
                        item.currency,
                      ),
                  },
                )
              : t(
                  'monthlyCommitmentTripPreviewNoDates',
                )}
          </JzText>
        </YStack>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            t(
              'editMonthlyCommitment',
            )
          }
          onPress={() =>
            onEdit(item)
          }
          style={[
            styles.action,
            {
              borderColor:
                palette.border,
              backgroundColor:
                palette
                  .surfaceMuted,
            },
          ]}
        >
          <JzIcon
            name="edit"
            size={17}
            color={
              palette
                .textSecondary
            }
            strokeWidth={2}
          />
        </Pressable>
      </XStack>

      {occurrences &&
      occurrences.length > 0 ? (
        <YStack
          gap={spacing[2]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              t(
                detailsVisible
                  ? 'hideInstallments'
                  : 'viewInstallments',
              )
            }
            accessibilityState={{
              expanded:
                detailsVisible,
            }}
            onPress={() =>
              setDetailsVisible(
                (current) =>
                  !current,
              )
            }
            style={[
              styles.detailsButton,
              {
                borderColor:
                  palette.border,
                backgroundColor:
                  palette
                    .surfaceMuted,
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
                    .textPrimary,
                fontWeight:
                  '800',
              }}
            >
              {t(
                detailsVisible
                  ? 'hideInstallments'
                  : 'viewInstallments',
              )}
            </JzText>
          </Pressable>

          {detailsVisible ? (
            <YStack
              gap={spacing[2]}
            >
              {occurrences.map(
                (occurrence) => {
                  const paid =
                    occurrence
                      .status !==
                    'unpaid';

                  const reflected =
                    occurrence
                      .status ===
                    'paid-reflected';

                  const actionAvailable =
                    paid
                      ? Boolean(
                          onReviewOccurrenceImpact,
                        )
                      : Boolean(
                          onMarkOccurrencePaid,
                        );

                  const actionLabel =
                    paid
                      ? t(
                          'commitmentPaidImpactAction',
                        )
                      : t(
                          'markCommitmentPaid',
                        );

                  return (
                    <View
                      key={
                        occurrence
                          .dueDate
                      }
                      style={[
                        styles.occurrenceRow,
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
                      <XStack
                        flexDirection={
                          direction
                        }
                        alignItems="center"
                        justifyContent="space-between"
                        gap={
                          spacing[2]
                        }
                      >
                        <YStack
                          flex={1}
                          gap={2}
                        >
                          <JzText
                            variant="bodySmall"
                            textDirection="ltr"
                            style={{
                              color:
                                palette
                                  .textPrimary,
                              fontWeight:
                                '800',
                            }}
                          >
                            {
                              occurrence
                                .dueDate
                            }
                          </JzText>

                          <JzText
                            variant="caption"
                            textDirection="ltr"
                            style={{
                              color:
                                palette
                                  .textSecondary,
                              fontWeight:
                                '700',
                            }}
                          >
                            {formatMoney(
                              occurrence
                                .amount,
                              locale,
                              item
                                .currency,
                            )}
                          </JzText>
                        </YStack>

                        {paid ? (
                          <View
                            style={[
                              styles.statusPill,
                              {
                                backgroundColor:
                                  reflected
                                    ? palette
                                        .successSurface
                                    : palette
                                        .surface,
                                borderColor:
                                  reflected
                                    ? 'rgba(48,214,162,0.28)'
                                    : palette
                                        .borderStrong,
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
                                  reflected
                                    ? colors
                                        .mint600
                                    : palette
                                        .textSecondary,
                                fontWeight:
                                  '800',
                              }}
                            >
                              {t(
                                reflected
                                  ? 'commitmentPaidMoneyUpdatedShort'
                                  : 'commitmentPaidStillDeductedShort',
                              )}
                            </JzText>
                          </View>
                        ) : null}
                      </XStack>

                      {actionAvailable ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            actionLabel
                          }
                          onPress={() => {
                            if (paid) {
                              onReviewOccurrenceImpact?.(
                                item,
                                occurrence
                                  .dueDate,
                              );

                              return;
                            }

                            onMarkOccurrencePaid?.(
                              item,
                              occurrence
                                .dueDate,
                            );
                          }}
                          style={[
                            styles.occurrenceAction,
                            {
                              borderColor:
                                paid
                                  ? palette
                                      .border
                                  : 'rgba(48,214,162,0.30)',
                              backgroundColor:
                                paid
                                  ? palette
                                      .surface
                                  : palette
                                      .successSurface,
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
                                paid
                                  ? palette
                                      .textPrimary
                                  : colors
                                      .mint600,
                              fontWeight:
                                '800',
                            }}
                          >
                            {
                              actionLabel
                            }
                          </JzText>
                        </Pressable>
                      ) : null}
                    </View>
                  );
                },
              )}
            </YStack>
          ) : null}
        </YStack>
      ) : null}
    </JzGlassPanel>
  );
}

const styles =
  StyleSheet.create({
    card: {
      padding: spacing[3],
      borderRadius: 20,
    },
    icon: {
      width: 44,
      height: 44,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },
    action: {
      width: 38,
      height: 38,
      borderRadius:
        radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
    },
    detailsButton: {
      minHeight: 40,
      borderRadius: 14,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal:
        spacing[3],
    },
    occurrenceRow: {
      borderRadius: 16,
      borderWidth: 1,
      padding: spacing[3],
      gap: spacing[2],
    },
    statusPill: {
      maxWidth: '55%',
      borderRadius:
        radius.full,
      borderWidth: 1,
      paddingHorizontal:
        spacing[2],
      paddingVertical:
        spacing[1],
    },
    occurrenceAction: {
      minHeight: 40,
      borderRadius:
        radius.full,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent:
        'center',
      paddingHorizontal:
        spacing[3],
    },
  });
