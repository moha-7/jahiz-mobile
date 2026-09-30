import type {
  ServerTripEnvelope,
} from '@jahiz/api-contracts';

import {
  acceptJahizServerConflictVersion,
  preserveJahizConflictDraftForReview,
  type JahizTripSyncState,
} from './jahiz-trip-sync-state';

import type {
  JahizTripSyncStateStore,
} from './jahiz-trip-sync-state-store';

export type JahizConflictResolutionStrategy =
  | 'use-server'
  | 'preserve-local';

export type JahizConflictResolutionResult =
  | {
      status: 'resolved';
      state:
        JahizTripSyncState;
      remoteTrip:
        ServerTripEnvelope;
      preservedLocalDraft:
        boolean;
    }
  | {
      status: 'no-conflict';
    };

export async function resolveJahizSyncConflict(
  input: {
    tripId: string;
    strategy:
      JahizConflictResolutionStrategy;
    stateStore:
      JahizTripSyncStateStore;
    now?: () => string;
  },
): Promise<JahizConflictResolutionResult> {
  const current =
    await input.stateStore
      .loadTrip(
        input.tripId,
      );

  if (!current?.conflict) {
    return {
      status: 'no-conflict',
    };
  }

  const remoteTrip =
    current.conflict
      .remoteTrip;

  const next =
    input.strategy ===
      'use-server'
      ? acceptJahizServerConflictVersion(
          current,
        )
      : preserveJahizConflictDraftForReview(
          current,
          (
            input.now ??
            (() =>
              new Date()
                .toISOString())
          )(),
        );

  await input.stateStore
    .saveTrip(next);

  return {
    status: 'resolved',
    state: next,
    remoteTrip,
    preservedLocalDraft:
      input.strategy ===
        'preserve-local',
  };
}
