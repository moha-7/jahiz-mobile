import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import {
  createLargeValueSecureStoreAdapter,
} from '@/features/trip-workspace/jahiz-secure-large-value-storage';

import {
  createJahizProductMetricsStore,
  type JahizProductMetricsStorage,
} from './jahiz-product-metrics-store';

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

const storage:
  JahizProductMetricsStorage = {
    async getItemAsync(key) {
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
            key,
          ) ?? null
        );
      }

      return nativeStorage
        .getItemAsync(key);
    },

    async setItemAsync(
      key,
      value,
    ) {
      if (Platform.OS === 'web') {
        const webStorage = (
          globalThis as
            typeof globalThis & {
              localStorage?:
                WebStorage;
            }
        ).localStorage;

        webStorage?.setItem(
          key,
          value,
        );
        return;
      }

      await nativeStorage
        .setItemAsync(
          key,
          value,
        );
    },
  };

const singleton =
  createJahizProductMetricsStore(
    storage,
  );

export function getJahizProductMetricsStore() {
  return singleton;
}
