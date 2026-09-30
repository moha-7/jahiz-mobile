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
  'x-jahiz-m93b2-owner';


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
      '2026-08-31T10:00:00.000Z',

    updatedAt:
      '2026-08-31T10:00:00.000Z',
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

  return response.json();
}


async function archiveTrip(
  ownerId,
  tripId,
  mutationId,
  expectedRevision = 0,
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

      targetStatus:
        'archived',
    },
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
      WHERE id LIKE 'm93b2-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm93b2-%'
    `,
  );

  await app.ready();
});


after(async () => {
  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id LIKE 'm93b2-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm93b2-%'
    `,
  );

  await app.close();
  await pool.end();
});


test(
  'lifecycle PATCH requires authentication',
  async () => {
    const response =
      await app.inject({
        method: 'PATCH',
        url:
          '/v1/trips/m93b2-none/lifecycle',

        payload: {
          clientMutationId:
            'm93b2-unauth-0001',

          expectedRevision: 0,

          targetStatus:
            'archived',
        },
      });

    assert.equal(
      response.statusCode,
      401,
    );
  },
);


test(
  'portfolio lifecycle query rejects unsupported status',
  async () => {
    const response =
      await app.inject({
        method: 'GET',
        url:
          '/v1/trips?status=purged',

        headers:
          headers(
            'm93b2-query-owner',
          ),
      });

    assert.equal(
      response.statusCode,
      400,
    );

    assert.equal(
      response.json()
        .error.code,
      'invalid_query',
    );
  },
);


test(
  'portfolio defaults to active and supports archived and all filters',
  async () => {
    const ownerId =
      'm93b2-filter-owner';

    const activeTripId =
      'm93b2-filter-active';

    const archivedTripId =
      'm93b2-filter-archived';

    await createTrip(
      ownerId,
      activeTripId,
      'm93b2-filter-create-active-0001',
    );

    await createTrip(
      ownerId,
      archivedTripId,
      'm93b2-filter-create-archived-0001',
    );

    const archived =
      await archiveTrip(
        ownerId,
        archivedTripId,
        'm93b2-filter-archive-0001',
      );

    assert.equal(
      archived.statusCode,
      200,
    );

    const defaultResponse =
      await app.inject({
        method: 'GET',
        url:
          '/v1/trips',

        headers:
          headers(ownerId),
      });

    const activeResponse =
      await app.inject({
        method: 'GET',
        url:
          '/v1/trips?status=active',

        headers:
          headers(ownerId),
      });

    const archivedResponse =
      await app.inject({
        method: 'GET',
        url:
          '/v1/trips?status=archived',

        headers:
          headers(ownerId),
      });

    const allResponse =
      await app.inject({
        method: 'GET',
        url:
          '/v1/trips?status=all',

        headers:
          headers(ownerId),
      });

    assert.deepEqual(
      defaultResponse.json(),
      activeResponse.json(),
    );

    assert.deepEqual(
      defaultResponse.json()
        .data
        .map(
          (trip) => trip.tripId,
        ),
      [activeTripId],
    );

    assert.deepEqual(
      archivedResponse.json()
        .data
        .map(
          (trip) => trip.tripId,
        ),
      [archivedTripId],
    );

    assert.deepEqual(
      new Set(
        allResponse.json()
          .data
          .map(
            (trip) => trip.tripId,
          ),
      ),
      new Set([
        activeTripId,
        archivedTripId,
      ]),
    );

    assert.equal(
      archivedResponse.json()
        .data[0]
        .lifecycle.status,
      'archived',
    );
  },
);


test(
  'lifecycle PATCH archives and restores canonical trip',
  async () => {
    const ownerId =
      'm93b2-transition-owner';

    const tripId =
      'm93b2-transition-trip';

    const created =
      await createTrip(
        ownerId,
        tripId,
        'm93b2-transition-create-0001',
      );

    assert.deepEqual(
      created.data.lifecycle,
      {
        status: 'active',
        archivedAt: null,
      },
    );

    const archived =
      await archiveTrip(
        ownerId,
        tripId,
        'm93b2-transition-archive-0001',
      );

    assert.equal(
      archived.statusCode,
      200,
    );

    assert.equal(
      archived.json()
        .data.revision,
      1,
    );

    assert.equal(
      archived.json()
        .data.lifecycle.status,
      'archived',
    );

    assert.equal(
      typeof archived.json()
        .data.lifecycle.archivedAt,
      'string',
    );

    const restored =
      await app.inject({
        method: 'PATCH',
        url:
          `/v1/trips/${tripId}/lifecycle`,

        headers:
          headers(ownerId),

        payload: {
          clientMutationId:
            'm93b2-transition-restore-0001',

          expectedRevision: 1,

          targetStatus:
            'active',
        },
      });

    assert.equal(
      restored.statusCode,
      200,
    );

    assert.equal(
      restored.json()
        .data.revision,
      2,
    );

    assert.deepEqual(
      restored.json()
        .data.lifecycle,
      {
        status: 'active',
        archivedAt: null,
      },
    );
  },
);


test(
  'lifecycle PATCH rejects invalid mutation payload',
  async () => {
    const response =
      await app.inject({
        method: 'PATCH',
        url:
          '/v1/trips/m93b2-invalid/lifecycle',

        headers:
          headers(
            'm93b2-invalid-owner',
          ),

        payload: {
          clientMutationId:
            'short',

          expectedRevision:
            -1,

          targetStatus:
            'deleted',
        },
      });

    assert.equal(
      response.statusCode,
      400,
    );

    assert.equal(
      response.json()
        .error.code,
      'invalid_request',
    );
  },
);


test(
  'stale lifecycle PATCH returns canonical current trip',
  async () => {
    const ownerId =
      'm93b2-stale-owner';

    const tripId =
      'm93b2-stale-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b2-stale-create-0001',
    );

    const archived =
      await archiveTrip(
        ownerId,
        tripId,
        'm93b2-stale-archive-0001',
      );

    assert.equal(
      archived.statusCode,
      200,
    );

    const stale =
      await app.inject({
        method: 'PATCH',
        url:
          `/v1/trips/${tripId}/lifecycle`,

        headers:
          headers(ownerId),

        payload: {
          clientMutationId:
            'm93b2-stale-restore-0001',

          expectedRevision: 0,

          targetStatus:
            'active',
        },
      });

    assert.equal(
      stale.statusCode,
      409,
    );

    assert.equal(
      stale.json().status,
      'conflict',
    );

    assert.equal(
      stale.json()
        .expectedRevision,
      0,
    );

    assert.equal(
      stale.json()
        .trip.revision,
      1,
    );

    assert.equal(
      stale.json()
        .trip.lifecycle.status,
      'archived',
    );
  },
);


test(
  'repeated lifecycle target returns invalid transition without revision',
  async () => {
    const ownerId =
      'm93b2-repeat-owner';

    const tripId =
      'm93b2-repeat-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b2-repeat-create-0001',
    );

    const response =
      await app.inject({
        method: 'PATCH',
        url:
          `/v1/trips/${tripId}/lifecycle`,

        headers:
          headers(ownerId),

        payload: {
          clientMutationId:
            'm93b2-repeat-active-0001',

          expectedRevision: 0,

          targetStatus:
            'active',
        },
      });

    assert.equal(
      response.statusCode,
      409,
    );

    assert.equal(
      response.json().status,
      'invalid_transition',
    );

    assert.equal(
      response.json()
        .trip.revision,
      0,
    );

    assert.equal(
      response.json()
        .trip.lifecycle.status,
      'active',
    );
  },
);


test(
  'replayed lifecycle PATCH is idempotent over HTTP',
  async () => {
    const ownerId =
      'm93b2-replay-owner';

    const tripId =
      'm93b2-replay-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b2-replay-create-0001',
    );

    const payload = {
      clientMutationId:
        'm93b2-replay-archive-0001',

      expectedRevision: 0,

      targetStatus:
        'archived',
    };

    const first =
      await app.inject({
        method: 'PATCH',
        url:
          `/v1/trips/${tripId}/lifecycle`,

        headers:
          headers(ownerId),

        payload,
      });

    const replay =
      await app.inject({
        method: 'PATCH',
        url:
          `/v1/trips/${tripId}/lifecycle`,

        headers:
          headers(ownerId),

        payload,
      });

    assert.equal(
      first.statusCode,
      200,
    );

    assert.equal(
      replay.statusCode,
      200,
    );

    assert.equal(
      replay.json()
        .meta.idempotentReplay,
      true,
    );

    assert.equal(
      replay.json()
        .data.revision,
      first.json()
        .data.revision,
    );

    assert.deepEqual(
      replay.json()
        .data.lifecycle,
      first.json()
        .data.lifecycle,
    );
  },
);


test(
  'lifecycle endpoint preserves owner isolation',
  async () => {
    const ownerA =
      'm93b2-isolation-owner-a';

    const ownerB =
      'm93b2-isolation-owner-b';

    const tripId =
      'm93b2-isolation-trip';

    await createTrip(
      ownerA,
      tripId,
      'm93b2-isolation-create-0001',
    );

    const response =
      await archiveTrip(
        ownerB,
        tripId,
        'm93b2-isolation-archive-0001',
      );

    assert.equal(
      response.statusCode,
      404,
    );

    assert.equal(
      response.json()
        .error.code,
      'trip_not_found',
    );

    const stored =
      await repository.getTrip(
        ownerA,
        tripId,
      );

    assert.equal(
      stored.revision,
      0,
    );

    assert.equal(
      stored.lifecycle.status,
      'active',
    );
  },
);


test(
  'workspace PUT on archived trip fails closed with canonical state',
  async () => {
    const ownerId =
      'm93b2-readonly-owner';

    const tripId =
      'm93b2-readonly-trip';

    await createTrip(
      ownerId,
      tripId,
      'm93b2-readonly-create-0001',
      5000,
    );

    const archived =
      await archiveTrip(
        ownerId,
        tripId,
        'm93b2-readonly-archive-0001',
      );

    assert.equal(
      archived.statusCode,
      200,
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
            'm93b2-readonly-update-0001',

          expectedRevision: 1,

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
        .trip.revision,
      1,
    );

    assert.equal(
      response.json()
        .trip.lifecycle.status,
      'archived',
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
      stored.workspace.funds
        .availableNow,
      5000,
    );
  },
);
