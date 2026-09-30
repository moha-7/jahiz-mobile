// Safaryaty country cost profiles foundation v4.29.25
// Curated offline MVP estimates. These are NOT salary allocations and NOT booking prices.
// They are destination-cost estimates that can later be refreshed by backend/admin/external APIs.

export const comfortMultipliers = { Survival: 0.72, Balanced: 1, Comfortable: 1.32, Premium: 1.75 };

export const tierDefaults = {
  value: { currency: "USD", accommodationNight: 35, foodDay: 14, transportDay: 8, activitiesDay: 10, shoppingDay: 5, flightBase: 180, emergencyRate: .10 },
  medium: { currency: "USD", accommodationNight: 70, foodDay: 28, transportDay: 14, activitiesDay: 20, shoppingDay: 12, flightBase: 260, emergencyRate: .10 },
  "medium-high": { currency: "USD", accommodationNight: 105, foodDay: 38, transportDay: 22, activitiesDay: 28, shoppingDay: 18, flightBase: 340, emergencyRate: .10 },
  high: { currency: "USD", accommodationNight: 150, foodDay: 55, transportDay: 34, activitiesDay: 45, shoppingDay: 28, flightBase: 480, emergencyRate: .12 },
  "very-high": { currency: "USD", accommodationNight: 210, foodDay: 75, transportDay: 48, activitiesDay: 65, shoppingDay: 40, flightBase: 650, emergencyRate: .14 }
};

export const countryCostProfiles = {
  EG: { currency: "EGP", costTier: "value", accommodationNight: 1600, foodDay: 550, transportDay: 220, activitiesDay: 450, shoppingDay: 300, flightBase: 9000, emergencyRate: .10 },
  AE: { currency: "AED", costTier: "high", accommodationNight: 420, foodDay: 140, transportDay: 80, activitiesDay: 120, shoppingDay: 90, flightBase: 900, emergencyRate: .12 },
  SA: { currency: "SAR", costTier: "medium-high", accommodationNight: 330, foodDay: 105, transportDay: 55, activitiesDay: 85, shoppingDay: 65, flightBase: 800, emergencyRate: .10 },
  QA: { currency: "QAR", costTier: "high", accommodationNight: 450, foodDay: 145, transportDay: 80, activitiesDay: 120, shoppingDay: 85, flightBase: 900, emergencyRate: .12 },
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

const roundToNice = (value, currency = "USD") => {
  const n = Math.max(0, Number(value) || 0);
  const zeroDecimal = ["JPY", "KRW", "VND", "IDR", "EGP", "THB", "TRY"].includes(currency);
  const step = zeroDecimal ? (n > 100000 ? 1000 : n > 10000 ? 500 : 100) : (n > 1000 ? 50 : 10);
  return Math.max(step, Math.round(n / step) * step);
};

export function countryCostProfile(code, currency = "USD", fallbackTier = "medium") {
  const direct = countryCostProfiles[String(code || "").toUpperCase()];
  if (direct) return direct;
  return { ...tierDefaults[fallbackTier] || tierDefaults.medium, currency };
}

export const costRangeMultipliers = { low: 0.78, typical: 1, high: 1.32 };

export const categoryUnits = {
  "cat-flight": "per trip",
  "cat-accommodation": "per room / night",
  "cat-food": "per traveler / day",
  "cat-transport": "per traveler / day",
  "cat-activities": "per traveler / day",
  "cat-shopping": "flexible trip budget",
  "cat-gifts": "flexible gift budget",
  "cat-emergency": "safety reserve"
};

function rangeFor(typical, currency) {
  return {
    low: roundToNice(typical * costRangeMultipliers.low, currency),
    typical: roundToNice(typical, currency),
    high: roundToNice(typical * costRangeMultipliers.high, currency)
  };
}

export function estimateCategoryRanges(input = {}) {
  const typical = estimateCategoryCostsInternal(input);
  const currency = input.tripCurrency || typical._meta?.profileCurrency || "USD";
  const ranges = estimateCategoryRangesFromTypical(typical, currency);
  return {
    ...ranges,
    asOf: null,
    assumptions: [
      `${Math.max(1, Number(input.travelers || 1))} traveler(s)`,
      `${Math.max(1, Number(input.days || 7))} day(s)`,
      `${input.comfortLevel || "Balanced"} comfort`
    ]
  };
}

function estimateCategoryCostsInternal({ destinationCountry = "", tripCurrency = "USD", costTier = "medium", comfortLevel = "Balanced", days = 7, travelers = 1 } = {}) {

  const nights = Math.max(1, days - 1);
  const t = Math.max(1, travelers || 1);
  const profile = countryCostProfile(destinationCountry, tripCurrency, costTier);
  const profileCurrencyMatches = !profile.currency || profile.currency === tripCurrency;
  const generic = tierDefaults[profile.costTier || costTier] || tierDefaults.medium;
  const source = profileCurrencyMatches ? profile : { ...generic, currency: tripCurrency, emergencyRate: profile.emergencyRate || generic.emergencyRate };
  const comfort = comfortMultipliers[comfortLevel] || 1;
  const accommodation = source.accommodationNight * nights * Math.max(1, Math.ceil(t / 2)) * comfort;
  const food = source.foodDay * days * t * comfort;
  const transport = source.transportDay * days * t * comfort;
  const activities = source.activitiesDay * days * t * comfort;
  const shopping = source.shoppingDay * days * t * Math.max(.65, comfort * .85);
  const gifts = shopping * 0.35;
  const flight = source.flightBase * t;
  const subtotal = accommodation + food + transport + activities + shopping + gifts + flight;
  const emergency = Math.max(source.currency === "EGP" ? 1000 : 100, subtotal * (source.emergencyRate || .1));
  return {
    "cat-flight": roundToNice(flight, tripCurrency),
    "cat-accommodation": roundToNice(accommodation, tripCurrency),
    "cat-food": roundToNice(food, tripCurrency),
    "cat-transport": roundToNice(transport, tripCurrency),
    "cat-activities": roundToNice(activities, tripCurrency),
    "cat-shopping": roundToNice(shopping, tripCurrency),
    "cat-gifts": roundToNice(gifts, tripCurrency),
    "cat-emergency": roundToNice(emergency, tripCurrency),
    _meta: { profileCurrency: profile.currency, usedGenericCurrencyFallback: !profileCurrencyMatches, costTier: profile.costTier || costTier, source: directSourceLabel(destinationCountry) }
  };
}


export function estimateCategoryCosts(input = {}) {
  const result = estimateCategoryCostsInternal(input);
  const ranges = estimateCategoryRangesFromTypical(result, input.tripCurrency || "USD");
  return { ...result, _ranges: ranges.categories, _rangeMeta: { confidence: ranges.confidence, source: ranges.source, currency: ranges.currency, totals: ranges.totals } };
}

function estimateCategoryRangesFromTypical(typical, currency) {
  const categories = {};
  Object.entries(typical).forEach(([key, value]) => {
    if (key.startsWith("_")) return;
    categories[key] = { ...rangeFor(Number(value) || 0, currency), unit: categoryUnits[key] || "trip total" };
  });
  const totalsRaw = Object.values(categories).reduce((acc, item) => ({ low: acc.low + item.low, typical: acc.typical + item.typical, high: acc.high + item.high }), { low: 0, typical: 0, high: 0 });
  const source = typical._meta?.source || "tier-cost-profile";
  return { currency, categories, totals: { low: roundToNice(totalsRaw.low, currency), typical: roundToNice(totalsRaw.typical, currency), high: roundToNice(totalsRaw.high, currency) }, confidence: source === "country-cost-profile" ? "medium" : "low", source };
}

function directSourceLabel(code) {
  return countryCostProfiles[String(code || "").toUpperCase()] ? "country-cost-profile" : "tier-cost-profile";
}

export function estimateTotalFromCategories(categories) {
  return Object.entries(categories || {}).filter(([k]) => !k.startsWith("_")).reduce((sum, [, value]) => sum + (Number(value) || 0), 0);
}
