export type RecurringEndMode =
  | 'ongoing'
  | 'date';

export type RecurringEndDateError =
  | 'required'
  | 'beforeFirstDue'
  | 'beforePaid'
  | null;

function isValidIsoDate(
  value: string,
): boolean {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      value,
    )
  ) {
    return false;
  }

  const parsed = new Date(
    value + 'T00:00:00.000Z',
  );

  return (
    !Number.isNaN(
      parsed.getTime(),
    ) &&
    parsed.toISOString().slice(0, 10) ===
      value
  );
}

export function getRecurringCommitmentEndDateError({
  endMode,
  endDate,
  firstDueDate,
  paidDates,
}: {
  endMode: RecurringEndMode;
  endDate: string | null;
  firstDueDate: string | null;
  paidDates: readonly string[];
}): RecurringEndDateError {
  if (
    endMode === 'ongoing'
  ) {
    return null;
  }

  if (
    endDate === null ||
    !isValidIsoDate(endDate)
  ) {
    return 'required';
  }

  if (
    firstDueDate !== null &&
    endDate < firstDueDate
  ) {
    return 'beforeFirstDue';
  }

  if (
    paidDates.some(
      (date) => date > endDate,
    )
  ) {
    return 'beforePaid';
  }

  return null;
}
