import {
  useEffect,
  useMemo,
} from 'react';
import {
  Platform,
} from 'react-native';

import {
  accountJahizLocalNamespace,
} from '@/features/local-persistence/jahiz-local-namespace';
import {
  useTripPortfolioStore,
} from '@/features/trip-workspace/trip-portfolio-store';
import {
  useJahizAuthRuntime,
} from '@/providers/jahiz-auth-runtime-provider';
import {
  useJahizPortfolioAdoptionUiStore,
} from '@/features/auth/jahiz-portfolio-adoption-ui-store';

import {
  createShadowSyncHttpTransport,
} from './jahiz-shadow-sync-http';
import {
  createJahizTripSyncExecutor,
} from './jahiz-trip-sync-executor';
import {
  createSecureJahizTripSyncStateStore,
} from './jahiz-trip-sync-state-secure-store';
import {
  createJahizSyncRuntimeController,
} from './jahiz-sync-runtime-controller';
import {
  resolveJahizSyncRuntimeConfig,
} from './jahiz-sync-runtime-config';
import {
  useJahizSyncReviewUiStore,
  type JahizSyncReviewEntry,
} from './jahiz-sync-review-ui-store';
import type {
  JahizTripSyncState,
} from './jahiz-trip-sync-state';

function reviewEntry(
  state: JahizTripSyncState,
): JahizSyncReviewEntry | null {
  if (state.conflict) {
    return {
      tripId:
        state.tripId,
      kind: 'conflict',
      conflictKind:
        state.conflict.kind,
    };
  }

  if (state.preservedReview) {
    return {
      tripId:
        state.tripId,
      kind:
        'preserved-review',
      conflictKind:
        state.preservedReview.kind,
    };
  }

  return null;
}

export function JahizTripSyncRuntimeBridge() {
  const {
    mode,
    state,
    accountResolution,
    localOwnerId,
    getAuthorizationHeader,
  } = useJahizAuthRuntime();

  const portfolio =
    useTripPortfolioStore(
      (current) =>
        current.portfolio,
    );

  const hasHydrated =
    useTripPortfolioStore(
      (current) =>
        current.hasHydrated,
    );

  const config =
    useMemo(
      () =>
        resolveJahizSyncRuntimeConfig({
          enabledFlag:
            process.env
              .EXPO_PUBLIC_JAHIZ_SYNC_ENABLED,
          killSwitchFlag:
            process.env
              .EXPO_PUBLIC_JAHIZ_SYNC_KILL_SWITCH,
          apiUrl:
            process.env
              .EXPO_PUBLIC_JAHIZ_API_URL,
          platform:
            Platform.OS,
          allowWebFlag:
            process.env
              .EXPO_PUBLIC_JAHIZ_SYNC_ALLOW_WEB,
        }),
      [],
    );

  const authenticatedOwnerId =
    state.status ===
      'authenticated'
      ? state.identity.ownerId
      : null;

  const adoptionGateStatus =
    useJahizPortfolioAdoptionUiStore(
      (current) =>
        authenticatedOwnerId
          ? current.byOwner[
              authenticatedOwnerId
            ]?.status ??
            'checking'
          : 'checking',
    );

  const runtime =
    useMemo(() => {
      if (
        mode !== 'clerk' ||
        accountResolution !==
          'resolved' ||
        !authenticatedOwnerId ||
        localOwnerId !==
          authenticatedOwnerId
      ) {
        return null;
      }

      let active = true;

      const namespace =
        accountJahizLocalNamespace(
          authenticatedOwnerId,
        );

      const stateStore =
        createSecureJahizTripSyncStateStore(
          namespace,
        );

      if (!config.enabled) {
        return {
          ownerId:
            authenticatedOwnerId,
          stateStore,
          controller: null,
          stop() {
            active = false;
          },
        };
      }

      if (
        adoptionGateStatus !==
          'clear'
      ) {
        return {
          ownerId:
            authenticatedOwnerId,
          stateStore,
          controller: null,
          stop() {
            active = false;
          },
        };
      }

      const transport =
        createShadowSyncHttpTransport({
          baseUrl:
            config.apiUrl,
          async getAuthorizationHeader() {
            return (
              await getAuthorizationHeader()
            ) ?? null;
          },
        });

      const executor =
        createJahizTripSyncExecutor({
          transport,
          stateStore,
          shouldContinue() {
            return active;
          },
        });

      const controller =
        createJahizSyncRuntimeController({
          executor,
          onResult(result) {
            const review =
              reviewEntry(
                result.state,
              );

            const ui =
              useJahizSyncReviewUiStore
                .getState();

            if (review) {
              ui.upsertReview(
                authenticatedOwnerId,
                review,
              );
            } else {
              ui.clearReview(
                authenticatedOwnerId,
                result.state.tripId,
              );
            }

            if (
              __DEV__ &&
              (
                result.outcome ===
                  'conflict' ||
                result.outcome ===
                  'remote-deleted'
              )
            ) {
              console.warn(
                '[Jahiz Sync Runtime] review required',
                result.outcome,
              );
            }
          },
          onError(error) {
            if (__DEV__) {
              console.warn(
                '[Jahiz Sync Runtime] failed safely',
                error instanceof Error
                  ? error.message
                  : String(error),
              );
            }
          },
        });

      return {
        ownerId:
          authenticatedOwnerId,
        stateStore,
        controller,
        stop() {
          active = false;
          controller.stop();
        },
      };
    }, [
      accountResolution,
      adoptionGateStatus,
      authenticatedOwnerId,
      config,
      getAuthorizationHeader,
      localOwnerId,
      mode,
    ]);


  useEffect(() => {
    if (!runtime) {
      return;
    }

    let cancelled = false;

    void runtime.stateStore
      .loadAll()
      .then((states) => {
        if (cancelled) {
          return;
        }

        const entries =
          states
            .map(reviewEntry)
            .filter(
              (
                entry,
              ): entry is JahizSyncReviewEntry =>
                entry !== null,
            );

        useJahizSyncReviewUiStore
          .getState()
          .replaceOwnerReviews(
            runtime.ownerId,
            entries,
          );
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
      runtime.stop();

      useJahizSyncReviewUiStore
        .getState()
        .clearOwner(
          runtime.ownerId,
        );
    };
  }, [runtime]);

  useEffect(() => {
    if (
      !runtime?.controller ||
      !hasHydrated
    ) {
      return;
    }

    for (
      const record
      of portfolio.trips
    ) {
      runtime.controller.enqueue({
        workspace:
          record.workspace,
        desiredLifecycle:
          record.archivedAt
            ? 'archived'
            : 'active',
      });
    }
  }, [
    hasHydrated,
    portfolio,
    runtime,
  ]);

  return null;
}
