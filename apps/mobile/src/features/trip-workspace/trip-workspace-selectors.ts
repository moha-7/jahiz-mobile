import {
  buildFinancialTimeline,
  expandMonthlyDates,
  summarizeFinancialTimeline,
  type TripCommitmentCategoryId,
  type TripCommitmentInstallmentCadence,
  type TripCommitmentItem,
  type TripPayment,
  type TripStepKey,
  type TripStepStatus,
  type TripWorkspace,
} from '@jahiz/api-contracts';
import { isPaymentTrackableCost } from './trip-cost-payment-policy';
import { localCalendarIso } from './jahiz-local-date';

export type TripStepSummary = {
  key: TripStepKey;
  status: TripStepStatus;
  required: boolean;
};

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}


function usesStructuredMoneyIn(workspace: TripWorkspace): boolean {
  return (
    workspace.moneyInReviewed ||
    workspace.moneyInItems.length > 0
  );
}

function moneyTimelineWithAllSources(
  workspace: TripWorkspace,
) {
  return buildFinancialTimeline({
    ...workspace,
    moneyInItems:
      workspace.moneyInItems.map(
        (item) => ({
          ...item,
          includeInReadiness: true,
        }),
      ),
  });
}

export function selectAvailableNowMoneyInTotal(
  workspace: TripWorkspace,
): number {
  if (!usesStructuredMoneyIn(workspace)) {
    return roundMoney(workspace.funds.availableNow ?? 0);
  }

  return roundMoney(
    workspace.moneyInItems
      .filter(
        (item) =>
          item.availability ===
            'available-now' &&
          !item.recurrence,
      )
      .reduce((sum, item) => sum + item.amount, 0),
  );
}

export function selectExpectedBeforeTravelMoneyInTotal(
  workspace: TripWorkspace,
): number {
  if (!usesStructuredMoneyIn(workspace)) {
    return roundMoney(workspace.funds.expectedBeforeTravel);
  }

  return roundMoney(
    moneyTimelineWithAllSources(
      workspace,
    )
      .filter(
        (event) =>
          event.kind === 'money-in' &&
          event.timing === 'before-trip' &&
          event.dateConfidence !== 'on-hand',
      )
      .reduce(
        (sum, event) =>
          sum + event.amount,
        0,
      ),
  );
}

export function selectExpectedByReturnMoneyInTotal(
  workspace: TripWorkspace,
): number {
  if (!usesStructuredMoneyIn(workspace)) {
    return roundMoney(
      workspace.funds.expectedBeforeTravel,
    );
  }

  const includeDuringTrip =
    hasValidDates(workspace);

  return roundMoney(
    moneyTimelineWithAllSources(
      workspace,
    )
      .filter(
        (event) =>
          event.kind === 'money-in' &&
          event.dateConfidence !== 'on-hand' &&
          (
            event.timing === 'before-trip' ||
            (
              includeDuringTrip &&
              event.timing === 'during-trip'
            )
          ),
      )
      .reduce(
        (sum, event) =>
          sum + event.amount,
        0,
      ),
  );
}

export function selectExpectedAfterTravelMoneyInTotal(
  workspace: TripWorkspace,
): number {
  if (!usesStructuredMoneyIn(workspace)) {
    return roundMoney(workspace.funds.expectedAfterTravel);
  }

  return roundMoney(
    workspace.moneyInItems
      .filter(
        (item) =>
          item.availability === 'expected' &&
          item.expectedTiming === 'after-travel',
      )
      .reduce((sum, item) => sum + item.amount, 0),
  );
}

export function selectGuaranteedMoneyInTotal(
  workspace: TripWorkspace,
): number {
  if (!usesStructuredMoneyIn(workspace)) {
    return roundMoney(workspace.funds.availableNow ?? 0);
  }

  return roundMoney(
    workspace.moneyInItems
      .filter((item) => item.certainty === 'guaranteed')
      .reduce((sum, item) => sum + item.amount, 0),
  );
}

export function selectNonGuaranteedMoneyInTotal(
  workspace: TripWorkspace,
): number {
  if (!usesStructuredMoneyIn(workspace)) {
    return roundMoney(
      workspace.funds.expectedBeforeTravel +
        workspace.funds.expectedAfterTravel,
    );
  }

  return roundMoney(
    workspace.moneyInItems
      .filter((item) => item.certainty === 'non-guaranteed')
      .reduce((sum, item) => sum + item.amount, 0),
  );
}

export function selectUsableTripMoneyTotal(
  workspace: TripWorkspace,
): number {
  if (!usesStructuredMoneyIn(workspace)) {
    return roundMoney(
      (workspace.funds.availableNow ?? 0) +
        workspace.funds.expectedBeforeTravel,
    );
  }

  const summary = summarizeFinancialTimeline(
    buildFinancialTimeline(
      workspace,
    ),
  );

  return roundMoney(
    summary.inflowBeforeTrip +
      (
        hasValidDates(workspace)
          ? summary.inflowDuringTrip
          : 0
      ),
  );
}

export function selectTotalCost(workspace: TripWorkspace): number {
  return roundMoney(
    workspace.costItems.reduce(
      (sum, item) => sum + item.amount,
      0,
    ),
  );
}

function paymentTrackableCostIds(
  workspace: TripWorkspace,
): Set<string> {
  return new Set(
    workspace.costItems
      .filter(isPaymentTrackableCost)
      .map((item) => item.id),
  );
}

export function selectPaidTotal(workspace: TripWorkspace): number {
  const trackableCostIds =
    paymentTrackableCostIds(workspace);

  return roundMoney(
    workspace.payments
      .filter(
        (payment) =>
          payment.status === 'paid' &&
          trackableCostIds.has(payment.costItemId),
      )
      .reduce((sum, payment) => sum + payment.amount, 0),
  );
}

export function selectRemainingTotal(
  workspace: TripWorkspace,
): number {
  return roundMoney(
    Math.max(0, selectTotalCost(workspace) - selectPaidTotal(workspace)),
  );
}

function legacyCommitmentAmount(
  workspace: TripWorkspace,
): number {
  return (
    workspace.commitments.length === 0 &&
    workspace.recurringCommitments.length === 0
  )
    ? workspace.funds.originCommitments
    : 0;
}

export function isCommitmentDueBeforeTravel(
  workspace: TripWorkspace,
  item: TripCommitmentItem,
): boolean {
  if (
    item.dueDate &&
    workspace.dates.departureDate
  ) {
    return (
      item.dueDate <=
      workspace.dates.departureDate
    );
  }

  return item.dueBeforeTravel;
}

export function isCommitmentDueDuringTrip(
  workspace: TripWorkspace,
  item: TripCommitmentItem,
): boolean {
  if (
    !hasValidDates(workspace) ||
    !item.dueDate ||
    !workspace.dates.departureDate ||
    !workspace.dates.returnDate
  ) {
    return false;
  }

  return (
    item.dueDate >
      workspace.dates.departureDate &&
    item.dueDate <=
      workspace.dates.returnDate
  );
}

export type TripRecurringCommitmentOccurrenceReadModel = {
  id: string;
  sourceId: string;
  title: string;
  categoryId: TripCommitmentCategoryId;
  amount: number;
  dueDate: string;
  occurrenceIndex: number;
  status: 'paid' | 'unpaid';
  paidAmountReflectedInMoney: boolean;
};

export type TripCommitmentDueItem = {
  id: string;
  occurrenceKey: string;
  sourceKind: 'regular' | 'recurring';
  title: string;
  categoryId: TripCommitmentCategoryId;
  amount: number;
  dueDate: string;
};

export function selectRecurringCommitmentOccurrencesThrough(
  workspace: TripWorkspace,
  throughDate: string,
): TripRecurringCommitmentOccurrenceReadModel[] {
  return workspace.recurringCommitments
    .flatMap((item) => {
      const paidByDate =
        new Map(
          item.paidOccurrences.map(
            (occurrence) => [
              occurrence.dueDate,
              occurrence,
            ],
          ),
        );

      const effectiveThroughDate =
        item.recurrence.endDate !== null &&
        item.recurrence.endDate <
          throughDate
          ? item.recurrence.endDate
          : throughDate;

      return expandMonthlyDates(
        item.recurrence.firstDueDate,
        effectiveThroughDate,
      ).map(
        (dueDate, index) => {
          const paidOccurrence =
            paidByDate.get(dueDate);

          return {
            id:
              'recurring-commitment:' +
              item.id +
              ':' +
              dueDate,
            sourceId: item.id,
            title: item.title,
            categoryId: item.categoryId,
            amount:
              paidOccurrence?.amount ??
              item.amount,
            dueDate,
            occurrenceIndex:
              index + 1,
            status:
              paidOccurrence
                ? ('paid' as const)
                : ('unpaid' as const),
            paidAmountReflectedInMoney:
              paidOccurrence
                ?.paidAmountReflectedInMoney ===
              true,
          };
        },
      );
    })
    .sort(
      (left, right) =>
        left.dueDate.localeCompare(
          right.dueDate,
        ),
    );
}

export type TripCommitmentInstallmentPlanSummary = {
  planId: string;
  title: string;
  categoryId: TripCommitmentCategoryId;
  cadence: TripCommitmentInstallmentCadence;
  installmentCount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  dueBeforeTravelAmount: number;
  paidCount: number;
  unpaidCount: number;
  nextDueDate: string | null;
  items: TripCommitmentItem[];
};

export function selectCommitmentDisplayCount(
  workspace: TripWorkspace,
): number {
  const planIds = new Set(
    workspace.commitments
      .map((item) => item.installmentPlanId)
      .filter(
        (value): value is string =>
          Boolean(value),
      ),
  );
  const regularCount =
    workspace.commitments.filter(
      (item) => !item.installmentPlanId,
    ).length;

  return (
    regularCount +
    planIds.size +
    workspace.recurringCommitments.length
  );
}

export function selectCommitmentInstallmentPlans(
  workspace: TripWorkspace,
): TripCommitmentInstallmentPlanSummary[] {
  const groups = new Map<
    string,
    TripCommitmentItem[]
  >();

  for (const item of workspace.commitments) {
    if (!item.installmentPlanId) {
      continue;
    }

    const group =
      groups.get(item.installmentPlanId) ?? [];
    group.push(item);
    groups.set(item.installmentPlanId, group);
  }

  return [...groups.entries()]
    .map(([planId, group]) => {
      const items = [...group].sort(
        (left, right) =>
          (left.installmentNumber ?? 0) -
            (right.installmentNumber ?? 0) ||
          String(left.dueDate).localeCompare(
            String(right.dueDate),
          ),
      );
      const first = items[0];

      if (
        !first ||
        !first.installmentCadence ||
        !first.installmentCount
      ) {
        return null;
      }

      const paidItems = items.filter(
        (item) => item.status === 'paid',
      );
      const unpaidItems = items.filter(
        (item) => item.status === 'unpaid',
      );
      const totalAmount = roundMoney(
        items.reduce(
          (sum, item) => sum + item.amount,
          0,
        ),
      );
      const paidAmount = roundMoney(
        paidItems.reduce(
          (sum, item) => sum + item.amount,
          0,
        ),
      );
      const dueBeforeTravelAmount =
        roundMoney(
          unpaidItems
            .filter((item) =>
              isCommitmentDueBeforeTravel(
                workspace,
                item,
              ),
            )
            .reduce(
              (sum, item) =>
                sum + item.amount,
              0,
            ),
        );
      const nextDueDate =
        unpaidItems
          .filter((item) => item.dueDate)
          .sort((left, right) =>
            String(left.dueDate).localeCompare(
              String(right.dueDate),
            ),
          )[0]?.dueDate ?? null;

      return {
        planId,
        title: first.title,
        categoryId: first.categoryId,
        cadence: first.installmentCadence,
        installmentCount:
          first.installmentCount,
        totalAmount,
        paidAmount,
        remainingAmount: roundMoney(
          Math.max(
            0,
            totalAmount - paidAmount,
          ),
        ),
        dueBeforeTravelAmount,
        paidCount: paidItems.length,
        unpaidCount: unpaidItems.length,
        nextDueDate,
        items,
      };
    })
    .filter(
      (
        plan,
      ): plan is TripCommitmentInstallmentPlanSummary =>
        plan !== null,
    )
    .sort((left, right) =>
      String(
        left.nextDueDate ?? '9999-12-31',
      ).localeCompare(
        String(
          right.nextDueDate ?? '9999-12-31',
        ),
      ),
    );
}

export function selectPaidPendingCountedCommitmentsTotal(
  workspace: TripWorkspace,
): number {
  const regularPaidPending =
    workspace.commitments
      .filter(
        (item) =>
          item.status === 'paid' &&
          item.paidAmountReflectedInMoney !== true,
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        0,
      );

  const recurringPaidPending =
    workspace.recurringCommitments
      .flatMap(
        (item) =>
          item.paidOccurrences,
      )
      .filter(
        (occurrence) =>
          occurrence
            .paidAmountReflectedInMoney !==
          true,
      )
      .reduce(
        (sum, occurrence) =>
          sum + occurrence.amount,
        0,
      );

  return roundMoney(
    regularPaidPending +
    recurringPaidPending,
  );
}

export function selectTripWindowUnpaidCommitmentsTotal(
  workspace: TripWorkspace,
): number {
  const regularTotal =
    workspace.commitments
      .filter(
        (item) =>
          item.status === 'unpaid' &&
          (
            isCommitmentDueBeforeTravel(
              workspace,
              item,
            ) ||
            isCommitmentDueDuringTrip(
              workspace,
              item,
            )
          ),
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        legacyCommitmentAmount(workspace),
      );

  const horizon =
    hasValidDates(workspace)
      ? workspace.dates.returnDate
      : workspace.dates.departureDate;

  const recurringTotal =
    horizon
      ? selectRecurringCommitmentOccurrencesThrough(
          workspace,
          horizon,
        )
          .filter(
            (item) =>
              item.status === 'unpaid',
          )
          .reduce(
            (sum, item) =>
              sum + item.amount,
            0,
          )
      : 0;

  return roundMoney(
    regularTotal +
    recurringTotal,
  );
}

// Finite-only compatibility selector.
// Open-ended recurring obligations must use
// a date-bounded selector.
export function selectUnpaidCommitmentsTotal(
  workspace: TripWorkspace,
): number {
  return roundMoney(
    workspace.commitments
      .filter((item) => item.status === 'unpaid')
      .reduce(
        (sum, item) => sum + item.amount,
        legacyCommitmentAmount(workspace),
      ),
  );
}

export function selectBeforeTravelCommitmentsTotal(
  workspace: TripWorkspace,
): number {
  const regularTotal =
    workspace.commitments
      .filter(
        (item) =>
          (
            item.status === 'paid' &&
            item.paidAmountReflectedInMoney !== true
          ) ||
          (
            item.status === 'unpaid' &&
            isCommitmentDueBeforeTravel(
              workspace,
              item,
            )
          ),
      )
      .reduce(
        (sum, item) =>
          sum + item.amount,
        legacyCommitmentAmount(workspace),
      );

  const recurringPaidPending =
    workspace.recurringCommitments
      .flatMap(
        (item) =>
          item.paidOccurrences,
      )
      .filter(
        (occurrence) =>
          occurrence
            .paidAmountReflectedInMoney !==
          true,
      )
      .reduce(
        (sum, occurrence) =>
          sum + occurrence.amount,
        0,
      );

  const departureDate =
    workspace.dates.departureDate;

  const recurringUnpaidBefore =
    departureDate
      ? selectRecurringCommitmentOccurrencesThrough(
          workspace,
          departureDate,
        )
          .filter(
            (item) =>
              item.status === 'unpaid',
          )
          .reduce(
            (sum, item) =>
              sum + item.amount,
            0,
          )
      : 0;

  return roundMoney(
    regularTotal +
    recurringPaidPending +
    recurringUnpaidBefore,
  );
}

export function selectTripWindowCommitmentsTotal(
  workspace: TripWorkspace,
): number {
  if (!hasValidDates(workspace)) {
    return selectBeforeTravelCommitmentsTotal(
      workspace,
    );
  }

  return roundMoney(
    buildFinancialTimeline(workspace)
      .filter(
        (event) =>
          event.kind === 'commitment' &&
          (
            event.timing === 'before-trip' ||
            event.timing === 'during-trip'
          ),
      )
      .reduce(
        (sum, event) =>
          sum + event.amount,
        0,
      ),
  );
}

export function selectNextCommitment(
  workspace: TripWorkspace,
): TripCommitmentItem | null {
  const upcoming = workspace.commitments
    .filter(
      (item) =>
        item.status === 'unpaid' &&
        item.dueDate &&
        isCommitmentDueBeforeTravel(
          workspace,
          item,
        ),
    )
    .sort((left, right) =>
      String(left.dueDate).localeCompare(
        String(right.dueDate),
      ),
    );

  return upcoming[0] ?? null;
}

export function selectNextTripWindowCommitment(
  workspace: TripWorkspace,
): TripCommitmentItem | null {
  const upcoming = workspace.commitments
    .filter(
      (item) =>
        item.status === 'unpaid' &&
        Boolean(item.dueDate) &&
        (
          isCommitmentDueBeforeTravel(
            workspace,
            item,
          ) ||
          isCommitmentDueDuringTrip(
            workspace,
            item,
          )
        ),
    )
    .sort((left, right) =>
      String(left.dueDate).localeCompare(
        String(right.dueDate),
      ),
    );

  return upcoming[0] ?? null;
}


export type TripCommitmentDueGroup = {
  dueDate: string;
  totalAmount: number;
  itemCount: number;
  items: TripCommitmentDueItem[];
};

export function selectNextTripWindowCommitmentGroup(
  workspace: TripWorkspace,
): TripCommitmentDueGroup | null {
  const regularUpcoming:
    TripCommitmentDueItem[] =
    workspace.commitments
      .filter(
        (item) =>
          item.status === 'unpaid' &&
          Boolean(item.dueDate) &&
          (
            isCommitmentDueBeforeTravel(
              workspace,
              item,
            ) ||
            isCommitmentDueDuringTrip(
              workspace,
              item,
            )
          ),
      )
      .map(
        (item) => ({
          id: item.id,
          occurrenceKey:
            'regular:' + item.id,
          sourceKind: 'regular',
          title: item.title,
          categoryId: item.categoryId,
          amount: item.amount,
          dueDate: item.dueDate!,
        }),
      );

  const horizon =
    hasValidDates(workspace)
      ? workspace.dates.returnDate
      : workspace.dates.departureDate;

  const recurringUpcoming:
    TripCommitmentDueItem[] =
    horizon
      ? selectRecurringCommitmentOccurrencesThrough(
          workspace,
          horizon,
        )
          .filter(
            (item) =>
              item.status === 'unpaid',
          )
          .map(
            (item) => ({
              id: item.sourceId,
              occurrenceKey: item.id,
              sourceKind:
                'recurring',
              title: item.title,
              categoryId:
                item.categoryId,
              amount: item.amount,
              dueDate: item.dueDate,
            }),
          )
      : [];

  const upcoming = [
    ...regularUpcoming,
    ...recurringUpcoming,
  ].sort(
    (left, right) =>
      left.dueDate.localeCompare(
        right.dueDate,
      ),
  );

  const dueDate =
    upcoming[0]?.dueDate ?? null;

  if (!dueDate) {
    return null;
  }

  const items =
    upcoming.filter(
      (item) =>
        item.dueDate === dueDate,
    );

  return {
    dueDate,
    totalAmount: roundMoney(
      items.reduce(
        (sum, item) =>
          sum + item.amount,
        0,
      ),
    ),
    itemCount: items.length,
    items,
  };
}

export function selectOverdueCommitmentDueItem(
  workspace: TripWorkspace,
  todayIso: string,
): TripCommitmentDueItem | null {
  const regularOverdue:
    TripCommitmentDueItem[] =
    workspace.commitments
      .filter(
        (item) =>
          item.status === 'unpaid' &&
          Boolean(item.dueDate) &&
          item.dueDate! < todayIso,
      )
      .map(
        (item) => ({
          id: item.id,
          occurrenceKey:
            'regular:' + item.id,
          sourceKind: 'regular',
          title: item.title,
          categoryId: item.categoryId,
          amount: item.amount,
          dueDate: item.dueDate!,
        }),
      );

  const recurringOverdue =
    selectRecurringCommitmentOccurrencesThrough(
      workspace,
      todayIso,
    )
      .filter(
        (item) =>
          item.status === 'unpaid' &&
          item.dueDate < todayIso,
      )
      .map(
        (item): TripCommitmentDueItem => ({
          id: item.sourceId,
          occurrenceKey: item.id,
          sourceKind: 'recurring',
          title: item.title,
          categoryId: item.categoryId,
          amount: item.amount,
          dueDate: item.dueDate,
        }),
      );

  return (
    [
      ...regularOverdue,
      ...recurringOverdue,
    ].sort(
      (left, right) =>
        left.dueDate.localeCompare(
          right.dueDate,
        ),
    )[0] ?? null
  );
}

export function selectReadyMoney(workspace: TripWorkspace): number {
  return roundMoney(
    selectUsableTripMoneyTotal(workspace) -
      workspace.funds.safetyReserve -
      selectTripWindowCommitmentsTotal(workspace),
  );
}

export type ReadyMoneyBreakdown = {
  usableThroughReturn: number;
  safetyReserve: number;
  commitmentsThroughReturn: number;
  readyMoney: number;
};

export function selectReadyMoneyBreakdown(
  workspace: TripWorkspace,
): ReadyMoneyBreakdown {
  const usableThroughReturn =
    selectUsableTripMoneyTotal(
      workspace,
    );
  const safetyReserve =
    roundMoney(
      workspace.funds.safetyReserve,
    );
  const commitmentsThroughReturn =
    selectTripWindowCommitmentsTotal(
      workspace,
    );

  return {
    usableThroughReturn,
    safetyReserve,
    commitmentsThroughReturn,
    readyMoney: roundMoney(
      usableThroughReturn -
        safetyReserve -
        commitmentsThroughReturn,
    ),
  };
}

export function selectNeedToSave(workspace: TripWorkspace): number {
  return roundMoney(
    Math.max(
      0,
      selectRemainingTotal(workspace) - selectReadyMoney(workspace),
    ),
  );
}

export function selectNextPayment(
  workspace: TripWorkspace,
): TripPayment | null {
  const trackableCostIds =
    paymentTrackableCostIds(workspace);
  const upcoming = workspace.payments
    .filter(
      (payment) =>
        payment.status === 'scheduled' &&
        payment.dueDate &&
        trackableCostIds.has(payment.costItemId),
    )
    .sort((left, right) =>
      String(left.dueDate).localeCompare(String(right.dueDate)),
    );

  return upcoming[0] ?? null;
}

function hasValidDates(workspace: TripWorkspace): boolean {
  const { departureDate, returnDate } = workspace.dates;

  return Boolean(
    departureDate &&
      returnDate &&
      returnDate >= departureDate,
  );
}

function commitmentStatus(
  workspace: TripWorkspace,
): TripStepStatus {
  if (!workspace.commitmentsReviewed) {
    return 'incomplete';
  }

  const today =
    localCalendarIso();

  const hasOverdue =
    selectOverdueCommitmentDueItem(
      workspace,
      today,
    ) !== null;

  if (hasOverdue) {
    return 'attention';
  }

  const needsDateReview =
    workspace.commitments
      .filter(
        (item) =>
          item.status === 'unpaid',
      )
      .some(
        (item) =>
          isCommitmentDueBeforeTravel(
            workspace,
            item,
          ) &&
          !item.dueDate,
      );

  return needsDateReview
    ? 'needs_review'
    : 'complete';
}

function paymentStatus(workspace: TripWorkspace): TripStepStatus {
  const trackableCostIds =
    paymentTrackableCostIds(workspace);
  const trackedPayments = workspace.payments.filter(
    (payment) =>
      trackableCostIds.has(payment.costItemId),
  );

  if (trackableCostIds.size === 0) return 'optional';
  if (trackedPayments.length === 0) return 'optional';

  const today = localCalendarIso();
  const hasOverdue = trackedPayments.some(
    (payment) =>
      payment.status === 'scheduled' &&
      payment.dueDate &&
      payment.dueDate < today,
  );

  return hasOverdue ? 'attention' : 'complete';
}

export function selectTripSteps(
  workspace: TripWorkspace,
): TripStepSummary[] {
  const routeComplete = workspace.route !== null;
  const datesComplete = hasValidDates(workspace);
  const fundsComplete = workspace.moneyInReviewed;
  const commitmentsStatus =
    commitmentStatus(workspace);
  const costsComplete =
    workspace.costsReviewed === true &&
    workspace.costItems.length > 0;
  const paymentsStatus = paymentStatus(workspace);
  const coreComplete =
    routeComplete &&
    datesComplete &&
    fundsComplete &&
    commitmentsStatus === 'complete' &&
    costsComplete;

  return [
    {
      key: 'route',
      status: routeComplete ? 'complete' : 'incomplete',
      required: true,
    },
    {
      key: 'dates',
      status: datesComplete ? 'complete' : 'incomplete',
      required: true,
    },
    {
      key: 'funds',
      status: fundsComplete ? 'complete' : 'incomplete',
      required: true,
    },
    {
      key: 'commitments',
      status: commitmentsStatus,
      required: true,
    },
    {
      key: 'costs',
      status: costsComplete ? 'complete' : 'incomplete',
      required: true,
    },
    {
      key: 'payments',
      status: paymentsStatus,
      required: false,
    },
    {
      key: 'review',
      status: coreComplete
        ? paymentsStatus === 'attention'
          ? 'needs_review'
          : 'complete'
        : routeComplete
          ? 'needs_review'
          : 'incomplete',
      required: true,
    },
  ];
}

export function selectTripProgress(workspace: TripWorkspace): {
  completed: number;
  total: number;
  percentage: number;
} {
  const requiredSetupSteps = selectTripSteps(workspace).filter(
    (step) =>
      step.required &&
      step.key !== 'review',
  );
  const completed = requiredSetupSteps.filter(
    (step) => step.status === 'complete',
  ).length;
  const total = requiredSetupSteps.length;

  return {
    completed,
    total,
    percentage:
      total === 0 ? 0 : Math.round((completed / total) * 100),
  };
}

export function selectWorkspaceSummary(workspace: TripWorkspace) {
  return {
    currency: workspace.currency,
    totalCost: selectTotalCost(workspace),
    paidTotal: selectPaidTotal(workspace),
    remainingTotal: selectRemainingTotal(workspace),
    availableNowMoneyInTotal:
      selectAvailableNowMoneyInTotal(workspace),
    expectedBeforeTravelMoneyInTotal:
      selectExpectedBeforeTravelMoneyInTotal(workspace),
    expectedAfterTravelMoneyInTotal:
      selectExpectedAfterTravelMoneyInTotal(workspace),
    guaranteedMoneyInTotal:
      selectGuaranteedMoneyInTotal(workspace),
    nonGuaranteedMoneyInTotal:
      selectNonGuaranteedMoneyInTotal(workspace),
    usableTripMoneyTotal:
      selectUsableTripMoneyTotal(workspace),
    readyMoney: selectReadyMoney(workspace),
    needToSave: selectNeedToSave(workspace),
    unpaidCommitmentsTotal:
      selectUnpaidCommitmentsTotal(workspace),
    tripWindowUnpaidCommitmentsTotal:
      selectTripWindowUnpaidCommitmentsTotal(
        workspace,
      ),
    paidPendingCountedCommitmentsTotal:
      selectPaidPendingCountedCommitmentsTotal(
        workspace,
      ),
    beforeTravelCommitmentsTotal:
      selectBeforeTravelCommitmentsTotal(workspace),
    nextTripWindowCommitmentGroup:
      selectNextTripWindowCommitmentGroup(
        workspace,
      ),
    nextCommitment: selectNextCommitment(workspace),
    nextPayment: selectNextPayment(workspace),
    progress: selectTripProgress(workspace),
    steps: selectTripSteps(workspace),
  };
}
