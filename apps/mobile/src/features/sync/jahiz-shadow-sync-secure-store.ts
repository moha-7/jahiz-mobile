import * as SecureStore from 'expo-secure-store';

import {
  createShadowSyncCursorStore,
} from './jahiz-shadow-sync-cursor-store';
import {
  jahizLocalNamespaceStorageKey,
} from '@/features/local-persistence/jahiz-local-namespace';

function getShadowCursorNamespace(): string {
  const value =
    process.env
      .EXPO_PUBLIC_JAHIZ_SHADOW_CURSOR_NAMESPACE;

  if (
    typeof value !== 'string' ||
    !value.trim()
  ) {
    return '';
  }

  const normalized =
    value.trim();

  if (
    !/^[A-Za-z0-9._-]+$/.test(
      normalized,
    )
  ) {
    throw new Error(
      'Shadow cursor namespace contains unsafe characters.',
    );
  }

  return normalized;
}

function nativeShadowCursorKey(
  key: string,
): string {
  const namespace =
    getShadowCursorNamespace();

  const accountScopedKey =
    jahizLocalNamespaceStorageKey(
      key,
    );

  return namespace
    ? `${namespace}.${accountScopedKey}`
    : accountScopedKey;
}

export function createSecureShadowSyncCursorStore() {
  return createShadowSyncCursorStore({
    getItemAsync(key) {
      return SecureStore.getItemAsync(
        nativeShadowCursorKey(key),
      );
    },
    setItemAsync(
      key,
      value,
    ) {
      return SecureStore.setItemAsync(
        nativeShadowCursorKey(key),
        value,
      );
    },
    deleteItemAsync(key) {
      return SecureStore.deleteItemAsync(
        nativeShadowCursorKey(key),
      );
    },
  });
}