import type {
  TripWorkspace,
} from '@jahiz/api-contracts';

import {
  isShadowTelemetrySafe,
  runShadowSync,
  type ShadowSyncResult,
  type ShadowSyncTelemetryEvent,
  type ShadowSyncTransport,
} from './jahiz-shadow-sync';

import type {
  ShadowSyncCursorStore,
} from './jahiz-shadow-sync-cursor-store';

export type ShadowSyncTelemetrySink = (
  event: ShadowSyncTelemetryEvent,
) => Promise<void> | void;

export type ShadowSyncRuntimeResult =
  | {
      status: 'disabled';
      attempts: 0;
    }
  | {
      status: 'completed';
      attempts: number;
      result: ShadowSyncResult;
    };

export type ShadowSyncRetryPolicy = {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
};

type ShadowSyncRuntimeControllerInput = {
  enabled: boolean;
  transport: ShadowSyncTransport;
  cursorStore: ShadowSyncCursorStore;
  telemetrySink?: ShadowSyncTelemetrySink;
  retryPolicy?: Partial<ShadowSyncRetryPolicy>;
  sleep?: (
    milliseconds: number,
  ) => Promise<void>;
  createClientMutationId?: (
    workspace: TripWorkspace,
  ) => string;
  now?: () => number;
};

const DEFAULT_RETRY_POLICY: ShadowSyncRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 2_000,
};

function defaultSleep(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function defaultMutationId(
  workspace: TripWorkspace,
): string {
  const random =
    Math.random()
      .toString(36)
      .slice(2, 12);

  return [
    'shadow',
    workspace.id,
    Date.now().toString(36),
    random,
  ].join(':');
}

function resolveRetryPolicy(
  input:
    | Partial<ShadowSyncRetryPolicy>
    | undefined,
): ShadowSyncRetryPolicy {
  const resolved = {
    ...DEFAULT_RETRY_POLICY,
    ...input,
  };

  if (
    !Number.isInteger(
      resolved.maxAttempts,
    ) ||
    resolved.maxAttempts < 1
  ) {
    throw new Error(
      'Shadow retry maxAttempts must be at least 1.',
    );
  }

  if (
    resolved.baseDelayMs < 0 ||
    resolved.maxDelayMs < 0 ||
    resolved.maxDelayMs <
      resolved.baseDelayMs
  ) {
    throw new Error(
      'Shadow retry delay configuration is invalid.',
    );
  }

  return resolved;
}

function retryDelay(
  attempt: number,
  policy: ShadowSyncRetryPolicy,
): number {
  const raw =
    policy.baseDelayMs *
    2 ** Math.max(
      0,
      attempt - 1,
    );

  return Math.min(
    raw,
    policy.maxDelayMs,
  );
}

function shouldRetry(
  result: ShadowSyncResult,
): boolean {
  return (
    result.outcome ===
      'unavailable'
  );
}

export function createShadowSyncRuntimeController(
  input: ShadowSyncRuntimeControllerInput,
) {
  const retryPolicy =
    resolveRetryPolicy(
      input.retryPolicy,
    );

  const sleep =
    input.sleep ??
    defaultSleep;

  const createClientMutationId =
    input.createClientMutationId ??
    defaultMutationId;

  const inFlight =
    new Map<
      string,
      Promise<ShadowSyncRuntimeResult>
    >();

  async function emitTelemetry(
    result: ShadowSyncResult,
  ) {
    if (!input.telemetrySink) {
      return;
    }

    if (
      !isShadowTelemetrySafe(
        result.telemetry,
      )
    ) {
      throw new Error(
        'Unsafe shadow telemetry was blocked.',
      );
    }

    await input.telemetrySink(
      result.telemetry,
    );
  }

  async function execute(
    workspace: TripWorkspace,
  ): Promise<ShadowSyncRuntimeResult> {
    if (!input.enabled) {
      return {
        status: 'disabled',
        attempts: 0,
      };
    }

    const cursor =
      await input.cursorStore.load(
        workspace.id,
      );

    const clientMutationId =
      createClientMutationId(
        workspace,
      );

    let lastResult:
      | ShadowSyncResult
      | null = null;

    for (
      let attempt = 1;
      attempt <=
        retryPolicy.maxAttempts;
      attempt += 1
    ) {
      const result =
        await runShadowSync({
          workspace,
          cursor,
          clientMutationId,
          transport:
            input.transport,
          now: input.now,
        });

      lastResult = result;

      await emitTelemetry(
        result,
      );

      if (result.cursor) {
        await input.cursorStore.save(
          workspace.id,
          result.cursor,
        );
      }

      if (
        !shouldRetry(result) ||
        attempt ===
          retryPolicy.maxAttempts
      ) {
        return {
          status: 'completed',
          attempts: attempt,
          result,
        };
      }

      await sleep(
        retryDelay(
          attempt,
          retryPolicy,
        ),
      );
    }

    if (!lastResult) {
      throw new Error(
        'Shadow runtime completed without a result.',
      );
    }

    return {
      status: 'completed',
      attempts:
        retryPolicy.maxAttempts,
      result: lastResult,
    };
  }

  function sync(
    workspace: TripWorkspace,
  ): Promise<ShadowSyncRuntimeResult> {
    const existing =
      inFlight.get(
        workspace.id,
      );

    if (existing) {
      return existing;
    }

    const promise =
      execute(workspace).finally(
        () => {
          if (
            inFlight.get(
              workspace.id,
            ) === promise
          ) {
            inFlight.delete(
              workspace.id,
            );
          }
        },
      );

    inFlight.set(
      workspace.id,
      promise,
    );

    return promise;
  }

  return {
    sync,
    isInFlight(
      tripId: string,
    ) {
      return inFlight.has(
        tripId,
      );
    },
  };
}
