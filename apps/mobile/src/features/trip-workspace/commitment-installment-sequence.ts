export type CommitmentInstallmentSequenceItem = {
  id: string;
  status: 'paid' | 'unpaid';
  installmentPlanId?: string | null;
  installmentNumber?: number | null;
  installmentCount?: number | null;
};

export function isCommitmentInstallmentStatusTransitionAllowed(
  items: readonly CommitmentInstallmentSequenceItem[],
  targetId: string,
  nextStatus: 'paid' | 'unpaid',
): boolean {
  const target = items.find(
    (item) => item.id === targetId,
  );

  if (!target) {
    return false;
  }

  /*
   * One-time commitments are not ordered installments.
   */
  if (!target.installmentPlanId) {
    return true;
  }

  /*
   * Reflection-only edits to an already paid item must
   * remain possible even if old persisted data is imperfect.
   */
  if (nextStatus === target.status) {
    return true;
  }

  const planItems = items.filter(
    (item) =>
      item.installmentPlanId ===
      target.installmentPlanId,
  );

  const expectedCount =
    target.installmentCount;

  if (
    typeof expectedCount !== 'number' ||
    !Number.isInteger(expectedCount) ||
    expectedCount < 2 ||
    planItems.length !== expectedCount
  ) {
    return false;
  }

  const ordered = [...planItems].sort(
    (left, right) =>
      (left.installmentNumber ?? 0) -
      (right.installmentNumber ?? 0),
  );

  for (
    let index = 0;
    index < ordered.length;
    index += 1
  ) {
    const item = ordered[index];

    if (
      !item ||
      item.installmentCount !==
        expectedCount ||
      item.installmentNumber !==
        index + 1
    ) {
      return false;
    }
  }

  let sawUnpaid = false;

  for (const item of ordered) {
    const status =
      item.id === targetId
        ? nextStatus
        : item.status;

    if (status === 'unpaid') {
      sawUnpaid = true;
      continue;
    }

    if (sawUnpaid) {
      return false;
    }
  }

  return true;
}
