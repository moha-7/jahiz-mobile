import {
  summarizeShadowParityEvidence,
  type ShadowParityEvidence,
  type ShadowParityEvidenceSnapshot,
} from './jahiz-shadow-parity-evidence';

export type ShadowCutoverPolicy = {
  minSessions: number;
  minObservations: number;
  minParityComparisons: number;
  minParitySameRate: number;
  maxConflictRate: number;
  maxUnavailableRate: number;
  requireZeroBootstrapDivergence: boolean;
  requireZeroServerDivergence: boolean;
  requireZeroInvalidResponses: boolean;
  requireZeroUnauthorized: boolean;
};

export const DEFAULT_SHADOW_CUTOVER_POLICY: ShadowCutoverPolicy = {
  minSessions: 3,
  minObservations: 25,
  minParityComparisons: 25,
  minParitySameRate: 0.99,
  maxConflictRate: 0.01,
  maxUnavailableRate: 0.05,
  requireZeroBootstrapDivergence: true,
  requireZeroServerDivergence: true,
  requireZeroInvalidResponses: true,
  requireZeroUnauthorized: true,
};

export type ShadowCutoverEvaluation = {
  status:
    | 'blocked'
    | 'eligible-for-review';
  reasons: string[];
  snapshot:
    ShadowParityEvidenceSnapshot;
};

export function evaluateShadowCutoverEvidence(
  evidence: ShadowParityEvidence,
  policy:
    ShadowCutoverPolicy =
      DEFAULT_SHADOW_CUTOVER_POLICY,
): ShadowCutoverEvaluation {
  const snapshot =
    summarizeShadowParityEvidence(
      evidence,
    );

  const reasons: string[] = [];

  if (
    snapshot.sessions <
      policy.minSessions
  ) {
    reasons.push(
      'insufficient-sessions',
    );
  }

  if (
    snapshot.observations <
      policy.minObservations
  ) {
    reasons.push(
      'insufficient-observations',
    );
  }

  if (
    snapshot.parityComparisons <
      policy.minParityComparisons
  ) {
    reasons.push(
      'insufficient-parity-comparisons',
    );
  }
  if (
    snapshot.paritySameRate <
      policy.minParitySameRate
  ) {
    reasons.push(
      'parity-below-threshold',
    );
  }

  if (
    snapshot.conflictRate >
      policy.maxConflictRate
  ) {
    reasons.push(
      'conflict-rate-too-high',
    );
  }

  if (
    snapshot.unavailableRate >
      policy.maxUnavailableRate
  ) {
    reasons.push(
      'unavailable-rate-too-high',
    );
  }

  if (
    policy
      .requireZeroBootstrapDivergence &&
    snapshot.bootstrapDivergences >
      0
  ) {
    reasons.push(
      'bootstrap-divergence-observed',
    );
  }

  if (
    policy
      .requireZeroServerDivergence &&
    snapshot.serverDivergences >
      0
  ) {
    reasons.push(
      'server-divergence-observed',
    );
  }

  if (
    policy
      .requireZeroInvalidResponses &&
    snapshot.invalidResponses > 0
  ) {
    reasons.push(
      'invalid-response-observed',
    );
  }

  if (
    policy
      .requireZeroUnauthorized &&
    snapshot.unauthorized > 0
  ) {
    reasons.push(
      'unauthorized-observed',
    );
  }

  return {
    status:
      reasons.length === 0
        ? 'eligible-for-review'
        : 'blocked',
    reasons,
    snapshot,
  };
}
