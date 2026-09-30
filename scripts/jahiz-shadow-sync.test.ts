import assert from 'node:assert/strict';
import test from 'node:test';

import {
  tripWorkspaceSchema,
  type ServerTripEnvelope,
  type TripWorkspace,
} from '../packages/api-contracts/src/index.ts';

import {
  areTripWorkspacesEqual,
  isShadowTelemetrySafe,
  runShadowSync,
  type ShadowSyncTransport,
} from '../apps/mobile/src/features/sync/jahiz-shadow-sync.ts';

import {
  createShadowSyncHttpTransport,
} from '../apps/mobile/src/features/sync/jahiz-shadow-sync-http.ts';

function workspace(
  id = 'shadow-trip-1',
  availableNow = 5000,
  updatedAt =
    '2026-08-24T06:40:00.000Z',
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
    tripId: tripWorkspace.id,
    ownerId: 'shadow-owner',
    revision,
    workspace:
      tripWorkspaceSchema.parse(
        tripWorkspace,
      ),
    serverUpdatedAt:
      '2026-08-24T06:41:00.000Z',
  };
}

test('workspace parity is deterministic regardless of object key order', () => {
  const original = workspace();

  const reordered =
    JSON.parse(
      JSON.stringify(original),
    ) as TripWorkspace;

  assert.equal(
    areTripWorkspacesEqual(
      original,
      reordered,
    ),
    true,
  );
});

test('first shadow sync creates server copy only when remote trip is absent', async () => {
  const local = workspace();
  let createCalls = 0;

  const transport: ShadowSyncTransport = {
    async getTrip() {
      return {
        status: 'not-found',
      };
    },
    async createTrip(request) {
      createCalls += 1;

      return {
        status: 'applied',
        trip: envelope(
          request.workspace,
        ),
        idempotentReplay: false,
      };
    },
    async updateTrip() {
      throw new Error(
        'update should not run',
      );
    },
  };

  const result =
    await runShadowSync({
      workspace: local,
      cursor: null,
      clientMutationId:
        'shadow-create-0001',
      transport,
    });

  assert.equal(
    result.outcome,
    'created',
  );
  assert.equal(
    createCalls,
    1,
  );
  assert.equal(
    result.cursor?.serverRevision,
    0,
  );
});

test('matching bootstrap records parity without rewriting the server', async () => {
  const local = workspace();
  let writes = 0;

  const transport: ShadowSyncTransport = {
    async getTrip() {
      return {
        status: 'found',
        trip: envelope(local, 7),
      };
    },
    async createTrip() {
      writes += 1;
      return {
        status: 'unavailable',
      };
    },
    async updateTrip() {
      writes += 1;
      return {
        status: 'unavailable',
      };
    },
  };

  const result =
    await runShadowSync({
      workspace: local,
      cursor: null,
      clientMutationId:
        'shadow-match-0001',
      transport,
    });

  assert.equal(
    result.outcome,
    'matched',
  );
  assert.equal(writes, 0);
  assert.equal(
    result.cursor?.serverRevision,
    7,
  );
});

test('bootstrap divergence never silently chooses either authority', async () => {
  const local =
    workspace(
      'shadow-divergence',
      5000,
    );

  const remote =
    workspace(
      'shadow-divergence',
      2500,
    );

  let writes = 0;

  const transport: ShadowSyncTransport = {
    async getTrip() {
      return {
        status: 'found',
        trip: envelope(
          remote,
          3,
        ),
      };
    },
    async createTrip() {
      writes += 1;
      return {
        status: 'unavailable',
      };
    },
    async updateTrip() {
      writes += 1;
      return {
        status: 'unavailable',
      };
    },
  };

  const result =
    await runShadowSync({
      workspace: local,
      cursor: null,
      clientMutationId:
        'shadow-diverge-0001',
      transport,
    });

  assert.equal(
    result.outcome,
    'bootstrap-divergence',
  );
  assert.equal(
    result.cursor,
    null,
  );
  assert.equal(writes, 0);
  assert.equal(
    result.remoteTrip?.workspace
      .funds.availableNow,
    2500,
  );
});

test('unchanged local workspace performs no network work', async () => {
  const local = workspace();
  let calls = 0;

  const transport: ShadowSyncTransport = {
    async getTrip() {
      calls += 1;
      return {
        status: 'not-found',
      };
    },
    async createTrip() {
      calls += 1;
      return {
        status: 'unavailable',
      };
    },
    async updateTrip() {
      calls += 1;
      return {
        status: 'unavailable',
      };
    },
  };

  const result =
    await runShadowSync({
      workspace: local,
      cursor: {
        serverRevision: 4,
        lastSyncedLocalUpdatedAt:
          local.updatedAt,
        lastServerUpdatedAt:
          '2026-08-24T06:41:00.000Z',
      },
      clientMutationId:
        'shadow-skip-0001',
      transport,
    });

  assert.equal(
    result.outcome,
    'skipped-unchanged',
  );
  assert.equal(calls, 0);
});

test('changed local workspace uses cursor revision for compare-and-swap update', async () => {
  const local =
    workspace(
      'shadow-update',
      6400,
      '2026-08-24T06:42:00.000Z',
    );

  let expectedRevision:
    | number
    | null = null;

  const transport: ShadowSyncTransport = {
    async getTrip() {
      throw new Error(
        'read should not run',
      );
    },
    async createTrip() {
      throw new Error(
        'create should not run',
      );
    },
    async updateTrip(
      _tripId,
      request,
    ) {
      expectedRevision =
        request.expectedRevision;

      return {
        status: 'applied',
        trip: envelope(
          request.workspace,
          5,
        ),
        idempotentReplay: false,
      };
    },
  };

  const result =
    await runShadowSync({
      workspace: local,
      cursor: {
        serverRevision: 4,
        lastSyncedLocalUpdatedAt:
          '2026-08-24T06:40:00.000Z',
        lastServerUpdatedAt:
          '2026-08-24T06:41:00.000Z',
      },
      clientMutationId:
        'shadow-update-0001',
      transport,
    });

  assert.equal(
    expectedRevision,
    4,
  );
  assert.equal(
    result.outcome,
    'updated',
  );
  assert.equal(
    result.cursor?.serverRevision,
    5,
  );
});

test('409 conflict preserves local authority and returns canonical remote state', async () => {
  const local =
    workspace(
      'shadow-conflict',
      7000,
      '2026-08-24T06:43:00.000Z',
    );

  const remote =
    workspace(
      'shadow-conflict',
      2500,
      '2026-08-24T06:42:30.000Z',
    );

  const before =
    JSON.stringify(local);

  const transport: ShadowSyncTransport = {
    async getTrip() {
      throw new Error(
        'read should not run',
      );
    },
    async createTrip() {
      throw new Error(
        'create should not run',
      );
    },
    async updateTrip() {
      return {
        status: 'conflict',
        expectedRevision: 4,
        trip: envelope(
          remote,
          5,
        ),
      };
    },
  };

  const result =
    await runShadowSync({
      workspace: local,
      cursor: {
        serverRevision: 4,
        lastSyncedLocalUpdatedAt:
          '2026-08-24T06:40:00.000Z',
        lastServerUpdatedAt:
          '2026-08-24T06:41:00.000Z',
      },
      clientMutationId:
        'shadow-conflict-0001',
      transport,
    });

  assert.equal(
    result.outcome,
    'conflict',
  );
  assert.equal(
    result.cursor?.serverRevision,
    4,
  );
  assert.equal(
    result.remoteTrip?.revision,
    5,
  );
  assert.equal(
    JSON.stringify(local),
    before,
  );
});

test('telemetry never contains raw workspace or money fields', async () => {
  const local = workspace();

  const transport: ShadowSyncTransport = {
    async getTrip() {
      return {
        status: 'found',
        trip: envelope(local, 2),
      };
    },
    async createTrip() {
      return {
        status: 'unavailable',
      };
    },
    async updateTrip() {
      return {
        status: 'unavailable',
      };
    },
  };

  const result =
    await runShadowSync({
      workspace: local,
      cursor: null,
      clientMutationId:
        'shadow-safe-0001',
      transport,
    });

  assert.equal(
    isShadowTelemetrySafe(
      result.telemetry,
    ),
    true,
  );

  assert.equal(
    Object.prototype.hasOwnProperty.call(
      result.telemetry,
      'workspace',
    ),
    false,
  );
});

test('HTTP transport maps authenticated 409 into canonical conflict', async () => {
  const remote =
    envelope(
      workspace(
        'shadow-http-conflict',
        3000,
      ),
      6,
    );

  let authorization:
    | string
    | undefined;

  const transport =
    createShadowSyncHttpTransport({
      baseUrl:
        'http://127.0.0.1:4010/',
      async getAuthorizationHeader() {
        return 'Bearer test-token';
      },
      async fetchImpl(
        _url,
        init,
      ) {
        authorization =
          init?.headers?.authorization;

        return {
          status: 409,
          async json() {
            return {
              status: 'conflict',
              expectedRevision: 5,
              trip: remote,
            };
          },
        };
      },
    });

  const result =
    await transport.updateTrip(
      remote.tripId,
      {
        clientMutationId:
          'shadow-http-0001',
        expectedRevision: 5,
        workspace:
          remote.workspace,
      },
    );

  assert.equal(
    authorization,
    'Bearer test-token',
  );

  assert.equal(
    result.status,
    'conflict',
  );

  if (result.status === 'conflict') {
    assert.equal(
      result.trip?.revision,
      6,
    );
  }
});

test('HTTP create conflict preserves canonical server trip', async () => {
  const remote =
    envelope(
      workspace(
        'shadow-http-create-conflict',
        3200,
      ),
      4,
    );

  const transport =
    createShadowSyncHttpTransport({
      baseUrl:
        'http://127.0.0.1:4010',
      async getAuthorizationHeader() {
        return 'Bearer test-token';
      },
      async fetchImpl() {
        return {
          status: 409,
          async json() {
            return {
              status: 'conflict',
              trip: remote,
              error: {
                code:
                  'trip_id_conflict',
              },
            };
          },
        };
      },
    });

  const result =
    await transport.createTrip({
      clientMutationId:
        'shadow-http-create-conflict-0001',
      workspace:
        remote.workspace,
    });

  assert.equal(
    result.status,
    'conflict',
  );

  if (result.status === 'conflict') {
    assert.equal(
      result.trip?.revision,
      4,
    );
    assert.equal(
      result.trip?.tripId,
      remote.tripId,
    );
    assert.equal(
      result.expectedRevision,
      null,
    );
  }
});

test('HTTP create conflict fails closed when canonical body is malformed', async () => {
  const transport =
    createShadowSyncHttpTransport({
      baseUrl:
        'http://127.0.0.1:4010',
      async getAuthorizationHeader() {
        return 'Bearer test-token';
      },
      async fetchImpl() {
        return {
          status: 409,
          async json() {
            return {
              status: 'conflict',
              trip: {
                revision:
                  'not-a-number',
              },
            };
          },
        };
      },
    });

  const result =
    await transport.createTrip({
      clientMutationId:
        'shadow-http-create-bad-0001',
      workspace:
        workspace(
          'shadow-http-create-bad',
        ),
    });

  assert.equal(
    result.status,
    'invalid-response',
  );
});

test('HTTP lifecycle transport applies PATCH and preserves canonical result', async () => {
  const trip =
    envelope(
      workspace(
        'shadow-http-lifecycle',
      ),
      3,
    );

  const archived = {
    ...trip,
    lifecycle: {
      status:
        'archived' as const,
      archivedAt:
        '2026-08-24T07:00:00.000Z',
      deletedAt: null,
    },
  };

  let method:
    string | undefined;
  let requestedUrl = '';
  let requestBody = '';

  const transport =
    createShadowSyncHttpTransport({
      baseUrl:
        'http://127.0.0.1:4010/',
      async getAuthorizationHeader() {
        return 'Bearer test-token';
      },
      async fetchImpl(
        url,
        init,
      ) {
        requestedUrl = url;
        method = init?.method;
        requestBody =
          init?.body ?? '';

        return {
          status: 200,
          async json() {
            return {
              data: archived,
              meta: {
                idempotentReplay:
                  false,
              },
            };
          },
        };
      },
    });

  const result =
    await transport
      .transitionTripLifecycle(
        trip.tripId,
        {
          clientMutationId:
            'shadow-http-life-archive-0001',
          expectedRevision: 2,
          targetStatus:
            'archived',
        },
      );

  assert.equal(
    method,
    'PATCH',
  );
  assert.match(
    requestedUrl,
    /\/v1\/trips\/shadow-http-lifecycle\/lifecycle$/,
  );
  assert.deepEqual(
    JSON.parse(requestBody),
    {
      clientMutationId:
        'shadow-http-life-archive-0001',
      expectedRevision: 2,
      targetStatus:
        'archived',
    },
  );

  assert.equal(
    result.status,
    'applied',
  );

  if (result.status === 'applied') {
    assert.equal(
      result.trip.revision,
      3,
    );
    assert.equal(
      result.trip.lifecycle.status,
      'archived',
    );
  }
});

test('HTTP lifecycle transport preserves canonical conflict', async () => {
  const trip =
    envelope(
      workspace(
        'shadow-http-life-conflict',
      ),
      6,
    );

  const transport =
    createShadowSyncHttpTransport({
      baseUrl:
        'http://127.0.0.1:4010',
      async getAuthorizationHeader() {
        return 'Bearer test-token';
      },
      async fetchImpl() {
        return {
          status: 409,
          async json() {
            return {
              status: 'conflict',
              expectedRevision: 5,
              trip,
            };
          },
        };
      },
    });

  const result =
    await transport
      .transitionTripLifecycle(
        trip.tripId,
        {
          clientMutationId:
            'shadow-http-life-conflict-0001',
          expectedRevision: 5,
          targetStatus:
            'archived',
        },
      );

  assert.equal(
    result.status,
    'conflict',
  );

  if (result.status === 'conflict') {
    assert.equal(
      result.expectedRevision,
      5,
    );
    assert.equal(
      result.trip.revision,
      6,
    );
  }
});

test('HTTP lifecycle transport maps invalid transition without rewriting it as conflict', async () => {
  const trip = {
    ...envelope(
      workspace(
        'shadow-http-life-invalid',
      ),
      2,
    ),
    lifecycle: {
      status:
        'archived' as const,
      archivedAt:
        '2026-08-24T07:00:00.000Z',
      deletedAt: null,
    },
  };

  const transport =
    createShadowSyncHttpTransport({
      baseUrl:
        'http://127.0.0.1:4010',
      async getAuthorizationHeader() {
        return 'Bearer test-token';
      },
      async fetchImpl() {
        return {
          status: 409,
          async json() {
            return {
              status:
                'invalid_transition',
              trip,
            };
          },
        };
      },
    });

  const result =
    await transport
      .transitionTripLifecycle(
        trip.tripId,
        {
          clientMutationId:
            'shadow-http-life-invalid-0001',
          expectedRevision: 2,
          targetStatus:
            'archived',
        },
      );

  assert.equal(
    result.status,
    'invalid-transition',
  );

  if (
    result.status ===
      'invalid-transition'
  ) {
    assert.equal(
      result.trip.lifecycle.status,
      'archived',
    );
  }
});

test('HTTP transport fails closed on malformed server payload', async () => {
  const transport =
    createShadowSyncHttpTransport({
      baseUrl:
        'http://127.0.0.1:4010',
      async getAuthorizationHeader() {
        return null;
      },
      async fetchImpl() {
        return {
          status: 200,
          async json() {
            return {
              data: {
                revision:
                  'not-a-number',
              },
            };
          },
        };
      },
    });

  const result =
    await transport.getTrip(
      'shadow-bad-response',
    );

  assert.equal(
    result.status,
    'invalid-response',
  );
});

test('parity remains deterministic across 10,000 comparisons', () => {
  const left = workspace();

  for (
    let index = 0;
    index < 10_000;
    index += 1
  ) {
    const right =
      workspace(
        left.id,
        index % 2 === 0
          ? 5000
          : 5001,
        left.updatedAt,
      );

    assert.equal(
      areTripWorkspacesEqual(
        left,
        right,
      ),
      index % 2 === 0,
    );
  }
});
