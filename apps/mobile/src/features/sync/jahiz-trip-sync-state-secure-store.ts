import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import {
  createLargeValueSecureStoreAdapter,
} from '@/features/trip-workspace/jahiz-secure-large-value-storage';
import {
  jahizLocalNamespaceStorageKey,
  type JahizLocalNamespace,
} from '@/features/local-persistence/jahiz-local-namespace';

import {
  createJahizTripSyncStateStore,
  type JahizTripSyncStateStorage,
} from './jahiz-trip-sync-state-store';

type WebStorage = {
  getItem: (
    key: string,
  ) => string | null;
  setItem: (
    key: string,
    value: string,
  ) => void;
};

const nativeStorage =
  createLargeValueSecureStoreAdapter(
    SecureStore,
  );

export function createSecureJahizTripSyncStateStore(
  namespace:
    JahizLocalNamespace,
) {
  const storage:
    JahizTripSyncStateStorage = {
      async getItemAsync(key) {
        const scopedKey =
          jahizLocalNamespaceStorageKey(
            key,
            namespace,
          );

        if (Platform.OS === 'web') {
          const webStorage = (
            globalThis as
              typeof globalThis & {
                localStorage?:
                  WebStorage;
              }
          ).localStorage;

          return (
            webStorage?.getItem(
              scopedKey,
            ) ?? null
          );
        }

        return nativeStorage
          .getItemAsync(
            scopedKey,
          );
      },

      async setItemAsync(
        key,
        value,
      ) {
        const scopedKey =
          jahizLocalNamespaceStorageKey(
            key,
            namespace,
          );

        if (Platform.OS === 'web') {
          const webStorage = (
            globalThis as
              typeof globalThis & {
                localStorage?:
                  WebStorage;
              }
          ).localStorage;

          webStorage?.setItem(
            scopedKey,
            value,
          );
          return;
        }

        await nativeStorage
          .setItemAsync(
            scopedKey,
            value,
          );
      },
    };

  return createJahizTripSyncStateStore(
    storage,
  );
}
