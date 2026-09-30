import test from "node:test";
import assert from "node:assert/strict";
import { buildPaymentSchedule, splitPayments } from "./payments.js";
import { calculate } from "./engine.js";

const baseTrip = {
  startDate: "2026-01-01",
  endDate: "2026-06-30",
  baseCurrency: "AED",
  tripCurrency: "EUR",
  exchangeRate: 0.25,
  startingSavingsBase: 0,
  supportLocal: 0,
  returnWithZero: true,
  paidPayments: {},
  scenario: {},
  incomeSources: [],
  lifeCosts: [],
  installments: [],
  budget: []
};

test("monthly destination cost creates one row per trip month", () => {
  const trip = { ...baseTrip, budget: [{ id: "rent", name: "Student Rent / Month", amountLocal: 600, frequency: "monthly", costType: "MONTHLY", priority: "Must" }] };
  const rows = buildPaymentSchedule(trip).filter(r => r.group === "destination");
  assert.equal(rows.length, 6);
  assert.equal(rows[0].amount, 600);
  assert.equal(rows[5].name, "Student Rent / Month · Month 6");
});

test("daily destination cost is calculated per day but shown as one tracked payment", () => {
  const trip = { ...baseTrip, startDate: "2026-01-01", endDate: "2026-01-05", budget: [{ id: "food", name: "Food / Day", amountLocal: 20, frequency: "daily", costType: "DAILY" }] };
  const rows = buildPaymentSchedule(trip).filter(r => r.group === "destination");
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 80);
  assert.match(rows[0].name, /4 days/);
});

test("marking one monthly destination occurrence as paid only pays that occurrence", () => {
  const trip = { ...baseTrip, paidPayments: { "cost-rent-0": true }, budget: [{ id: "rent", name: "Student Rent / Month", amountLocal: 600, frequency: "monthly", costType: "MONTHLY", priority: "Must" }] };
  const calc = calculate(trip);
  assert.equal(calc.plannedLocal, 3600);
  assert.equal(calc.paidTripLocal, 600);
  assert.equal(calc.unpaidTripLocal, 3000);
});

test("installments remain in the To Pay schedule", () => {
  const trip = { ...baseTrip, installments: [{ id: "tabby", enabled: true, name: "Tabby", monthlyBase: 250, remainingMonths: 3, nextDate: "2026-01-01" }] };
  const groups = splitPayments(buildPaymentSchedule(trip));
  const rows = groups.upcoming.filter(r => r.group === "installment");
  assert.equal(rows.length, 3);
  assert.equal(rows[0].source, "Monthly Payment");
});
