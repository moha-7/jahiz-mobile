import type {
  JahizTripSyncState,
} from './jahiz-trip-sync-state';
import {
  jahizTripSyncStateSchema,
} from './jahiz-trip-sync-state';

export type JahizTripSyncStateStorage = {
  getItemAsync: (
    key: string,
  ) => Promise<string | null>;
  setItemAsync: (
    key: string,
    value: string,
  ) => Promise<void>;
};

export type JahizTripSyncStateStore = {
  loadTrip: (
    tripId: string,
  ) => Promise<JahizTripSyncState | null>;
  saveTrip: (
    state: JahizTripSyncState,
  ) => Promise<void>;
  removeTrip: (
    tripId: string,
  ) => Promise<void>;
  loadAll: () =>
    Promise<JahizTripSyncState[]>;
};

const STORAGE_KEY =
  'jahiz.trip-sync-state.v1';

type PersistedDocument = {
  version: 1;
  trips:
    Record<
      string,
      JahizTripSyncState
    >;
};

function emptyDocument():
  PersistedDocument {
  return {
    version: 1,
    trips: {},
  };
}

function parseDocument(
  raw: string | null,
): PersistedDocument {
  if (!raw) {
    return emptyDocument();
  }

  try {
    const parsed =
      JSON.parse(raw) as {
        version?: unknown;
        trips?: unknown;
      };

    if (
      parsed.version !== 1 ||
      !parsed.trips ||
      typeof parsed.trips !==
        'object' ||
      Array.isArray(parsed.trips)
    ) {
      return emptyDocument();
    }

    const trips:
      Record<
        string,
        JahizTripSyncState
      > = {};

    for (
      const [
        tripId,
        value,
      ]
      of Object.entries(
        parsed.trips,
      )
    ) {
      const parsedState =
        jahizTripSyncStateSchema
          .safeParse(value);

      if (
        parsedState.success &&
        parsedState.data.tripId ===
          tripId
      ) {
        trips[tripId] =
          parsedState.data;
      }
    }

    return {
      version: 1,
      trips,
    };
  } catch {
    return emptyDocument();
  }
}

export function createJahizTripSyncStateStore(
  storage:
    JahizTripSyncStateStorage,
): JahizTripSyncStateStore {
  let tail:
    Promise<unknown> =
      Promise.resolve();

  async function loadDocument() {
    return parseDocument(
      await storage.getItemAsync(
        STORAGE_KEY,
      ),
    );
  }

  async function saveDocument(
    document: PersistedDocument,
  ) {
    await storage.setItemAsync(
      STORAGE_KEY,
      JSON.stringify(
        document,
      ),
    );
  }

  function enqueue<T>(
    action:
      () => Promise<T>,
  ): Promise<T> {
    const run =
      tail.then(
        action,
        action,
      );

    tail =
      run.then(
        () => undefined,
        () => undefined,
      );

    return run;
  }

  return {
    loadTrip(tripId) {
      return enqueue(
        async () => {
          const document =
            await loadDocument();

          return (
            document.trips[
              tripId
            ] ?? null
          );
        },
      );
    },

    saveTrip(stateInput) {
      return enqueue(
        async () => {
          const state =
            jahizTripSyncStateSchema
              .parse(
                stateInput,
              );

          const document =
            await loadDocument();

          document.trips[
            state.tripId
          ] = state;

          await saveDocument(
            document,
          );
        },
      );
    },

    removeTrip(tripId) {
      return enqueue(
        async () => {
          const document =
            await loadDocument();

          delete document.trips[
            tripId
          ];

          await saveDocument(
            document,
          );
        },
      );
    },

    loadAll() {
      return enqueue(
        async () => {
          const document =
            await loadDocument();

          return Object.values(
            document.trips,
          );
        },
      );
    },
  };
}
