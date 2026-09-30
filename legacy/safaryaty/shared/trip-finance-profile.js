export const TRIP_FINANCE_PROFILE_VERSION = 1;

const finite = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const money = (value) => Math.round(Math.max(0, finite(value, 0)) * 100) / 100;

export function parseTripSnapshot(notes) {
  try {
    const parsed = typeof notes === "string" ? JSON.parse(notes || "{}") : (notes || {});
    return parsed?.trip ? parsed : { version: "client-trip-v1", trip: parsed || {} };
  } catch {
    return { version: "client-trip-v1", trip: {} };
  }
}

export function parseRateBookJson(value) {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return { ...value };
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeRateBook(rateBook) {
  const clean = {};
  for (const [key, value] of Object.entries(rateBook || {})) {
    const rate = Number(value);
    if (key && Number.isFinite(rate) && rate > 0) clean[key] = rate;
  }
  return Object.keys(clean).length ? JSON.stringify(clean) : null;
}

export function financeProfileFromClientTrip(trip = {}) {
  const scenario = trip?.scenario || {};
  return {
    startingSavings: money(trip?.startingSavingsBase),
    supportMoney: money(trip?.supportLocal),
    safetyReserve: money(scenario?.reserveAmountBase),
    reserveEnabled: scenario?.reserveAfterTripBase === true,
    returnWithZero: typeof trip?.returnWithZero === "boolean" ? trip.returnWithZero : true,
    rateBookJson: serializeRateBook(trip?.rateBook),
    schemaVersion: TRIP_FINANCE_PROFILE_VERSION,
  };
}

export function normalizedFinanceProfile(profile, fallbackTrip = {}) {
  if (!profile) return financeProfileFromClientTrip(fallbackTrip);
  return {
    startingSavings: money(profile.startingSavings),
    supportMoney: money(profile.supportMoney),
    safetyReserve: money(profile.safetyReserve),
    reserveEnabled: profile.reserveEnabled === true,
    returnWithZero: typeof profile.returnWithZero === "boolean" ? profile.returnWithZero : true,
    rateBookJson: profile.rateBookJson != null
      ? serializeRateBook(parseRateBookJson(profile.rateBookJson))
      : serializeRateBook(fallbackTrip?.rateBook),
    schemaVersion: Number.isInteger(Number(profile.schemaVersion)) ? Number(profile.schemaVersion) : TRIP_FINANCE_PROFILE_VERSION,
  };
}

export function mergeFinanceProfileIntoClientTrip(clientTrip = {}, profile) {
  if (!profile) return { ...clientTrip };
  const normalized = normalizedFinanceProfile(profile, clientTrip);
  return {
    ...clientTrip,
    startingSavingsBase: normalized.startingSavings,
    supportLocal: normalized.supportMoney,
    returnWithZero: normalized.returnWithZero,
    rateBook: parseRateBookJson(normalized.rateBookJson),
    scenario: {
      ...(clientTrip?.scenario || {}),
      reserveAfterTripBase: normalized.reserveEnabled,
      reserveAmountBase: normalized.safetyReserve,
    },
    financeProfileVersion: normalized.schemaVersion,
  };
}

export function readFinanceSettingsFromTripRow(row = {}) {
  const snapshot = parseTripSnapshot(row?.notes);
  const clientTrip = snapshot?.trip || {};
  const profile = row?.financeProfile || null;
  const normalized = normalizedFinanceProfile(profile, clientTrip);
  return {
    source: profile ? "normalized-profile" : "legacy-notes",
    ...normalized,
    rateBook: parseRateBookJson(normalized.rateBookJson),
    clientTrip: mergeFinanceProfileIntoClientTrip(clientTrip, profile),
    snapshot,
  };
}
