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

import {
  buildApiServer,
} from '../apps/api/src/http-app.mjs';


const pool =
  createPostgresPool();

const repository =
  createTripRepository(
    pool,
  );


const ownerHeader =
  'x-jahiz-m94-owner';


const authenticateRequest =
  async (request) => {
    const ownerId =
      request.headers[
        ownerHeader
      ];

    if (
      typeof ownerId !== 'string' ||
      ownerId.length === 0
    ) {
      return null;
    }

    return {
      ownerId,
      provider:
        'm94-acceptance',
      sessionId:
        null,
    };
  };


const app =
  buildApiServer({
    repository,
    authenticateRequest,
  });


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
      flexibility:
        'fixed',
    },

    profile: {
      travelStyle:
        'smart',
      travelStyleConfirmed:
        true,
      purpose:
        'leisure',

      travelers: {
        adults: 1,
        children: 0,
      },
    },

    funds: {
      availableNow,
      expectedBeforeTravel:
        0,
      safetyReserve:
        1000,
      originCommitments:
        0,
    },

    costItems: [],
    payments: [],
    commitments: [],
    moneyIn: [],

    createdAt:
      '2026-08-31T12:20:00.000Z',

    updatedAt:
      '2026-08-31T12:20:00.000Z',
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


async function createTrip({
  ownerId,
  tripId,
  mutationId,
  amount,
  serverUpdatedAt,
}) {
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

    serverUpdatedAt:
      new Date(
        serverUpdatedAt,
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
      WHERE id LIKE 'm94b2-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm94b2-%'
    `,
  );

  await app.ready();
});


after(async () => {
  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id LIKE 'm94b2-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm94b2-%'
    `,
  );

  await app.close();
  await pool.end();
});


// ============================================================
// 1. ONE ACCOUNT → MULTIPLE TRIPS
// ============================================================

test(
  'one account persists multiple independent canonical trips',
  async () => {
    const ownerId =
      'm94b2-multi-owner';

    const a =
      await createTrip({
        ownerId,
        tripId:
          'm94b2-multi-a',
        mutationId:
          'm94b2-multi-create-a',
        amount:
          4100,
        serverUpdatedAt:
          '2026-08-31T12:21:00.000Z',
      });

    const b =
      await createTrip({
        ownerId,
        tripId:
          'm94b2-multi-b',
        mutationId:
          'm94b2-multi-create-b',
        amount:
          5200,
        serverUpdatedAt:
          '2026-08-31T12:22:00.000Z',
      });

    const c =
      await createTrip({
        ownerId,
        tripId:
          'm94b2-multi-c',
        mutationId:
          'm94b2-multi-create-c',
        amount:
          6300,
        serverUpdatedAt:
          '2026-08-31T12:23:00.000Z',
      });

    assert.equal(
      a.status,
      'applied',
    );

    assert.equal(
      b.status,
      'applied',
    );

    assert.equal(
      c.status,
      'applied',
    );

    const listed =
      await repository.listTrips(
        ownerId,
        'all',
      );

    assert.deepEqual(
      listed.map(
        (trip) =>
          trip.tripId,
      ),
      [
        'm94b2-multi-c',
        'm94b2-multi-b',
        'm94b2-multi-a',
      ],
    );

    assert.deepEqual(
      listed.map(
        (trip) =>
          trip.revision,
      ),
      [
        0,
        0,
        0,
      ],
    );
  },
);


// ============================================================
// 2. MUTATION ISOLATION BETWEEN SIBLING TRIPS
// ============================================================

test(
  'workspace mutation on one trip never changes sibling trips',
  async () => {
    const ownerId =
      'm94b2-isolation-owner';

    await createTrip({
      ownerId,
      tripId:
        'm94b2-isolation-a',
      mutationId:
        'm94b2-isolation-create-a',
      amount:
        4000,
      serverUpdatedAt:
        '2026-08-31T12:30:00.000Z',
    });

    await createTrip({
      ownerId,
      tripId:
        'm94b2-isolation-b',
      mutationId:
        'm94b2-isolation-create-b',
      amount:
        5000,
      serverUpdatedAt:
        '2026-08-31T12:31:00.000Z',
    });

    await createTrip({
      ownerId,
      tripId:
        'm94b2-isolation-c',
      mutationId:
        'm94b2-isolation-create-c',
      amount:
        6000,
      serverUpdatedAt:
        '2026-08-31T12:32:00.000Z',
    });

    const updated =
      await repository.updateTrip({
        ownerId,

        tripId:
          'm94b2-isolation-a',

        expectedRevision:
          0,

        clientMutationId:
          'm94b2-isolation-update-a',

        workspace:
          workspace(
            'm94b2-isolation-a',
            9100,
          ),

        serverUpdatedAt:
          new Date(
            '2026-08-31T12:33:00.000Z',
          ),
      });

    assert.equal(
      updated.status,
      'applied',
    );

    const a =
      await repository.getTrip(
        ownerId,
        'm94b2-isolation-a',
      );

    const b =
      await repository.getTrip(
        ownerId,
        'm94b2-isolation-b',
      );

    const c =
      await repository.getTrip(
        ownerId,
        'm94b2-isolation-c',
      );

    assert.equal(
      a.revision,
      1,
    );

    assert.equal(
      a.workspace.funds
        .availableNow,
      9100,
    );

    assert.equal(
      b.revision,
      0,
    );

    assert.equal(
      b.workspace.funds
        .availableNow,
      5000,
    );

    assert.equal(
      c.revision,
      0,
    );

    assert.equal(
      c.workspace.funds
        .availableNow,
      6000,
    );

    const revisionCounts =
      await pool.query(
        `
          SELECT
            trip_id,
            COUNT(*)::int AS count
          FROM jahiz_trip_revision
          WHERE trip_id IN (
            'm94b2-isolation-a',
            'm94b2-isolation-b',
            'm94b2-isolation-c'
          )
          GROUP BY trip_id
          ORDER BY trip_id ASC
        `,
      );

    assert.deepEqual(
      revisionCounts.rows,
      [
        {
          trip_id:
            'm94b2-isolation-a',
          count:
            2,
        },
        {
          trip_id:
            'm94b2-isolation-b',
          count:
            1,
        },
        {
          trip_id:
            'm94b2-isolation-c',
          count:
            1,
        },
      ],
    );
  },
);


// ============================================================
// 3. MIXED LIFECYCLE PORTFOLIO
// ============================================================

test(
  'one account can persist active archived and deleted trips independently',
  async () => {
    const ownerId =
      'm94b2-lifecycle-owner';

    await createTrip({
      ownerId,
      tripId:
        'm94b2-life-active',
      mutationId:
        'm94b2-life-create-active',
      amount:
        5100,
      serverUpdatedAt:
        '2026-08-31T12:40:00.000Z',
    });

    await createTrip({
      ownerId,
      tripId:
        'm94b2-life-archived',
      mutationId:
        'm94b2-life-create-archived',
      amount:
        6200,
      serverUpdatedAt:
        '2026-08-31T12:41:00.000Z',
    });

    await createTrip({
      ownerId,
      tripId:
        'm94b2-life-deleted',
      mutationId:
        'm94b2-life-create-deleted',
      amount:
        7300,
      serverUpdatedAt:
        '2026-08-31T12:42:00.000Z',
    });

    const archived =
      await repository
        .transitionTripLifecycle({
          ownerId,

          tripId:
            'm94b2-life-archived',

          expectedRevision:
            0,

          clientMutationId:
            'm94b2-life-archive-0001',

          targetStatus:
            'archived',

          serverUpdatedAt:
            new Date(
              '2026-08-31T12:43:00.000Z',
            ),
        });

    assert.equal(
      archived.status,
      'applied',
    );

    const deleted =
      await repository
        .transitionTripLifecycle({
          ownerId,

          tripId:
            'm94b2-life-deleted',

          expectedRevision:
            0,

          clientMutationId:
            'm94b2-life-delete-0001',

          targetStatus:
            'deleted',

          serverUpdatedAt:
            new Date(
              '2026-08-31T12:44:00.000Z',
            ),
        });

    assert.equal(
      deleted.status,
      'applied',
    );

    const active =
      await repository.listTrips(
        ownerId,
      );

    const archivedOnly =
      await repository.listTrips(
        ownerId,
        'archived',
      );

    const deletedOnly =
      await repository.listTrips(
        ownerId,
        'deleted',
      );

    const all =
      await repository.listTrips(
        ownerId,
        'all',
      );

    assert.deepEqual(
      active.map(
        (trip) =>
          trip.tripId,
      ),
      [
        'm94b2-life-active',
      ],
    );

    assert.deepEqual(
      archivedOnly.map(
        (trip) =>
          trip.tripId,
      ),
      [
        'm94b2-life-archived',
      ],
    );

    assert.deepEqual(
      deletedOnly.map(
        (trip) =>
          trip.tripId,
      ),
      [
        'm94b2-life-deleted',
      ],
    );

    assert.deepEqual(
      all.map(
        (trip) =>
          trip.tripId,
      ),
      [
        'm94b2-life-deleted',
        'm94b2-life-archived',
        'm94b2-life-active',
      ],
    );

    assert.deepEqual(
      all.map(
        (trip) =>
          trip.lifecycle.status,
      ),
      [
        'deleted',
        'archived',
        'active',
      ],
    );
  },
);


// ============================================================
// 4. DETERMINISTIC PORTFOLIO TIE ORDER
// ============================================================

test(
  'portfolio ordering is deterministic when updated timestamps tie',
  async () => {
    const ownerId =
      'm94b2-order-owner';

    const sameTime =
      '2026-08-31T12:50:00.000Z';

    await createTrip({
      ownerId,
      tripId:
        'm94b2-order-b',
      mutationId:
        'm94b2-order-create-b',
      amount:
        2000,
      serverUpdatedAt:
        sameTime,
    });

    await createTrip({
      ownerId,
      tripId:
        'm94b2-order-a',
      mutationId:
        'm94b2-order-create-a',
      amount:
        3000,
      serverUpdatedAt:
        sameTime,
    });

    const listed =
      await repository.listTrips(
        ownerId,
        'all',
      );

    assert.deepEqual(
      listed.map(
        (trip) =>
          trip.tripId,
      ),
      [
        'm94b2-order-a',
        'm94b2-order-b',
      ],
    );
  },
);


// ============================================================
// 5. BFF ACCOUNT PORTFOLIO ISOLATION
// ============================================================

test(
  'HTTP account portfolio never discloses another account trips',
  async () => {
    const ownerA =
      'm94b2-http-owner-a';

    const ownerB =
      'm94b2-http-owner-b';

    await createTrip({
      ownerId:
        ownerA,
      tripId:
        'm94b2-http-a1',
      mutationId:
        'm94b2-http-create-a1',
      amount:
        7100,
      serverUpdatedAt:
        '2026-08-31T13:00:00.000Z',
    });

    await createTrip({
      ownerId:
        ownerA,
      tripId:
        'm94b2-http-a2',
      mutationId:
        'm94b2-http-create-a2',
      amount:
        7200,
      serverUpdatedAt:
        '2026-08-31T13:01:00.000Z',
    });

    await createTrip({
      ownerId:
        ownerB,
      tripId:
        'm94b2-http-b1',
      mutationId:
        'm94b2-http-create-b1',
      amount:
        9900,
      serverUpdatedAt:
        '2026-08-31T13:02:00.000Z',
    });

    const response =
      await app.inject({
        method:
          'GET',

        url:
          '/v1/trips?status=all',

        headers: {
          [ownerHeader]:
            ownerA,
        },
      });

    assert.equal(
      response.statusCode,
      200,
    );

    const body =
      response.json();

    assert.deepEqual(
      body.data.map(
        (trip) =>
          trip.tripId,
      ),
      [
        'm94b2-http-a2',
        'm94b2-http-a1',
      ],
    );

    assert.equal(
      body.data.every(
        (trip) =>
          trip.ownerId ===
          ownerA,
      ),
      true,
    );

    const foreignRead =
      await app.inject({
        method:
          'GET',

        url:
          '/v1/trips/m94b2-http-b1',

        headers: {
          [ownerHeader]:
            ownerA,
        },
      });

    assert.equal(
      foreignRead.statusCode,
      404,
    );
  },
);


// ============================================================
// 6. MUTATION IDS REMAIN TRIP-SCOPED
// ============================================================

test(
  'same client mutation id on different trip ids remains isolated',
  async () => {
    const ownerId =
      'm94b2-mutation-owner';

    const sharedMutation =
      'm94b2-shared-mutation-0001';

    const a =
      await createTrip({
        ownerId,

        tripId:
          'm94b2-mutation-a',

        mutationId:
          sharedMutation,

        amount:
          8100,

        serverUpdatedAt:
          '2026-08-31T13:10:00.000Z',
      });

    const b =
      await createTrip({
        ownerId,

        tripId:
          'm94b2-mutation-b',

        mutationId:
          sharedMutation,

        amount:
          8200,

        serverUpdatedAt:
          '2026-08-31T13:11:00.000Z',
      });

    assert.equal(
      a.status,
      'applied',
    );

    assert.equal(
      b.status,
      'applied',
    );

    const rows =
      await pool.query(
        `
          SELECT
            trip_id,
            client_mutation_id,
            mutation_kind
          FROM jahiz_trip_revision
          WHERE trip_id IN (
            'm94b2-mutation-a',
            'm94b2-mutation-b'
          )
          ORDER BY trip_id ASC
        `,
      );

    assert.deepEqual(
      rows.rows,
      [
        {
          trip_id:
            'm94b2-mutation-a',

          client_mutation_id:
            sharedMutation,

          mutation_kind:
            'create',
        },
        {
          trip_id:
            'm94b2-mutation-b',

          client_mutation_id:
            sharedMutation,

          mutation_kind:
            'create',
        },
      ],
    );
  },
);
