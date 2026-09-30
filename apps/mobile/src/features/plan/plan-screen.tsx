import type { ReactNode } from 'react';
import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Pressable,
  StyleSheet,
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
import { JzCollapsibleScreen } from '@/components/jz-collapsible-screen';
import { JzGlassPanel } from '@/components/jz-glass-panel';
import { JzFocusHighlight } from '@/components/jz-focus-highlight';
import {
  buildJahizFocusHref,
  type JahizFocusKey,
  type JahizFocusRoute,
} from '@/features/navigation/deep-link-focus';
import {
  JzIcon,
  type JzIconName,
} from '@/components/jz-icon';
import { useJahizLocale } from '@/providers/locale-provider';
import { useJahizTheme } from '@/providers/theme-provider';
import {
  isPaymentTrackableCost,
  selectTripWindowCommitmentsTotal,
  selectCommitmentDisplayCount,
  selectNextTripWindowCommitmentGroup,
  selectNextPayment,
  selectNeedToSave,
  selectReadyMoneyBreakdown,
  selectTotalCost,
  selectTripProgress,
  selectTripSteps,
  useTripWorkspaceStore,
} from '@/features/trip-workspace';

type PlanStepKey =
  | 'dates'
  | 'money'
  | 'commitments'
  | 'costs'
  | 'payments';

type PlanNextStep = {
  title: string;
  helper: string;
  icon: JzIconName;
  href: JahizFocusRoute;
  focus: JahizFocusKey;
  entityId?: string;
};

type PlanStepCardProps = {
  stepKey: PlanStepKey;
  title: string;
  value: ReactNode;
  helper: string;
  detail: string;
  expandedContent?: ReactNode;
  icon: JzIconName;
  complete: boolean;
  expanded: boolean;
  isRtl: boolean;
  accent: string;
  tint: string;
  border: string;
  onToggle: () => void;
  onOpen: () => void;
};

function getTripDayCount(
  departureDate: string,
  returnDate: string,
): number {
  const departure = new Date(
    `${departureDate}T00:00:00.000Z`,
  );
  const returning = new Date(
    `${returnDate}T00:00:00.000Z`,
  );

  return Math.max(
    1,
    Math.round(
      (returning.getTime() - departure.getTime()) /
        86_400_000,
    ) + 1,
  );
}

function formatAmount(
  value: number,
  locale: 'ar' | 'en',
): string {
  return new Intl.NumberFormat(
    locale === 'ar' ? 'ar-AE' : 'en-US',
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    },
  ).format(value);
}

type BreakdownRowProps = {
  label: string;
  amount: string;
  isRtl: boolean;
  strong?: boolean;
};

function BreakdownRow({
  label,
  amount,
  isRtl,
  strong = false,
}: BreakdownRowProps) {
  const { palette } = useJahizTheme();
  const direction = isRtl
    ? 'row-reverse'
    : 'row';
  const textDirection = isRtl
    ? 'rtl'
    : 'ltr';

  return (
    <XStack
      flexDirection={direction}
      alignItems="center"
      justifyContent="space-between"
      gap={spacing[3]}
    >
      <JzText
        flex={1}
        variant={
          strong ? 'bodySmall' : 'caption'
        }
        textDirection={textDirection}
        style={{
          color: strong
            ? palette.textPrimary
            : palette.textSecondary,
          fontWeight: strong
            ? '800'
            : '500',
        }}
      >
        {label}
      </JzText>

      <JzText
        variant={
          strong ? 'title' : 'bodySmall'
        }
        textDirection="ltr"
        style={{
          color: palette.textPrimary,
          fontWeight: strong
            ? '800'
            : '700',
        }}
      >
        {amount}
      </JzText>
    </XStack>
  );
}

function PlanStepCard({
  title,
  value,
  helper,
  detail,
  expandedContent,
  icon,
  complete,
  expanded,
  isRtl,
  accent,
  tint,
  border,
  onToggle,
  onOpen,
}: PlanStepCardProps) {
  const { t } = useJahizLocale();
  const { palette } = useJahizTheme();
  const direction = isRtl ? 'row-reverse' : 'row';
  const align = isRtl ? 'flex-end' : 'flex-start';
  const textDirection = isRtl ? 'rtl' : 'ltr';

  return (
    <JzGlassPanel
      tone="surface"
      style={[
        styles.stepCard,
        {
          borderColor: expanded
            ? border
            : palette.border,
        },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={title}
        onPress={onToggle}
        style={({ pressed }) => ({
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <XStack
          flexDirection={direction}
          alignItems="center"
          gap={spacing[3]}
        >
          <View
            style={[
              styles.stepIcon,
              {
                backgroundColor: tint,
                borderColor: border,
              },
            ]}
          >
            <JzIcon
              name={icon}
              size={20}
              color={accent}
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
              variant="title"
              textDirection={textDirection}
              numberOfLines={1}
              style={{ color: palette.textPrimary }}
            >
              {title}
            </JzText>

            {value}

            <JzText
              variant="caption"
              textDirection={textDirection}
              numberOfLines={1}
              style={{ color: palette.textMuted }}
            >
              {helper}
            </JzText>
          </YStack>

          <YStack
            alignItems="center"
            gap={spacing[1]}
          >
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: complete
                    ? palette.successSurface
                    : tint,
                  borderColor: complete
                    ? 'rgba(48,214,162,0.28)'
                    : border,
                },
              ]}
            >
              <JzIcon
                name={complete ? 'check' : 'info'}
                size={15}
                color={complete ? colors.mint600 : accent}
                strokeWidth={2.2}
              />
            </View>

            <View
              style={{
                transform: [
                  {
                    rotate: expanded
                      ? '180deg'
                      : '0deg',
                  },
                ],
              }}
            >
              <JzIcon
                name="expand"
                size={16}
                color={palette.textMuted}
                strokeWidth={2.1}
              />
            </View>
          </YStack>
        </XStack>
      </Pressable>

      {expanded ? (
        <YStack gap={spacing[2]}>
          <View
            style={[
              styles.divider,
              { backgroundColor: palette.border },
            ]}
          />

          <JzText
            variant="bodySmall"
            textDirection={textDirection}
            style={{ color: palette.textSecondary }}
          >
            {detail}
          </JzText>

          {expandedContent}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('openPlanSection')}
            onPress={onOpen}
            style={({ pressed }) => [
              styles.openButton,
              {
                opacity: pressed ? 0.82 : 1,
                flexDirection: direction,
                backgroundColor: tint,
                borderColor: border,
              },
            ]}
          >
            <JzText
              variant="bodySmall"
              textDirection={textDirection}
              style={{
                color: accent,
                fontWeight: '800',
              }}
            >
              {t('openPlanSection')}
            </JzText>

            <JzIcon
              name="next"
              size={16}
              color={accent}
              strokeWidth={2.2}
              isRtl={isRtl}
            />
          </Pressable>
        </YStack>
      ) : null}
    </JzGlassPanel>
  );
}

export function PlanScreen() {
  const router = useRouter();
  const {
    isRtl,
    locale,
    t,
  } = useJahizLocale();
  const { isDark, palette } = useJahizTheme();
  const workspace = useTripWorkspaceStore(
    (state) => state.workspace,
  );
  const [expandedKey, setExpandedKey] =
    useState<PlanStepKey | null>(null);
  const params = useLocalSearchParams<{
    focus?: string;
  }>();

  useEffect(() => {
    switch (params.focus) {
      case 'ready-money':
      case 'need-to-save':
      case 'money':
        setExpandedKey('money');
        break;
      case 'commitments':
      case 'next-commitment':
        setExpandedKey('commitments');
        break;
      case 'costs':
        setExpandedKey('costs');
        break;
      case 'payments':
      case 'next-payment':
      case 'bookings':
        setExpandedKey('payments');
        break;
      case 'dates':
        setExpandedKey('dates');
        break;
      default:
        break;
    }
  }, [params.focus]);

  const direction = isRtl ? 'row-reverse' : 'row';
  const align = isRtl ? 'flex-end' : 'flex-start';
  const textDirection = isRtl ? 'rtl' : 'ltr';
  const route = workspace.route;
  const dates = workspace.dates;
  const hasRoute = route !== null;
  const hasDates = Boolean(
    dates.departureDate && dates.returnDate,
  );
  const hasFunds = workspace.moneyInReviewed;
  const hasCosts =
    workspace.costsReviewed === true &&
    workspace.costItems.length > 0;

  const progress = useMemo(
    () => selectTripProgress(workspace),
    [workspace],
  );
  const tripSteps = useMemo(
    () => selectTripSteps(workspace),
    [workspace],
  );
  const commitmentsComplete =
    tripSteps.find(
      (step) => step.key === 'commitments',
    )?.status === 'complete';
  const paymentsComplete =
    tripSteps.find(
      (step) => step.key === 'payments',
    )?.status === 'complete';
  const readyMoneyBreakdown = useMemo(
    () =>
      selectReadyMoneyBreakdown(
        workspace,
      ),
    [workspace],
  );
  const readyMoney =
    readyMoneyBreakdown.readyMoney;
  const needToSave = useMemo(
    () => selectNeedToSave(workspace),
    [workspace],
  );
  const commitmentsTotal = useMemo(
    () =>
      selectTripWindowCommitmentsTotal(
        workspace,
      ),
    [workspace],
  );
  const commitmentCount = useMemo(
    () =>
      selectCommitmentDisplayCount(
        workspace,
      ),
    [workspace],
  );
  const totalCost = useMemo(
    () => selectTotalCost(workspace),
    [workspace],
  );
  const bookingCosts = useMemo(
    () =>
      workspace.costItems.filter(
        isPaymentTrackableCost,
      ),
    [workspace.costItems],
  );
  const bookingCostIds = useMemo(
    () =>
      new Set(
        bookingCosts.map((item) => item.id),
      ),
    [bookingCosts],
  );
  const bookingTotal = useMemo(
    () =>
      bookingCosts.reduce(
        (sum, item) => sum + item.amount,
        0,
      ),
    [bookingCosts],
  );
  const spendingTotal = Math.max(
    0,
    totalCost - bookingTotal,
  );
  const bookingPayments = useMemo(
    () =>
      workspace.payments.filter(
        (payment) =>
          bookingCostIds.has(
            payment.costItemId,
          ),
      ),
    [
      bookingCostIds,
      workspace.payments,
    ],
  );
  const paidTotal = useMemo(
    () =>
      bookingPayments
        .filter(
          (payment) =>
            payment.status === 'paid',
        )
        .reduce(
          (sum, payment) =>
            sum + payment.amount,
          0,
        ),
    [bookingPayments],
  );
  const scheduledTotal = useMemo(
    () =>
      bookingPayments
        .filter(
          (payment) =>
            payment.status ===
            'scheduled',
        )
        .reduce(
          (sum, payment) =>
            sum + payment.amount,
          0,
        ),
    [bookingPayments],
  );
  const remainingTotal = Math.max(
    0,
    bookingTotal - paidTotal,
  );
  const nextPayment = useMemo(
    () => selectNextPayment(workspace),
    [workspace],
  );
  const nextCommitmentGroup = useMemo(
    () =>
      selectNextTripWindowCommitmentGroup(
        workspace,
      ),
    [workspace],
  );
  const nextPaymentCost = nextPayment
    ? workspace.costItems.find(
        (item) =>
          item.id === nextPayment.costItemId,
      ) ?? null
    : null;

  const tripDays =
    hasDates &&
    dates.departureDate &&
    dates.returnDate
      ? getTripDayCount(
          dates.departureDate,
          dates.returnDate,
        )
      : null;

  function navigateTo(
    route: JahizFocusRoute,
    focus: JahizFocusKey,
    entityId?: string,
  ) {
    void Haptics.selectionAsync().catch(
      () => undefined,
    );
    router.push(
      buildJahizFocusHref({
        route,
        focus,
        ...(entityId
          ? { entityId }
          : {}),
      }) as Href,
    );
  }

  function toggleStep(key: PlanStepKey) {
    void Haptics.selectionAsync().catch(
      () => undefined,
    );
    setExpandedKey((current) =>
      current === key ? null : key,
    );
  }

  const setupComplete =
    hasRoute &&
    hasDates &&
    hasFunds &&
    commitmentsComplete &&
    hasCosts;

  const nextScheduledDate =
    nextPayment?.dueDate ?? null;
  const nextCommitmentDate =
    nextCommitmentGroup?.dueDate ?? null;
  const preferPayment =
    Boolean(nextPayment) &&
    (!nextCommitmentGroup ||
      !nextCommitmentDate ||
      Boolean(
        nextScheduledDate &&
          nextScheduledDate <=
            nextCommitmentDate,
      ));

  const nextStep: PlanNextStep = !hasRoute
    ? {
        title: t('routePreview'),
        helper: t('startTripPlanHelper'),
        icon: 'route' as const,
        href: '/trip/create/route',
        focus: 'route',
      }
    : !hasDates
      ? {
          title: t('datesStepTitle'),
          helper: t('nextStepDates'),
          icon: 'calendar' as const,
          href: '/trip/create/dates',
          focus: 'dates',
        }
      : !hasFunds
        ? {
            title: t('fundsStepTitle'),
            helper: t('nextStepFunds'),
            icon: 'money' as const,
            href: '/trip/create/funds',
            focus: 'money',
          }
        : !commitmentsComplete
          ? {
              title: t('commitmentsStepTitle'),
              helper: t('nextStepCommitments'),
              icon: 'receipt' as const,
              href: '/trip/create/commitments',
              focus: 'commitments',
            }
          : !hasCosts
            ? {
                title: t('costsStepTitle'),
                helper: t('nextStepCosts'),
                icon: 'receipt' as const,
                href: '/trip/create/costs',
                focus: 'costs',
              }
            : setupComplete &&
                preferPayment &&
                nextPayment
              ? {
                  title:
                    nextPaymentCost?.title ??
                    t('payments'),
                  helper: t(
                    'planNextPaymentSummary',
                    {
                      amount: `${formatAmount(
                        nextPayment.amount,
                        locale,
                      )} ${workspace.currency}`,
                      date:
                        nextPayment.dueDate ??
                        '—',
                    },
                  ),
                  icon: 'payments' as const,
                  href: '/payments',
                  focus: 'next-payment',
                  entityId: nextPayment.id,
                }
              : setupComplete &&
                  nextCommitmentGroup
                ? {
                    title:
                      nextCommitmentGroup
                        .itemCount === 1
                        ? (
                            nextCommitmentGroup
                              .items[0]
                              ?.title ??
                            t(
                              'nextCommitment',
                            )
                          )
                        : t(
                            'nextCommitmentGroupTitle',
                            {
                              count:
                                nextCommitmentGroup
                                  .itemCount,
                            },
                          ),
                    helper: t(
                      'planNextCommitmentSummary',
                      {
                        amount: `${formatAmount(
                          nextCommitmentGroup
                            .totalAmount,
                          locale,
                        )} ${workspace.currency}`,
                        date:
                          nextCommitmentGroup
                            .dueDate,
                      },
                    ),
                    icon: 'receipt' as const,
                    href:
                      '/trip/create/commitments',
                    focus:
                      'next-commitment',
                    ...(
                      nextCommitmentGroup
                        .itemCount === 1 &&
                      nextCommitmentGroup
                        .items[0]
                        ? {
                            entityId:
                              nextCommitmentGroup
                                .items[0].id,
                          }
                        : {}
                    ),
                  }
                : {
                    title: t('reviewPlan'),
                    helper: t(
                      'planReadyReviewHelper',
                    ),
                    icon: 'sparkles' as const,
                    href: '/',
                    focus: 'today',
                  };

  const hero = (
    <YStack
      paddingTop={spacing[3]}
      paddingBottom={spacing[3]}
      alignItems={align}
      gap={spacing[1]}
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
              borderColor: palette.borderStrong,
            },
          ]}
        >
          <JzIcon
            name="plan"
            size={21}
            color={colors.mint600}
            strokeWidth={2.1}
          />
        </View>

        <JzText
          variant="heading1"
          textDirection={textDirection}
          style={{ color: palette.heroText }}
        >
          {t('yourPlan')}
        </JzText>
      </XStack>

      <JzText
        variant="bodySmall"
        textDirection={textDirection}
        style={{ color: palette.heroSecondary }}
      >
        {t('planHelperPremium')}
      </JzText>
    </YStack>
  );

  const routeTint = isDark
    ? 'rgba(48,214,162,0.10)'
    : 'rgba(48,214,162,0.075)';
  const skyTint = isDark
    ? 'rgba(69,184,245,0.10)'
    : 'rgba(69,184,245,0.075)';
  const amberTint = isDark
    ? 'rgba(245,185,76,0.10)'
    : 'rgba(245,185,76,0.075)';
  const violetTint = isDark
    ? 'rgba(167,139,250,0.10)'
    : 'rgba(167,139,250,0.075)';

  return (
    <JzCollapsibleScreen
      isRtl={isRtl}
      brandLabel={t('brandName')}
      tagline={t('appTagline')}
      notificationLabel={t('notifications')}
      profileLabel={t('profile')}
      hero={hero}
      heroHeight={152}
      bodyOverlap={10}
      contentColor={palette.background}
      bodyStyle={[
        styles.body,
        { backgroundColor: palette.background },
      ]}
      bottomPadding={188}
      resetScrollOnFocus
      onProfilePress={() =>
        router.push('/profile')
      }
    >
      <View pointerEvents="none" style={styles.ambientLayer}>
        <View
          style={[
            styles.ambientOrb,
            styles.ambientOrbOne,
            {
              backgroundColor: isDark
                ? 'rgba(48,214,162,0.08)'
                : 'rgba(48,214,162,0.10)',
            },
          ]}
        />
        <View
          style={[
            styles.ambientOrb,
            styles.ambientOrbTwo,
            {
              backgroundColor: isDark
                ? 'rgba(69,184,245,0.07)'
                : 'rgba(69,184,245,0.09)',
            },
          ]}
        />
      </View>

      {hasRoute && route ? (
        <JzGlassPanel
          tone="surface"
          style={[
            styles.routeCard,
            {
              borderColor:
                'rgba(48,214,162,0.24)',
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
                styles.routeIcon,
                {
                  backgroundColor: routeTint,
                },
              ]}
            >
              <JzIcon
                name="route"
                size={22}
                color={colors.mint600}
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
                variant="display"
                textDirection="ltr"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={{
                  color: palette.textPrimary,
                  fontSize: 28,
                }}
              >
                {route.origin.airportCode}
                {'  →  '}
                {route.destination.airportCode}
              </JzText>

              <JzText
                variant="caption"
                textDirection="ltr"
                style={{
                  color: colors.mint600,
                  fontWeight: '800',
                }}
              >
                {route.origin.currency}
                {' → '}
                {route.destination.currency}
              </JzText>
            </YStack>

            <XStack
              flexDirection={direction}
              gap={spacing[2]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t(
                  'manageTrips',
                )}
                onPress={() =>
                  router.push(
                    '/trip/manage' as Href,
                  )
                }
                style={({ pressed }) => [
                  styles.tripsButton,
                  {
                    opacity:
                      pressed ? 0.75 : 1,
                    backgroundColor:
                      palette.successSurface,
                    borderColor:
                      'rgba(48,214,162,0.25)',
                  },
                ]}
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{
                    color:
                      colors.mint600,
                    fontWeight: '800',
                  }}
                >
                  {t('tripsShort')}
                </JzText>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('editRoute')}
                onPress={() =>
                  navigateTo(
                    '/trip/create/route',
                    'route',
                  )
                }
                style={({ pressed }) => [
                  styles.iconButton,
                  {
                    opacity:
                      pressed ? 0.75 : 1,
                    backgroundColor:
                      palette.surfaceMuted,
                    borderColor:
                      palette.border,
                  },
                ]}
              >
                <JzIcon
                  name="edit"
                  size={17}
                  color={palette.textPrimary}
                  strokeWidth={2.1}
                />
              </Pressable>
            </XStack>
          </XStack>

          <View
            style={[
              styles.divider,
              { backgroundColor: palette.border },
            ]}
          />

          <XStack
            flexDirection={direction}
            alignItems="center"
            gap={spacing[3]}
          >
            <YStack
              flex={1}
              alignItems={align}
              gap={4}
            >
              <XStack
                width="100%"
                flexDirection={direction}
                justifyContent="space-between"
              >
                <JzText
                  variant="caption"
                  textDirection={textDirection}
                  style={{ color: palette.textMuted }}
                >
                  {t('planProgress')}
                </JzText>
                <JzText
                  variant="bodySmall"
                  textDirection="ltr"
                  style={{
                    color: palette.textPrimary,
                    fontWeight: '800',
                  }}
                >
                  {progress.percentage}%
                </JzText>
              </XStack>

              <View
                style={[
                  styles.progressTrack,
                  {
                    backgroundColor:
                      palette.surfaceStrong,
                  },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.max(
                        progress.percentage,
                        5,
                      )}%`,
                    },
                  ]}
                />
              </View>
            </YStack>
          </XStack>
        </JzGlassPanel>
      ) : (
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            navigateTo(
              '/trip/create/route',
              'route',
            )
          }
        >
          <JzGlassPanel
            tone="mint"
            style={styles.routeEmpty}
          >
            <JzIcon
              name="route"
              size={22}
              color={colors.mint600}
            />
            <JzText
              variant="title"
              textDirection={textDirection}
              style={{ color: palette.textPrimary }}
            >
              {t('startTripPlan')}
            </JzText>
          </JzGlassPanel>
        </Pressable>
      )}

      {hasRoute ? (
        <YStack gap={spacing[2]}>
          <PlanStepCard
            stepKey="dates"
            title={t('datesStepTitle')}
            value={
              <JzText
                variant="bodySmall"
                textDirection={
                  hasDates ? 'ltr' : textDirection
                }
                numberOfLines={1}
                style={{
                  color: hasDates
                    ? palette.textPrimary
                    : palette.textSecondary,
                  fontWeight: hasDates ? '700' : '500',
                }}
              >
                {hasDates &&
                dates.departureDate &&
                dates.returnDate
                  ? `${dates.departureDate} → ${dates.returnDate}`
                  : t('datesStepHelper')}
              </JzText>
            }
            helper={
              hasDates
                ? t('tripDays', {
                    count: tripDays ?? 0,
                  })
                : t('tapToComplete')
            }
            detail={t('planDatesDetail')}
            icon="calendar"
            complete={hasDates}
            expanded={expandedKey === 'dates'}
            isRtl={isRtl}
            accent="#30D6A2"
            tint={routeTint}
            border="rgba(48,214,162,0.28)"
            onToggle={() => toggleStep('dates')}
            onOpen={() =>
              navigateTo(
                '/trip/create/dates',
                'dates',
              )
            }
          />

          <JzFocusHighlight
            active={
              params.focus === 'ready-money' ||
              params.focus === 'need-to-save' ||
              params.focus === 'money'
            }
            borderRadius={21}
          >
            <PlanStepCard
              stepKey="money"
              title={t('fundsStepTitle')}
              value={
                <JzText
                  variant="moneyMedium"
                  textDirection={
                    hasFunds ? 'ltr' : textDirection
                  }
                  numberOfLines={1}
                  style={{
                    color: hasFunds
                      ? palette.textPrimary
                      : palette.textSecondary,
                  }}
                >
                  {hasFunds
                    ? `${formatAmount(
                        readyMoney,
                        locale,
                      )} ${workspace.currency}`
                    : t('fundsStepHelper')}
                </JzText>
              }
              helper={
                hasFunds
                  ? t(
                      'readyMoneyFormulaShort',
                    )
                  : t('tapToComplete')
              }
              detail={t('planMoneyDetail')}
              expandedContent={
                hasFunds ? (
                  <YStack
                    gap={spacing[2]}
                    padding={spacing[3]}
                    borderRadius={16}
                    style={{
                      backgroundColor:
                        palette.surfaceMuted,
                    }}
                  >
                    <JzText
                      variant="caption"
                      textDirection={
                        textDirection
                      }
                      style={{
                        color:
                          colors.mint600,
                        fontWeight: '800',
                      }}
                    >
                      {t(
                        'readyMoneyCalculation',
                      )}
                    </JzText>

                    <BreakdownRow
                      label={t(
                        'readyMoneyUsableThroughReturn',
                      )}
                      amount={`+${formatAmount(
                        readyMoneyBreakdown
                          .usableThroughReturn,
                        locale,
                      )} ${workspace.currency}`}
                      isRtl={isRtl}
                    />

                    <BreakdownRow
                      label={t(
                        'readyMoneySafetyReserve',
                      )}
                      amount={`−${formatAmount(
                        readyMoneyBreakdown
                          .safetyReserve,
                        locale,
                      )} ${workspace.currency}`}
                      isRtl={isRtl}
                    />

                    <BreakdownRow
                      label={t(
                        'readyMoneyCommitmentsDeduction',
                      )}
                      amount={`−${formatAmount(
                        readyMoneyBreakdown
                          .commitmentsThroughReturn,
                        locale,
                      )} ${workspace.currency}`}
                      isRtl={isRtl}
                    />

                    <View
                      style={[
                        styles.divider,
                        {
                          backgroundColor:
                            palette.border,
                        },
                      ]}
                    />

                    <BreakdownRow
                      label={t(
                        'readyMoney',
                      )}
                      amount={`${formatAmount(
                        readyMoneyBreakdown
                          .readyMoney,
                        locale,
                      )} ${workspace.currency}`}
                      isRtl={isRtl}
                      strong
                    />

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
                      {t(
                        'readyMoneyBreakdownHelper',
                      )}
                    </JzText>

                    <View
                      style={[
                        styles.divider,
                        {
                          backgroundColor:
                            palette.border,
                        },
                      ]}
                    />

                    <JzText
                      variant="caption"
                      textDirection={
                        textDirection
                      }
                      style={{
                        color:
                          colors.mint600,
                        fontWeight: '800',
                      }}
                    >
                      {t('planNeedToSaveCalculation')}
                    </JzText>

                    <BreakdownRow
                      label={t('planNeedToSaveRemainingUnpaid')}
                      amount={`${formatAmount(
                        remainingTotal,
                        locale,
                      )} ${workspace.currency}`}
                      isRtl={isRtl}
                    />

                    <BreakdownRow
                      label={t('readyMoney')}
                      amount={`-${formatAmount(
                        readyMoney,
                        locale,
                      )} ${workspace.currency}`}
                      isRtl={isRtl}
                    />

                    <BreakdownRow
                      label={t('planNeedToSaveResult')}
                      amount={`${formatAmount(
                        needToSave,
                        locale,
                      )} ${workspace.currency}`}
                      isRtl={isRtl}
                      strong
                    />

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
                      {t('planNeedToSaveBreakdownHelper')}
                    </JzText>
                  </YStack>
                ) : null
              }
              icon="money"
              complete={hasFunds}
              expanded={expandedKey === 'money'}
              isRtl={isRtl}
              accent="#2DD4BF"
              tint={
                isDark
                  ? 'rgba(45,212,191,0.10)'
                  : 'rgba(45,212,191,0.075)'
              }
              border="rgba(45,212,191,0.28)"
              onToggle={() => toggleStep('money')}
              onOpen={() =>
                navigateTo(
                  '/trip/create/funds',
                  'money',
                )
              }
            />

          </JzFocusHighlight>
          <JzFocusHighlight
            active={
              params.focus === 'commitments' ||
              params.focus === 'next-commitment'
            }
            borderRadius={21}
          >
            <PlanStepCard
              stepKey="commitments"
              title={t('commitmentsStepTitle')}
              value={
                <JzText
                  variant="moneyMedium"
                  textDirection="ltr"
                  numberOfLines={1}
                  style={{
                    color: palette.textPrimary,
                  }}
                >
                  {`${formatAmount(
                    commitmentsTotal,
                    locale,
                  )} ${workspace.currency}`}
                </JzText>
              }
              helper={t(
                'planCommitmentsSummary',
                {
                  count: commitmentCount,
                },
              )}
              detail={t('planCommitmentsDetail')}
              icon="receipt"
              complete={Boolean(commitmentsComplete)}
              expanded={
                expandedKey === 'commitments'
              }
              isRtl={isRtl}
              accent="#F5B94C"
              tint={amberTint}
              border="rgba(245,185,76,0.28)"
              onToggle={() =>
                toggleStep('commitments')
              }
              onOpen={() =>
                navigateTo(
                  '/trip/create/commitments',
                  'commitments',
                )
              }
            />

          </JzFocusHighlight>
          <PlanStepCard
            stepKey="costs"
            title={t('costsStepTitle')}
            value={
              <JzText
                variant="moneyMedium"
                textDirection="ltr"
                numberOfLines={1}
                style={{
                  color: hasCosts
                    ? palette.textPrimary
                    : palette.textSecondary,
                }}
              >
                {hasCosts
                  ? `${formatAmount(
                      totalCost,
                      locale,
                    )} ${workspace.currency}`
                  : t('costsStepHelper')}
              </JzText>
            }
            helper={
              hasCosts
                ? t('planCostsSummary', {
                    bookings: `${formatAmount(
                      bookingTotal,
                      locale,
                    )} ${workspace.currency}`,
                    spending: `${formatAmount(
                      spendingTotal,
                      locale,
                    )} ${workspace.currency}`,
                  })
                : t('tapToComplete')
            }
            detail={t('planCostsDetail')}
            icon="receipt"
            complete={hasCosts}
            expanded={expandedKey === 'costs'}
            isRtl={isRtl}
            accent="#45B8F5"
            tint={skyTint}
            border="rgba(69,184,245,0.28)"
            onToggle={() => toggleStep('costs')}
            onOpen={() =>
              navigateTo(
                '/trip/create/costs',
                'costs',
              )
            }
          />

          <PlanStepCard
            stepKey="payments"
            title={t('payments')}
            value={
              <JzText
                variant="moneyMedium"
                textDirection="ltr"
                numberOfLines={1}
                style={{
                  color: palette.textPrimary,
                }}
              >
                {`${formatAmount(
                  remainingTotal,
                  locale,
                )} ${workspace.currency}`}
              </JzText>
            }
            helper={t('planPaymentsSummary', {
              paid: `${formatAmount(
                paidTotal,
                locale,
              )} ${workspace.currency}`,
              scheduled: `${formatAmount(
                scheduledTotal,
                locale,
              )} ${workspace.currency}`,
            })}
            detail={t('planPaymentsDetail')}
            icon="payments"
            complete={paymentsComplete}
            expanded={expandedKey === 'payments'}
            isRtl={isRtl}
            accent="#A78BFA"
            tint={violetTint}
            border="rgba(167,139,250,0.28)"
            onToggle={() => toggleStep('payments')}
            onOpen={() =>
              navigateTo('/payments', 'payments')
            }
          />
        </YStack>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={nextStep.title}
        onPress={() =>
          navigateTo(
            nextStep.href,
            nextStep.focus,
            nextStep.entityId,
          )
        }
        style={({ pressed }) => ({
          opacity: pressed ? 0.82 : 1,
        })}
      >
        <JzGlassPanel
          tone="mint"
          style={[
            styles.nextAction,
            {
              borderColor:
                'rgba(48,214,162,0.26)',
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
                styles.nextIcon,
                {
                  backgroundColor:
                    palette.successSurface,
                },
              ]}
            >
              <JzIcon
                name={nextStep.icon}
                size={20}
                color={colors.mint600}
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
                style={{
                  color: colors.mint600,
                  fontWeight: '800',
                }}
              >
                {t('nextStepTitle')}
              </JzText>

              <JzText
                variant="title"
                textDirection={textDirection}
                numberOfLines={1}
                style={{ color: palette.textPrimary }}
              >
                {nextStep.title}
              </JzText>

              <JzText
                variant="caption"
                textDirection={textDirection}
                numberOfLines={1}
                style={{ color: palette.textSecondary }}
              >
                {nextStep.helper}
              </JzText>
            </YStack>

            <JzIcon
              name="next"
              size={17}
              color={palette.textPrimary}
              strokeWidth={2.2}
              isRtl={isRtl}
            />
          </XStack>
        </JzGlassPanel>
      </Pressable>
    </JzCollapsibleScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    position: 'relative',
    overflow: 'hidden',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[3],
    gap: spacing[2],
  },
  ambientLayer: {
    ...StyleSheet.absoluteFill,
  },
  ambientOrb: {
    position: 'absolute',
    borderRadius: radius.full,
  },
  ambientOrbOne: {
    width: 170,
    height: 170,
    top: 80,
    right: -88,
  },
  ambientOrbTwo: {
    width: 150,
    height: 150,
    top: 470,
    left: -92,
  },
  heroIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  routeCard: {
    padding: spacing[3],
    borderRadius: 24,
    gap: spacing[3],
  },
  routeEmpty: {
    minHeight: 92,
    padding: spacing[3],
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  routeIcon: {
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  tripsButton: {
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[3],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
    borderWidth: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  progressTrack: {
    width: '100%',
    height: 7,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
    backgroundColor: colors.mint500,
  },
  stepCard: {
    padding: spacing[3],
    borderRadius: 21,
    gap: spacing[3],
  },
  stepIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
    borderWidth: 1,
  },
  statusBadge: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
  },
  openButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[2],
    paddingHorizontal: spacing[3],
    borderRadius: 14,
    borderWidth: 1,
  },
  nextAction: {
    padding: spacing[3],
    marginTop: spacing[1],
    borderRadius: 21,
  },
  nextIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
});
