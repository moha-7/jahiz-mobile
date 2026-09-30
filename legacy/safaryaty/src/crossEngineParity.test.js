// v4.29.33 — Cross-engine parity: draft/local (engine.js) vs saved/backend (port).
// Proves Trip Plan Cost matches across both engines for the 5 required trip shapes.
// Frontend side uses the REAL patched engine.js/payments.js.
// Backend side uses backend_port.js, a faithful transcription of the patched
// finance_mapper.ts + cashflow_engine.ts (the real backend is not compilable here).
import test from "node:test";
import assert from "node:assert/strict";
import { calculate } from "./engine.js";
import { buildPaymentSchedule } from "./payments.js";
import { mapClientTrip, backendTripCostTotal, backendInstallmentInfo, backendAvailableFromClientTrip, backendDecisionFromClientTrip } from "./backend_port.js";

const baseTrip = (over = {}) => ({
  startDate: "2026-07-01", endDate: "2026-07-10",
  baseCurrency: "EUR", tripCurrency: "EUR", exchangeRate: 1,
  startingSavingsBase: 0, supportLocal: 0, paidPayments: {}, scenario: {},
  incomeSources: [], lifeCosts: [], installments: [], budget: [], ...over
});

const fePlanned = (trip) => calculate(trip).plannedLocal;
const bePlanned = (trip) => { const m = mapClientTrip(trip); return backendTripCostTotal(m.tripCosts, m.trip); };
const feInstallmentCount = (trip) => buildPaymentSchedule(trip).filter((r) => r.group === "installment").length;
const beInstallment = (trip) => { const m = mapClientTrip(trip); return backendInstallmentInfo(m.installments, m.trip); };

test("parity 1/5 — one-time trip cost: local == backend", () => {
  const trip = baseTrip({ budget: [{ id: "f", name: "Flights", categoryId: "cat-flight", amountLocal: 1500, frequency: "one-time", nextDate: "2026-07-01", priority: "Must" }] });
  assert.equal(fePlanned(trip), 1500);
  assert.equal(bePlanned(trip), 1500);
  assert.equal(fePlanned(trip), bePlanned(trip));
});

test("parity 2/5 — daily trip cost: local == backend (and not collapsed to 1 day)", () => {
  const trip = baseTrip({ startDate: "2026-01-01", endDate: "2026-01-11", budget: [{ id: "fd", name: "Food", categoryId: "cat-food", amountLocal: 200, frequency: "daily", costType: "DAILY" }] });
  assert.equal(fePlanned(trip), 2000);          // 200 × 10 days
  assert.equal(bePlanned(trip), 2000);          // backend preserves DAILY unit amount and computes 10-day total
  assert.equal(fePlanned(trip), bePlanned(trip));
  assert.notEqual(bePlanned(trip), 200);        // regression guard: old backend stored a single day
});

test("parity 3/5 — monthly trip cost: local == backend across calendar boundaries", () => {
  // (a) the worst old-divergence case: Jan 31 → Mar 1 (old FE=5000, old BE=15000)
  const a = baseTrip({ startDate: "2026-01-31", endDate: "2026-03-01", budget: [{ id: "r", name: "Rent", categoryId: "cat-accommodation", amountLocal: 5000, frequency: "monthly", costType: "MONTHLY" }] });
  assert.equal(fePlanned(a), 10000);            // occurrences: Jan 31, Feb 28 = 2
  assert.equal(bePlanned(a), 10000);
  assert.notEqual(fePlanned(a), 5000);          // old frontend (ceil days/30)
  assert.notEqual(bePlanned(a), 15000);         // old backend (monthsBetweenInclusive)

  // (b) mid-month due date, one payment: Jan 15 → Feb 14
  const b = baseTrip({ startDate: "2026-01-15", endDate: "2026-02-14", budget: [{ id: "r", name: "Rent", categoryId: "cat-accommodation", amountLocal: 5000, frequency: "monthly", costType: "MONTHLY", nextDate: "2026-01-15" }] });
  assert.equal(fePlanned(b), 5000);
  assert.equal(bePlanned(b), 5000);

  // (c) long stay with explicit due date: Sep 1 → Jun 30 = 10 payments
  const c = baseTrip({ startDate: "2026-09-01", endDate: "2027-06-30", budget: [{ id: "r", name: "Rent", categoryId: "cat-accommodation", amountLocal: 4000, frequency: "monthly", costType: "MONTHLY", nextDate: "2026-09-01" }] });
  assert.equal(fePlanned(c), 40000);
  assert.equal(bePlanned(c), 40000);
});

test("parity 4/5 — installment due INSIDE trip window does not touch Trip Plan Cost, occurrences agree", () => {
  const without = baseTrip({ startDate: "2026-01-01", endDate: "2026-06-30", budget: [{ id: "h", name: "Hotel", categoryId: "cat-accommodation", amountLocal: 3000, frequency: "trip-total" }] });
  const withInst = baseTrip({ ...without, installments: [{ id: "tabby", enabled: true, name: "Tabby", monthlyBase: 250, remainingMonths: 3, nextDate: "2026-01-01", untilDate: "2026-03-01", continuesAfterTrip: false }] });

  // Trip Plan Cost must be identical with/without the installment, on BOTH engines.
  assert.equal(fePlanned(withInst), fePlanned(without));
  assert.equal(bePlanned(withInst), bePlanned(without));
  assert.equal(fePlanned(withInst), bePlanned(withInst)); // 3000 == 3000

  // Installment occurrence count agrees inside the window (Jan, Feb, Mar = 3).
  assert.equal(feInstallmentCount(withInst), 3);
  assert.equal(beInstallment(withInst).count, 3);
});

test("parity 5/5 — installment CONTINUING after trip does not touch Trip Plan Cost, occurrences agree", () => {
  // Trip is 3 months; installment runs 12 months (continues well past the trip).
  const without = baseTrip({ startDate: "2026-01-01", endDate: "2026-03-31", budget: [{ id: "h", name: "Hotel", categoryId: "cat-accommodation", amountLocal: 2000, frequency: "trip-total" }] });
  const withInst = baseTrip({ ...without, installments: [{ id: "loan", enabled: true, name: "Loan", monthlyBase: 300, remainingMonths: 12, nextDate: "2026-01-01", untilDate: "2026-12-31", continuesAfterTrip: true }] });

  assert.equal(fePlanned(withInst), fePlanned(without));
  assert.equal(bePlanned(withInst), bePlanned(without));
  assert.equal(fePlanned(withInst), bePlanned(withInst)); // 2000 == 2000

  // Both engines schedule the full 12 occurrences (bounded by untilDate), and both
  // recognise it as a continuing installment for the timing/score signal.
  assert.equal(feInstallmentCount(withInst), 12);
  assert.equal(beInstallment(withInst).count, 12);
  assert.equal(beInstallment(withInst).continuing, true);
});


test("parity 6/7 — monthly income/life costs use occurrence counts, not calendar inflation", () => {
  const trip = baseTrip({
    startDate: "2026-01-31", endDate: "2026-03-01", baseCurrency: "AED", tripCurrency: "AED", exchangeRate: 1,
    incomeSources: [{ id: "salary", enabled: true, name: "Salary", amountBase: 1000, frequency: "monthly", nextDate: "2026-01-31", untilDate: "2026-03-01" }],
    lifeCosts: [{ id: "rent", enabled: true, name: "Rent", amountBase: 200, frequency: "monthly", nextDate: "2026-01-31", untilDate: "2026-03-01" }],
  });
  // Occurrences are Jan 31 and Feb 28 = 2, not Jan+Feb+Mar calendar inflation.
  assert.equal(calculate(trip).incomeBase, 2000);
  assert.equal(calculate(trip).expenseBase, 400);
  assert.equal(calculate(trip).availableLocal, 1600);
  assert.equal(backendAvailableFromClientTrip(trip), 1600);
});

test("parity 7/7 — one-time income after trip is ignored in both engines", () => {
  const trip = baseTrip({
    startDate: "2026-07-01", endDate: "2026-07-10", baseCurrency: "AED", tripCurrency: "AED", exchangeRate: 1,
    incomeSources: [{ id: "late", enabled: true, name: "Late Bonus", amountBase: 5000, frequency: "one-time", nextDate: "2026-08-01" }],
    budget: [{ id: "hotel", name: "Hotel", categoryId: "cat-accommodation", amountLocal: 1000, frequency: "trip-total" }]
  });
  assert.equal(calculate(trip).incomeBase, 0);
  assert.equal(calculate(trip).availableLocal, 0);
  assert.equal(backendAvailableFromClientTrip(trip), 0);
});


test("decision parity — draft/local and saved/backend return the same score and verdict", () => {
  const scenarios = [
    baseTrip({
      startDate: "2026-07-01", endDate: "2026-07-10",
      startingSavingsBase: 1800,
      incomeSources: [{ id: "salary", enabled: true, name: "Salary", amountBase: 500, frequency: "one-time", nextDate: "2026-07-01" }],
      scenario: { reserveAfterTripBase: true, reserveAmountBase: 100 },
      returnWithZero: true,
      budget: [
        { id: "hotel", name: "Hotel", categoryId: "cat-accommodation", amountLocal: 1500, frequency: "trip-total", priority: "Must" },
        { id: "em", name: "Emergency", categoryId: "cat-emergency", amountLocal: 100, frequency: "trip-total", priority: "Must" }
      ]
    }),
    baseTrip({
      startDate: "2026-07-01", endDate: "2026-07-10",
      startingSavingsBase: 1020,
      incomeSources: [{ id: "salary", enabled: true, name: "Salary", amountBase: 100, frequency: "one-time", nextDate: "2026-07-01" }],
      budget: [
        { id: "hotel", name: "Hotel", categoryId: "cat-accommodation", amountLocal: 1000, frequency: "trip-total", priority: "Must" },
        { id: "em", name: "Emergency", categoryId: "cat-emergency", amountLocal: 50, frequency: "trip-total", priority: "Must" }
      ]
    }),
    baseTrip({
      startDate: "2026-01-01", endDate: "2026-03-31",
      startingSavingsBase: 300,
      installments: [{ id: "loan", enabled: true, name: "Loan", monthlyBase: 200, remainingMonths: 6, nextDate: "2026-01-01", untilDate: "2026-06-01", continuesAfterTrip: true }],
      budget: [{ id: "hotel", name: "Hotel", categoryId: "cat-accommodation", amountLocal: 1200, frequency: "trip-total", priority: "Must" }]
    }),
    baseTrip({
      baseCurrency: "AED", tripCurrency: "EUR", exchangeRate: 0, rateNeedsReview: true,
      startingSavingsBase: 5000,
      incomeSources: [{ id: "salary", enabled: true, name: "Salary", amountBase: 1000, frequency: "one-time", nextDate: "2026-07-01" }],
      budget: [{ id: "hotel", name: "Hotel", categoryId: "cat-accommodation", amountLocal: 800, frequency: "trip-total", priority: "Must" }]
    })
  ];

  scenarios.forEach((trip, index) => {
    const frontend = calculate(trip).decision;
    const backend = backendDecisionFromClientTrip(trip);
    assert.equal(backend.readiness, frontend.readiness, `scenario ${index + 1} readiness`);
    assert.equal(backend.verdict, frontend.verdict, `scenario ${index + 1} verdict`);
    assert.equal(backend.reasonCode, frontend.reasonCode, `scenario ${index + 1} reason`);
    assert.deepEqual(backend.scoreFactors.map((factor) => factor.score), frontend.scoreFactors.map((factor) => factor.score), `scenario ${index + 1} factors`);
  });
});
