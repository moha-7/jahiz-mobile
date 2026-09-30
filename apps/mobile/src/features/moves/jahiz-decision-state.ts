export type JahizTripLifecycle =
  | 'unscheduled'
  | 'pre-trip'
  | 'in-progress'
  | 'last-day'
  | 'completed';

export type JahizDecisionReason =
  | 'overdue-commitment'
  | 'overdue-payment'
  | 'funding-gap'
  | 'bookings-left'
  | 'plan-incomplete'
  | 'review-spending'
  | 'review-moves'
  | 'trip-complete'
  | 'set-dates';

export type JahizDecisionSeverity =
  | 'attention'
  | 'action'
  | 'positive';

export type JahizDecisionAttention = {
  kind: 'commitment' | 'payment';
  id?: string;
  title: string;
  amount: number;
  dueDate: string;
};

export type JahizIncompleteSetupRoute =
  | '/trip/create/route'
  | '/trip/create/dates'
  | '/trip/create/funds'
  | '/trip/create/commitments'
  | '/trip/create/costs';

export type JahizFocusedPaymentRoute =
  `/payments?focus=next-payment&id=${string}`;

export type JahizDecisionStateInput = {
  todayIso: string;
  departureDate: string | null;
  returnDate: string | null;
  planProgress: number;
  nextIncompleteRoute: JahizIncompleteSetupRoute | null;
  needToSave: number;
  bookingRemainingTotal: number;
  paymentPlanCoverage: number;
  onTripBudget: number;
  overdueCommitment: Omit<
    JahizDecisionAttention,
    'kind'
  > | null;
  overduePayment: Omit<
    JahizDecisionAttention,
    'kind'
  > | null;
};

export type JahizDecisionState = {
  lifecycle: JahizTripLifecycle;
  reason: JahizDecisionReason;
  severity: JahizDecisionSeverity;
  route:
    | JahizIncompleteSetupRoute
    | '/payments'
    | JahizFocusedPaymentRoute
    | '/plan'
    | '/moves';
  attention: JahizDecisionAttention | null;
  dayNumber: number | null;
  totalDays: number | null;
  showReadinessScore: boolean;
};

const DAY_MS = 86_400_000;

function isoDayNumber(value: string): number | null {
  const parsed = Date.parse(
    `${value}T00:00:00.000Z`,
  );

  return Number.isNaN(parsed)
    ? null
    : Math.floor(parsed / DAY_MS);
}

function focusedPaymentRoute(
  id: string | undefined,
): JahizDecisionState['route'] {
  return id
    ? `/payments?focus=next-payment&id=${encodeURIComponent(id)}`
    : '/payments';
}

function tripLifecycle(
  todayIso: string,
  departureDate: string | null,
  returnDate: string | null,
): Pick<
  JahizDecisionState,
  | 'lifecycle'
  | 'dayNumber'
  | 'totalDays'
  | 'showReadinessScore'
> {
  if (!departureDate || !returnDate) {
    return {
      lifecycle: 'unscheduled',
      dayNumber: null,
      totalDays: null,
      showReadinessScore: false,
    };
  }

  const today = isoDayNumber(todayIso);
  const departure = isoDayNumber(departureDate);
  const returning = isoDayNumber(returnDate);

  if (
    today === null ||
    departure === null ||
    returning === null ||
    returning < departure
  ) {
    return {
      lifecycle: 'unscheduled',
      dayNumber: null,
      totalDays: null,
      showReadinessScore: false,
    };
  }

  const totalDays =
    returning - departure + 1;

  if (today < departure) {
    return {
      lifecycle: 'pre-trip',
      dayNumber: null,
      totalDays,
      showReadinessScore: true,
    };
  }

  if (today > returning) {
    return {
      lifecycle: 'completed',
      dayNumber: null,
      totalDays,
      showReadinessScore: false,
    };
  }

  const dayNumber =
    today - departure + 1;

  if (today === returning) {
    return {
      lifecycle: 'last-day',
      dayNumber,
      totalDays,
      showReadinessScore: false,
    };
  }

  return {
    lifecycle: 'in-progress',
    dayNumber,
    totalDays,
    showReadinessScore: false,
  };
}

function earliestAttention(
  input: JahizDecisionStateInput,
): JahizDecisionAttention | null {
  const candidates: JahizDecisionAttention[] = [];

  if (input.overdueCommitment) {
    candidates.push({
      kind: 'commitment',
      ...input.overdueCommitment,
    });
  }

  if (input.overduePayment) {
    candidates.push({
      kind: 'payment',
      ...input.overduePayment,
    });
  }

  return (
    candidates.sort(
      (left, right) =>
        left.dueDate.localeCompare(
          right.dueDate,
        ) ||
        left.kind.localeCompare(right.kind),
    )[0] ?? null
  );
}

export function buildJahizDecisionState(
  input: JahizDecisionStateInput,
): JahizDecisionState {
  const lifecycle = tripLifecycle(
    input.todayIso,
    input.departureDate,
    input.returnDate,
  );
  const attention =
    earliestAttention(input);

  if (attention) {
    return {
      ...lifecycle,
      reason:
        attention.kind === 'commitment'
          ? 'overdue-commitment'
          : 'overdue-payment',
      severity: 'attention',
      route:
        attention.kind === 'commitment'
          ? '/trip/create/commitments'
          : focusedPaymentRoute(
              attention.id,
            ),
      attention,
    };
  }

  if (lifecycle.lifecycle === 'unscheduled') {
    if (
      input.nextIncompleteRoute ===
      '/trip/create/route'
    ) {
      return {
        ...lifecycle,
        reason: 'plan-incomplete',
        severity: 'action',
        route: input.nextIncompleteRoute,
        attention: null,
      };
    }

    return {
      ...lifecycle,
      reason: 'set-dates',
      severity: 'action',
      route: '/trip/create/dates',
      attention: null,
    };
  }

  if (lifecycle.lifecycle === 'completed') {
    return {
      ...lifecycle,
      reason: 'trip-complete',
      severity: 'positive',
      route: '/plan',
      attention: null,
    };
  }

  if (lifecycle.lifecycle === 'pre-trip') {
    if (input.planProgress < 100) {
      return {
        ...lifecycle,
        reason: 'plan-incomplete',
        severity: 'action',
        route:
          input.nextIncompleteRoute ??
          '/plan',
        attention: null,
        showReadinessScore: false,
      };
    }

    if (input.needToSave > 0) {
      return {
        ...lifecycle,
        reason: 'funding-gap',
        severity: 'attention',
        route: '/trip/create/funds',
        attention: null,
      };
    }

    if (
      input.bookingRemainingTotal > 0 &&
      input.paymentPlanCoverage < 100
    ) {
      return {
        ...lifecycle,
        reason: 'bookings-left',
        severity: 'action',
        route: '/payments',
        attention: null,
      };
    }

    return {
      ...lifecycle,
      reason: 'review-moves',
      severity: 'positive',
      route: '/moves',
      attention: null,
    };
  }

  if (
    input.bookingRemainingTotal > 0 &&
    input.paymentPlanCoverage < 100
  ) {
    return {
      ...lifecycle,
      reason: 'bookings-left',
      severity: 'action',
      route: '/payments',
      attention: null,
    };
  }

  if (input.onTripBudget > 0) {
    return {
      ...lifecycle,
      reason: 'review-spending',
      severity: 'action',
      route: '/trip/create/costs',
      attention: null,
    };
  }

  return {
    ...lifecycle,
    reason: 'review-moves',
    severity: 'positive',
    route: '/moves',
    attention: null,
  };
}
