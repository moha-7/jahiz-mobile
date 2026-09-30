import type {
  ShadowSyncTelemetryEvent,
} from './jahiz-shadow-sync';

import {
  createEmptyShadowParityEvidence,
  isShadowParityEvidencePrivacySafe,
  reduceShadowParityEvidence,
  startShadowParityEvidenceSession,
  type ShadowParityEvidence,
} from './jahiz-shadow-parity-evidence';

export type ShadowParityEvidenceStorage = {
  getItemAsync: (
    key: string,
  ) => Promise<string | null>;
  setItemAsync: (
    key: string,
    value: string,
  ) => Promise<void>;
};

export type ShadowParityEvidenceStore = {
  load: () =>
    Promise<ShadowParityEvidence>;
  beginSession: () =>
    Promise<ShadowParityEvidence>;
  record: (
    event: ShadowSyncTelemetryEvent,
  ) => Promise<ShadowParityEvidence>;
};

const STORAGE_KEY =
  'jahiz.shadow-sync.evidence.v1';

function isNonNegativeInteger(
  value: unknown,
): value is number {
  return (
    Number.isInteger(value) &&
    Number(value) >= 0
  );
}

function isValidEvidence(
  value: unknown,
): value is ShadowParityEvidence {
  if (
    !value ||
    typeof value !== 'object'
  ) {
    return false;
  }

  const candidate =
    value as Partial<ShadowParityEvidence>;

  return (
    candidate.version === 1 &&
    isNonNegativeInteger(
      candidate.sessions,
    ) &&
    isNonNegativeInteger(
      candidate.observations,
    ) &&
    isNonNegativeInteger(
      candidate.paritySame,
    ) &&
    isNonNegativeInteger(
      candidate.parityDifferent,
    ) &&
    isNonNegativeInteger(
      candidate.parityUnknown,
    ) &&
    isNonNegativeInteger(
      candidate.conflicts,
    ) &&
    isNonNegativeInteger(
      candidate.bootstrapDivergences,
    ) &&
    isNonNegativeInteger(
      candidate.serverDivergences,
    ) &&
    isNonNegativeInteger(
      candidate.unavailable,
    ) &&
    isNonNegativeInteger(
      candidate.unauthorized,
    ) &&
    isNonNegativeInteger(
      candidate.invalidResponses,
    ) &&
    typeof candidate
      .outcomeCounts ===
      'object'
  );
}

export function createShadowParityEvidenceStore(
  storage: ShadowParityEvidenceStorage,
  now:
    () => string =
      () =>
        new Date().toISOString(),
): ShadowParityEvidenceStore {
  let tail:
    Promise<unknown> =
      Promise.resolve();

  async function loadUnlocked() {
    const raw =
      await storage.getItemAsync(
        STORAGE_KEY,
      );

    if (!raw) {
      return createEmptyShadowParityEvidence();
    }

    try {
      const parsed =
        JSON.parse(raw) as unknown;

      return isValidEvidence(parsed)
        ? parsed
        : createEmptyShadowParityEvidence();
    } catch {
      return createEmptyShadowParityEvidence();
    }
  }

  async function saveUnlocked(
    evidence: ShadowParityEvidence,
  ) {
    if (
      !isShadowParityEvidencePrivacySafe(
        evidence,
      )
    ) {
      throw new Error(
        'Unsafe shadow parity evidence was blocked.',
      );
    }

    await storage.setItemAsync(
      STORAGE_KEY,
      JSON.stringify(evidence),
    );
  }

  function enqueue<T>(
    action:
      () => Promise<T>,
  ): Promise<T> {
    const run =
      tail.then(action, action);

    tail = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  return {
    load() {
      return enqueue(
        loadUnlocked,
      );
    },

    beginSession() {
      return enqueue(
        async () => {
          const current =
            await loadUnlocked();

          const next =
            startShadowParityEvidenceSession(
              current,
            );

          await saveUnlocked(next);

          return next;
        },
      );
    },

    record(event) {
      return enqueue(
        async () => {
          const current =
            await loadUnlocked();

          const next =
            reduceShadowParityEvidence(
              current,
              event,
              now(),
            );

          await saveUnlocked(next);

          return next;
        },
      );
    },
  };
}
