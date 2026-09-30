import type {
  TripTravelStyle,
} from '@jahiz/api-contracts';

export type TripFitStatus =
  | 'unknown'
  | 'strong'
  | 'balanced'
  | 'tight'
  | 'pressure';

export type TripStyleAssessment =
  | 'pending-market-data'
  | 'market-data-ready';

export type TripFitInput = {
  preferredStyle: TripTravelStyle;
  readyMoney: number;
  totalCost: number;
  needToSave: number;
  safetyReserve: number;
  overdueAmount: number;
  bookingCoverage: number;
  planProgress: number;
  hasMarketStyleEstimate: boolean;
};

export type TripFitResult = {
  status: TripFitStatus;
  score: number | null;
  preferredStyle: TripTravelStyle;
  affordableStyle: TripTravelStyle | null;
  styleAssessment: TripStyleAssessment;
  reasons: (
    | 'missing-cost-data'
    | 'funding-gap'
    | 'overdue-obligation'
    | 'booking-coverage'
    | 'plan-incomplete'
  )[];
};

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.max(
    min,
    Math.min(max, value),
  );
}

function finiteNonNegative(
  value: number,
): number {
  return Number.isFinite(value)
    ? Math.max(0, value)
    : 0;
}

export function calculateTripFit(
  input: TripFitInput,
): TripFitResult {
  const totalCost =
    finiteNonNegative(input.totalCost);

  if (totalCost <= 0) {
    return {
      status: 'unknown',
      score: null,
      preferredStyle:
        input.preferredStyle,
      affordableStyle: null,
      styleAssessment:
        input.hasMarketStyleEstimate
          ? 'market-data-ready'
          : 'pending-market-data',
      reasons: ['missing-cost-data'],
    };
  }

  const readyMoney =
    finiteNonNegative(input.readyMoney);
  const needToSave =
    finiteNonNegative(input.needToSave);
  const overdueAmount =
    finiteNonNegative(input.overdueAmount);
  const bookingCoverage =
    clamp(input.bookingCoverage, 0, 100);
  const planProgress =
    clamp(input.planProgress, 0, 100);

  const fundingGapRatio =
    needToSave / totalCost;

  let score = 100;
  const reasons: TripFitResult['reasons'] = [];

  if (needToSave > 0) {
    score -= Math.min(
      48,
      12 + fundingGapRatio * 60,
    );
    reasons.push('funding-gap');
  }

  if (overdueAmount > 0) {
    score -= 22;
    reasons.push(
      'overdue-obligation',
    );
  }

  if (bookingCoverage < 100) {
    score -=
      ((100 - bookingCoverage) / 100) *
      16;
    reasons.push('booking-coverage');
  }

  if (planProgress < 100) {
    score -=
      ((100 - planProgress) / 100) *
      10;
    reasons.push('plan-incomplete');
  }

  if (readyMoney <= 0) {
    score -= 12;
  }

  const normalizedScore = Math.round(
    clamp(score, 0, 100),
  );

  const status: TripFitStatus =
    normalizedScore >= 85
      ? 'strong'
      : normalizedScore >= 70
        ? 'balanced'
        : normalizedScore >= 50
          ? 'tight'
          : 'pressure';

  return {
    status,
    score: normalizedScore,
    preferredStyle:
      input.preferredStyle,

    // Deliberately unknown until market/provider estimates
    // can compare equivalent style scenarios.
    affordableStyle: null,

    styleAssessment:
      input.hasMarketStyleEstimate
        ? 'market-data-ready'
        : 'pending-market-data',
    reasons,
  };
}
