import test from "node:test";
import assert from "node:assert/strict";
import { countries, airports } from "./data/routeOptions.js";
import { supportedCurrencies, countryProfile, preferredCurrencyOptions, currencyLabel } from "./data/countryMetadata.js";

test("All route country currencies are supported by metadata", () => {
  const missing = countries.filter(c => !supportedCurrencies.includes(c.currency)).map(c => `${c.code}:${c.currency}`);
  assert.deepEqual(missing, []);
});

test("Country profile returns usable defaults", () => {
  const egypt = countryProfile("EG");
  assert.equal(egypt.currency, "EGP");
  assert.ok(egypt.region);
  assert.ok(egypt.costTier);
});

test("Preferred currency options prioritize route pair", () => {
  const options = preferredCurrencyOptions("AED", "EGP");
  assert.equal(options[0], "AED");
  assert.equal(options[1], "EGP");
  assert.ok(options.includes("EUR"));
});

test("Currency labels are human readable", () => {
  assert.match(currencyLabel("AED"), /AED/);
  assert.match(currencyLabel("EUR"), /Euro/);
});


test("Georgia and Armenia are available in route and currency metadata", () => {
  assert.ok(countries.find(c => c.code === "GE")?.currency === "GEL");
  assert.ok(countries.find(c => c.code === "AM")?.currency === "AMD");
  assert.ok(airports.some(a => a.countryCode === "GE" && a.code === "TBS"));
  assert.ok(airports.some(a => a.countryCode === "AM" && a.code === "EVN"));
});
