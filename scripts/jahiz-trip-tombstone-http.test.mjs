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


const ownerHeader =
  'x-jahiz-m93c2-owner';


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

    return {
      ownerId,
      provider: 'test',
      sessionId: null,
    };
  };


const app =
  buildApiServer({
    repository,
    authenticateRequest,
    logger: false,
  });


function headers(
  ownerId,
) {
  return {
    [ownerHeader]:
      ownerId,
  };
}


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
      '2026-08-31T10:30:00.000Z',

    updatedAt:
      '2026-08-31T10:30:00.000Z',
  };
}


async function createTrip(
  ownerId,
  tripId,
  mutationId,
  availableNow = 5000,
) {
  const response =
    await app.inject({
      method: 'POST',
      url: '/v1/trips',

      headers:
        headers(ownerId),

      payload: {
        clientMutationId:
          mutationId,

        workspace:
          workspace(
            tripId,
            availableNow,
          ),
      },
    });

  assert.equal(
    response.statusCode,
    201,
  );

  return response;
}


async function changeLifecycle(
  ownerId,
  tripId,
  mutationId,
  expectedRevision,
  targetStatus,
) {
  return app.inject({
    method: 'PATCH',

    url:
      `/v1/trips/${tripId}/lifecycle`,

    headers:
      headers(ownerId),

    payload: {
      clientMutationId:
        mutationId,

      expectedRevision,

      targetStatus,
    },
  });
}


async function deleteTrip(
  ownerId,
  tripId,
  mutationId,
  expectedRevision = 0,
) {
  return changeLifecycle(
    ownerId,
    tripId,
    mutationId,
    expectedRevision,
    'deleted',
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
      WHERE id LIKE 'm93c2-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm93c2-%'
    `,
  );

  await app.ready();
});


after(async () => {
  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id LIKE 'm93c2-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm93c2-%'
    `,
  );

  await app.close();
  await pool.end();
});


test(
  'HTTP lifecycle deletion creates canonical tombstone',
  async () => {
    const ownerId =
      'm93c2-delete-owner';

    const tripId =
      'm93c2-delete-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c2-delete-create-0001',
    );

    const deleted =
      await deleteTrip(
        ownerId,
        tripId,
        'm93c2-delete-0001',
      );

    assert.equal(
      deleted.statusCode,
      200,
    );

    const trip =
      deleted.json().data;

    assert.equal(
      trip.revision,
      1,
    );

    assert.equal(
      trip.lifecycle.status,
      'deleted',
    );

    assert.equal(
      trip.lifecycle.archivedAt,
      null,
    );

    assert.equal(
      typeof trip.lifecycle.deletedAt,
      'string',
    );
  },
);


test(
  'archived trip can be deleted over HTTP',
  async () => {
    const ownerId =
      'm93c2-archived-delete-owner';

    const tripId =
      'm93c2-archived-delete-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c2-archived-create-0001',
    );

    const archived =
      await changeLifecycle(
        ownerId,
        tripId,
        'm93c2-archived-0001',
        0,
        'archived',
      );

    assert.equal(
      archived.statusCode,
      200,
    );

    const deleted =
      await deleteTrip(
        ownerId,
        tripId,
        'm93c2-archived-delete-0001',
        1,
      );

    assert.equal(
      deleted.statusCode,
      200,
    );

    assert.equal(
      deleted.json()
        .data.revision,
      2,
    );

    assert.equal(
      deleted.json()
        .data.lifecycle.status,
      'deleted',
    );

    assert.equal(
      deleted.json()
        .data.lifecycle.archivedAt,
      null,
    );
  },
);


test(
  'GET by id returns canonical deleted tombstone',
  async () => {
    const ownerId =
      'm93c2-get-owner';

    const tripId =
      'm93c2-get-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c2-get-create-0001',
    );

    await deleteTrip(
      ownerId,
      tripId,
      'm93c2-get-delete-0001',
    );

    const response =
      await app.inject({
        method: 'GET',

        url:
          `/v1/trips/${tripId}`,

        headers:
          headers(ownerId),
      });

    assert.equal(
      response.statusCode,
      200,
    );

    assert.equal(
      response.json()
        .data.lifecycle.status,
      'deleted',
    );

    assert.equal(
      typeof response.json()
        .data.lifecycle.deletedAt,
      'string',
    );
  },
);


test(
  'portfolio excludes tombstones by default and exposes deleted and all filters',
  async () => {
    const ownerId =
      'm93c2-filter-owner';

    const activeId =
      'm93c2-filter-active';

    const deletedId =
      'm93c2-filter-deleted';

    await createTrip(
      ownerId,
      activeId,
      'm93c2-filter-create-active-0001',
    );

    await createTrip(
      ownerId,
      deletedId,
      'm93c2-filter-create-deleted-0001',
    );

    await deleteTrip(
      ownerId,
      deletedId,
      'm93c2-filter-delete-0001',
    );

    const normal =
      await app.inject({
        method: 'GET',
        url: '/v1/trips',
        headers:
          headers(ownerId),
      });

    const deleted =
      await app.inject({
        method: 'GET',
        url:
          '/v1/trips?status=deleted',
        headers:
          headers(ownerId),
      });

    const all =
      await app.inject({
        method: 'GET',
        url:
          '/v1/trips?status=all',
        headers:
          headers(ownerId),
      });

    assert.deepEqual(
      normal.json()
        .data
        .map(
          (trip) => trip.tripId,
        ),
      [activeId],
    );

    assert.deepEqual(
      deleted.json()
        .data
        .map(
          (trip) => trip.tripId,
        ),
      [deletedId],
    );

    assert.equal(
      deleted.json()
        .data[0]
        .lifecycle.status,
      'deleted',
    );

    assert.equal(
      typeof deleted.json()
        .data[0]
        .lifecycle.deletedAt,
      'string',
    );

    assert.deepEqual(
      new Set(
        all.json()
          .data
          .map(
            (trip) => trip.tripId,
          ),
      ),
      new Set([
        activeId,
        deletedId,
      ]),
    );
  },
);


test(
  'deleted tombstone cannot be restored over HTTP',
  async () => {
    const ownerId =
      'm93c2-terminal-owner';

    const tripId =
      'm93c2-terminal-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c2-terminal-create-0001',
    );

    const deleted =
      await deleteTrip(
        ownerId,
        tripId,
        'm93c2-terminal-delete-0001',
      );

    assert.equal(
      deleted.statusCode,
      200,
    );

    const restore =
      await changeLifecycle(
        ownerId,
        tripId,
        'm93c2-terminal-restore-0001',
        1,
        'active',
      );

    assert.equal(
      restore.statusCode,
      409,
    );

    assert.equal(
      restore.json().status,
      'invalid_transition',
    );

    assert.equal(
      restore.json()
        .trip.revision,
      1,
    );

    assert.equal(
      restore.json()
        .trip.lifecycle.status,
      'deleted',
    );
  },
);


test(
  'workspace PUT cannot mutate a deleted tombstone',
  async () => {
    const ownerId =
      'm93c2-write-owner';

    const tripId =
      'm93c2-write-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c2-write-create-0001',
      5000,
    );

    await deleteTrip(
      ownerId,
      tripId,
      'm93c2-write-delete-0001',
    );

    const response =
      await app.inject({
        method: 'PUT',

        url:
          `/v1/trips/${tripId}`,

        headers:
          headers(ownerId),

        payload: {
          clientMutationId:
            'm93c2-write-update-0001',

          expectedRevision:
            1,

          workspace:
            workspace(
              tripId,
              9999,
            ),
        },
      });

    assert.equal(
      response.statusCode,
      409,
    );

    assert.equal(
      response.json()
        .trip.lifecycle.status,
      'deleted',
    );

    assert.equal(
      response.json()
        .trip.workspace
        .funds.availableNow,
      5000,
    );

    const stored =
      await repository.getTrip(
        ownerId,
        tripId,
      );

    assert.equal(
      stored.revision,
      1,
    );

    assert.equal(
      stored.lifecycle.status,
      'deleted',
    );

    assert.equal(
      stored.workspace.funds
        .availableNow,
      5000,
    );
  },
);


test(
  'POST cannot resurrect deleted trip id and returns canonical tombstone',
  async () => {
    const ownerId =
      'm93c2-resurrection-owner';

    const tripId =
      'm93c2-resurrection-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93c2-resurrection-create-0001',
      5000,
    );

    await deleteTrip(
      ownerId,
      tripId,
      'm93c2-resurrection-delete-0001',
    );

    const attempted =
      await app.inject({
        method: 'POST',
        url: '/v1/trips',

        headers:
          headers(ownerId),

        payload: {
          clientMutationId:
            'm93c2-resurrection-create-0002',

          workspace:
            workspace(
              tripId,
              9999,
            ),
        },
      });

    assert.equal(
      attempted.statusCode,
      409,
    );

    assert.equal(
      attempted.json().status,
      'conflict',
    );

    assert.equal(
      attempted.json()
        .trip.lifecycle.status,
      'deleted',
    );

    assert.equal(
      attempted.json()
        .trip.revision,
      1,
    );

    assert.equal(
      attempted.json()
        .trip.workspace
        .funds.availableNow,
      5000,
    );
  },
);


test(
  'deleted tombstones preserve owner isolation',
  async () => {
    const ownerA =
      'm93c2-isolation-owner-a';

    const ownerB =
      'm93c2-isolation-owner-b';

    const tripId =
      'm93c2-isolation-trip';

    await createTrip(
      ownerA,
      tripId,
      'm93c2-isolation-create-0001',
    );

    await deleteTrip(
      ownerA,
      tripId,
      'm93c2-isolation-delete-0001',
    );

    const direct =
      await app.inject({
        method: 'GET',

        url:
          `/v1/trips/${tripId}`,

        headers:
          headers(ownerB),
      });

    assert.equal(
      direct.statusCode,
      404,
    );

    const portfolio =
      await app.inject({
        method: 'GET',

        url:
          '/v1/trips?status=deleted',

        headers:
          headers(ownerB),
      });

    assert.equal(
      portfolio.statusCode,
      200,
    );

    assert.deepEqual(
      portfolio.json().data,
      [],
    );
  },
);
