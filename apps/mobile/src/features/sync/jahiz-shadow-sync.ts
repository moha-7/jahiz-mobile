import {
  tripWorkspaceSchema,
  type ServerTripEnvelope,
  type ServerTripCreateRequest,
  type ServerTripUpdateRequest,
  type ServerTripLifecycleMutationRequest,
  type TripWorkspace,
} from '@jahiz/api-contracts';

export type ShadowSyncCursor = {
  serverRevision: number;
  lastSyncedLocalUpdatedAt: string;
  lastServerUpdatedAt: string;
};

export type ShadowSyncRemoteRead =
  | {
      status: 'found';
      trip: ServerTripEnvelope;
    }
  | {
      status: 'not-found';
    }
  | {
      status:
        | 'unauthorized'
        | 'unavailable'
        | 'invalid-response';
    };

export type ShadowSyncRemoteMutation =
  | {
      status: 'applied';
      trip: ServerTripEnvelope;
      idempotentReplay: boolean;
    }
  | {
      status: 'conflict';
      trip: ServerTripEnvelope | null;
      expectedRevision: number | null;
    }
  | {
      status:
        | 'unauthorized'
        | 'unavailable'
        | 'invalid-response'
        | 'not-found';
    };

export type ShadowSyncRemoteLifecycleMutation =
  | {
      status: 'applied';
      trip: ServerTripEnvelope;
      idempotentReplay: boolean;
    }
  | {
      status: 'conflict';
      trip: ServerTripEnvelope;
      expectedRevision: number;
    }
  | {
      status: 'invalid-transition';
      trip: ServerTripEnvelope;
    }
  | {
      status:
        | 'unauthorized'
        | 'unavailable'
        | 'invalid-response'
        | 'not-found';
    };

export type ShadowSyncTransport = {
  getTrip: (
    tripId: string,
  ) => Promise<ShadowSyncRemoteRead>;
  createTrip: (
    request: ServerTripCreateRequest,
  ) => Promise<ShadowSyncRemoteMutation>;
  updateTrip: (
    tripId: string,
    request: ServerTripUpdateRequest,
  ) => Promise<ShadowSyncRemoteMutation>;
};

export type ShadowSyncLifecycleTransport = {
  transitionTripLifecycle: (
    tripId: string,
    request: ServerTripLifecycleMutationRequest,
  ) => Promise<ShadowSyncRemoteLifecycleMutation>;
};

export type ShadowSyncFullTransport =
  ShadowSyncTransport &
  ShadowSyncLifecycleTransport;

export type ShadowSyncOutcome =
  | 'created'
  | 'matched'
  | 'updated'
  | 'skipped-unchanged'
  | 'bootstrap-divergence'
  | 'server-divergence'
  | 'conflict'
  | 'not-found'
  | 'unauthorized'
  | 'unavailable'
  | 'invalid-response';

export type ShadowSyncTelemetryEvent = {
  outcome: ShadowSyncOutcome;
  parity: 'same' | 'different' | 'unknown';
  networkAction:
    | 'none'
    | 'read'
    | 'create'
    | 'update';
  serverRevision: number | null;
  durationMs: number;
};

export type ShadowSyncResult = {
  outcome: ShadowSyncOutcome;
  cursor: ShadowSyncCursor | null;
  remoteTrip: ServerTripEnvelope | null;
  telemetry: ShadowSyncTelemetryEvent;
};

type RunShadowSyncInput = {
  workspace: TripWorkspace;
  cursor: ShadowSyncCursor | null;
  clientMutationId: string;
  transport: ShadowSyncTransport;
  now?: () => number;
};

function canonicalize(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }

  if (
    value &&
    typeof value === 'object'
  ) {
    const entries =
      Object.entries(
        value as Record<string, unknown>,
      ).sort(([left], [right]) =>
        left.localeCompare(right),
      );

    return Object.fromEntries(
      entries.map(([key, item]) => [
        key,
        canonicalize(item),
      ]),
    );
  }

  return value;
}

export function areTripWorkspacesEqual(
  left: TripWorkspace,
  right: TripWorkspace,
): boolean {
  const parsedLeft =
    tripWorkspaceSchema.parse(left);
  const parsedRight =
    tripWorkspaceSchema.parse(right);

  return (
    JSON.stringify(
      canonicalize(parsedLeft),
    ) ===
    JSON.stringify(
      canonicalize(parsedRight),
    )
  );
}

function createCursor(
  workspace: TripWorkspace,
  trip: ServerTripEnvelope,
): ShadowSyncCursor {
  return {
    serverRevision: trip.revision,
    lastSyncedLocalUpdatedAt:
      workspace.updatedAt,
    lastServerUpdatedAt:
      trip.serverUpdatedAt,
  };
}

function makeResult(
  input: {
    outcome: ShadowSyncOutcome;
    parity:
      | 'same'
      | 'different'
      | 'unknown';
    networkAction:
      | 'none'
      | 'read'
      | 'create'
      | 'update';
    cursor: ShadowSyncCursor | null;
    remoteTrip:
      | ServerTripEnvelope
      | null;
    startedAt: number;
    endedAt: number;
  },
): ShadowSyncResult {
  return {
    outcome: input.outcome,
    cursor: input.cursor,
    remoteTrip: input.remoteTrip,
    telemetry: {
      outcome: input.outcome,
      parity: input.parity,
      networkAction:
        input.networkAction,
      serverRevision:
        input.remoteTrip?.revision ??
        input.cursor?.serverRevision ??
        null,
      durationMs: Math.max(
        0,
        input.endedAt -
          input.startedAt,
      ),
    },
  };
}

function mapRemoteFailure(
  status:
    | 'not-found'
    | 'unauthorized'
    | 'unavailable'
    | 'invalid-response',
): ShadowSyncOutcome {
  return status;
}

export async function runShadowSync(
  input: RunShadowSyncInput,
): Promise<ShadowSyncResult> {
  const workspace =
    tripWorkspaceSchema.parse(
      input.workspace,
    );

  const now =
    input.now ?? Date.now;
  const startedAt = now();

  if (
    input.cursor &&
    workspace.updatedAt ===
      input.cursor
        .lastSyncedLocalUpdatedAt
  ) {
    return makeResult({
      outcome: 'skipped-unchanged',
      parity: 'unknown',
      networkAction: 'none',
      cursor: input.cursor,
      remoteTrip: null,
      startedAt,
      endedAt: now(),
    });
  }

  if (!input.cursor) {
    const read =
      await input.transport.getTrip(
        workspace.id,
      );

    if (read.status === 'found') {
      const same =
        areTripWorkspacesEqual(
          workspace,
          read.trip.workspace,
        );

      if (!same) {
        return makeResult({
          outcome:
            'bootstrap-divergence',
          parity: 'different',
          networkAction: 'read',
          cursor: null,
          remoteTrip: read.trip,
          startedAt,
          endedAt: now(),
        });
      }

      return makeResult({
        outcome: 'matched',
        parity: 'same',
        networkAction: 'read',
        cursor: createCursor(
          workspace,
          read.trip,
        ),
        remoteTrip: read.trip,
        startedAt,
        endedAt: now(),
      });
    }

    if (read.status !== 'not-found') {
      return makeResult({
        outcome:
          mapRemoteFailure(
            read.status,
          ),
        parity: 'unknown',
        networkAction: 'read',
        cursor: null,
        remoteTrip: null,
        startedAt,
        endedAt: now(),
      });
    }

    const created =
      await input.transport.createTrip({
        clientMutationId:
          input.clientMutationId,
        workspace,
      });

    if (created.status !== 'applied') {
      const outcome =
        created.status === 'conflict'
          ? 'conflict'
          : mapRemoteFailure(
              created.status,
            );

      return makeResult({
        outcome,
        parity:
          created.status === 'conflict' &&
          created.trip
            ? areTripWorkspacesEqual(
                workspace,
                created.trip.workspace,
              )
              ? 'same'
              : 'different'
            : 'unknown',
        networkAction: 'create',
        cursor: null,
        remoteTrip:
          created.status === 'conflict'
            ? created.trip
            : null,
        startedAt,
        endedAt: now(),
      });
    }

    const same =
      areTripWorkspacesEqual(
        workspace,
        created.trip.workspace,
      );

    return makeResult({
      outcome: same
        ? 'created'
        : 'server-divergence',
      parity: same
        ? 'same'
        : 'different',
      networkAction: 'create',
      cursor: same
        ? createCursor(
            workspace,
            created.trip,
          )
        : null,
      remoteTrip: created.trip,
      startedAt,
      endedAt: now(),
    });
  }

  const updated =
    await input.transport.updateTrip(
      workspace.id,
      {
        clientMutationId:
          input.clientMutationId,
        expectedRevision:
          input.cursor.serverRevision,
        workspace,
      },
    );

  if (updated.status === 'conflict') {
    return makeResult({
      outcome: 'conflict',
      parity: updated.trip
        ? areTripWorkspacesEqual(
            workspace,
            updated.trip.workspace,
          )
          ? 'same'
          : 'different'
        : 'unknown',
      networkAction: 'update',
      cursor: input.cursor,
      remoteTrip: updated.trip,
      startedAt,
      endedAt: now(),
    });
  }

  if (updated.status !== 'applied') {
    return makeResult({
      outcome:
        mapRemoteFailure(
          updated.status,
        ),
      parity: 'unknown',
      networkAction: 'update',
      cursor: input.cursor,
      remoteTrip: null,
      startedAt,
      endedAt: now(),
    });
  }

  const same =
    areTripWorkspacesEqual(
      workspace,
      updated.trip.workspace,
    );

  return makeResult({
    outcome: same
      ? 'updated'
      : 'server-divergence',
    parity: same
      ? 'same'
      : 'different',
    networkAction: 'update',
    cursor: same
      ? createCursor(
          workspace,
          updated.trip,
        )
      : input.cursor,
    remoteTrip: updated.trip,
    startedAt,
    endedAt: now(),
  });
}

export function isShadowTelemetrySafe(
  event: ShadowSyncTelemetryEvent,
): boolean {
  const serialized =
    JSON.stringify(event);

  return ![
    'workspace',
    'availableNow',
    'expectedBeforeTravel',
    'safetyReserve',
    'originCommitments',
    'costItems',
    'payments',
    'commitments',
    'moneyIn',
  ].some((token) =>
    serialized.includes(token),
  );
}
