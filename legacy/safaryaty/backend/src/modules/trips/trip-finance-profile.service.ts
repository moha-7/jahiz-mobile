import type { PrismaClient } from "@prisma/client";
import {
  financeProfileFromClientTrip,
  mergeFinanceProfileIntoClientTrip,
  normalizedFinanceProfile,
  parseTripSnapshot,
  readFinanceSettingsFromTripRow,
} from "../../../../shared/trip-finance-profile.js";

export function financeProfileCreateData(clientTrip: any) {
  const profile = financeProfileFromClientTrip(clientTrip || {});
  return {
    startingSavings: profile.startingSavings,
    supportMoney: profile.supportMoney,
    safetyReserve: profile.safetyReserve,
    reserveEnabled: profile.reserveEnabled,
    returnWithZero: profile.returnWithZero,
    rateBookJson: profile.rateBookJson,
    schemaVersion: profile.schemaVersion,
    normalizedAt: new Date(),
  };
}

export function financeProfilePatchData(input: any) {
  const profile = normalizedFinanceProfile(input || {}, {});
  return {
    startingSavings: profile.startingSavings,
    supportMoney: profile.supportMoney,
    safetyReserve: profile.safetyReserve,
    reserveEnabled: profile.reserveEnabled,
    returnWithZero: profile.returnWithZero,
    rateBookJson: profile.rateBookJson,
    schemaVersion: profile.schemaVersion,
    normalizedAt: new Date(),
  };
}


export function mergeFinanceProfilePatch(existing: any, patch: any) {
  return financeProfilePatchData({
    startingSavings: patch?.startingSavings ?? existing?.startingSavings ?? 0,
    supportMoney: patch?.supportMoney ?? existing?.supportMoney ?? 0,
    safetyReserve: patch?.safetyReserve ?? existing?.safetyReserve ?? 0,
    reserveEnabled: patch?.reserveEnabled ?? existing?.reserveEnabled ?? false,
    returnWithZero: patch?.returnWithZero ?? existing?.returnWithZero ?? true,
    rateBookJson: patch?.rateBookJson !== undefined ? patch.rateBookJson : (existing?.rateBookJson ?? null),
    schemaVersion: patch?.schemaVersion ?? existing?.schemaVersion ?? 1,
  });
}

export async function upsertTripFinanceProfile(db: PrismaClient | any, tripId: string, clientTrip: any) {
  const data = financeProfileCreateData(clientTrip);
  return db.tripFinanceProfile.upsert({
    where: { tripId },
    create: { tripId, ...data },
    update: data,
  });
}

export function normalizedClientTripFromRow(row: any) {
  const snapshot = parseTripSnapshot(row?.notes);
  return mergeFinanceProfileIntoClientTrip(snapshot?.trip || {}, row?.financeProfile || null);
}

export function financeSettingsFromTripRow(row: any) {
  return readFinanceSettingsFromTripRow(row);
}
