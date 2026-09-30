import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tripWorkspaceSchema,
  type ServerTripEnvelope,
  type TripWorkspace,
} from '../packages/api-contracts/src/index.ts';

import {
  createShadowSyncCursorStore,
  shadowCursorStorageKeyForTrip,
  type ShadowCursorStorage,
} from '../apps/mobile/src/features/sync/jahiz-shadow-sync-cursor-store.ts';

import {
  createShadowSyncRuntimeController,
} from '../apps/mobile/src/features/sync/jahiz-shadow-sync-runtime.ts';

import type {
  ShadowSyncTelemetryEvent,
  ShadowSyncTransport,
} from '../apps/mobile/src/features/sync/jahiz-shadow-sync.ts';

function workspace(
  id = 'runtime-trip-1',
  availableNow = 5000,
  updatedAt =
    '2026-08-24T06:55:00.000Z',
): TripWorkspace {
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

function envelope(
  tripWorkspace: TripWorkspace,
  revision = 0,
): ServerTripEnvelope {
  return {
    tripId:
      tripWorkspace.id,
    ownerId:
      'runtime-owner',
    revision,
    workspace:
      tripWorkspaceSchema.parse(
        tripWorkspace,
      ),
    serverUpdatedAt:
      '2026-08-24T06:56:00.000Z',
  };
}

function memoryStorage() {
  const values =
    new Map<string, string>();

  const storage:
    ShadowCursorStorage = {
      async getItemAsync(key) {
        return (
          values.get(key) ??
          null
        );
      },
      async setItemAsync(
        key,
        value,
      ) {
        values.set(
          key,
          value,
        );
      },
      async deleteItemAsync(key) {
        values.delete(key);
      },
    };

  return {
    storage,
    values,
  };
}

test('cursor store round-trips per trip', async () => {
  const memory =
    memoryStorage();

  const store =
    createShadowSyncCursorStore(
      memory.storage,
    );

  await store.save(
    'trip-a',
    {
      serverRevision: 4,
      lastSyncedLocalUpdatedAt:
        '2026-08-24T06:55:00.000Z',
      lastServerUpdatedAt:
        '2026-08-24T06:56:00.000Z',
    },
  );

  assert.deepEqual(
    await store.load(
      'trip-a',
    ),
    {
      serverRevision: 4,
      lastSyncedLocalUpdatedAt:
        '2026-08-24T06:55:00.000Z',
      lastServerUpdatedAt:
        '2026-08-24T06:56:00.000Z',
    },
  );

  assert.equal(
    await store.load(
      'trip-b',
    ),
    null,
  );
});

test('malformed persisted cursor fails closed', async () => {
  const memory =
    memoryStorage();

  memory.values.set(
    shadowCursorStorageKeyForTrip('broken'),
    '{"serverRevision":-1}',
  );

  const store =
    createShadowSyncCursorStore(
      memory.storage,
    );

  assert.equal(
    await store.load(
      'broken',
    ),
    null,
  );
});

test('disabled runtime performs zero storage and zero network work', async () => {
  let storageCalls = 0;
  let networkCalls = 0;

  const controller =
    createShadowSyncRuntimeController({
      enabled: false,
      cursorStore: {
        async load() {
          storageCalls += 1;
          return null;
        },
        async save() {
          storageCalls += 1;
        },
        async remove() {
          storageCalls += 1;
        },
      },
      transport: {
        async getTrip() {
          networkCalls += 1;
          return {
            status:
              'not-found',
          };
        },
        async createTrip() {
          networkCalls += 1;
          return {
            status:
              'unavailable',
          };
        },
        async updateTrip() {
          networkCalls += 1;
          return {
            status:
              'unavailable',
          };
        },
      },
    });

  const result =
    await controller.sync(
      workspace(),
    );

  assert.deepEqual(
    result,
    {
      status: 'disabled',
      attempts: 0,
    },
  );

  assert.equal(
    storageCalls,
    0,
  );
  assert.equal(
    networkCalls,
    0,
  );
});

test('successful create persists revision cursor', async () => {
  const memory =
    memoryStorage();

  const store =
    createShadowSyncCursorStore(
      memory.storage,
    );

  const local =
    workspace(
      'runtime-create',
    );

  const controller =
    createShadowSyncRuntimeController({
      enabled: true,
      cursorStore: store,
      createClientMutationId() {
        return 'runtime-create-0001';
      },
      transport: {
        async getTrip() {
          return {
            status:
              'not-found',
          };
        },
        async createTrip(
          request,
        ) {
          return {
            status: 'applied',
            trip: envelope(
              request.workspace,
              0,
            ),
            idempotentReplay:
              false,
          };
        },
        async updateTrip() {
          throw new Error(
            'update not expected',
          );
        },
      },
    });

  const result =
    await controller.sync(
      local,
    );

  assert.equal(
    result.status,
    'completed',
  );

  assert.equal(
    (
      await store.load(
        local.id,
      )
    )?.serverRevision,
    0,
  );
});

test('unavailable result retries with the same mutation id then converges', async () => {
  const memory =
    memoryStorage();

  const store =
    createShadowSyncCursorStore(
      memory.storage,
    );

  const local =
    workspace(
      'runtime-retry',
    );

  const mutationIds:
    string[] = [];
  const delays:
    number[] = [];
  let createCalls = 0;

  const controller =
    createShadowSyncRuntimeController({
      enabled: true,
      cursorStore: store,
      retryPolicy: {
        maxAttempts: 3,
        baseDelayMs: 10,
        maxDelayMs: 100,
      },
      async sleep(
        milliseconds,
      ) {
        delays.push(
          milliseconds,
        );
      },
      createClientMutationId() {
        return 'runtime-retry-0001';
      },
      transport: {
        async getTrip() {
          return {
            status:
              'not-found',
          };
        },
        async createTrip(
          request,
        ) {
          createCalls += 1;
          mutationIds.push(
            request.clientMutationId,
          );

          if (
            createCalls === 1
          ) {
            return {
              status:
                'unavailable',
            };
          }

          return {
            status: 'applied',
            trip: envelope(
              request.workspace,
            ),
            idempotentReplay:
              true,
          };
        },
        async updateTrip() {
          throw new Error(
            'update not expected',
          );
        },
      },
    });

  const result =
    await controller.sync(
      local,
    );

  assert.equal(
    result.status,
    'completed',
  );

  if (
    result.status ===
    'completed'
  ) {
    assert.equal(
      result.attempts,
      2,
    );
    assert.equal(
      result.result.outcome,
      'created',
    );
  }

  assert.deepEqual(
    mutationIds,
    [
      'runtime-retry-0001',
      'runtime-retry-0001',
    ],
  );

  assert.deepEqual(
    delays,
    [10],
  );
});

test('unauthorized result never retries', async () => {
  const memory =
    memoryStorage();

  let calls = 0;

  const controller =
    createShadowSyncRuntimeController({
      enabled: true,
      cursorStore:
        createShadowSyncCursorStore(
          memory.storage,
        ),
      createClientMutationId() {
        return 'runtime-auth-0001';
      },
      transport: {
        async getTrip() {
          calls += 1;
          return {
            status:
              'unauthorized',
          };
        },
        async createTrip() {
          calls += 1;
          return {
            status:
              'unauthorized',
          };
        },
        async updateTrip() {
          calls += 1;
          return {
            status:
              'unauthorized',
          };
        },
      },
    });

  const result =
    await controller.sync(
      workspace(
        'runtime-auth',
      ),
    );

  assert.equal(calls, 1);

  assert.equal(
    result.status,
    'completed',
  );

  if (
    result.status ===
    'completed'
  ) {
    assert.equal(
      result.attempts,
      1,
    );
    assert.equal(
      result.result.outcome,
      'unauthorized',
    );
  }
});

test('same-trip concurrent calls are one-flight', async () => {
  const memory =
    memoryStorage();

  const local =
    workspace(
      'runtime-one-flight',
    );

  let getCalls = 0;
  let release:
    (() => void) | null =
    null;

  const gate =
    new Promise<void>(
      (resolve) => {
        release = resolve;
      },
    );

  const transport:
    ShadowSyncTransport = {
      async getTrip() {
        getCalls += 1;

        await gate;

        return {
          status:
            'not-found',
        };
      },
      async createTrip(
        request,
      ) {
        return {
          status: 'applied',
          trip: envelope(
            request.workspace,
          ),
          idempotentReplay:
            false,
        };
      },
      async updateTrip() {
        throw new Error(
          'update not expected',
        );
      },
    };

  const controller =
    createShadowSyncRuntimeController({
      enabled: true,
      cursorStore:
        createShadowSyncCursorStore(
          memory.storage,
        ),
      createClientMutationId() {
        return 'runtime-flight-0001';
      },
      transport,
    });

  const first =
    controller.sync(local);

  const second =
    controller.sync(local);

  assert.equal(
    first,
    second,
  );

  assert.equal(
    controller.isInFlight(
      local.id,
    ),
    true,
  );

  release?.();

  await Promise.all([
    first,
    second,
  ]);

  assert.equal(
    getCalls,
    1,
  );

  assert.equal(
    controller.isInFlight(
      local.id,
    ),
    false,
  );
});

test('conflict keeps the existing cursor revision', async () => {
  const memory =
    memoryStorage();

  const store =
    createShadowSyncCursorStore(
      memory.storage,
    );

  const local =
    workspace(
      'runtime-conflict',
      8000,
      '2026-08-24T06:58:00.000Z',
    );

  await store.save(
    local.id,
    {
      serverRevision: 4,
      lastSyncedLocalUpdatedAt:
        '2026-08-24T06:55:00.000Z',
      lastServerUpdatedAt:
        '2026-08-24T06:56:00.000Z',
    },
  );

  const remote =
    workspace(
      local.id,
      2500,
      '2026-08-24T06:57:00.000Z',
    );

  const controller =
    createShadowSyncRuntimeController({
      enabled: true,
      cursorStore: store,
      createClientMutationId() {
        return 'runtime-conflict-0001';
      },
      transport: {
        async getTrip() {
          throw new Error(
            'read not expected',
          );
        },
        async createTrip() {
          throw new Error(
            'create not expected',
          );
        },
        async updateTrip() {
          return {
            status:
              'conflict',
            expectedRevision: 4,
            trip: envelope(
              remote,
              5,
            ),
          };
        },
      },
    });

  const result =
    await controller.sync(
      local,
    );

  assert.equal(
    result.status,
    'completed',
  );

  if (
    result.status ===
    'completed'
  ) {
    assert.equal(
      result.result.outcome,
      'conflict',
    );
  }

  assert.equal(
    (
      await store.load(
        local.id,
      )
    )?.serverRevision,
    4,
  );
});

test('telemetry sink receives only privacy-safe metadata', async () => {
  const memory =
    memoryStorage();

  const events:
    ShadowSyncTelemetryEvent[] = [];

  const local =
    workspace(
      'runtime-telemetry',
      7777,
    );

  const controller =
    createShadowSyncRuntimeController({
      enabled: true,
      cursorStore:
        createShadowSyncCursorStore(
          memory.storage,
        ),
      telemetrySink(event) {
        events.push(event);
      },
      createClientMutationId() {
        return 'runtime-telemetry-0001';
      },
      transport: {
        async getTrip() {
          return {
            status:
              'not-found',
          };
        },
        async createTrip(
          request,
        ) {
          return {
            status: 'applied',
            trip: envelope(
              request.workspace,
            ),
            idempotentReplay:
              false,
          };
        },
        async updateTrip() {
          throw new Error(
            'update not expected',
          );
        },
      },
    });

  await controller.sync(
    local,
  );

  assert.equal(
    events.length,
    1,
  );

  const serialized =
    JSON.stringify(
      events[0],
    );

  for (const forbidden of [
    '7777',
    'workspace',
    'availableNow',
    'safetyReserve',
    'commitments',
  ]) {
    assert.equal(
      serialized.includes(
        forbidden,
      ),
      false,
    );
  }
});

test('runtime controller never mutates the local workspace', async () => {
  const memory =
    memoryStorage();

  const local =
    workspace(
      'runtime-no-mutation',
      9000,
    );

  const before =
    JSON.stringify(local);

  const controller =
    createShadowSyncRuntimeController({
      enabled: true,
      cursorStore:
        createShadowSyncCursorStore(
          memory.storage,
        ),
      createClientMutationId() {
        return 'runtime-no-mutation-0001';
      },
      transport: {
        async getTrip() {
          return {
            status:
              'not-found',
          };
        },
        async createTrip(
          request,
        ) {
          return {
            status: 'applied',
            trip: envelope(
              request.workspace,
            ),
            idempotentReplay:
              false,
          };
        },
        async updateTrip() {
          throw new Error(
            'update not expected',
          );
        },
      },
    });

  await controller.sync(
    local,
  );

  assert.equal(
    JSON.stringify(local),
    before,
  );
});
test('cursor storage keys are native SecureStore-safe for arbitrary trip ids', () => {
  const first =
    shadowCursorStorageKeyForTrip(
      'trip:DXB/CAI user 1',
    );

  const second =
    shadowCursorStorageKeyForTrip(
      'trip:DXB/CAI user 2',
    );

  assert.match(
    first,
    /^[A-Za-z0-9._-]+$/,
  );

  assert.equal(
    first.includes(':'),
    false,
  );

  assert.notEqual(
    first,
    second,
  );

  assert.equal(
    first,
    shadowCursorStorageKeyForTrip(
      'trip:DXB/CAI user 1',
    ),
  );
});
