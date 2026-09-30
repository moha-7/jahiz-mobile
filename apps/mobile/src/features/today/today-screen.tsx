import { useMemo } from 'react';
import {
  type Href,
  useRouter,
} from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { XStack, YStack } from 'tamagui';
import { JzText } from '@jahiz/ui';
import {
  colors,
  radius,
  spacing,
} from '@jahiz/design-tokens';
import { JzCollapsibleScreen } from '@/components/jz-collapsible-screen';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import {
  buildJahizFocusHref,
  jahizFocusTargets,
  type JahizFocusTarget,
} from '@/features/navigation/deep-link-focus';
import {
  JzIcon,
  type JzIconName,
} from '@/components/jz-icon';
import {
  type JahizDecisionReason,
  type JahizTripLifecycle,
} from '@/features/moves/jahiz-decision-state';
import {
  buildJahizDecisionContext,
} from '@/features/moves/jahiz-decision-context';
import {
  useTripWorkspaceStore,
} from '@/features/trip-workspace';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import { formatMoney } from '@/utils/format-money';
import {
  calculateTodayFinancialCoverage,
  calculateTodayReadinessPreview,
} from './today-readiness-preview';

type SnapshotTone =
  | 'ready'
  | 'booking'
  | 'spending'
  | 'cost';

type SnapshotCardProps = {
  label: string;
  amount: string;
  icon: JzIconName;
  tone: SnapshotTone;
  isRtl: boolean;
};

function localTodayIso(): string {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(
    now.getMonth() + 1,
  ).padStart(2, '0');
  const day = String(
    now.getDate(),
  ).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

function snapshotVisual(
  tone: SnapshotTone,
  isDark: boolean,
) {
  switch (tone) {
    case 'ready':
      return {
        accent: '#30D6A2',
        surface: isDark
          ? 'rgba(48,214,162,0.10)'
          : 'rgba(48,214,162,0.07)',
        border: 'rgba(48,214,162,0.24)',
      };
    case 'booking':
      return {
        accent: '#45B8F5',
        surface: isDark
          ? 'rgba(69,184,245,0.10)'
          : 'rgba(69,184,245,0.07)',
        border: 'rgba(69,184,245,0.24)',
      };
    case 'spending':
      return {
        accent: '#A78BFA',
        surface: isDark
          ? 'rgba(167,139,250,0.10)'
          : 'rgba(167,139,250,0.07)',
        border: 'rgba(167,139,250,0.22)',
      };
    case 'cost':
      return {
        accent: '#45B8F5',
        surface: isDark
          ? 'rgba(69,184,245,0.10)'
          : 'rgba(69,184,245,0.07)',
        border: 'rgba(69,184,245,0.24)',
      };
  }
}

function SnapshotCard({
  label,
  amount,
  icon,
  tone,
  isRtl,
  onPress,
}: SnapshotCardProps & {
  onPress: () => void;
}) {
  const { isDark, palette } = useJahizTheme();
  const visual = snapshotVisual(tone, isDark);
  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.snapshotCard,
        {
          opacity: pressed ? 0.82 : 1,
          backgroundColor: visual.surface,
          borderColor: visual.border,
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
            styles.snapshotIcon,
            {
              backgroundColor: visual.surface,
              borderColor: visual.border,
            },
          ]}
        >
          <JzIcon
            name={icon}
            size={18}
            color={visual.accent}
            strokeWidth={2.15}
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
            numberOfLines={1}
            style={{
              color: palette.textSecondary,
            }}
          >
            {label}
          </JzText>

          <JzText
            variant="moneyMedium"
            textDirection="ltr"
            numberOfLines={1}
            adjustsFontSizeToFit
            style={{
              color: palette.textPrimary,
            }}
          >
            {amount}
          </JzText>
        </YStack>

        <JzIcon
          name="next"
          size={15}
          color={visual.accent}
          strokeWidth={2.1}
          isRtl={isRtl}
        />
      </XStack>
    </Pressable>
  );
}

function lifecycleAccent(
  lifecycle: JahizTripLifecycle,
): string {
  switch (lifecycle) {
    case 'last-day':
      return '#F5B94C';
    case 'completed':
      return '#30D6A2';
    case 'in-progress':
      return '#45B8F5';
    case 'pre-trip':
      return '#30D6A2';
    case 'unscheduled':
      return '#A7B6C7';
  }
}

function decisionIcon(
  reason: JahizDecisionReason,
): JzIconName {
  switch (reason) {
    case 'overdue-commitment':
      return 'receipt';
    case 'overdue-payment':
      return 'payments';
    case 'funding-gap':
      return 'money';
    case 'bookings-left':
      return 'payments';
    case 'plan-incomplete':
      return 'plan';
    case 'review-spending':
      return 'money';
    case 'review-moves':
      return 'next';
    case 'trip-complete':
      return 'check';
    case 'set-dates':
      return 'calendar';
  }
}

export function TodayScreen() {
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
  const todayIso = localTodayIso();
  const {
    summary,
    decision,
    spendingTotal,
    bookingRemainingTotal,
    paymentPlanCoverage,
  } = useMemo(
    () =>
      buildJahizDecisionContext(
        workspace,
        todayIso,
        t('payments'),
      ),
    [
      workspace,
      todayIso,
      t,
    ],
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

  const financialCoverage =
    calculateTodayFinancialCoverage({
      totalCost: summary.totalCost,
      remainingTotal:
        summary.remainingTotal,
      readyMoney: summary.readyMoney,
    });

  const readinessPreview =
    calculateTodayReadinessPreview({
      setupProgress:
        summary.progress.percentage,
      financialCoverage,
      commitmentsReviewed:
        workspace.commitmentsReviewed,
      paymentPlanCoverage,
    });

  const dashboardScore =
    readinessPreview.score;

  const preTripStatus =
    dashboardScore >= 85
      ? t('todayPreTripOnTrack')
      : dashboardScore >= 65
        ? t('todayPreTripBuilding')
        : t('todayPreTripNeedsAttention');

  const route = workspace.route;
  const routeLabel = route
    ? `${route.origin.airportCode} → ${route.destination.airportCode}`
    : t('noActiveTrip');

  const statusTitle =
    decision.lifecycle === 'pre-trip'
      ? preTripStatus
      : decision.lifecycle === 'in-progress'
        ? t('todayTripInProgress')
        : decision.lifecycle === 'last-day'
          ? t('todayTripLastDay')
          : decision.lifecycle === 'completed'
            ? t('todayTripComplete')
            : t('todayTripNotScheduled');

  const statusHelper =
    workspace.dates.departureDate &&
    workspace.dates.returnDate
      ? t('todayRouteDates', {
          route: routeLabel,
          start:
            workspace.dates.departureDate,
          end: workspace.dates.returnDate,
        })
      : t('todayPlanProgress', {
          count:
            summary.progress.percentage,
        });

  const activeTripLabel =
    route
      ? decision.lifecycle === 'last-day'
        ? t('todayChipLastDay', {
            destination:
              route.destination.airportCode,
          })
        : decision.lifecycle === 'in-progress'
          ? t('todayChipInProgress', {
              destination:
                route.destination.airportCode,
              day:
                decision.dayNumber ?? 1,
              count:
                decision.totalDays ?? 1,
            })
          : decision.lifecycle === 'completed'
            ? t('todayChipCompleted', {
                destination:
                  route.destination.airportCode,
              })
            : decision.totalDays
              ? t('activeTripSummary', {
                  destination:
                    route.destination.airportCode,
                  count:
                    decision.totalDays,
                })
              : route.destination.airportCode
      : t('noActiveTrip');

  const money = (
    value: number,
  ) =>
    formatMoney(
      value,
      locale,
      workspace.currency,
    );

  function openFocusTarget(
    target: JahizFocusTarget,
  ) {
    void Haptics
      .selectionAsync()
      .catch(() => undefined);

    router.push(
      buildJahizFocusHref(
        target,
      ) as Href,
    );
  }

  function openNextMove() {
    switch (decision.reason) {
      case 'funding-gap':
        openFocusTarget(
          jahizFocusTargets.needToSave,
        );
        return;
      default:
        void Haptics
          .selectionAsync()
          .catch(() => undefined);

        router.push(
          decision.route as Href,
        );
    }
  }

  let nextMoveTitle: string;
  let nextMoveHelper: string;

  switch (decision.reason) {
    case 'overdue-commitment':
      nextMoveTitle =
        t('todayMoveOverdueCommitment');
      nextMoveHelper =
        decision.attention
          ? t('todayMoveOverdueHelper', {
              title:
                decision.attention.title,
              amount:
                money(
                  decision.attention.amount,
                ),
              date:
                decision.attention.dueDate,
            })
          : t('todayMoveReviewHelper');
      break;
    case 'overdue-payment':
      nextMoveTitle =
        t('todayMoveOverduePayment');
      nextMoveHelper =
        decision.attention
          ? t('todayMoveOverdueHelper', {
              title:
                decision.attention.title,
              amount:
                money(
                  decision.attention.amount,
                ),
              date:
                decision.attention.dueDate,
            })
          : t('todayMoveReviewHelper');
      break;
    case 'funding-gap':
      nextMoveTitle =
        t('todayMoveFundingGap', {
          amount:
            money(summary.needToSave),
        });
      nextMoveHelper =
        t('todayMoveFundingGapHelper');
      break;
    case 'bookings-left':
      nextMoveTitle =
        t('todayMoveBookingsLeft', {
          amount:
            money(
              bookingRemainingTotal,
            ),
        });
      nextMoveHelper =
        t('todayMoveBookingsHelper');
      break;
    case 'plan-incomplete':
      nextMoveTitle =
        t('todayMovePlanIncomplete');
      nextMoveHelper =
        t('todayMovePlanHelper', {
          count:
            summary.progress.percentage,
        });
      break;
    case 'review-spending':
      nextMoveTitle =
        t('todayMoveReviewSpending');
      nextMoveHelper =
        t('todayMoveSpendingHelper', {
          amount: money(spendingTotal),
        });
      break;
    case 'review-moves':
      nextMoveTitle =
        t('todayMoveReviewMoves');
      nextMoveHelper =
        t('todayMoveReviewHelper');
      break;
    case 'trip-complete':
      nextMoveTitle =
        t('todayMoveTripComplete');
      nextMoveHelper =
        t('todayMoveTripCompleteHelper');
      break;
    case 'set-dates':
      nextMoveTitle =
        t('todayMoveSetDates');
      nextMoveHelper =
        t('todayMoveSetDatesHelper');
      break;
  }

  const statusAccent =
    lifecycleAccent(decision.lifecycle);

  const statusMetric =
    decision.lifecycle === 'pre-trip'
      ? null
      : decision.lifecycle === 'in-progress' ||
          decision.lifecycle === 'last-day'
        ? {
            label:
              t('todayDayProgressLabel'),
            value:
              t('todayDayProgressValue', {
                day:
                  decision.dayNumber ?? 1,
                count:
                  decision.totalDays ?? 1,
              }),
          }
        : decision.lifecycle === 'completed'
          ? {
              label:
                t('todayDaysLabel'),
              value:
                String(
                  decision.totalDays ?? 0,
                ),
            }
          : {
              label:
                t('todayPlanLabel'),
              value:
                `${summary.progress.percentage}%`,
            };

  const firstSnapshot =
    decision.lifecycle === 'in-progress' ||
    decision.lifecycle === 'last-day'
      ? {
          label:
            t('todayOnTripBudgetLabel'),
          amount: money(spendingTotal),
          icon: 'money' as JzIconName,
          tone: 'spending' as SnapshotTone,
          target: {
            route: '/trip/create/costs',
            focus: 'costs',
          } as const,
        }
      : decision.lifecycle === 'completed'
        ? {
            label:
              t('todayTripCostLabel'),
            amount:
              money(summary.totalCost),
            icon: 'receipt' as JzIconName,
            tone: 'cost' as SnapshotTone,
            target: {
              route: '/trip/create/costs',
              focus: 'costs',
            } as const,
          }
        : {
            label:
              t('todayReadyMoneyLabel'),
            amount:
              money(summary.readyMoney),
            icon: 'money' as JzIconName,
            tone: 'ready' as SnapshotTone,
            target:
              jahizFocusTargets.readyMoney,
          };

  const secondSnapshot =
    decision.lifecycle === 'completed'
      ? {
          label:
            t('todayPaidBookingsLabel'),
          amount:
            money(summary.paidTotal),
          icon: 'payments' as JzIconName,
          tone: 'booking' as SnapshotTone,
          target:
            jahizFocusTargets.bookings,
        }
      : {
          label:
            t('todayBookingsLeftLabel'),
          amount:
            money(bookingRemainingTotal),
          icon: 'payments' as JzIconName,
          tone: 'booking' as SnapshotTone,
          target:
            jahizFocusTargets.bookings,
        };

  const hero = (
    <YStack
      paddingTop={spacing[3]}
      gap={spacing[3]}
    >
      <YStack
        alignItems={align}
        gap={2}
      >
        <JzText
          variant="bodySmall"
          textDirection={textDirection}
          style={{
            color: palette.heroSecondary,
          }}
        >
          {t('goodMorning')}
        </JzText>

        <JzText
          variant="heading1"
          textDirection={textDirection}
          style={{
            color: palette.heroText,
          }}
        >
          {`${t('userFirstName')} \u{1F44B}`}
        </JzText>
      </YStack>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={activeTripLabel}
        onPress={() =>
          router.push('/trip/manage' as Href)
        }
        style={[
          styles.tripChip,
          {
            alignSelf: align,
            flexDirection: direction,
            borderColor:
              'rgba(48,214,162,0.28)',
            backgroundColor:
              palette.backgroundElevated,
          },
        ]}
      >
        <JzIcon
          name="origin"
          size={15}
          color={colors.mint600}
          strokeWidth={2.2}
        />

        <JzText
          variant="caption"
          textDirection={textDirection}
          style={{
            color: palette.heroText,
          }}
        >
          {activeTripLabel}
        </JzText>

        <JzText
          variant="caption"
          textDirection={textDirection}
          style={{
            color: colors.mint600,
            fontWeight: '800',
          }}
        >
          {t('tripsShort')}
        </JzText>

        <JzIcon
          name="next"
          size={14}
          color={colors.mint600}
          strokeWidth={2.1}
          isRtl={isRtl}
        />
      </Pressable>
    </YStack>
  );

  return (
    <JzCollapsibleScreen
      isRtl={isRtl}
      brandLabel={t('brandName')}
      tagline={t('appTagline')}
      notificationLabel={t('notifications')}
      profileLabel={t('profile')}
      hero={hero}
      heroHeight={218}
      bodyOverlap={22}
      contentColor={palette.background}
      bodyStyle={[
        styles.body,
        {
          backgroundColor:
            palette.background,
        },
      ]}
      bottomPadding={188}
      onNotificationsPress={() =>
        void Haptics.selectionAsync()
      }
      onProfilePress={() =>
        router.push('/profile')
      }
    >
      <JzGlassPanel
        tone="dark"
        style={[
          styles.statusCard,
          {
            borderColor:
              `${statusAccent}44`,
          },
        ]}
      >
        <XStack
          flexDirection={direction}
          alignItems="center"
          justifyContent="space-between"
          gap={spacing[4]}
        >
          <YStack
            flex={1}
            minWidth={0}
            alignItems={align}
            gap={spacing[2]}
          >
            <XStack
              flexDirection={direction}
              alignItems="center"
              gap={spacing[2]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      statusAccent,
                  },
                ]}
              />

              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: statusAccent,
                  fontWeight: '800',
                }}
              >
                {decision.showReadinessScore
                  ? t('todayReadiness')
                  : t('todayTripStatus')}
              </JzText>
            </XStack>

            <JzText
              variant="heading1"
              color={colors.surface}
              textDirection={textDirection}
            >
              {statusTitle}
            </JzText>

            <JzText
              variant="bodySmall"
              color="#AFC0D1"
              textDirection={textDirection}
            >
              {statusHelper}
            </JzText>
          </YStack>

          {decision.showReadinessScore ? (
            <View style={styles.scoreRing}>
              <JzText
                variant="heading2"
                color={colors.surface}
                textDirection="ltr"
              >
                {dashboardScore}
              </JzText>
              <JzText
                variant="caption"
                color="#AFC0D1"
                textDirection="ltr"
              >
                /100
              </JzText>
            </View>
          ) : statusMetric ? (
            <YStack
              alignItems={align}
              gap={2}
              style={styles.statusMetric}
            >
              <JzText
                variant="moneyMedium"
                textDirection="ltr"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: colors.surface,
                }}
              >
                {statusMetric.value}
              </JzText>

              <JzText
                variant="caption"
                textDirection={textDirection}
                numberOfLines={2}
                style={{
                  color: '#AFC0D1',
                }}
              >
                {statusMetric.label}
              </JzText>
            </YStack>
          ) : null}
        </XStack>
      </JzGlassPanel>

      <YStack gap={spacing[2]}>
        <JzText
          variant="heading2"
          textDirection={textDirection}
          style={{
            color: palette.textPrimary,
          }}
        >
          {t('todayYourNextMove')}
        </JzText>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={nextMoveTitle}
          onPress={openNextMove}
          style={({ pressed }) => ({
            opacity: pressed ? 0.82 : 1,
          })}
        >
          <JzGlassPanel
            tone={
              decision.severity ===
              'attention'
                ? 'surface'
                : 'mint'
            }
            style={[
              styles.nextMoveCard,
              decision.severity ===
              'attention'
                ? {
                    borderColor:
                      'rgba(245,185,76,0.34)',
                  }
                : null,
            ]}
          >
            <XStack
              flexDirection={direction}
              alignItems="center"
              gap={spacing[3]}
            >
              <View
                style={[
                  styles.nextMoveIcon,
                  {
                    backgroundColor:
                      decision.severity ===
                      'attention'
                        ? 'rgba(245,185,76,0.12)'
                        : palette.successSurface,
                  },
                ]}
              >
                <JzIcon
                  name={decisionIcon(
                    decision.reason,
                  )}
                  size={22}
                  color={
                    decision.severity ===
                    'attention'
                      ? '#F5B94C'
                      : colors.mint600
                  }
                  strokeWidth={2.15}
                  isRtl={isRtl}
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
                  numberOfLines={2}
                  style={{
                    color:
                      palette.textPrimary,
                  }}
                >
                  {nextMoveTitle}
                </JzText>

                <JzText
                  variant="bodySmall"
                  textDirection={textDirection}
                  numberOfLines={3}
                  style={{
                    color:
                      palette.textSecondary,
                  }}
                >
                  {nextMoveHelper}
                </JzText>
              </YStack>

              <JzIcon
                name="next"
                size={18}
                color={
                  decision.severity ===
                  'attention'
                    ? '#F5B94C'
                    : colors.mint600
                }
                strokeWidth={2.2}
                isRtl={isRtl}
              />
            </XStack>
          </JzGlassPanel>
        </Pressable>
      </YStack>

      <YStack gap={spacing[2]}>
        <JzText
          variant="heading2"
          textDirection={textDirection}
          style={{
            color: palette.textPrimary,
          }}
        >
          {t('todaySnapshotTitle')}
        </JzText>

        <View style={styles.snapshotGrid}>
          <SnapshotCard
            label={firstSnapshot.label}
            amount={firstSnapshot.amount}
            icon={firstSnapshot.icon}
            tone={firstSnapshot.tone}
            isRtl={isRtl}
            onPress={() =>
              openFocusTarget(
                firstSnapshot.target,
              )
            }
          />

          <SnapshotCard
            label={secondSnapshot.label}
            amount={secondSnapshot.amount}
            icon={secondSnapshot.icon}
            tone={secondSnapshot.tone}
            isRtl={isRtl}
            onPress={() =>
              openFocusTarget(
                secondSnapshot.target,
              )
            }
          />
        </View>
      </YStack>

      <XStack
        flexDirection={direction}
        gap={spacing[2]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(
            'todayViewPlan',
          )}
          onPress={() =>
            router.push('/plan')
          }
          style={({ pressed }) => [
            styles.secondaryAction,
            {
              opacity:
                pressed ? 0.78 : 1,
              borderColor:
                palette.borderStrong,
              backgroundColor:
                palette.surfaceMuted,
            },
          ]}
        >
          <JzIcon
            name="plan"
            size={18}
            color={palette.textPrimary}
            strokeWidth={2.1}
          />
          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            numberOfLines={1}
            style={{
              color: palette.textPrimary,
              fontWeight: '800',
            }}
          >
            {t('todayViewPlan')}
          </JzText>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t(
            'todaySeeMoves',
          )}
          onPress={() =>
            router.push('/moves')
          }
          style={({ pressed }) => [
            styles.secondaryAction,
            {
              opacity:
                pressed ? 0.78 : 1,
              borderColor:
                'rgba(48,214,162,0.26)',
              backgroundColor:
                palette.successSurface,
            },
          ]}
        >
          <JzIcon
            name="next"
            size={18}
            color={colors.mint600}
            strokeWidth={2.15}
            isRtl={isRtl}
          />
          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            numberOfLines={1}
            style={{
              color: colors.mint600,
              fontWeight: '800',
            }}
          >
            {t('todaySeeMoves')}
          </JzText>
        </Pressable>
      </XStack>
    </JzCollapsibleScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[4],
  },
  tripChip: {
    minHeight: 38,
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  statusCard: {
    padding: spacing[4],
    gap: spacing[3],
    borderRadius: 26,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  scoreRing: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 8,
    borderColor:
      'rgba(48,214,162,0.52)',
    backgroundColor:
      'rgba(3,15,27,0.70)',
  },
  statusMetric: {
    width: 132,
    minWidth: 112,
  },
  nextMoveCard: {
    padding: spacing[4],
    borderRadius: 24,
  },
  nextMoveIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  snapshotGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing[2],
  },
  snapshotCard: {
    flex: 1,
    minWidth: 0,
    minHeight: 92,
    justifyContent: 'center',
    padding: spacing[3],
    borderRadius: 19,
    borderWidth: 1,
  },
  snapshotIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryAction: {
    flex: 1,
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 16,
    borderWidth: 1,
  },
});
