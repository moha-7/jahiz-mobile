// Safaryaty canonical decision engine.
// Pure, framework-free and shared by frontend draft calculations and backend saved-trip summaries.

export const DECISION_ENGINE_VERSION = "4.29.44";

export const COMFORT_STRICTNESS = Object.freeze({
  Survival: 0.82,
  Balanced: 1,
  Comfortable: 1.12,
  Premium: 1.25,
});

export const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
export const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

export function evaluateDecision(raw = {}) {
  const planned = Math.max(0, num(raw.planned));
  const available = num(raw.available);
  const paid = Math.max(0, num(raw.paid));
  // Paid is progress only. It must not change affordability by default.
  const remaining = num(raw.remaining ?? (available - planned));
  const gap = Math.max(0, num(raw.gap ?? (planned - available)));
  const emergency = Math.max(0, num(raw.emergency));
  const reserve = Math.max(0, num(raw.reserve));
  const comfort = String(raw.comfort || "Balanced");
  const strictness = COMFORT_STRICTNESS[comfort] || 1;
  const strictPlanned = planned * strictness;
  const rateUnsure = Boolean(raw.rateUnsure);
  const hasIncome = Boolean(raw.hasIncome);
  const hasDates = Boolean(raw.hasDates);
  const continuingInstallments = Boolean(raw.continuingInstallments);
  const everNegative = Boolean(raw.everNegative);
  const returnWithZero = Boolean(raw.returnWithZero);

  const coverageRatio = strictPlanned > 0 ? available / strictPlanned : 1;
  const extraBufferRatio = strictPlanned > 0
    ? Math.max(0, available - strictPlanned) / Math.max(strictPlanned * 0.25, 1)
    : 1;
  const coverage = clamp(Math.round(
    coverageRatio >= 1
      ? 85 + Math.min(15, extraBufferRatio * 15)
      : coverageRatio * 85
  ));
  const coverageReason = planned <= 0
    ? "No trip costs added yet."
    : coverageRatio >= 1
      ? `Available cash covers the ${comfort.toLowerCase()} plan.`
      : `Short by ${Math.max(0, Math.round((1 - coverageRatio) * 100))}% of the ${comfort.toLowerCase()} plan.`;

  const bufferTarget = strictPlanned > 0 ? strictPlanned * 0.08 : 0;
  let safety = 40;
  if (emergency > 0) safety += 25;
  if (reserve > 0) safety += bufferTarget > 0 ? Math.min(20, (reserve / bufferTarget) * 20) : 10;
  if (remaining >= bufferTarget) safety += 15;
  safety = clamp(safety);
  const safetyReason = emergency <= 0
    ? "No emergency buffer detected."
    : remaining < bufferTarget
      ? "Buffer is thin after planned costs."
      : "Emergency and remaining buffer look healthy.";

  let timing = 70;
  if (continuingInstallments) timing -= 30;
  if (everNegative) timing -= 20;
  if (reserve <= 0 && !returnWithZero) timing -= 15;
  timing = clamp(timing);
  const timingReason = everNegative
    ? "Cashflow goes negative in some month before/during travel."
    : continuingInstallments
      ? "Installments continue after the trip."
      : reserve <= 0 && !returnWithZero
        ? "No post-trip reserve preference is confirmed."
        : "Cashflow timing looks stable.";

  let confidence = 100;
  if (rateUnsure) confidence -= 40;
  if (!hasIncome) confidence -= 25;
  if (!hasDates) confidence -= 20;
  confidence = clamp(confidence);
  const confidenceReason = rateUnsure
    ? "Exchange rate needs confirmation."
    : !hasIncome
      ? "No income source added yet."
      : !hasDates
        ? "Trip dates are not set."
        : "Inputs are confirmed.";

  const scoreFactors = [
    { key: "coverage", label: "Coverage", score: coverage, weight: 45, reason: coverageReason },
    { key: "safety", label: "Safety", score: safety, weight: 20, reason: safetyReason },
    { key: "timing", label: "Timing", score: timing, weight: 20, reason: timingReason },
    { key: "confidence", label: "Confidence", score: confidence, weight: 15, reason: confidenceReason },
  ];
  const rawReadiness = clamp(Math.round(scoreFactors.reduce((sum, factor) => sum + factor.score * factor.weight, 0) / 100));
  const readiness = planned <= 0 ? Math.min(rawReadiness, 35) : rawReadiness;
  const rawBufferTarget = planned > 0 ? planned * 0.08 : 0;
  const bufferRatio = planned > 0 ? remaining / Math.max(planned, 1) : 0;
  const tightButCovered = planned > 0 && gap <= 0 && remaining >= 0 && remaining < rawBufferTarget;

  let key;
  let verdict;
  let reasonCode;
  if (rateUnsure) {
    key = "blocked"; verdict = "BLOCKED"; reasonCode = "EXCHANGE_RATE_UNCONFIRMED";
  } else if (planned <= 0) {
    key = "blocked"; verdict = "BLOCKED"; reasonCode = "MISSING_TRIP_COSTS";
  } else if (tightButCovered) {
    key = "tight"; verdict = "TIGHT"; reasonCode = "COVERED_BUT_THIN_BUFFER";
  } else if (readiness >= 85 && gap <= 0) {
    key = "safe"; verdict = "READY"; reasonCode = "READY";
  } else if (readiness >= 70 || gap <= planned * 0.08) {
    key = "almost"; verdict = "ALMOST"; reasonCode = gap > 0 ? "SMALL_SAVING_GAP" : "STRENGTHEN_SAFETY_OR_TIMING";
  } else if (readiness >= 45) {
    key = "tight"; verdict = "TIGHT"; reasonCode = gap > 0 ? "MATERIAL_SAVING_GAP" : "WEAK_TIMING_OR_BUFFER";
  } else {
    key = "risky"; verdict = "RISKY"; reasonCode = gap > 0 ? "LARGE_SAVING_GAP" : "LOW_CONFIDENCE_OR_SAFETY";
  }

  return {
    version: DECISION_ENGINE_VERSION,
    key,
    verdict,
    reasonCode,
    readiness,
    scoreFactors,
    gap,
    paid,
    planned,
    available,
    remaining,
    bufferTarget: rawBufferTarget,
    bufferRatio,
    inputs: {
      comfort,
      strictness,
      emergency,
      reserve,
      rateUnsure,
      hasIncome,
      hasDates,
      continuingInstallments,
      everNegative,
      returnWithZero,
    },
  };
}
