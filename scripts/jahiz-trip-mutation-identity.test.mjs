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
      '2026-08-31T11:40:00.000Z',

    updatedAt:
      '2026-08-31T11:40:00.000Z',
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
  amount = 5000,
) {
  await ensureOwner(
    ownerId,
  );

  return repository.createTrip({
    ownerId,
    clientMutationId:
      mutationId,
    workspace:
      workspace(
        tripId,
        amount,
      ),
  });
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
      WHERE id LIKE 'm94b1-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm94b1-%'
    `,
  );
});


after(async () => {
  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id LIKE 'm94b1-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm94b1-%'
    `,
  );

  await pool.end();
});


test(
  'new revisions persist explicit create workspace and lifecycle mutation kinds',
  async () => {
    const ownerId =
      'm94b1-kind-owner';

    const tripId =
      'm94b1-kind-trip';

    const created =
      await createTrip(
        ownerId,
        tripId,
        'm94b1-kind-create-0001',
      );

    assert.equal(
      created.status,
      'applied',
    );

    const updated =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 0,
        clientMutationId:
          'm94b1-kind-update-0001',
        workspace:
          workspace(
            tripId,
            6100,
          ),
      });

    assert.equal(
      updated.status,
      'applied',
    );

    const archived =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 1,
          clientMutationId:
            'm94b1-kind-lifecycle-0001',
          targetStatus:
            'archived',
        });

    assert.equal(
      archived.status,
      'applied',
    );

    const rows =
      await pool.query(
        `
          SELECT
            revision,
            mutation_kind
          FROM jahiz_trip_revision
          WHERE trip_id = $1
          ORDER BY revision ASC
        `,
        [tripId],
      );

    assert.deepEqual(
      rows.rows.map(
        (row) => [
          Number(row.revision),
          row.mutation_kind,
        ],
      ),
      [
        [0, 'create'],
        [1, 'workspace'],
        [2, 'lifecycle'],
      ],
    );
  },
);


test(
  'create mutation id reused for workspace update fails closed',
  async () => {
    const ownerId =
      'm94b1-cross-create-owner';

    const tripId =
      'm94b1-cross-create-trip';

    const mutationId =
      'm94b1-cross-create-0001';

    await createTrip(
      ownerId,
      tripId,
      mutationId,
      5000,
    );

    const attempted =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 0,
        clientMutationId:
          mutationId,
        workspace:
          workspace(
            tripId,
            9900,
          ),
      });

    assert.equal(
      attempted.status,
      'conflict',
    );

    assert.equal(
      attempted.trip.revision,
      0,
    );

    assert.equal(
      attempted.trip.workspace
        .funds.availableNow,
      5000,
    );
  },
);


test(
  'workspace mutation id reused for lifecycle transition fails closed',
  async () => {
    const ownerId =
      'm94b1-cross-workspace-owner';

    const tripId =
      'm94b1-cross-workspace-trip';

    await createTrip(
      ownerId,
      tripId,
      'm94b1-cross-workspace-create-0001',
    );

    const mutationId =
      'm94b1-cross-workspace-0001';

    const updated =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 0,
        clientMutationId:
          mutationId,
        workspace:
          workspace(
            tripId,
            6200,
          ),
      });

    assert.equal(
      updated.status,
      'applied',
    );

    const attempted =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 1,
          clientMutationId:
            mutationId,
          targetStatus:
            'archived',
        });

    assert.equal(
      attempted.status,
      'conflict',
    );

    assert.equal(
      attempted.trip.revision,
      1,
    );

    assert.equal(
      attempted.trip.lifecycle.status,
      'active',
    );
  },
);


test(
  'lifecycle mutation id reused for workspace update fails closed',
  async () => {
    const ownerId =
      'm94b1-cross-lifecycle-owner';

    const tripId =
      'm94b1-cross-lifecycle-trip';

    await createTrip(
      ownerId,
      tripId,
      'm94b1-cross-lifecycle-create-0001',
    );

    const mutationId =
      'm94b1-cross-lifecycle-0001';

    const archived =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            mutationId,
          targetStatus:
            'archived',
        });

    assert.equal(
      archived.status,
      'applied',
    );

    const attempted =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 1,
        clientMutationId:
          mutationId,
        workspace:
          workspace(
            tripId,
            8800,
          ),
      });

    assert.equal(
      attempted.status,
      'conflict',
    );

    assert.equal(
      attempted.trip.revision,
      1,
    );

    assert.equal(
      attempted.trip.lifecycle.status,
      'archived',
    );

    assert.equal(
      attempted.trip.workspace
        .funds.availableNow,
      5000,
    );
  },
);


test(
  'same workspace mutation id with different payload is not an idempotent replay',
  async () => {
    const ownerId =
      'm94b1-payload-owner';

    const tripId =
      'm94b1-payload-trip';

    await createTrip(
      ownerId,
      tripId,
      'm94b1-payload-create-0001',
    );

    const mutationId =
      'm94b1-payload-update-0001';

    const first =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 0,
        clientMutationId:
          mutationId,
        workspace:
          workspace(
            tripId,
            6100,
          ),
      });

    assert.equal(
      first.status,
      'applied',
    );

    const changedReplay =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 0,
        clientMutationId:
          mutationId,
        workspace:
          workspace(
            tripId,
            9200,
          ),
      });

    assert.equal(
      changedReplay.status,
      'conflict',
    );

    assert.equal(
      changedReplay.trip.revision,
      1,
    );

    assert.equal(
      changedReplay.trip.workspace
        .funds.availableNow,
      6100,
    );
  },
);


test(
  'same lifecycle mutation id with a different request is not an idempotent replay',
  async () => {
    const ownerId =
      'm94b1-lifecycle-replay-owner';

    const tripId =
      'm94b1-lifecycle-replay-trip';

    await createTrip(
      ownerId,
      tripId,
      'm94b1-lifecycle-replay-create-0001',
    );

    const mutationId =
      'm94b1-lifecycle-replay-0001';

    const archived =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            mutationId,
          targetStatus:
            'archived',
        });

    assert.equal(
      archived.status,
      'applied',
    );

    const changedReplay =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 1,
          clientMutationId:
            mutationId,
          targetStatus:
            'active',
        });

    assert.equal(
      changedReplay.status,
      'conflict',
    );

    assert.equal(
      changedReplay.trip.revision,
      1,
    );

    assert.equal(
      changedReplay.trip.lifecycle.status,
      'archived',
    );
  },
);


test(
  'same create mutation id with different workspace is not an idempotent replay',
  async () => {
    const ownerId =
      'm94b1-create-payload-owner';

    const tripId =
      'm94b1-create-payload-trip';

    const mutationId =
      'm94b1-create-payload-0001';

    const first =
      await createTrip(
        ownerId,
        tripId,
        mutationId,
        5000,
      );

    assert.equal(
      first.status,
      'applied',
    );

    const changedReplay =
      await repository.createTrip({
        ownerId,
        clientMutationId:
          mutationId,
        workspace:
          workspace(
            tripId,
            9300,
          ),
      });

    assert.equal(
      changedReplay.status,
      'conflict',
    );

    assert.equal(
      changedReplay.trip.revision,
      0,
    );

    assert.equal(
      changedReplay.trip.workspace
        .funds.availableNow,
      5000,
    );
  },
);

test(
  'original create replay after tombstone returns canonical deleted state',
  async () => {
    const ownerId =
      'm94b1-stale-create-owner';

    const tripId =
      'm94b1-stale-create-trip';

    const mutationId =
      'm94b1-stale-create-0001';

    await createTrip(
      ownerId,
      tripId,
      mutationId,
      5000,
    );

    const deleted =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            'm94b1-stale-create-delete-0001',
          targetStatus:
            'deleted',
        });

    assert.equal(
      deleted.status,
      'applied',
    );

    const replay =
      await repository.createTrip({
        ownerId,
        clientMutationId:
          mutationId,
        workspace:
          workspace(
            tripId,
            5000,
          ),
      });

    assert.equal(
      replay.status,
      'conflict',
    );

    assert.equal(
      replay.trip.revision,
      1,
    );

    assert.equal(
      replay.trip.lifecycle.status,
      'deleted',
    );

    assert.equal(
      replay.trip.workspace
        .funds.availableNow,
      5000,
    );
  },
);

test(
  'old workspace replay returns canonical newer revision',
  async () => {
    const ownerId =
      'm94b1-stale-workspace-owner';

    const tripId =
      'm94b1-stale-workspace-trip';

    await createTrip(
      ownerId,
      tripId,
      'm94b1-stale-workspace-create-0001',
    );

    const oldMutation =
      'm94b1-stale-workspace-update-0001';

    const first =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 0,
        clientMutationId:
          oldMutation,
        workspace:
          workspace(
            tripId,
            6100,
          ),
      });

    assert.equal(
      first.status,
      'applied',
    );

    const second =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 1,
        clientMutationId:
          'm94b1-stale-workspace-update-0002',
        workspace:
          workspace(
            tripId,
            7200,
          ),
      });

    assert.equal(
      second.status,
      'applied',
    );

    const replay =
      await repository.updateTrip({
        ownerId,
        tripId,
        expectedRevision: 0,
        clientMutationId:
          oldMutation,
        workspace:
          workspace(
            tripId,
            6100,
          ),
      });

    assert.equal(
      replay.status,
      'conflict',
    );

    assert.equal(
      replay.trip.revision,
      2,
    );

    assert.equal(
      replay.trip.workspace
        .funds.availableNow,
      7200,
    );
  },
);

test(
  'old lifecycle replay returns canonical newer lifecycle',
  async () => {
    const ownerId =
      'm94b1-stale-lifecycle-owner';

    const tripId =
      'm94b1-stale-lifecycle-trip';

    await createTrip(
      ownerId,
      tripId,
      'm94b1-stale-lifecycle-create-0001',
    );

    const archiveMutation =
      'm94b1-stale-lifecycle-archive-0001';

    const archived =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            archiveMutation,
          targetStatus:
            'archived',
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
            'm94b1-stale-lifecycle-restore-0001',
          targetStatus:
            'active',
        });

    assert.equal(
      restored.status,
      'applied',
    );

    const replay =
      await repository
        .transitionTripLifecycle({
          ownerId,
          tripId,
          expectedRevision: 0,
          clientMutationId:
            archiveMutation,
          targetStatus:
            'archived',
        });

    assert.equal(
      replay.status,
      'conflict',
    );

    assert.equal(
      replay.trip.revision,
      2,
    );

    assert.equal(
      replay.trip.lifecycle.status,
      'active',
    );
  },
);
