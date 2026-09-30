import { z } from 'zod';
import {
  clientMutationIdSchema,
  serverRevisionSchema,
  serverTripEnvelopeSchema,
  serverTripLifecycleStatusSchema,
  tripWorkspaceSchema,
  type ServerTripEnvelope,
  type TripWorkspace,
} from '@jahiz/api-contracts';

const pendingStateSchema =
  z.enum([
    'queued',
    'sent',
  ]);

export const jahizPendingCreateSchema =
  z.object({
    clientMutationId:
      clientMutationIdSchema,
    snapshot:
      tripWorkspaceSchema,
    state:
      pendingStateSchema,
  });

export const jahizPendingWorkspaceMutationSchema =
  z.object({
    clientMutationId:
      clientMutationIdSchema,
    snapshot:
      tripWorkspaceSchema,
    expectedRevision:
      serverRevisionSchema
        .nullable(),
    state:
      pendingStateSchema,
  })
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.state === 'sent' &&
          value.expectedRevision === null
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'expectedRevision',
            ],
            message:
              'Sent workspace mutations require an expected revision.',
          });
        }
      },
    );

export const jahizPendingLifecycleMutationSchema =
  z.object({
    clientMutationId:
      clientMutationIdSchema,
    targetStatus:
      serverTripLifecycleStatusSchema,
    expectedRevision:
      serverRevisionSchema
        .nullable(),
    state:
      pendingStateSchema,
  })
    .superRefine(
      (
        value,
        context,
      ) => {
        if (
          value.state === 'sent' &&
          value.expectedRevision === null
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'expectedRevision',
            ],
            message:
              'Sent lifecycle mutations require an expected revision.',
          });
        }
      },
    );

export const jahizTripSyncConflictSchema =
  z.object({
    kind:
      z.enum([
        'create',
        'workspace',
        'lifecycle',
      ]),
    detectedAt:
      z.string().datetime(),
    remoteTrip:
      serverTripEnvelopeSchema,
    localDraft:
      tripWorkspaceSchema
        .nullable(),
    lifecycleIntent:
      serverTripLifecycleStatusSchema
        .nullable(),
  });

export const jahizTripSyncPreservedReviewSchema =
  z.object({
    kind:
      z.enum([
        'create',
        'workspace',
        'lifecycle',
      ]),
    preservedAt:
      z.string().datetime(),
    remoteTrip:
      serverTripEnvelopeSchema,
    localDraft:
      tripWorkspaceSchema
        .nullable(),
    lifecycleIntent:
      serverTripLifecycleStatusSchema
        .nullable(),
  });

export const jahizDeletedTombstoneSchema =
  z.object({
    deletedAt:
      z.string().datetime(),
  });

export const jahizTripSyncStateSchema =
  z.object({
    version:
      z.literal(1),
    tripId:
      z.string().min(1),
    serverRevision:
      serverRevisionSchema
        .nullable(),
    serverLifecycleStatus:
      serverTripLifecycleStatusSchema
        .nullable(),
    lastSyncedLocalUpdatedAt:
      z.string()
        .datetime()
        .nullable()
        .default(null),
    lastServerUpdatedAt:
      z.string()
        .datetime()
        .nullable()
        .default(null),
    createPending:
      jahizPendingCreateSchema
        .nullable(),
    workspaceMutation:
      jahizPendingWorkspaceMutationSchema
        .nullable(),
    lifecycleMutation:
      jahizPendingLifecycleMutationSchema
        .nullable(),
    conflict:
      jahizTripSyncConflictSchema
        .nullable(),
    preservedReview:
      jahizTripSyncPreservedReviewSchema
        .nullable()
        .default(null),
    deletedTombstone:
      jahizDeletedTombstoneSchema
        .nullable(),
  })
    .superRefine(
      (
        value,
        context,
      ) => {
        const snapshots = [
          value.createPending
            ?.snapshot,
          value.workspaceMutation
            ?.snapshot,
          value.conflict
            ?.localDraft,
          value.preservedReview
            ?.localDraft,
        ].filter(
          (
            snapshot,
          ): snapshot is TripWorkspace =>
            Boolean(snapshot),
        );

        for (
          const snapshot
          of snapshots
        ) {
          if (
            snapshot.id !==
            value.tripId
          ) {
            context.addIssue({
              code: 'custom',
              path: ['tripId'],
              message:
                'Trip sync state cannot contain a workspace from another trip.',
            });
            break;
          }
        }

        if (
          value.deletedTombstone &&
          value.workspaceMutation
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'workspaceMutation',
            ],
            message:
              'Deleted trips cannot retain pending workspace writes.',
          });
        }

        if (
          value.serverLifecycleStatus ===
            'deleted' &&
          !value.deletedTombstone
        ) {
          context.addIssue({
            code: 'custom',
            path: [
              'deletedTombstone',
            ],
            message:
              'Canonical server deletion requires a local tombstone.',
          });
        }
      },
    );

export type JahizPendingCreate =
  z.infer<
    typeof jahizPendingCreateSchema
  >;

export type JahizPendingWorkspaceMutation =
  z.infer<
    typeof jahizPendingWorkspaceMutationSchema
  >;

export type JahizPendingLifecycleMutation =
  z.infer<
    typeof jahizPendingLifecycleMutationSchema
  >;

export type JahizTripSyncConflict =
  z.infer<
    typeof jahizTripSyncConflictSchema
  >;

export type JahizTripSyncPreservedReview =
  z.infer<
    typeof jahizTripSyncPreservedReviewSchema
  >;

export type JahizTripSyncState =
  z.infer<
    typeof jahizTripSyncStateSchema
  >;

export type JahizTripSyncOperation =
  | 'create'
  | 'workspace'
  | 'lifecycle'
  | null;

export function createEmptyJahizTripSyncState(
  tripId: string,
): JahizTripSyncState {
  return jahizTripSyncStateSchema.parse({
    version: 1,
    tripId,
    serverRevision: null,
    serverLifecycleStatus: null,
    lastSyncedLocalUpdatedAt: null,
    lastServerUpdatedAt: null,
    createPending: null,
    workspaceMutation: null,
    lifecycleMutation: null,
    conflict: null,
    preservedReview: null,
    deletedTombstone: null,
  });
}

export function queueJahizCreate(
  stateInput: JahizTripSyncState,
  input: {
    clientMutationId: string;
    snapshot: TripWorkspace;
  },
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );
  const snapshot =
    tripWorkspaceSchema.parse(
      input.snapshot,
    );

  if (
    state.serverRevision !== null
  ) {
    return state;
  }

  if (
    state.deletedTombstone &&
    !state.createPending
  ) {
    return state;
  }

  if (
    state.createPending?.state ===
      'sent'
  ) {
    return state;
  }

  return jahizTripSyncStateSchema.parse({
    ...state,
    createPending: {
      clientMutationId:
        state.createPending
          ?.clientMutationId ??
        input.clientMutationId,
      snapshot,
      state: 'queued',
    },
  });
}

export function beginJahizCreateAttempt(
  stateInput: JahizTripSyncState,
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );

  if (!state.createPending) {
    return state;
  }

  return jahizTripSyncStateSchema.parse({
    ...state,
    createPending: {
      ...state.createPending,
      state: 'sent',
    },
  });
}

export function queueJahizWorkspaceMutation(
  stateInput: JahizTripSyncState,
  input: {
    clientMutationId: string;
    snapshot: TripWorkspace;
  },
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );

  if (state.deletedTombstone) {
    return state;
  }

  const snapshot =
    tripWorkspaceSchema.parse(
      input.snapshot,
    );

  if (
    state.workspaceMutation
      ?.state === 'sent'
  ) {
    return state;
  }

  return jahizTripSyncStateSchema.parse({
    ...state,
    workspaceMutation: {
      clientMutationId:
        state.workspaceMutation
          ?.clientMutationId ??
        input.clientMutationId,
      snapshot,
      expectedRevision: null,
      state: 'queued',
    },
  });
}

export function beginJahizWorkspaceAttempt(
  stateInput: JahizTripSyncState,
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );

  if (
    !state.workspaceMutation ||
    state.serverRevision === null ||
    state.createPending ||
    state.deletedTombstone ||
    state.workspaceMutation.state ===
      'sent'
  ) {
    return state;
  }

  return jahizTripSyncStateSchema.parse({
    ...state,
    workspaceMutation: {
      ...state.workspaceMutation,
      expectedRevision:
        state.serverRevision,
      state: 'sent',
    },
  });
}

export function queueJahizLifecycleMutation(
  stateInput: JahizTripSyncState,
  input: {
    clientMutationId: string;
    targetStatus:
      'active'
      | 'archived'
      | 'deleted';
    now: string;
  },
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );

  if (
    state.serverLifecycleStatus ===
      'deleted'
  ) {
    return state;
  }

  if (
    state.lifecycleMutation
      ?.state === 'sent'
  ) {
    return state;
  }

  const deleting =
    input.targetStatus ===
      'deleted';

  return jahizTripSyncStateSchema.parse({
    ...state,
    workspaceMutation:
      deleting
        ? null
        : state.workspaceMutation,
    lifecycleMutation: {
      clientMutationId:
        state.lifecycleMutation
          ?.clientMutationId ??
        input.clientMutationId,
      targetStatus:
        input.targetStatus,
      expectedRevision: null,
      state: 'queued',
    },
    deletedTombstone:
      deleting
        ? {
            deletedAt:
              input.now,
          }
        : state.deletedTombstone,
  });
}

export function beginJahizLifecycleAttempt(
  stateInput: JahizTripSyncState,
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );

  if (
    !state.lifecycleMutation ||
    state.serverRevision === null ||
    state.createPending ||
    state.lifecycleMutation.state ===
      'sent'
  ) {
    return state;
  }

  return jahizTripSyncStateSchema.parse({
    ...state,
    lifecycleMutation: {
      ...state.lifecycleMutation,
      expectedRevision:
        state.serverRevision,
      state: 'sent',
    },
  });
}

export function nextJahizTripSyncOperation(
  stateInput: JahizTripSyncState,
): JahizTripSyncOperation {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );

  if (state.conflict) {
    return null;
  }

  if (state.createPending) {
    return 'create';
  }

  if (
    state.deletedTombstone
  ) {
    return (
      state.lifecycleMutation
        ?.targetStatus ===
        'deleted'
    )
      ? 'lifecycle'
      : null;
  }

  if (
    state.lifecycleMutation
      ?.targetStatus === 'active' &&
    state.serverLifecycleStatus ===
      'archived'
  ) {
    return 'lifecycle';
  }

  if (state.workspaceMutation) {
    return 'workspace';
  }

  if (state.lifecycleMutation) {
    return 'lifecycle';
  }

  return null;
}

function canonicalServerFields(
  trip: ServerTripEnvelope,
) {
  return {
    serverRevision:
      trip.revision,
    serverLifecycleStatus:
      trip.lifecycle.status,
    lastServerUpdatedAt:
      trip.serverUpdatedAt,
    deletedTombstone:
      trip.lifecycle.status ===
        'deleted'
        ? {
            deletedAt:
              trip.lifecycle
                .deletedAt ??
              trip.serverUpdatedAt,
          }
        : null,
  };
}

export function resolveJahizCreateApplied(
  stateInput: JahizTripSyncState,
  tripInput: ServerTripEnvelope,
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );
  const trip =
    serverTripEnvelopeSchema.parse(
      tripInput,
    );

  return jahizTripSyncStateSchema.parse({
    ...state,
    ...canonicalServerFields(
      trip,
    ),
    lastSyncedLocalUpdatedAt:
      state.createPending
        ?.snapshot.updatedAt ??
      state.lastSyncedLocalUpdatedAt,
    createPending: null,
  });
}

export function resolveJahizWorkspaceApplied(
  stateInput: JahizTripSyncState,
  tripInput: ServerTripEnvelope,
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );
  const trip =
    serverTripEnvelopeSchema.parse(
      tripInput,
    );

  return jahizTripSyncStateSchema.parse({
    ...state,
    ...canonicalServerFields(
      trip,
    ),
    lastSyncedLocalUpdatedAt:
      state.workspaceMutation
        ?.snapshot.updatedAt ??
      state.lastSyncedLocalUpdatedAt,
    workspaceMutation: null,
  });
}

export function resolveJahizLifecycleApplied(
  stateInput: JahizTripSyncState,
  tripInput: ServerTripEnvelope,
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );
  const trip =
    serverTripEnvelopeSchema.parse(
      tripInput,
    );

  return jahizTripSyncStateSchema.parse({
    ...state,
    ...canonicalServerFields(
      trip,
    ),
    lifecycleMutation: null,
    workspaceMutation:
      trip.lifecycle.status ===
        'deleted'
        ? null
        : state.workspaceMutation,
  });
}

export function recordJahizTripSyncConflict(
  stateInput: JahizTripSyncState,
  input: {
    kind:
      'create'
      | 'workspace'
      | 'lifecycle';
    remoteTrip:
      ServerTripEnvelope;
    detectedAt: string;
    localDraft?:
      TripWorkspace | null;
    lifecycleIntent?:
      'active'
      | 'archived'
      | 'deleted'
      | null;
  },
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );
  const remoteTrip =
    serverTripEnvelopeSchema.parse(
      input.remoteTrip,
    );

  const localDraft =
    input.localDraft !==
      undefined
      ? (
          input.localDraft
            ? tripWorkspaceSchema
                .parse(
                  input.localDraft,
                )
            : null
        )
      : input.kind === 'create'
        ? state.createPending
            ?.snapshot ?? null
        : input.kind ===
            'workspace'
          ? state.workspaceMutation
              ?.snapshot ?? null
          : null;

  const lifecycleIntent =
    input.lifecycleIntent !==
      undefined
      ? input.lifecycleIntent
      : input.kind ===
          'lifecycle'
        ? state.lifecycleMutation
            ?.targetStatus ?? null
        : null;

  const remoteDeleted =
    remoteTrip.lifecycle.status ===
      'deleted';

  return jahizTripSyncStateSchema.parse({
    ...state,
    ...(remoteDeleted
      ? canonicalServerFields(
          remoteTrip,
        )
      : {}),
    createPending:
      remoteDeleted
        ? null
        : state.createPending,
    workspaceMutation:
      remoteDeleted
        ? null
        : state.workspaceMutation,
    lifecycleMutation:
      remoteDeleted
        ? null
        : state.lifecycleMutation,
    conflict: {
      kind: input.kind,
      detectedAt:
        input.detectedAt,
      remoteTrip,
      localDraft,
      lifecycleIntent,
    },
  });
}

export function acceptJahizServerConflictVersion(
  stateInput: JahizTripSyncState,
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );

  if (!state.conflict) {
    return state;
  }

  const remoteTrip =
    state.conflict.remoteTrip;

  const remoteDeleted =
    remoteTrip.lifecycle.status ===
      'deleted';

  return jahizTripSyncStateSchema.parse({
    ...state,
    ...canonicalServerFields(
      remoteTrip,
    ),
    lastSyncedLocalUpdatedAt:
      remoteTrip.workspace.updatedAt,
    createPending:
      remoteDeleted ||
      state.conflict.kind ===
        'create'
        ? null
        : state.createPending,
    workspaceMutation:
      remoteDeleted ||
      state.conflict.kind ===
        'workspace'
        ? null
        : state.workspaceMutation,
    lifecycleMutation:
      remoteDeleted ||
      state.conflict.kind ===
        'lifecycle'
        ? null
        : state.lifecycleMutation,
    conflict: null,
  });
}

export function preserveJahizConflictDraftForReview(
  stateInput: JahizTripSyncState,
  preservedAt: string,
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );

  if (!state.conflict) {
    return state;
  }

  const preservedTime =
    z.string()
      .datetime()
      .parse(
        preservedAt,
      );

  const conflict =
    state.conflict;

  const remoteTrip =
    conflict.remoteTrip;

  const remoteDeleted =
    remoteTrip.lifecycle.status ===
      'deleted';

  return jahizTripSyncStateSchema.parse({
    ...state,
    ...canonicalServerFields(
      remoteTrip,
    ),
    lastSyncedLocalUpdatedAt:
      remoteTrip.workspace.updatedAt,
    createPending:
      remoteDeleted ||
      conflict.kind === 'create'
        ? null
        : state.createPending,
    workspaceMutation:
      remoteDeleted ||
      conflict.kind === 'workspace'
        ? null
        : state.workspaceMutation,
    lifecycleMutation:
      remoteDeleted ||
      conflict.kind === 'lifecycle'
        ? null
        : state.lifecycleMutation,
    preservedReview: {
      kind: conflict.kind,
      preservedAt:
        preservedTime,
      remoteTrip,
      localDraft:
        conflict.localDraft,
      lifecycleIntent:
        conflict.lifecycleIntent,
    },
    conflict: null,
  });
}


export function adoptJahizRemoteBaseline(
  stateInput: JahizTripSyncState,
  input: {
    trip: ServerTripEnvelope;
    localUpdatedAt: string;
  },
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );
  const trip =
    serverTripEnvelopeSchema.parse(
      input.trip,
    );

  return jahizTripSyncStateSchema.parse({
    ...state,
    ...canonicalServerFields(
      trip,
    ),
    lastSyncedLocalUpdatedAt:
      input.localUpdatedAt,
    createPending: null,
  });
}


export function clearJahizSatisfiedQueuedLifecycleMutation(
  stateInput: JahizTripSyncState,
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );

  if (
    !state.lifecycleMutation ||
    state.lifecycleMutation.state !==
      'queued' ||
    state.serverLifecycleStatus !==
      state.lifecycleMutation
        .targetStatus
  ) {
    return state;
  }

  return jahizTripSyncStateSchema.parse({
    ...state,
    lifecycleMutation: null,
  });
}


export function refreshJahizConflictLocalIntent(
  stateInput: JahizTripSyncState,
  input: {
    workspace: TripWorkspace;
    lifecycleIntent:
      'active'
      | 'archived'
      | 'deleted';
  },
): JahizTripSyncState {
  const state =
    jahizTripSyncStateSchema.parse(
      stateInput,
    );

  if (!state.conflict) {
    return state;
  }

  const workspace =
    tripWorkspaceSchema.parse(
      input.workspace,
    );

  if (
    workspace.id !==
      state.tripId
  ) {
    throw new Error(
      'Conflict local draft must belong to the same trip.',
    );
  }

  return jahizTripSyncStateSchema.parse({
    ...state,
    conflict: {
      ...state.conflict,
      localDraft:
        workspace,
      lifecycleIntent:
        input.lifecycleIntent,
    },
  });
}
