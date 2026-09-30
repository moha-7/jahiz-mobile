// Safaryaty canonical finance ledger semantics.
// This module contains no provider, database, React, or currency-network code.
// All amounts passed here must already be normalized to the trip currency.

export const FINANCE_LEDGER_VERSION = "4.29.44";

export const numberOrZero = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

export function summarizeTrackedOutgoings(rows = []) {
  const expenses = (Array.isArray(rows) ? rows : []).filter((row) => row && row.type !== "income");
  const paidSoFar = expenses
    .filter((row) => String(row.status || "").toLowerCase() === "paid")
    .reduce((sum, row) => sum + Math.max(0, numberOrZero(row.amount)), 0);
  const stillToPay = expenses
    .filter((row) => String(row.status || "").toLowerCase() !== "paid")
    .reduce((sum, row) => sum + Math.max(0, numberOrZero(row.amount)), 0);
  const totalTrackedOutgoings = paidSoFar + stillToPay;
  return {
    version: FINANCE_LEDGER_VERSION,
    paidSoFar,
    stillToPay,
    totalTrackedOutgoings,
    invariantDelta: totalTrackedOutgoings - paidSoFar - stillToPay,
    occurrenceCount: expenses.length,
    paidCount: expenses.filter((row) => String(row.status || "").toLowerCase() === "paid").length,
    upcomingCount: expenses.filter((row) => String(row.status || "").toLowerCase() !== "paid").length,
  };
}

export function calculatePlannerAffordability(raw = {}) {
  const startingSavings = numberOrZero(raw.startingSavings);
  const expectedIncome = numberOrZero(raw.expectedIncome);
  const supportMoney = numberOrZero(raw.supportMoney);
  const safetyReserve = Math.max(0, numberOrZero(raw.safetyReserve));
  const originCommitments = Math.max(0, numberOrZero(raw.originCommitments));
  const tripPlanCost = Math.max(0, numberOrZero(raw.tripPlanCost));

  const fundingPool = startingSavings + expectedIncome + supportMoney;
  const readyMoney = fundingPool - safetyReserve - originCommitments;
  const needToSave = Math.max(0, tripPlanCost - readyMoney);
  const afterTripPosition = readyMoney - tripPlanCost;

  return {
    version: FINANCE_LEDGER_VERSION,
    fundingPool,
    readyMoney,
    tripPlanCost,
    needToSave,
    afterTripPosition,
    startingSavings,
    expectedIncome,
    supportMoney,
    safetyReserve,
    originCommitments,
  };
}
