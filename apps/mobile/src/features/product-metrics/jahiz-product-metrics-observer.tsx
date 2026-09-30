import {
  useEffect,
  useMemo,
} from 'react';
import {
  usePathname,
} from 'expo-router';

import {
  buildJahizDecisionContext,
} from '@/features/moves/jahiz-decision-context';
import {
  useTripWorkspaceStore,
} from '@/features/trip-workspace';
import {
  useJahizLocale,
} from '@/providers/locale-provider';

import {
  getJahizProductMetricsStore,
} from './jahiz-product-metrics-secure-store';
import type {
  JahizProductMetricStep,
} from './jahiz-product-metrics';

function localTodayIso(): string {
  const now = new Date();
  const year =
    String(now.getFullYear());
  const month =
    String(
      now.getMonth() + 1,
    ).padStart(2, '0');
  const day =
    String(
      now.getDate(),
    ).padStart(2, '0');

  return [
    year,
    month,
    day,
  ].join('-');
}

function stepForPath(
  pathname: string,
): JahizProductMetricStep | null {
  switch (pathname) {
    case '/trip/create/route':
      return 'route';
    case '/trip/create/dates':
      return 'dates';
    case '/trip/create/funds':
      return 'funds';
    case '/trip/create/commitments':
      return 'commitments';
    case '/trip/create/costs':
      return 'costs';
    default:
      return null;
  }
}

export function isJahizProductMetricsEnabled() {
  return (
    process.env
      .EXPO_PUBLIC_JAHIZ_PRODUCT_METRICS_ENABLED ===
    '1'
  );
}

export function JahizProductMetricsObserver() {
  const pathname =
    usePathname();

  const {
    t,
  } = useJahizLocale();

  const workspace =
    useTripWorkspaceStore(
      (state) =>
        state.workspace,
    );

  const todayIso =
    localTodayIso();

  const decision =
    useMemo(
      () =>
        buildJahizDecisionContext(
          workspace,
          todayIso,
          t('payments'),
        ).decision,
      [
        workspace,
        todayIso,
        t,
      ],
    );

  const store =
    useMemo(
      () =>
        getJahizProductMetricsStore(),
      [],
    );

  useEffect(() => {
    if (
      !isJahizProductMetricsEnabled()
    ) {
      return;
    }

    let cancelled = false;

    const track =
      async () => {
        const step =
          stepForPath(
            pathname,
          );

        if (
          pathname ===
            '/trip/create/route'
        ) {
          await store
            .startPlanningSession();

          if (cancelled) {
            return;
          }
        }

        if (step) {
          await store.record({
            name:
              'create_step_seen',
            step,
          });

          if (cancelled) {
            return;
          }
        }

        if (
          pathname === '/moves'
        ) {
          await store.record({
            name: 'moves_seen',
          });

          if (cancelled) {
            return;
          }
        }

        const decisionSurface =
          pathname === '/' ||
          pathname ===
            '/today' ||
          pathname ===
            '/moves';

        if (
          decisionSurface &&
          decision
            .showReadinessScore
        ) {
          await store.record({
            name:
              'verdict_seen',
          });
        }
      };

    void track();

    return () => {
      cancelled = true;
    };
  }, [
    decision
      .showReadinessScore,
    pathname,
    store,
  ]);

  return null;
}
