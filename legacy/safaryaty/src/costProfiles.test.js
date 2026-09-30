import test from "node:test";
import assert from "node:assert/strict";
import { estimateCategoryCosts, estimateCategoryRanges, estimateTotalFromCategories, countryCostProfile } from "./data/costProfiles.js";

test("Country cost profiles produce all core trip categories", () => {
  const estimate = estimateCategoryCosts({ destinationCountry: "EG", tripCurrency: "EGP", days: 10, travelers: 2, comfortLevel: "Balanced" });
  for (const key of ["cat-flight","cat-accommodation","cat-food","cat-transport","cat-activities","cat-shopping","cat-emergency"]) {
    assert.ok(estimate[key] > 0, `${key} should be positive`);
  }
  assert.ok(estimateTotalFromCategories(estimate) > estimate["cat-emergency"]);
});

test("Comfort level increases destination cost estimates", () => {
  const balanced = estimateTotalFromCategories(estimateCategoryCosts({ destinationCountry: "EG", tripCurrency: "EGP", days: 7, travelers: 1, comfortLevel: "Balanced" }));
  const premium = estimateTotalFromCategories(estimateCategoryCosts({ destinationCountry: "EG", tripCurrency: "EGP", days: 7, travelers: 1, comfortLevel: "Premium" }));
  assert.ok(premium > balanced);
});

test("Unknown country falls back to tier profile safely", () => {
  const profile = countryCostProfile("XX", "EUR", "high");
  assert.equal(profile.currency, "EUR");
  const estimate = estimateCategoryCosts({ destinationCountry: "XX", tripCurrency: "EUR", costTier: "high", days: 5, travelers: 1 });
  assert.equal(estimate._meta.source, "tier-cost-profile");
  assert.ok(estimate["cat-accommodation"] > 0);
});


test("Cost ranges return low, typical, high and confidence", () => {
  const profile = estimateCategoryRanges({ destinationCountry: "EG", tripCurrency: "EGP", days: 10, travelers: 2, comfortLevel: "Balanced" });
  const food = profile.categories["cat-food"];
  assert.ok(food.low < food.typical);
  assert.ok(food.typical < food.high);
  assert.equal(food.unit, "per traveler / day");
  assert.equal(profile.currency, "EGP");
  assert.equal(profile.confidence, "medium");
  assert.ok(profile.totals.low < profile.totals.typical);
  assert.ok(profile.totals.typical < profile.totals.high);
});
