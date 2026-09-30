import assert from 'node:assert/strict';
import test from 'node:test';

import {
  addTripToPortfolio,
  createTripPortfolioFromWorkspace,
  serverTripEnvelopeSchema,
  tripWorkspaceSchema,
  type ServerTripEnvelope,
  type TripWorkspace,
} from '../packages/api-contracts/src/index.ts';

import {
  acceptJahizServerConflictVersion,
  adoptJahizRemoteBaseline,
  beginJahizWorkspaceAttempt,
  nextJahizTripSyncOperation,
  preserveJahizConflictDraftForReview,
  queueJahizWorkspaceMutation,
  recordJahizTripSyncConflict,
  refreshJahizConflictLocalIntent,
} from '../apps/mobile/src/features/sync/jahiz-trip-sync-state.ts';

import {
  createJahizTripSyncStateStore,
} from '../apps/mobile/src/features/sync/jahiz-trip-sync-state-store.ts';

import {
  resolveJahizSyncConflict,
} from '../apps/mobile/src/features/sync/jahiz-sync-conflict-resolution.ts';

import {
  applyServerTripToPortfolio,
} from '../apps/mobile/src/features/trip-workspace/jahiz-trip-portfolio-server-adoption.ts';

function workspace(
  id: string,
  availableNow: number,
  updatedAt:
    string =
      '2026-09-02T08:00:00.000Z',
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
      '2026-09-02T07:50:00.000Z',
    updatedAt,
  });
}

function envelope(
  tripWorkspace:
    TripWorkspace,
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
      'review-owner',
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
                '2026-09-02T08:15:00.000Z',
              deletedAt: null,
            }
          : {
              status:
                'deleted',
              archivedAt: null,
              deletedAt:
                '2026-09-02T08:20:00.000Z',
            },
    workspace:
      tripWorkspace,
    serverUpdatedAt:
      '2026-09-02T08:21:00.000Z',
  });
}

function conflictState(
  tripId =
    'review-conflict',
) {
  const original =
    workspace(
      tripId,
      5000,
      '2026-09-02T08:00:00.000Z',
    );

  const local =
    workspace(
      tripId,
      7000,
      '2026-09-02T08:10:00.000Z',
    );

  const remote =
    workspace(
      tripId,
      9000,
      '2026-09-02T08:11:00.000Z',
    );

  let state =
    adoptJahizRemoteBaseline(
      {
        version: 1,
        tripId,
        serverRevision: null,
        serverLifecycleStatus:
          null,
        lastSyncedLocalUpdatedAt:
          null,
        lastServerUpdatedAt:
          null,
        createPending: null,
        workspaceMutation: null,
        lifecycleMutation: null,
        conflict: null,
        preservedReview: null,
        deletedTombstone: null,
      },
      {
        trip:
          envelope(
            original,
            1,
          ),
        localUpdatedAt:
          original.updatedAt,
      },
    );

  state =
    queueJahizWorkspaceMutation(
      state,
      {
        clientMutationId:
          'review-workspace-0001',
        snapshot: local,
      },
    );

  state =
    beginJahizWorkspaceAttempt(
      state,
    );

  state =
    recordJahizTripSyncConflict(
      state,
      {
        kind:
          'workspace',
        remoteTrip:
          envelope(
            remote,
            2,
          ),
        detectedAt:
          '2026-09-02T08:12:00.000Z',
      },
    );

  return {
    state,
    original,
    local,
    remote,
  };
}

test(
  'use-server conflict resolution discards pending full snapshot and adopts canonical markers',
  () => {
    const {
      state,
      remote,
    } = conflictState();

    const resolved =
      acceptJahizServerConflictVersion(
        state,
      );

    assert.equal(
      resolved.conflict,
      null,
    );
    assert.equal(
      resolved.preservedReview,
      null,
    );
    assert.equal(
      resolved.workspaceMutation,
      null,
    );
    assert.equal(
      resolved.serverRevision,
      2,
    );
    assert.equal(
      resolved
        .lastSyncedLocalUpdatedAt,
      remote.updatedAt,
    );
    assert.equal(
      nextJahizTripSyncOperation(
        resolved,
      ),
      null,
    );
  },
);

test(
  'preserve-local resolution moves draft to a separate review record and adopts server canon',
  () => {
    const {
      state,
      local,
      remote,
    } = conflictState(
      'review-preserve',
    );

    const resolved =
      preserveJahizConflictDraftForReview(
        state,
        '2026-09-02T08:30:00.000Z',
      );

    assert.equal(
      resolved.conflict,
      null,
    );
    assert.equal(
      resolved.workspaceMutation,
      null,
    );
    assert.equal(
      resolved.serverRevision,
      2,
    );
    assert.equal(
      resolved
        .lastSyncedLocalUpdatedAt,
      remote.updatedAt,
    );
    assert.equal(
      resolved
        .preservedReview
        ?.localDraft
        ?.funds.availableNow,
      local.funds.availableNow,
    );
    assert.equal(
      resolved
        .preservedReview
        ?.preservedAt,
      '2026-09-02T08:30:00.000Z',
    );
  },
);

test(
  'remote deletion immediately dominates conflict state while retaining local draft for review',
  () => {
    const {
      state,
      local,
    } = conflictState(
      'review-delete',
    );

    const deleted =
      recordJahizTripSyncConflict(
        state,
        {
          kind:
            'lifecycle',
          remoteTrip:
            envelope(
              workspace(
                'review-delete',
                5000,
              ),
              3,
              'deleted',
            ),
          localDraft:
            local,
          lifecycleIntent:
            'active',
          detectedAt:
            '2026-09-02T08:40:00.000Z',
        },
      );

    assert.equal(
      deleted
        .serverLifecycleStatus,
      'deleted',
    );
    assert.ok(
      deleted.deletedTombstone,
    );
    assert.equal(
      deleted.workspaceMutation,
      null,
    );
    assert.equal(
      deleted.lifecycleMutation,
      null,
    );
    assert.equal(
      deleted.conflict
        ?.localDraft
        ?.funds.availableNow,
      7000,
    );
    assert.equal(
      nextJahizTripSyncOperation(
        deleted,
      ),
      null,
    );
  },
);

test(
  'decide-later conflict keeps tracking the newest local draft without sending',
  () => {
    const {
      state,
    } = conflictState(
      'review-refresh',
    );

    const latest =
      workspace(
        'review-refresh',
        12345,
        '2026-09-02T08:50:00.000Z',
      );

    const refreshed =
      refreshJahizConflictLocalIntent(
        state,
        {
          workspace:
            latest,
          lifecycleIntent:
            'archived',
        },
      );

    assert.equal(
      refreshed.conflict
        ?.localDraft
        ?.funds.availableNow,
      12345,
    );
    assert.equal(
      refreshed.conflict
        ?.lifecycleIntent,
      'archived',
    );
    assert.equal(
      nextJahizTripSyncOperation(
        refreshed,
      ),
      null,
    );
  },
);

test(
  'conflict resolver persists explicit preserve strategy and never invents merge behavior',
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

    const {
      state,
    } = conflictState(
      'review-service',
    );

    await store.saveTrip(
      state,
    );

    const result =
      await resolveJahizSyncConflict({
        tripId:
          'review-service',
        strategy:
          'preserve-local',
        stateStore: store,
        now: () =>
          '2026-09-02T09:00:00.000Z',
      });

    assert.equal(
      result.status,
      'resolved',
    );

    if (
      result.status ===
        'resolved'
    ) {
      assert.equal(
        result.preservedLocalDraft,
        true,
      );
      assert.equal(
        result.state.conflict,
        null,
      );
      assert.ok(
        result.state
          .preservedReview,
      );
    }
  },
);

test(
  'canonical portfolio adoption preserves local name and moves active pointer when server archives',
  () => {
    const first =
      workspace(
        'portfolio-server-a',
        5000,
      );
    const second =
      workspace(
        'portfolio-server-b',
        6000,
      );

    let portfolio =
      createTripPortfolioFromWorkspace(
        first,
        'My local name',
      );

    portfolio =
      addTripToPortfolio(
        portfolio,
        second,
        null,
        false,
      );

    const remoteFirst =
      workspace(
        first.id,
        9000,
        '2026-09-02T09:05:00.000Z',
      );

    const result =
      applyServerTripToPortfolio(
        portfolio,
        envelope(
          remoteFirst,
          4,
          'archived',
        ),
      );

    assert.equal(
      result.status,
      'applied',
    );

    if (
      result.status ===
        'applied'
    ) {
      const adopted =
        result.portfolio
          .trips.find(
            (record) =>
              record.workspace.id ===
              first.id,
          );

      assert.equal(
        adopted?.name,
        'My local name',
      );
      assert.equal(
        adopted?.workspace
          .funds.availableNow,
        9000,
      );
      assert.ok(
        adopted?.archivedAt,
      );
      assert.equal(
        result.portfolio
          .activeTripId,
        second.id,
      );
    }
  },
);

test(
  'canonical server deletion removes the local trip and explicitly requests fallback when it was the last trip',
  () => {
    const only =
      workspace(
        'portfolio-server-delete',
        5000,
      );

    const portfolio =
      createTripPortfolioFromWorkspace(
        only,
      );

    const result =
      applyServerTripToPortfolio(
        portfolio,
        envelope(
          only,
          3,
          'deleted',
        ),
      );

    assert.deepEqual(
      result,
      {
        status:
          'empty-after-delete',
        currency: 'AED',
      },
    );
  },
);
