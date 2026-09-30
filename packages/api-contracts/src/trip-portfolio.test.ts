import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addTripToPortfolio,
  archiveTripInPortfolio,
  createTripPortfolioFromWorkspace,
  createTripPortfolioPersistedEnvelope,
  deriveTripLifecycle,
  migrateTripPortfolioPersistence,
  migrateTripPortfolioPersistenceJson,
  replaceTripWorkspace,
  restoreTripInPortfolio,
  selectActiveTripRecord,
  setActiveTrip,
  tripPortfolioSchema,
  tripWorkspaceSchema,
  type TripWorkspace,
} from './index.ts';

const timestamp =
  '2026-08-13T00:00:00.000Z';

function makeWorkspace(
  id: string,
  departureDate: string | null = null,
  returnDate: string | null = null,
): TripWorkspace {
  return tripWorkspaceSchema.parse({
    id,
    version: 1,
    currency: 'AED',
    route: null,
    dates: {
      departureDate,
      returnDate,
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
    costItems: [],
    payments: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

test(
  'legacy single workspace becomes one active portfolio trip',
  () => {
    const workspace =
      makeWorkspace('trip-1');
    const portfolio =
      createTripPortfolioFromWorkspace(
        workspace,
      );

    assert.equal(
      portfolio.activeTripId,
      'trip-1',
    );
    assert.equal(
      portfolio.trips.length,
      1,
    );
    assert.equal(
      selectActiveTripRecord(
        portfolio,
      )?.workspace.id,
      'trip-1',
    );
  },
);

test(
  'portfolio rejects duplicate trip ids',
  () => {
    const workspace =
      makeWorkspace('trip-1');

    const result =
      tripPortfolioSchema.safeParse({
        version: 1,
        activeTripId: 'trip-1',
        trips: [
          {
            workspace,
            name: null,
            archivedAt: null,
          },
          {
            workspace,
            name: null,
            archivedAt: null,
          },
        ],
      });

    assert.equal(
      result.success,
      false,
    );
  },
);

test(
  'portfolio rejects missing active trip references',
  () => {
    const result =
      tripPortfolioSchema.safeParse({
        version: 1,
        activeTripId: 'missing',
        trips: [
          {
            workspace:
              makeWorkspace('trip-1'),
            name: null,
            archivedAt: null,
          },
        ],
      });

    assert.equal(
      result.success,
      false,
    );
  },
);

test(
  'adding and switching trips preserves isolated workspaces',
  () => {
    const first =
      makeWorkspace('trip-1');
    const second =
      makeWorkspace(
        'trip-2',
        '2026-09-10',
        '2026-09-17',
      );

    const withSecond =
      addTripToPortfolio(
        createTripPortfolioFromWorkspace(
          first,
        ),
        second,
        'Cairo',
        false,
      );

    assert.equal(
      withSecond.activeTripId,
      'trip-1',
    );
    assert.equal(
      withSecond.trips.length,
      2,
    );

    const switched =
      setActiveTrip(
        withSecond,
        'trip-2',
      );

    assert.equal(
      switched.activeTripId,
      'trip-2',
    );
    assert.equal(
      selectActiveTripRecord(
        switched,
      )?.workspace.dates
        .departureDate,
      '2026-09-10',
    );
  },
);

test(
  'replacing a workspace updates only its trip snapshot',
  () => {
    const first =
      makeWorkspace('trip-1');
    const second =
      makeWorkspace('trip-2');

    const portfolio =
      addTripToPortfolio(
        createTripPortfolioFromWorkspace(
          first,
        ),
        second,
        null,
        false,
      );

    const changed =
      tripWorkspaceSchema.parse({
        ...second,
        funds: {
          ...second.funds,
          safetyReserve: 500,
        },
      });

    const next =
      replaceTripWorkspace(
        portfolio,
        changed,
      );

    assert.equal(
      next.trips.find(
        (record) =>
          record.workspace.id ===
          'trip-1',
      )?.workspace.funds
        .safetyReserve,
      0,
    );
    assert.equal(
      next.trips.find(
        (record) =>
          record.workspace.id ===
          'trip-2',
      )?.workspace.funds
        .safetyReserve,
      500,
    );
  },
);

test(
  'archiving the active trip selects another unarchived trip',
  () => {
    const first =
      makeWorkspace('trip-1');
    const second =
      makeWorkspace('trip-2');

    const portfolio =
      addTripToPortfolio(
        createTripPortfolioFromWorkspace(
          first,
        ),
        second,
      );

    assert.equal(
      portfolio.activeTripId,
      'trip-2',
    );

    const archived =
      archiveTripInPortfolio(
        portfolio,
        'trip-2',
        timestamp,
      );

    assert.equal(
      archived.activeTripId,
      'trip-1',
    );
    assert.equal(
      archived.trips.find(
        (record) =>
          record.workspace.id ===
          'trip-2',
      )?.archivedAt,
      timestamp,
    );
  },
);

test(
  'restoring a trip makes it active when no active trip exists',
  () => {
    const only =
      createTripPortfolioFromWorkspace(
        makeWorkspace('trip-1'),
      );

    const archived =
      archiveTripInPortfolio(
        only,
        'trip-1',
        timestamp,
      );

    assert.equal(
      archived.activeTripId,
      null,
    );

    const restored =
      restoreTripInPortfolio(
        archived,
        'trip-1',
      );

    assert.equal(
      restored.activeTripId,
      'trip-1',
    );
  },
);

test(
  'trip lifecycle is deterministic from dates and archive state',
  () => {
    const draft =
      createTripPortfolioFromWorkspace(
        makeWorkspace('draft'),
      ).trips[0];

    const upcoming =
      createTripPortfolioFromWorkspace(
        makeWorkspace(
          'upcoming',
          '2026-09-10',
          '2026-09-17',
        ),
      ).trips[0];

    const active =
      createTripPortfolioFromWorkspace(
        makeWorkspace(
          'active',
          '2026-08-10',
          '2026-08-20',
        ),
      ).trips[0];

    const completed =
      createTripPortfolioFromWorkspace(
        makeWorkspace(
          'completed',
          '2026-07-01',
          '2026-07-08',
        ),
      ).trips[0];

    assert.equal(
      deriveTripLifecycle(
        draft,
        '2026-08-13',
      ),
      'draft',
    );
    assert.equal(
      deriveTripLifecycle(
        upcoming,
        '2026-08-13',
      ),
      'upcoming',
    );
    assert.equal(
      deriveTripLifecycle(
        active,
        '2026-08-13',
      ),
      'in-progress',
    );
    assert.equal(
      deriveTripLifecycle(
        completed,
        '2026-08-13',
      ),
      'completed',
    );

    const archived =
      archiveTripInPortfolio(
        createTripPortfolioFromWorkspace(
          makeWorkspace(
            'archived',
            '2026-09-10',
            '2026-09-17',
          ),
        ),
        'archived',
        timestamp,
      ).trips[0];

    assert.equal(
      deriveTripLifecycle(
        archived,
        '2026-08-13',
      ),
      'archived',
    );
  },
);

test(
  'legacy persisted workspace migrates without changing trip data',
  () => {
    const workspace =
      makeWorkspace(
        'legacy-trip',
        '2026-09-10',
        '2026-09-17',
      );

    const portfolio =
      migrateTripPortfolioPersistence({
        state: {
          workspace,
        },
        version: 1,
      });

    assert.ok(portfolio);
    assert.equal(
      portfolio.activeTripId,
      'legacy-trip',
    );
    assert.deepEqual(
      portfolio.trips[0]?.workspace,
      workspace,
    );
  },
);

test(
  'current portfolio persistence round-trips as version 2',
  () => {
    const portfolio =
      createTripPortfolioFromWorkspace(
        makeWorkspace('trip-1'),
      );

    const envelope =
      createTripPortfolioPersistedEnvelope(
        portfolio,
      );

    assert.equal(
      envelope.version,
      2,
    );

    assert.deepEqual(
      migrateTripPortfolioPersistence(
        envelope,
      ),
      portfolio,
    );
  },
);

test(
  'legacy persistence json is rewritten into portfolio v2 json',
  () => {
    const workspace =
      makeWorkspace('legacy-json');

    const migratedJson =
      migrateTripPortfolioPersistenceJson(
        JSON.stringify({
          state: {
            workspace,
          },
          version: 1,
        }),
      );

    assert.ok(migratedJson);

    const parsed = JSON.parse(
      migratedJson,
    ) as {
      state: {
        portfolio: {
          activeTripId: string | null;
        };
      };
      version: number;
    };

    assert.equal(
      parsed.version,
      2,
    );
    assert.equal(
      parsed.state.portfolio.activeTripId,
      'legacy-json',
    );
  },
);

test(
  'invalid persistence payloads fail closed',
  () => {
    assert.equal(
      migrateTripPortfolioPersistence(
        {
          state: {
            workspace: {
              invalid: true,
            },
          },
        },
      ),
      null,
    );

    assert.equal(
      migrateTripPortfolioPersistenceJson(
        '{not-json',
      ),
      null,
    );
  },
);
