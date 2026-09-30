import type {
  ShadowSyncCursor,
} from './jahiz-shadow-sync';

export type ShadowCursorStorage = {
  getItemAsync: (
    key: string,
  ) => Promise<string | null>;
  setItemAsync: (
    key: string,
    value: string,
  ) => Promise<void>;
  deleteItemAsync: (
    key: string,
  ) => Promise<void>;
};

export type ShadowSyncCursorStore = {
  load: (
    tripId: string,
  ) => Promise<ShadowSyncCursor | null>;
  save: (
    tripId: string,
    cursor: ShadowSyncCursor,
  ) => Promise<void>;
  remove: (
    tripId: string,
  ) => Promise<void>;
};

const KEY_PREFIX =
  'jahiz.shadow-sync.cursor.v1';

function stableTripIdHash(
  value: string,
): string {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    const code =
      value.charCodeAt(index);

    left ^= code;
    left =
      Math.imul(
        left,
        0x01000193,
      );

    right ^=
      code + index;
    right =
      Math.imul(
        right,
        0x85ebca6b,
      );
  }

  return [
    (left >>> 0).toString(36),
    (right >>> 0).toString(36),
  ].join('.');
}

export function shadowCursorStorageKeyForTrip(
  tripId: string,
): string {
  if (!tripId.trim()) {
    throw new Error(
      'Shadow cursor trip id cannot be empty.',
    );
  }

  return [
    KEY_PREFIX,
    stableTripIdHash(tripId),
  ].join('.');
}

function isValidCursor(
  value: unknown,
): value is ShadowSyncCursor {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false;
  }

  const candidate =
    value as Partial<ShadowSyncCursor>;

  return (
    Number.isInteger(
      candidate.serverRevision,
    ) &&
    Number(
      candidate.serverRevision,
    ) >= 0 &&
    typeof candidate
      .lastSyncedLocalUpdatedAt ===
      'string' &&
    candidate
      .lastSyncedLocalUpdatedAt
      .length > 0 &&
    typeof candidate
      .lastServerUpdatedAt ===
      'string' &&
    candidate
      .lastServerUpdatedAt
      .length > 0
  );
}

export function createShadowSyncCursorStore(
  storage: ShadowCursorStorage,
): ShadowSyncCursorStore {
  return {
    async load(tripId) {
      const raw =
        await storage.getItemAsync(
          shadowCursorStorageKeyForTrip(tripId),
        );

      if (!raw) {
        return null;
      }

      try {
        const parsed =
          JSON.parse(raw) as unknown;

        return isValidCursor(parsed)
          ? parsed
          : null;
      } catch {
        return null;
      }
    },

    async save(
      tripId,
      cursor,
    ) {
      if (!isValidCursor(cursor)) {
        throw new Error(
          'Refusing to persist an invalid shadow cursor.',
        );
      }

      await storage.setItemAsync(
        shadowCursorStorageKeyForTrip(tripId),
        JSON.stringify(cursor),
      );
    },

    async remove(tripId) {
      await storage.deleteItemAsync(
        shadowCursorStorageKeyForTrip(tripId),
      );
    },
  };
}
