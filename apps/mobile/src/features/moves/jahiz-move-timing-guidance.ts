import type {
  MoveTripRecommendation,
} from '@jahiz/api-contracts';
import type {
  JahizTripLifecycle,
} from './jahiz-decision-state';

export type JahizMoveTimingGuidance =
  | {
      kind: 'hidden';
    }
  | {
      kind: 'fixed';
    }
  | {
      kind: 'no-known-improvement';
      checkedOffsets: number[];
    }
  | {
      kind: 'better-timing';
      offsetDays: number;
      proposedDepartureDate: string;
      knownImprovement: number;
      repricingUnknown: boolean;
    };

export function resolveJahizMoveTimingGuidance(
  input: {
    lifecycle: JahizTripLifecycle;
    planProgress: number;
    hasDates: boolean;
    flexibility: 'fixed' | 'flexible';
    recommendation:
      | MoveTripRecommendation
      | null;
  },
): JahizMoveTimingGuidance {
  if (
    input.lifecycle !== 'pre-trip' ||
    input.planProgress < 100 ||
    !input.hasDates
  ) {
    return {
      kind: 'hidden',
    };
  }

  if (input.flexibility === 'fixed') {
    return {
      kind: 'fixed',
    };
  }

  if (!input.recommendation) {
    return {
      kind: 'hidden',
    };
  }

  const best = input.recommendation.best;

  if (!best) {
    return {
      kind: 'no-known-improvement',
      checkedOffsets:
        input.recommendation.checkedOffsets,
    };
  }

  const proposedDepartureDate =
    best.proposedDates.departureDate;

  if (!proposedDepartureDate) {
    return {
      kind: 'hidden',
    };
  }

  return {
    kind: 'better-timing',
    offsetDays: best.offsetDays,
    proposedDepartureDate,
    knownImprovement:
      best.comparison.deltaNetBeforeTrip,
    repricingUnknown:
      best.comparison.unknowns.includes(
        'trip-cost-repricing',
      ),
  };
}
