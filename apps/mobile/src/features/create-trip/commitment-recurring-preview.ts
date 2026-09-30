import {
  expandMonthlyDates,
  type TripRecurringCommitment,
} from '@jahiz/api-contracts';

export type RecurringCommitmentWindowPreview = {
  occurrenceDates: string[];
  count: number;

  // Total scheduled obligation through return,
  // including already-paid occurrences.
  total: number;

  // Financial amount that still affects Ready Money:
  // unpaid + paid but not reflected in Money.
  countedTotal: number;

  paidCount: number;
  nextUnpaidDate: string | null;
};

export type RecurringCommitmentPreviewInput = {
  firstDueDate: string;
  amount: number;
  returnDate: string | null;

  // null / omitted means ongoing.
  endDate?: string | null;

  paidOccurrences?:
    TripRecurringCommitment['paidOccurrences'];
};

export type RecurringCommitmentOccurrencePreview = {
  dueDate: string;
  amount: number;
  status:
    | 'unpaid'
    | 'paid-counted'
    | 'paid-reflected';
};

function roundMoney(
  value: number,
): number {
  return (
    Math.round(value * 100) /
    100
  );
}

export function buildRecurringCommitmentWindowPreview({
  firstDueDate,
  amount,
  returnDate,
  endDate = null,
  paidOccurrences = [],
}: RecurringCommitmentPreviewInput): RecurringCommitmentWindowPreview | null {
  if (!returnDate) {
    return null;
  }

  const effectiveHorizon =
    endDate !== null &&
    endDate < returnDate
      ? endDate
      : returnDate;

  const occurrenceDates =
    expandMonthlyDates(
      firstDueDate,
      effectiveHorizon,
    );

  const paidByDate =
    new Map(
      paidOccurrences.map(
        (occurrence) => [
          occurrence.dueDate,
          occurrence,
        ],
      ),
    );

  let total = 0;
  let countedTotal = 0;
  let paidCount = 0;
  let nextUnpaidDate:
    string | null = null;

  for (
    const dueDate of
    occurrenceDates
  ) {
    const paidOccurrence =
      paidByDate.get(dueDate);

    const occurrenceAmount =
      paidOccurrence?.amount ??
      amount;

    total += occurrenceAmount;

    if (paidOccurrence) {
      paidCount += 1;

      if (
        paidOccurrence
          .paidAmountReflectedInMoney !==
        true
      ) {
        countedTotal +=
          occurrenceAmount;
      }

      continue;
    }

    countedTotal +=
      occurrenceAmount;

    if (!nextUnpaidDate) {
      nextUnpaidDate =
        dueDate;
    }
  }

  return {
    occurrenceDates,
    count:
      occurrenceDates.length,
    total:
      roundMoney(total),
    countedTotal:
      roundMoney(
        countedTotal,
      ),
    paidCount,
    nextUnpaidDate,
  };
}

export function buildRecurringCommitmentOccurrencePreview({
  firstDueDate,
  amount,
  returnDate,
  endDate = null,
  paidOccurrences = [],
}: RecurringCommitmentPreviewInput):
  RecurringCommitmentOccurrencePreview[] | null {
  const window =
    buildRecurringCommitmentWindowPreview({
      firstDueDate,
      amount,
      returnDate,
      endDate,
      paidOccurrences,
    });

  if (!window) {
    return null;
  }

  const paidByDate =
    new Map(
      paidOccurrences.map(
        (occurrence) => [
          occurrence.dueDate,
          occurrence,
        ],
      ),
    );

  return window.occurrenceDates.map(
    (dueDate) => {
      const paidOccurrence =
        paidByDate.get(dueDate);

      if (!paidOccurrence) {
        return {
          dueDate,
          amount,
          status:
            'unpaid' as const,
        };
      }

      return {
        dueDate,
        amount:
          paidOccurrence.amount,
        status:
          paidOccurrence
            .paidAmountReflectedInMoney ===
          true
            ? 'paid-reflected' as const
            : 'paid-counted' as const,
      };
    },
  );
}
