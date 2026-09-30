import test from "node:test";
import assert from "node:assert/strict";
import { canTravel } from "./canTravel.js";
import { evaluateDecision } from "../shared/decision-engine.js";

const trip = {
  startDate: "2026-07-01",
  endDate: "2026-07-10",
  baseCurrency: "AED",
  tripCurrency: "EUR",
  exchangeRate: 0.25,
  rateNeedsReview: false,
  incomeSources: [{ id: "salary", enabled: true, amountBase: 1000 }],
  lifeCosts: [], installments: [],
  budget: [
    { id: "rent", name: "Student Rent", categoryId: "cat-student-accommodation", amountLocal: 600, priority: "Must" },
    { id: "fun", name: "Activities", categoryId: "cat-activities", amountLocal: 200, priority: "Flexible" },
    { id: "em", name: "Emergency", categoryId: "cat-emergency", amountLocal: 100, priority: "Must" }
  ]
};

function calc(decisionInput, extra = {}) {
  const decision = evaluateDecision(decisionInput);
  return {
    decision,
    readiness: decision.readiness,
    plannedLocal: decision.planned,
    availableLocal: decision.available,
    totalPaidLocal: decision.paid,
    needToSaveLocal: decision.gap,
    remainingLocal: decision.remaining,
    paymentSchedule: [],
    ...extra
  };
}

test("canTravel presents canonical READY without recalculating thresholds", () => {
  const c = calc({ planned: 1000, available: 1400, remaining: 400, gap: 0, emergency: 100, reserve: 100, hasIncome: true, hasDates: true, returnWithZero: true });
  const v = canTravel(trip, c);
  assert.equal(v.verdict, "READY");
  assert.equal(v.readiness, c.decision.readiness);
  assert.equal(v.nextAction.key, "track_payments");
});

test("canTravel presents canonical ALMOST when gap is small", () => {
  const c = calc({ planned: 1000, available: 950, remaining: -50, gap: 50, emergency: 100, reserve: 100, hasIncome: true, hasDates: true, returnWithZero: true });
  const v = canTravel(trip, c);
  assert.equal(v.verdict, "ALMOST");
  assert.equal(v.gap, 50);
});

test("canTravel presents canonical TIGHT and keeps action routing", () => {
  const c = calc({ planned: 1000, available: 500, remaining: -500, gap: 500, emergency: 100, hasIncome: true, hasDates: true, returnWithZero: true });
  const v = canTravel(trip, c);
  assert.equal(v.verdict, "TIGHT");
  assert.equal(v.nextAction.key, "reduce_optional");
});

test("canTravel presents canonical RISKY", () => {
  const c = calc({ planned: 1000, available: 100, remaining: -900, gap: 900, emergency: 0, reserve: 0, hasIncome: false, hasDates: true, everNegative: true });
  const v = canTravel(trip, c);
  assert.equal(v.verdict, "RISKY");
});

test("BLOCKED when exchange rate needs review", () => {
  const blockedTrip = { ...trip, rateNeedsReview: true };
  const c = calc({ planned: 1000, available: 1000, remaining: 0, gap: 0, rateUnsure: true, hasIncome: true, hasDates: true });
  const v = canTravel(blockedTrip, { ...c, exchangeRateMissing: true });
  assert.equal(v.verdict, "BLOCKED");
  assert.equal(v.nextAction.key, "confirm_rate");
});

test("BLOCKED when no destination cost exists", () => {
  const c = calc({ planned: 0, available: 1000, remaining: 1000, gap: 0, hasIncome: true, hasDates: true });
  const v = canTravel({ ...trip, budget: [] }, c);
  assert.equal(v.verdict, "BLOCKED");
  assert.ok(v.readiness <= 35);
});

test("TIGHT copy includes the remaining thin buffer", () => {
  const c = calc({ planned: 4710, available: 4770, remaining: 60, gap: 0, emergency: 100, hasIncome: true, hasDates: true });
  const v = canTravel(trip, c);
  assert.equal(v.verdict, "TIGHT");
  assert.equal(v.label, "Can go, but tight");
  assert.ok(v.detail.includes("60"));
});

test("Coach actions route to edit pages, not the wizard", () => {
  const rateDecision = calc({ planned: 1000, available: 1000, remaining: 0, gap: 0, rateUnsure: true, hasIncome: true, hasDates: true });
  const rate = canTravel({ ...trip, rateNeedsReview: true }, { ...rateDecision, exchangeRateMissing: true });
  assert.deepEqual(rate.nextAction.target, { tab: "overview", section: "display-currency" });

  const noOptionalTrip = { ...trip, budget: trip.budget.filter((item) => item.priority === "Must") };
  const moneyDecision = calc({ planned: 1000, available: 100, remaining: -900, gap: 900, emergency: 100, hasIncome: true, hasDates: true });
  const money = canTravel(noOptionalTrip, moneyDecision);
  assert.deepEqual(money.nextAction.target, { tab: "overview", section: "plan-money" });
});
