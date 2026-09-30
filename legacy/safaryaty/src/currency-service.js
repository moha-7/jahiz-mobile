import { addRateToBook, currencyPairKey, normalizeCurrencyCode, normalizeRate, rateFromBook } from "../shared/currency-domain.js";

const memoryRates = new Map();

function cacheKey(from, to) {
  return currencyPairKey(from, to);
}

function remember(from, to, payload) {
  const rate = normalizeRate(payload?.rate);
  if (!rate) return null;
  const key = cacheKey(from, to);
  const item = { ...payload, from: normalizeCurrencyCode(from), to: normalizeCurrencyCode(to), rate };
  memoryRates.set(key, item);
  memoryRates.set(cacheKey(to, from), { ...item, from: item.to, to: item.from, rate: 1 / rate, direction: `${item.to}->${item.from}` });
  return item;
}

export function cachedRate(from, to, rateBook = {}) {
  const direct = rateFromBook(rateBook, from, to);
  if (direct) return { from: normalizeCurrencyCode(from), to: normalizeCurrencyCode(to), rate: direct, source: "trip-rate-book", stale: false, confidence: "high" };
  return memoryRates.get(cacheKey(from, to)) || null;
}

export async function resolveApiRate(api, fromRaw, toRaw, options = {}) {
  const from = normalizeCurrencyCode(fromRaw);
  const to = normalizeCurrencyCode(toRaw);
  if (!from || !to) throw new Error("Choose valid currencies first");
  if (from === to) return remember(from, to, { rate: 1, source: "same-currency", stale: false, confidence: "high", fetchedAt: new Date().toISOString() });

  if (!options.refresh) {
    const existing = cachedRate(from, to, options.rateBook || {});
    if (existing) return existing;
  }

  const result = await api.getRate(from, to, { refresh: !!options.refresh });
  const remembered = remember(from, to, result);
  if (!remembered) throw new Error(`No valid exchange rate for ${from} → ${to}`);
  return remembered;
}

export function applyResolvedRate(rateBook, result) {
  return addRateToBook(rateBook || {}, result.from, result.to, result.rate);
}

export async function prepareCurrencyChange(api, trip, nextIncomeRaw, nextTripRaw, options = {}) {
  const currentIncome = normalizeCurrencyCode(trip?.baseCurrency || trip?.incomeCurrency || "AED", "AED");
  const currentTrip = normalizeCurrencyCode(trip?.tripCurrency || currentIncome, currentIncome);
  const nextIncome = normalizeCurrencyCode(nextIncomeRaw || currentIncome, currentIncome);
  const nextTrip = normalizeCurrencyCode(nextTripRaw || currentTrip, currentTrip);
  let rateBook = { ...(trip?.rateBook || {}) };

  const plan = await resolveApiRate(api, nextIncome, nextTrip, { refresh: !!options.refresh, rateBook });
  rateBook = applyResolvedRate(rateBook, plan);

  let incomeConversion = null;
  if (currentIncome !== nextIncome) {
    incomeConversion = await resolveApiRate(api, currentIncome, nextIncome, { refresh: !!options.refresh, rateBook });
    rateBook = applyResolvedRate(rateBook, incomeConversion);
  }

  let tripConversion = null;
  if (currentTrip !== nextTrip) {
    tripConversion = await resolveApiRate(api, currentTrip, nextTrip, { refresh: !!options.refresh, rateBook });
    rateBook = applyResolvedRate(rateBook, tripConversion);
  }

  return {
    currentIncome,
    currentTrip,
    nextIncome,
    nextTrip,
    plan,
    incomeConversion,
    tripConversion,
    rateBook
  };
}
