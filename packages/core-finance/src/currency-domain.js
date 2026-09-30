export const CURRENCY_DOMAIN_VERSION = "1.0.0";

export function normalizeCurrencyCode(value, fallback = "") {
  const code = String(value || fallback || "").trim().toUpperCase().slice(0, 3);
  return /^[A-Z]{3}$/.test(code) ? code : "";
}

export function normalizeRate(value, fallback = 0) {
  const rate = Number(value);
  return Number.isFinite(rate) && rate > 0 ? rate : fallback;
}

export function currencyPairKey(fromRaw, toRaw) {
  const from = normalizeCurrencyCode(fromRaw);
  const to = normalizeCurrencyCode(toRaw);
  return from && to ? `${from}_${to}` : "";
}

export function rateFromBook(rateBook = {}, fromRaw, toRaw) {
  const from = normalizeCurrencyCode(fromRaw);
  const to = normalizeCurrencyCode(toRaw);
  if (!from || !to) return 0;
  if (from === to) return 1;
  const direct = normalizeRate(rateBook?.[currencyPairKey(from, to)]);
  if (direct) return direct;
  const inverse = normalizeRate(rateBook?.[currencyPairKey(to, from)]);
  return inverse ? 1 / inverse : 0;
}

export function addRateToBook(rateBook = {}, fromRaw, toRaw, rateRaw) {
  const from = normalizeCurrencyCode(fromRaw);
  const to = normalizeCurrencyCode(toRaw);
  const rate = normalizeRate(rateRaw);
  if (!from || !to || !rate) return { ...(rateBook || {}) };
  return {
    ...(rateBook || {}),
    [currencyPairKey(from, to)]: rate,
    [currencyPairKey(to, from)]: 1 / rate
  };
}

export function convertWithRate(amountRaw, rateRaw) {
  const amount = Number(amountRaw);
  const rate = normalizeRate(rateRaw);
  if (!Number.isFinite(amount) || !rate) return null;
  return amount * rate;
}

export function convertFromBook(amountRaw, fromRaw, toRaw, rateBook = {}) {
  const from = normalizeCurrencyCode(fromRaw);
  const to = normalizeCurrencyCode(toRaw);
  if (!from || !to) return null;
  if (from === to) return Number(amountRaw) || 0;
  return convertWithRate(amountRaw, rateFromBook(rateBook, from, to));
}

export function buildCurrencyContext(input = {}) {
  const incomeCurrency = normalizeCurrencyCode(input.incomeCurrency || input.baseCurrency || "AED", "AED");
  const tripCurrency = normalizeCurrencyCode(input.tripCurrency || incomeCurrency, incomeCurrency);
  const requestedDisplay = normalizeCurrencyCode(input.displayCurrency || tripCurrency, tripCurrency);
  let rateBook = { ...(input.rateBook || {}) };
  const planRate = incomeCurrency === tripCurrency ? 1 : normalizeRate(input.exchangeRate);
  if (planRate) rateBook = addRateToBook(rateBook, incomeCurrency, tripCurrency, planRate);
  const displayRate = rateFromBook(rateBook, tripCurrency, requestedDisplay);
  const displayCurrency = requestedDisplay === tripCurrency || displayRate ? requestedDisplay : tripCurrency;
  return {
    version: CURRENCY_DOMAIN_VERSION,
    incomeCurrency,
    tripCurrency,
    displayCurrency,
    planRate: incomeCurrency === tripCurrency ? 1 : planRate,
    displayRate: displayCurrency === tripCurrency ? 1 : rateFromBook(rateBook, tripCurrency, displayCurrency),
    rateBook,
    planRateReady: incomeCurrency === tripCurrency || Boolean(planRate),
    displayRateReady: displayCurrency === tripCurrency || Boolean(rateFromBook(rateBook, tripCurrency, displayCurrency))
  };
}

export function incomeToTrip(amount, context) {
  if (!context) return null;
  if (context.incomeCurrency === context.tripCurrency) return Number(amount) || 0;
  return convertWithRate(amount, context.planRate);
}

export function tripToIncome(amount, context) {
  if (!context) return null;
  if (context.incomeCurrency === context.tripCurrency) return Number(amount) || 0;
  const rate = normalizeRate(context.planRate);
  return rate ? Number(amount || 0) / rate : null;
}

export function tripToDisplay(amount, context) {
  if (!context) return null;
  if (context.tripCurrency === context.displayCurrency) return Number(amount) || 0;
  return convertWithRate(amount, context.displayRate);
}

export function convertTripCurrencyValues(input = {}) {
  const rate = normalizeRate(input.oldTripToNewTripRate);
  if (!rate) return null;
  const convert = (value) => Math.round((Number(value || 0) * rate) * 100) / 100;
  return {
    supportLocal: convert(input.supportLocal),
    budget: (input.budget || []).map((item) => ({ ...item, amountLocal: convert(item.amountLocal) }))
  };
}

export function convertIncomeCurrencyValues(input = {}) {
  const rate = normalizeRate(input.oldIncomeToNewIncomeRate);
  if (!rate) return null;
  const convert = (value) => Math.round((Number(value || 0) * rate) * 100) / 100;
  return {
    startingSavingsBase: convert(input.startingSavingsBase),
    reserveAmountBase: convert(input.reserveAmountBase),
    incomeSources: (input.incomeSources || []).map((item) => ({ ...item, amountBase: convert(item.amountBase) })),
    lifeCosts: (input.lifeCosts || []).map((item) => ({ ...item, amountBase: convert(item.amountBase) })),
    installments: (input.installments || []).map((item) => ({ ...item, monthlyBase: convert(item.monthlyBase) }))
  };
}
