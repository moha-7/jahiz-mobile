export const comfortMultipliers: Record<string, number> = { Survival: 0.72, Balanced: 1, Comfortable: 1.32, Premium: 1.75 };

type CostProfile = {
  currency: string;
  costTier: string;
  accommodationNight: number;
  foodDay: number;
  transportDay: number;
  activitiesDay: number;
  shoppingDay: number;
  flightBase: number;
  emergencyRate: number;
};

const tierDefaults: Record<string, CostProfile> = {
  value: { currency: "USD", costTier: "value", accommodationNight: 35, foodDay: 14, transportDay: 8, activitiesDay: 10, shoppingDay: 5, flightBase: 180, emergencyRate: .10 },
  medium: { currency: "USD", costTier: "medium", accommodationNight: 70, foodDay: 28, transportDay: 14, activitiesDay: 20, shoppingDay: 12, flightBase: 260, emergencyRate: .10 },
  "medium-high": { currency: "USD", costTier: "medium-high", accommodationNight: 105, foodDay: 38, transportDay: 22, activitiesDay: 28, shoppingDay: 18, flightBase: 340, emergencyRate: .10 },
  high: { currency: "USD", costTier: "high", accommodationNight: 150, foodDay: 55, transportDay: 34, activitiesDay: 45, shoppingDay: 28, flightBase: 480, emergencyRate: .12 },
  "very-high": { currency: "USD", costTier: "very-high", accommodationNight: 210, foodDay: 75, transportDay: 48, activitiesDay: 65, shoppingDay: 40, flightBase: 650, emergencyRate: .14 }
};

const countryCostProfiles: Record<string, CostProfile> = {
  EG: { currency: "EGP", costTier: "value", accommodationNight: 1600, foodDay: 550, transportDay: 220, activitiesDay: 450, shoppingDay: 300, flightBase: 9000, emergencyRate: .10 },
  AE: { currency: "AED", costTier: "high", accommodationNight: 420, foodDay: 140, transportDay: 80, activitiesDay: 120, shoppingDay: 90, flightBase: 900, emergencyRate: .12 },
  SA: { currency: "SAR", costTier: "medium-high", accommodationNight: 330, foodDay: 105, transportDay: 55, activitiesDay: 85, shoppingDay: 65, flightBase: 800, emergencyRate: .10 },
  TR: { currency: "TRY", costTier: "medium", accommodationNight: 2200, foodDay: 760, transportDay: 260, activitiesDay: 560, shoppingDay: 350, flightBase: 7800, emergencyRate: .10 },
  GE: { currency: "GEL", costTier: "medium", accommodationNight: 115, foodDay: 45, transportDay: 18, activitiesDay: 35, shoppingDay: 22, flightBase: 650, emergencyRate: .10 },
  AM: { currency: "AMD", costTier: "value", accommodationNight: 18000, foodDay: 7000, transportDay: 2500, activitiesDay: 5000, shoppingDay: 3000, flightBase: 110000, emergencyRate: .10 },
  AZ: { currency: "AZN", costTier: "medium", accommodationNight: 95, foodDay: 38, transportDay: 15, activitiesDay: 30, shoppingDay: 20, flightBase: 420, emergencyRate: .10 },
  MX: { currency: "MXN", costTier: "medium", accommodationNight: 1200, foodDay: 480, transportDay: 190, activitiesDay: 360, shoppingDay: 220, flightBase: 6500, emergencyRate: .10 },
  GB: { currency: "GBP", costTier: "very-high", accommodationNight: 170, foodDay: 60, transportDay: 28, activitiesDay: 45, shoppingDay: 35, flightBase: 520, emergencyRate: .14 },
  FR: { currency: "EUR", costTier: "high", accommodationNight: 160, foodDay: 60, transportDay: 30, activitiesDay: 45, shoppingDay: 35, flightBase: 450, emergencyRate: .12 },
  IT: { currency: "EUR", costTier: "high", accommodationNight: 145, foodDay: 52, transportDay: 26, activitiesDay: 40, shoppingDay: 30, flightBase: 420, emergencyRate: .12 },
  DE: { currency: "EUR", costTier: "high", accommodationNight: 135, foodDay: 48, transportDay: 24, activitiesDay: 35, shoppingDay: 28, flightBase: 430, emergencyRate: .12 },
  ES: { currency: "EUR", costTier: "medium-high", accommodationNight: 115, foodDay: 40, transportDay: 22, activitiesDay: 32, shoppingDay: 24, flightBase: 380, emergencyRate: .11 },
  US: { currency: "USD", costTier: "very-high", accommodationNight: 220, foodDay: 78, transportDay: 50, activitiesDay: 70, shoppingDay: 45, flightBase: 750, emergencyRate: .14 },
  CA: { currency: "CAD", costTier: "very-high", accommodationNight: 230, foodDay: 82, transportDay: 55, activitiesDay: 75, shoppingDay: 48, flightBase: 900, emergencyRate: .14 },
  TH: { currency: "THB", costTier: "medium", accommodationNight: 2300, foodDay: 850, transportDay: 360, activitiesDay: 700, shoppingDay: 450, flightBase: 10500, emergencyRate: .10 },
  MY: { currency: "MYR", costTier: "medium", accommodationNight: 260, foodDay: 90, transportDay: 40, activitiesDay: 75, shoppingDay: 50, flightBase: 1100, emergencyRate: .10 },
  SG: { currency: "SGD", costTier: "very-high", accommodationNight: 250, foodDay: 80, transportDay: 38, activitiesDay: 70, shoppingDay: 45, flightBase: 650, emergencyRate: .14 }
};

export function profileCurrencyForCountry(countryCode?: string | null, fallback = "USD") {
  const profile = countryCostProfiles[String(countryCode || "").toUpperCase()];
  return String(profile?.currency || fallback || "USD").toUpperCase();
}

function roundToNice(value: number, currency = "USD") {
  const n = Math.max(0, Number(value) || 0);
  const zeroDecimal = ["JPY", "KRW", "VND", "IDR", "EGP", "THB", "TRY"].includes(currency);
  const step = zeroDecimal ? (n > 100000 ? 1000 : n > 10000 ? 500 : 100) : (n > 1000 ? 50 : 10);
  return Math.max(step, Math.round(n / step) * step);
}

export function estimateCategoryCosts(input: { destinationCountry?: string | null; tripCurrency?: string | null; costTier?: string | null; comfortLevel?: string | null; days?: number; travelers?: number }) {
  const destinationCountry = String(input.destinationCountry || "").toUpperCase();
  const tripCurrency = String(input.tripCurrency || "USD").toUpperCase();
  const profile = countryCostProfiles[destinationCountry];
  const fallback = tierDefaults[input.costTier || "medium"] || tierDefaults.medium;
  const source = profile && profile.currency === tripCurrency ? profile : { ...fallback, currency: tripCurrency, emergencyRate: profile?.emergencyRate || fallback.emergencyRate };
  const days = Math.max(1, Number(input.days || 7));
  const nights = Math.max(1, days - 1);
  const travelers = Math.max(1, Number(input.travelers || 1));
  const comfort = comfortMultipliers[String(input.comfortLevel || "Balanced")] || 1;
  const accommodation = source.accommodationNight * nights * Math.max(1, Math.ceil(travelers / 2)) * comfort;
  const food = source.foodDay * days * travelers * comfort;
  const transport = source.transportDay * days * travelers * comfort;
  const activities = source.activitiesDay * days * travelers * comfort;
  const shopping = source.shoppingDay * days * travelers * Math.max(.65, comfort * .85);
  const gifts = shopping * 0.35;
  const flight = source.flightBase * travelers;
  const subtotal = accommodation + food + transport + activities + shopping + gifts + flight;
  const emergency = Math.max(source.currency === "EGP" ? 1000 : 100, subtotal * (source.emergencyRate || .1));
  return {
    flight: roundToNice(flight, tripCurrency),
    accommodation: roundToNice(accommodation, tripCurrency),
    food: roundToNice(food, tripCurrency),
    transport: roundToNice(transport, tripCurrency),
    activities: roundToNice(activities, tripCurrency),
    shopping: roundToNice(shopping, tripCurrency),
    gifts: roundToNice(gifts, tripCurrency),
    emergency: roundToNice(emergency, tripCurrency),
    source: profile ? "country-cost-profile" : "tier-cost-profile"
  };
}

export const categoryUnits: Record<string, string> = {
  "cat-flight": "per trip",
  "cat-accommodation": "per room / night",
  "cat-food": "per traveler / day",
  "cat-transport": "per traveler / day",
  "cat-activities": "per traveler / day",
  "cat-shopping": "flexible trip budget",
  "cat-gifts": "flexible gift budget",
  "cat-emergency": "safety reserve"
};

const rangeMultipliers = { low: 0.78, typical: 1, high: 1.32 };

export function estimateCategoryRanges(input: { destinationCountry?: string | null; tripCurrency?: string | null; costTier?: string | null; comfortLevel?: string | null; days?: number; travelers?: number }) {
  const currency = String(input.tripCurrency || "USD").toUpperCase();
  const typical = estimateCategoryCosts(input);
  const categories = Object.fromEntries(
    [["cat-flight", "flight"], ["cat-accommodation", "accommodation"], ["cat-food", "food"], ["cat-transport", "transport"], ["cat-activities", "activities"], ["cat-shopping", "shopping"], ["cat-gifts", "gifts"], ["cat-emergency", "emergency"]].map(([categoryId, estimateKey]) => {
      const value = Number((typical as any)[estimateKey] || 0);
      return [categoryId, {
        low: roundToNice(value * rangeMultipliers.low, currency),
        typical: roundToNice(value, currency),
        high: roundToNice(value * rangeMultipliers.high, currency),
        unit: categoryUnits[categoryId] || "trip total"
      }];
    })
  );
  const totals = Object.values(categories).reduce((acc: any, item: any) => ({
    low: acc.low + item.low,
    typical: acc.typical + item.typical,
    high: acc.high + item.high
  }), { low: 0, typical: 0, high: 0 });
  const source = typical.source || "tier-cost-profile";
  return {
    currency,
    categories,
    totals: {
      low: roundToNice(totals.low, currency),
      typical: roundToNice(totals.typical, currency),
      high: roundToNice(totals.high, currency)
    },
    source,
    confidence: source === "country-cost-profile" ? "medium" : "low",
    asOf: null,
    assumptions: [
      `${Math.max(1, Number(input.travelers || 1))} traveler(s)`,
      `${Math.max(1, Number(input.days || 7))} day(s)`,
      `${input.comfortLevel || "Balanced"} comfort`
    ]
  };
}
