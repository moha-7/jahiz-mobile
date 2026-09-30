import test from "node:test";
import assert from "node:assert/strict";
import { generateTripSuggestions } from "./suggestions.engine.js";

function trip(over: Record<string, unknown> = {}) {
  return {
    id: "trip-test",
    userId: "user-test",
    title: "Test",
    status: "ACTIVE",
    fromCountry: "AE",
    fromAirport: "DXB",
    toCountry: "BH",
    toAirport: "BAH",
    departureDate: new Date("2026-07-01"),
    returnDate: new Date("2026-07-08"),
    travelers: 1,
    incomeCurrency: "AED",
    tripCurrency: "BHD",
    displayCurrency: "AED",
    exchangeRate: 0.102,
    rateMode: "AUTO",
    travelStyle: "Balanced",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over
  } as any;
}

test("suggestions use trip-currency profiles without hard-coded AED/EGP minimums", () => {
  const rows = generateTripSuggestions({ trip: trip(), tripCosts: [] });
  const flight = rows.find((row) => row.category === "cat-flight");
  assert.ok(flight);
  assert.ok((flight?.suggestedAmount || 0) > 0);
  assert.ok((flight?.suggestedAmount || 0) < 1000);
  assert.equal(flight?.currency, "BHD");
});

test("suggestion categories match the shared frontend/backend taxonomy", () => {
  const ids = generateTripSuggestions({ trip: trip(), tripCosts: [] }).map((row) => row.category);
  assert.ok(ids.includes("cat-gifts"));
  assert.ok(ids.includes("cat-emergency"));
  assert.equal(new Set(ids).size, ids.length);
});

test("existing confirmed category amount is preserved when higher than estimate", () => {
  const rows = generateTripSuggestions({
    trip: trip(),
    tripCosts: [{ amount: 900, category: "Food & Cafes", title: "Confirmed meals", currency: "BHD" }] as any
  });
  const food = rows.find((row) => row.category === "cat-food");
  assert.equal(food?.currentAmount, 900);
  assert.equal(food?.suggestedAmount, 900);
});


test("provided converted category estimates are used without nominal currency relabelling", () => {
  const rows = generateTripSuggestions({
    trip: trip({ tripCurrency: "AED" }),
    tripCosts: [],
    estimatedCategories: { "cat-flight": 8800, "cat-food": 980 }
  });
  assert.equal(rows.find((row) => row.category === "cat-flight")?.suggestedAmount, 8800);
  assert.equal(rows.find((row) => row.category === "cat-food")?.suggestedAmount, 980);
  assert.equal(rows.find((row) => row.category === "cat-flight")?.currency, "AED");
});
