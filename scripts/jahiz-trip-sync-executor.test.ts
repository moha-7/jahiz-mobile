import assert from 'node:assert/strict';
import test from 'node:test';

import {
  serverTripEnvelopeSchema,
  tripWorkspaceSchema,
  type ServerTripEnvelope,
  type TripWorkspace,
} from '../packages/api-contracts/src/index.ts';

import {
  createJahizTripSyncExecutor,
} from '../apps/mobile/src/features/sync/jahiz-trip-sync-executor.ts';

import {
  adoptJahizRemoteBaseline,
  createEmptyJahizTripSyncState,
} from '../apps/mobile/src/features/sync/jahiz-trip-sync-state.ts';

import {
  createJahizTripSyncStateStore,
} from '../apps/mobile/src/features/sync/jahiz-trip-sync-state-store.ts';

import type {
  ShadowSyncFullTransport,
} from '../apps/mobile/src/features/sync/jahiz-shadow-sync.ts';

function workspace(
  id = 'executor-trip',
  availableNow = 5000,
  updatedAt =
    '2026-09-02T06:00:00.000Z',
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
      '2026-09-02T05:50:00.000Z',
    updatedAt,
  });
}

function envelope(
  tripWorkspace: TripWorkspace,
  revision: number,
  lifecycle:
    'active'
    | 'archived'
    | 'deleted' =
      'active',
): ServerTripEnvelope {
  return serverTripEnvelopeSchema.parse({
    tripId:
      tripWorkspace.id,
    ownerId:
      'executor-owner',
    revision,
    lifecycle:
      lifecycle === 'active'
        ? {
            status: 'active',
            archivedAt: null,
            deletedAt: null,
          }
        : lifecycle ===
            'archived'
          ? {
              status:
                'archived',
              archivedAt:
                '2026-09-02T06:05:00.000Z',
              deletedAt: null,
            }
          : {
              status:
                'deleted',
              archivedAt: null,
              deletedAt:
                '2026-09-02T06:10:00.000Z',
            },
    workspace:
      tripWorkspace,
    serverUpdatedAt:
      '2026-09-02T06:11:00.000Z',
  });
}

function memoryStore() {
  let raw:
    string | null = null;

  return createJahizTripSyncStateStore({
    async getItemAsync() {
      return raw;
    },
    async setItemAsync(
      _key,
      value,
    ) {
      raw = value;
    },
  });
}

function mutationIds() {
  let counter = 0;

  return (
    kind:
      'create'
      | 'workspace'
      | 'lifecycle',
    tripId: string,
  ) => {
    counter += 1;

    return [
      'executor',
      kind,
      tripId,
      String(counter)
        .padStart(4, '0'),
    ].join(':');
  };
}

test(
  'bootstrap creates only after canonical read confirms trip is absent',
  async () => {
    const local =
      workspace(
        'executor-create',
      );
    const store =
      memoryStore();

    const calls:
      string[] = [];

    const transport:
      ShadowSyncFullTransport = {
        async getTrip() {
          calls.push('read');
          return {
            status:
              'not-found',
          };
        },
        async createTrip(request) {
          calls.push('create');
          return {
            status: 'applied',
            trip:
              envelope(
                request.workspace,
                0,
              ),
            idempotentReplay:
              false,
          };
        },
        async updateTrip() {
          throw new Error(
            'update should not run',
          );
        },
        async transitionTripLifecycle() {
          throw new Error(
            'lifecycle should not run',
          );
        },
      };

    const executor =
      createJahizTripSyncExecutor({
        transport,
        stateStore: store,
        createMutationId:
          mutationIds(),
        now: () =>
          '2026-09-02T06:12:00.000Z',
      });

    const result =
      await executor.syncTrip({
        workspace: local,
        desiredLifecycle:
          'active',
      });

    assert.equal(
      result.outcome,
      'synced',
    );
    assert.deepEqual(
      calls,
      [
        'read',
        'create',
      ],
    );
    assert.equal(
      result.state.serverRevision,
      0,
    );
    assert.equal(
      result.state
        .lastSyncedLocalUpdatedAt,
      local.updatedAt,
    );
  },
);

test(
  'lost create acknowledgement replays the exact persisted mutation after restart',
  async () => {
    const local =
      workspace(
        'executor-lost-ack',
      );
    const store =
      memoryStore();

    let firstRequest:
      {
        clientMutationId:
          string;
        workspace:
          TripWorkspace;
      }
      | null = null;

    const firstTransport:
      ShadowSyncFullTransport = {
        async getTrip() {
          return {
            status:
              'not-found',
          };
        },
        async createTrip(request) {
          firstRequest =
            request;

          return {
            status:
              'unavailable',
          };
        },
        async updateTrip() {
          throw new Error(
            'update should not run',
          );
        },
        async transitionTripLifecycle() {
          throw new Error(
            'lifecycle should not run',
          );
        },
      };

    const first =
      createJahizTripSyncExecutor({
        transport:
          firstTransport,
        stateStore: store,
        createMutationId:
          mutationIds(),
        now: () =>
          '2026-09-02T06:13:00.000Z',
      });

    const firstResult =
      await first.syncTrip({
        workspace: local,
        desiredLifecycle:
          'active',
      });

    assert.equal(
      firstResult.outcome,
      'unavailable',
    );
    assert.equal(
      firstResult.state
        .createPending?.state,
      'sent',
    );

    let replayRequest:
      typeof firstRequest =
        null;

    const replayTransport:
      ShadowSyncFullTransport = {
        async getTrip() {
          throw new Error(
            'bootstrap read must not run for persisted sent create',
          );
        },
        async createTrip(request) {
          replayRequest =
            request;

          return {
            status: 'applied',
            trip:
              envelope(
                request.workspace,
                0,
              ),
            idempotentReplay:
              true,
          };
        },
        async updateTrip() {
          throw new Error(
            'update should not run',
          );
        },
        async transitionTripLifecycle() {
          throw new Error(
            'lifecycle should not run',
          );
        },
      };

    const replay =
      createJahizTripSyncExecutor({
        transport:
          replayTransport,
        stateStore: store,
        createMutationId:
          mutationIds(),
        now: () =>
          '2026-09-02T06:14:00.000Z',
      });

    const replayResult =
      await replay.syncTrip({
        workspace: local,
        desiredLifecycle:
          'active',
      });

    assert.equal(
      replayResult.outcome,
      'synced',
    );
    assert.ok(firstRequest);
    assert.ok(replayRequest);
    assert.equal(
      replayRequest
        ?.clientMutationId,
      firstRequest
        ?.clientMutationId,
    );
    assert.deepEqual(
      replayRequest
        ?.workspace,
      firstRequest
        ?.workspace,
    );
  },
);

test(
  'matching remote bootstrap adopts revision without writing',
  async () => {
    const local =
      workspace(
        'executor-bootstrap-match',
      );
    const store =
      memoryStore();

    let writes = 0;

    const transport:
      ShadowSyncFullTransport = {
        async getTrip() {
          return {
            status: 'found',
            trip:
              envelope(
                local,
                5,
              ),
          };
        },
        async createTrip() {
          writes += 1;
          return {
            status:
              'unavailable',
          };
        },
        async updateTrip() {
          writes += 1;
          return {
            status:
              'unavailable',
          };
        },
        async transitionTripLifecycle() {
          writes += 1;
          return {
            status:
              'unavailable',
          };
        },
      };

    const executor =
      createJahizTripSyncExecutor({
        transport,
        stateStore: store,
        createMutationId:
          mutationIds(),
      });

    const result =
      await executor.syncTrip({
        workspace: local,
        desiredLifecycle:
          'active',
      });

    assert.equal(
      result.outcome,
      'synced',
    );
    assert.equal(writes, 0);
    assert.equal(
      result.state.serverRevision,
      5,
    );
  },
);

test(
  'divergent remote bootstrap freezes as conflict and does not overwrite either side',
  async () => {
    const local =
      workspace(
        'executor-bootstrap-conflict',
        5000,
      );
    const remote =
      workspace(
        'executor-bootstrap-conflict',
        2500,
      );

    const store =
      memoryStore();

    let writes = 0;

    const transport:
      ShadowSyncFullTransport = {
        async getTrip() {
          return {
            status: 'found',
            trip:
              envelope(
                remote,
                3,
              ),
          };
        },
        async createTrip() {
          writes += 1;
          return {
            status:
              'unavailable',
          };
        },
        async updateTrip() {
          writes += 1;
          return {
            status:
              'unavailable',
          };
        },
        async transitionTripLifecycle() {
          writes += 1;
          return {
            status:
              'unavailable',
          };
        },
      };

    const executor =
      createJahizTripSyncExecutor({
        transport,
        stateStore: store,
        createMutationId:
          mutationIds(),
        now: () =>
          '2026-09-02T06:15:00.000Z',
      });

    const result =
      await executor.syncTrip({
        workspace: local,
        desiredLifecycle:
          'active',
      });

    assert.equal(
      result.outcome,
      'conflict',
    );
    assert.equal(writes, 0);
    assert.equal(
      result.state.conflict
        ?.localDraft
        ?.funds.availableNow,
      5000,
    );
    assert.equal(
      result.remoteTrip
        ?.workspace.funds
        .availableNow,
      2500,
    );
  },
);

test(
  'active trip writes workspace before archive and advances lifecycle revision',
  async () => {
    const original =
      workspace(
        'executor-archive-order',
        5000,
        '2026-09-02T06:00:00.000Z',
      );
    const changed =
      workspace(
        'executor-archive-order',
        7000,
        '2026-09-02T06:20:00.000Z',
      );

    const store =
      memoryStore();

    await store.saveTrip(
      adoptJahizRemoteBaseline(
        createEmptyJahizTripSyncState(
          original.id,
        ),
        {
          trip:
            envelope(
              original,
              1,
            ),
          localUpdatedAt:
            original.updatedAt,
        },
      ),
    );

    const calls:
      string[] = [];

    const transport:
      ShadowSyncFullTransport = {
        async getTrip() {
          throw new Error(
            'bootstrap read should not run',
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
          calls.push(
            `update:${request.expectedRevision}`,
          );

          return {
            status: 'applied',
            trip:
              envelope(
                request.workspace,
                2,
              ),
            idempotentReplay:
              false,
          };
        },
        async transitionTripLifecycle(
          _tripId,
          request,
        ) {
          calls.push(
            `lifecycle:${request.expectedRevision}:${request.targetStatus}`,
          );

          return {
            status: 'applied',
            trip:
              envelope(
                changed,
                3,
                'archived',
              ),
            idempotentReplay:
              false,
          };
        },
      };

    const executor =
      createJahizTripSyncExecutor({
        transport,
        stateStore: store,
        createMutationId:
          mutationIds(),
        now: () =>
          '2026-09-02T06:21:00.000Z',
      });

    const result =
      await executor.syncTrip({
        workspace: changed,
        desiredLifecycle:
          'archived',
      });

    assert.equal(
      result.outcome,
      'synced',
    );
    assert.deepEqual(
      calls,
      [
        'update:1',
        'lifecycle:2:archived',
      ],
    );
    assert.equal(
      result.state.serverRevision,
      3,
    );
    assert.equal(
      result.state
        .serverLifecycleStatus,
      'archived',
    );
  },
);

test(
  'archived trip restores before sending a workspace update',
  async () => {
    const original =
      workspace(
        'executor-restore-order',
        5000,
        '2026-09-02T06:00:00.000Z',
      );
    const changed =
      workspace(
        'executor-restore-order',
        7600,
        '2026-09-02T06:25:00.000Z',
      );

    const store =
      memoryStore();

    await store.saveTrip(
      adoptJahizRemoteBaseline(
        createEmptyJahizTripSyncState(
          original.id,
        ),
        {
          trip:
            envelope(
              original,
              3,
              'archived',
            ),
          localUpdatedAt:
            original.updatedAt,
        },
      ),
    );

    const calls:
      string[] = [];

    const transport:
      ShadowSyncFullTransport = {
        async getTrip() {
          throw new Error(
            'bootstrap read should not run',
          );
        },
        async createTrip() {
          throw new Error(
            'create should not run',
          );
        },
        async transitionTripLifecycle(
          _tripId,
          request,
        ) {
          calls.push(
            `lifecycle:${request.expectedRevision}:${request.targetStatus}`,
          );

          return {
            status: 'applied',
            trip:
              envelope(
                original,
                4,
                'active',
              ),
            idempotentReplay:
              false,
          };
        },
        async updateTrip(
          _tripId,
          request,
        ) {
          calls.push(
            `update:${request.expectedRevision}`,
          );

          return {
            status: 'applied',
            trip:
              envelope(
                request.workspace,
                5,
                'active',
              ),
            idempotentReplay:
              false,
          };
        },
      };

    const executor =
      createJahizTripSyncExecutor({
        transport,
        stateStore: store,
        createMutationId:
          mutationIds(),
      });

    const result =
      await executor.syncTrip({
        workspace: changed,
        desiredLifecycle:
          'active',
      });

    assert.equal(
      result.outcome,
      'synced',
    );
    assert.deepEqual(
      calls,
      [
        'lifecycle:3:active',
        'update:4',
      ],
    );
    assert.equal(
      result.state.serverRevision,
      5,
    );
  },
);

test(
  'workspace conflict preserves local draft and never auto-retries old snapshot',
  async () => {
    const original =
      workspace(
        'executor-write-conflict',
        5000,
        '2026-09-02T06:00:00.000Z',
      );
    const changed =
      workspace(
        'executor-write-conflict',
        7000,
        '2026-09-02T06:30:00.000Z',
      );
    const remote =
      workspace(
        'executor-write-conflict',
        9000,
        '2026-09-02T06:31:00.000Z',
      );

    const store =
      memoryStore();

    await store.saveTrip(
      adoptJahizRemoteBaseline(
        createEmptyJahizTripSyncState(
          original.id,
        ),
        {
          trip:
            envelope(
              original,
              1,
            ),
          localUpdatedAt:
            original.updatedAt,
        },
      ),
    );

    let updateCalls = 0;

    const transport:
      ShadowSyncFullTransport = {
        async getTrip() {
          throw new Error(
            'bootstrap read should not run',
          );
        },
        async createTrip() {
          throw new Error(
            'create should not run',
          );
        },
        async updateTrip() {
          updateCalls += 1;

          return {
            status: 'conflict',
            expectedRevision: 1,
            trip:
              envelope(
                remote,
                2,
              ),
          };
        },
        async transitionTripLifecycle() {
          throw new Error(
            'lifecycle should not run',
          );
        },
      };

    const executor =
      createJahizTripSyncExecutor({
        transport,
        stateStore: store,
        createMutationId:
          mutationIds(),
        now: () =>
          '2026-09-02T06:32:00.000Z',
      });

    const first =
      await executor.syncTrip({
        workspace: changed,
        desiredLifecycle:
          'active',
      });

    const second =
      await executor.syncTrip({
        workspace: changed,
        desiredLifecycle:
          'active',
      });

    assert.equal(
      first.outcome,
      'conflict',
    );
    assert.equal(
      second.outcome,
      'conflict',
    );
    assert.equal(
      updateCalls,
      1,
    );
    assert.equal(
      first.state.conflict
        ?.localDraft
        ?.funds.availableNow,
      7000,
    );
  },
);

test(
  'matching invalid lifecycle transition converges without inventing a write retry',
  async () => {
    const local =
      workspace(
        'executor-invalid-life',
      );

    const store =
      memoryStore();

    await store.saveTrip(
      adoptJahizRemoteBaseline(
        createEmptyJahizTripSyncState(
          local.id,
        ),
        {
          trip:
            envelope(
              local,
              1,
            ),
          localUpdatedAt:
            local.updatedAt,
        },
      ),
    );

    let lifecycleCalls = 0;

    const transport:
      ShadowSyncFullTransport = {
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
          throw new Error(
            'update should not run',
          );
        },
        async transitionTripLifecycle() {
          lifecycleCalls += 1;

          return {
            status:
              'invalid-transition',
            trip:
              envelope(
                local,
                2,
                'archived',
              ),
          };
        },
      };

    const executor =
      createJahizTripSyncExecutor({
        transport,
        stateStore: store,
        createMutationId:
          mutationIds(),
      });

    const result =
      await executor.syncTrip({
        workspace: local,
        desiredLifecycle:
          'archived',
      });

    assert.equal(
      result.outcome,
      'synced',
    );
    assert.equal(
      lifecycleCalls,
      1,
    );
    assert.equal(
      result.state
        .serverLifecycleStatus,
      'archived',
    );
    assert.equal(
      result.state.serverRevision,
      2,
    );
  },
);

test(
  'remote deleted bootstrap is terminal and never recreates the trip',
  async () => {
    const local =
      workspace(
        'executor-remote-deleted',
      );

    const store =
      memoryStore();

    let writes = 0;

    const transport:
      ShadowSyncFullTransport = {
        async getTrip() {
          return {
            status: 'found',
            trip:
              envelope(
                local,
                4,
                'deleted',
              ),
          };
        },
        async createTrip() {
          writes += 1;
          return {
            status:
              'unavailable',
          };
        },
        async updateTrip() {
          writes += 1;
          return {
            status:
              'unavailable',
          };
        },
        async transitionTripLifecycle() {
          writes += 1;
          return {
            status:
              'unavailable',
          };
        },
      };

    const executor =
      createJahizTripSyncExecutor({
        transport,
        stateStore: store,
        createMutationId:
          mutationIds(),
      });

    const result =
      await executor.syncTrip({
        workspace: local,
        desiredLifecycle:
          'active',
      });

    assert.equal(
      result.outcome,
      'remote-deleted',
    );
    assert.equal(writes, 0);
    assert.ok(
      result.state
        .deletedTombstone,
    );
  },
);


test(
  'auth namespace cancellation stops any follow-up operation after an in-flight response',
  async () => {
    const original =
      workspace(
        'executor-cancel',
        5000,
        '2026-09-02T07:00:00.000Z',
      );
    const changed =
      workspace(
        'executor-cancel',
        7000,
        '2026-09-02T07:05:00.000Z',
      );

    const store =
      memoryStore();

    await store.saveTrip(
      adoptJahizRemoteBaseline(
        createEmptyJahizTripSyncState(
          original.id,
        ),
        {
          trip:
            envelope(
              original,
              1,
            ),
          localUpdatedAt:
            original.updatedAt,
        },
      ),
    );

    let active = true;
    let updateCalls = 0;
    let lifecycleCalls = 0;

    const transport:
      ShadowSyncFullTransport = {
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
          updateCalls += 1;

          active = false;

          return {
            status: 'applied',
            trip:
              envelope(
                request.workspace,
                2,
              ),
            idempotentReplay:
              false,
          };
        },
        async transitionTripLifecycle() {
          lifecycleCalls += 1;

          return {
            status:
              'unavailable',
          };
        },
      };

    const executor =
      createJahizTripSyncExecutor({
        transport,
        stateStore: store,
        createMutationId:
          mutationIds(),
        shouldContinue() {
          return active;
        },
      });

    const result =
      await executor.syncTrip({
        workspace: changed,
        desiredLifecycle:
          'archived',
      });

    assert.equal(
      result.outcome,
      'cancelled',
    );
    assert.equal(
      updateCalls,
      1,
    );
    assert.equal(
      lifecycleCalls,
      0,
    );

    const persisted =
      await store.loadTrip(
        original.id,
      );

    assert.equal(
      persisted
        ?.workspaceMutation
        ?.state,
      'sent',
    );
    assert.equal(
      persisted
        ?.workspaceMutation
        ?.expectedRevision,
      1,
    );
  },
);
