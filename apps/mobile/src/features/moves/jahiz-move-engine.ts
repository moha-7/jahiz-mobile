import type {
  JahizDecisionReason,
  JahizDecisionState,
  JahizTripLifecycle,
} from './jahiz-decision-state';

export type JahizMoveLever =
  | 'time'
  | 'money'
  | 'commitments'
  | 'bookings'
  | 'payments'
  | 'spending'
  | 'certainty';

export type JahizMoveKind =
  | 'overdue-commitment'
  | 'overdue-payment'
  | 'funding-gap'
  | 'bookings-left'
  | 'plan-incomplete'
  | 'review-spending'
  | 'review-moves'
  | 'trip-complete'
  | 'set-dates';

export type JahizMoveRole =
  | 'best-move'
  | 'quick-win'
  | 'next-move';

export type JahizMoveCandidate = {
  id: string;
  kind: JahizMoveKind;
  lever: JahizMoveLever;
  route: JahizDecisionState['route'];
  impactAmount: number | null;
  impact: number;
  confidence: number;
  urgency: number;
  effort: number;
  disruption: number;
  primary: boolean;
  score: number;
};

export type JahizRankedMove = JahizMoveCandidate & {
  role: JahizMoveRole;
};

export type JahizMoveEngineInput = {
  decision: JahizDecisionState;
  planProgress: number;
  needToSave: number;
  bookingRemainingTotal: number;
  paymentPlanCoverage: number;
  onTripBudget: number;
};

type CandidateSeed = Omit<
  JahizMoveCandidate,
  'score'
>;

function clampRating(value: number): number {
  return Math.max(1, Math.min(5, value));
}

function scoreCandidate(
  seed: CandidateSeed,
): number {
  const impact = clampRating(seed.impact);
  const confidence = clampRating(
    seed.confidence,
  );
  const urgency = clampRating(
    seed.urgency,
  );
  const effort = clampRating(seed.effort);
  const disruption = clampRating(
    seed.disruption,
  );

  return (
    impact * 4 +
    confidence * 3 +
    urgency * 5 +
    (6 - effort) * 2 +
    (6 - disruption) +
    (seed.primary ? 8 : 0)
  );
}

function candidate(
  seed: CandidateSeed,
): JahizMoveCandidate {
  return {
    ...seed,
    score: scoreCandidate(seed),
  };
}

function primarySeed(
  reason: JahizDecisionReason,
  lifecycle: JahizTripLifecycle,
  input: JahizMoveEngineInput,
): CandidateSeed {
  switch (reason) {
    case 'overdue-commitment':
      return {
        id: 'primary-overdue-commitment',
        kind: 'overdue-commitment',
        lever: 'commitments',
        route: '/trip/create/commitments',
        impactAmount:
          input.decision.attention?.amount ??
          null,
        impact: 5,
        confidence: 5,
        urgency: 5,
        effort: 2,
        disruption: 2,
        primary: true,
      };
    case 'overdue-payment':
      return {
        id: 'primary-overdue-payment',
        kind: 'overdue-payment',
        lever: 'payments',
        route: input.decision.route,
        impactAmount:
          input.decision.attention?.amount ??
          null,
        impact: 5,
        confidence: 5,
        urgency: 5,
        effort: 2,
        disruption: 2,
        primary: true,
      };
    case 'funding-gap':
      return {
        id: 'primary-funding-gap',
        kind: 'funding-gap',
        lever: 'money',
        route: '/trip/create/funds',
        impactAmount:
          input.needToSave > 0
            ? input.needToSave
            : null,
        impact: 5,
        confidence: 5,
        urgency: 5,
        effort: 4,
        disruption: 3,
        primary: true,
      };
    case 'bookings-left':
      return {
        id: 'primary-bookings-left',
        kind: 'bookings-left',
        lever: 'bookings',
        route: '/payments',
        impactAmount:
          input.bookingRemainingTotal > 0
            ? input.bookingRemainingTotal
            : null,
        impact: 4,
        confidence: 5,
        urgency:
          lifecycle === 'pre-trip'
            ? 5
            : 4,
        effort: 2,
        disruption: 2,
        primary: true,
      };
    case 'plan-incomplete':
      return {
        id: 'primary-plan-incomplete',
        kind: 'plan-incomplete',
        lever: 'certainty',
        route: input.decision.route,
        impactAmount: null,
        impact: 3,
        confidence: 5,
        urgency: 4,
        effort: 2,
        disruption: 1,
        primary: true,
      };
    case 'review-spending':
      return {
        id: 'primary-review-spending',
        kind: 'review-spending',
        lever: 'spending',
        route: '/trip/create/costs',
        impactAmount:
          input.onTripBudget > 0
            ? input.onTripBudget
            : null,
        impact: 4,
        confidence: 5,
        urgency:
          lifecycle === 'last-day'
            ? 5
            : 4,
        effort: 2,
        disruption: 1,
        primary: true,
      };
    case 'review-moves':
      return {
        id: 'primary-review-moves',
        kind: 'review-moves',
        lever: 'certainty',
        route: '/moves',
        impactAmount: null,
        impact: 2,
        confidence: 4,
        urgency: 2,
        effort: 1,
        disruption: 1,
        primary: true,
      };
    case 'trip-complete':
      return {
        id: 'primary-trip-complete',
        kind: 'trip-complete',
        lever: 'certainty',
        route: '/plan',
        impactAmount: null,
        impact: 2,
        confidence: 5,
        urgency: 2,
        effort: 1,
        disruption: 1,
        primary: true,
      };
    case 'set-dates':
      return {
        id: 'primary-set-dates',
        kind: 'set-dates',
        lever: 'time',
        route: '/trip/create/dates',
        impactAmount: null,
        impact: 4,
        confidence: 5,
        urgency: 5,
        effort: 1,
        disruption: 1,
        primary: true,
      };
  }
}

function dedupeByKind(
  candidates: JahizMoveCandidate[],
): JahizMoveCandidate[] {
  const seen = new Set<JahizMoveKind>();

  return candidates.filter((item) => {
    if (seen.has(item.kind)) {
      return false;
    }

    seen.add(item.kind);
    return true;
  });
}

export function buildJahizMoveCandidates(
  input: JahizMoveEngineInput,
): JahizMoveCandidate[] {
  const lifecycle =
    input.decision.lifecycle;

  const seeds: CandidateSeed[] = [
    primarySeed(
      input.decision.reason,
      lifecycle,
      input,
    ),
  ];

  if (lifecycle === 'completed') {
    return seeds.map(candidate);
  }

  if (
    input.bookingRemainingTotal > 0 &&
    input.decision.reason !==
      'bookings-left'
  ) {
    seeds.push({
      id: 'secondary-bookings-left',
      kind: 'bookings-left',
      lever: 'bookings',
      route: '/payments',
      impactAmount:
        input.bookingRemainingTotal,
      impact: 4,
      confidence: 5,
      urgency:
        lifecycle === 'pre-trip'
          ? 4
          : 3,
      effort: 2,
      disruption: 2,
      primary: false,
    });
  }

  if (
    lifecycle !== 'pre-trip' &&
    input.onTripBudget > 0 &&
    input.decision.reason !==
      'review-spending'
  ) {
    seeds.push({
      id: 'secondary-review-spending',
      kind: 'review-spending',
      lever: 'spending',
      route: '/trip/create/costs',
      impactAmount:
        input.onTripBudget,
      impact: 3,
      confidence: 5,
      urgency:
        lifecycle === 'last-day'
          ? 4
          : lifecycle === 'in-progress'
            ? 3
            : 2,
      effort: 2,
      disruption: 1,
      primary: false,
    });
  }

  if (
    input.paymentPlanCoverage < 100 &&
    input.bookingRemainingTotal <= 0 &&
    input.decision.reason !==
      'bookings-left'
  ) {
    seeds.push({
      id: 'secondary-payment-coverage',
      kind: 'bookings-left',
      lever: 'payments',
      route: '/payments',
      impactAmount: null,
      impact: 3,
      confidence: 5,
      urgency: 3,
      effort: 2,
      disruption: 1,
      primary: false,
    });
  }

  return dedupeByKind(
    seeds.map(candidate),
  );
}

function byScore(
  left: JahizMoveCandidate,
  right: JahizMoveCandidate,
): number {
  return (
    right.score - left.score ||
    Number(right.primary) -
      Number(left.primary) ||
    left.id.localeCompare(right.id)
  );
}

function byEase(
  left: JahizMoveCandidate,
  right: JahizMoveCandidate,
): number {
  const leftFriction =
    left.effort + left.disruption;
  const rightFriction =
    right.effort + right.disruption;

  return (
    leftFriction - rightFriction ||
    right.score - left.score ||
    left.id.localeCompare(right.id)
  );
}

export function rankJahizMoves(
  candidates: JahizMoveCandidate[],
  limit = 3,
): JahizRankedMove[] {
  if (limit <= 0 || candidates.length === 0) {
    return [];
  }

  const sorted = [
    ...candidates,
  ].sort(byScore);

  const best = sorted[0];

  if (!best) {
    return [];
  }

  const ranked: JahizRankedMove[] = [
    {
      ...best,
      role: 'best-move',
    },
  ];

  if (limit === 1) {
    return ranked;
  }

  const remaining = sorted.slice(1);

  if (remaining.length === 0) {
    return ranked;
  }

  const quick = [
    ...remaining,
  ].sort(byEase)[0];

  if (quick) {
    ranked.push({
      ...quick,
      role: 'quick-win',
    });
  }

  if (ranked.length >= limit) {
    return ranked.slice(0, limit);
  }

  const used = new Set(
    ranked.map((item) => item.id),
  );

  const next = sorted.find(
    (item) => !used.has(item.id),
  );

  if (next) {
    ranked.push({
      ...next,
      role: 'next-move',
    });
  }

  return ranked.slice(0, limit);
}
