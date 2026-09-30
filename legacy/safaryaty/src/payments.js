import { normalizeTripCostFrequency, tripCostOccurrenceDates, tripCostPaymentOccurrences } from "../shared/trip-cost-domain.js";
// Safaryaty payment schedule engine — pure and testable.
// Converts origin commitments + destination costs into To Pay rows.

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const iso = (date) => date.toISOString().slice(0, 10);
const validDate = (value, fallback) => {
  const d = new Date(value || fallback || new Date());
  return Number.isNaN(d.getTime()) ? new Date() : d;
};
const addDays = (date, days) => { const d = new Date(date); d.setDate(d.getDate() + days); return d; };
const addMonths = (date, months) => {
  const d = new Date(date);
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() < day) d.setDate(0);
  return d;
};
export const daysBetween = (a, b) => Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000));
export const tripMonths = (trip) => Math.max(1, Math.ceil(daysBetween(trip?.startDate, trip?.endDate) / 30));

function buildRecurringDates(item, trip, maxCount = 36) {
  const freq = (item.frequency || "monthly").toLowerCase();
  const start = validDate(item.nextDate || item.dueDate || item.startDate, trip.startDate);
  const tripEnd = validDate(trip.endDate, trip.startDate);
  if (["one-time", "trip-total", "setup"].includes(freq)) return start <= tripEnd ? [iso(start)] : [];
  const until = validDate(item.untilDate || item.endDate, trip.endDate);
  if (start > until) return [];
  const out = [];
  let current = start;
  let count = 0;
  while (current <= until && count < maxCount) {
    out.push(iso(current));
    if (freq === "daily") current = addDays(current, 1);
    else if (freq === "weekly") current = addDays(current, 7);
    else if (freq === "yearly") current = addMonths(current, 12);
    else current = addMonths(current, 1);
    count += 1;
  }
  return out;
}

function paymentStatus(trip, id, hardPaid = false) {
  if (hardPaid) return "paid";
  return trip?.paidPayments?.[id] ? "paid" : "upcoming";
}

// ---------- canonical destination occurrence helpers ----------
export function monthlyOccurrenceDates(startDate, endDate, maxCount = 36) {
  return tripCostOccurrenceDates({ frequency: "monthly", nextDate: startDate, untilDate: endDate }, { startDate, endDate }, maxCount);
}

export function dailyOccurrenceDates(startDate, days) {
  const end = iso(addDays(validDate(startDate, startDate), Math.max(1, num(days)) - 1));
  return tripCostOccurrenceDates({ frequency: "daily", nextDate: startDate, untilDate: end }, { startDate, endDate: end });
}

export function destinationOccurrenceCount(item, trip) {
  return Math.max(1, tripCostOccurrenceDates(item, trip).length);
}

function destinationLabel(item, index, total, occurrence) {
  const base = item.name || item.title || "Destination Cost";
  const frequency = normalizeTripCostFrequency(item.frequency, item.costType);
  if (frequency === "daily") return `${base} · ${occurrence.units} day${occurrence.units === 1 ? "" : "s"}`;
  if (total <= 1) return base;
  if (frequency === "monthly") return `${base} · Month ${index + 1}`;
  if (frequency === "weekly") return `${base} · Week ${index + 1}`;
  if (frequency === "yearly") return `${base} · Year ${index + 1}`;
  return base;
}

function destinationRows(trip) {
  return (trip.budget || []).flatMap((item) => {
    const occurrences = tripCostPaymentOccurrences(item, trip);
    return occurrences.map((occurrence, index) => {
      const id = `cost-${item.id}-${index}`;
      const frequency = normalizeTripCostFrequency(item.frequency, item.costType);
      return {
        id,
        itemId: item.id,
        date: occurrence.date,
        type: "expense",
        source: "Destination Cost",
        group: "destination",
        name: destinationLabel(item, index, occurrences.length, occurrence),
        amount: occurrence.amount,
        currency: trip.tripCurrency,
        originalAmount: occurrence.amount,
        originalCurrency: trip.tripCurrency,
        costType: String(item.costType || frequency).toUpperCase().replace(/-/g, "_"),
        frequency,
        priority: item.priority || "Flexible",
        status: paymentStatus(trip, id, !!item.paid)
      };
    });
  });
}

function incomeRows(trip) {
  return (trip.incomeSources || []).flatMap((item) => {
    if (!item.enabled) return [];
    return buildRecurringDates(item, trip).map((date, index) => ({
      id: `inc-${item.id}-${index}`,
      itemId: item.id,
      date,
      type: "income",
      source: "Money In",
      group: "income",
      name: item.name || "Income",
      amount: num(item.amountBase),
      currency: trip.baseCurrency,
      status: "expected",
      frequency: item.frequency || "monthly"
    }));
  });
}

function lifeRows(trip) {
  return (trip.lifeCosts || []).flatMap((item) => {
    if (!item.enabled || item.canPause) return [];
    return buildRecurringDates(item, trip).map((date, index) => {
      const id = `life-${item.id}-${index}`;
      return {
        id,
        itemId: item.id,
        date,
        type: "expense",
        source: "Existing Commitment",
        group: "origin",
        name: item.name || "Commitment",
        amount: num(item.amountBase),
        currency: trip.baseCurrency,
        status: paymentStatus(trip, id),
        frequency: item.frequency || "monthly"
      };
    });
  });
}

function installmentRows(trip) {
  return (trip.installments || []).flatMap((item) => {
    if (!item.enabled) return [];
    const months = num(item.remainingMonths) || tripMonths(trip);
    return buildRecurringDates(item, trip, months).slice(0, months).map((date, index) => {
      const id = `inst-${item.id}-${index}`;
      return {
        id,
        itemId: item.id,
        date,
        type: "expense",
        source: "Monthly Payment",
        group: "installment",
        name: item.name || "Installment",
        amount: num(item.monthlyBase),
        currency: trip.baseCurrency,
        status: paymentStatus(trip, id),
        frequency: "monthly",
        note: `${months} month${months === 1 ? "" : "s"} scheduled`
      };
    });
  });
}

export function buildPaymentSchedule(trip) {
  return [
    ...incomeRows(trip),
    ...lifeRows(trip),
    ...installmentRows(trip),
    ...destinationRows(trip)
  ].sort((a, b) => String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
}

export function splitPayments(rows) {
  const payments = rows.filter((row) => row.type !== "income");
  return {
    upcoming: payments.filter((row) => row.status !== "paid"),
    paid: payments.filter((row) => row.status === "paid"),
    income: rows.filter((row) => row.type === "income")
  };
}
