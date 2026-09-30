import test from "node:test";
import assert from "node:assert/strict";
import {
  financeProfileFromClientTrip,
  mergeFinanceProfileIntoClientTrip,
  parseRateBookJson,
  parseTripSnapshot,
  readFinanceSettingsFromTripRow,
  serializeRateBook,
} from "../shared/trip-finance-profile.js";

test("finance profile extracts normalized scalar values from the client trip", () => {
  const profile = financeProfileFromClientTrip({
    startingSavingsBase: 1400.125,
    supportLocal: 350.2,
    returnWithZero: false,
    rateBook: { AED_EGP: 13.67, BAD: 0 },
    scenario: { reserveAfterTripBase: true, reserveAmountBase: 500.556 }
  });
  assert.deepEqual(profile, {
    startingSavings: 1400.13,
    supportMoney: 350.2,
    safetyReserve: 500.56,
    reserveEnabled: true,
    returnWithZero: false,
    rateBookJson: JSON.stringify({ AED_EGP: 13.67 }),
    schemaVersion: 1,
  });
});

test("normalized profile overrides stale legacy notes values", () => {
  const legacy = {
    startingSavingsBase: 100,
    supportLocal: 10,
    returnWithZero: true,
    rateBook: { AED_EGP: 10 },
    scenario: { reserveAfterTripBase: false, reserveAmountBase: 0 }
  };
  const merged = mergeFinanceProfileIntoClientTrip(legacy, {
    startingSavings: 900,
    supportMoney: 80,
    safetyReserve: 250,
    reserveEnabled: true,
    returnWithZero: false,
    rateBookJson: JSON.stringify({ AED_EGP: 13.5 }),
    schemaVersion: 1,
  });
  assert.equal(merged.startingSavingsBase, 900);
  assert.equal(merged.supportLocal, 80);
  assert.equal(merged.scenario.reserveAfterTripBase, true);
  assert.equal(merged.scenario.reserveAmountBase, 250);
  assert.equal(merged.returnWithZero, false);
  assert.equal(merged.rateBook.AED_EGP, 13.5);
});

test("legacy notes remain a valid read fallback before backfill", () => {
  const row = {
    notes: JSON.stringify({ trip: {
      startingSavingsBase: 700,
      supportLocal: 50,
      returnWithZero: true,
      scenario: { reserveAfterTripBase: true, reserveAmountBase: 100 },
      rateBook: { AED_USD: 0.2723 }
    } })
  };
  const settings = readFinanceSettingsFromTripRow(row);
  assert.equal(settings.source, "legacy-notes");
  assert.equal(settings.startingSavings, 700);
  assert.equal(settings.supportMoney, 50);
  assert.equal(settings.safetyReserve, 100);
  assert.equal(settings.rateBook.AED_USD, 0.2723);
});

test("profile source is explicit after normalization", () => {
  const settings = readFinanceSettingsFromTripRow({
    notes: JSON.stringify({ trip: { startingSavingsBase: 1 } }),
    financeProfile: {
      startingSavings: 500,
      supportMoney: 25,
      safetyReserve: 75,
      reserveEnabled: true,
      returnWithZero: false,
      rateBookJson: null,
      schemaVersion: 1,
    }
  });
  assert.equal(settings.source, "normalized-profile");
  assert.equal(settings.startingSavings, 500);
  assert.equal(settings.clientTrip.startingSavingsBase, 500);
});

test("rate book serialization is safe and reversible", () => {
  const serialized = serializeRateBook({ AED_EGP: 13.6, EGP_AED: 1 / 13.6, INVALID: "x" });
  const parsed = parseRateBookJson(serialized);
  assert.equal(parsed.AED_EGP, 13.6);
  assert.ok(parsed.EGP_AED > 0);
  assert.equal(parsed.INVALID, undefined);
  assert.deepEqual(parseRateBookJson("bad json"), {});
});

test("malformed notes never block trip loading", () => {
  assert.deepEqual(parseTripSnapshot("{bad"), { version: "client-trip-v1", trip: {} });
});
