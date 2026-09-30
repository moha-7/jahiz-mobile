import {
  useEffect,
  useMemo,
} from 'react';
import {
  Platform,
} from 'react-native';

import {
  useTripWorkspaceStore,
} from '@/features/trip-workspace/trip-workspace-store';

import {
  createShadowSyncHttpTransport,
} from './jahiz-shadow-sync-http';
import {
  createObserveOnlyShadowQueue,
} from './jahiz-shadow-sync-observe-queue';
import {
  resolveShadowObserveConfig,
} from './jahiz-shadow-sync-observe-config';
import {
  createShadowSyncRuntimeController,
} from './jahiz-shadow-sync-runtime';
import {
  resolveJahizSyncRuntimeConfig,
} from './jahiz-sync-runtime-config';
import {
  createSecureShadowSyncCursorStore,
} from './jahiz-shadow-sync-secure-store';
import {
  summarizeShadowParityEvidence,
} from './jahiz-shadow-parity-evidence';
import {
  createSecureShadowParityEvidenceStore,
} from './jahiz-shadow-parity-evidence-secure-store';

export function JahizShadowSyncObserver() {
  const workspace =
    useTripWorkspaceStore(
      (state) => state.workspace,
    );

  const hasHydrated =
    useTripWorkspaceStore(
      (state) =>
        state.hasHydrated,
    );

  const authoritySyncConfig =
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

  const config =
    useMemo(
      () =>
        resolveShadowObserveConfig({
          isDevelopment:
            __DEV__,
          platform:
            Platform.OS,
          enabledFlag:
            process.env
              .EXPO_PUBLIC_JAHIZ_SHADOW_OBSERVE,
          baseUrl:
            process.env
              .EXPO_PUBLIC_JAHIZ_SHADOW_API_URL,
          devOwnerId:
            process.env
              .EXPO_PUBLIC_JAHIZ_SHADOW_DEV_OWNER,
        }),
      [],
    );

  const queue =
    useMemo(() => {
      if (
        !config.enabled ||
        authoritySyncConfig.enabled
      ) {
        return null;
      }

      const transport =
        createShadowSyncHttpTransport({
          baseUrl:
            config.baseUrl,
          async getAuthorizationHeader() {
            return (
              `Bearer dev:${config.devOwnerId}`
            );
          },
        });

      const evidenceStore =
        createSecureShadowParityEvidenceStore();

      void evidenceStore.beginSession();

      const controller =
        createShadowSyncRuntimeController({
          enabled: true,
          transport,
          cursorStore:
            createSecureShadowSyncCursorStore(),
          async telemetrySink(event) {
            const evidence =
              await evidenceStore.record(
                event,
              );

            if (__DEV__) {
              console.info(
                '[Jahiz Shadow Evidence]',
                summarizeShadowParityEvidence(
                  evidence,
                ),
              );
            }
          },
        });

      return createObserveOnlyShadowQueue({
        async sync(
          currentWorkspace,
        ) {
          await controller.sync(
            currentWorkspace,
          );
        },
        onError(error) {
          if (__DEV__) {
            console.warn(
              '[Jahiz Shadow Observe] sync failed safely',
              error instanceof Error
                ? error.message
                : String(error),
            );
          }
        },
      });
    }, [
      authoritySyncConfig,
      config,
    ]);

  useEffect(
    () => () => {
      queue?.stop();
    },
    [queue],
  );

  useEffect(() => {
    if (
      !queue ||
      !hasHydrated
    ) {
      return;
    }

    queue.enqueue(
      workspace,
    );
  }, [
    hasHydrated,
    queue,
    workspace,
  ]);

  return null;
}
