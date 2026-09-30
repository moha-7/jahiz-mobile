import { evaluateDecision } from "../shared/decision-engine.js";
import { tripCostEffectiveTotal as sharedTripCostEffectiveTotal } from "../shared/trip-cost-domain.js";

// ──────────────────────────────────────────────────────────────────────────
// backend_port.js — FAITHFUL JS transcription of the PATCHED backend logic.
//
// WHY THIS EXISTS: the uploaded backend is a flattened snapshot (no package.json,
// no lib/prisma, no middleware) and cannot be compiled or run in this sandbox.
// To still PROVE that saved/backend Trip Plan Cost equals draft/local Trip Plan Cost,
// this file transcribes—line for line—the relevant parts of the patched
//   • finance_mapper.ts   (client trip -> prisma-shaped rows)
//   • cashflow_engine.ts  (tripCost total + installment occurrences)
// If those .ts files change, regenerate this port. It is test-only.
// ──────────────────────────────────────────────────────────────────────────

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const toDate = (v) => { if (!v) return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; };
function addMonths(date, months) { const next = new Date(date); const day = next.getDate(); next.setMonth(next.getMonth() + months); if (next.getDate() < day) next.setDate(0); return next; }
function positive(v) { const n = Number(v || 0); return Number.isFinite(n) && n > 0 ? n : 0; }

// ----- currency.ts -----
function toTripCurrency(amount, itemCurrency, tripCurrency, exchangeRate) {
  if (itemCurrency === tripCurrency) return amount;
  return amount * exchangeRate;
}

// ----- finance_mapper.ts (frequency + categoryName trimmed to what the port needs) -----
function frequency(value, fallback = "MONTHLY") {
  const raw = String(value || "").toLowerCase().replace(/_/g, "-");
  if (raw === "daily") return "DAILY";
  if (raw === "weekly") return "WEEKLY";
  if (raw === "monthly") return "MONTHLY";
  if (raw === "yearly") return "YEARLY";
  if (raw === "one-time" || raw === "once") return "ONE_TIME";
  if (raw === "trip-total") return "TRIP_TOTAL";
  return fallback;
}

export function mapClientTrip(clientTrip) {
  const t = clientTrip;
  const tripCurrency = String(t.tripCurrency || t.baseCurrency || "AED").toUpperCase();
  const baseCurrency = String(t.baseCurrency || "AED").toUpperCase();
  const trip = {
    departureDate: toDate(t.startDate),
    returnDate: toDate(t.endDate),
    tripCurrency,
    incomeCurrency: baseCurrency,
    exchangeRate: Number.isFinite(Number(t.exchangeRate)) ? Number(t.exchangeRate) : 1
  };

  const tripCosts = (t.budget || [])
    .filter((item) => positive(item.amountLocal) >= 0 && (item.name || item.categoryId))
    .map((item) => ({
      amount: positive(item.amountLocal),
      currency: tripCurrency,
      frequency: frequency(item.frequency || item.costType, "TRIP_TOTAL"),
      dueDate: toDate(item.nextDate || t.startDate || null),
      category: item.categoryId || "cat-other-trip",
      title: item.name || item.categoryId || "Trip Cost"
    }));

  const installments = (t.installments || [])
    .filter((item) => item.enabled !== false && positive(item.monthlyBase ?? item.amountBase ?? item.amount) > 0)
    .map((item) => ({
      amount: positive(item.monthlyBase ?? item.amountBase ?? item.amount),
      currency: baseCurrency,
      frequency: frequency(item.frequency, "MONTHLY") === "ONE_TIME" ? "ONE_TIME" : "MONTHLY",
      startDate: toDate(item.nextDate || item.startDate || t.startDate),
      endDate: toDate(item.untilDate || item.endDate || t.endDate),
      remainingMonths: item.remainingMonths ? Number(item.remainingMonths) : null,
      status: "UNPAID"
    }));

  const incomes = (t.incomeSources || [])
    .filter((item) => item.enabled !== false && positive(item.amountBase) > 0)
    .map((item) => {
      const f = frequency(item.frequency, "MONTHLY");
      return {
        amount: positive(item.amountBase),
        currency: baseCurrency,
        frequency: f === "TRIP_TOTAL" ? "ONE_TIME" : f,
        startDate: f === "MONTHLY" ? toDate(item.nextDate || t.startDate) : null,
        endDate: toDate(item.untilDate || t.endDate),
        expectedDate: f === "ONE_TIME" ? toDate(item.nextDate || item.expectedDate || t.startDate) : null
      };
    });

  const lifeCosts = (t.lifeCosts || [])
    .filter((item) => item.enabled !== false && item.canPause !== true && positive(item.amountBase) > 0)
    .map((item) => {
      const f = frequency(item.frequency, "MONTHLY");
      return {
        amount: positive(item.amountBase),
        currency: baseCurrency,
        frequency: f === "TRIP_TOTAL" ? "ONE_TIME" : f,
        startDate: f === "MONTHLY" ? toDate(item.nextDate || t.startDate) : null,
        endDate: toDate(item.untilDate || t.endDate),
        dueDate: f === "ONE_TIME" ? toDate(item.nextDate || t.startDate) : null
      };
    });

  return { trip, tripCosts, installments, incomes, lifeCosts };
}

// ----- cashflow_engine.ts (occurrenceDates + PATCHED tripCost total) -----
function occurrenceDates(item, trip, max = 36) {
  if (!item.startDate) return [];
  const end = item.endDate || trip.returnDate || item.startDate;
  if (item.startDate > end) return [];
  const limit = Math.max(1, Math.min(item.remainingMonths || max, max));
  const out = [];
  let current = new Date(item.startDate);
  let count = 0;
  while (current <= end && count < limit) { out.push(new Date(current)); current = addMonths(current, 1); count += 1; }
  return out;
}

function tripCostEffectiveAmount(item, trip) {
  return sharedTripCostEffectiveTotal({
    amount: item.amount,
    frequency: String(item.frequency || "TRIP_TOTAL").toLowerCase().replace(/_/g, "-"),
    dueDate: item.dueDate ? item.dueDate.toISOString().slice(0, 10) : ""
  }, {
    startDate: trip.departureDate ? trip.departureDate.toISOString().slice(0, 10) : "",
    endDate: trip.returnDate ? trip.returnDate.toISOString().slice(0, 10) : ""
  });
}
export function backendTripCostTotal(tripCosts, trip) {
  return tripCosts.reduce((sum, item) => sum + toTripCurrency(tripCostEffectiveAmount(item, trip), item.currency, trip.tripCurrency, trip.exchangeRate), 0);
}

function installmentOccurrences(items, trip) {
  return items.flatMap((item) => {
    const dates = item.frequency === "MONTHLY"
      ? occurrenceDates(item, trip, item.remainingMonths || 36)
      : (item.startDate ? [item.startDate] : []);
    const safeDates = dates.length ? dates : [item.startDate || trip.departureDate || new Date()];
    return safeDates.map((date) => ({ date, amount: toTripCurrency(item.amount, item.currency, trip.tripCurrency, trip.exchangeRate) }));
  });
}
export function backendInstallmentInfo(installments, trip) {
  const rows = installmentOccurrences(installments, trip);
  // Mirrors scoreTripSummary's "continuing" signal.
  const continuing = installments.some((i) => i.status !== "PAID" && (i.remainingMonths || 0) > 1);
  return { count: rows.length, total: rows.reduce((s, r) => s + r.amount, 0), continuing };
}


function dateInPlanningWindow(date, trip) {
  if (!date) return false;
  const end = trip.returnDate || trip.departureDate || date;
  return date <= end;
}
function recurringOccurrenceTotal(item, trip) {
  if (item.frequency === "MONTHLY") return item.amount * occurrenceDates(item, trip, 36).length;
  const onceDate = item.expectedDate || item.dueDate || item.startDate;
  return dateInPlanningWindow(onceDate, trip) ? item.amount : 0;
}
export function backendIncomeTotal(incomes, trip) {
  return incomes.reduce((sum, item) => sum + toTripCurrency(recurringOccurrenceTotal(item, trip), item.currency, trip.tripCurrency, trip.exchangeRate), 0);
}
export function backendLifeCostTotal(lifeCosts, trip) {
  return lifeCosts.reduce((sum, item) => sum + toTripCurrency(recurringOccurrenceTotal(item, trip), item.currency, trip.tripCurrency, trip.exchangeRate), 0);
}
export function backendAvailableFromClientTrip(clientTrip) {
  const mapped = mapClientTrip(clientTrip);
  const starting = toTripCurrency(num(clientTrip.startingSavingsBase || 0), mapped.trip.incomeCurrency, mapped.trip.tripCurrency, mapped.trip.exchangeRate);
  const support = num(clientTrip.supportLocal || 0);
  return starting + support + backendIncomeTotal(mapped.incomes, mapped.trip) - backendLifeCostTotal(mapped.lifeCosts, mapped.trip) - backendInstallmentInfo(mapped.installments, mapped.trip).total;
}


function monthKey(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}
function backendCashflowEverNegative(clientTrip, mapped) {
  const monthly = new Map();
  const add = (date, amount) => monthly.set(monthKey(date), (monthly.get(monthKey(date)) || 0) + amount);
  mapped.incomes.forEach((item) => {
    const dates = item.frequency === "MONTHLY" ? occurrenceDates(item, mapped.trip, 36) : (dateInPlanningWindow(item.expectedDate || item.startDate, mapped.trip) ? [item.expectedDate || item.startDate || mapped.trip.departureDate || new Date()] : []);
    dates.forEach((date) => add(date, toTripCurrency(item.amount, item.currency, mapped.trip.tripCurrency, mapped.trip.exchangeRate)));
  });
  mapped.lifeCosts.forEach((item) => {
    const dates = item.frequency === "MONTHLY" ? occurrenceDates(item, mapped.trip, 36) : [item.dueDate || item.startDate || mapped.trip.departureDate || new Date()];
    dates.forEach((date) => add(date, -toTripCurrency(item.amount, item.currency, mapped.trip.tripCurrency, mapped.trip.exchangeRate)));
  });
  mapped.installments.forEach((item) => {
    const dates = item.frequency === "MONTHLY" ? occurrenceDates(item, mapped.trip, item.remainingMonths || 36) : [item.startDate || mapped.trip.departureDate || new Date()];
    dates.forEach((date) => add(date, -toTripCurrency(item.amount, item.currency, mapped.trip.tripCurrency, mapped.trip.exchangeRate)));
  });
  let running = toTripCurrency(num(clientTrip.startingSavingsBase || 0), mapped.trip.incomeCurrency, mapped.trip.tripCurrency, mapped.trip.exchangeRate);
  for (const key of [...monthly.keys()].sort()) {
    running += monthly.get(key) || 0;
    if (running < 0) return true;
  }
  return false;
}

export function backendDecisionFromClientTrip(clientTrip) {
  const mapped = mapClientTrip(clientTrip);
  const planned = backendTripCostTotal(mapped.tripCosts, mapped.trip);
  const available = backendAvailableFromClientTrip(clientTrip) - toTripCurrency(
    clientTrip.scenario?.reserveAfterTripBase ? num(clientTrip.scenario?.reserveAmountBase || 0) : 0,
    mapped.trip.incomeCurrency,
    mapped.trip.tripCurrency,
    mapped.trip.exchangeRate
  );
  const reserve = toTripCurrency(
    clientTrip.scenario?.reserveAfterTripBase ? num(clientTrip.scenario?.reserveAmountBase || 0) : 0,
    mapped.trip.incomeCurrency,
    mapped.trip.tripCurrency,
    mapped.trip.exchangeRate
  );
  const emergency = mapped.tripCosts
    .filter((item) => String(item.category || item.title || "").toLowerCase().includes("emergency"))
    .reduce((sum, item) => sum + toTripCurrency(tripCostEffectiveAmount(item, mapped.trip), item.currency, mapped.trip.tripCurrency, mapped.trip.exchangeRate), 0);
  const remaining = available - planned;
  return evaluateDecision({
    planned,
    available,
    paid: 0,
    remaining,
    gap: Math.max(0, planned - available),
    emergency,
    reserve,
    comfort: clientTrip.comfortLevel || clientTrip.travelStyle || "Balanced",
    rateUnsure: Boolean(clientTrip.rateNeedsReview || (mapped.trip.incomeCurrency !== mapped.trip.tripCurrency && mapped.trip.exchangeRate <= 0)),
    hasIncome: mapped.incomes.some((item) => item.amount > 0),
    hasDates: Boolean(mapped.trip.departureDate && mapped.trip.returnDate),
    continuingInstallments: (clientTrip.installments || []).some((item) => item.enabled !== false && item.continuesAfterTrip),
    everNegative: backendCashflowEverNegative(clientTrip, mapped),
    returnWithZero: Boolean(clientTrip.returnWithZero)
  });
}
