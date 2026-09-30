import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
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
import { JzActionMenuSheet } from '@/components/jz-action-menu-sheet';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { JzIcon } from '@/components/jz-icon';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import type {
  TripCommitmentInstallmentPlanSummary,
} from '@/features/trip-workspace';
import { formatMoney } from '@/utils/format-money';
import {
  isCommitmentInstallmentStatusTransitionAllowed,
} from '@/features/trip-workspace/commitment-installment-sequence';
import {
  tripCommitmentCategories,
} from './trip-commitment-categories';

type CommitmentInstallmentPlanCardProps = {
  plan: TripCommitmentInstallmentPlanSummary;
  isRtl: boolean;
  locale: 'ar' | 'en';
  currency: string;
  onMarkPaid: (
    item:
      TripCommitmentInstallmentPlanSummary['items'][number],
  ) => void;
  onReviewPaidImpact: (
    item:
      TripCommitmentInstallmentPlanSummary['items'][number],
  ) => void;
  onDeletePlan: (planId: string) => void;
};

export function CommitmentInstallmentPlanCard({
  plan,
  isRtl,
  locale,
  currency,
  onMarkPaid,
  onReviewPaidImpact,
  onDeletePlan,
}: CommitmentInstallmentPlanCardProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const [expanded, setExpanded] =
    useState(false);
  const [menuOpen, setMenuOpen] =
    useState(false);
  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';
  const category =
    tripCommitmentCategories.find(
      (item) => item.id === plan.categoryId,
    );

  return (
    <>
      <JzGlassPanel
      tone="surface"
      style={[
        styles.card,
        {
          borderColor:
            'rgba(245,185,76,0.28)',
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
            styles.icon,
            {
              backgroundColor:
                palette.warningSurface,
            },
          ]}
        >
          <JzIcon
            name={category?.icon ?? 'receipt'}
            size={20}
            color="#F5B94C"
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
              color: '#F5B94C',
              fontWeight: '800',
            }}
          >
            {t('commitmentInstallmentPlan')}
          </JzText>

          <JzText
            variant="title"
            textDirection={textDirection}
            numberOfLines={1}
            style={{
              color: palette.textPrimary,
            }}
          >
            {plan.title}
          </JzText>

          <JzText
            variant="caption"
            textDirection={textDirection}
            numberOfLines={1}
            style={{
              color: '#F5B94C',
              fontWeight: '700',
            }}
          >
            {t(
              'commitmentInstallmentCadenceSummary',
              {
                frequency: t(
                  plan.cadence === 'biweekly'
                    ? 'commitmentInstallmentBiweekly'
                    : 'commitmentInstallmentMonthly',
                ),
                count: plan.installmentCount,
              },
            )}
          </JzText>

          <JzText
            variant="caption"
            textDirection={textDirection}
            numberOfLines={1}
            style={{
              color: palette.textMuted,
            }}
          >
            {t('commitmentInstallmentProgress', {
              paid: plan.paidCount,
              count: plan.installmentCount,
            })}
          </JzText>
        </YStack>

        <YStack
          alignItems={isRtl ? 'flex-start' : 'flex-end'}
          gap={2}
        >
          <JzText
            variant="title"
            textDirection="ltr"
            style={{
              color: palette.textPrimary,
            }}
          >
            {formatMoney(
              plan.remainingAmount,
              locale,
              currency,
            )}
          </JzText>

          <JzText
            variant="caption"
            textDirection={textDirection}
            style={{
              color: palette.textMuted,
            }}
          >
            {t('commitmentPlanRemaining')}
          </JzText>
        </YStack>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('moreActions')}
          onPress={() => {
            setMenuOpen(true);
            void Haptics.selectionAsync();
          }}
          style={[
            styles.moreButton,
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

      <XStack
        flexDirection={direction}
        gap={spacing[2]}
      >
        <View
          style={[
            styles.metric,
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
              color: palette.textMuted,
            }}
          >
            {t('commitmentsBeforeTravel')}
          </JzText>
          <JzText
            variant="bodySmall"
            textDirection="ltr"
            style={{
              color: '#F5B94C',
              fontWeight: '800',
            }}
          >
            {formatMoney(
              plan.dueBeforeTravelAmount,
              locale,
              currency,
            )}
          </JzText>
        </View>

        <View
          style={[
            styles.metric,
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
              color: palette.textMuted,
            }}
          >
            {t('nextCommitment')}
          </JzText>
          <JzText
            variant="bodySmall"
            textDirection="ltr"
            numberOfLines={1}
            style={{
              color: colors.sky500,
              fontWeight: '800',
            }}
          >
            {plan.nextDueDate ?? '—'}
          </JzText>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityState={{
            expanded,
          }}
          accessibilityLabel={
            expanded
              ? t('hideInstallments')
              : t('viewInstallments')
          }
          onPress={() => {
            setExpanded(
              (current) => !current,
            );
            void Haptics.selectionAsync();
          }}
          style={[
            styles.detailsButton,
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
              color: palette.textPrimary,
              fontWeight: '800',
            }}
          >
            {expanded
              ? t('hideInstallments')
              : t('viewInstallments')}
          </JzText>
        </Pressable>
      </XStack>

      {expanded ? (
        <YStack gap={spacing[2]}>
          <View
            style={[
              styles.separator,
              {
                backgroundColor:
                  palette.border,
              },
            ]}
          />

          {plan.items.map((item) => {
            const paid = item.status === 'paid';
            const canMarkPaid =
              !paid &&
              isCommitmentInstallmentStatusTransitionAllowed(
                plan.items,
                item.id,
                'paid',
              );

            return (
              <View
                key={item.id}
                style={[
                  styles.installmentRow,
                  {
                    backgroundColor:
                      palette.surfaceMuted,
                    borderColor:
                      palette.border,
                  },
                ]}
              >
                <XStack
                  flexDirection={direction}
                  alignItems="center"
                  gap={spacing[2]}
                >
                  <View
                    style={[
                      styles.numberBadge,
                      {
                        backgroundColor: paid
                          ? palette.successSurface
                          : palette.warningSurface,
                      },
                    ]}
                  >
                    <JzText
                      variant="caption"
                      textDirection="ltr"
                      style={{
                        color: paid
                          ? colors.mint600
                          : '#F5B94C',
                        fontWeight: '800',
                      }}
                    >
                      {`${item.installmentNumber}/${item.installmentCount}`}
                    </JzText>
                  </View>

                  <YStack
                    flex={1}
                    minWidth={0}
                    alignItems={align}
                    gap={2}
                  >
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
                        item.amount,
                        locale,
                        currency,
                      )}
                    </JzText>

                    <JzText
                      variant="caption"
                      textDirection="ltr"
                      style={{
                        color:
                          palette.textMuted,
                      }}
                    >
                      {item.dueDate ?? '—'}
                    </JzText>
                  </YStack>

                  <View
                    style={[
                      styles.status,
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
                          : '#F5B94C',
                        fontWeight: '800',
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
                </XStack>

                {!paid ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      'markCommitmentPaid',
                    )}
                    accessibilityState={{
                      disabled: !canMarkPaid,
                    }}
                    disabled={!canMarkPaid}
                    onPress={() =>
                      onMarkPaid(item)
                    }
                    style={[
                      styles.markPaidButton,
                      {
                        borderColor:
                          'rgba(48,214,162,0.34)',
                        backgroundColor:
                          palette.successSurface,
                        opacity:
                          canMarkPaid
                            ? 1
                            : 0.42,
                      },
                    ]}
                  >
                    <JzIcon
                      name="check"
                      size={16}
                      color={colors.mint600}
                      strokeWidth={2.2}
                    />
                    <JzText
                      variant="bodySmall"
                      textDirection={textDirection}
                      style={{
                        color: colors.mint600,
                        fontWeight: '800',
                      }}
                    >
                      {t(
                        'markCommitmentPaid',
                      )}
                    </JzText>
                  </Pressable>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      'commitmentPaidImpactAction',
                    )}
                    onPress={() =>
                      onReviewPaidImpact(item)
                    }
                    style={[
                      styles.markPaidButton,
                      {
                        borderColor:
                          'rgba(66,181,255,0.30)',
                        backgroundColor:
                          palette.infoSurface,
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
                )}
              </View>
            );
          })}


        </YStack>
      ) : null}
      </JzGlassPanel>

      <JzActionMenuSheet
        visible={menuOpen}
        title={plan.title}
        helper={t('commitmentInstallmentPlan')}
        isRtl={isRtl}
        onClose={() => setMenuOpen(false)}
        actions={[
          {
            key: 'delete-plan',
            label: t('deleteInstallmentPlan'),
            icon: 'delete' as const,
            tone: 'danger' as const,
            onPress: () =>
              onDeletePlan(plan.planId),
          },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing[3],
    padding: spacing[3],
    borderRadius: 21,
  },
  icon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  moreButton: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  metric: {
    flex: 1,
    minHeight: 62,
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: spacing[2],
    borderRadius: 15,
  },
  detailsButton: {
    minWidth: 88,
    minHeight: 62,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: spacing[2],
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  installmentRow: {
    gap: spacing[2],
    padding: spacing[3],
    borderRadius: 17,
    borderWidth: 1,
  },
  numberBadge: {
    minWidth: 48,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
  },
  status: {
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    paddingHorizontal: spacing[2],
  },
  markPaidButton: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: 14,
    borderWidth: 1,
  },
  deletePlan: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: 14,
    borderWidth: 1,
  },
});
