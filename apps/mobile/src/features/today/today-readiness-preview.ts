export type TodayFinancialCoverageInput = {
  totalCost: number;
  remainingTotal: number;
  readyMoney: number;
};

export type TodayReadinessPreviewInput = {
  setupProgress: number;
  financialCoverage: number;
  commitmentsReviewed: boolean;
  paymentPlanCoverage: number;
};

export type TodayReadinessPreview = {
  score: number;
  issueCount: number;
  components: {
    setup: number;
    financialCoverage: number;
    commitments: number;
    payments: number;
  };
};

function clampPercentage(
  value: number,
): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(
    0,
    Math.min(100, value),
  );
}

export function calculateTodayFinancialCoverage(
  input: TodayFinancialCoverageInput,
): number {
  const totalCost = Number.isFinite(
    input.totalCost,
  )
    ? Math.max(0, input.totalCost)
    : 0;
  const remainingTotal = Number.isFinite(
    input.remainingTotal,
  )
    ? Math.max(0, input.remainingTotal)
    : 0;
  const readyMoney = Number.isFinite(
    input.readyMoney,
  )
    ? Math.max(0, input.readyMoney)
    : 0;

  if (totalCost <= 0) {
    return 0;
  }

  if (remainingTotal <= 0) {
    return 100;
  }

  return Math.min(
    100,
    Math.round(
      (readyMoney /
        remainingTotal) *
        100,
    ),
  );
}

/**
 * Presentation-layer readiness preview.
 *
 * This is intentionally isolated from financial truth and
 * @jahiz/core-finance. It combines already-computed signals
 * for the Today dashboard only, so the future
 * @jahiz/readiness-engine can replace it cleanly.
 */
export function calculateTodayReadinessPreview(
  input: TodayReadinessPreviewInput,
): TodayReadinessPreview {
  const setup =
    clampPercentage(
      input.setupProgress,
    ) * 0.25;
  const financialCoverage =
    clampPercentage(
      input.financialCoverage,
    ) * 0.4;
  const commitments =
    input.commitmentsReviewed
      ? 15
      : 0;
  const payments =
    clampPercentage(
      input.paymentPlanCoverage,
    ) * 0.2;

  const score = Math.round(
    setup +
      financialCoverage +
      commitments +
      payments,
  );

  const issueCount = [
    input.setupProgress < 100,
    input.financialCoverage < 100,
    !input.commitmentsReviewed,
    input.paymentPlanCoverage < 100,
  ].filter(Boolean).length;

  return {
    score,
    issueCount,
    components: {
      setup: Math.round(setup),
      financialCoverage:
        Math.round(financialCoverage),
      commitments:
        Math.round(commitments),
      payments: Math.round(payments),
    },
  };
}
