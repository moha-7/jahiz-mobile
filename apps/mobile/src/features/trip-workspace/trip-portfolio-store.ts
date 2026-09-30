import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  createLargeValueSecureStoreAdapter,
} from './jahiz-secure-large-value-storage';
import {
  jahizLocalNamespaceStorageKey,
  TRIP_PORTFOLIO_STORAGE_KEY,
  TRIP_WORKSPACE_STORAGE_KEY,
} from '@/features/local-persistence/jahiz-local-namespace';
import {
  applyServerTripToPortfolio,
} from './jahiz-trip-portfolio-server-adoption';
import { create } from 'zustand';
import {
  createJSONStorage,
  persist,
  type StateStorage,
} from 'zustand/middleware';
import {
  addTripToPortfolio,
  archiveTripInPortfolio,
  createTripPortfolioFromWorkspace,
  migrateTripPortfolioPersistenceJson,
  renameTripInPortfolio,
  replaceTripWorkspace,
  restoreTripInPortfolio,
  setActiveTrip as setActiveTripInPortfolio,
  tripPortfolioSchema,
  tripWorkspaceSchema,
  type ServerTripEnvelope,
  type TripPortfolio,
  type TripWorkspace,
} from '@jahiz/api-contracts';

type WebStorage = {
  getItem: (name: string) => string | null;
  setItem: (
    name: string,
    value: string,
  ) => void;
  removeItem: (name: string) => void;
};

const nativePortfolioStorage =
  createLargeValueSecureStoreAdapter(
    SecureStore,
  );
async function readRawStorage(
  name: string,
): Promise<string | null> {
  if (Platform.OS === 'web') {
    const storage = (
      globalThis as typeof globalThis & {
        localStorage?: WebStorage;
      }
    ).localStorage;

    return storage?.getItem(name) ?? null;
  }

  return nativePortfolioStorage.getItemAsync(name);
}

async function writeRawStorage(
  name: string,
  value: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = (
      globalThis as typeof globalThis & {
        localStorage?: WebStorage;
      }
    ).localStorage;

    storage?.setItem(
      name,
      value,
    );
    return;
  }

  await nativePortfolioStorage.setItemAsync(
    name,
    value,
  );
}

async function removeRawStorage(
  name: string,
): Promise<void> {
  if (Platform.OS === 'web') {
    const storage = (
      globalThis as typeof globalThis & {
        localStorage?: WebStorage;
      }
    ).localStorage;

    storage?.removeItem(name);
    return;
  }

  await nativePortfolioStorage.deleteItemAsync(name);
}

const portfolioStorage: StateStorage = {
  async getItem(name) {
    const current =
      await readRawStorage(
        jahizLocalNamespaceStorageKey(
          name,
        ),
      );

    if (current) {
      return current;
    }

    if (
      name !==
      TRIP_PORTFOLIO_STORAGE_KEY
    ) {
      return null;
    }

    const legacy =
      await readRawStorage(
        jahizLocalNamespaceStorageKey(
          TRIP_WORKSPACE_STORAGE_KEY,
        ),
      );

    return migrateTripPortfolioPersistenceJson(
      legacy,
    );
  },

  async setItem(name, value) {
    await writeRawStorage(
      jahizLocalNamespaceStorageKey(
        name,
      ),
      value,
    );
  },

  async removeItem(name) {
    await removeRawStorage(
      jahizLocalNamespaceStorageKey(
        name,
      ),
    );
  },
};

function createPortfolioLocalId(
  prefix: string,
): string {
  return [
    prefix,
    Date.now().toString(36),
    Math.random()
      .toString(36)
      .slice(2, 10),
  ].join('-');
}

export async function hasPersistedTripPortfolioForActiveNamespace():
  Promise<boolean> {
  return Boolean(
    await portfolioStorage.getItem(
      TRIP_PORTFOLIO_STORAGE_KEY,
    ),
  );
}

function createPortfolioInitialWorkspace(
  currency = 'AED',
): TripWorkspace {
  const now = new Date().toISOString();

  return tripWorkspaceSchema.parse({
    id: createPortfolioLocalId('trip'),
    version: 1,
    currency,
    route: null,
    dates: {
      departureDate: null,
      returnDate: null,
      flexibility: 'fixed',
    },
    funds: {
      availableNow: null,
      expectedBeforeTravel: 0,
      expectedAfterTravel: 0,
      safetyReserve: 0,
      originCommitments: 0,
    },
    moneyInItems: [],
    moneyInReviewed: false,
    commitments: [],
    commitmentsReviewed: false,
    costsReviewed: false,
    costItems: [],
    payments: [],
    createdAt: now,
    updatedAt: now,
  });
}

type AddPortfolioTripInput = {
  workspace: TripWorkspace;
  name?: string | null;
  makeActive?: boolean;
};

interface TripPortfolioState {
  portfolio: TripPortfolio;
  hasHydrated: boolean;
  markHydrated: () => void;
  addTrip: (
    input: AddPortfolioTripInput,
  ) => void;
  replaceTrip: (
    workspace: TripWorkspace,
  ) => void;
  setActiveTrip: (
    tripId: string,
  ) => void;
  renameTrip: (
    tripId: string,
    name: string | null,
  ) => void;
  archiveTrip: (
    tripId: string,
  ) => void;
  restoreTrip: (
    tripId: string,
  ) => void;
  applyServerTrip: (
    trip:
      ServerTripEnvelope,
  ) => void;
  resetPortfolio: (
    currency?: string,
  ) => void;
}

export function createInitialTripPortfolio(
  currency = 'AED',
): TripPortfolio {
  return createTripPortfolioFromWorkspace(
    createPortfolioInitialWorkspace(
      currency,
    ),
  );
}

export const useTripPortfolioStore =
  create<TripPortfolioState>()(
    persist(
      (set, get) => ({
        portfolio:
          createInitialTripPortfolio(),
        hasHydrated: false,

        markHydrated: () => {
          set({
            hasHydrated: true,
          });
        },

        addTrip: ({
          workspace,
          name = null,
          makeActive = true,
        }) => {
          set((state) => ({
            portfolio:
              addTripToPortfolio(
                state.portfolio,
                workspace,
                name,
                makeActive,
              ),
          }));
        },

        replaceTrip: (workspace) => {
          set((state) => ({
            portfolio:
              replaceTripWorkspace(
                state.portfolio,
                workspace,
              ),
          }));
        },

        setActiveTrip: (tripId) => {
          set((state) => ({
            portfolio:
              setActiveTripInPortfolio(
                state.portfolio,
                tripId,
              ),
          }));
        },

        renameTrip: (
          tripId,
          name,
        ) => {
          set((state) => ({
            portfolio:
              renameTripInPortfolio(
                state.portfolio,
                tripId,
                name,
              ),
          }));
        },

        archiveTrip: (tripId) => {
          set((state) => ({
            portfolio:
              archiveTripInPortfolio(
                state.portfolio,
                tripId,
                new Date().toISOString(),
              ),
          }));
        },

        restoreTrip: (tripId) => {
          set((state) => ({
            portfolio:
              restoreTripInPortfolio(
                state.portfolio,
                tripId,
              ),
          }));
        },

        applyServerTrip: (trip) => {
          set((state) => {
            const result =
              applyServerTripToPortfolio(
                state.portfolio,
                trip,
              );

            if (
              result.status ===
                'trip-not-found'
            ) {
              return state;
            }

            if (
              result.status ===
                'empty-after-delete'
            ) {
              return {
                portfolio:
                  createInitialTripPortfolio(
                    result.currency,
                  ),
              };
            }

            return {
              portfolio:
                result.portfolio,
            };
          });
        },


        resetPortfolio: (
          currency =
            get().portfolio.trips[0]
              ?.workspace.currency ??
            'AED',
        ) => {
          set({
            portfolio:
              createInitialTripPortfolio(
                currency,
              ),
          });
        },
      }),
      {
        name:
          TRIP_PORTFOLIO_STORAGE_KEY,
        version: 2,
        storage: createJSONStorage(
          () => portfolioStorage,
        ),
        partialize: (state) => ({
          portfolio: state.portfolio,
        }),
        merge: (
          persistedState,
          currentState,
        ) => {
          const candidate =
            persistedState as
              | Partial<TripPortfolioState>
              | undefined;

          const parsed =
            tripPortfolioSchema.safeParse(
              candidate?.portfolio,
            );

          return {
            ...currentState,
            portfolio: parsed.success
              ? parsed.data
              : currentState.portfolio,
          };
        },
        onRehydrateStorage:
          () => (state) => {
            state?.markHydrated();
          },
      },
    ),
  );
