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
  createDevelopmentBearerAuthenticator,
} from '../apps/api/src/auth.mjs';
import {
  buildApiServer,
} from '../apps/api/src/http-app.mjs';

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

const testOwnerHeader = 'x-jahiz-test-owner';

const authenticateRequest =
  async (request) => {
    const ownerId =
      request.headers[
        testOwnerHeader
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
        VALUES ($1, 'active')
        ON CONFLICT (id)
        DO NOTHING
      `,
      [ownerId],
    );

    return {
      ownerId,
      authMode: 'test',
    };
  };

const app = buildApiServer({
  repository,
  authenticateRequest,
});

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
      '2026-08-24T06:30:00.000Z',
    updatedAt:
      '2026-08-24T06:30:00.000Z',
  };
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
      WHERE id LIKE 'm7d-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm7d-%'
    `,
  );

  await app.ready();
});

after(async () => {
  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id LIKE 'm7d-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id LIKE 'm7d-%'
    `,
  );

  await app.close();
  await pool.end();
});

test('health endpoint is public', async () => {
  const response =
    await app.inject({
      method: 'GET',
      url: '/health',
    });

  assert.equal(
    response.statusCode,
    200,
  );

  assert.deepEqual(
    response.json(),
    {
      status: 'ok',
      service: 'jahiz-api',
    },
  );
});

test('trip routes reject unauthenticated requests', async () => {
  const single =
    await app.inject({
      method: 'GET',
      url: '/v1/trips/m7d-none',
    });

  const portfolio =
    await app.inject({
      method: 'GET',
      url: '/v1/trips',
    });

  assert.equal(
    single.statusCode,
    401,
  );

  assert.equal(
    portfolio.statusCode,
    401,
  );
});

test('authenticated portfolio returns only the current owner trips', async () => {
  const ownerA = {
    [testOwnerHeader]:
      'm7d-portfolio-owner-a',
  };

  const ownerB = {
    [testOwnerHeader]:
      'm7d-portfolio-owner-b',
  };

  await app.inject({
    method: 'POST',
    url: '/v1/trips',
    headers: ownerA,
    payload: {
      clientMutationId:
        'm7d-portfolio-create-0001',
      workspace:
        workspace(
          'm7d-portfolio-a-1',
          5100,
        ),
    },
  });

  await app.inject({
    method: 'POST',
    url: '/v1/trips',
    headers: ownerA,
    payload: {
      clientMutationId:
        'm7d-portfolio-create-0002',
      workspace:
        workspace(
          'm7d-portfolio-a-2',
          6200,
        ),
    },
  });

  await app.inject({
    method: 'POST',
    url: '/v1/trips',
    headers: ownerB,
    payload: {
      clientMutationId:
        'm7d-portfolio-create-0003',
      workspace:
        workspace(
          'm7d-portfolio-b-1',
          7300,
        ),
    },
  });

  const response =
    await app.inject({
      method: 'GET',
      url: '/v1/trips',
      headers: ownerA,
    });

  assert.equal(
    response.statusCode,
    200,
  );

  const body =
    response.json();

  assert.equal(
    body.data.length,
    2,
  );

  assert.deepEqual(
    new Set(
      body.data.map(
        (trip) => trip.tripId,
      ),
    ),
    new Set([
      'm7d-portfolio-a-1',
      'm7d-portfolio-a-2',
    ]),
  );

  assert.equal(
    body.data.every(
      (trip) =>
        trip.ownerId ===
        'm7d-portfolio-owner-a',
    ),
    true,
  );
});

test('authenticated portfolio is empty when the account has no trips', async () => {
  const response =
    await app.inject({
      method: 'GET',
      url: '/v1/trips',
      headers: {
        [testOwnerHeader]:
          'm7d-empty-owner',
      },
    });

  assert.equal(
    response.statusCode,
    200,
  );

  assert.deepEqual(
    response.json(),
    {
      data: [],
    },
  );
});

test('authenticated create derives owner from auth context', async () => {
  const tripWorkspace =
    workspace('m7d-create');

  const response =
    await app.inject({
      method: 'POST',
      url: '/v1/trips',
      headers: {
        [testOwnerHeader]:
          'm7d-owner-a',
      },
      payload: {
        clientMutationId:
          'm7d-create-mutation-0001',
        workspace:
          tripWorkspace,
        ownerId:
          'attempted-owner-spoof',
      },
    });

  assert.equal(
    response.statusCode,
    201,
  );

  const body =
    response.json();

  assert.equal(
    body.data.ownerId,
    'm7d-owner-a',
  );
});

test('owner isolation returns not found across users', async () => {
  const tripWorkspace =
    workspace('m7d-isolation');

  await app.inject({
    method: 'POST',
    url: '/v1/trips',
    headers: {
      [testOwnerHeader]:
        'm7d-owner-b',
    },
    payload: {
      clientMutationId:
        'm7d-create-mutation-0002',
      workspace:
        tripWorkspace,
    },
  });

  const response =
    await app.inject({
      method: 'GET',
      url:
        '/v1/trips/m7d-isolation',
      headers: {
        [testOwnerHeader]:
          'm7d-owner-c',
      },
    });

  assert.equal(
    response.statusCode,
    404,
  );
});

test('invalid create payload fails closed', async () => {
  const response =
    await app.inject({
      method: 'POST',
      url: '/v1/trips',
      headers: {
        [testOwnerHeader]:
          'm7d-owner-d',
      },
      payload: {
        clientMutationId: 'short',
        workspace: {
          id: 'broken',
        },
      },
    });

  assert.equal(
    response.statusCode,
    400,
  );
});

test('route and workspace trip ids must match', async () => {
  const tripWorkspace =
    workspace('m7d-id-match');

  await app.inject({
    method: 'POST',
    url: '/v1/trips',
    headers: {
      [testOwnerHeader]:
        'm7d-owner-e',
    },
    payload: {
      clientMutationId:
        'm7d-create-mutation-0003',
      workspace:
        tripWorkspace,
    },
  });

  const response =
    await app.inject({
      method: 'PUT',
      url: '/v1/trips/m7d-id-match',
      headers: {
        [testOwnerHeader]:
          'm7d-owner-e',
      },
      payload: {
        clientMutationId:
          'm7d-update-mutation-0001',
        expectedRevision: 0,
        workspace:
          workspace(
            'm7d-other-id',
            6000,
          ),
      },
    });

  assert.equal(
    response.statusCode,
    400,
  );

  assert.equal(
    response.json().error.code,
    'trip_id_mismatch',
  );
});

test('stale update returns canonical server trip with 409', async () => {
  const tripWorkspace =
    workspace('m7d-conflict');

  await app.inject({
    method: 'POST',
    url: '/v1/trips',
    headers: {
      [testOwnerHeader]:
        'm7d-owner-f',
    },
    payload: {
      clientMutationId:
        'm7d-create-mutation-0004',
      workspace:
        tripWorkspace,
    },
  });

  const first =
    await app.inject({
      method: 'PUT',
      url:
        '/v1/trips/m7d-conflict',
      headers: {
        [testOwnerHeader]:
          'm7d-owner-f',
      },
      payload: {
        clientMutationId:
          'm7d-update-mutation-0002',
        expectedRevision: 0,
        workspace:
          workspace(
            'm7d-conflict',
            7000,
          ),
      },
    });

  assert.equal(
    first.statusCode,
    200,
  );

  const stale =
    await app.inject({
      method: 'PUT',
      url:
        '/v1/trips/m7d-conflict',
      headers: {
        [testOwnerHeader]:
          'm7d-owner-f',
      },
      payload: {
        clientMutationId:
          'm7d-update-mutation-0003',
        expectedRevision: 0,
        workspace:
          workspace(
            'm7d-conflict',
            2500,
          ),
      },
    });

  assert.equal(
    stale.statusCode,
    409,
  );

  const body =
    stale.json();

  assert.equal(
    body.trip.revision,
    1,
  );

  assert.equal(
    body.trip.workspace.funds
      .availableNow,
    7000,
  );
});

test('replayed mutation returns the same revision without duplicate update', async () => {
  const tripWorkspace =
    workspace('m7d-replay');

  await app.inject({
    method: 'POST',
    url: '/v1/trips',
    headers: {
      [testOwnerHeader]:
        'm7d-owner-g',
    },
    payload: {
      clientMutationId:
        'm7d-create-mutation-0005',
      workspace:
        tripWorkspace,
    },
  });

  const payload = {
    clientMutationId:
      'm7d-update-mutation-0004',
    expectedRevision: 0,
    workspace:
      workspace(
        'm7d-replay',
        8800,
      ),
  };

  const first =
    await app.inject({
      method: 'PUT',
      url: '/v1/trips/m7d-replay',
      headers: {
        [testOwnerHeader]:
          'm7d-owner-g',
      },
      payload,
    });

  const replay =
    await app.inject({
      method: 'PUT',
      url: '/v1/trips/m7d-replay',
      headers: {
        [testOwnerHeader]:
          'm7d-owner-g',
      },
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
    replay.json().meta
      .idempotentReplay,
    true,
  );

  assert.equal(
    replay.json().data.revision,
    first.json().data.revision,
  );
});

test('development auth cannot be enabled in production', () => {
  assert.throws(
    () =>
      createDevelopmentBearerAuthenticator({
        enabled: true,
        nodeEnv: 'production',
      }),
    /cannot be enabled in production/,
  );
});

test('server construction requires an authentication verifier', () => {
  assert.throws(
    () =>
      buildApiServer({
        repository,
        authenticateRequest:
          undefined,
      }),
    /authentication verifier is required/,
  );
});
