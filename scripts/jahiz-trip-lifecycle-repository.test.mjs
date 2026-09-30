import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test, {
  after,
  before,
} from 'node:test';

import {
  createPostgresPool,
} from '../apps/api/src/db.mjs';

import {
  createTripRepository,
} from '../apps/api/src/trip-repository.mjs';


const pool =
  createPostgresPool();

const repository =
  createTripRepository(
    pool,
  );


const migrationPaths = [
  new URL(
    '../infrastructure/postgres/001_jahiz_server_truth.sql',
    import.meta.url,
  ),
  new URL(
    '../infrastructure/postgres/002_jahiz_identity.sql',
    import.meta.url,
  ),
  new URL(
    '../infrastructure/postgres/003_jahiz_trip_owner_integrity.sql',
    import.meta.url,
  ),
  new URL(
    '../infrastructure/postgres/004_jahiz_trip_lifecycle.sql',
    import.meta.url,
  ),
  new URL(
    '../infrastructure/postgres/005_jahiz_trip_tombstone.sql',
    import.meta.url,
  ),
  new URL(
    '../infrastructure/postgres/006_jahiz_trip_mutation_identity.sql',
    import.meta.url,
  ),
];


function workspace(
  id,
) {
  return {
    id,
    version: 1,
    currency: 'AED',
    route: null,

    dates: {
      departureDate: null,
      returnDate: null,
      flexibility: 'fixed',
    },

    profile: {
      travelStyle: 'smart',
      travelStyleConfirmed: true,
      purpose: 'leisure',

      travelers: {
        adults: 1,
        children: 0,
      },
    },

    funds: {
      availableNow: 5000,
      expectedBeforeTravel: 0,
      safetyReserve: 1000,
      originCommitments: 0,
    },

    costItems: [],
    payments: [],
    commitments: [],
    moneyIn: [],

    createdAt:
      '2026-08-31T08:00:00.000Z',

    updatedAt:
      '2026-08-31T08:00:00.000Z',
  };
}


async function ensureOwner(
  ownerId,
) {
  await pool.query(
    `
      INSERT INTO jahiz_user (
        id,
        status
      )
      VALUES (
        $1,
        'active'
      )
      ON CONFLICT (id)
      DO NOTHING
    `,
    [ownerId],
  );
}


async function createTrip(
  ownerId,
  tripId,
  mutationId,
) {
  await ensureOwner(
    ownerId,
  );

  const result =
    await repository.createTrip({
      ownerId,
      clientMutationId:
        mutationId,
      workspace:
        workspace(
          tripId,
        ),
      serverUpdatedAt:
        new Date(
          '2026-08-31T08:00:00.000Z',
        ),
    });

  assert.equal(
    result.status,
    'applied',
  );

  return result;
}


before(async () => {
  for (
    const migrationPath
    of migrationPaths
  ) {
    await pool.query(
      await fs.readFile(
        migrationPath,
        'utf8',
      ),
    );
  }

  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id LIKE 'm93b1-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm93b1-%'
    `,
  );
});


after(async () => {
  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id LIKE 'm93b1-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm93b1-%'
    `,
  );

  await pool.end();
});


test(
  'repository archives a trip with CAS and snapshots lifecycle revision',
  async () => {
    const ownerId =
      'm93b1-archive-owner';

    const tripId =
      'm93b1-archive-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b1-create-archive-0001',
    );

    const archivedAt =
      new Date(
        '2026-08-31T08:10:00.000Z',
      );

    const result =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93b1-archive-0001',
          targetStatus:
            'archived',
          serverUpdatedAt:
            archivedAt,
        });

    assert.equal(
      result.status,
      'applied',
    );

    assert.equal(
      result.idempotentReplay,
      false,
    );

    assert.equal(
      result.trip.revision,
      1,
    );

    assert.deepEqual(
      result.trip.lifecycle,
      {
        status:
          'archived',

        archivedAt:
          '2026-08-31T08:10:00.000Z',
      },
    );

    assert.equal(
      result.trip.workspace.id,
      tripId,
    );

    const revision =
      await pool.query(
        `
          SELECT
            lifecycle_status,
            archived_at,
            workspace
          FROM jahiz_trip_revision
          WHERE trip_id = $1
            AND revision = 1
        `,
        [tripId],
      );

    assert.equal(
      revision.rowCount,
      1,
    );

    assert.equal(
      revision.rows[0]
        .lifecycle_status,
      'archived',
    );

    assert.equal(
      new Date(
        revision.rows[0]
          .archived_at,
      ).toISOString(),
      archivedAt.toISOString(),
    );

    assert.equal(
      revision.rows[0]
        .workspace.id,
      tripId,
    );
  },
);


test(
  'repository restores an archived trip and clears archived timestamp',
  async () => {
    const ownerId =
      'm93b1-restore-owner';

    const tripId =
      'm93b1-restore-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b1-create-restore-0001',
    );

    const archived =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93b1-archive-restore-0001',
          targetStatus:
            'archived',
          serverUpdatedAt:
            new Date(
              '2026-08-31T08:20:00.000Z',
            ),
        });

    assert.equal(
      archived.status,
      'applied',
    );

    const restored =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 1,
          clientMutationId:
            'm93b1-restore-0001',
          targetStatus:
            'active',
          serverUpdatedAt:
            new Date(
              '2026-08-31T08:21:00.000Z',
            ),
        });

    assert.equal(
      restored.status,
      'applied',
    );

    assert.equal(
      restored.trip.revision,
      2,
    );

    assert.deepEqual(
      restored.trip.lifecycle,
      {
        status:
          'active',
        archivedAt:
          null,
      },
    );

    const revision =
      await pool.query(
        `
          SELECT
            lifecycle_status,
            archived_at
          FROM jahiz_trip_revision
          WHERE trip_id = $1
            AND revision = 2
        `,
        [tripId],
      );

    assert.equal(
      revision.rows[0]
        .lifecycle_status,
      'active',
    );

    assert.equal(
      revision.rows[0]
        .archived_at,
      null,
    );
  },
);


test(
  'stale lifecycle revision returns canonical current lifecycle trip',
  async () => {
    const ownerId =
      'm93b1-stale-owner';

    const tripId =
      'm93b1-stale-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b1-create-stale-0001',
    );

    const archived =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93b1-stale-archive-0001',
          targetStatus:
            'archived',
        });

    assert.equal(
      archived.status,
      'applied',
    );

    const stale =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93b1-stale-restore-0001',
          targetStatus:
            'active',
        });

    assert.equal(
      stale.status,
      'conflict',
    );

    assert.equal(
      stale.expectedRevision,
      0,
    );

    assert.equal(
      stale.trip.revision,
      1,
    );

    assert.equal(
      stale.trip.lifecycle.status,
      'archived',
    );
  },
);


test(
  'repeated lifecycle target is rejected without creating a revision',
  async () => {
    const ownerId =
      'm93b1-repeat-owner';

    const tripId =
      'm93b1-repeat-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b1-create-repeat-0001',
    );

    const result =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93b1-repeat-active-0001',
          targetStatus:
            'active',
        });

    assert.equal(
      result.status,
      'invalid_transition',
    );

    assert.equal(
      result.trip.revision,
      0,
    );

    const mutation =
      await pool.query(
        `
          SELECT
            COUNT(*)::int AS count
          FROM jahiz_trip_revision
          WHERE trip_id = $1
            AND client_mutation_id = $2
        `,
        [
          tripId,
          'm93b1-repeat-active-0001',
        ],
      );

    assert.equal(
      mutation.rows[0].count,
      0,
    );
  },
);


test(
  'replaying a lifecycle mutation is idempotent',
  async () => {
    const ownerId =
      'm93b1-replay-owner';

    const tripId =
      'm93b1-replay-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b1-create-replay-0001',
    );

    const request = {
      ownerId,
      tripId,
      expectedRevision: 0,

      clientMutationId:
        'm93b1-replay-archive-0001',

      targetStatus:
        'archived',

      serverUpdatedAt:
        new Date(
          '2026-08-31T08:30:00.000Z',
        ),
    };

    const first =
      await repository
        .transitionTripLifecycle(
          request,
        );

    const replay =
      await repository
        .transitionTripLifecycle(
          request,
        );

    assert.equal(
      first.status,
      'applied',
    );

    assert.equal(
      replay.status,
      'applied',
    );

    assert.equal(
      replay.idempotentReplay,
      true,
    );

    assert.equal(
      replay.trip.revision,
      first.trip.revision,
    );

    assert.deepEqual(
      replay.trip.lifecycle,
      first.trip.lifecycle,
    );

    const mutation =
      await pool.query(
        `
          SELECT
            COUNT(*)::int AS count
          FROM jahiz_trip_revision
          WHERE trip_id = $1
            AND client_mutation_id = $2
        `,
        [
          tripId,
          request.clientMutationId,
        ],
      );

    assert.equal(
      mutation.rows[0].count,
      1,
    );
  },
);


test(
  'owner isolation prevents lifecycle mutation across accounts',
  async () => {
    const ownerId =
      'm93b1-owner-a';

    const tripId =
      'm93b1-isolation-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b1-create-isolation-0001',
    );

    const result =
      await repository
        .transitionTripLifecycle({
          ownerId:
            'm93b1-owner-b',

          tripId,
          expectedRevision: 0,

          clientMutationId:
            'm93b1-isolation-archive-0001',

          targetStatus:
            'archived',
        });

    assert.equal(
      result.status,
      'conflict',
    );

    assert.equal(
      result.trip,
      null,
    );

    const stored =
      await pool.query(
        `
          SELECT
            revision,
            lifecycle_status,
            archived_at
          FROM jahiz_trip
          WHERE id = $1
            AND owner_id = $2
        `,
        [
          tripId,
          ownerId,
        ],
      );

    assert.equal(
      Number(
        stored.rows[0]
          .revision,
      ),
      0,
    );

    assert.equal(
      stored.rows[0]
        .lifecycle_status,
      'active',
    );

    assert.equal(
      stored.rows[0]
        .archived_at,
      null,
    );
  },
);

test(
  'portfolio lifecycle filter defaults active and can select archived or all',
  async () => {
    const ownerId =
      'm93b1-filter-owner';

    const activeTripId =
      'm93b1-filter-active';

    const archivedTripId =
      'm93b1-filter-archived';

    await createTrip(
      ownerId,
      activeTripId,
      'm93b1-filter-create-active-0001',
    );

    await createTrip(
      ownerId,
      archivedTripId,
      'm93b1-filter-create-archived-0001',
    );

    await repository
      .transitionTripLifecycle({
        ownerId,
        tripId:
          archivedTripId,
        expectedRevision: 0,
        clientMutationId:
          'm93b1-filter-archive-0001',
        targetStatus:
          'archived',
      });

    const active =
      await repository.listTrips(
        ownerId,
      );

    const archived =
      await repository.listTrips(
        ownerId,
        'archived',
      );

    const all =
      await repository.listTrips(
        ownerId,
        'all',
      );

    assert.deepEqual(
      active.map(
        (trip) => trip.tripId,
      ),
      [activeTripId],
    );

    assert.deepEqual(
      archived.map(
        (trip) => trip.tripId,
      ),
      [archivedTripId],
    );

    assert.deepEqual(
      new Set(
        all.map(
          (trip) => trip.tripId,
        ),
      ),
      new Set([
        activeTripId,
        archivedTripId,
      ]),
    );

    assert.equal(
      archived[0]
        .lifecycle.status,
      'archived',
    );
  },
);

test(
  'workspace mutation cannot modify an archived trip',
  async () => {
    const ownerId =
      'm93b1-readonly-owner';

    const tripId =
      'm93b1-readonly-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b1-readonly-create-0001',
    );

    const archived =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93b1-readonly-archive-0001',
          targetStatus:
            'archived',
        });

    assert.equal(
      archived.status,
      'applied',
    );

    const changed =
      workspace(tripId);

    changed.funds.availableNow =
      9900;

    const result =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 1,
        clientMutationId:
          'm93b1-readonly-update-0001',
        workspace:
          changed,
      });

    assert.equal(
      result.status,
      'conflict',
    );

    assert.equal(
      result.trip.revision,
      1,
    );

    assert.equal(
      result.trip.lifecycle.status,
      'archived',
    );

    assert.equal(
      result.trip.workspace.funds
        .availableNow,
      5000,
    );

    const stored =
      await pool.query(
        `
          SELECT
            revision,
            lifecycle_status,
            workspace
          FROM jahiz_trip
          WHERE id = $1
            AND owner_id = $2
        `,
        [
          tripId,
          ownerId,
        ],
      );

    assert.equal(
      Number(
        stored.rows[0].revision,
      ),
      1,
    );

    assert.equal(
      stored.rows[0]
        .lifecycle_status,
      'archived',
    );

    assert.equal(
      stored.rows[0]
        .workspace.funds
        .availableNow,
      5000,
    );
  },
);
