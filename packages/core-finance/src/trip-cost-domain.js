export const TRIP_COST_CATEGORIES = Object.freeze([
  { id: "cat-flight", label: "Flights", priority: "MUST", timing: "before", estimateKey: "flight" },
  { id: "cat-accommodation", label: "Accommodation", priority: "MUST", timing: "during", estimateKey: "accommodation" },
  { id: "cat-food", label: "Food & Cafes", priority: "FLEXIBLE", timing: "during", estimateKey: "food" },
  { id: "cat-transport", label: "Local Transport", priority: "FLEXIBLE", timing: "during", estimateKey: "transport" },
  { id: "cat-activities", label: "Activities", priority: "OPTIONAL", timing: "during", estimateKey: "activities" },
  { id: "cat-shopping", label: "Shopping", priority: "OPTIONAL", timing: "during", estimateKey: "shopping" },
  { id: "cat-gifts", label: "Gifts", priority: "OPTIONAL", timing: "during", estimateKey: "gifts" },
  { id: "cat-emergency", label: "Emergency", priority: "MUST", timing: "during", estimateKey: "emergency" },
  { id: "cat-other-trip", label: "Other Destination Cost", priority: "FLEXIBLE", timing: "during", estimateKey: null }
]);

const labels = Object.fromEntries(TRIP_COST_CATEGORIES.map((item) => [item.id, item.label]));
const aliases = {
  flight: "cat-flight", flights: "cat-flight", airfare: "cat-flight",
  accommodation: "cat-accommodation", hotel: "cat-accommodation", stay: "cat-accommodation",
  food: "cat-food", "food & cafes": "cat-food", cafes: "cat-food", meals: "cat-food",
  transportation: "cat-transport", transport: "cat-transport", "local transport": "cat-transport",
  activity: "cat-activities", activities: "cat-activities", attractions: "cat-activities",
  shopping: "cat-shopping", gifts: "cat-gifts", gift: "cat-gifts",
  emergency: "cat-emergency", "emergency buffer": "cat-emergency", reserve: "cat-emergency",
  other: "cat-other-trip", "other destination cost": "cat-other-trip"
};

export function canonicalTripCategory(value, fallback = "cat-other-trip") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (labels[raw]) return raw;
  return aliases[raw.toLowerCase().replace(/\s+/g, " ")] || fallback;
}

export function tripCostCategoryLabel(value, fallback = "Trip Cost") {
  return labels[canonicalTripCategory(value)] || fallback;
}

export function suggestionSourceKey(category) {
  return `suggestion:${canonicalTripCategory(category)}`;
}

export function normalizeTripCostFrequency(value, costType = "") {
  const raw = String(value || costType || "trip-total").trim().toLowerCase().replace(/_/g, "-");
  if (["daily", "weekly", "monthly", "yearly"].includes(raw)) return raw;
  if (["one-time", "once", "one time"].includes(raw)) return "one-time";
  return "trip-total";
}

function validDate(value, fallback) {
  const date = new Date(value || fallback || new Date());
  return Number.isNaN(date.getTime()) ? new Date(fallback || new Date()) : date;
}
function iso(date) { return date.toISOString().slice(0, 10); }
function addDays(date, days) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
function addMonths(date, months) {
  const next = new Date(date);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) next.setDate(0);
  return next;
}

export function tripDayCount(trip = {}) {
  if (!trip.startDate || !trip.endDate) return 1;
  const difference = Math.ceil((new Date(trip.endDate) - new Date(trip.startDate)) / 86400000);
  return Math.max(1, Number.isFinite(difference) ? difference : 1);
}

export function tripCostOccurrenceDates(item = {}, trip = {}, max = 730) {
  const frequency = normalizeTripCostFrequency(item.frequency, item.costType);
  const start = validDate(item.nextDate || item.dueDate || trip.startDate, trip.startDate || trip.endDate);
  const end = validDate(item.untilDate || item.endDate || trip.endDate || trip.startDate, start);
  if (frequency === "trip-total" || frequency === "one-time") return start <= end ? [iso(start)] : [];
  if (start > end) return [];
  if (frequency === "daily") {
    const count = Math.max(1, Math.min(max, Math.ceil((end - start) / 86400000)));
    return Array.from({ length: count }, (_, index) => iso(addDays(start, index)));
  }
  const out = [];
  let current = start;
  let count = 0;
  while (current <= end && count < max) {
    out.push(iso(current));
    if (frequency === "weekly") current = addDays(current, 7);
    else if (frequency === "yearly") current = addMonths(current, 12);
    else current = addMonths(current, 1);
    count += 1;
  }
  return out.length ? out : [iso(start)];
}

export function tripCostEffectiveTotal(item = {}, trip = {}) {
  const amount = Number(item.amountLocal ?? item.amount ?? 0) || 0;
  return amount * Math.max(1, tripCostOccurrenceDates(item, trip).length);
}

export function tripCostPaymentOccurrences(item = {}, trip = {}) {
  const frequency = normalizeTripCostFrequency(item.frequency, item.costType);
  const dates = tripCostOccurrenceDates(item, trip);
  const unitAmount = Number(item.amountLocal ?? item.amount ?? 0) || 0;
  const anchor = dates[0] || String(item.nextDate || item.dueDate || trip.startDate || "").slice(0, 10);
  if (frequency === "daily") {
    return [{ date: anchor, amount: unitAmount * Math.max(1, dates.length), units: Math.max(1, dates.length), frequency }];
  }
  return dates.map((date) => ({ date, amount: unitAmount, units: 1, frequency }));
}

export function categoryTotals(items = []) {
  return items.reduce((out, item) => {
    const id = canonicalTripCategory(item.categoryId || item.category || item.title);
    out[id] = (out[id] || 0) + Number(item.amountLocal ?? item.amount ?? 0) || 0;
    return out;
  }, {});
}

export function dedupeSuggestionsByCategory(items = []) {
  const map = new Map();
  for (const item of items) {
    const categoryId = canonicalTripCategory(item.categoryId || item.category || item.title);
    const current = map.get(categoryId);
    if (!current || Number(item.updatedAt ? new Date(item.updatedAt) : 0) >= Number(current.updatedAt ? new Date(current.updatedAt) : 0)) {
      map.set(categoryId, { ...item, categoryId, category: categoryId });
    }
  }
  return [...map.values()];
}
