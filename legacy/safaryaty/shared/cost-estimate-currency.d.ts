export function roundPlanningEstimate(value: unknown, currency?: string): number;
export function resolveEstimateRate(rateBook: Record<string, number>, sourceCurrency: string, targetCurrency: string): number;
export function convertCategoryEstimateMap(estimate: any, input: { sourceCurrency?: string; targetCurrency: string; rate?: number; source?: string }): any | null;
export function convertCostRangeProfile(profile: any, input: { sourceCurrency?: string; targetCurrency: string; rate?: number }): any | null;
export function normalizeSuggestionRowsCurrency(rows: any[], input: { targetCurrency: string; rateBook?: Record<string, number> }): any[];
