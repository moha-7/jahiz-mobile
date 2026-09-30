import type {
  TripStepKey,
} from '@jahiz/api-contracts';
import {
  isPaymentTrackableCost,
  selectOverdueCommitmentDueItem,
  selectWorkspaceSummary,
} from '@/features/trip-workspace';
import {
  buildJahizDecisionState,
  type JahizDecisionState,
  type JahizIncompleteSetupRoute,
} from './jahiz-decision-state';

export type JahizDecisionWorkspace =
  Parameters<typeof selectWorkspaceSummary>[0];

type JahizDecisionSummary = ReturnType<
  typeof selectWorkspaceSummary
>;

export type JahizDecisionContext = {
  summary: JahizDecisionSummary;
  decision: JahizDecisionState;
  spendingTotal: number;
  bookingRemainingTotal: number;
  paymentPlanCoverage: number;
};

function setupRouteForStep(
  key: TripStepKey,
): JahizIncompleteSetupRoute | null {
  switch (key) {
    case 'route':
      return '/trip/create/route';
    case 'dates':
      return '/trip/create/dates';
    case 'funds':
      return '/trip/create/funds';
    case 'commitments':
      return '/trip/create/commitments';
    case 'costs':
      return '/trip/create/costs';
    case 'payments':
    case 'review':
      return null;
  }
}

export function selectNextIncompleteSetupRoute(
  steps: JahizDecisionSummary['steps'],
): JahizIncompleteSetupRoute | null {
  for (const step of steps) {
    if (
      !step.required ||
      step.status === 'complete'
    ) {
      continue;
    }

    const route = setupRouteForStep(
      step.key,
    );

    if (route) {
      return route;
    }
  }

  return null;
}

export function buildJahizDecisionContext(
  workspace: JahizDecisionWorkspace,
  todayIso: string,
  paymentFallbackTitle: string,
): JahizDecisionContext {
  const summary =
    selectWorkspaceSummary(workspace);
  const nextIncompleteRoute =
    selectNextIncompleteSetupRoute(
      summary.steps,
    );

  const trackedBookings =
    workspace.costItems.filter(
      isPaymentTrackableCost,
    );

  const trackedCostIds = new Set(
    trackedBookings.map((item) => item.id),
  );

  const trackedBookingTotal =
    trackedBookings.reduce(
      (sum, item) =>
        sum + item.amount,
      0,
    );

  const spendingTotal =
    workspace.costItems
      .filter(
        (item) =>
          !isPaymentTrackableCost(item),
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        0,
      );

  const scheduledTrackedTotal =
    workspace.payments.reduce(
      (sum, payment) =>
        payment.status === 'scheduled' &&
        trackedCostIds.has(
          payment.costItemId,
        )
          ? sum + payment.amount
          : sum,
      0,
    );

  const bookingRemainingTotal =
    Math.max(
      0,
      trackedBookingTotal -
        summary.paidTotal,
    );

  const allocatedBookingTotal =
    Math.min(
      trackedBookingTotal,
      summary.paidTotal +
        scheduledTrackedTotal,
    );

  const paymentPlanCoverage =
    trackedBookingTotal > 0
      ? Math.min(
          100,
          Math.round(
            (allocatedBookingTotal /
              trackedBookingTotal) *
              100,
          ),
        )
      : 100;

  const overdueCommitment =
    selectOverdueCommitmentDueItem(
      workspace,
      todayIso,
    );

  const overdueTrackedPayment =
    workspace.payments
      .filter(
        (payment) =>
          payment.status === 'scheduled' &&
          payment.dueDate &&
          payment.dueDate < todayIso &&
          trackedCostIds.has(
            payment.costItemId,
          ),
      )
      .sort(
        (left, right) =>
          String(left.dueDate).localeCompare(
            String(right.dueDate),
          ),
      )[0] ?? null;

  const overduePaymentCost =
    overdueTrackedPayment
      ? workspace.costItems.find(
          (item) =>
            item.id ===
            overdueTrackedPayment.costItemId,
        ) ?? null
      : null;

  const decision =
    buildJahizDecisionState({
      todayIso,
      departureDate:
        workspace.dates.departureDate,
      returnDate:
        workspace.dates.returnDate,
      planProgress:
        summary.progress.percentage,
      nextIncompleteRoute,
      needToSave: summary.needToSave,
      bookingRemainingTotal,
      paymentPlanCoverage,
      onTripBudget: spendingTotal,
      overdueCommitment:
        overdueCommitment?.dueDate
          ? {
              title:
                overdueCommitment.title,
              amount:
                overdueCommitment.amount,
              dueDate:
                overdueCommitment.dueDate,
            }
          : null,
      overduePayment:
        overdueTrackedPayment?.dueDate
          ? {
              id:
                overdueTrackedPayment.id,
              title:
                overduePaymentCost?.title ??
                paymentFallbackTitle,
              amount:
                overdueTrackedPayment.amount,
              dueDate:
                overdueTrackedPayment.dueDate,
            }
          : null,
    });

  return {
    summary,
    decision,
    spendingTotal,
    bookingRemainingTotal,
    paymentPlanCoverage,
  };
}
