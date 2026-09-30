import {
  accountJahizLocalNamespace,
  anonymousJahizLocalNamespace,
} from '@/features/local-persistence/jahiz-local-namespace';

import {
  clearPersistedJahizTripPortfolio,
  loadPersistedJahizTripPortfolio,
  savePersistedJahizTripPortfolio,
} from '@/features/local-persistence/jahiz-portfolio-namespace-storage';

import {
  useTripPortfolioStore,
} from '@/features/trip-workspace/trip-portfolio-store';

import {
  createJahizAccountTripPortfolioHttpClient,
} from './jahiz-account-trip-portfolio-http';

import {
  createJahizAnonymousPortfolioAdoptionService,
} from './jahiz-local-portfolio-adoption';

export function createJahizAuthenticatedPortfolioAdoptionRuntime(
  input: {
    ownerId: string;
    apiUrl: string;
    getAuthorizationHeader:
      () => Promise<
        string | null | undefined
      >;
    isActive?: () => boolean;
  },
) {
  const accountNamespace =
    accountJahizLocalNamespace(
      input.ownerId,
    );

  const anonymousNamespace =
    anonymousJahizLocalNamespace();

  const client =
    createJahizAccountTripPortfolioHttpClient({
      baseUrl:
        input.apiUrl,
      getAuthorizationHeader:
        input.getAuthorizationHeader,
    });

  const isActive =
    input.isActive ??
    (() => true);

  return createJahizAnonymousPortfolioAdoptionService({
    isAuthenticated:
      isActive,

    loadAnonymousPortfolio() {
      return loadPersistedJahizTripPortfolio(
        anonymousNamespace,
      );
    },

    getAccountPortfolio() {
      return useTripPortfolioStore
        .getState()
        .portfolio;
    },

    async getRemotePortfolioCount() {
      if (!isActive()) {
        return {
          status:
            'unauthorized',
        } as const;
      }

      const result =
        await client.listTrips();

      return result.status ===
        'available'
        ? {
            status:
              'available' as const,
            tripCount:
              result.trips.length,
          }
        : {
            status:
              result.status,
          };
    },

    saveAccountPortfolio(
      portfolio,
    ) {
      return savePersistedJahizTripPortfolio(
        accountNamespace,
        portfolio,
      );
    },

    applyAccountPortfolio(
      portfolio,
    ) {
      if (!isActive()) {
        return;
      }

      useTripPortfolioStore
        .setState({
          portfolio,
          hasHydrated: true,
        });
    },

    clearAnonymousPortfolio() {
      return clearPersistedJahizTripPortfolio(
        anonymousNamespace,
      );
    },
  });
}
