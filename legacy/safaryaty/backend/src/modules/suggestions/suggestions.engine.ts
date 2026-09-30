import type { Trip, TripCost } from "@prisma/client";
import { estimateCategoryCosts } from "./cost-profiles.js";
import { canonicalTripCategory } from "../finance/categories.js";
import { TRIP_COST_CATEGORIES } from "../../../../shared/trip-cost-domain.js";

export type GeneratedSuggestion = {
  category: string;
  currentAmount: number;
  suggestedAmount: number;
  currency: string;
  difference: number;
  message: string;
  priority: "MUST" | "FLEXIBLE" | "OPTIONAL";
  timing: "before" | "during" | "after";
};

const reasons: Record<string, string> = {
  "cat-flight": "Route estimate. Replace it with your confirmed fare when available.",
  "cat-accommodation": "Stay estimate based on destination, duration, travelers, and comfort.",
  "cat-food": "Daily meals estimate based on destination and travelers.",
  "cat-transport": "Local transport and airport movement estimate.",
  "cat-activities": "Tours, attractions, and entertainment estimate.",
  "cat-shopping": "Optional shopping allowance.",
  "cat-gifts": "Optional gift allowance.",
  "cat-emergency": "Backup money, not planned spending."
};

function daysBetween(start?: Date | null, end?: Date | null) {
  if (!start || !end) return 7;
  const diff = Math.ceil((end.getTime() - start.getTime()) / 86400000);
  return Math.max(1, Number.isFinite(diff) ? diff : 7);
}

export function generateTripSuggestions(input: { trip: Trip; tripCosts: TripCost[]; estimatedCategories?: Record<string, number> | null }): GeneratedSuggestion[] {
  const { trip, tripCosts } = input;
  const fallbackEstimates = estimateCategoryCosts({
    destinationCountry: trip.toCountry,
    tripCurrency: trip.tripCurrency,
    comfortLevel: trip.travelStyle || "Balanced",
    days: daysBetween(trip.departureDate, trip.returnDate),
    travelers: Math.max(1, Number(trip.travelers || 1))
  }) as Record<string, number | string>;
  const estimates = input.estimatedCategories || {};

  return TRIP_COST_CATEGORIES
    .filter((definition) => definition.estimateKey)
    .map((definition) => {
      const category = canonicalTripCategory(definition.id);
      const currentAmount = tripCosts
        .filter((item) => canonicalTripCategory(item.category || item.title) === category)
        .reduce((sum, item) => sum + Number(item.amount || 0), 0);
      const estimatedAmount = Number(
        estimates[category]
        ?? estimates[String(definition.estimateKey)]
        ?? fallbackEstimates[String(definition.estimateKey)]
        ?? 0
      );
      // Never apply hard-coded currency-agnostic minimums. The cost profile is already
      // expressed in the trip currency; current confirmed values win when higher.
      const suggestedAmount = Math.max(0, currentAmount, estimatedAmount);
      const difference = suggestedAmount - currentAmount;
      const message = difference < 0
        ? `Your current ${definition.label} plan is above the estimate. Keep it if already confirmed.`
        : difference > 0
          ? `${definition.label}: ${reasons[category] || "Estimated from the trip context."}`
          : `${definition.label} looks covered.`;
      return {
        category,
        currentAmount,
        suggestedAmount,
        currency: trip.tripCurrency,
        difference,
        message,
        priority: definition.priority,
        timing: definition.timing
      };
    })
    .filter((item) => item.suggestedAmount > 0 || item.currentAmount > 0);
}

export function suggestionTemplates() {
  return TRIP_COST_CATEGORIES.filter((item) => item.estimateKey);
}
