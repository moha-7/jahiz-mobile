import type {
  SyncTripInput,
  JahizTripSyncExecutorResult,
} from './jahiz-trip-sync-executor';

type SyncExecutorLike = {
  syncTrip: (
    input: SyncTripInput,
  ) =>
    Promise<JahizTripSyncExecutorResult>;
};

type TimerHandle =
  ReturnType<typeof setTimeout>;

type JahizSyncRuntimeControllerInput = {
  executor:
    SyncExecutorLike;
  debounceMs?: number;
  onResult?: (
    result:
      JahizTripSyncExecutorResult,
  ) => Promise<void> | void;
  onError?: (
    error: unknown,
  ) => Promise<void> | void;
  schedule?: (
    callback: () => void,
    milliseconds: number,
  ) => TimerHandle;
  cancel?: (
    handle: TimerHandle,
  ) => void;
};

export function createJahizSyncRuntimeController(
  input:
    JahizSyncRuntimeControllerInput,
) {
  const debounceMs =
    input.debounceMs ?? 650;

  const schedule =
    input.schedule ??
    ((callback, milliseconds) =>
      setTimeout(
        callback,
        milliseconds,
      ));

  const cancel =
    input.cancel ??
    ((handle) =>
      clearTimeout(handle));

  const latest =
    new Map<
      string,
      SyncTripInput
    >();

  const timers =
    new Map<
      string,
      TimerHandle
    >();

  const inFlight =
    new Set<string>();

  let stopped = false;

  function clearTimer(
    tripId: string,
  ) {
    const handle =
      timers.get(tripId);

    if (!handle) {
      return;
    }

    cancel(handle);
    timers.delete(tripId);
  }

  function scheduleTrip(
    tripId: string,
  ) {
    if (stopped) {
      return;
    }

    clearTimer(tripId);

    timers.set(
      tripId,
      schedule(
        () => {
          timers.delete(
            tripId,
          );
          void drain(tripId);
        },
        debounceMs,
      ),
    );
  }

  async function reportError(
    error: unknown,
  ) {
    try {
      await input.onError?.(
        error,
      );
    } catch {
      // Runtime reporting must never crash local product use.
    }
  }

  async function drain(
    tripId: string,
  ) {
    if (
      stopped ||
      inFlight.has(tripId)
    ) {
      return;
    }

    const next =
      latest.get(tripId);

    if (!next) {
      return;
    }

    latest.delete(tripId);
    inFlight.add(tripId);

    try {
      const result =
        await input.executor
          .syncTrip(next);

      await input.onResult?.(
        result,
      );
    } catch (error) {
      await reportError(error);
    } finally {
      inFlight.delete(tripId);

      if (
        !stopped &&
        latest.has(tripId)
      ) {
        scheduleTrip(tripId);
      }
    }
  }

  return {
    enqueue(
      syncInput: SyncTripInput,
    ) {
      if (stopped) {
        return;
      }

      latest.set(
        syncInput.workspace.id,
        syncInput,
      );

      if (
        !inFlight.has(
          syncInput.workspace.id,
        )
      ) {
        scheduleTrip(
          syncInput.workspace.id,
        );
      }
    },

    stop() {
      stopped = true;
      latest.clear();

      for (
        const [
          tripId,
        ]
        of timers
      ) {
        clearTimer(tripId);
      }
    },

    isInFlight(
      tripId: string,
    ) {
      return inFlight.has(
        tripId,
      );
    },

    hasQueued(
      tripId: string,
    ) {
      return latest.has(
        tripId,
      );
    },
  };
}
