import type {
  ShadowSyncOutcome,
  ShadowSyncTelemetryEvent,
} from './jahiz-shadow-sync';

export type ShadowParityEvidence = {
  version: 1;
  sessions: number;
  observations: number;
  paritySame: number;
  parityDifferent: number;
  parityUnknown: number;
  conflicts: number;
  bootstrapDivergences: number;
  serverDivergences: number;
  unavailable: number;
  unauthorized: number;
  invalidResponses: number;
  firstObservedAt: string | null;
  lastObservedAt: string | null;
  outcomeCounts: Partial<
    Record<
      ShadowSyncOutcome,
      number
    >
  >;
};

export type ShadowParityEvidenceSnapshot = {
  sessions: number;
  observations: number;
  parityComparisons: number;
  parityUnknown: number;
  paritySameRate: number;
  parityDifferentRate: number;
  parityUnknownRate: number;
  conflictRate: number;
  unavailableRate: number;
  bootstrapDivergences: number;
  serverDivergences: number;
  invalidResponses: number;
  unauthorized: number;
};

export function createEmptyShadowParityEvidence(): ShadowParityEvidence {
  return {
    version: 1,
    sessions: 0,
    observations: 0,
    paritySame: 0,
    parityDifferent: 0,
    parityUnknown: 0,
    conflicts: 0,
    bootstrapDivergences: 0,
    serverDivergences: 0,
    unavailable: 0,
    unauthorized: 0,
    invalidResponses: 0,
    firstObservedAt: null,
    lastObservedAt: null,
    outcomeCounts: {},
  };
}

function incrementOutcome(
  evidence: ShadowParityEvidence,
  outcome: ShadowSyncOutcome,
): ShadowParityEvidence['outcomeCounts'] {
  return {
    ...evidence.outcomeCounts,
    [outcome]:
      (evidence.outcomeCounts[
        outcome
      ] ?? 0) + 1,
  };
}

export function startShadowParityEvidenceSession(
  current: ShadowParityEvidence,
): ShadowParityEvidence {
  return {
    ...current,
    sessions:
      current.sessions + 1,
  };
}

export function reduceShadowParityEvidence(
  current: ShadowParityEvidence,
  event: ShadowSyncTelemetryEvent,
  observedAt: string,
): ShadowParityEvidence {
  const observations =
    current.observations + 1;

  return {
    ...current,
    observations,
    paritySame:
      current.paritySame +
      (event.parity === 'same'
        ? 1
        : 0),
    parityDifferent:
      current.parityDifferent +
      (event.parity ===
      'different'
        ? 1
        : 0),
    parityUnknown:
      current.parityUnknown +
      (event.parity === 'unknown'
        ? 1
        : 0),
    conflicts:
      current.conflicts +
      (event.outcome === 'conflict'
        ? 1
        : 0),
    bootstrapDivergences:
      current.bootstrapDivergences +
      (event.outcome ===
      'bootstrap-divergence'
        ? 1
        : 0),
    serverDivergences:
      current.serverDivergences +
      (event.outcome ===
      'server-divergence'
        ? 1
        : 0),
    unavailable:
      current.unavailable +
      (event.outcome ===
      'unavailable'
        ? 1
        : 0),
    unauthorized:
      current.unauthorized +
      (event.outcome ===
      'unauthorized'
        ? 1
        : 0),
    invalidResponses:
      current.invalidResponses +
      (event.outcome ===
      'invalid-response'
        ? 1
        : 0),
    firstObservedAt:
      current.firstObservedAt ??
      observedAt,
    lastObservedAt:
      observedAt,
    outcomeCounts:
      incrementOutcome(
        current,
        event.outcome,
      ),
  };
}

function safeRate(
  numerator: number,
  denominator: number,
): number {
  if (denominator <= 0) {
    return 0;
  }

  return numerator / denominator;
}

export function summarizeShadowParityEvidence(
  evidence: ShadowParityEvidence,
): ShadowParityEvidenceSnapshot {
  const parityComparisons =
    evidence.paritySame +
    evidence.parityDifferent;
  return {
    sessions:
      evidence.sessions,
    observations:
      evidence.observations,
    parityComparisons,
    parityUnknown:
      evidence.parityUnknown,    paritySameRate:
      safeRate(
        evidence.paritySame,
        parityComparisons,
      ),
    parityDifferentRate:
      safeRate(
        evidence.parityDifferent,
        parityComparisons,
      ),
    parityUnknownRate:
      safeRate(
        evidence.parityUnknown,
        evidence.observations,
      ),
    conflictRate:
      safeRate(
        evidence.conflicts,
        evidence.observations,
      ),
    unavailableRate:
      safeRate(
        evidence.unavailable,
        evidence.observations,
      ),
    bootstrapDivergences:
      evidence
        .bootstrapDivergences,
    serverDivergences:
      evidence.serverDivergences,
    invalidResponses:
      evidence.invalidResponses,
    unauthorized:
      evidence.unauthorized,
  };
}

export function isShadowParityEvidencePrivacySafe(
  evidence: ShadowParityEvidence,
): boolean {
  const serialized =
    JSON.stringify(evidence);

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
    'route',
    'destination',
  ].some((token) =>
    serialized.includes(token),
  );
}
