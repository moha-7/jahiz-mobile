export const DECISION_ENGINE_VERSION: string;
export const COMFORT_STRICTNESS: Readonly<Record<string, number>>;
export function num(value: unknown): number;
export function clamp(value: number, min?: number, max?: number): number;
export type DecisionFactor = { key: string; label: string; score: number; weight: number; reason: string };
export type DecisionInput = {
  planned?: number; available?: number; paid?: number; remaining?: number; gap?: number;
  emergency?: number; reserve?: number; comfort?: string; rateUnsure?: boolean;
  hasIncome?: boolean; hasDates?: boolean; continuingInstallments?: boolean;
  everNegative?: boolean; returnWithZero?: boolean;
};
export type DecisionResult = {
  version: string; key: string; verdict: string; reasonCode: string; readiness: number;
  scoreFactors: DecisionFactor[]; gap: number; paid: number; planned: number;
  available: number; remaining: number; bufferTarget: number; bufferRatio: number;
  inputs: Record<string, unknown>;
};
export function evaluateDecision(input?: DecisionInput): DecisionResult;
