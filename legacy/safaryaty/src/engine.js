import { buildPaymentSchedule, splitPayments, destinationOccurrenceCount } from "./payments.js";
import { evaluateDecision } from "../shared/decision-engine.js";
import { generateRecommendations } from "../shared/recommendation-engine.js";
import { resolveLocalCostEstimateBundle } from "./costEstimateResolver.js";
import { countryProfile } from "./data/countryMetadata.js";
import { calculatePlannerAffordability, summarizeTrackedOutgoings } from "../shared/finance-ledger.js";
import { tripCostEffectiveTotal } from "../shared/trip-cost-domain.js";
// Safaryaty calculation engine — pure, framework-free, testable.
// Fixes:
//  (1) Trip costs now respect frequency / costType (MONTHLY × months, DAILY × days).
//  (2) One unified, explainable Readiness score (replaces ad-hoc readiness/risk/miScore).
// Backward compatible: still returns all fields the old calculate() returned.

// ---------- primitives ----------
export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const daysBetween = (a, b) =>
  Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000));
const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
const addMonths = (date, months) => {
  const d = new Date(date); const day = d.getDate(); d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0); return d;
};
const iso = (date) => date.toISOString().slice(0, 10);
const baseToTrip = (amountBase, t) =>
  t.baseCurrency === t.tripCurrency ? num(amountBase) : num(amountBase) * num(t.exchangeRate);

// Number of calendar months the stay spans (min 1). 180 days -> 6.
export function tripMonths(trip) {
  if (!trip?.startDate || !trip?.endDate) return 1;
  return Math.max(1, Math.ceil(daysBetween(trip.startDate, trip.endDate) / 30));
}

// ---------- THE FIX: effective cost of a destination/trip-cost item ----------
// Old engine summed amountLocal flat, ignoring frequency. That made a
// "Rent / month = 5000" on a 6-month study trip count as 5000, not 30000.
export function budgetItemCost(b, trip) {
  return tripCostEffectiveTotal(b, trip);
}

// ---------- cashflow (income / life / installments) — unchanged logic ----------
function buildDates(item, trip, maxCount = 36) {
  const f = item.frequency || "monthly";
  const start = new Date(item.nextDate || trip.startDate);
  const tripEnd = new Date(trip.endDate || trip.startDate || item.nextDate || new Date());
  if (Number.isNaN(start.getTime())) return trip.startDate ? [trip.startDate] : [];
  // One-time money/payments after the planning window must not inflate readiness.
  if (f === "one-time" || f === "trip-total") return start <= tripEnd ? [iso(start)] : [];
  const until = new Date(item.untilDate || trip.endDate);
  if (Number.isNaN(until.getTime()) || start > until) return [];
  let current = start; const out = []; let count = 0;
  while (current <= until && count < maxCount) {
    out.push(iso(current));
    if (f === "daily") current = addDays(current, 1);
    else if (f === "weekly") current = addDays(current, 7);
    else if (f === "monthly") current = addMonths(current, 1);
    else if (f === "yearly") current = addMonths(current, 12);
    else break;
    count++;
  }
  return out;
}
const monthLabel = (d) => { const date = new Date(d); return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en", { month: "short", year: "numeric" }); };
const isPaid = (t, id) => !!(t.paidPayments || {})[id];
const paymentStatus = (t, id) => (isPaid(t, id) ? "paid" : "upcoming");

export function generateCashflow(t) {
  const rows = [];
  (t.incomeSources || []).forEach((item) => {
    if (!item.enabled) return;
    buildDates(item, t).forEach((date, i) => rows.push({ id: `inc-${item.id}-${i}`, date, period: item.period || monthLabel(date), type: "income", source: "Money In", name: item.name, amount: num(item.amountBase), note: item.frequency }));
  });
  (t.lifeCosts || []).forEach((item) => {
    if (!item.enabled || item.canPause) return;
    buildDates(item, t).forEach((date, i) => rows.push({ id: `life-${item.id}-${i}`, date, period: item.period || monthLabel(date), type: "expense", source: "Life Cost", name: item.name, amount: num(item.amountBase), note: item.frequency }));
  });
  (t.installments || []).forEach((item) => {
    if (!item.enabled) return;
    const months = num(item.remainingMonths) || 36;
    buildDates(item, t, months).slice(0, months).forEach((date, i) => rows.push({ id: `inst-${item.id}-${i}`, date, period: item.period || monthLabel(date), type: "expense", source: "Installment", name: item.name, amount: num(item.monthlyBase), note: `${item.remainingMonths || 0} months left` }));
  });
  return rows.sort((a, b) => new Date(a.date) - new Date(b.date)).map((row) => ({ ...row, status: paymentStatus(t, row.id) }));
}

// ---------- core calculation ----------
export function calculate(t, opts = {}) {
  const catName = opts.categoryName || ((id) => id);
  const cashflow = generateCashflow(t);
  const paymentSchedule = buildPaymentSchedule(t);
  const paymentGroups = splitPayments(paymentSchedule);
  const originExpenseRows = paymentSchedule.filter((r) => ["origin", "installment"].includes(r.group) && r.type === "expense");
  const destinationRows = paymentSchedule.filter((r) => r.group === "destination" && r.type === "expense");

  const incomeBase = cashflow.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
  // Planner truth: commitments remain part of affordability whether paid or unpaid.
  // Mark Paid tracks progress; it must not create extra available money.
  const expenseBase = originExpenseRows.reduce((s, r) => s + r.amount, 0);
  const reserveBase = t.scenario?.reserveAfterTripBase ? num(t.scenario.reserveAmountBase) : 0;

  // Destination costs are expanded into payment occurrences.
  const budget = t.budget || [];
  const plannedLocal = destinationRows.reduce((s, r) => s + r.amount, 0);
  const unpaidTripLocal = destinationRows.filter((r) => r.status !== "paid").reduce((s, r) => s + r.amount, 0);
  const paidTripLocal = destinationRows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const flexibleLocal = destinationRows.filter((r) => r.priority !== "Must").reduce((s, r) => s + r.amount, 0);

  const unpaidPaymentsBase = originExpenseRows.filter((r) => r.status !== "paid").reduce((s, r) => s + r.amount, 0);
  const paidPaymentsBase = originExpenseRows.filter((r) => r.status === "paid").reduce((s, r) => s + r.amount, 0);
  const paidPaymentsLocal = baseToTrip(paidPaymentsBase, t);
  const unpaidPaymentsLocal = baseToTrip(unpaidPaymentsBase, t);

  const affordability = calculatePlannerAffordability({
    startingSavings: baseToTrip(num(t.startingSavingsBase), t),
    expectedIncome: baseToTrip(incomeBase, t),
    supportMoney: num(t.supportLocal),
    safetyReserve: baseToTrip(reserveBase, t),
    originCommitments: baseToTrip(expenseBase, t),
    tripPlanCost: plannedLocal,
  });
  const availableLocal = affordability.readyMoney;
  const availableBase = t.baseCurrency === t.tripCurrency
    ? availableLocal - num(t.supportLocal)
    : (availableLocal - num(t.supportLocal)) / Math.max(num(t.exchangeRate), 1e-9);

  const normalizedTrackedRows = [
    ...originExpenseRows.map((row) => ({ ...row, amount: baseToTrip(row.amount, t) })),
    ...destinationRows,
  ];
  const ledger = summarizeTrackedOutgoings(normalizedTrackedRows);
  const totalPaidLocal = ledger.paidSoFar;
  const totalStillNeededLocal = ledger.stillToPay;
  const totalTrackedOutgoingsLocal = ledger.totalTrackedOutgoings;
  const needToSaveLocal = affordability.needToSave;
  const nextPayment = paymentGroups.upcoming[0] || null;

  const remainingLocal = affordability.afterTripPosition;
  const travelDays = daysBetween(t.startDate, t.endDate);
  const dailyLocal = availableLocal / travelDays;
  const plannedDailyLocal = plannedLocal / travelDays;

  const periods = [...new Set(cashflow.map((r) => r.period))];
  let running = num(t.startingSavingsBase);
  let everNegative = false;
  const monthly = periods.map((period) => {
    const rows = cashflow.filter((r) => r.period === period);
    const income = rows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
    const expenses = rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
    running += income - expenses;
    if (running < 0) everNegative = true;
    return { period, income, expenses, net: income - expenses, running };
  });

  const exchangeRateMissing = t.baseCurrency !== t.tripCurrency && num(t.exchangeRate) <= 0;
  const byCat = {};
  budget.forEach((b) => {
    const name = catName(b.categoryId);
    byCat[name] = (byCat[name] || 0) + budgetItemCost(b, t);
  });

  const base = {
    cashflow, paymentSchedule, paymentGroups, incomeBase, expenseBase, reserveBase, availableBase, availableLocal,
    plannedLocal, unpaidTripLocal, paidTripLocal, unpaidPaymentsBase, paidPaymentsBase,
    paidPaymentsLocal, unpaidPaymentsLocal, totalPaidLocal, totalStillNeededLocal, totalTrackedOutgoingsLocal, needToSaveLocal,
    ledger, affordability, nextPayment, remainingLocal, travelDays, dailyLocal, plannedDailyLocal, monthly,
    exchangeRateMissing, flexibleLocal, byCat, tripMonths: tripMonths(t), everNegative,
  };

  const score = scoreTrip(t, base);
  // Backward-compatible aliases so existing UI keeps working:
  return { ...base, ...score, readiness: score.readiness, risk: 100 - score.readiness, miScore: score.readiness };
}

// ---------- ONE canonical, explainable score ----------
// The rules live in shared/decision-engine.js and are used by both frontend and backend.
export function buildDecisionInput(t, c) {
  const emergency = (t.budget || [])
    .filter((b) => b.categoryId === "cat-emergency")
    .reduce((sum, item) => sum + budgetItemCost(item, t), 0);
  const reserveLocal = baseToTrip(c.reserveBase || 0, t);
  return {
    planned: c.plannedLocal,
    available: c.availableLocal,
    paid: c.totalPaidLocal,
    remaining: c.remainingLocal,
    gap: c.needToSaveLocal,
    emergency,
    reserve: reserveLocal,
    comfort: t.comfortLevel || t.travelStyle || "Balanced",
    rateUnsure: Boolean(c.exchangeRateMissing || t.rateNeedsReview),
    hasIncome: (t.incomeSources || []).some((item) => item.enabled !== false && num(item.amountBase) > 0),
    hasDates: Boolean(t.startDate && t.endDate),
    continuingInstallments: (t.installments || []).some((item) => item.enabled !== false && item.continuesAfterTrip),
    everNegative: Boolean(c.everNegative),
    returnWithZero: Boolean(t.returnWithZero),
  };
}

export function scoreTrip(t, c) {
  const decision = evaluateDecision(buildDecisionInput(t, c));
  return { readiness: decision.readiness, scoreFactors: decision.scoreFactors, decision };
}

// ---------- status / recommendations / intelligence (score now sourced from above) ----------
const whole = (v, c = "EGP") => `${num(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${c}`;

export function recommendationInput(t, c) {
  const categoryAmounts = {};
  (t.budget || []).forEach((item) => {
    const categoryId = item.categoryId || "cat-other-trip";
    categoryAmounts[categoryId] = (categoryAmounts[categoryId] || 0) + budgetItemCost(item, t);
  });
  const destinationCountry = t.destinationInfo?.countryCode || t.toCountry || "";
  const destinationMeta = countryProfile(destinationCountry);
  const estimateBundle = resolveLocalCostEstimateBundle({
    destinationCountry,
    destinationCurrency: destinationMeta.currency || t.tripCurrency || "USD",
    tripCurrency: t.tripCurrency || "USD",
    rateBook: t.rateBook || {},
    costTier: destinationMeta.costTier,
    comfortLevel: t.comfortLevel || t.travelStyle || "Balanced",
    days: c.travelDays || daysBetween(t.startDate, t.endDate),
    travelers: Math.max(1, num(t.travelers) || 1),
  });
  const ranges = estimateBundle.ranges || { categories: {}, confidence: "low", source: "cost-profile:conversion-unavailable", asOf: null };
  return {
    decision: c.decision || evaluateDecision(buildDecisionInput(t, c)),
    currency: t.tripCurrency || "USD",
    planned: c.plannedLocal,
    available: c.availableLocal,
    paid: c.totalPaidLocal,
    remaining: c.remainingLocal,
    gap: c.needToSaveLocal,
    rateUnsure: Boolean(c.exchangeRateMissing || t.rateNeedsReview),
    everNegative: Boolean(c.everNegative),
    continuingInstallments: (t.installments || []).some((item) => item.enabled !== false && item.continuesAfterTrip),
    upcomingPayments: c.paymentGroups?.upcoming?.length || 0,
    categoryAmounts,
    categoryRanges: ranges.categories || {},
    costProfile: {
      confidence: ranges.confidence || "low",
      source: ranges.source || "local-cost-profile",
      asOf: ranges.asOf || null,
      stale: false,
    },
  };
}

export function recommendations(t, c, options = {}) {
  return generateRecommendations(recommendationInput(t, c), options);
}
