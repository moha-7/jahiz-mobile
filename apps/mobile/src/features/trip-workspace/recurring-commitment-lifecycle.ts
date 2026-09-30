import {
  isMonthlyOccurrenceDate,
  tripRecurringCommitmentSchema,
  type TripRecurringCommitment,
} from '@jahiz/api-contracts';

export type RecurringCommitmentPlanPatch =
  Partial<
    Pick<
      TripRecurringCommitment,
      | 'title'
      | 'categoryId'
      | 'amount'
      | 'notes'
    >
  > & {
    firstDueDate?: string;

    // undefined = keep current value
    // null = ongoing / resume
    endDate?: string | null;
  };

function orderedPaidOccurrences(
  item: TripRecurringCommitment,
) {
  return [...item.paidOccurrences].sort(
    (left, right) =>
      left.dueDate.localeCompare(
        right.dueDate,
      ),
  );
}

export function updateRecurringCommitmentPlan(
  item: TripRecurringCommitment,
  patch: RecurringCommitmentPlanPatch,
  currency: string,
  updatedAt: string,
): TripRecurringCommitment | null {
  const {
    firstDueDate,
    endDate,
    ...fields
  } = patch;

  const result =
    tripRecurringCommitmentSchema.safeParse({
      ...item,
      ...fields,
      currency,
      recurrence: {
        cadence: 'monthly',
        firstDueDate:
          firstDueDate ??
          item.recurrence.firstDueDate,

        endDate:
          endDate !== undefined
            ? endDate
            : item.recurrence.endDate,
      },
      // Historical occurrence snapshots are never
      // rewritten by a plan edit.
      paidOccurrences:
        orderedPaidOccurrences(item),
      updatedAt,
    });

  return result.success
    ? result.data
    : null;
}

export function markRecurringOccurrencePaid(
  item: TripRecurringCommitment,
  dueDate: string,
  updatedAt: string,
): TripRecurringCommitment | null {
  if (
    !isMonthlyOccurrenceDate(
      item.recurrence.firstDueDate,
      dueDate,
    )
  ) {
    return null;
  }

  if (
    item.recurrence.endDate !==
      null &&
    dueDate >
      item.recurrence.endDate
  ) {
    return null;
  }

  if (
    item.paidOccurrences.some(
      (occurrence) =>
        occurrence.dueDate === dueDate,
    )
  ) {
    return item;
  }

  return tripRecurringCommitmentSchema.parse({
    ...item,
    paidOccurrences: [
      ...item.paidOccurrences,
      {
        dueDate,
        amount: item.amount,
        paidAmountReflectedInMoney:
          false,
      },
    ].sort(
      (left, right) =>
        left.dueDate.localeCompare(
          right.dueDate,
        ),
    ),
    updatedAt,
  });
}

export function setRecurringOccurrenceMoneyReflected(
  item: TripRecurringCommitment,
  dueDate: string,
  reflected: boolean,
  updatedAt: string,
): TripRecurringCommitment | null {
  const target =
    item.paidOccurrences.find(
      (occurrence) =>
        occurrence.dueDate === dueDate,
    );

  if (!target) {
    return null;
  }

  if (
    target.paidAmountReflectedInMoney ===
    reflected
  ) {
    return item;
  }

  return tripRecurringCommitmentSchema.parse({
    ...item,
    paidOccurrences:
      item.paidOccurrences
        .map(
          (occurrence) =>
            occurrence.dueDate === dueDate
              ? {
                  ...occurrence,
                  paidAmountReflectedInMoney:
                    reflected,
                }
              : occurrence,
        )
        .sort(
          (left, right) =>
            left.dueDate.localeCompare(
              right.dueDate,
            ),
        ),
    updatedAt,
  });
}

export function markRecurringOccurrenceUnpaid(
  item: TripRecurringCommitment,
  dueDate: string,
  updatedAt: string,
): TripRecurringCommitment {
  if (
    !item.paidOccurrences.some(
      (occurrence) =>
        occurrence.dueDate === dueDate,
    )
  ) {
    return item;
  }

  return tripRecurringCommitmentSchema.parse({
    ...item,
    paidOccurrences:
      item.paidOccurrences.filter(
        (occurrence) =>
          occurrence.dueDate !== dueDate,
      ),
    updatedAt,
  });
}
