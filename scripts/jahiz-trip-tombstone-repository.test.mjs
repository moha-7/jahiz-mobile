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
  availableNow = 5000,
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
      availableNow,
      expectedBeforeTravel: 0,
      safetyReserve: 1000,
      originCommitments: 0,
    },

    costItems: [],
    payments: [],
    commitments: [],
    moneyIn: [],

    createdAt:
      '2026-08-31T10:00:00.000Z',

    updatedAt:
      '2026-08-31T10:00:00.000Z',
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
      WHERE id LIKE 'm93c1-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm93c1-%'
    `,
  );
});


after(async () => {
  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id LIKE 'm93c1-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm93c1-%'
    `,
  );

  await pool.end();
});


test(
  'active trip deletion creates a revisioned tombstone',
  async () => {
    const ownerId =
      'm93c1-delete-owner';

    const tripId =
      'm93c1-delete-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c1-create-delete-0001',
    );

    const deletedAt =
      new Date(
        '2026-08-31T10:10:00.000Z',
      );

    const deleted =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93c1-delete-0001',
          targetStatus:
            'deleted',
          serverUpdatedAt:
            deletedAt,
        });

    assert.equal(
      deleted.status,
      'applied',
    );

    assert.equal(
      deleted.trip.revision,
      1,
    );

    assert.deepEqual(
      deleted.trip.lifecycle,
      {
        status:
          'deleted',
        archivedAt:
          null,
        deletedAt:
          deletedAt.toISOString(),
      },
    );

    const revision =
      await pool.query(
        `
          SELECT
            lifecycle_status,
            archived_at,
            deleted_at
          FROM jahiz_trip_revision
          WHERE trip_id = $1
            AND revision = 1
        `,
        [tripId],
      );

    assert.equal(
      revision.rows[0]
        .lifecycle_status,
      'deleted',
    );

    assert.equal(
      revision.rows[0]
        .archived_at,
      null,
    );

    assert.equal(
      new Date(
        revision.rows[0]
          .deleted_at,
      ).toISOString(),
      deletedAt.toISOString(),
    );
  },
);


test(
  'archived trip can transition into a tombstone',
  async () => {
    const ownerId =
      'm93c1-archived-delete-owner';

    const tripId =
      'm93c1-archived-delete-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c1-create-archived-delete-0001',
    );

    const archived =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93c1-archive-before-delete-0001',
          targetStatus:
            'archived',
        });

    assert.equal(
      archived.status,
      'applied',
    );

    const deleted =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 1,
          clientMutationId:
            'm93c1-delete-after-archive-0001',
          targetStatus:
            'deleted',
        });

    assert.equal(
      deleted.status,
      'applied',
    );

    assert.equal(
      deleted.trip.revision,
      2,
    );

    assert.equal(
      deleted.trip.lifecycle.status,
      'deleted',
    );

    assert.equal(
      deleted.trip.lifecycle.archivedAt,
      null,
    );

    assert.equal(
      typeof deleted.trip.lifecycle.deletedAt,
      'string',
    );
  },
);


test(
  'deleted tombstone is terminal and cannot be restored',
  async () => {
    const ownerId =
      'm93c1-terminal-owner';

    const tripId =
      'm93c1-terminal-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c1-terminal-create-0001',
    );

    const deleted =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93c1-terminal-delete-0001',
          targetStatus:
            'deleted',
        });

    assert.equal(
      deleted.status,
      'applied',
    );

    const attempted =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 1,
          clientMutationId:
            'm93c1-terminal-restore-0001',
          targetStatus:
            'active',
        });

    assert.equal(
      attempted.status,
      'invalid_transition',
    );

    assert.equal(
      attempted.trip.revision,
      1,
    );

    assert.equal(
      attempted.trip.lifecycle.status,
      'deleted',
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
          'm93c1-terminal-restore-0001',
        ],
      );

    assert.equal(
      mutation.rows[0].count,
      0,
    );
  },
);


test(
  'create cannot resurrect an existing deleted trip id',
  async () => {
    const ownerId =
      'm93c1-resurrection-owner';

    const tripId =
      'm93c1-resurrection-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c1-resurrection-create-0001',
    );

    const deleted =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93c1-resurrection-delete-0001',
          targetStatus:
            'deleted',
        });

    assert.equal(
      deleted.status,
      'applied',
    );

    const attemptedCreate =
      await repository.createTrip({
        ownerId,
        clientMutationId:
          'm93c1-resurrection-create-0002',
        workspace:
          workspace(
            tripId,
            9999,
          ),
      });

    assert.equal(
      attemptedCreate.status,
      'conflict',
    );

    const stored =
      await pool.query(
        `
          SELECT
            revision,
            lifecycle_status,
            deleted_at,
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
        stored.rows[0]
          .revision,
      ),
      1,
    );

    assert.equal(
      stored.rows[0]
        .lifecycle_status,
      'deleted',
    );

    assert.notEqual(
      stored.rows[0]
        .deleted_at,
      null,
    );

    assert.equal(
      stored.rows[0]
        .workspace.funds
        .availableNow,
      5000,
    );
  },
);


test(
  'workspace mutation cannot resurrect a deleted trip',
  async () => {
    const ownerId =
      'm93c1-write-owner';

    const tripId =
      'm93c1-write-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c1-write-create-0001',
    );

    const deleted =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm93c1-write-delete-0001',
          targetStatus:
            'deleted',
        });

    assert.equal(
      deleted.status,
      'applied',
    );

    const changed =
      workspace(
        tripId,
        9000,
      );

    const update =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 1,
        clientMutationId:
          'm93c1-write-update-0001',
        workspace:
          changed,
      });

    assert.equal(
      update.status,
      'conflict',
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
        stored.rows[0]
          .revision,
      ),
      1,
    );

    assert.equal(
      stored.rows[0]
        .lifecycle_status,
      'deleted',
    );

    assert.equal(
      stored.rows[0]
        .workspace.funds
        .availableNow,
      5000,
    );
  },
);
