import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test, {
  after,
  before,
} from 'node:test';

import {
  tripWorkspaceSchema,
} from '../packages/api-contracts/src/index.ts';

import {
  createPostgresPool,
} from '../apps/api/src/db.mjs';
import {
  createTripRepository,
} from '../apps/api/src/trip-repository.mjs';
import {
  createJahizIdentityRepository,
} from '../apps/api/src/identity-repository.mjs';
import {
  createJahizRuntimeAuthenticator,
} from '../apps/api/src/auth-runtime-selector.mjs';
import {
  buildApiServer,
} from '../apps/api/src/http-app.mjs';

import {
  isShadowTelemetrySafe,
  runShadowSync,
} from '../apps/mobile/src/features/sync/jahiz-shadow-sync.ts';
import {
  createShadowSyncHttpTransport,
} from '../apps/mobile/src/features/sync/jahiz-shadow-sync-http.ts';

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

const providerSubject =
  'm7e2-owner';

const ownerId =
  'usr_m7e2_shadow_owner';

const authorization =
  `Bearer dev:${providerSubject}`;

const identityRepository =
  createJahizIdentityRepository(
    pool,
    {
      ownerIdFactory() {
        return ownerId;
      },
    },
  );

const authenticateRequest =
  createJahizRuntimeAuthenticator({
    mode: 'development',
    nodeEnv: 'test',
    identityRepository,
    developmentOptions: {
      enabled: true,
    },
  });

const app = buildApiServer({
  repository,
  authenticateRequest,
  logger: false,
});

let baseUrl = '';

function workspace(
  id,
  availableNow = 5000,
  updatedAt =
    '2026-08-24T06:50:00.000Z',
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
    updatedAt,
  });
}

function createTransport() {
  return createShadowSyncHttpTransport({
    baseUrl,
    async getAuthorizationHeader() {
      return authorization;
    },
  });
}

async function clearTrip(id) {
  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id = $1
    `,
    [id],
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
      WHERE id LIKE 'm7e2-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id = $1
    `,
    [ownerId],
  );

  const resolved =
    await identityRepository
      .ensureOwnerForIdentity({
        provider:
          'development',
        providerSubject,
      });

  assert.equal(
    resolved.status,
    'active',
  );

  assert.equal(
    resolved.ownerId,
    ownerId,
  );

  await app.listen({
    host: '127.0.0.1',
    port: 0,
  });

  const address =
    app.server.address();

  if (
    !address ||
    typeof address === 'string'
  ) {
    throw new Error(
      'Could not resolve ephemeral HTTP port.',
    );
  }

  baseUrl =
    `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await pool.query(
    `
      DELETE FROM jahiz_trip
      WHERE id LIKE 'm7e2-%'
    `,
  );

  await pool.query(
    `
      DELETE FROM jahiz_user
      WHERE id = $1
    `,
    [ownerId],
  );

  await app.close();
  await pool.end();
});

test('real HTTP health is reachable over a bound socket', async () => {
  const response =
    await fetch(`${baseUrl}/health`);

  assert.equal(
    response.status,
    200,
  );

  assert.deepEqual(
    await response.json(),
    {
      status: 'ok',
      service: 'jahiz-api',
    },
  );
});

test('first shadow sync crosses mobile transport, auth, BFF and PostgreSQL', async () => {
  const local =
    workspace(
      'm7e2-create',
      5000,
    );

  const result =
    await runShadowSync({
      workspace: local,
      cursor: null,
      clientMutationId:
        'm7e2-create-mutation-0001',
      transport: createTransport(),
    });

  assert.equal(
    result.outcome,
    'created',
  );
  assert.equal(
    result.telemetry.parity,
    'same',
  );
  assert.equal(
    result.cursor?.serverRevision,
    0,
  );

  const stored =
    await repository.getTrip(
      ownerId,
      local.id,
    );

  assert.equal(
    stored?.workspace.funds
      .availableNow,
    5000,
  );
});

test('unchanged shadow cursor performs zero HTTP requests', async () => {
  const id =
    'm7e2-unchanged';

  const local =
    workspace(id);

  const first =
    await runShadowSync({
      workspace: local,
      cursor: null,
      clientMutationId:
        'm7e2-create-mutation-0002',
      transport: createTransport(),
    });

  assert.ok(first.cursor);

  let fetchCalls = 0;

  const countedTransport =
    createShadowSyncHttpTransport({
      baseUrl,
      async getAuthorizationHeader() {
        return authorization;
      },
      async fetchImpl(
        input,
        init,
      ) {
        fetchCalls += 1;

        return fetch(
          input,
          init,
        );
      },
    });

  const second =
    await runShadowSync({
      workspace: local,
      cursor: first.cursor,
      clientMutationId:
        'm7e2-skip-mutation-0001',
      transport:
        countedTransport,
    });

  assert.equal(
    second.outcome,
    'skipped-unchanged',
  );
  assert.equal(fetchCalls, 0);
});

test('local mutation becomes one CAS server revision over real HTTP', async () => {
  const id =
    'm7e2-update';

  const firstLocal =
    workspace(
      id,
      5000,
      '2026-08-24T06:50:00.000Z',
    );

  const created =
    await runShadowSync({
      workspace: firstLocal,
      cursor: null,
      clientMutationId:
        'm7e2-create-mutation-0003',
      transport: createTransport(),
    });

  assert.ok(created.cursor);

  const changedLocal =
    workspace(
      id,
      6400,
      '2026-08-24T06:51:00.000Z',
    );

  const updated =
    await runShadowSync({
      workspace: changedLocal,
      cursor: created.cursor,
      clientMutationId:
        'm7e2-update-mutation-0001',
      transport: createTransport(),
    });

  assert.equal(
    updated.outcome,
    'updated',
  );
  assert.equal(
    updated.cursor?.serverRevision,
    1,
  );

  const stored =
    await repository.getTrip(
      ownerId,
      id,
    );

  assert.equal(
    stored?.revision,
    1,
  );
  assert.equal(
    stored?.workspace.funds
      .availableNow,
    6400,
  );
});

test('lost acknowledgement replay converges idempotently without another revision', async () => {
  const id =
    'm7e2-replay';

  const original =
    workspace(
      id,
      5000,
      '2026-08-24T06:50:00.000Z',
    );

  const created =
    await runShadowSync({
      workspace: original,
      cursor: null,
      clientMutationId:
        'm7e2-create-mutation-0004',
      transport: createTransport(),
    });

  assert.ok(created.cursor);

  const changed =
    workspace(
      id,
      7200,
      '2026-08-24T06:52:00.000Z',
    );

  const mutationId =
    'm7e2-replay-mutation-0001';

  const first =
    await runShadowSync({
      workspace: changed,
      cursor: created.cursor,
      clientMutationId:
        mutationId,
      transport: createTransport(),
    });

  assert.equal(
    first.outcome,
    'updated',
  );

  const replay =
    await runShadowSync({
      workspace: changed,
      cursor: created.cursor,
      clientMutationId:
        mutationId,
      transport: createTransport(),
    });

  assert.equal(
    replay.outcome,
    'updated',
  );
  assert.equal(
    replay.cursor?.serverRevision,
    1,
  );

  const stored =
    await repository.getTrip(
      ownerId,
      id,
    );

  assert.equal(
    stored?.revision,
    1,
  );
});

test('real concurrent server update produces 409 and never mutates local workspace', async () => {
  const id =
    'm7e2-conflict';

  const local =
    workspace(
      id,
      5000,
      '2026-08-24T06:50:00.000Z',
    );

  const created =
    await runShadowSync({
      workspace: local,
      cursor: null,
      clientMutationId:
        'm7e2-create-mutation-0005',
      transport: createTransport(),
    });

  assert.ok(created.cursor);

  const concurrent =
    workspace(
      id,
      3000,
      '2026-08-24T06:51:30.000Z',
    );

  const serverWrite =
    await repository.updateTrip({
      ownerId,
      tripId: id,
      expectedRevision: 0,
      clientMutationId:
        'm7e2-server-concurrent-0001',
      workspace: concurrent,
    });

  assert.equal(
    serverWrite.status,
    'applied',
  );

  const localAfter =
    workspace(
      id,
      8000,
      '2026-08-24T06:52:00.000Z',
    );

  const before =
    JSON.stringify(localAfter);

  const conflict =
    await runShadowSync({
      workspace: localAfter,
      cursor: created.cursor,
      clientMutationId:
        'm7e2-client-conflict-0001',
      transport: createTransport(),
    });

  assert.equal(
    conflict.outcome,
    'conflict',
  );
  assert.equal(
    conflict.remoteTrip?.revision,
    1,
  );
  assert.equal(
    conflict.remoteTrip?.workspace
      .funds.availableNow,
    3000,
  );
  assert.equal(
    JSON.stringify(localAfter),
    before,
  );
  assert.equal(
    conflict.cursor?.serverRevision,
    0,
  );
});

test('bootstrap divergence is detected over real HTTP without a write', async () => {
  const id =
    'm7e2-bootstrap-divergence';

  await clearTrip(id);

  const remote =
    workspace(
      id,
      2200,
      '2026-08-24T06:50:00.000Z',
    );

  const created =
    await repository.createTrip({
      ownerId,
      clientMutationId:
        'm7e2-direct-create-0001',
      workspace: remote,
    });

  assert.equal(
    created.status,
    'applied',
  );

  const local =
    workspace(
      id,
      9100,
      '2026-08-24T06:50:00.000Z',
    );

  const result =
    await runShadowSync({
      workspace: local,
      cursor: null,
      clientMutationId:
        'm7e2-bootstrap-mutation-0001',
      transport: createTransport(),
    });

  assert.equal(
    result.outcome,
    'bootstrap-divergence',
  );
  assert.equal(
    result.cursor,
    null,
  );

  const stored =
    await repository.getTrip(
      ownerId,
      id,
    );

  assert.equal(
    stored?.revision,
    0,
  );
  assert.equal(
    stored?.workspace.funds
      .availableNow,
    2200,
  );
});

test('shadow telemetry remains privacy-safe end to end', async () => {
  const local =
    workspace(
      'm7e2-telemetry',
      5555,
    );

  const result =
    await runShadowSync({
      workspace: local,
      cursor: null,
      clientMutationId:
        'm7e2-telemetry-mutation-0001',
      transport: createTransport(),
    });

  assert.equal(
    isShadowTelemetrySafe(
      result.telemetry,
    ),
    true,
  );

  const serialized =
    JSON.stringify(
      result.telemetry,
    );

  for (const forbidden of [
    '5555',
    'availableNow',
    'safetyReserve',
    'workspace',
  ]) {
    assert.equal(
      serialized.includes(
        forbidden,
      ),
      false,
    );
  }
});

test('unauthorized channel fails closed before any trip disclosure', async () => {
  const transport =
    createShadowSyncHttpTransport({
      baseUrl,
      async getAuthorizationHeader() {
        return 'Bearer dev:';
      },
    });

  const result =
    await transport.getTrip(
      'm7e2-create',
    );

  assert.equal(
    result.status,
    'unauthorized',
  );
});
