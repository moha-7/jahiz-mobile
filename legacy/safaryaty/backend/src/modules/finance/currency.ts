import { buildCurrencyContext, incomeToTrip, normalizeCurrencyCode, rateFromBook, tripToDisplay, tripToIncome } from "../../../../shared/currency-domain.js";
import { readFinanceSettingsFromTripRow } from "../../../../shared/trip-finance-profile.js";

function contextFromTrip(trip: any) {
  const settings = readFinanceSettingsFromTripRow(trip || {});
  return buildCurrencyContext({
    incomeCurrency: trip?.incomeCurrency,
    tripCurrency: trip?.tripCurrency,
    displayCurrency: trip?.displayCurrency,
    exchangeRate: trip?.exchangeRate,
    rateBook: settings.rateBook || {}
  });
}

export function toTripCurrency(amountIncomeCurrency: number, incomeCurrency: string, tripCurrency: string, exchangeRate: number) {
  const context = buildCurrencyContext({ incomeCurrency, tripCurrency, exchangeRate });
  const converted = incomeToTrip(amountIncomeCurrency, context);
  return converted == null ? 0 : converted;
}

export function toIncomeCurrency(amountTripCurrency: number, incomeCurrency: string, tripCurrency: string, exchangeRate: number) {
  const context = buildCurrencyContext({ incomeCurrency, tripCurrency, exchangeRate });
  const converted = tripToIncome(amountTripCurrency, context);
  return converted == null ? 0 : converted;
}

export function displayCurrencyFor(trip: any) {
  return contextFromTrip(trip).displayCurrency;
}

export function fxRateForTrip(trip: any, fromRaw: string, toRaw: string) {
  const from = normalizeCurrencyCode(fromRaw);
  const to = normalizeCurrencyCode(toRaw);
  if (!from || !to) return 0;
  if (from === to) return 1;
  const context = contextFromTrip(trip);
  return rateFromBook(context.rateBook, from, to);
}

export function toDisplayAmount(amountTripCurrency: number, trip: any) {
  const converted = tripToDisplay(amountTripCurrency, contextFromTrip(trip));
  return converted == null ? amountTripCurrency : converted;
}

export function displayCard(amountTripCurrency: number, trip: any) {
  return Math.round(toDisplayAmount(amountTripCurrency, trip));
}
