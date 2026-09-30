import {
  useEffect,
  useMemo,
  useState,
} from 'react';
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
import {
  buildMoveTripRecommendation,
} from '@jahiz/api-contracts';
import { JzCollapsibleScreen } from '@/components/jz-collapsible-screen';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import {
  JzIcon,
  type JzIconName,
} from '@/components/jz-icon';
import {
  buildJahizDecisionContext,
} from '@/features/moves/jahiz-decision-context';
import {
  buildJahizMoveCandidates,
  rankJahizMoves,
  type JahizMoveKind,
  type JahizMoveRole,
  type JahizRankedMove,
} from '@/features/moves/jahiz-move-engine';
import {
  resolveJahizMoveTimingGuidance,
  type JahizMoveTimingGuidance,
} from '@/features/moves/jahiz-move-timing-guidance';
import {
  useTripWorkspaceStore,
} from '@/features/trip-workspace';
import {
  getJahizProductMetricsStore,
} from '@/features/product-metrics/jahiz-product-metrics-secure-store';
import {
  isJahizProductMetricsEnabled,
} from '@/features/product-metrics/jahiz-product-metrics-observer';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import { formatMoney } from '@/utils/format-money';

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

function formatTripDate(
  value: string,
  locale: 'ar' | 'en',
): string {
  const [year, month, day] =
    value.split('-').map(Number);

  const date = new Date(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 1,
  );

  return new Intl.DateTimeFormat(
    locale === 'ar'
      ? 'ar-AE'
      : 'en-US',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
}

function roleKey(
  role: JahizMoveRole,
):
  | 'movesBestMove'
  | 'movesQuickWin'
  | 'movesNextMove' {
  switch (role) {
    case 'best-move':
      return 'movesBestMove';
    case 'quick-win':
      return 'movesQuickWin';
    case 'next-move':
      return 'movesNextMove';
  }
}

function moveIcon(
  kind: JahizMoveKind,
): JzIconName {
  switch (kind) {
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

function lifecycleKey(
  lifecycle:
    | 'unscheduled'
    | 'pre-trip'
    | 'in-progress'
    | 'last-day'
    | 'completed',
):
  | 'movesLifecycleUnscheduled'
  | 'movesLifecyclePreTrip'
  | 'movesLifecycleInProgress'
  | 'movesLifecycleLastDay'
  | 'movesLifecycleCompleted' {
  switch (lifecycle) {
    case 'unscheduled':
      return 'movesLifecycleUnscheduled';
    case 'pre-trip':
      return 'movesLifecyclePreTrip';
    case 'in-progress':
      return 'movesLifecycleInProgress';
    case 'last-day':
      return 'movesLifecycleLastDay';
    case 'completed':
      return 'movesLifecycleCompleted';
  }
}

function TimingGuidanceCard({
  guidance,
  money,
  locale,
  isRtl,
  onReviewDates,
}: {
  guidance: JahizMoveTimingGuidance;
  money: (value: number) => string;
  locale: 'ar' | 'en';
  isRtl: boolean;
  onReviewDates: () => void;
}) {
  const { palette } = useJahizTheme();
  const { t } = useJahizLocale();

  if (guidance.kind === 'hidden') {
    return null;
  }

  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';
  const isBetter =
    guidance.kind === 'better-timing';

  const title =
    guidance.kind === 'better-timing'
      ? t('timingRecommendationTitle')
      : guidance.kind === 'fixed'
        ? t('timingFixedTitle')
        : t('timingNoKnownImprovementTitle');

  const helper =
    guidance.kind === 'fixed'
      ? t('timingFixedHelper')
      : guidance.kind ===
          'no-known-improvement'
        ? t('timingNoKnownImprovementHelper')
        : t('timingRecommendationHelper');

  return (
    <JzGlassPanel
      tone={isBetter ? 'mint' : 'surface'}
      style={[
        styles.timingCard,
        {
          borderColor: isBetter
            ? 'rgba(48,214,162,0.30)'
            : palette.borderStrong,
        },
      ]}
    >
      <YStack
        alignItems={align}
        gap={spacing[3]}
      >
        <XStack
          flexDirection={direction}
          alignItems="center"
          gap={spacing[3]}
        >
          <View
            style={[
              styles.moveIcon,
              {
                backgroundColor:
                  isBetter
                    ? palette.successSurface
                    : palette.surfaceMuted,
              },
            ]}
          >
            <JzIcon
              name="calendar"
              size={22}
              color={
                isBetter
                  ? colors.mint600
                  : palette.textPrimary
              }
              strokeWidth={2.15}
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
                color: isBetter
                  ? colors.mint600
                  : palette.textSecondary,
                fontWeight: '800',
                letterSpacing: 0.6,
              }}
            >
              {t('knownCashFlow')}
            </JzText>

            <JzText
              variant="title"
              textDirection={textDirection}
              style={{
                color: palette.textPrimary,
              }}
            >
              {title}
            </JzText>
          </YStack>
        </XStack>

        {guidance.kind ===
        'better-timing' ? (
          <>
            <JzText
              variant="body"
              textDirection={textDirection}
              style={{
                color: palette.textPrimary,
                fontWeight: '800',
              }}
            >
              {t('moveTripLater', {
                count: guidance.offsetDays,
              })}
            </JzText>

            <JzText
              variant="bodySmall"
              textDirection={textDirection}
              style={{
                color: palette.textSecondary,
              }}
            >
              {t('proposedDepartureDate', {
                date: formatTripDate(
                  guidance.proposedDepartureDate,
                  locale,
                ),
              })}
            </JzText>

            <View
              style={[
                styles.detailBox,
                {
                  alignSelf: 'stretch',
                  backgroundColor:
                    palette.surfaceMuted,
                  borderColor:
                    palette.border,
                },
              ]}
            >
              <YStack
                alignItems={align}
                gap={spacing[2]}
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
                  {t('knownImprovement')}
                </JzText>

                <JzText
                  variant="heading2"
                  textDirection={textDirection}
                  style={{
                    color: colors.mint600,
                  }}
                >
                  {money(
                    guidance.knownImprovement,
                  )}
                </JzText>


              </YStack>
            </View>

            {guidance.repricingUnknown ? (
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: palette.textSecondary,
                }}
              >
                {t(
                  'tripRepricingUnknownShort',
                )}
              </JzText>
            ) : null}
          </>
        ) : null}

        <JzText
          variant="bodySmall"
          textDirection={textDirection}
          style={{
            color: palette.textSecondary,
          }}
        >
          {helper}
        </JzText>

        <Pressable
          accessibilityRole="button"
          onPress={onReviewDates}
          style={({ pressed }) => [
            styles.timingAction,
            {
              opacity: pressed
                ? 0.8
                : 1,
              backgroundColor:
                isBetter
                  ? colors.mint600
                  : palette.textPrimary,
            },
          ]}
        >
          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            style={{
              color: isBetter
                ? colors.navy950
                : palette.background,
              fontWeight: '800',
            }}
          >
            {t('reviewTripDates')}
          </JzText>

          <JzIcon
            name="next"
            size={16}
            color={
              isBetter
                ? colors.navy950
                : palette.background
            }
            strokeWidth={2.2}
            isRtl={isRtl}
          />
        </Pressable>
      </YStack>
    </JzGlassPanel>
  );
}

function MoveCard({
  move,
  isExpanded,
  onToggle,
  onOpen,
  title,
  helper,
  why,
  role,
  isRtl,
}: {
  move: JahizRankedMove;
  isExpanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
  title: string;
  helper: string;
  why: string;
  role: string;
  isRtl: boolean;
}) {
  const { palette } = useJahizTheme();
  const { t } = useJahizLocale();
  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';
  const isBest =
    move.role === 'best-move';

  return (
    <JzGlassPanel
      tone={isBest ? 'mint' : 'surface'}
      style={[
        styles.moveCard,
        isBest
          ? styles.bestMoveCard
          : null,
        {
          borderColor: isBest
            ? 'rgba(48,214,162,0.30)'
            : palette.borderStrong,
        },
      ]}
    >
      <YStack gap={spacing[3]}>
        <XStack
          flexDirection={direction}
          alignItems="center"
          gap={spacing[3]}
        >
          <View
            style={[
              styles.moveIcon,
              {
                backgroundColor:
                  isBest
                    ? palette.successSurface
                    : palette.surfaceMuted,
              },
            ]}
          >
            <JzIcon
              name={moveIcon(move.kind)}
              size={22}
              color={
                isBest
                  ? colors.mint600
                  : palette.textPrimary
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
              variant="caption"
              textDirection={textDirection}
              style={{
                color: isBest
                  ? colors.mint600
                  : palette.textSecondary,
                fontWeight: '800',
                letterSpacing: 0.6,
              }}
            >
              {role}
            </JzText>

            <JzText
              variant={
                isBest
                  ? 'heading2'
                  : 'title'
              }
              textDirection={textDirection}
              numberOfLines={2}
              style={{
                color: palette.textPrimary,
              }}
            >
              {title}
            </JzText>
          </YStack>
        </XStack>

        <JzText
          variant="bodySmall"
          textDirection={textDirection}
          style={{
            color: palette.textSecondary,
          }}
        >
          {helper}
        </JzText>

        {isExpanded ? (
          <View
            style={[
              styles.detailBox,
              {
                backgroundColor:
                  palette.surfaceMuted,
                borderColor:
                  palette.border,
              },
            ]}
          >
            <YStack
              alignItems={align}
              gap={spacing[2]}
            >
              <JzText
                variant="caption"
                textDirection={textDirection}
                style={{
                  color: palette.textSecondary,
                  fontWeight: '800',
                }}
              >
                {t('movesWhyTitle')}
              </JzText>

              <JzText
                variant="bodySmall"
                textDirection={textDirection}
                style={{
                  color: palette.textPrimary,
                }}
              >
                {why}
              </JzText>
            </YStack>
          </View>
        ) : null}

        <XStack
          flexDirection={direction}
          gap={spacing[2]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={onOpen}
            style={({ pressed }) => [
              styles.primaryAction,
              {
                opacity:
                  pressed ? 0.8 : 1,
                backgroundColor:
                  isBest
                    ? colors.mint600
                    : palette.textPrimary,
              },
            ]}
          >
            <JzText
              variant="bodySmall"
              textDirection={textDirection}
              style={{
                color: isBest
                  ? colors.navy950
                  : palette.background,
                fontWeight: '800',
              }}
            >
              {t('movesReviewAction')}
            </JzText>

            <JzIcon
              name="next"
              size={16}
              color={
                isBest
                  ? colors.navy950
                  : palette.background
              }
              strokeWidth={2.2}
              isRtl={isRtl}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={onToggle}
            style={({ pressed }) => [
              styles.detailAction,
              {
                opacity:
                  pressed ? 0.75 : 1,
                borderColor:
                  palette.borderStrong,
              },
            ]}
          >
            <JzText
              variant="caption"
              textDirection={textDirection}
              style={{
                color: palette.textSecondary,
                fontWeight: '800',
              }}
            >
              {isExpanded
                ? t('movesLessAction')
                : t('movesWhyAction')}
            </JzText>
          </Pressable>
        </XStack>
      </YStack>
    </JzGlassPanel>
  );
}

export function MovesScreen() {
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
  const [expandedId, setExpandedId] =
    useState<string | null>(null);

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

  const timingRecommendation =
    useMemo(() => {
      const hasDates = Boolean(
        workspace.dates.departureDate &&
          workspace.dates.returnDate,
      );

      if (
        decision.lifecycle !== 'pre-trip' ||
        summary.progress.percentage < 100 ||
        !hasDates ||
        workspace.dates.flexibility !==
          'flexible'
      ) {
        return null;
      }

      return buildMoveTripRecommendation(
        workspace,
        [7, 14, 30],
        todayIso,
      );
    }, [
      decision.lifecycle,
      summary.progress.percentage,
      todayIso,
      workspace,
    ]);

  const timingGuidance =
    resolveJahizMoveTimingGuidance({
      lifecycle: decision.lifecycle,
      planProgress:
        summary.progress.percentage,
      hasDates: Boolean(
        workspace.dates.departureDate &&
          workspace.dates.returnDate,
      ),
      flexibility:
        workspace.dates.flexibility,
      recommendation:
        timingRecommendation,
    });

  const timingGuidanceKind =
    timingGuidance.kind;

  useEffect(() => {
    if (
      timingGuidanceKind !==
        'better-timing' ||
      !isJahizProductMetricsEnabled()
    ) {
      return;
    }

    void getJahizProductMetricsStore()
      .record({
        name:
          'timing_better_available',
      });
  }, [timingGuidanceKind]);

  const moves = rankJahizMoves(
    buildJahizMoveCandidates({
      decision,
      planProgress:
        summary.progress.percentage,
      needToSave:
        summary.needToSave,
      bookingRemainingTotal,
      paymentPlanCoverage,
      onTripBudget: spendingTotal,
    }),
  );

  const money = (value: number) =>
    formatMoney(
      value,
      locale,
      workspace.currency,
    );

  const moveCopy = (
    move: JahizRankedMove,
  ): {
    title: string;
    helper: string;
  } => {
    switch (move.kind) {
      case 'overdue-commitment':
        return {
          title:
            t('movesOverdueCommitmentTitle'),
          helper:
            decision.attention
              ? t(
                  'movesOverdueCommitmentHelper',
                  {
                    title:
                      decision.attention
                        .title,
                    amount:
                      money(
                        decision.attention
                          .amount,
                      ),
                    date:
                      decision.attention
                        .dueDate,
                  },
                )
              : t('movesGenericHelper'),
        };
      case 'overdue-payment':
        return {
          title:
            t('movesOverduePaymentTitle'),
          helper:
            decision.attention
              ? t(
                  'movesOverduePaymentHelper',
                  {
                    title:
                      decision.attention
                        .title,
                    amount:
                      money(
                        decision.attention
                          .amount,
                      ),
                    date:
                      decision.attention
                        .dueDate,
                  },
                )
              : t('movesGenericHelper'),
        };
      case 'funding-gap':
        return {
          title: t('movesFundingGapTitle', {
            amount:
              money(
                move.impactAmount ?? 0,
              ),
          }),
          helper:
            t('movesFundingGapHelper'),
        };
      case 'bookings-left':
        return {
          title:
            move.impactAmount
              ? t('movesBookingsTitle', {
                  amount:
                    money(
                      move.impactAmount,
                    ),
                })
              : t(
                  'movesBookingsGenericTitle',
                ),
          helper:
            t('movesBookingsHelper'),
        };
      case 'plan-incomplete':
        return {
          title:
            t('movesPlanIncompleteTitle'),
          helper:
            t('movesPlanIncompleteHelper', {
              count:
                summary.progress
                  .percentage,
            }),
        };
      case 'review-spending':
        return {
          title:
            t('movesSpendingTitle'),
          helper:
            t('movesSpendingHelper', {
              amount:
                money(
                  move.impactAmount ?? 0,
                ),
            }),
        };
      case 'review-moves':
        return {
          title:
            t('movesCoveredTitle'),
          helper:
            t('movesCoveredHelper'),
        };
      case 'trip-complete':
        return {
          title:
            t('movesTripCompleteTitle'),
          helper:
            t('movesTripCompleteHelper'),
        };
      case 'set-dates':
        return {
          title:
            t('movesSetDatesTitle'),
          helper:
            t('movesSetDatesHelper'),
        };
    }
  };

  const moveWhyCopy = (
    move: JahizRankedMove,
  ): string => {
    switch (move.kind) {
      case 'overdue-commitment':
        return decision.attention
          ? t(
              'movesWhyOverdueCommitment',
              {
                title:
                  decision.attention.title,
                amount:
                  money(
                    decision.attention.amount,
                  ),
                date:
                  decision.attention.dueDate,
              },
            )
          : t('movesWhyKnownFacts');

      case 'overdue-payment':
        return decision.attention
          ? t(
              'movesWhyOverduePayment',
              {
                title:
                  decision.attention.title,
                amount:
                  money(
                    decision.attention.amount,
                  ),
                date:
                  decision.attention.dueDate,
              },
            )
          : t('movesWhyKnownFacts');

      case 'funding-gap':
        return t(
          'movesWhyFundingGap',
          {
            amount:
              money(
                move.impactAmount ?? 0,
              ),
          },
        );

      case 'bookings-left':
        return move.impactAmount
          ? t(
              'movesWhyBookingsLeft',
              {
                amount:
                  money(
                    move.impactAmount,
                  ),
              },
            )
          : t(
              'movesWhyBookingsCoverage',
            );

      case 'plan-incomplete':
        return t(
          'movesWhyPlanIncomplete',
          {
            count:
              summary.progress
                .percentage,
          },
        );

      case 'review-spending':
        return t(
          'movesWhyReviewSpending',
          {
            amount:
              money(
                move.impactAmount ?? 0,
              ),
          },
        );

      case 'review-moves':
        return t(
          'movesWhyReviewMoves',
        );

      case 'trip-complete':
        return t(
          'movesWhyTripComplete',
        );

      case 'set-dates':
        return t(
          'movesWhySetDates',
        );
    }
  };

  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const align = isRtl
    ? 'flex-end'
    : 'flex-start';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  const hero = (
    <YStack
      paddingTop={spacing[4]}
      paddingBottom={spacing[4]}
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
            styles.heroIcon,
            {
              backgroundColor:
                palette.successSurface,
              borderColor:
                palette.borderStrong,
            },
          ]}
        >
          <JzIcon
            name="next"
            size={24}
            color={colors.mint600}
            strokeWidth={2.2}
            isRtl={isRtl}
          />
        </View>

        <JzText
          variant="heading1"
          textDirection={textDirection}
          style={{
            color: palette.heroText,
          }}
        >
          {t('movesTitle')}
        </JzText>
      </XStack>

      <JzText
        textDirection={textDirection}
        style={{
          color: palette.heroSecondary,
        }}
      >
        {t('movesTagline')}
      </JzText>
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
      heroHeight={194}
      bodyOverlap={14}
      contentColor={palette.background}
      bodyStyle={[
        styles.body,
        {
          backgroundColor:
            palette.background,
        },
      ]}
      bottomPadding={136}
      onProfilePress={() =>
        router.push('/profile')
      }
    >
      <YStack
        alignItems={align}
        gap={spacing[2]}
      >
        <View
          style={[
            styles.lifecycleChip,
            {
              alignSelf: align,
              flexDirection: direction,
              backgroundColor:
                palette.surfaceMuted,
              borderColor:
                palette.borderStrong,
            },
          ]}
        >
          <View
            style={[
              styles.lifecycleDot,
              {
                backgroundColor:
                  colors.mint600,
              },
            ]}
          />

          <JzText
            variant="caption"
            textDirection={textDirection}
            style={{
              color: palette.textSecondary,
              fontWeight: '800',
            }}
          >
            {t(
              lifecycleKey(
                decision.lifecycle,
              ),
            )}
          </JzText>
        </View>

        <JzText
          variant="heading2"
          textDirection={textDirection}
          style={{
            color: palette.textPrimary,
          }}
        >
          {t('movesUsefulTitle')}
        </JzText>

        <JzText
          variant="bodySmall"
          textDirection={textDirection}
          style={{
            color: palette.textSecondary,
          }}
        >
          {t('movesUsefulHelper', {
            count: moves.length,
          })}
        </JzText>
      </YStack>

      <YStack gap={spacing[3]}>
        {moves.map((move) => {
          const copy = moveCopy(move);
          const why = moveWhyCopy(move);

          return (
            <MoveCard
              key={move.id}
              move={move}
              isExpanded={
                expandedId === move.id
              }
              onToggle={() => {
                void Haptics.selectionAsync();

                const opening =
                  expandedId !== move.id;

                if (
                  opening &&
                  isJahizProductMetricsEnabled()
                ) {
                  void getJahizProductMetricsStore()
                    .record({
                      name:
                        'why_move_opened',
                    });
                }

                setExpandedId(
                  opening
                    ? move.id
                    : null,
                );
              }}
              onOpen={() => {
                void Haptics.selectionAsync();

                if (
                  move.route === '/moves'
                ) {
                  setExpandedId(move.id);
                  return;
                }

                router.push(
                  move.route as Href,
                );
              }}
              title={copy.title}
              helper={copy.helper}
              why={why}
              role={t(roleKey(move.role))}
              isRtl={isRtl}
            />
          );
        })}
      </YStack>

      <TimingGuidanceCard
        guidance={timingGuidance}
        money={money}
        locale={locale}
        isRtl={isRtl}
        onReviewDates={() => {
          void Haptics.selectionAsync();

          if (
            timingGuidance.kind ===
              'better-timing' &&
            isJahizProductMetricsEnabled()
          ) {
            void getJahizProductMetricsStore()
              .record({
                name:
                  'timing_review_dates_opened',
              });
          }

          router.push(
            '/trip/create/dates' as Href,
          );
        }}
      />

      <View
        style={[
          styles.truthNote,
          {
            flexDirection: direction,
            backgroundColor:
              palette.surfaceMuted,
            borderColor: palette.border,
          },
        ]}
      >
        <JzIcon
          name="info"
          size={18}
          color={colors.sky500}
          strokeWidth={2.1}
        />

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
              color: palette.textPrimary,
              fontWeight: '800',
            }}
          >
            {t('movesTruthTitle')}
          </JzText>

          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            style={{
              color: palette.textSecondary,
            }}
          >
            {t('movesTruthNote')}
          </JzText>
        </YStack>
      </View>
    </JzCollapsibleScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: spacing[4],
    paddingTop: spacing[5],
    gap: spacing[4],
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lifecycleChip: {
    minHeight: 32,
    alignItems: 'center',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  lifecycleDot: {
    width: 7,
    height: 7,
    borderRadius: radius.full,
  },
  moveCard: {
    padding: spacing[4],
    borderRadius: 24,
    borderWidth: 1,
  },
  bestMoveCard: {
    padding: spacing[5],
  },
  moveIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailBox: {
    padding: spacing[3],
    borderRadius: 16,
    borderWidth: 1,
  },
  primaryAction: {
    minHeight: 46,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: 15,
    paddingHorizontal: spacing[3],
  },
  detailAction: {
    minHeight: 46,
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
    paddingHorizontal: spacing[3],
  },
  timingCard: {
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  timingAction: {
    minHeight: 46,
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: 15,
    paddingHorizontal: spacing[3],
  },
  truthNote: {
    gap: spacing[3],
    padding: spacing[4],
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
});
