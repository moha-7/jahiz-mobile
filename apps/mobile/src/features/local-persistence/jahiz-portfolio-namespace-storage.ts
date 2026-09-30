import {
  Platform,
} from 'react-native';
import * as SecureStore
  from 'expo-secure-store';

import {
  createTripPortfolioPersistedEnvelope,
  migrateTripPortfolioPersistence,
  tripPortfolioSchema,
  type TripPortfolio,
} from '@jahiz/api-contracts';

import {
  createLargeValueSecureStoreAdapter,
} from '@/features/trip-workspace/jahiz-secure-large-value-storage';

import {
  jahizLocalNamespaceStorageKey,
  TRIP_PORTFOLIO_STORAGE_KEY,
  TRIP_WORKSPACE_STORAGE_KEY,
  type JahizLocalNamespace,
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

const nativeStorage =
  createLargeValueSecureStoreAdapter(
    SecureStore,
  );

function webStorage():
  WebStorage | undefined {
  return (
    globalThis as
      typeof globalThis & {
        localStorage?: WebStorage;
      }
  ).localStorage;
}

async function readValue(
  key: string,
): Promise<string | null> {
  if (Platform.OS === 'web') {
    return (
      webStorage()?.getItem(key) ??
      null
    );
  }

  return nativeStorage
    .getItemAsync(key);
}

async function writeValue(
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

  await nativeStorage
    .setItemAsync(
      key,
      value,
    );
}

async function removeValue(
  key: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    webStorage()?.removeItem(key);
    return;
  }

  await nativeStorage
    .deleteItemAsync(key);
}

function parsePersistedPortfolio(
  raw: string | null,
): TripPortfolio | null {
  if (!raw) {
    return null;
  }

  try {
    return migrateTripPortfolioPersistence(
      JSON.parse(raw),
    );
  } catch {
    return null;
  }
}

export async function loadPersistedJahizTripPortfolio(
  namespace:
    JahizLocalNamespace,
): Promise<TripPortfolio | null> {
  const portfolioKey =
    jahizLocalNamespaceStorageKey(
      TRIP_PORTFOLIO_STORAGE_KEY,
      namespace,
    );

  const direct =
    parsePersistedPortfolio(
      await readValue(
        portfolioKey,
      ),
    );

  if (direct) {
    return direct;
  }

  const workspaceKey =
    jahizLocalNamespaceStorageKey(
      TRIP_WORKSPACE_STORAGE_KEY,
      namespace,
    );

  return parsePersistedPortfolio(
    await readValue(
      workspaceKey,
    ),
  );
}

export async function savePersistedJahizTripPortfolio(
  namespace:
    JahizLocalNamespace,
  portfolioInput:
    TripPortfolio,
): Promise<void> {
  const portfolio =
    tripPortfolioSchema.parse(
      portfolioInput,
    );

  await writeValue(
    jahizLocalNamespaceStorageKey(
      TRIP_PORTFOLIO_STORAGE_KEY,
      namespace,
    ),
    JSON.stringify(
      createTripPortfolioPersistedEnvelope(
        portfolio,
      ),
    ),
  );
}

export async function clearPersistedJahizTripPortfolio(
  namespace:
    JahizLocalNamespace,
): Promise<void> {
  // Clear both canonical portfolio persistence and the legacy workspace mirror
  // so a later migration fallback cannot resurrect an already-adopted copy.
  await Promise.all([
    removeValue(
      jahizLocalNamespaceStorageKey(
        TRIP_PORTFOLIO_STORAGE_KEY,
        namespace,
      ),
    ),
    removeValue(
      jahizLocalNamespaceStorageKey(
        TRIP_WORKSPACE_STORAGE_KEY,
        namespace,
      ),
    ),
  ]);
}
