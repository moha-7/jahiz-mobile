import assert from 'node:assert/strict';
import test from 'node:test';

import {
  serverTripEnvelopeSchema,
  tripWorkspaceSchema,
  type ServerTripEnvelope,
  type TripWorkspace,
} from '../packages/api-contracts/src/index.ts';

import {
  acceptJahizServerConflictVersion,
  beginJahizCreateAttempt,
  beginJahizLifecycleAttempt,
  beginJahizWorkspaceAttempt,
  createEmptyJahizTripSyncState,
  jahizTripSyncStateSchema,
  nextJahizTripSyncOperation,
  queueJahizCreate,
  queueJahizLifecycleMutation,
  queueJahizWorkspaceMutation,
  recordJahizTripSyncConflict,
  resolveJahizCreateApplied,
  resolveJahizLifecycleApplied,
  resolveJahizWorkspaceApplied,
} from '../apps/mobile/src/features/sync/jahiz-trip-sync-state.ts';

import {
  createJahizTripSyncStateStore,
} from '../apps/mobile/src/features/sync/jahiz-trip-sync-state-store.ts';

function workspace(
  id = 'sync-state-trip',
  availableNow = 5000,
  updatedAt =
    '2026-09-02T04:45:00.000Z',
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
      '2026-09-02T04:40:00.000Z',
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
      'sync-state-owner',
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
                '2026-09-02T04:50:00.000Z',
              deletedAt: null,
            }
          : {
              status:
                'deleted',
              archivedAt: null,
              deletedAt:
                '2026-09-02T04:55:00.000Z',
            },
    workspace:
      tripWorkspace,
    serverUpdatedAt:
      '2026-09-02T04:56:00.000Z',
  });
}

test(
  'queued create coalesces before first send but sent create snapshot is immutable',
  () => {
    const initial =
      createEmptyJahizTripSyncState(
        'sync-create',
      );

    const first =
      queueJahizCreate(
        initial,
        {
          clientMutationId:
            'sync-create-mutation-0001',
          snapshot:
            workspace(
              'sync-create',
              5000,
            ),
        },
      );

    const coalesced =
      queueJahizCreate(
        first,
        {
          clientMutationId:
            'sync-create-mutation-0002',
          snapshot:
            workspace(
              'sync-create',
              6000,
            ),
        },
      );

    assert.equal(
      coalesced.createPending
        ?.clientMutationId,
      'sync-create-mutation-0001',
    );
    assert.equal(
      coalesced.createPending
        ?.snapshot.funds
        .availableNow,
      6000,
    );

    const sent =
      beginJahizCreateAttempt(
        coalesced,
      );

    const attemptedOverwrite =
      queueJahizCreate(
        sent,
        {
          clientMutationId:
            'sync-create-mutation-0003',
          snapshot:
            workspace(
              'sync-create',
              7000,
            ),
        },
      );

    assert.equal(
      attemptedOverwrite
        .createPending
        ?.snapshot.funds
        .availableNow,
      6000,
    );
    assert.equal(
      attemptedOverwrite
        .createPending?.state,
      'sent',
    );
  },
);

test(
  'create applies before any later mutation and establishes canonical revision',
  () => {
    const local =
      workspace(
        'sync-create-order',
      );

    let state =
      queueJahizCreate(
        createEmptyJahizTripSyncState(
          local.id,
        ),
        {
          clientMutationId:
            'sync-create-order-0001',
          snapshot: local,
        },
      );

    state =
      queueJahizWorkspaceMutation(
        state,
        {
          clientMutationId:
            'sync-workspace-order-0001',
          snapshot:
            workspace(
              local.id,
              6500,
            ),
        },
      );

    assert.equal(
      nextJahizTripSyncOperation(
        state,
      ),
      'create',
    );

    state =
      resolveJahizCreateApplied(
        state,
        envelope(
          local,
          0,
        ),
      );

    assert.equal(
      state.serverRevision,
      0,
    );
    assert.equal(
      nextJahizTripSyncOperation(
        state,
      ),
      'workspace',
    );
  },
);

test(
  'workspace and lifecycle use independent mutation identities',
  () => {
    let state = {
      ...createEmptyJahizTripSyncState(
        'sync-independent',
      ),
      serverRevision: 3,
      serverLifecycleStatus:
        'active' as const,
    };

    state =
      queueJahizWorkspaceMutation(
        state,
        {
          clientMutationId:
            'sync-workspace-independent-0001',
          snapshot:
            workspace(
              'sync-independent',
            ),
        },
      );

    state =
      queueJahizLifecycleMutation(
        state,
        {
          clientMutationId:
            'sync-life-independent-0001',
          targetStatus:
            'archived',
          now:
            '2026-09-02T05:00:00.000Z',
        },
      );

    assert.notEqual(
      state.workspaceMutation
        ?.clientMutationId,
      state.lifecycleMutation
        ?.clientMutationId,
    );

    assert.equal(
      nextJahizTripSyncOperation(
        state,
      ),
      'workspace',
    );
  },
);

test(
  'archiving waits for pending workspace write while restore runs before workspace write',
  () => {
    let active = {
      ...createEmptyJahizTripSyncState(
        'sync-archive-order',
      ),
      serverRevision: 2,
      serverLifecycleStatus:
        'active' as const,
    };

    active =
      queueJahizWorkspaceMutation(
        active,
        {
          clientMutationId:
            'sync-archive-workspace-0001',
          snapshot:
            workspace(
              'sync-archive-order',
            ),
        },
      );

    active =
      queueJahizLifecycleMutation(
        active,
        {
          clientMutationId:
            'sync-archive-life-0001',
          targetStatus:
            'archived',
          now:
            '2026-09-02T05:00:00.000Z',
        },
      );

    assert.equal(
      nextJahizTripSyncOperation(
        active,
      ),
      'workspace',
    );

    let archived = {
      ...createEmptyJahizTripSyncState(
        'sync-restore-order',
      ),
      serverRevision: 4,
      serverLifecycleStatus:
        'archived' as const,
    };

    archived =
      queueJahizWorkspaceMutation(
        archived,
        {
          clientMutationId:
            'sync-restore-workspace-0001',
          snapshot:
            workspace(
              'sync-restore-order',
            ),
        },
      );

    archived =
      queueJahizLifecycleMutation(
        archived,
        {
          clientMutationId:
            'sync-restore-life-0001',
          targetStatus:
            'active',
          now:
            '2026-09-02T05:00:00.000Z',
        },
      );

    assert.equal(
      nextJahizTripSyncOperation(
        archived,
      ),
      'lifecycle',
    );
  },
);

test(
  'delete intent dominates and permanently suppresses pending workspace writes',
  () => {
    let state = {
      ...createEmptyJahizTripSyncState(
        'sync-delete',
      ),
      serverRevision: 5,
      serverLifecycleStatus:
        'archived' as const,
    };

    state =
      queueJahizWorkspaceMutation(
        state,
        {
          clientMutationId:
            'sync-delete-workspace-0001',
          snapshot:
            workspace(
              'sync-delete',
            ),
        },
      );

    state =
      queueJahizLifecycleMutation(
        state,
        {
          clientMutationId:
            'sync-delete-life-0001',
          targetStatus:
            'deleted',
          now:
            '2026-09-02T05:05:00.000Z',
        },
      );

    assert.equal(
      state.workspaceMutation,
      null,
    );
    assert.equal(
      state.deletedTombstone
        ?.deletedAt,
      '2026-09-02T05:05:00.000Z',
    );
    assert.equal(
      nextJahizTripSyncOperation(
        state,
      ),
      'lifecycle',
    );

    const attemptedWrite =
      queueJahizWorkspaceMutation(
        state,
        {
          clientMutationId:
            'sync-delete-workspace-0002',
          snapshot:
            workspace(
              'sync-delete',
              9000,
            ),
        },
      );

    assert.equal(
      attemptedWrite
        .workspaceMutation,
      null,
    );
  },
);

test(
  'sent mutation freezes expected revision for lost acknowledgement replay',
  () => {
    let state = {
      ...createEmptyJahizTripSyncState(
        'sync-replay',
      ),
      serverRevision: 7,
      serverLifecycleStatus:
        'active' as const,
    };

    state =
      queueJahizWorkspaceMutation(
        state,
        {
          clientMutationId:
            'sync-replay-workspace-0001',
          snapshot:
            workspace(
              'sync-replay',
            ),
        },
      );

    state =
      beginJahizWorkspaceAttempt(
        state,
      );

    assert.equal(
      state.workspaceMutation
        ?.expectedRevision,
      7,
    );
    assert.equal(
      state.workspaceMutation
        ?.state,
      'sent',
    );

    const afterLocalEdit =
      queueJahizWorkspaceMutation(
        state,
        {
          clientMutationId:
            'sync-replay-workspace-0002',
          snapshot:
            workspace(
              'sync-replay',
              8800,
            ),
        },
      );

    assert.equal(
      afterLocalEdit
        .workspaceMutation
        ?.clientMutationId,
      'sync-replay-workspace-0001',
    );
    assert.equal(
      afterLocalEdit
        .workspaceMutation
        ?.expectedRevision,
      7,
    );
  },
);

test(
  'applied workspace advances revision and clears only workspace mutation',
  () => {
    let state = {
      ...createEmptyJahizTripSyncState(
        'sync-workspace-apply',
      ),
      serverRevision: 2,
      serverLifecycleStatus:
        'active' as const,
    };

    state =
      queueJahizWorkspaceMutation(
        state,
        {
          clientMutationId:
            'sync-workspace-apply-0001',
          snapshot:
            workspace(
              'sync-workspace-apply',
            ),
        },
      );

    state =
      queueJahizLifecycleMutation(
        state,
        {
          clientMutationId:
            'sync-workspace-life-0001',
          targetStatus:
            'archived',
          now:
            '2026-09-02T05:10:00.000Z',
        },
      );

    state =
      resolveJahizWorkspaceApplied(
        state,
        envelope(
          workspace(
            'sync-workspace-apply',
          ),
          3,
        ),
      );

    assert.equal(
      state.serverRevision,
      3,
    );
    assert.equal(
      state.workspaceMutation,
      null,
    );
    assert.equal(
      state.lifecycleMutation
        ?.targetStatus,
      'archived',
    );

    state =
      beginJahizLifecycleAttempt(
        state,
      );

    assert.equal(
      state.lifecycleMutation
        ?.expectedRevision,
      3,
    );
  },
);

test(
  'canonical deletion remains terminal after lifecycle apply',
  () => {
    let state = {
      ...createEmptyJahizTripSyncState(
        'sync-delete-apply',
      ),
      serverRevision: 1,
      serverLifecycleStatus:
        'archived' as const,
    };

    state =
      queueJahizLifecycleMutation(
        state,
        {
          clientMutationId:
            'sync-delete-apply-0001',
          targetStatus:
            'deleted',
          now:
            '2026-09-02T05:15:00.000Z',
        },
      );

    state =
      resolveJahizLifecycleApplied(
        state,
        envelope(
          workspace(
            'sync-delete-apply',
          ),
          2,
          'deleted',
        ),
      );

    assert.equal(
      state.serverLifecycleStatus,
      'deleted',
    );
    assert.ok(
      state.deletedTombstone,
    );
    assert.equal(
      nextJahizTripSyncOperation(
        state,
      ),
      null,
    );

    const restoreAttempt =
      queueJahizLifecycleMutation(
        state,
        {
          clientMutationId:
            'sync-delete-restore-0001',
          targetStatus:
            'active',
          now:
            '2026-09-02T05:20:00.000Z',
        },
      );

    assert.equal(
      restoreAttempt
        .serverLifecycleStatus,
      'deleted',
    );
    assert.equal(
      restoreAttempt
        .lifecycleMutation,
      null,
    );
  },
);

test(
  'conflict freezes executor and accepting server never retries the old full snapshot',
  () => {
    let state = {
      ...createEmptyJahizTripSyncState(
        'sync-conflict',
      ),
      serverRevision: 4,
      serverLifecycleStatus:
        'active' as const,
    };

    state =
      queueJahizWorkspaceMutation(
        state,
        {
          clientMutationId:
            'sync-conflict-workspace-0001',
          snapshot:
            workspace(
              'sync-conflict',
              7000,
            ),
        },
      );

    state =
      recordJahizTripSyncConflict(
        state,
        {
          kind:
            'workspace',
          remoteTrip:
            envelope(
              workspace(
                'sync-conflict',
                9000,
              ),
              5,
            ),
          detectedAt:
            '2026-09-02T05:25:00.000Z',
        },
      );

    assert.equal(
      nextJahizTripSyncOperation(
        state,
      ),
      null,
    );
    assert.equal(
      state.conflict
        ?.localDraft
        ?.funds.availableNow,
      7000,
    );

    state =
      acceptJahizServerConflictVersion(
        state,
      );

    assert.equal(
      state.serverRevision,
      5,
    );
    assert.equal(
      state.workspaceMutation,
      null,
    );
    assert.equal(
      state.conflict,
      null,
    );
  },
);

test(
  'schema rejects cross-trip snapshots and sent mutations without revision',
  () => {
    const crossTrip = {
      ...createEmptyJahizTripSyncState(
        'sync-schema-a',
      ),
      workspaceMutation: {
        clientMutationId:
          'sync-schema-workspace-0001',
        snapshot:
          workspace(
            'sync-schema-b',
          ),
        expectedRevision: 0,
        state: 'sent' as const,
      },
    };

    assert.equal(
      jahizTripSyncStateSchema
        .safeParse(
          crossTrip,
        )
        .success,
      false,
    );

    const missingRevision = {
      ...createEmptyJahizTripSyncState(
        'sync-schema-c',
      ),
      workspaceMutation: {
        clientMutationId:
          'sync-schema-workspace-0002',
        snapshot:
          workspace(
            'sync-schema-c',
          ),
        expectedRevision: null,
        state: 'sent' as const,
      },
    };

    assert.equal(
      jahizTripSyncStateSchema
        .safeParse(
          missingRevision,
        )
        .success,
      false,
    );
  },
);

test(
  'durable store serializes concurrent writes and ignores malformed entries',
  async () => {
    let raw:
      string | null = null;

    const store =
      createJahizTripSyncStateStore({
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

    const first = {
      ...createEmptyJahizTripSyncState(
        'sync-store-a',
      ),
      serverRevision: 1,
      serverLifecycleStatus:
        'active' as const,
    };

    const second = {
      ...createEmptyJahizTripSyncState(
        'sync-store-b',
      ),
      serverRevision: 2,
      serverLifecycleStatus:
        'archived' as const,
    };

    await Promise.all([
      store.saveTrip(first),
      store.saveTrip(second),
    ]);

    const all =
      await store.loadAll();

    assert.equal(
      all.length,
      2,
    );

    raw = JSON.stringify({
      version: 1,
      trips: {
        valid: {
          ...first,
          tripId: 'valid',
        },
        malformed: {
          tripId:
            'malformed',
        },
      },
    });

    const reloaded =
      await store.loadAll();

    assert.equal(
      reloaded.length,
      1,
    );
    assert.equal(
      reloaded[0]?.tripId,
      'valid',
    );
  },
);
