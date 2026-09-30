import test from "node:test";
import assert from "node:assert/strict";
import { convertCurrencyAmount, convertTripLocal, fxPairKey, pairRateFromBook } from "./fx.js";

const trip = {
  baseCurrency: "AED",
  tripCurrency: "USD",
  displayCurrency: "AED",
  exchangeRate: 0.2723,
  rateBook: { AED_USD: 0.2723 }
};

test("display conversion uses inverse selected rate, not same raw number", () => {
  const displayed = convertTripLocal(1879, trip, "AED");
  assert.ok(displayed > 6800 && displayed < 7000);
  assert.notEqual(Math.round(displayed), 1879);
});

test("base to trip uses selected rate and inverse works from rateBook", () => {
  assert.equal(fxPairKey("aed", "usd"), "AED_USD");
  assert.equal(pairRateFromBook(trip, "AED", "USD"), 0.2723);
  assert.ok(Math.abs(pairRateFromBook(trip, "USD", "AED") - (1 / 0.2723)) < 0.000001);
  assert.ok(Math.abs(convertCurrencyAmount(100, "AED", "USD", trip) - 27.23) < 0.000001);
});

test("display currency change does not require mutating stored trip amount", () => {
  const amountTripCurrency = 500;
  const usdDisplay = convertTripLocal(amountTripCurrency, { ...trip, displayCurrency: "USD" }, "USD");
  const aedDisplay = convertTripLocal(amountTripCurrency, { ...trip, displayCurrency: "AED" }, "AED");
  assert.equal(usdDisplay, amountTripCurrency);
  assert.ok(aedDisplay > amountTripCurrency);
});
