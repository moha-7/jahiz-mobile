import { test } from "node:test";
import assert from "node:assert/strict";
import { calculate, budgetItemCost, tripMonths, scoreTrip } from "./engine.js";

// Minimal seed mirror of the real seedTrip (short, all trip-total/one-time).
const seedTrip = {
  startDate: "2026-07-19", endDate: "2026-07-29", travelers: 2,
  baseCurrency: "AED", tripCurrency: "EGP", exchangeRate: 14.36, rateNeedsReview: false,
  startingSavingsBase: 0, supportLocal: 0, returnWithZero: true, paidPayments: {},
  scenario: { reserveAfterTripBase: false, reserveAmountBase: 1400 },
  incomeSources: [{ id: "salary", enabled: true, name: "Salary", amountBase: 4000, frequency: "monthly", nextDate: "2026-05-25", untilDate: "2026-07-25" }],
  lifeCosts: [
    { id: "rent", enabled: true, name: "Rent", amountBase: 1400, frequency: "monthly", nextDate: "2026-05-25", untilDate: "2026-06-25" },
    { id: "phone-may", enabled: true, name: "Phone May", amountBase: 350, frequency: "one-time", nextDate: "2026-05-25" },
    { id: "phone", enabled: true, name: "Phone", amountBase: 300, frequency: "monthly", nextDate: "2026-06-25", untilDate: "2026-07-25" },
    { id: "gym", enabled: true, name: "Gym", amountBase: 170, frequency: "monthly", nextDate: "2026-05-25", untilDate: "2026-07-25" },
    { id: "fooduae", enabled: true, name: "Food UAE", amountBase: 500, frequency: "monthly", nextDate: "2026-05-25", untilDate: "2026-06-25" },
  ],
  installments: [
    { id: "air", enabled: true, name: "Air Arabia", monthlyBase: 264.08, frequency: "monthly", remainingMonths: 7, nextDate: "2026-05-29", untilDate: "2026-07-29", continuesAfterTrip: true },
    { id: "udrive", enabled: true, name: "Udrive", monthlyBase: 177.12, frequency: "monthly", remainingMonths: 4, nextDate: "2026-06-25", untilDate: "2026-07-25", continuesAfterTrip: true },
  ],
  budget: [
    { id: "sky", categoryId: "cat-activities", amountLocal: 33000, priority: "Must", timing: "during", frequency: "trip-total" },
    { id: "cairo", categoryId: "cat-daytrip", amountLocal: 6000, priority: "Optional", timing: "during", frequency: "one-time", nextDate: "2026-07-26" },
    { id: "food", categoryId: "cat-food", amountLocal: 15000, priority: "Must", timing: "during", frequency: "trip-total" },
    { id: "transport", categoryId: "cat-transport", amountLocal: 5000, priority: "Must", timing: "during", frequency: "trip-total" },
    { id: "gifts", categoryId: "cat-gifts", amountLocal: 6000, priority: "Flexible", timing: "during", frequency: "one-time", nextDate: "2026-07-28" },
    { id: "clothes", categoryId: "cat-shopping", amountLocal: 6000, priority: "Flexible", timing: "before", frequency: "one-time", nextDate: "2026-07-15" },
    { id: "emergency", categoryId: "cat-emergency", amountLocal: 5000, priority: "Must", timing: "during", frequency: "trip-total" },
  ],
};

test("BENCHMARK preserved: short trip available cash ≈ 80,323 EGP", () => {
  const c = calculate(seedTrip);
  assert.equal(Math.round(c.availableLocal), 80323);
});

test("BENCHMARK preserved: short trip planned cost = 76,000 (no monthly items, summed once)", () => {
  const c = calculate(seedTrip);
  assert.equal(c.plannedLocal, 76000);
});

test("THE FIX: a monthly destination cost multiplies by months", () => {
  // 6-month study trip, rent 5000/month
  const studyTrip = {
    startDate: "2026-09-01", endDate: "2027-02-28", baseCurrency: "EGP", tripCurrency: "EUR",
    exchangeRate: 1, startingSavingsBase: 0, supportLocal: 0, scenario: {}, paidPayments: {},
    incomeSources: [], lifeCosts: [], installments: [],
    budget: [{ id: "rent", categoryId: "cat-accommodation", amountLocal: 5000, priority: "Must", frequency: "monthly", costType: "MONTHLY" }],
  };
  assert.equal(tripMonths(studyTrip), 6);
  // OLD engine would give 5000. New engine: 5000 × 6 = 30000.
  assert.equal(budgetItemCost(studyTrip.budget[0], studyTrip), 30000);
  assert.equal(calculate(studyTrip).plannedLocal, 30000);
});

test("THE FIX: student vs business now differ on the same monthly number", () => {
  const monthlyRent = { id: "r", categoryId: "cat-accommodation", amountLocal: 4000, priority: "Must", frequency: "monthly", costType: "MONTHLY" };
  const student = { startDate: "2026-09-01", endDate: "2027-06-30", budget: [monthlyRent], scenario: {}, baseCurrency: "EUR", tripCurrency: "EUR", exchangeRate: 1 };
  const business = { startDate: "2026-09-01", endDate: "2026-09-04", budget: [monthlyRent], scenario: {}, baseCurrency: "EUR", tripCurrency: "EUR", exchangeRate: 1 };
  const cs = calculate(student).plannedLocal;
  const cb = calculate(business).plannedLocal;
  // v4.29.33: count actual monthly occurrences from due date, not ceil(days/30).
  // Sep 1 → Jun 30 = Sep,Oct,Nov,Dec,Jan,Feb,Mar,Apr,May,Jun = 10 occurrences.
  assert.equal(cs, 40000);
  assert.equal(cb, 4000);  // 1 month (3-day business trip)
  assert.ok(cs > cb, "long student stay must cost more than short business trip for same monthly rent");
});

test("Daily cost multiplies by days", () => {
  const t = { startDate: "2026-01-01", endDate: "2026-01-11", budget: [{ id: "f", categoryId: "cat-food", amountLocal: 200, frequency: "daily", costType: "DAILY" }], scenario: {}, baseCurrency: "EGP", tripCurrency: "EGP", exchangeRate: 1 };
  assert.equal(calculate(t).plannedLocal, 200 * 10);
});

test("ONE score: returns 4 transparent factors that sum by weight", () => {
  const c = calculate(seedTrip);
  assert.ok(Array.isArray(c.scoreFactors));
  assert.equal(c.scoreFactors.length, 4);
  assert.deepEqual(c.scoreFactors.map((f) => f.key), ["coverage", "safety", "timing", "confidence"]);
  assert.equal(c.scoreFactors.reduce((s, f) => s + f.weight, 0), 100);
  assert.ok(c.readiness >= 0 && c.readiness <= 100);
  assert.equal(c.risk, 100 - c.readiness); // derived, never contradicts
});

test("ONE score: unconfirmed exchange rate visibly drops Confidence", () => {
  const ok = scoreTrip({ ...seedTrip, rateNeedsReview: false }, calculate(seedTrip));
  const bad = scoreTrip({ ...seedTrip, rateNeedsReview: true }, calculate({ ...seedTrip, rateNeedsReview: true }));
  const okConf = ok.scoreFactors.find((f) => f.key === "confidence").score;
  const badConf = bad.scoreFactors.find((f) => f.key === "confidence").score;
  assert.ok(badConf < okConf, "confirming the rate should raise the Confidence factor");
});

test("ONE score: over-budget plan scores low on Coverage", () => {
  const broke = { ...seedTrip, startingSavingsBase: 0, supportLocal: 0, incomeSources: [], budget: [{ id: "x", categoryId: "cat-food", amountLocal: 999999, frequency: "trip-total" }] };
  const c = calculate(broke);
  const cov = c.scoreFactors.find((f) => f.key === "coverage").score;
  assert.ok(cov < 30, "no money + huge plan must crush the Coverage factor");
});

test("Score changes when current savings change above coverage threshold", () => {
  const trip = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "AED", exchangeRate: 1, supportLocal: 0,
    incomeSources: [], lifeCosts: [], installments: [], paidPayments: {}, scenario: {},
    budget: [{ id: "hotel", categoryId: "cat-accommodation", amountLocal: 1000, priority: "Must", frequency: "trip-total" }]
  };
  const low = calculate({ ...trip, startingSavingsBase: 1000 });
  const high = calculate({ ...trip, startingSavingsBase: 1300 });
  assert.ok(high.readiness > low.readiness, `expected ${high.readiness} > ${low.readiness}`);
});

test("Reserve reduces available cash and affects readiness", () => {
  const trip = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "AED", exchangeRate: 1, supportLocal: 0,
    startingSavingsBase: 1200, incomeSources: [], lifeCosts: [], installments: [], paidPayments: {},
    budget: [{ id: "hotel", categoryId: "cat-accommodation", amountLocal: 1000, priority: "Must", frequency: "trip-total" }]
  };
  const noReserve = calculate({ ...trip, scenario: { reserveAfterTripBase: false, reserveAmountBase: 0 } });
  const withReserve = calculate({ ...trip, scenario: { reserveAfterTripBase: true, reserveAmountBase: 300 } });
  assert.equal(withReserve.availableLocal, 900);
  assert.notEqual(withReserve.readiness, noReserve.readiness);
});

test("Income after the trip does not inflate readiness or available cash", () => {
  const trip = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "AED", exchangeRate: 1,
    startingSavingsBase: 0, supportLocal: 0, lifeCosts: [], installments: [], paidPayments: {}, scenario: {},
    incomeSources: [{ id: "late", enabled: true, name: "Late Bonus", amountBase: 5000, frequency: "one-time", nextDate: "2026-08-01" }],
    budget: [{ id: "hotel", categoryId: "cat-accommodation", amountLocal: 1000, priority: "Must", frequency: "trip-total" }]
  };
  const c = calculate(trip);
  assert.equal(c.incomeBase, 0);
  assert.equal(c.availableLocal, 0);
  assert.ok(c.needToSaveLocal >= 1000);
});


test("Support money increases available cash and readiness", () => {
  const trip = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "EGP", exchangeRate: 10,
    startingSavingsBase: 0, incomeSources: [], lifeCosts: [], installments: [], paidPayments: {}, scenario: {},
    budget: [{ id: "hotel", categoryId: "cat-accommodation", amountLocal: 1000, priority: "Must", frequency: "trip-total" }]
  };
  const noSupport = calculate({ ...trip, supportLocal: 0 });
  const withSupport = calculate({ ...trip, supportLocal: 1000 });
  assert.equal(withSupport.availableLocal, 1000);
  assert.ok(withSupport.readiness > noSupport.readiness);
});

test("Comfort level changes score strictness", () => {
  const trip = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "AED", exchangeRate: 1,
    startingSavingsBase: 1000, supportLocal: 0, incomeSources: [], lifeCosts: [], installments: [], paidPayments: {}, scenario: {},
    budget: [{ id: "hotel", categoryId: "cat-accommodation", amountLocal: 1000, priority: "Must", frequency: "trip-total" }]
  };
  const survival = calculate({ ...trip, comfortLevel: "Survival" });
  const premium = calculate({ ...trip, comfortLevel: "Premium" });
  assert.ok(survival.readiness > premium.readiness, `${survival.readiness} should be > ${premium.readiness}`);
});

test("Currency conversion direction uses base to trip multiply exactly once", () => {
  const trip = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "EGP", exchangeRate: 14.1108,
    startingSavingsBase: 1000, supportLocal: 1000,
    incomeSources: [], lifeCosts: [], installments: [], budget: [], paidPayments: {}, scenario: {}
  };
  const calc = calculate(trip);
  assert.equal(Math.round(calc.availableLocal), Math.round(1000 * 14.1108 + 1000));
});


test("Currency truth: supportLocal stays in trip currency and is not double converted", () => {
  const trip = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "EGP", exchangeRate: 14,
    startingSavingsBase: 1000, supportLocal: 1000,
    incomeSources: [], lifeCosts: [], installments: [], budget: [], paidPayments: {}, scenario: {}
  };
  const calc = calculate(trip);
  assert.equal(calc.availableLocal, 15000);
});

test("Currency truth: same currency ignores exchange rate for savings", () => {
  const trip = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "AED", exchangeRate: 99,
    startingSavingsBase: 1000, supportLocal: 250,
    incomeSources: [], lifeCosts: [], installments: [], budget: [], paidPayments: {}, scenario: {}
  };
  const calc = calculate(trip);
  assert.equal(calc.availableLocal, 1250);
});

test("Score curve: high cash coverage is recognized but does not fake 100", () => {
  const trip = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "AED", exchangeRate: 1,
    startingSavingsBase: 50000, supportLocal: 0,
    incomeSources: [], lifeCosts: [], installments: [], paidPayments: {}, scenario: {},
    budget: [{ id: "hotel", categoryId: "cat-accommodation", amountLocal: 10000, priority: "Must", frequency: "trip-total" }]
  };
  const calc = calculate(trip);
  const coverage = calc.scoreFactors.find((f) => f.key === "coverage").score;
  assert.ok(coverage >= 95, `coverage should be very high, got ${coverage}`);
  assert.ok(calc.readiness < 100, `readiness should not be fake perfect, got ${calc.readiness}`);
});

test("Score curve: emergency buffer improves safety factor", () => {
  const base = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "AED", exchangeRate: 1,
    startingSavingsBase: 15000, supportLocal: 0,
    incomeSources: [{ id:"salary", enabled:true, amountBase: 0, frequency:"one-time", nextDate:"2026-07-01" }],
    lifeCosts: [], installments: [], paidPayments: {}, scenario: {},
    budget: [{ id: "hotel", categoryId: "cat-accommodation", amountLocal: 10000, priority: "Must", frequency: "trip-total" }]
  };
  const noEmergency = calculate(base);
  const withEmergency = calculate({ ...base, budget: [...base.budget, { id:"em", categoryId:"cat-emergency", amountLocal:1000, priority:"Must", frequency:"trip-total" }] });
  const s1 = noEmergency.scoreFactors.find((f) => f.key === "safety").score;
  const s2 = withEmergency.scoreFactors.find((f) => f.key === "safety").score;
  assert.ok(s2 > s1, `${s2} should be > ${s1}`);
});


test("E2E QA: trip cost directly affects readiness and need to save", () => {
  const base = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "AED", tripCurrency: "AED", exchangeRate: 1,
    startingSavingsBase: 1000, supportLocal: 0,
    incomeSources: [], lifeCosts: [], installments: [], paidPayments: {}, scenario: { reserveAfterTripBase: false }
  };
  const noCost = calculate({ ...base, budget: [] });
  const withCost = calculate({ ...base, budget: [{ id:"flight", categoryId:"cat-flight", amountLocal: 1500, priority:"Must", frequency:"trip-total" }] });
  assert.equal(withCost.plannedLocal, 1500);
  assert.equal(withCost.needToSaveLocal, 500);
  assert.equal(noCost.decision.verdict, "BLOCKED");
  assert.equal(noCost.decision.reasonCode, "MISSING_TRIP_COSTS");
  const noCostCoverage = noCost.scoreFactors.find((factor) => factor.key === "coverage").score;
  const withCostCoverage = withCost.scoreFactors.find((factor) => factor.key === "coverage").score;
  assert.ok(withCostCoverage < noCostCoverage, `${withCostCoverage} should be lower than ${noCostCoverage}`);
});

test("E2E QA: tight covered plan returns zero saving gap but thin safety", () => {
  const trip = {
    startDate: "2026-07-01", endDate: "2026-07-10",
    baseCurrency: "GEL", tripCurrency: "GEL", exchangeRate: 1,
    startingSavingsBase: 4770, supportLocal: 0,
    incomeSources: [], lifeCosts: [], installments: [], paidPayments: {}, scenario: { reserveAfterTripBase: false }, returnWithZero: true,
    budget: [
      { id:"flight", categoryId:"cat-flight", amountLocal: 650, priority:"Must", frequency:"trip-total" },
      { id:"food", categoryId:"cat-food", amountLocal: 1100, priority:"Flexible", frequency:"trip-total" },
      { id:"stay", categoryId:"cat-accommodation", amountLocal: 2600, priority:"Must", frequency:"trip-total" },
      { id:"em", categoryId:"cat-emergency", amountLocal: 360, priority:"Must", frequency:"trip-total" }
    ]
  };
  const calc = calculate(trip);
  assert.equal(calc.plannedLocal, 4710);
  assert.equal(calc.needToSaveLocal, 0);
  assert.equal(calc.remainingLocal, 60);
  const safety = calc.scoreFactors.find(f => f.key === "safety");
  assert.ok(safety.score < 90, `tight buffer should not be perfect safety, got ${safety.score}`);
  assert.match(safety.reason, /thin|buffer|healthy/i);
});
