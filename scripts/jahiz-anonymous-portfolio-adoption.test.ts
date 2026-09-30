import assert from 'node:assert/strict';
import test from 'node:test';

import {
  serverTripEnvelopeSchema,
  tripPortfolioSchema,
  tripWorkspaceSchema,
  type TripPortfolio,
} from '../packages/api-contracts/src/index.ts';

import {
  assessJahizAnonymousPortfolioAdoption,
  createJahizAdoptableAnonymousPortfolio,
  createJahizAnonymousPortfolioAdoptionService,
  isJahizTripRecordMeaningful,
} from '../apps/mobile/src/features/auth/jahiz-local-portfolio-adoption.ts';

import {
  createJahizAccountTripPortfolioHttpClient,
} from '../apps/mobile/src/features/auth/jahiz-account-trip-portfolio-http.ts';

function workspace(
  id: string,
  availableNow:
    number | null = null,
) {
  return tripWorkspaceSchema.parse({
    id,
    version: 1,
    currency: 'AED',
    route: null,
    dates: {
      departureDate: null,
      returnDate: null,
      flexibility: 'fixed',
    },
    funds: {
      availableNow,
      expectedBeforeTravel: 0,
      expectedAfterTravel: 0,
      safetyReserve: 0,
      originCommitments: 0,
    },
    moneyInItems: [],
    moneyInReviewed: false,
    commitments: [],
    commitmentsReviewed: false,
    costItems: [],
    payments: [],
    createdAt:
      '2026-09-02T09:00:00.000Z',
    updatedAt:
      '2026-09-02T09:00:00.000Z',
  });
}

function portfolio(
  id: string,
  meaningful = false,
): TripPortfolio {
  return tripPortfolioSchema.parse({
    version: 1,
    activeTripId: id,
    trips: [
      {
        workspace:
          workspace(
            id,
            meaningful
              ? 5000
              : null,
          ),
        name: null,
        archivedAt: null,
      },
    ],
  });
}

test(
  'blank anonymous default workspace is not treated as an adoption candidate',
  () => {
    const blank =
      portfolio(
        'anonymous-blank',
        false,
      );

    assert.equal(
      isJahizTripRecordMeaningful(
        blank.trips[0]!,
      ),
      false,
    );

    assert.equal(
      createJahizAdoptableAnonymousPortfolio(
        blank,
      ),
      null,
    );
  },
);

test(
  'anonymous plans are offered only when both account-local and remote account truth are empty',
  () => {
    const anonymous =
      portfolio(
        'anonymous-plan',
        true,
      );

    const account =
      portfolio(
        'account-blank',
        false,
      );

    const offer =
      assessJahizAnonymousPortfolioAdoption({
        isAuthenticated: true,
        anonymousPortfolio:
          anonymous,
        accountPortfolio:
          account,
        remoteTripCount: 0,
      });

    assert.equal(
      offer.status,
      'offer-local-adoption',
    );
    assert.equal(
      offer.candidateTripCount,
      1,
    );

    const remoteDivergence =
      assessJahizAnonymousPortfolioAdoption({
        isAuthenticated: true,
        anonymousPortfolio:
          anonymous,
        accountPortfolio:
          account,
        remoteTripCount: 1,
      });

    assert.equal(
      remoteDivergence.status,
      'merge-required',
    );

    const localDivergence =
      assessJahizAnonymousPortfolioAdoption({
        isAuthenticated: true,
        anonymousPortfolio:
          anonymous,
        accountPortfolio:
          portfolio(
            'account-local-plan',
            true,
          ),
        remoteTripCount: 0,
      });

    assert.equal(
      localDivergence.status,
      'merge-required',
    );
  },
);

test(
  'adoption durably saves account copy before clearing anonymous source',
  async () => {
    const anonymous =
      portfolio(
        'anonymous-adopt',
        true,
      );

    const account =
      portfolio(
        'account-blank',
        false,
      );

    const order:
      string[] = [];

    let applied:
      TripPortfolio | null =
        null;

    const service =
      createJahizAnonymousPortfolioAdoptionService({
        isAuthenticated:
          () => true,

        async loadAnonymousPortfolio() {
          return anonymous;
        },

        getAccountPortfolio() {
          return account;
        },

        async getRemotePortfolioCount() {
          return {
            status: 'available',
            tripCount: 0,
          };
        },

        async saveAccountPortfolio(
          next,
        ) {
          order.push('save-account');
          assert.equal(
            next.trips[0]
              ?.workspace.id,
            'anonymous-adopt',
          );
        },

        applyAccountPortfolio(
          next,
        ) {
          order.push('apply-account');
          applied = next;
        },

        async clearAnonymousPortfolio() {
          order.push(
            'clear-anonymous',
          );
        },
      });

    const result =
      await service.adopt();

    assert.equal(
      result.status,
      'applied',
    );
    assert.deepEqual(
      order,
      [
        'save-account',
        'apply-account',
        'clear-anonymous',
      ],
    );
    assert.equal(
      applied?.trips[0]
        ?.workspace.id,
      'anonymous-adopt',
    );
  },
);

test(
  'anonymous source cleanup failure retains duplicate safely instead of failing the account copy',
  async () => {
    const service =
      createJahizAnonymousPortfolioAdoptionService({
        isAuthenticated:
          () => true,

        async loadAnonymousPortfolio() {
          return portfolio(
            'anonymous-safe-copy',
            true,
          );
        },

        getAccountPortfolio() {
          return portfolio(
            'account-blank',
            false,
          );
        },

        async getRemotePortfolioCount() {
          return {
            status: 'available',
            tripCount: 0,
          };
        },

        async saveAccountPortfolio() {
          // Account copy is durable first.
        },

        applyAccountPortfolio() {
          // Runtime copy follows durable write.
        },

        async clearAnonymousPortfolio() {
          throw new Error(
            'simulated cleanup failure',
          );
        },
      });

    const result =
      await service.adopt();

    assert.equal(
      result.status,
      'applied',
    );

    if (
      result.status ===
        'applied'
    ) {
      assert.equal(
        result.sourceCleared,
        false,
      );
    }
  },
);

test(
  'remote uncertainty fails closed without adopting or clearing local plans',
  async () => {
    let saved = false;
    let cleared = false;

    const service =
      createJahizAnonymousPortfolioAdoptionService({
        isAuthenticated:
          () => true,

        async loadAnonymousPortfolio() {
          return portfolio(
            'anonymous-offline',
            true,
          );
        },

        getAccountPortfolio() {
          return portfolio(
            'account-blank',
            false,
          );
        },

        async getRemotePortfolioCount() {
          return {
            status:
              'unavailable',
          };
        },

        async saveAccountPortfolio() {
          saved = true;
        },

        applyAccountPortfolio() {
          saved = true;
        },

        async clearAnonymousPortfolio() {
          cleared = true;
        },
      });

    const result =
      await service.adopt();

    assert.equal(
      result.status,
      'remote-unavailable',
    );
    assert.equal(saved, false);
    assert.equal(
      cleared,
      false,
    );
  },
);

test(
  'account portfolio client requests all canonical trips and validates response',
  async () => {
    const trip =
      serverTripEnvelopeSchema.parse({
        tripId:
          'remote-account-trip',
        ownerId:
          'owner-adoption',
        revision: 2,
        lifecycle: {
          status: 'active',
          archivedAt: null,
          deletedAt: null,
        },
        workspace:
          workspace(
            'remote-account-trip',
            4000,
          ),
        serverUpdatedAt:
          '2026-09-02T09:10:00.000Z',
      });

    let requestedUrl = '';
    let authorization = '';

    const client =
      createJahizAccountTripPortfolioHttpClient({
        baseUrl:
          'http://127.0.0.1:4010/',
        async getAuthorizationHeader() {
          return 'Bearer test-token';
        },
        async fetchImpl(
          url,
          init,
        ) {
          requestedUrl = url;
          authorization =
            init?.headers
              ?.Authorization ??
            '';

          return {
            status: 200,
            async json() {
              return {
                data: [trip],
              };
            },
          };
        },
      });

    const result =
      await client.listTrips();

    assert.equal(
      requestedUrl,
      'http://127.0.0.1:4010/v1/trips?status=all',
    );
    assert.equal(
      authorization,
      'Bearer test-token',
    );
    assert.equal(
      result.status,
      'available',
    );

    if (
      result.status ===
        'available'
    ) {
      assert.equal(
        result.trips.length,
        1,
      );
    }
  },
);

test(
  'account portfolio client fails closed on missing auth or malformed server response',
  async () => {
    const unauthorized =
      createJahizAccountTripPortfolioHttpClient({
        baseUrl:
          'http://127.0.0.1:4010',
        async getAuthorizationHeader() {
          return null;
        },
        async fetchImpl() {
          throw new Error(
            'network must not run without auth',
          );
        },
      });

    assert.equal(
      (
        await unauthorized
          .listTrips()
      ).status,
      'unauthorized',
    );

    const malformed =
      createJahizAccountTripPortfolioHttpClient({
        baseUrl:
          'http://127.0.0.1:4010',
        async getAuthorizationHeader() {
          return 'Bearer test-token';
        },
        async fetchImpl() {
          return {
            status: 200,
            async json() {
              return {
                data: [
                  {
                    bad: true,
                  },
                ],
              };
            },
          };
        },
      });

    assert.equal(
      (
        await malformed
          .listTrips()
      ).status,
      'invalid-response',
    );
  },
);
