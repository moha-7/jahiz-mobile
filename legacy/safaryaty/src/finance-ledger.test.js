import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "./engine.js";
import { calculatePlannerAffordability, summarizeTrackedOutgoings } from "../shared/finance-ledger.js";

const trip = (paidPayments = {}, startingSavingsBase = 1000) => ({
  startDate: "2026-07-01",
  endDate: "2026-07-10",
  baseCurrency: "AED",
  tripCurrency: "AED",
  exchangeRate: 1,
  startingSavingsBase,
  supportLocal: 0,
  paidPayments,
  scenario: { reserveAfterTripBase: false, reserveAmountBase: 0 },
  incomeSources: [],
  lifeCosts: [
    { id: "rent", enabled: true, canPause: false, name: "Rent", amountBase: 200, frequency: "one-time", nextDate: "2026-07-01" }
  ],
  installments: [
    { id: "tabby", enabled: true, name: "Tabby", monthlyBase: 100, remainingMonths: 1, nextDate: "2026-07-01", untilDate: "2026-07-01" }
  ],
  budget: [
    { id: "hotel", name: "Hotel", categoryId: "cat-accommodation", amountLocal: 500, priority: "Must", frequency: "trip-total", nextDate: "2026-07-01" }
  ]
});

test("finance ledger partitions one canonical tracked total", () => {
  const summary = summarizeTrackedOutgoings([
    { type: "expense", status: "paid", amount: 200 },
    { type: "expense", status: "upcoming", amount: 100 },
    { type: "expense", status: "paid", amount: 500 },
    { type: "income", status: "expected", amount: 9999 }
  ]);
  assert.equal(summary.paidSoFar, 700);
  assert.equal(summary.stillToPay, 100);
  assert.equal(summary.totalTrackedOutgoings, 800);
  assert.equal(summary.paidSoFar + summary.stillToPay, summary.totalTrackedOutgoings);
  assert.equal(summary.invariantDelta, 0);
});

test("planner affordability is independent from payment progress", () => {
  const affordability = calculatePlannerAffordability({
    startingSavings: 1000,
    expectedIncome: 0,
    supportMoney: 0,
    safetyReserve: 0,
    originCommitments: 300,
    tripPlanCost: 500
  });
  assert.equal(affordability.readyMoney, 700);
  assert.equal(affordability.needToSave, 0);
  assert.equal(affordability.afterTripPosition, 200);
});

test("marking some payments paid changes progress only", () => {
  const before = calculate(trip());
  const after = calculate(trip({ "life-rent-0": true, "cost-hotel-0": true }));

  assert.equal(before.availableLocal, 700);
  assert.equal(after.availableLocal, before.availableLocal);
  assert.equal(after.plannedLocal, before.plannedLocal);
  assert.equal(after.needToSaveLocal, before.needToSaveLocal);
  assert.equal(after.remainingLocal, before.remainingLocal);

  assert.equal(before.totalPaidLocal, 0);
  assert.equal(before.totalStillNeededLocal, 800);
  assert.equal(after.totalPaidLocal, 700);
  assert.equal(after.totalStillNeededLocal, 100);
  assert.equal(after.totalPaidLocal + after.totalStillNeededLocal, after.totalTrackedOutgoingsLocal);
});

test("marking every occurrence paid produces zero still-to-pay without changing affordability", () => {
  const before = calculate(trip({}, 500));
  const allPaid = calculate(trip({
    "life-rent-0": true,
    "inst-tabby-0": true,
    "cost-hotel-0": true
  }, 500));

  assert.equal(before.availableLocal, 200);
  assert.equal(before.needToSaveLocal, 300);
  assert.equal(before.remainingLocal, -300);
  assert.equal(allPaid.availableLocal, before.availableLocal);
  assert.equal(allPaid.needToSaveLocal, before.needToSaveLocal);
  assert.equal(allPaid.remainingLocal, before.remainingLocal);
  assert.equal(allPaid.totalPaidLocal, 800);
  assert.equal(allPaid.totalStillNeededLocal, 0);
  assert.equal(allPaid.totalTrackedOutgoingsLocal, 800);
});
