import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type {
  JahizAuthenticatedIdentity,
} from '@jahiz/api-contracts';

import {
  createLargeValueSecureStoreAdapter,
} from '@/features/trip-workspace/jahiz-secure-large-value-storage';

import {
  LOCAL_ACCOUNT_BINDINGS_STORAGE_KEY,
  LOCAL_NAMESPACE_MIGRATION_MARKER_KEY,
  TRIP_PORTFOLIO_STORAGE_KEY,
  TRIP_WORKSPACE_STORAGE_KEY,
} from './jahiz-local-namespace';

type WebStorage = {
  getItem: (
    key: string,
  ) => string | null;
  setItem: (
    key: string,
    value: string,
  ) => void;
  removeItem: (
    key: string,
  ) => void;
};

type VerifiedBinding = {
  provider: string;
  providerSubject: string;
  ownerId: string;
  verifiedAt: string;
};

type VerifiedBindingsDocument = {
  version: 1;
  bindings: VerifiedBinding[];
};

const nativeLargeStorage =
  createLargeValueSecureStoreAdapter(
    SecureStore,
  );

let legacyResetPromise:
  Promise<void> | null = null;

function webStorage():
  WebStorage | undefined {
  return (
    globalThis as typeof globalThis & {
      localStorage?: WebStorage;
    }
  ).localStorage;
}

async function readAppValue(
  key: string,
): Promise<string | null> {
  if (Platform.OS === 'web') {
    return (
      webStorage()?.getItem(key) ??
      null
    );
  }

  return nativeLargeStorage.getItemAsync(
    key,
  );
}

async function writeAppValue(
  key: string,
  value: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.setItem(
      key,
      value,
    );
    return;
  }

  await nativeLargeStorage.setItemAsync(
    key,
    value,
  );
}

async function removeLegacyLargeValue(
  key: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(key);
    return;
  }

  await nativeLargeStorage
    .deleteItemAsync(key);
}

function parseBindings(
  raw: string | null,
): VerifiedBindingsDocument {
  if (!raw) {
    return {
      version: 1,
      bindings: [],
    };
  }

  try {
    const parsed =
      JSON.parse(raw) as
        Partial<VerifiedBindingsDocument>;

    if (
      parsed.version !== 1 ||
      !Array.isArray(
        parsed.bindings,
      )
    ) {
      return {
        version: 1,
        bindings: [],
      };
    }

    const bindings =
      parsed.bindings.filter(
        (
          value,
        ): value is VerifiedBinding => {
          if (
            !value ||
            typeof value !== 'object'
          ) {
            return false;
          }

          const candidate =
            value as
              Partial<VerifiedBinding>;

          return (
            typeof candidate.provider ===
              'string' &&
            candidate.provider.length > 0 &&
            typeof candidate
              .providerSubject ===
              'string' &&
            candidate.providerSubject
              .length > 0 &&
            typeof candidate.ownerId ===
              'string' &&
            candidate.ownerId.length > 0 &&
            typeof candidate.verifiedAt ===
              'string' &&
            candidate.verifiedAt.length > 0
          );
        },
      );

    return {
      version: 1,
      bindings,
    };
  } catch {
    return {
      version: 1,
      bindings: [],
    };
  }
}

export function ensureInternalLegacyTripPersistenceReset():
  Promise<void> {
  if (legacyResetPromise) {
    return legacyResetPromise;
  }

  legacyResetPromise =
    (async () => {
      const marker =
        await readAppValue(
          LOCAL_NAMESPACE_MIGRATION_MARKER_KEY,
        );

      if (marker === 'done') {
        return;
      }

      await Promise.all([
        removeLegacyLargeValue(
          TRIP_PORTFOLIO_STORAGE_KEY,
        ),
        removeLegacyLargeValue(
          TRIP_WORKSPACE_STORAGE_KEY,
        ),
      ]);

      await writeAppValue(
        LOCAL_NAMESPACE_MIGRATION_MARKER_KEY,
        'done',
      );
    })();

  return legacyResetPromise;
}

export async function saveVerifiedLocalAccountBinding(
  identity:
    JahizAuthenticatedIdentity,
): Promise<void> {
  const current =
    parseBindings(
      await readAppValue(
        LOCAL_ACCOUNT_BINDINGS_STORAGE_KEY,
      ),
    );

  const nextBinding:
    VerifiedBinding = {
      provider: identity.provider,
      providerSubject:
        identity.providerSubject,
      ownerId: identity.ownerId,
      verifiedAt:
        new Date().toISOString(),
    };

  const bindings = [
    ...current.bindings.filter(
      (binding) =>
        !(
          binding.provider ===
            nextBinding.provider &&
          binding.providerSubject ===
            nextBinding.providerSubject
        ),
    ),
    nextBinding,
  ].slice(-12);

  await writeAppValue(
    LOCAL_ACCOUNT_BINDINGS_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      bindings,
    } satisfies
      VerifiedBindingsDocument),
  );
}

export async function loadVerifiedLocalOwnerId(
  provider: string,
  providerSubject: string,
): Promise<string | null> {
  const normalizedProvider =
    provider.trim();
  const normalizedSubject =
    providerSubject.trim();

  if (
    !normalizedProvider ||
    !normalizedSubject
  ) {
    return null;
  }

  const current =
    parseBindings(
      await readAppValue(
        LOCAL_ACCOUNT_BINDINGS_STORAGE_KEY,
      ),
    );

  return (
    current.bindings
      .find(
        (binding) =>
          binding.provider ===
            normalizedProvider &&
          binding.providerSubject ===
            normalizedSubject,
      )
      ?.ownerId ??
    null
  );
}
