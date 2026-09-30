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

const pool = createPostgresPool();
const repository =
  createTripRepository(pool);

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
      '2026-08-24T06:00:00.000Z',
    updatedAt:
      '2026-08-24T06:00:00.000Z',
  };
}

async function ensureTestUser(
  ownerId,
) {
  await pool.query(
    `
      INSERT INTO jahiz_user (
        id,
        status
      )
      VALUES ($1, 'active')
      ON CONFLICT (id)
      DO NOTHING
    `,
    [ownerId],
  );
}

async function createOwnedTrip(
  input,
) {
  await ensureTestUser(
    input.ownerId,
  );

  return repository.createTrip(
    input,
  );
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
      WHERE id LIKE 'm7c-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm7c-%'
    `,
  );
});

after(async () => {
  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id LIKE 'm7c-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm7c-%'
    `,
  );

  await pool.end();
});

test('repository lists only owner trips in deterministic updated order', async () => {
  const older =
    workspace(
      'm7c-list-older',
      4100,
    );

  const newer =
    workspace(
      'm7c-list-newer',
      9200,
    );

  const foreign =
    workspace(
      'm7c-list-foreign',
      7777,
    );

  await createOwnedTrip({
    ownerId: 'm7c-list-owner-a',
    clientMutationId:
      'm7c-list-create-0001',
    workspace: older,
    serverUpdatedAt:
      new Date(
        '2026-08-24T06:01:00.000Z',
      ),
  });

  await createOwnedTrip({
    ownerId: 'm7c-list-owner-a',
    clientMutationId:
      'm7c-list-create-0002',
    workspace: newer,
    serverUpdatedAt:
      new Date(
        '2026-08-24T06:03:00.000Z',
      ),
  });

  await createOwnedTrip({
    ownerId: 'm7c-list-owner-b',
    clientMutationId:
      'm7c-list-create-0003',
    workspace: foreign,
    serverUpdatedAt:
      new Date(
        '2026-08-24T06:04:00.000Z',
      ),
  });

  const listed =
    await repository.listTrips(
      'm7c-list-owner-a',
    );

  assert.deepEqual(
    listed.map(
      (trip) => trip.tripId,
    ),
    [
      'm7c-list-newer',
      'm7c-list-older',
    ],
  );

  assert.equal(
    listed.every(
      (trip) =>
        trip.ownerId ===
        'm7c-list-owner-a',
    ),
    true,
  );
});

test('repository returns an empty portfolio for an owner with no trips', async () => {
  assert.deepEqual(
    await repository.listTrips(
      'm7c-empty-owner',
    ),
    [],
  );
});

test('repository creates and reads canonical server trip', async () => {
  const tripWorkspace = workspace(
    'm7c-create-read',
  );

  const created =
    await createOwnedTrip({
      ownerId: 'm7c-user-1',
      clientMutationId:
        'm7c-create-0001',
      workspace: tripWorkspace,
      serverUpdatedAt:
        new Date(
          '2026-08-24T06:01:00.000Z',
        ),
    });

  assert.equal(
    created.status,
    'applied',
  );
  assert.equal(
    created.trip.revision,
    0,
  );

  const fetched =
    await repository.getTrip(
      'm7c-user-1',
      tripWorkspace.id,
    );

  assert.equal(
    fetched?.workspace.funds
      .availableNow,
    5000,
  );
});

test('matching revision updates atomically and increments once', async () => {
  const tripWorkspace = workspace(
    'm7c-cas',
  );

  await createOwnedTrip({
    ownerId: 'm7c-user-2',
    clientMutationId:
      'm7c-create-0002',
    workspace: tripWorkspace,
  });

  const changed = workspace(
    'm7c-cas',
    6200,
  );

  const updated =
    await repository.updateTrip({
      ownerId: 'm7c-user-2',
      tripId: 'm7c-cas',
      expectedRevision: 0,
      clientMutationId:
        'm7c-update-0001',
      workspace: changed,
    });

  assert.equal(
    updated.status,
    'applied',
  );
  assert.equal(
    updated.trip.revision,
    1,
  );
  assert.equal(
    updated.trip.workspace.funds
      .availableNow,
    6200,
  );
});

test('stale revision returns conflict and canonical server state', async () => {
  const tripWorkspace = workspace(
    'm7c-conflict',
  );

  await createOwnedTrip({
    ownerId: 'm7c-user-3',
    clientMutationId:
      'm7c-create-0003',
    workspace: tripWorkspace,
  });

  const first =
    await repository.updateTrip({
      ownerId: 'm7c-user-3',
      tripId: 'm7c-conflict',
      expectedRevision: 0,
      clientMutationId:
        'm7c-update-0002',
      workspace: workspace(
        'm7c-conflict',
        7000,
      ),
    });

  assert.equal(
    first.status,
    'applied',
  );

  const stale =
    await repository.updateTrip({
      ownerId: 'm7c-user-3',
      tripId: 'm7c-conflict',
      expectedRevision: 0,
      clientMutationId:
        'm7c-update-0003',
      workspace: workspace(
        'm7c-conflict',
        2500,
      ),
    });

  assert.equal(
    stale.status,
    'conflict',
  );
  assert.equal(
    stale.trip.revision,
    1,
  );
  assert.equal(
    stale.trip.workspace.funds
      .availableNow,
    7000,
  );
});

test('replaying the same mutation id is idempotent', async () => {
  const tripWorkspace = workspace(
    'm7c-idempotent',
  );

  await createOwnedTrip({
    ownerId: 'm7c-user-4',
    clientMutationId:
      'm7c-create-0004',
    workspace: tripWorkspace,
  });

  const request = {
    ownerId: 'm7c-user-4',
    tripId: 'm7c-idempotent',
    expectedRevision: 0,
    clientMutationId:
      'm7c-update-0004',
    workspace: workspace(
      'm7c-idempotent',
      8800,
    ),
  };

  const first =
    await repository.updateTrip(
      request,
    );
  const replay =
    await repository.updateTrip(
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

  const fetched =
    await repository.getTrip(
      'm7c-user-4',
      'm7c-idempotent',
    );

  assert.equal(
    fetched?.revision,
    1,
  );
});

test('owner isolation prevents cross-user reads and writes', async () => {
  await createOwnedTrip({
    ownerId: 'm7c-owner-a',
    clientMutationId:
      'm7c-create-0005',
    workspace: workspace(
      'm7c-owner-isolation',
    ),
  });

  const otherRead =
    await repository.getTrip(
      'm7c-owner-b',
      'm7c-owner-isolation',
    );

  assert.equal(
    otherRead,
    null,
  );

  const otherWrite =
    await repository.updateTrip({
      ownerId: 'm7c-owner-b',
      tripId:
        'm7c-owner-isolation',
      expectedRevision: 0,
      clientMutationId:
        'm7c-update-0005',
      workspace: workspace(
        'm7c-owner-isolation',
        1,
      ),
    });

  assert.equal(
    otherWrite.status,
    'conflict',
  );
  assert.equal(
    otherWrite.trip,
    null,
  );
});

test(
  'repository rejects trip creation for a missing Jahiz owner',
  async () => {
    const ownerId =
      'm7c-missing-owner';

    await pool.query(
      `
        DELETE FROM jahiz_user
        WHERE id = $1
      `,
      [ownerId],
    );

    await assert.rejects(
      repository.createTrip({
        ownerId,
        clientMutationId:
          'm7c-missing-owner-mutation',
        workspace:
          workspace(
            'm7c-missing-owner-trip',
          ),
      }),
      (error) =>
        error?.code === '23503',
    );
  },
);

test(
  'database prevents deleting a Jahiz user while owned trips exist',
  async () => {
    const ownerId =
      'm7c-delete-restrict-owner';

    await createOwnedTrip({
      ownerId,
      clientMutationId:
        'm7c-delete-restrict-mutation',
      workspace:
        workspace(
          'm7c-delete-restrict-trip',
        ),
    });

    await assert.rejects(
      pool.query(
        `
          DELETE FROM jahiz_user
          WHERE id = $1
        `,
        [ownerId],
      ),
      (error) =>
        error?.code === '23503',
    );
  },
);

test(
  'ownership migration refuses existing orphan trips without deleting them',
  async () => {
    const tripId =
      'm7c-orphan-migration-trip';

    const ownerId =
      'm7c-orphan-migration-owner';

    const ownershipSql =
      await fs.readFile(
        migrationPaths[2],
        'utf8',
      );

    let client = null;

    try {
      await pool.query(
        `
          ALTER TABLE jahiz_trip
          DROP CONSTRAINT
            jahiz_trip_owner_user_fk
        `,
      );

      await pool.query(
        `
          INSERT INTO jahiz_trip (
            id,
            owner_id,
            revision,
            workspace
          )
          VALUES (
            $1,
            $2,
            0,
            $3::jsonb
          )
        `,
        [
          tripId,
          ownerId,
          JSON.stringify(
            workspace(tripId),
          ),
        ],
      );

      client =
        await pool.connect();

      await assert.rejects(
        client.query(
          ownershipSql,
        ),
        (error) =>
          error?.code === '23503',
      );

      await client.query(
        'ROLLBACK',
      );

      client.release();
      client = null;

      const preserved =
        await pool.query(
          `
            SELECT owner_id
            FROM jahiz_trip
            WHERE id = $1
          `,
          [tripId],
        );

      assert.equal(
        preserved.rowCount,
        1,
      );

      assert.equal(
        preserved.rows[0].owner_id,
        ownerId,
      );
    }
    finally {
      if (client) {
        try {
          await client.query(
            'ROLLBACK',
          );
        }
        catch {
          // Preserve original test failure.
        }

        client.release();
      }

      await pool.query(
        `
          DELETE FROM jahiz_trip
          WHERE id = $1
        `,
        [tripId],
      );

      await pool.query(
        ownershipSql,
      );
    }
  },
);
