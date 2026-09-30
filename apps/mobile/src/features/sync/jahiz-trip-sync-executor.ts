import {
  tripWorkspaceSchema,
  type ServerTripEnvelope,
  type TripWorkspace,
} from '@jahiz/api-contracts';

import {
  areTripWorkspacesEqual,
  type ShadowSyncFullTransport,
} from './jahiz-shadow-sync';

import type {
  JahizTripSyncStateStore,
} from './jahiz-trip-sync-state-store';

import {
  adoptJahizRemoteBaseline,
  beginJahizCreateAttempt,
  beginJahizLifecycleAttempt,
  beginJahizWorkspaceAttempt,
  clearJahizSatisfiedQueuedLifecycleMutation,
  createEmptyJahizTripSyncState,
  nextJahizTripSyncOperation,
  queueJahizCreate,
  queueJahizLifecycleMutation,
  queueJahizWorkspaceMutation,
  recordJahizTripSyncConflict,
  refreshJahizConflictLocalIntent,
  resolveJahizCreateApplied,
  resolveJahizLifecycleApplied,
  resolveJahizWorkspaceApplied,
  type JahizTripSyncOperation,
  type JahizTripSyncState,
} from './jahiz-trip-sync-state';

export type JahizDesiredLifecycleStatus =
  | 'active'
  | 'archived'
  | 'deleted';

export type JahizTripSyncExecutorOutcome =
  | 'synced'
  | 'pending'
  | 'cancelled'
  | 'conflict'
  | 'remote-deleted'
  | 'not-found'
  | 'unauthorized'
  | 'unavailable'
  | 'invalid-response';

export type JahizTripSyncExecutorResult = {
  outcome:
    JahizTripSyncExecutorOutcome;
  state:
    JahizTripSyncState;
  operations:
    Exclude<
      JahizTripSyncOperation,
      null
    >[];
  remoteTrip:
    ServerTripEnvelope | null;
};

type CreateMutationId = (
  kind:
    | 'create'
    | 'workspace'
    | 'lifecycle',
  tripId: string,
) => string;

type JahizTripSyncExecutorInput = {
  transport:
    ShadowSyncFullTransport;
  stateStore:
    JahizTripSyncStateStore;
  createMutationId?:
    CreateMutationId;
  now?: () => string;
  maxOperations?: number;
  shouldContinue?:
    () =>
      | boolean
      | Promise<boolean>;
};

export type SyncTripInput = {
  workspace:
    TripWorkspace;
  desiredLifecycle:
    JahizDesiredLifecycleStatus;
};

function defaultMutationId(
  kind:
    | 'create'
    | 'workspace'
    | 'lifecycle',
  tripId: string,
): string {
  return [
    'jahiz',
    kind,
    tripId,
    Date.now()
      .toString(36),
    Math.random()
      .toString(36)
      .slice(2, 12),
  ].join(':');
}

function mapFailure(
  status:
    | 'not-found'
    | 'unauthorized'
    | 'unavailable'
    | 'invalid-response',
): JahizTripSyncExecutorOutcome {
  return status;
}

export function createJahizTripSyncExecutor(
  input:
    JahizTripSyncExecutorInput,
) {
  const createMutationId =
    input.createMutationId ??
    defaultMutationId;

  const now =
    input.now ??
    (() =>
      new Date().toISOString());

  const maxOperations =
    input.maxOperations ?? 4;

  if (
    !Number.isInteger(
      maxOperations,
    ) ||
    maxOperations < 1 ||
    maxOperations > 8
  ) {
    throw new Error(
      'Jahiz sync maxOperations must be between 1 and 8.',
    );
  }

  async function save(
    state: JahizTripSyncState,
  ) {
    await input.stateStore
      .saveTrip(state);
  }

  async function canContinue() {
    return (
      await input.shouldContinue?.()
    ) ?? true;
  }

  function ensureDesiredState(
    stateInput:
      JahizTripSyncState,
    syncInput:
      SyncTripInput,
  ): JahizTripSyncState {
    let state =
      stateInput;

    if (
      state.serverLifecycleStatus ===
        'deleted' ||
      state.deletedTombstone
    ) {
      return state;
    }

    if (
      state.serverRevision === null
    ) {
      if (
        state.createPending
          ?.state === 'queued'
      ) {
        state =
          queueJahizCreate(
            state,
            {
              clientMutationId:
                state.createPending
                  .clientMutationId,
              snapshot:
                syncInput.workspace,
            },
          );
      } else if (
        state.createPending
          ?.state === 'sent' &&
        state.createPending
          .snapshot.updatedAt !==
          syncInput.workspace.updatedAt
      ) {
        state =
          queueJahizWorkspaceMutation(
            state,
            {
              clientMutationId:
                createMutationId(
                  'workspace',
                  syncInput
                    .workspace.id,
                ),
              snapshot:
                syncInput.workspace,
            },
          );
      }
    } else if (
      state.lastSyncedLocalUpdatedAt !==
        syncInput.workspace.updatedAt
    ) {
      state =
        queueJahizWorkspaceMutation(
          state,
          {
            clientMutationId:
              createMutationId(
                'workspace',
                syncInput
                  .workspace.id,
              ),
            snapshot:
              syncInput.workspace,
          },
        );
    }

    state =
      clearJahizSatisfiedQueuedLifecycleMutation(
        state,
      );

    const shouldQueueLifecycle =
      state.serverRevision === null
        ? syncInput.desiredLifecycle !==
            'active'
        : state.serverLifecycleStatus !==
            syncInput.desiredLifecycle;

    if (shouldQueueLifecycle) {
      state =
        queueJahizLifecycleMutation(
          state,
          {
            clientMutationId:
              createMutationId(
                'lifecycle',
                syncInput
                  .workspace.id,
              ),
            targetStatus:
              syncInput
                .desiredLifecycle,
            now: now(),
          },
        );
    }

    return state;
  }

  async function bootstrap(
    stateInput:
      JahizTripSyncState,
    syncInput:
      SyncTripInput,
  ): Promise<
    | {
        status: 'ready';
        state:
          JahizTripSyncState;
      }
    | {
        status:
          JahizTripSyncExecutorOutcome;
        state:
          JahizTripSyncState;
        remoteTrip:
          ServerTripEnvelope | null;
      }
  > {
    let state =
      stateInput;

    if (
      state.serverRevision !== null ||
      state.createPending
    ) {
      return {
        status: 'ready',
        state,
      };
    }

    if (!(await canContinue())) {
      return {
        status:
          'cancelled',
        state,
        remoteTrip: null,
      };
    }

    const read =
      await input.transport
        .getTrip(
          syncInput.workspace.id,
        );

    if (read.status === 'found') {
      if (
        read.trip.lifecycle.status ===
          'deleted'
      ) {
        state =
          recordJahizTripSyncConflict(
            state,
            {
              kind:
                'lifecycle',
              remoteTrip:
                read.trip,
              localDraft:
                syncInput.workspace,
              lifecycleIntent:
                syncInput
                  .desiredLifecycle,
              detectedAt:
                now(),
            },
          );

        await save(state);

        return {
          status:
            'remote-deleted',
          state,
          remoteTrip:
            read.trip,
        };
      }

      if (
        !areTripWorkspacesEqual(
          syncInput.workspace,
          read.trip.workspace,
        )
      ) {
        state =
          recordJahizTripSyncConflict(
            state,
            {
              kind: 'create',
              remoteTrip:
                read.trip,
              localDraft:
                syncInput.workspace,
              lifecycleIntent:
                syncInput
                  .desiredLifecycle,
              detectedAt:
                now(),
            },
          );

        await save(state);

        return {
          status: 'conflict',
          state,
          remoteTrip:
            read.trip,
        };
      }

      state =
        adoptJahizRemoteBaseline(
          state,
          {
            trip: read.trip,
            localUpdatedAt:
              syncInput
                .workspace.updatedAt,
          },
        );

      await save(state);

      return {
        status: 'ready',
        state,
      };
    }

    if (read.status !== 'not-found') {
      return {
        status:
          mapFailure(
            read.status,
          ),
        state,
        remoteTrip: null,
      };
    }

    state =
      queueJahizCreate(
        state,
        {
          clientMutationId:
            createMutationId(
              'create',
              syncInput
                .workspace.id,
            ),
          snapshot:
            syncInput.workspace,
        },
      );

    state =
      ensureDesiredState(
        state,
        syncInput,
      );

    await save(state);

    return {
      status: 'ready',
      state,
    };
  }

  async function syncTrip(
    syncInputRaw:
      SyncTripInput,
  ): Promise<JahizTripSyncExecutorResult> {
    const syncInput = {
      ...syncInputRaw,
      workspace:
        tripWorkspaceSchema
          .parse(
            syncInputRaw
              .workspace,
          ),
    };

    let state =
      await input.stateStore
        .loadTrip(
          syncInput.workspace.id,
        ) ??
      createEmptyJahizTripSyncState(
        syncInput.workspace.id,
      );

    if (state.conflict) {
      state =
        refreshJahizConflictLocalIntent(
          state,
          {
            workspace:
              syncInput.workspace,
            lifecycleIntent:
              syncInput
                .desiredLifecycle,
          },
        );

      await save(state);

      return {
        outcome: 'conflict',
        state,
        operations: [],
        remoteTrip:
          state.conflict
            ?.remoteTrip ??
          null,
      };
    }

    const bootstrapped =
      await bootstrap(
        state,
        syncInput,
      );

    if (
      bootstrapped.status !==
        'ready'
    ) {
      return {
        outcome:
          bootstrapped.status,
        state:
          bootstrapped.state,
        operations: [],
        remoteTrip:
          bootstrapped
            .remoteTrip,
      };
    }

    state =
      ensureDesiredState(
        bootstrapped.state,
        syncInput,
      );

    await save(state);

    const operations:
      Exclude<
        JahizTripSyncOperation,
        null
      >[] = [];

    let lastRemoteTrip:
      ServerTripEnvelope | null =
        null;

    for (
      let index = 0;
      index < maxOperations;
      index += 1
    ) {
      if (!(await canContinue())) {
        return {
          outcome:
            'cancelled',
          state,
          operations,
          remoteTrip:
            lastRemoteTrip,
        };
      }

      if (
        state.serverLifecycleStatus ===
          'deleted'
      ) {
        return {
          outcome:
            'remote-deleted',
          state,
          operations,
          remoteTrip:
            lastRemoteTrip,
        };
      }

      const operation =
        nextJahizTripSyncOperation(
          state,
        );

      if (!operation) {
        return {
          outcome:
            state.conflict
              ? 'conflict'
              : 'synced',
          state,
          operations,
          remoteTrip:
            state.conflict
              ?.remoteTrip ??
            lastRemoteTrip,
        };
      }

      operations.push(
        operation,
      );

      if (operation === 'create') {
        state =
          beginJahizCreateAttempt(
            state,
          );

        await save(state);

        const pending =
          state.createPending;

        if (!pending) {
          throw new Error(
            'Create operation selected without pending create state.',
          );
        }

        const result =
          await input.transport
            .createTrip({
              clientMutationId:
                pending
                  .clientMutationId,
              workspace:
                pending.snapshot,
            });

        if (!(await canContinue())) {
          return {
            outcome:
              'cancelled',
            state,
            operations,
            remoteTrip: null,
          };
        }

        if (
          result.status ===
            'applied'
        ) {
          lastRemoteTrip =
            result.trip;

          state =
            resolveJahizCreateApplied(
              state,
              result.trip,
            );

          state =
            ensureDesiredState(
              state,
              syncInput,
            );

          await save(state);
          continue;
        }

        if (
          result.status ===
            'conflict'
        ) {
          if (!result.trip) {
            return {
              outcome:
                'invalid-response',
              state,
              operations,
              remoteTrip: null,
            };
          }

          state =
            recordJahizTripSyncConflict(
              state,
              {
                kind: 'create',
                remoteTrip:
                  result.trip,
                detectedAt:
                  now(),
              },
            );

          await save(state);

          return {
            outcome: 'conflict',
            state,
            operations,
            remoteTrip:
              result.trip,
          };
        }

        return {
          outcome:
            mapFailure(
              result.status,
            ),
          state,
          operations,
          remoteTrip: null,
        };
      }

      if (
        operation === 'workspace'
      ) {
        state =
          beginJahizWorkspaceAttempt(
            state,
          );

        await save(state);

        const pending =
          state.workspaceMutation;

        if (
          !pending ||
          pending.expectedRevision ===
            null
        ) {
          throw new Error(
            'Workspace operation selected without an executable pending mutation.',
          );
        }

        const result =
          await input.transport
            .updateTrip(
              state.tripId,
              {
                clientMutationId:
                  pending
                    .clientMutationId,
                expectedRevision:
                  pending
                    .expectedRevision,
                workspace:
                  pending.snapshot,
              },
            );

        if (!(await canContinue())) {
          return {
            outcome:
              'cancelled',
            state,
            operations,
            remoteTrip: null,
          };
        }

        if (
          result.status ===
            'applied'
        ) {
          lastRemoteTrip =
            result.trip;

          state =
            resolveJahizWorkspaceApplied(
              state,
              result.trip,
            );

          state =
            ensureDesiredState(
              state,
              syncInput,
            );

          await save(state);
          continue;
        }

        if (
          result.status ===
            'conflict'
        ) {
          if (!result.trip) {
            return {
              outcome:
                'invalid-response',
              state,
              operations,
              remoteTrip: null,
            };
          }

          state =
            recordJahizTripSyncConflict(
              state,
              {
                kind:
                  'workspace',
                remoteTrip:
                  result.trip,
                detectedAt:
                  now(),
              },
            );

          await save(state);

          return {
            outcome: 'conflict',
            state,
            operations,
            remoteTrip:
              result.trip,
          };
        }

        return {
          outcome:
            mapFailure(
              result.status,
            ),
          state,
          operations,
          remoteTrip: null,
        };
      }

      state =
        beginJahizLifecycleAttempt(
          state,
        );

      await save(state);

      const pending =
        state.lifecycleMutation;

      if (
        !pending ||
        pending.expectedRevision ===
          null
      ) {
        throw new Error(
          'Lifecycle operation selected without an executable pending mutation.',
        );
      }

      const result =
        await input.transport
          .transitionTripLifecycle(
            state.tripId,
            {
              clientMutationId:
                pending
                  .clientMutationId,
              expectedRevision:
                pending
                  .expectedRevision,
              targetStatus:
                pending
                  .targetStatus,
            },
          );

      if (!(await canContinue())) {
        return {
          outcome:
            'cancelled',
          state,
          operations,
          remoteTrip: null,
        };
      }

      if (
        result.status ===
          'applied'
      ) {
        lastRemoteTrip =
          result.trip;

        state =
          resolveJahizLifecycleApplied(
            state,
            result.trip,
          );

        state =
          ensureDesiredState(
            state,
            syncInput,
          );

        await save(state);
        continue;
      }

      if (
        result.status ===
          'invalid-transition'
      ) {
        lastRemoteTrip =
          result.trip;

        if (
          result.trip
            .lifecycle.status ===
          pending.targetStatus
        ) {
          state =
            resolveJahizLifecycleApplied(
              state,
              result.trip,
            );

          state =
            ensureDesiredState(
              state,
              syncInput,
            );

          await save(state);
          continue;
        }

        state =
          recordJahizTripSyncConflict(
            state,
            {
              kind:
                'lifecycle',
              remoteTrip:
                result.trip,
              detectedAt:
                now(),
            },
          );

        await save(state);

        return {
          outcome: 'conflict',
          state,
          operations,
          remoteTrip:
            result.trip,
        };
      }

      if (
        result.status ===
          'conflict'
      ) {
        state =
          recordJahizTripSyncConflict(
            state,
            {
              kind:
                'lifecycle',
              remoteTrip:
                result.trip,
              detectedAt:
                now(),
            },
          );

        await save(state);

        return {
          outcome: 'conflict',
          state,
          operations,
          remoteTrip:
            result.trip,
        };
      }

      return {
        outcome:
          mapFailure(
            result.status,
          ),
        state,
        operations,
        remoteTrip: null,
      };
    }

    const remainingOperation =
      nextJahizTripSyncOperation(
        state,
      );

    return {
      outcome:
        state.conflict
          ? 'conflict'
          : remainingOperation
            ? 'pending'
            : 'synced',
      state,
      operations,
      remoteTrip:
        state.conflict
          ?.remoteTrip ??
        lastRemoteTrip,
    };
  }

  return {
    syncTrip,
  };
}
