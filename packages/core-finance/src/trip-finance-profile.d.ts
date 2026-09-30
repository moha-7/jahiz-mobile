export const TRIP_FINANCE_PROFILE_VERSION: number;
export function parseTripSnapshot(notes: unknown): { version: string; trip: Record<string, any> };
export function parseRateBookJson(value: unknown): Record<string, number>;
export function serializeRateBook(rateBook: unknown): string | null;
export function financeProfileFromClientTrip(trip?: Record<string, any>): {
  startingSavings: number;
  supportMoney: number;
  safetyReserve: number;
  reserveEnabled: boolean;
  returnWithZero: boolean;
  rateBookJson: string | null;
  schemaVersion: number;
};
export function normalizedFinanceProfile(profile: any, fallbackTrip?: Record<string, any>): ReturnType<typeof financeProfileFromClientTrip>;
export function mergeFinanceProfileIntoClientTrip(clientTrip?: Record<string, any>, profile?: any): Record<string, any>;
export function readFinanceSettingsFromTripRow(row?: any): any;
