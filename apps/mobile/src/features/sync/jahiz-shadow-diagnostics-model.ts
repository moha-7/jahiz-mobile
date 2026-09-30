import {
  evaluateShadowCutoverEvidence,
  type ShadowCutoverEvaluation,
} from './jahiz-shadow-cutover-policy';

import {
  summarizeShadowParityEvidence,
  type ShadowParityEvidence,
} from './jahiz-shadow-parity-evidence';

import type {
  ShadowObserveConfig,
} from './jahiz-shadow-sync-observe-config';

export type ShadowDiagnosticsViewModel = {
  observeStatus:
    | 'enabled'
    | 'disabled';
  observeReason: string | null;
  reviewStatus:
    ShadowCutoverEvaluation['status'];
  blockers: string[];
  sessions: number;
  observations: number;
  parityComparisons: number;
  parityUnknown: number;
  paritySamePercent: number;
  conflictPercent: number;
  unavailablePercent: number;
  bootstrapDivergences: number;
  serverDivergences: number;
  invalidResponses: number;
  unauthorized: number;
  authority: 'local';
};

function percent(
  value: number,
): number {
  return Math.round(
    value * 10_000,
  ) / 100;
}

export function buildShadowDiagnosticsViewModel(
  config: ShadowObserveConfig,
  evidence: ShadowParityEvidence,
): ShadowDiagnosticsViewModel {
  const snapshot =
    summarizeShadowParityEvidence(
      evidence,
    );

  const evaluation =
    evaluateShadowCutoverEvidence(
      evidence,
    );

  return {
    observeStatus:
      config.enabled
        ? 'enabled'
        : 'disabled',
    observeReason:
      config.enabled
        ? null
        : config.reason,
    reviewStatus:
      evaluation.status,
    blockers:
      evaluation.reasons,
    sessions:
      snapshot.sessions,
    observations:
      snapshot.observations,
    parityComparisons:
      snapshot.parityComparisons,
    parityUnknown:
      snapshot.parityUnknown,    paritySamePercent:
      percent(
        snapshot.paritySameRate,
      ),
    conflictPercent:
      percent(
        snapshot.conflictRate,
      ),
    unavailablePercent:
      percent(
        snapshot.unavailableRate,
      ),
    bootstrapDivergences:
      snapshot.bootstrapDivergences,
    serverDivergences:
      snapshot.serverDivergences,
    invalidResponses:
      snapshot.invalidResponses,
    unauthorized:
      snapshot.unauthorized,
    authority: 'local',
  };
}
