// Frontend currency presentation helpers.
// Provider/API work lives outside this module. This module only consumes a prepared rateBook/context.
import {
  addRateToBook,
  buildCurrencyContext,
  convertFromBook,
  currencyPairKey,
  normalizeCurrencyCode,
  rateFromBook,
  tripToDisplay
} from "../shared/currency-domain.js";

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const code = normalizeCurrencyCode;
export const fxPairKey = currencyPairKey;
export const pairRateFromBook = (trip = {}, fromRaw, toRaw) => rateFromBook(buildCurrencyContext(trip).rateBook, fromRaw, toRaw);
export const mergeRate = addRateToBook;

export function convertCurrencyAmount(amount, from, to, trip = {}) {
  return convertFromBook(amount, from, to, buildCurrencyContext(trip).rateBook);
}

export function convertTripLocal(amountLocal, trip, targetCurrency) {
  const context = buildCurrencyContext({ ...trip, displayCurrency: targetCurrency || trip?.displayCurrency || trip?.tripCurrency });
  const converted = tripToDisplay(amountLocal, context);
  return converted == null ? num(amountLocal) : converted;
}

export function displayCurrencyFor(trip) {
  return buildCurrencyContext(trip).displayCurrency;
}

export function secondaryCurrencyFor(trip) {
  const context = buildCurrencyContext(trip);
  return context.displayCurrency === context.tripCurrency ? context.incomeCurrency : context.tripCurrency;
}
