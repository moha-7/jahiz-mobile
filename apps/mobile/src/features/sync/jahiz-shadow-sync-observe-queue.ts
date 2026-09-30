import type {
  TripWorkspace,
} from '@jahiz/api-contracts';

type ObserveOnlyShadowQueueInput = {
  sync: (
    workspace: TripWorkspace,
  ) => Promise<void>;
  onError?: (
    error: unknown,
  ) => Promise<void> | void;
  debounceMs?: number;
  schedule?: (
    callback: () => void,
    milliseconds: number,
  ) => ReturnType<typeof setTimeout>;
  cancel?: (
    handle:
      ReturnType<typeof setTimeout>,
  ) => void;
};

export function createObserveOnlyShadowQueue(
  input: ObserveOnlyShadowQueueInput,
) {
  const debounceMs =
    input.debounceMs ?? 750;

  const schedule =
    input.schedule ??
    ((callback, milliseconds) =>
      setTimeout(
        callback,
        milliseconds,
      ));

  const cancel =
    input.cancel ??
    ((handle) => {
      clearTimeout(handle);
    });

  let timer:
    | ReturnType<typeof setTimeout>
    | null = null;

  let latest:
    | TripWorkspace
    | null = null;

  let running = false;
  let stopped = false;

  function clearTimer() {
    if (timer) {
      cancel(timer);
      timer = null;
    }
  }

  function scheduleDrain(
    delay = debounceMs,
  ) {
    clearTimer();

    timer = schedule(
      () => {
        timer = null;
        void drain();
      },
      delay,
    );
  }

  async function drain() {
    if (
      stopped ||
      running ||
      !latest
    ) {
      return;
    }

    const workspace = latest;
    latest = null;
    running = true;

    try {
      await input.sync(
        workspace,
      );
    } catch (error) {
      try {
        await input.onError?.(
          error,
        );
      } catch {
        // Observe-only diagnostics must never crash the app.
      }
    } finally {
      running = false;

      if (
        !stopped &&
        latest
      ) {
        scheduleDrain();
      }
    }
  }

  return {
    enqueue(
      workspace: TripWorkspace,
    ) {
      if (stopped) {
        return;
      }

      latest = workspace;

      if (!running) {
        scheduleDrain();
      }
    },

    stop() {
      stopped = true;
      latest = null;
      clearTimer();
    },

    isRunning() {
      return running;
    },
  };
}
