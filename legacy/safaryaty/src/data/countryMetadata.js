// Safaryaty country/currency metadata foundation v4.29.24
// Curated offline metadata for MVP. Future: refresh from backend sync using REST Countries / admin-managed profiles.

export const currencyMeta = {
  AED: ["🇦🇪", "UAE Dirham"], EGP: ["🇪🇬", "Egyptian Pound"], SAR: ["🇸🇦", "Saudi Riyal"], EUR: ["🇪🇺", "Euro"], USD: ["🇺🇸", "US Dollar"], GBP: ["🇬🇧", "British Pound"], TRY: ["🇹🇷", "Turkish Lira"], QAR: ["🇶🇦", "Qatari Riyal"], KWD: ["🇰🇼", "Kuwaiti Dinar"], OMR: ["🇴🇲", "Omani Rial"], BHD: ["🇧🇭", "Bahraini Dinar"], MAD: ["🇲🇦", "Moroccan Dirham"], JOD: ["🇯🇴", "Jordanian Dinar"], CHF: ["🇨🇭", "Swiss Franc"], CAD: ["🇨🇦", "Canadian Dollar"], MXN: ["🇲🇽", "Mexican Peso"], BRL: ["🇧🇷", "Brazilian Real"], ARS: ["🇦🇷", "Argentine Peso"], TND: ["🇹🇳", "Tunisian Dinar"], DZD: ["🇩🇿", "Algerian Dinar"], ZAR: ["🇿🇦", "South African Rand"], KES: ["🇰🇪", "Kenyan Shilling"], ETB: ["🇪🇹", "Ethiopian Birr"], NGN: ["🇳🇬", "Nigerian Naira"], INR: ["🇮🇳", "Indian Rupee"], PKR: ["🇵🇰", "Pakistani Rupee"], BDT: ["🇧🇩", "Bangladeshi Taka"], LKR: ["🇱🇰", "Sri Lankan Rupee"], NPR: ["🇳🇵", "Nepalese Rupee"], THB: ["🇹🇭", "Thai Baht"], IDR: ["🇮🇩", "Indonesian Rupiah"], MYR: ["🇲🇾", "Malaysian Ringgit"], SGD: ["🇸🇬", "Singapore Dollar"], VND: ["🇻🇳", "Vietnamese Dong"], PHP: ["🇵🇭", "Philippine Peso"], CNY: ["🇨🇳", "Chinese Yuan"], HKD: ["🇭🇰", "Hong Kong Dollar"], JPY: ["🇯🇵", "Japanese Yen"], KRW: ["🇰🇷", "South Korean Won"], AUD: ["🇦🇺", "Australian Dollar"], NZD: ["🇳🇿", "New Zealand Dollar"], CZK: ["🇨🇿", "Czech Koruna"], HUF: ["🇭🇺", "Hungarian Forint"], PLN: ["🇵🇱", "Polish Zloty"], SEK: ["🇸🇪", "Swedish Krona"], NOK: ["🇳🇴", "Norwegian Krone"], DKK: ["🇩🇰", "Danish Krone"],
  ILS: ["🇮🇱", "Israeli Shekel"], RON: ["🇷🇴", "Romanian Leu"], BGN: ["🇧🇬", "Bulgarian Lev"], HRK: ["🇭🇷", "Croatian Kuna"], RSD: ["🇷🇸", "Serbian Dinar"], GEL: ["🇬🇪", "Georgian Lari"], AMD: ["🇦🇲", "Armenian Dram"], AZN: ["🇦🇿", "Azerbaijani Manat"], UZS: ["🇺🇿", "Uzbek Som"], KZT: ["🇰🇿", "Kazakhstani Tenge"], UAH: ["🇺🇦", "Ukrainian Hryvnia"], COP: ["🇨🇴", "Colombian Peso"], CLP: ["🇨🇱", "Chilean Peso"], PEN: ["🇵🇪", "Peruvian Sol"], DOP: ["🇩🇴", "Dominican Peso"], ISK: ["🇮🇸", "Icelandic Krona"]
};

export const supportedCurrencies = Object.keys(currencyMeta).sort();
export const commonTravelCurrencies = ["AED","EGP","EUR","USD","SAR","GBP","TRY","QAR","KWD","OMR","CHF","CAD","AUD","JPY","THB","SGD"];

export const countryProfiles = {
  AE: { region: "Middle East", currency: "AED", costTier: "high", travelTags: ["GCC", "city", "business"] },
  EG: { region: "North Africa", currency: "EGP", costTier: "value", travelTags: ["family", "culture", "beach"] },
  SA: { region: "Middle East", currency: "SAR", costTier: "medium-high", travelTags: ["GCC", "religious", "business"] },
  QA: { region: "Middle East", currency: "QAR", costTier: "high", travelTags: ["GCC", "business"] },
  KW: { region: "Middle East", currency: "KWD", costTier: "high", travelTags: ["GCC", "family"] },
  OM: { region: "Middle East", currency: "OMR", costTier: "medium-high", travelTags: ["GCC", "nature"] },
  BH: { region: "Middle East", currency: "BHD", costTier: "medium-high", travelTags: ["GCC", "weekend"] },
  JO: { region: "Middle East", currency: "JOD", costTier: "medium", travelTags: ["culture", "family"] },
  TR: { region: "Europe/Asia", currency: "TRY", costTier: "medium", travelTags: ["shopping", "city", "beach"] },
  MX: { region: "North America", currency: "MXN", costTier: "medium", travelTags: ["beach", "city", "culture"] },
  AZ: { region: "Caucasus", currency: "AZN", costTier: "medium", travelTags: ["city", "culture"] },
  AM: { region: "Caucasus", currency: "AMD", costTier: "value", travelTags: ["culture", "nature", "budget"] },
  GE: { region: "Caucasus", currency: "GEL", costTier: "medium", travelTags: ["nature", "budget", "city"] },
  ES: { region: "Europe", currency: "EUR", costTier: "medium-high", travelTags: ["study", "city", "beach"] },
  FR: { region: "Europe", currency: "EUR", costTier: "high", travelTags: ["city", "culture"] },
  IT: { region: "Europe", currency: "EUR", costTier: "high", travelTags: ["city", "culture"] },
  DE: { region: "Europe", currency: "EUR", costTier: "high", travelTags: ["study", "business"] },
  GB: { region: "Europe", currency: "GBP", costTier: "very-high", travelTags: ["study", "business"] },
  US: { region: "North America", currency: "USD", costTier: "very-high", travelTags: ["long-haul", "business", "study"] },
  CA: { region: "North America", currency: "CAD", costTier: "very-high", travelTags: ["study", "long-haul"] },
  IN: { region: "South Asia", currency: "INR", costTier: "value", travelTags: ["family", "medical"] },
  PK: { region: "South Asia", currency: "PKR", costTier: "value", travelTags: ["family"] },
  TH: { region: "Asia", currency: "THB", costTier: "medium", travelTags: ["beach", "tourism"] },
  MY: { region: "Asia", currency: "MYR", costTier: "medium", travelTags: ["family", "city"] },
  SG: { region: "Asia", currency: "SGD", costTier: "very-high", travelTags: ["business", "city"] },
  JP: { region: "Asia", currency: "JPY", costTier: "high", travelTags: ["long-haul", "city"] },
  AU: { region: "Oceania", currency: "AUD", costTier: "very-high", travelTags: ["long-haul", "study"] }
};

export function countryProfile(code) {
  return countryProfiles[String(code || "").toUpperCase()] || { region: "Global", currency: "USD", costTier: "medium", travelTags: [] };
}

export function currencyLabel(code) {
  const meta = currencyMeta[String(code || "").toUpperCase()] || ["🌍", "Currency"];
  return `${meta[0]} ${String(code || "").toUpperCase()} — ${meta[1]}`;
}

export function preferredCurrencyOptions(baseCurrency, tripCurrency) {
  const preferred = [baseCurrency, tripCurrency, ...commonTravelCurrencies].filter(Boolean).map(x => x.toUpperCase());
  return Array.from(new Set([...preferred, ...supportedCurrencies]));
}
