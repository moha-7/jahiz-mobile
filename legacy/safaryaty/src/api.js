import { canonicalTripCategory, tripCostCategoryLabel } from "../shared/trip-cost-domain.js";
import { financeProfileFromClientTrip, mergeFinanceProfileIntoClientTrip } from "../shared/trip-finance-profile.js";
const API_ORIGIN = (import.meta.env.VITE_API_ORIGIN || "http://127.0.0.1:4000").replace(/\/$/, "");
const API_BASE = (import.meta.env.VITE_API_BASE || `${API_ORIGIN}/api`).replace(/\/$/, "");

async function request(path, options = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: options.body instanceof FormData ? {} : { "Content-Type": "application/json", ...(options.headers || {}) },
      ...options,
    });
  } catch (networkError) {
    const error = new Error("Backend is not reachable. Keep the backend terminal running on 127.0.0.1:4000.");
    error.cause = networkError;
    throw error;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) {
    const message = data?.message || `Request failed: ${res.status}`;
    const error = new Error(message);
    error.status = res.status;
    error.details = data?.errors || data?.details;
    throw error;
  }
  return data.data ?? data;
}

export function googleAuthStartUrl() {
  return `${API_BASE}/auth/google/start`;
}

function cleanDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function statusFromClientTrip(trip, override) {
  if (override) return override;
  if (trip?.draft) return "DRAFT";
  if (trip?.archived) return "ARCHIVED";
  return "ACTIVE";
}

export function clientTripToBackendPayload(trip, statusOverride) {
  const status = statusFromClientTrip(trip, statusOverride);
  const snapshot = {
    version: "client-trip-v1",
    trip: { ...trip, draft: status === "DRAFT", archived: status === "ARCHIVED" }
  };
  return {
    title: trip?.name || "My Trip",
    status,
    fromCountry: trip?.origin?.countryCode || null,
    fromAirport: trip?.origin?.airportCode || null,
    toCountry: trip?.destinationInfo?.countryCode || null,
    toAirport: trip?.destinationInfo?.airportCode || null,
    departureDate: cleanDate(trip?.startDate),
    returnDate: cleanDate(trip?.endDate),
    travelers: Number(trip?.travelers || 1),
    incomeCurrency: (trip?.baseCurrency || "AED").toUpperCase(),
    tripCurrency: (trip?.tripCurrency || "AED").toUpperCase(),
    displayCurrency: (trip?.displayCurrency || trip?.tripCurrency || "AED").toUpperCase(),
    exchangeRate: Number(trip?.exchangeRate || 1) || 1,
    rateMode: trip?.rateNeedsReview ? "MANUAL_NEEDS_REVIEW" : (trip?.rateMode || "AUTO"),
    travelStyle: trip?.comfortLevel || "Balanced",
    financeProfile: financeProfileFromClientTrip(trip || {}),
    notes: JSON.stringify({ ...snapshot, version: "client-trip-v3-normalized-finance" })
  };
}

export function backendTripToClient(row) {
  let parsed = null;
  try {
    parsed = row?.notes ? JSON.parse(row.notes) : null;
  } catch {
    parsed = null;
  }
  const status = row?.status || "ACTIVE";
  const legacyClient = parsed?.trip ? parsed.trip : {
    id: row?.id,
    name: row?.title || "My Trip",
    tripType: row?.tripPurpose || "Short Trip",
    tripPurpose: row?.tripPurpose || "Short Trip",
    origin: { countryCode: row?.fromCountry || "AE", airportCode: row?.fromAirport || "" },
    destinationInfo: { countryCode: row?.toCountry || "EG", airportCode: row?.toAirport || "" },
    startDate: row?.departureDate ? row.departureDate.slice(0, 10) : "",
    endDate: row?.returnDate ? row.returnDate.slice(0, 10) : "",
    travelers: row?.travelers || 1,
    baseCurrency: row?.incomeCurrency || "AED",
    tripCurrency: row?.tripCurrency || "AED",
    displayCurrency: row?.displayCurrency || row?.tripCurrency || "AED",
    exchangeRate: row?.exchangeRate || 1,
    rateNeedsReview: row?.rateMode === "MANUAL_NEEDS_REVIEW",
    rateMode: row?.rateMode === "MANUAL_NEEDS_REVIEW" ? "MANUAL" : (row?.rateMode || "AUTO"),
    rateBook: {},
    startingSavingsBase: 0,
    supportLocal: 0,
    comfortLevel: row?.travelStyle || "Balanced",
    travelStyle: row?.travelStyle || "Balanced",
    returnWithZero: true,
    paidPayments: {},
    scenario: { reserveAfterTripBase: false, reserveAmountBase: 0 },
    incomeSources: [],
    lifeCosts: [],
    installments: [],
    budget: [],
    tasks: []
  };
  const client = mergeFinanceProfileIntoClientTrip(legacyClient, row?.financeProfile || null);
  return {
    ...client,
    id: row.id,
    backendId: row.id,
    name: row.title || client.name,
    draft: status === "DRAFT",
    archived: status === "ARCHIVED",
    backendStatus: status,
    startDate: client.startDate || (row?.departureDate ? row.departureDate.slice(0, 10) : ""),
    endDate: client.endDate || (row?.returnDate ? row.returnDate.slice(0, 10) : ""),
    displayCurrency: client.displayCurrency || row?.displayCurrency || row?.tripCurrency || "AED"
  };
}


export function clientTripFinancePayload(trip) {
  return { trip };
}


function toIsoDate(value) {
  return value ? new Date(value).toISOString() : null;
}

function financeModelPath(type) {
  return ({ income: "incomes", life: "life-costs", installments: "installments", budget: "costs", expenses: "expenses" })[type] || type;
}

export function clientFinanceItemToApiPayload(type, item, trip) {
  const baseCurrency = (trip?.baseCurrency || "AED").toUpperCase();
  const tripCurrency = (trip?.tripCurrency || baseCurrency).toUpperCase();
  if (type === "income" || type === "incomes") return {
    title: item.name || item.title || "Income",
    amount: Number(item.amountBase || item.amount || 0),
    currency: baseCurrency,
    frequency: item.frequency === "one-time" ? "ONE_TIME" : "MONTHLY",
    startDate: item.frequency === "one-time" ? null : toIsoDate(item.nextDate || trip?.startDate),
    endDate: toIsoDate(item.untilDate || trip?.endDate),
    expectedDate: item.frequency === "one-time" ? toIsoDate(item.nextDate || trip?.startDate) : null,
    source: item.source || "MANUAL"
  };
  if (type === "life" || type === "life-costs") return {
    title: item.name || item.title || "Life Cost",
    category: item.category || item.categoryId || "Life Cost",
    amount: Number(item.amountBase || item.amount || 0),
    currency: baseCurrency,
    frequency: item.frequency === "one-time" ? "ONE_TIME" : "MONTHLY",
    startDate: item.frequency === "one-time" ? null : toIsoDate(item.nextDate || trip?.startDate),
    endDate: toIsoDate(item.untilDate || trip?.endDate),
    dueDate: item.frequency === "one-time" ? toIsoDate(item.nextDate || trip?.startDate) : null,
    source: item.source || "MANUAL"
  };
  if (type === "installments") return {
    title: item.name || item.title || "Installment",
    amount: Number(item.monthlyBase || item.amountBase || item.amount || 0),
    currency: baseCurrency,
    frequency: item.frequency === "one-time" ? "ONE_TIME" : "MONTHLY",
    startDate: toIsoDate(item.nextDate || item.startDate || trip?.startDate),
    endDate: toIsoDate(item.untilDate || item.endDate || trip?.endDate),
    remainingMonths: item.remainingMonths ? Number(item.remainingMonths) : null,
    source: item.source || "MANUAL"
  };
  if (type === "budget" || type === "costs") return {
    title: item.name || item.title || "Trip Cost",
    category: item.category || item.categoryId || "Other",
    amount: Number(item.amountLocal || item.amount || 0),
    currency: tripCurrency,
    timing: item.timing || null,
    frequency: ({ daily: "DAILY", weekly: "WEEKLY", monthly: "MONTHLY", yearly: "YEARLY", "one-time": "ONE_TIME", "trip-total": "TRIP_TOTAL" })[String(item.frequency || "trip-total").toLowerCase()] || "TRIP_TOTAL",
    priority: item.priority || null,
    status: item.paid ? "PAID" : "UNPAID",
    dueDate: toIsoDate(item.nextDate || item.dueDate || null),
    source: item.source || "MANUAL"
  };
  return item;
}


function dateOnly(value) {
  return value ? String(value).slice(0, 10) : "";
}

function frequencyFromBackend(value, fallback = "monthly") {
  const raw = String(value || "").toUpperCase();
  if (raw === "DAILY") return "daily";
  if (raw === "WEEKLY") return "weekly";
  if (raw === "MONTHLY") return "monthly";
  if (raw === "YEARLY") return "yearly";
  if (raw === "ONE_TIME") return "one-time";
  if (raw === "TRIP_TOTAL") return "trip-total";
  return fallback;
}

const categoryNameToId = {
  Flights: "cat-flight",
  Accommodation: "cat-accommodation",
  Food: "cat-food",
  "Food & Cafes": "cat-food",
  Transport: "cat-transport",
  "Local Transport": "cat-transport",
  Activities: "cat-activities",
  Shopping: "cat-shopping",
  Emergency: "cat-emergency",
  Rent: "cat-rent",
  Phone: "cat-phone",
  Gym: "cat-gym",
  Subscriptions: "cat-subscriptions"
};

function backendIncomeToClient(row) {
  return {
    id: `income-${row.id}`,
    backendId: row.id,
    backendModel: "income",
    enabled: true,
    name: row.title || "Income",
    amountBase: Number(row.amount || 0),
    frequency: frequencyFromBackend(row.frequency, "monthly"),
    nextDate: dateOnly(row.expectedDate || row.startDate),
    untilDate: dateOnly(row.endDate),
    source: row.source || "MANUAL"
  };
}

function backendLifeCostToClient(row) {
  return {
    id: `life-${row.id}`,
    backendId: row.id,
    backendModel: "life",
    enabled: true,
    name: row.title || "Life Cost",
    categoryId: categoryNameToId[row.category] || row.category || "cat-other-life",
    amountBase: Number(row.amount || 0),
    frequency: frequencyFromBackend(row.frequency, "monthly"),
    nextDate: dateOnly(row.dueDate || row.startDate),
    untilDate: dateOnly(row.endDate),
    canPause: false,
    source: row.source || "MANUAL"
  };
}

function backendInstallmentToClient(row) {
  return {
    id: `installment-${row.id}`,
    backendId: row.id,
    backendModel: "installments",
    enabled: true,
    name: row.title || "Installment",
    monthlyBase: Number(row.amount || 0),
    frequency: frequencyFromBackend(row.frequency, "monthly"),
    remainingMonths: Number(row.remainingMonths || 1),
    nextDate: dateOnly(row.startDate),
    untilDate: dateOnly(row.endDate),
    continuesAfterTrip: true,
    paid: row.status === "PAID",
    paidDate: dateOnly(row.paidDate),
    source: row.source || "MANUAL"
  };
}

function backendTripCostToClient(row) {
  return {
    id: `budget-${row.id}`,
    backendId: row.id,
    backendModel: "budget",
    name: row.title || "Trip Cost",
    categoryId: categoryNameToId[row.category] || row.category || "cat-other-trip",
    amountLocal: Number(row.amount || 0),
    priority: row.priority || "Flexible",
    timing: row.timing || "during",
    frequency: frequencyFromBackend(row.frequency, "trip-total"),
    nextDate: dateOnly(row.dueDate),
    untilDate: "",
    paid: row.status === "PAID",
    paidDate: dateOnly(row.paidDate),
    source: row.source || "MANUAL"
  };
}

function backendExpenseToClient(row) {
  return {
    id: `expense-${row.id}`,
    backendId: row.id,
    backendModel: "expenses",
    title: row.title || "Expense",
    category: row.category || "Other",
    amount: Number(row.amount || 0),
    currency: row.currency,
    amountBase: Number(row.amountBase || 0),
    date: dateOnly(row.date),
    note: row.note || ""
  };
}

export function mergeBackendFinanceIntoClientTrip(clientTrip, financeResult) {
  const finance = financeResult?.finance || financeResult;
  if (!finance) return clientTrip;
  const incomes = finance.incomes || [];
  const lifeCosts = finance.lifeCosts || [];
  const installments = finance.installments || [];
  const tripCosts = finance.tripCosts || [];
  const expenses = finance.expenses || [];
  const hasFinanceRows = incomes.length || lifeCosts.length || installments.length || tripCosts.length || expenses.length;
  if (!hasFinanceRows) return clientTrip;
  return {
    ...clientTrip,
    incomeSources: incomes.length ? incomes.map(backendIncomeToClient) : (clientTrip.incomeSources || []),
    lifeCosts: lifeCosts.length ? lifeCosts.map(backendLifeCostToClient) : (clientTrip.lifeCosts || []),
    installments: installments.length ? installments.map(backendInstallmentToClient) : (clientTrip.installments || []),
    budget: tripCosts.length ? tripCosts.map(backendTripCostToClient) : (clientTrip.budget || []),
    expenses: expenses.length ? expenses.map(backendExpenseToClient) : (clientTrip.expenses || [])
  };
}

function backendSuggestionToClient(row) {
  const categoryId = canonicalTripCategory(row?.category);
  return {
    id: row?.id,
    backendId: row?.id,
    categoryId,
    title: tripCostCategoryLabel(categoryId, row?.category || "Trip Cost"),
    currentAmount: Number(row?.currentAmount || 0),
    suggestedAmount: Number(row?.suggestedAmount || 0),
    currency: row?.currency,
    difference: Number(row?.difference || 0),
    message: row?.message || "Suggested from trip context.",
    effect: Number(row?.difference || 0) > 0 ? "increase" : Number(row?.difference || 0) < 0 ? "reduce" : "keep",
    status: row?.status || "PENDING",
    source: "BACKEND_TEMPLATE",
    updatedAt: row?.updatedAt || null
  };
}

export const api = {
  health: () => request("/health"),
  getCostProfile: ({ country = "", currency = "USD", comfort = "Balanced", days = 7, travelers = 1 } = {}) => request(`/external/cost-profile?country=${encodeURIComponent(country)}&currency=${encodeURIComponent(currency)}&comfort=${encodeURIComponent(comfort)}&days=${encodeURIComponent(days)}&travelers=${encodeURIComponent(travelers)}`),
  getRate: (from, to, options = {}) => request(`/fx/rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}${options.refresh ? "&refresh=1" : ""}`),
  syncFx: (base = "AED") => request("/fx/sync", { method: "POST", body: JSON.stringify({ base }) }),
  me: () => request("/auth/me"),
  authProviders: () => request("/auth/providers"),
  register: (payload) => request("/auth/register", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload) => request("/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => request("/auth/logout", { method: "POST" }),
  updateProfile: (payload) => request("/auth/profile", { method: "PATCH", body: JSON.stringify(payload) }),
  changePassword: (payload) => request("/auth/password", { method: "PATCH", body: JSON.stringify(payload) }),
  uploadAvatar: (file) => {
    const form = new FormData();
    form.append("avatar", file);
    return request("/auth/avatar", { method: "POST", body: form });
  },
  listTrips: () => request("/trips"),
  createTrip: (trip, status = "DRAFT") => request("/trips", { method: "POST", body: JSON.stringify(clientTripToBackendPayload(trip, status)) }),
  updateTrip: (id, trip, status) => request(`/trips/${id}`, { method: "PATCH", body: JSON.stringify(clientTripToBackendPayload(trip, status)) }),
  updateTripCurrencyContext: (id, payload) => request(`/trips/${id}/currency-context`, { method: "PATCH", body: JSON.stringify(payload) }),
  setTripStatus: (id, status) => request(`/trips/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
  finishTrip: (id) => request(`/trips/${id}/finish`, { method: "POST" }),
  deleteTrip: (id) => request(`/trips/${id}`, { method: "DELETE" }),
  getTripSummary: (id) => request(`/trips/${id}/summary`),
  getTripRecommendations: (id) => request(`/trips/${id}/recommendations`),
  getTripFinance: (id) => request(`/trips/${id}/finance`),
  generateTripSuggestions: async (id) => { const result = await request(`/trips/${id}/suggestions/generate`, { method: "POST" }); return { ...result, suggestions: (result.suggestions || []).map(backendSuggestionToClient) }; },
  listTripSuggestions: async (id) => { const result = await request(`/trips/${id}/suggestions`); return { ...result, suggestions: (result.suggestions || []).map(backendSuggestionToClient) }; },
  applySuggestion: async (id, payload = {}) => request(`/suggestions/${id}/apply`, { method: "POST", body: JSON.stringify(payload) }),
  ignoreSuggestion: async (id) => request(`/suggestions/${id}/ignore`, { method: "POST" }),
  restoreSuggestion: async (id) => request(`/suggestions/${id}/restore`, { method: "POST" }),
  createFinanceItem: (tripId, type, item, trip) => request(`/trips/${tripId}/${financeModelPath(type)}`, { method: "POST", body: JSON.stringify(clientFinanceItemToApiPayload(type, item, trip)) }),
  updateFinanceItem: (type, itemId, payload) => request(`/${financeModelPath(type)}/${itemId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  updateFinanceClientItem: (type, itemId, item, trip) => request(`/${financeModelPath(type)}/${itemId}`, { method: "PATCH", body: JSON.stringify(clientFinanceItemToApiPayload(type, item, trip)) }),
  deleteFinanceItem: (type, itemId) => request(`/${financeModelPath(type)}/${itemId}`, { method: "DELETE" }),
  markTripCostPaid: (itemId) => request(`/costs/${itemId}/mark-paid`, { method: "PATCH" }),
  undoTripCostPaid: (itemId) => request(`/costs/${itemId}/undo-paid`, { method: "PATCH" }),
  markInstallmentPaid: (itemId) => request(`/installments/${itemId}/mark-paid`, { method: "PATCH" }),
  undoInstallmentPaid: (itemId) => request(`/installments/${itemId}/undo-paid`, { method: "PATCH" }),
  syncTripFinance: (id, trip) => request(`/trips/${id}/finance/sync-client-snapshot`, { method: "POST", body: JSON.stringify(clientTripFinancePayload(trip)) }),
  getSummary: (id) => request(`/trips/${id}/summary`),
  markPaymentPaid: (tripId, paymentKey) => request(`/trips/${tripId}/payments/${encodeURIComponent(paymentKey)}/mark-paid`, { method: "PATCH" }),
  undoPaymentPaid: (tripId, paymentKey) => request(`/trips/${tripId}/payments/${encodeURIComponent(paymentKey)}/undo-paid`, { method: "PATCH" }),
  adminUsers: () => request("/users"),
  getCountries: () => request("/external/countries"),
  getCountry: (code) => request(`/external/countries/${encodeURIComponent(code)}`),
  syncCountries: () => request("/external/countries/sync", { method: "POST" }),
  async saveClientTrip(trip, status) {
    let result;
    if (trip?.backendId || trip?.id) {
      try {
        result = await this.updateTrip(trip.backendId || trip.id, trip, status);
      } catch (err) {
        if (err.status !== 404) throw err;
      }
    }
    if (!result) result = await this.createTrip(trip, status || statusFromClientTrip(trip));
    const backendId = result?.trip?.id || trip?.backendId || trip?.id;
    if (backendId) {
      try {
        result.financeSync = await this.syncTripFinance(backendId, trip);
      } catch (error) {
        console.warn("Finance sync failed", error);
      }
    }
    return result;
  },
  async loadClientTrips() {
    const result = await request("/trips");
    const rows = result.trips || [];
    const trips = await Promise.all(rows.map(async (row) => {
      const clientTrip = backendTripToClient(row);
      try {
        const finance = await this.getTripFinance(row.id);
        return mergeBackendFinanceIntoClientTrip(clientTrip, finance);
      } catch (error) {
        console.warn("Could not load backend finance rows", error);
        return clientTrip;
      }
    }));
    return trips;
  }
};

export function normalizeBackendUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name || "Traveler",
    email: user.email || "",
    avatar: user.profileImage ? `${API_ORIGIN}${user.profileImage}` : user.avatar || "",
    residenceCountry: user.countryOfResidence || user.residenceCountry || "AE",
    nationality: user.nationality || "EG",
    preferredCurrency: user.preferredCurrency || "AED",
    language: user.preferredLanguage || user.language || "en",
    travelFrequency: user.travelFrequency || "sometimes",
    travelPurpose: user.travelPurpose || "Leisure",
    defaultTravelStyle: user.defaultTravelStyle || "Balanced",
    role: user.role || "USER",
    plan: user.plan || "FREE",
    backendUser: user,
  };
}

export function toRegisterPayload(profile) {
  return {
    name: profile.name || "Traveler",
    email: profile.email,
    password: profile.password,
    countryOfResidence: profile.residenceCountry || "AE",
    nationality: profile.nationality || "EG",
    preferredCurrency: (profile.preferredCurrency || "AED").toUpperCase(),
    preferredLanguage: profile.language || "en",
    travelFrequency: profile.travelFrequency || "sometimes",
    travelPurpose: profile.travelPurpose || "Leisure",
    defaultTravelStyle: profile.defaultTravelStyle || "Balanced",
  };
}

export function toProfilePayload(profile) {
  return {
    name: profile.name,
    email: profile.email,
    countryOfResidence: profile.residenceCountry,
    nationality: profile.nationality,
    preferredCurrency: (profile.preferredCurrency || "AED").toUpperCase(),
    preferredLanguage: profile.language || "en",
    travelFrequency: profile.travelFrequency,
    travelPurpose: profile.travelPurpose,
    defaultTravelStyle: profile.defaultTravelStyle,
  };
}
