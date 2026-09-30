import type { Expense, Income, Installment, LifeCost, PaymentMark, Trip, TripCost } from "@prisma/client";
import { displayCard, displayCurrencyFor, toTripCurrency } from "./currency.js";
import { evaluateDecision } from "../../../../shared/decision-engine.js";
import { canonicalTripCategory } from "./categories.js";
import { calculatePlannerAffordability, summarizeTrackedOutgoings } from "../../../../shared/finance-ledger.js";
import { readFinanceSettingsFromTripRow } from "../../../../shared/trip-finance-profile.js";
import { canonicalTripCategory as sharedCanonicalTripCategory, normalizeTripCostFrequency, tripCostEffectiveTotal as sharedTripCostEffectiveTotal, tripCostPaymentOccurrences } from "../../../../shared/trip-cost-domain.js";

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) next.setDate(0);
  return next;
}

function occurrenceDates(item: { startDate: Date | null; endDate: Date | null; remainingMonths?: number | null }, trip: Trip, max = 36) {
  if (!item.startDate) return [];
  const end = item.endDate || trip.returnDate || item.startDate;
  if (item.startDate > end) return [];
  const limit = Math.max(1, Math.min(item.remainingMonths || max, max));
  const out: Date[] = [];
  let current = new Date(item.startDate);
  let count = 0;
  while (current <= end && count < limit) {
    out.push(new Date(current));
    current = addMonths(current, 1);
    count += 1;
  }
  return out;
}

function dateInPlanningWindow(date: Date | null | undefined, trip: Trip) {
  if (!date) return false;
  const end = trip.returnDate || trip.departureDate || date;
  return date <= end;
}

function recurringOccurrenceTotal(item: { amount: number; startDate: Date | null; endDate: Date | null; expectedDate?: Date | null; dueDate?: Date | null; frequency?: string }, trip: Trip) {
  if (item.frequency === "MONTHLY") {
    return item.amount * occurrenceDates(item, trip, 36).length;
  }
  const onceDate = item.expectedDate || item.dueDate || item.startDate;
  return dateInPlanningWindow(onceDate, trip) ? item.amount : 0;
}

function incomeTotal(incomes: Income[], trip: Trip) {
  return incomes.reduce((sum, item) => {
    const raw = recurringOccurrenceTotal(item, trip);
    return sum + toTripCurrency(raw, item.currency, trip.tripCurrency, trip.exchangeRate);
  }, 0);
}

function paymentMarkMap(paymentMarks: PaymentMark[] = []) {
  return new Map(paymentMarks.map((mark) => [mark.paymentKey, mark]));
}

function installmentOccurrences(items: Installment[], trip: Trip, paymentMarks: PaymentMark[] = []) {
  const marks = paymentMarkMap(paymentMarks);
  return items.flatMap((item) => {
    const dates = item.frequency === "MONTHLY" ? occurrenceDates(item, trip, item.remainingMonths || 36) : (item.startDate ? [item.startDate] : []);
    const safeDates = dates.length ? dates : [item.startDate || trip.departureDate || new Date()];
    return safeDates.map((date, index) => {
      const key = `inst-${item.id}-${index}`;
      const mark = marks.get(key);
      const isRecurring = item.frequency === "MONTHLY";
      const isPaid = mark ? mark.status === "PAID" : (!isRecurring && item.status === "PAID");
      return {
        id: key,
        itemId: item.id,
        date,
        title: item.title,
        amount: toTripCurrency(item.amount, item.currency, trip.tripCurrency, trip.exchangeRate),
        originalAmount: item.amount,
        originalCurrency: item.currency,
        source: "Installment",
        status: isPaid ? "PAID" : "UNPAID",
        paidDate: mark?.paidDate || (!isRecurring ? item.paidDate : null) || null
      };
    });
  });
}

function unpaidInstallmentTotal(items: Installment[], trip: Trip, paymentMarks: PaymentMark[] = []) {
  return installmentOccurrences(items, trip, paymentMarks)
    .filter((item) => item.status !== "PAID")
    .reduce((sum, item) => sum + item.amount, 0);
}

function lifeCostOccurrences(items: LifeCost[], trip: Trip, paymentMarks: PaymentMark[] = []) {
  const marks = paymentMarkMap(paymentMarks);
  return items.flatMap((item) => {
    const dates = item.frequency === "MONTHLY"
      ? occurrenceDates(item, trip, 36)
      : (item.dueDate ? [item.dueDate] : (item.startDate ? [item.startDate] : []));
    const safeDates = dates.length ? dates : [item.dueDate || item.startDate || trip.departureDate || new Date()];
    return safeDates.map((date, index) => {
      // Canonical occurrence keys always include an index, including one-time rows.
      // Legacy keys are still read so existing PaymentMark records remain valid.
      const key = `life-${item.id}-${index}`;
      const legacyMark = item.frequency === "MONTHLY" ? undefined : marks.get(`life-${item.id}`);
      const mark = marks.get(key) || legacyMark;
      const amount = toTripCurrency(item.amount, item.currency, trip.tripCurrency, trip.exchangeRate);
      return {
        id: key,
        itemId: item.id,
        date,
        title: item.frequency === "MONTHLY" ? `${item.title} · Month ${index + 1}` : item.title,
        amount,
        source: "Monthly Bill",
        status: mark?.status || "UNPAID",
        paidDate: mark?.paidDate || null
      };
    });
  });
}

function unpaidLifeCostTotal(items: LifeCost[], trip: Trip, paymentMarks: PaymentMark[] = []) {
  return lifeCostOccurrences(items, trip, paymentMarks)
    .filter((item) => item.status !== "PAID")
    .reduce((sum, item) => sum + item.amount, 0);
}

// Canonical trip-cost frequency and occurrence truth shared with the frontend.
function tripCostDomainTrip(trip: Trip) {
  return {
    startDate: trip.departureDate?.toISOString().slice(0, 10) || "",
    endDate: trip.returnDate?.toISOString().slice(0, 10) || trip.departureDate?.toISOString().slice(0, 10) || ""
  };
}

function tripCostDomainItem(item: TripCost) {
  return {
    amount: item.amount,
    frequency: String(item.frequency || "TRIP_TOTAL").toLowerCase().replace(/_/g, "-"),
    dueDate: item.dueDate?.toISOString().slice(0, 10) || ""
  };
}

function tripCostEffectiveAmount(item: TripCost, trip: Trip) {
  return sharedTripCostEffectiveTotal(tripCostDomainItem(item), tripCostDomainTrip(trip));
}

export function tripCostCategoryTotals(items: TripCost[], trip: Trip) {
  return items.reduce<Record<string, number>>((out, item) => {
    const categoryId = sharedCanonicalTripCategory(item.category || item.title);
    const amount = toTripCurrency(tripCostEffectiveAmount(item, trip), item.currency, trip.tripCurrency, trip.exchangeRate);
    out[categoryId] = (out[categoryId] || 0) + amount;
    return out;
  }, {});
}

function tripCostOccurrences(items: TripCost[], trip: Trip, paymentMarks: PaymentMark[] = []) {
  const marks = paymentMarkMap(paymentMarks);
  return items.flatMap((item) => {
    const occurrences = tripCostPaymentOccurrences(tripCostDomainItem(item), tripCostDomainTrip(trip));
    const frequency = normalizeTripCostFrequency(String(item.frequency || "TRIP_TOTAL").toLowerCase().replace(/_/g, "-"));
    return occurrences.map((occurrence, index) => {
      const key = `cost-${item.id}-${index}`;
      const legacyMark = ["TRIP_TOTAL", "ONE_TIME"].includes(String(item.frequency)) ? marks.get(`cost-${item.id}`) : undefined;
      const mark = marks.get(key) || legacyMark;
      const isRecurring = !["trip-total", "one-time", "daily"].includes(frequency);
      const status = mark?.status || (!isRecurring ? item.status : "UNPAID");
      const title = frequency === "daily"
        ? `${item.title} · ${occurrence.units} day${occurrence.units === 1 ? "" : "s"}`
        : occurrences.length > 1
          ? `${item.title} · ${frequency === "monthly" ? "Month" : frequency === "weekly" ? "Week" : "Year"} ${index + 1}`
          : item.title;
      return {
        id: key,
        itemId: item.id,
        date: new Date(occurrence.date),
        title,
        amount: toTripCurrency(occurrence.amount, item.currency, trip.tripCurrency, trip.exchangeRate),
        originalAmount: occurrence.amount,
        originalCurrency: item.currency,
        source: "Trip Cost",
        status,
        paidDate: mark?.paidDate || (!isRecurring ? item.paidDate : null)
      };
    });
  });
}

function tripCostTotal(costs: TripCost[], trip: Trip) {
  return costs.reduce((sum, item) => sum + toTripCurrency(tripCostEffectiveAmount(item, trip), item.currency, trip.tripCurrency, trip.exchangeRate), 0);
}

function paymentMarkStatus(paymentMarks: PaymentMark[] = [], paymentKey: string) {
  return paymentMarks.find((mark) => mark.paymentKey === paymentKey)?.status || null;
}

function snapshotFromTrip(trip: Trip): any {
  try {
    const parsed = JSON.parse((trip as any).notes || "{}");
    return parsed?.trip || parsed || {};
  } catch {
    return {};
  }
}

function snapshotCashAdjustments(trip: Trip) {
  const settings = readFinanceSettingsFromTripRow(trip as any);
  const reserveBase = settings.reserveEnabled ? Number(settings.safetyReserve || 0) : 0;
  return {
    source: settings.source,
    startingSavings: toTripCurrency(Number(settings.startingSavings || 0), trip.incomeCurrency, trip.tripCurrency, trip.exchangeRate),
    support: Number(settings.supportMoney || 0),
    reserve: toTripCurrency(reserveBase, trip.incomeCurrency, trip.tripCurrency, trip.exchangeRate)
  };
}

function paidTripCosts(costs: TripCost[], trip: Trip, paymentMarks: PaymentMark[] = []) {
  return tripCostOccurrences(costs, trip, paymentMarks)
    .filter((item) => item.status === "PAID")
    .reduce((sum, item) => sum + item.amount, 0);
}

function paidInstallments(items: Installment[], trip: Trip, paymentMarks: PaymentMark[] = []) {
  return installmentOccurrences(items, trip, paymentMarks).filter((item) => item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
}

function paidLifeCosts(items: LifeCost[], trip: Trip, paymentMarks: PaymentMark[] = []) {
  return lifeCostOccurrences(items, trip, paymentMarks).filter((item) => item.status === "PAID").reduce((sum, item) => sum + item.amount, 0);
}

function expenseTotal(expenses: Expense[], trip: Trip) {
  return expenses.reduce((sum, item) => sum + toTripCurrency(item.amount, item.currency, trip.tripCurrency, trip.exchangeRate), 0);
}


function daysBetweenTrip(trip: Trip) {
  if (!trip.departureDate || !trip.returnDate) return 0;
  return Math.max(1, Math.ceil((trip.returnDate.getTime() - trip.departureDate.getTime()) / 86400000));
}

function tripLengthTypeFor(trip: Trip) {
  const days = daysBetweenTrip(trip);
  if (!days) return "UNSET";
  if (days <= 3) return "SHORT";
  if (days <= 10) return "MEDIUM";
  if (days <= 30) return "LONG";
  return "EXTENDED";
}

function tripModeFor(trip: Trip) {
  const snap = snapshotFromTrip(trip);
  const purpose = snap.tripPurpose || snap.tripType || "Short Trip";
  const length = tripLengthTypeFor(trip);
  if (["Study Trip", "Relocation Trip"].includes(purpose)) return "HYBRID";
  if (purpose === "Long Stay") return "LONG_MONTHLY";
  if (length === "EXTENDED") return ["Family Visit", "Business Trip", "Medical Trip"].includes(purpose) ? "HYBRID" : "LONG_MONTHLY";
  return "SHORT_TOTAL";
}


function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function cashflowEverNegative(input: { trip: Trip; incomes: Income[]; lifeCosts: LifeCost[]; installments: Installment[]; startingSavings: number }) {
  const { trip, incomes, lifeCosts, installments, startingSavings } = input;
  const monthly = new Map<string, number>();
  const add = (date: Date, amount: number) => monthly.set(monthKey(date), (monthly.get(monthKey(date)) || 0) + amount);

  incomes.forEach((item) => {
    const dates = item.frequency === "MONTHLY"
      ? occurrenceDates(item, trip, 36)
      : (dateInPlanningWindow(item.expectedDate || item.startDate, trip) ? [item.expectedDate || item.startDate || trip.departureDate || new Date()] : []);
    dates.forEach((date) => add(date, toTripCurrency(item.amount, item.currency, trip.tripCurrency, trip.exchangeRate)));
  });
  lifeCostOccurrences(lifeCosts, trip).forEach((item) => add(item.date, -item.amount));
  installmentOccurrences(installments, trip).forEach((item) => add(item.date, -item.amount));

  let running = startingSavings;
  for (const key of [...monthly.keys()].sort()) {
    running += monthly.get(key) || 0;
    if (running < 0) return true;
  }
  return false;
}

function backendDecisionInput(input: {
  trip: Trip; incomes: Income[]; lifeCosts: LifeCost[]; installments: Installment[]; tripCosts: TripCost[];
  tripCost: number; available: number; paid: number; remaining: number; stillNeeded: number; reserve: number; startingSavings: number;
}) {
  const { trip, incomes, lifeCosts, installments, tripCosts, tripCost, available, paid, remaining, stillNeeded, reserve, startingSavings } = input;
  const snap = snapshotFromTrip(trip);
  const financeSettings = readFinanceSettingsFromTripRow(trip as any);
  const snapshotInstallments = Array.isArray(snap.installments) ? snap.installments : [];
  const continuingInstallments = snapshotInstallments.length
    ? snapshotInstallments.some((item: any) => item?.enabled !== false && item?.continuesAfterTrip)
    : installments.some((item) => item.status !== "PAID" && (item.remainingMonths || 0) > 1);
  const emergency = tripCosts
    .filter((item) => String(item.category || item.title || "").toLowerCase().includes("emergency"))
    .reduce((sum, item) => sum + toTripCurrency(tripCostEffectiveAmount(item, trip), item.currency, trip.tripCurrency, trip.exchangeRate), 0);

  return {
    planned: tripCost,
    available,
    paid,
    remaining,
    gap: stillNeeded,
    emergency,
    reserve,
    comfort: snap.comfortLevel || snap.travelStyle || (trip as any).travelStyle || "Balanced",
    rateUnsure: Boolean(snap.rateNeedsReview || (trip.incomeCurrency !== trip.tripCurrency && (!trip.exchangeRate || trip.exchangeRate <= 0))),
    hasIncome: incomes.some((item) => item.amount > 0),
    hasDates: Boolean(trip.departureDate && trip.returnDate),
    continuingInstallments,
    everNegative: cashflowEverNegative({ trip, incomes, lifeCosts, installments, startingSavings }),
    returnWithZero: Boolean(financeSettings.returnWithZero),
  };
}

function backendStatus(verdict: string) {
  if (verdict === "READY") return "READY";
  if (verdict === "ALMOST" || verdict === "TIGHT") return "TIGHT";
  return "NEEDS_ADJUSTMENT";
}

function backendDecisionCopy(reasonCode: string, gap: number, currency: string) {
  if (reasonCode === "READY") return { headline: "Your trip looks ready.", message: "You have enough room for this plan." };
  if (reasonCode === "COVERED_BUT_THIN_BUFFER" || reasonCode === "STRENGTHEN_SAFETY_OR_TIMING" || reasonCode === "WEAK_TIMING_OR_BUFFER") {
    return { headline: "Your trip is possible but tight.", message: "Keep optional spending flexible and watch payments." };
  }
  if (reasonCode === "EXCHANGE_RATE_UNCONFIRMED") return { headline: "Confirm the exchange rate first.", message: "Safaryaty cannot trust this plan until the exchange rate is updated." };
  if (reasonCode === "MISSING_TRIP_COSTS") return { headline: "Add destination costs first.", message: "Safaryaty needs the main trip costs before it can judge the plan." };
  return { headline: "Your trip needs adjustment.", message: `You need about ${Math.ceil(Math.max(0, gap))} ${currency} more or a cheaper plan.` };
}


export function calculateTrip(input: { trip: Trip; incomes: Income[]; lifeCosts: LifeCost[]; installments: Installment[]; tripCosts: TripCost[]; expenses: Expense[]; paymentMarks?: PaymentMark[] }) {
  const { trip, incomes, lifeCosts, installments, tripCosts, expenses, paymentMarks = [] } = input;
  const totalIncome = incomeTotal(incomes, trip);
  // Planner truth: all scheduled commitments remain part of affordability.
  // PaymentMark changes progress only; it never creates additional Ready Money.
  const totalLifeCosts = lifeCostOccurrences(lifeCosts, trip, paymentMarks).reduce((sum, item) => sum + item.amount, 0);
  const totalInstallments = installmentOccurrences(installments, trip, paymentMarks).reduce((sum, item) => sum + item.amount, 0);
  const adjustments = snapshotCashAdjustments(trip);
  const tripCost = tripCostTotal(tripCosts, trip);
  const affordability = calculatePlannerAffordability({
    startingSavings: adjustments.startingSavings,
    expectedIncome: totalIncome,
    supportMoney: adjustments.support,
    safetyReserve: adjustments.reserve,
    originCommitments: totalLifeCosts + totalInstallments,
    tripPlanCost: tripCost
  });
  const available = affordability.readyMoney;
  const paidTrip = paidTripCosts(tripCosts, trip, paymentMarks);
  const paid = paidTrip + paidInstallments(installments, trip, paymentMarks) + paidLifeCosts(lifeCosts, trip, paymentMarks);
  const expensesTotal = expenseTotal(expenses, trip);
  const stillNeeded = affordability.needToSave;
  const remaining = affordability.afterTripPosition;

  const displayCurrency = displayCurrencyFor(trip);
  const snap = snapshotFromTrip(trip);
  const plan = { tripLengthDays: daysBetweenTrip(trip), tripLengthType: tripLengthTypeFor(trip), tripMode: tripModeFor(trip), tripPurpose: snap.tripPurpose || snap.tripType || null, travelStyle: snap.travelStyle || (trip as any).travelStyle || null };
  const decision = evaluateDecision(backendDecisionInput({
    trip, incomes, lifeCosts, installments, tripCosts, tripCost, available, paid, remaining, stillNeeded,
    reserve: adjustments.reserve, startingSavings: adjustments.startingSavings
  }));
  const status = backendStatus(decision.verdict);
  const copy = backendDecisionCopy(decision.reasonCode, decision.gap, trip.tripCurrency);
  const headline = copy.headline;
  const message = copy.message;

  const installmentRows = installmentOccurrences(installments, trip, paymentMarks)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item) => ({ ...item, displayAmount: displayCard(item.amount, trip), displayCurrency, date: item.date.toISOString().slice(0, 10), paidDate: item.paidDate ? item.paidDate.toISOString().slice(0, 10) : null }));

  const tripCostRows = tripCostOccurrences(tripCosts, trip, paymentMarks)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item) => ({
      ...item,
      amount: Math.round(item.amount),
      displayAmount: displayCard(item.amount, trip),
      displayCurrency,
      date: item.date ? item.date.toISOString().slice(0, 10) : null,
      paidDate: item.paidDate ? item.paidDate.toISOString().slice(0, 10) : null
    }));

  const lifeCostRows = lifeCostOccurrences(lifeCosts, trip, paymentMarks)
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .map((item) => ({
      ...item,
      amount: Math.round(item.amount),
      displayAmount: displayCard(item.amount, trip),
      displayCurrency,
      date: item.date.toISOString().slice(0, 10),
      paidDate: item.paidDate ? item.paidDate.toISOString().slice(0, 10) : null
    }));

  const payments = [...lifeCostRows, ...installmentRows, ...tripCostRows];
  const ledger = summarizeTrackedOutgoings(payments.map((item: any) => ({
    type: "expense",
    status: item.status === "PAID" ? "paid" : "upcoming",
    amount: item.amount
  })));

  const incomeEvents = incomes.flatMap((item) => {
    const dates = item.frequency === "MONTHLY" ? occurrenceDates(item, trip, 36) : (dateInPlanningWindow(item.expectedDate || item.startDate, trip) ? [item.expectedDate || item.startDate || trip.departureDate || new Date()] : []);
    return dates.map((date, index) => {
      const amount = toTripCurrency(item.amount, item.currency, trip.tripCurrency, trip.exchangeRate);
      return {
        id: item.frequency === "MONTHLY" ? `income-${item.id}-${index}` : `income-${item.id}`,
        itemId: item.id,
        type: "INCOME",
        title: item.frequency === "MONTHLY" ? `${item.title} · Month ${index + 1}` : item.title,
        date: date.toISOString().slice(0, 10),
        amount: Math.round(amount),
        displayAmount: displayCard(amount, trip),
        currency: trip.tripCurrency,
        displayCurrency,
        status: "EXPECTED",
        source: "Income"
      };
    });
  });

  const lifeCostEvents: any[] = [];

  const paymentEvents = payments.map((item: any) => ({
    id: item.id,
    itemId: item.itemId,
    type: item.source === "Installment" ? "INSTALLMENT" : item.source === "Monthly Bill" ? "LIFE_COST" : "TRIP_COST",
    title: item.title,
    date: item.date,
    amount: item.amount,
    displayAmount: item.displayAmount,
    currency: trip.tripCurrency,
    displayCurrency,
    status: item.status === "PAID" ? "PAID" : "UPCOMING",
    source: item.source
  }));

  const events = [...incomeEvents, ...lifeCostEvents, ...paymentEvents]
    .sort((a: any, b: any) => String(a.date || "").localeCompare(String(b.date || "")));

  return {
    currency: trip.tripCurrency,
    displayCurrency,
    status,
    headline,
    message,
    plan,
    readiness: decision.readiness,
    scoreFactors: decision.scoreFactors,
    verdict: decision.verdict,
    decision,
    cards: {
      available: Math.round(available),
      tripCost: Math.round(tripCost),
      stillNeeded: Math.round(stillNeeded),
      paid: Math.round(ledger.paidSoFar),
      stillToPay: Math.round(ledger.stillToPay),
      totalTrackedOutgoings: Math.round(ledger.totalTrackedOutgoings)
    },
    displayCards: {
      available: displayCard(available, trip),
      tripCost: displayCard(tripCost, trip),
      stillNeeded: displayCard(stillNeeded, trip),
      paid: displayCard(ledger.paidSoFar, trip),
      stillToPay: displayCard(ledger.stillToPay, trip),
      totalTrackedOutgoings: displayCard(ledger.totalTrackedOutgoings, trip)
    },
    details: {
      totalIncome: Math.round(totalIncome),
      totalLifeCosts: Math.round(totalLifeCosts),
      totalInstallments: Math.round(totalInstallments),
      startingSavings: Math.round(adjustments.startingSavings),
      support: Math.round(adjustments.support),
      reserve: Math.round(adjustments.reserve),
      expenses: Math.round(expensesTotal),
      remaining: Math.round(remaining),
      fundingPool: Math.round(affordability.fundingPool),
      financeProfileSource: adjustments.source,
      originCommitments: Math.round(affordability.originCommitments),
      totalTrackedOutgoings: Math.round(ledger.totalTrackedOutgoings),
      stillToPay: Math.round(ledger.stillToPay),
      paymentInvariantDelta: Math.round(ledger.invariantDelta)
    },
    displayDetails: {
      totalIncome: displayCard(totalIncome, trip),
      totalLifeCosts: displayCard(totalLifeCosts, trip),
      totalInstallments: displayCard(totalInstallments, trip),
      startingSavings: displayCard(adjustments.startingSavings, trip),
      support: displayCard(adjustments.support, trip),
      reserve: displayCard(adjustments.reserve, trip),
      expenses: displayCard(expensesTotal, trip),
      remaining: displayCard(remaining, trip),
      fundingPool: displayCard(affordability.fundingPool, trip),
      originCommitments: displayCard(affordability.originCommitments, trip),
      totalTrackedOutgoings: displayCard(ledger.totalTrackedOutgoings, trip),
      stillToPay: displayCard(ledger.stillToPay, trip)
    },
    ledger: {
      version: ledger.version,
      paidSoFar: Math.round(ledger.paidSoFar),
      stillToPay: Math.round(ledger.stillToPay),
      totalTrackedOutgoings: Math.round(ledger.totalTrackedOutgoings),
      invariantDelta: Math.round(ledger.invariantDelta),
      paidCount: ledger.paidCount,
      upcomingCount: ledger.upcomingCount
    },
    payments: {
      upcoming: payments.filter((item) => item.status !== "PAID"),
      paid: payments.filter((item) => item.status === "PAID")
    },
    events
  };
}
