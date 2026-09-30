import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import "./styles/safaryaty.css";
import { api, backendTripToClient, googleAuthStartUrl, normalizeBackendUser, toProfilePayload, toRegisterPayload } from "./api.js";
import { budgetItemCost, calculate, recommendations } from "./engine.js";
import { canTravel } from "./canTravel.js";
import { countries, airports } from "./data/routeOptions.js";
import { supportedCurrencies as metadataSupportedCurrencies, currencyMeta as metadataCurrencyMeta, currencyLabel as metadataCurrencyLabel, preferredCurrencyOptions, countryProfile } from "./data/countryMetadata.js";
import { estimateTotalFromCategories } from "./data/costProfiles.js";
import { resolveLocalCostEstimateBundle, normalizeBackendRangeProfile, normalizeBackendSuggestions } from "./costEstimateResolver.js";
import { convertCurrencyAmount, convertTripLocal, displayCurrencyFor as fxDisplayCurrency, pairRateFromBook, secondaryCurrencyFor } from "./fx.js";
import { applyResolvedRate, prepareCurrencyChange, resolveApiRate } from "./currency-service.js";
import { convertIncomeCurrencyValues, convertTripCurrencyValues, currencyPairKey, normalizeCurrencyCode } from "../shared/currency-domain.js";
import { TRIP_COST_CATEGORIES, canonicalTripCategory, dedupeSuggestionsByCategory, tripCostCategoryLabel } from "../shared/trip-cost-domain.js";
import { notificationIcon } from "./notifications.js";
import { useNotificationCenter } from "./useNotificationCenter.js";

const uid = (p = "id") => `${p}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
const persistedTripId = (trip) => { const id = trip?.backendId || trip?.id || ""; return /^(trip|draft|demo)-/i.test(String(id)) ? "" : String(id); };
const num = (v) => Number.isFinite(Number(v)) ? Number(v) : 0;
const cleanPositiveInt = (v, min = 1) => { const n = parseInt(String(v ?? "").replace(/^0+(?=\d)/, ""), 10); return Number.isFinite(n) ? Math.max(min, n) : min; };
const clone = (v) => JSON.parse(JSON.stringify(v));
const money = (v, c = "AED", d = 2) => `${num(v).toLocaleString(undefined, { maximumFractionDigits: d })} ${c}`;
const whole = (v, c = "EGP") => `${num(v).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${c}`;
const displayCurrency = (trip) => fxDisplayCurrency(trip);
const secondaryCurrency = (trip) => secondaryCurrencyFor(trip);
const displayWhole = (amountLocal, trip) => whole(convertTripLocal(amountLocal, trip), displayCurrency(trip));
const dualCurrencyNote = (amountLocal, trip, primary = displayCurrency(trip)) => {
  if (!trip.baseCurrency || !trip.tripCurrency) return "";
  const alt = primary === trip.tripCurrency ? trip.baseCurrency : trip.tripCurrency;
  if (!alt || alt === primary) return "";
  return `≈ ${whole(convertTripLocal(amountLocal, trip, alt), alt)}`;
};
const displayMoneyNote = (amountLocal, trip) => dualCurrencyNote(amountLocal, trip);
const daysBetween = (a, b) => Math.max(1, Math.ceil((new Date(b) - new Date(a)) / 86400000));
const tripLengthType = (trip) => {
  if (!trip?.startDate || !trip?.endDate) return "UNSET";
  const days = daysBetween(trip.startDate, trip.endDate);
  if (days <= 3) return "SHORT";
  if (days <= 10) return "MEDIUM";
  if (days <= 30) return "LONG";
  return "EXTENDED";
};
const tripModeFor = (trip) => {
  const purpose = trip?.tripPurpose || trip?.tripType || "Short Trip";
  const length = tripLengthType(trip);
  if (["Study Trip", "Relocation Trip"].includes(purpose)) return "HYBRID";
  if (["Long Stay"].includes(purpose)) return "LONG_MONTHLY";
  if (length === "EXTENDED") return ["Family Visit", "Business Trip", "Medical Trip"].includes(purpose) ? "HYBRID" : "LONG_MONTHLY";
  return "SHORT_TOTAL";
};
const tripLengthLabel = (trip) => {
  if (!trip?.startDate || !trip?.endDate) return "Set dates to calculate trip length";
  const days = daysBetween(trip.startDate, trip.endDate);
  const label = tripLengthType(trip).toLowerCase().replace(/^./, c => c.toUpperCase());
  return `${days} days · ${label} · ${tripModeFor(trip).replaceAll("_", " ")}`;
};
const tripPurposes = [
  { value:"Short Trip", icon:"calendar2-week", title:"Short Trip", note:"Tourism, quick visit, total trip budget." },
  { value:"Long Stay", icon:"house-door", title:"Long Stay", note:"Monthly destination living costs." },
  { value:"Study Trip", icon:"mortarboard", title:"Study", note:"Monthly stay, documents, insurance, transport pass." },
  { value:"Family Visit", icon:"people", title:"Family Visit", note:"Gifts, transport, outings, flexible stay." },
  { value:"Business Trip", icon:"briefcase", title:"Business", note:"Meetings, hotel, transport, work spending." },
  { value:"Event Trip", icon:"ticket-perforated", title:"Event", note:"Ticket, hotel near venue, transport, food." },
  { value:"Medical Trip", icon:"hospital", title:"Medical", note:"Clinic costs, stay, transport, safety reserve." },
  { value:"Relocation Trip", icon:"house-up", title:"Relocation", note:"Deposit, setup costs, first month survival." },
  { value:"Adventure Trip", icon:"compass", title:"Adventure", note:"Activities, gear, safety, emergency buffer." },
  { value:"Couple / Honeymoon", icon:"heart", title:"Couple", note:"Stay, food, activities, comfort options." }
];

const baseTripCostPresets = [
  {name:"Flight",icon:"airplane",categoryId:"cat-flight",amountLocal:0,priority:"Must",timing:"before",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
  {name:"Accommodation",icon:"building",categoryId:"cat-accommodation",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
  {name:"Food",icon:"cup-hot",categoryId:"cat-food",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
  {name:"Local Transport",icon:"car-front",categoryId:"cat-transport",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
  {name:"Activities",icon:"stars",categoryId:"cat-activities",amountLocal:0,priority:"Flexible",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
  {name:"Emergency",icon:"shield-check",categoryId:"cat-emergency",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"SETUP",currencyScope:"DESTINATION"}
];
const destinationCostProfiles = {
  "Short Trip": baseTripCostPresets,
  "Couple / Honeymoon": [
    ...baseTripCostPresets,
    {name:"Couple Experience",icon:"heart",categoryId:"cat-activities",amountLocal:0,priority:"Flexible",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Shopping / Gifts",icon:"bag",categoryId:"cat-shopping",amountLocal:0,priority:"Optional",timing:"during",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"}
  ],
  "Family Visit": [
    {name:"Flight",icon:"airplane",categoryId:"cat-flight",amountLocal:0,priority:"Must",timing:"before",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Gifts",icon:"gift",categoryId:"cat-gifts",amountLocal:0,priority:"Flexible",timing:"before",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Family Outings",icon:"people",categoryId:"cat-family-outings",amountLocal:0,priority:"Flexible",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Food Contributions",icon:"basket",categoryId:"cat-food-contribution",amountLocal:0,priority:"Flexible",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Local Transport",icon:"car-front",categoryId:"cat-transport",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Emergency",icon:"shield-check",categoryId:"cat-emergency",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"SETUP",currencyScope:"DESTINATION"}
  ],
  "Study Trip": [
    {name:"Academic / University Fees",icon:"mortarboard",categoryId:"cat-university-fees",amountLocal:0,priority:"Must",timing:"before",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Student Accommodation / Month",icon:"house",categoryId:"cat-student-accommodation",amountLocal:0,priority:"Must",timing:"during",frequency:"monthly",costType:"MONTHLY",currencyScope:"DESTINATION"},
    {name:"Food / Month",icon:"cup-hot",categoryId:"cat-food",amountLocal:0,priority:"Must",timing:"during",frequency:"monthly",costType:"MONTHLY",currencyScope:"DESTINATION"},
    {name:"Transport Pass / Month",icon:"train-front",categoryId:"cat-transport-pass",amountLocal:0,priority:"Must",timing:"during",frequency:"monthly",costType:"MONTHLY",currencyScope:"DESTINATION"},
    {name:"Health Insurance",icon:"shield-plus",categoryId:"cat-health-insurance",amountLocal:0,priority:"Must",timing:"before",frequency:"monthly",costType:"MONTHLY",currencyScope:"DESTINATION"},
    {name:"Visa & Documents",icon:"file-earmark-text",categoryId:"cat-visa-documents",amountLocal:0,priority:"Must",timing:"before",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Books / Materials",icon:"book",categoryId:"cat-books-materials",amountLocal:0,priority:"Flexible",timing:"during",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"SIM / Internet",icon:"wifi",categoryId:"cat-sim-internet",amountLocal:0,priority:"Must",timing:"during",frequency:"monthly",costType:"MONTHLY",currencyScope:"DESTINATION"},
    {name:"Emergency Reserve",icon:"shield-check",categoryId:"cat-emergency",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"SETUP",currencyScope:"DESTINATION"}
  ],
  "Long Stay": [
    {name:"Rent / Month",icon:"house-door",categoryId:"cat-accommodation",amountLocal:0,priority:"Must",timing:"during",frequency:"monthly",costType:"MONTHLY",currencyScope:"DESTINATION"},
    {name:"Food / Month",icon:"cup-hot",categoryId:"cat-food",amountLocal:0,priority:"Must",timing:"during",frequency:"monthly",costType:"MONTHLY",currencyScope:"DESTINATION"},
    {name:"Transport / Month",icon:"train-front",categoryId:"cat-transport-pass",amountLocal:0,priority:"Must",timing:"during",frequency:"monthly",costType:"MONTHLY",currencyScope:"DESTINATION"},
    {name:"SIM / Internet",icon:"wifi",categoryId:"cat-sim-internet",amountLocal:0,priority:"Must",timing:"during",frequency:"monthly",costType:"MONTHLY",currencyScope:"DESTINATION"},
    {name:"Laundry / Utilities",icon:"droplet",categoryId:"cat-other-trip",amountLocal:0,priority:"Flexible",timing:"during",frequency:"monthly",costType:"MONTHLY",currencyScope:"DESTINATION"},
    {name:"Emergency Reserve",icon:"shield-check",categoryId:"cat-emergency",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"SETUP",currencyScope:"DESTINATION"}
  ],
  "Relocation Trip": [
    {name:"Deposit",icon:"safe",categoryId:"cat-deposit",amountLocal:0,priority:"Must",timing:"before",frequency:"one-time",costType:"SETUP",currencyScope:"DESTINATION"},
    {name:"First Rent",icon:"house",categoryId:"cat-first-rent",amountLocal:0,priority:"Must",timing:"before",frequency:"one-time",costType:"SETUP",currencyScope:"DESTINATION"},
    {name:"Furniture Basics",icon:"lamp",categoryId:"cat-furniture",amountLocal:0,priority:"Flexible",timing:"during",frequency:"one-time",costType:"SETUP",currencyScope:"DESTINATION"},
    {name:"Documents / Residence",icon:"file-earmark-text",categoryId:"cat-visa-documents",amountLocal:0,priority:"Must",timing:"before",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"First Month Living",icon:"basket",categoryId:"cat-food",amountLocal:0,priority:"Must",timing:"during",frequency:"one-time",costType:"SETUP",currencyScope:"DESTINATION"},
    {name:"Moving Costs",icon:"truck",categoryId:"cat-moving",amountLocal:0,priority:"Flexible",timing:"before",frequency:"one-time",costType:"SETUP",currencyScope:"DESTINATION"},
    {name:"Emergency Reserve",icon:"shield-check",categoryId:"cat-emergency",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"SETUP",currencyScope:"DESTINATION"}
  ],
  "Event Trip": [
    {name:"Event Ticket",icon:"ticket-perforated",categoryId:"cat-event-ticket",amountLocal:0,priority:"Must",timing:"before",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Hotel Near Venue",icon:"building",categoryId:"cat-accommodation",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Transport",icon:"car-front",categoryId:"cat-transport",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Food",icon:"cup-hot",categoryId:"cat-food",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Merchandise",icon:"bag",categoryId:"cat-shopping",amountLocal:0,priority:"Optional",timing:"during",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Emergency",icon:"shield-check",categoryId:"cat-emergency",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"SETUP",currencyScope:"DESTINATION"}
  ],
  "Business Trip": [
    {name:"Flight",icon:"airplane",categoryId:"cat-flight",amountLocal:0,priority:"Must",timing:"before",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Hotel",icon:"building",categoryId:"cat-accommodation",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Transport",icon:"car-front",categoryId:"cat-transport",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Food",icon:"cup-hot",categoryId:"cat-food",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Meeting / Work Costs",icon:"briefcase",categoryId:"cat-meeting",amountLocal:0,priority:"Flexible",timing:"during",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Emergency",icon:"shield-check",categoryId:"cat-emergency",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"SETUP",currencyScope:"DESTINATION"}
  ],
  "Medical Trip": [
    {name:"Clinic / Hospital Fees",icon:"hospital",categoryId:"cat-medical-fees",amountLocal:0,priority:"Must",timing:"before",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Medical Tests",icon:"clipboard2-pulse",categoryId:"cat-medical-fees",amountLocal:0,priority:"Must",timing:"during",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Medication",icon:"capsule",categoryId:"cat-medication",amountLocal:0,priority:"Must",timing:"during",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Accommodation",icon:"building",categoryId:"cat-accommodation",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Companion Costs",icon:"person-heart",categoryId:"cat-other-trip",amountLocal:0,priority:"Flexible",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"},
    {name:"Emergency",icon:"shield-check",categoryId:"cat-emergency",amountLocal:0,priority:"Must",timing:"during",frequency:"trip-total",costType:"SETUP",currencyScope:"DESTINATION"}
  ],
  "Adventure Trip": [
    ...baseTripCostPresets,
    {name:"Gear / Equipment",icon:"backpack",categoryId:"cat-gear",amountLocal:0,priority:"Flexible",timing:"before",frequency:"one-time",costType:"ONE_TIME",currencyScope:"DESTINATION"},
    {name:"Guides / Tours",icon:"map",categoryId:"cat-activities",amountLocal:0,priority:"Flexible",timing:"during",frequency:"trip-total",costType:"TRIP_TOTAL",currencyScope:"DESTINATION"}
  ]
};
function tripCostPresetsFor(trip) {
  const purpose = trip?.tripPurpose || trip?.tripType || "Short Trip";
  return (destinationCostProfiles[purpose] || baseTripCostPresets).map(x => ({ ...x }));
}
function destinationCostInfo(trip) {
  const mode = tripModeFor(trip);
  if (mode === "LONG_MONTHLY") return { title:"Destination Costs", subtitle:"Monthly costs in the country you are going to.", info:"Add monthly costs in the country you are going to." };
  if (mode === "HYBRID") return { title:"Destination Costs", subtitle:"Setup costs + monthly costs for this plan.", info:"Add setup costs and monthly costs for this plan." };
  return { title:"Destination Costs", subtitle:"Total spending for the whole trip.", info:"Add the trip costs you expect to pay there." };
}
function costBadge(item) {
  const cost = item.costType || (item.frequency === "monthly" ? "MONTHLY" : item.frequency === "one-time" ? "ONE_TIME" : item.frequency === "trip-total" ? "TRIP_TOTAL" : "COST");
  const scope = item.currencyScope || "DESTINATION";
  return `${cost.replaceAll("_"," ")} · ${scope.toLowerCase()} currency`;
}

const monthLabel = (d) => {
  const date = new Date(d);
  return Number.isNaN(date.getTime()) ? "Planning" : date.toLocaleString("en-US", { month: "short", day: "numeric" });
};

const supportedCurrencies = metadataSupportedCurrencies;
const currencyMeta = metadataCurrencyMeta;
const currencyLabel = metadataCurrencyLabel;
const quickCurrencies = ["AED","EGP","EUR","USD","SAR","TRY","GBP","QAR","KWD"];
const languages = [
  { value: "en", label: "English", short: "EN" },
  { value: "ar", label: "Arabic", short: "AR" },
  { value: "es", label: "Spanish", short: "ES" }
];


const uiText = {
  en: {
    language: "Language",
    travelDecision: "Travel decision",
    canTakeTrip: "Can you take this trip?",
    progress: "Progress",
    nextAction: "Next action",
    improve: "Improve Plan",
    wizardProgress: "Wizard progress",
    newTrip: "New Trip",
    logout: "Logout",
    simple: "Simple",
    advanced: "Advanced",
    Home: "Dashboard",
    Payments: "Trip Payments",
    "Trip Costs": "Trip Costs",
    "Monthly Payments": "Commitments",
    Advice: "Recommendations",
    "My Trips": "My Trips",
    "Travel Profile": "Profile",
    Cashflow: "Cashflow",
    Categories: "Categories"
  },
  ar: {
    language: "اللغة",
    travelDecision: "قرار السفر",
    canTakeTrip: "تقدر تسافر؟",
    progress: "التقدم",
    nextAction: "الخطوة القادمة",
    improve: "حسّن الخطة",
    wizardProgress: "تقدم الخطوات",
    newTrip: "رحلة جديدة",
    logout: "تسجيل خروج",
    simple: "بسيط",
    advanced: "متقدم",
    Home: "لوحة القرار",
    Payments: "مدفوعات الرحلة",
    "Trip Costs": "تكاليف الرحلة",
    "Monthly Payments": "الالتزامات",
    Advice: "التوصيات",
    "My Trips": "رحلاتي",
    "Travel Profile": "الملف",
    Cashflow: "التدفق النقدي",
    Categories: "التصنيفات"
  },
  es: {
    language: "Idioma",
    travelDecision: "Decisión de viaje",
    canTakeTrip: "¿Puedes hacer este viaje?",
    progress: "Progreso",
    nextAction: "Siguiente acción",
    improve: "Mejorar plan",
    wizardProgress: "Progreso del asistente",
    newTrip: "Nuevo viaje",
    logout: "Cerrar sesión",
    simple: "Simple",
    advanced: "Avanzado",
    Home: "Panel",
    Payments: "Pagos del viaje",
    "Trip Costs": "Costes del viaje",
    "Monthly Payments": "Compromisos",
    Advice: "Recomendaciones",
    "My Trips": "Mis viajes",
    "Travel Profile": "Perfil",
    Cashflow: "Flujo de caja",
    Categories: "Categorías"
  }
};
const langText = (language = "en", key = "") => uiText[language]?.[key] || uiText.en?.[key] || key;

const frequencies = [
  { value: "one-time", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
  { value: "trip-total", label: "Trip total" }
];

const categories = [
  { id: "cat-salary", name: "Salary", type: "income" },
  { id: "cat-rent", name: "Rent", type: "life" },
  { id: "cat-phone", name: "Phone", type: "life" },
  { id: "cat-gym", name: "Gym", type: "life" },
  { id: "cat-food-uae", name: "Food & Transport", type: "life" },
  { id: "cat-subscriptions", name: "Subscriptions", type: "life" },
  { id: "cat-other-life", name: "Other Life Cost", type: "life" },
  { id: "cat-flight", name: "Flights", type: "trip" },
  { id: "cat-accommodation", name: "Accommodation", type: "trip" },
  { id: "cat-food", name: "Food & Cafes", type: "trip" },
  { id: "cat-transport", name: "Local Transport", type: "trip" },
  { id: "cat-activities", name: "Activities", type: "trip" },
  { id: "cat-shopping", name: "Shopping / Clothes", type: "trip" },
  { id: "cat-gifts", name: "Gifts", type: "trip" },
  { id: "cat-emergency", name: "Emergency", type: "trip" },
  { id: "cat-daytrip", name: "Day Trips", type: "trip" },
  { id: "cat-university-fees", name: "Academic / University Fees", type: "trip" },
  { id: "cat-student-accommodation", name: "Student Accommodation", type: "trip" },
  { id: "cat-transport-pass", name: "Transport Pass", type: "trip" },
  { id: "cat-visa-documents", name: "Visa & Documents", type: "trip" },
  { id: "cat-health-insurance", name: "Health Insurance", type: "trip" },
  { id: "cat-books-materials", name: "Books / Materials", type: "trip" },
  { id: "cat-sim-internet", name: "SIM / Internet", type: "trip" },
  { id: "cat-deposit", name: "Deposit", type: "trip" },
  { id: "cat-first-rent", name: "First Rent", type: "trip" },
  { id: "cat-furniture", name: "Furniture Basics", type: "trip" },
  { id: "cat-moving", name: "Moving Costs", type: "trip" },
  { id: "cat-event-ticket", name: "Event Ticket", type: "trip" },
  { id: "cat-medical-fees", name: "Clinic / Hospital Fees", type: "trip" },
  { id: "cat-medication", name: "Medication", type: "trip" },
  { id: "cat-meeting", name: "Meeting / Work Costs", type: "trip" },
  { id: "cat-gear", name: "Gear / Equipment", type: "trip" },
  { id: "cat-family-outings", name: "Family Outings", type: "trip" },
  { id: "cat-food-contribution", name: "Food Contributions", type: "trip" },
  { id: "cat-other-trip", name: "Other Destination Cost", type: "trip" }
];

const travelFrequencies = [
  { value: "rarely", label: "Rarely — once a year or less" },
  { value: "sometimes", label: "Sometimes — 2 to 3 times a year" },
  { value: "often", label: "Often — every few months" },
  { value: "very-often", label: "Very often — monthly or more" }
];
const travelPurposes = ["Leisure", "Family Visit", "Business", "Study", "Medical", "Mixed"];
const defaultUserProfile = { name:"", email:"", residenceCountry:"AE", nationality:"EG", preferredCurrency:"AED", language:"en", avatar:"", passwordUpdatedAt:"", travelFrequency:"sometimes", travelPurpose:"Family Visit", defaultTravelStyle:"Balanced", role:"USER", plan:"FREE" };
function featureFlags(user) {
  const role = user?.role || "USER";
  const plan = user?.plan || "FREE";
  return { isAdmin: role === "ADMIN", isPro: plan === "PRO" || role === "ADMIN", canExport: plan === "PRO" || role === "ADMIN", canCreateUnlimitedTrips: plan === "PRO" || role === "ADMIN", freeTripLimit: 3 };
}
const styleSplit = {
  Survival: { "cat-flight": .20, "cat-accommodation": .22, "cat-food": .16, "cat-transport": .12, "cat-activities": .08, "cat-shopping": .04, "cat-gifts": .04, "cat-emergency": .14 },
  Balanced: { "cat-flight": .20, "cat-accommodation": .28, "cat-food": .16, "cat-transport": .10, "cat-activities": .10, "cat-shopping": .05, "cat-gifts": .04, "cat-emergency": .07 },
  Comfortable: { "cat-flight": .20, "cat-accommodation": .34, "cat-food": .17, "cat-transport": .10, "cat-activities": .10, "cat-shopping": .04, "cat-gifts": .03, "cat-emergency": .02 },
  Premium: { "cat-flight": .18, "cat-accommodation": .38, "cat-food": .16, "cat-transport": .10, "cat-activities": .08, "cat-shopping": .05, "cat-gifts": .01, "cat-emergency": .06 }
};
const comfortCostMultipliers = { Survival: 0.75, Balanced: 1, Comfortable: 1.25, Premium: 1.55 };
const comfortScoreStrictness = { Survival: 0.82, Balanced: 1, Comfortable: 1.12, Premium: 1.25 };
const suggestionCategoryNames = Object.fromEntries(TRIP_COST_CATEGORIES.map(item => [item.id, item.label]));
function currentCategoryTotal(t, categoryId) { return (t.budget || []).filter(b => b.categoryId === categoryId).reduce((s,b)=>s+num(b.amountLocal),0); }
function tripEstimateContext(t) {
  const days = t?.startDate && t?.endDate ? Math.max(1, Math.ceil((new Date(t.endDate) - new Date(t.startDate)) / 86400000)) : 7;
  const travelers = Math.max(1, cleanPositiveInt(t?.travelers || 1, 1));
  const destinationCode = t?.destinationInfo?.countryCode || t?.destinationCountry || "";
  const destinationProfile = countryProfile(destinationCode);
  const comfortLevel = t.comfortLevel || t.travelStyle || "Balanced";
  return { days, travelers, destinationCode, destinationProfile, comfortLevel };
}
function estimatedDestinationCategories(t) {
  const ctx = tripEstimateContext(t);
  const destinationCurrency = country(ctx.destinationCode).currency || ctx.destinationProfile.currency || t.tripCurrency;
  const bundle = resolveLocalCostEstimateBundle({
    destinationCountry: ctx.destinationCode,
    destinationCurrency,
    tripCurrency: t.tripCurrency,
    rateBook: t.rateBook || {},
    costTier: ctx.destinationProfile.costTier,
    comfortLevel: ctx.comfortLevel,
    days: ctx.days,
    travelers: ctx.travelers
  });
  if (bundle.categories) return bundle.categories;
  return {
    _meta: {
      source: "cost-profile:conversion-unavailable",
      nativeCurrency: bundle.nativeCurrency,
      requestedCurrency: bundle.targetCurrency,
      conversionUnavailable: true
    }
  };
}
function estimateDestinationBaseline(t) {
  return Math.round(estimateTotalFromCategories(estimatedDestinationCategories(t)) / 100) * 100;
}

function generatePresetSuggestions(t, c) {
  // IMPORTANT: Suggestions estimate trip costs. They must never divide or allocate salary, savings, support, or available cash.
  const estimatedCategories = estimatedDestinationCategories(t);
  const meta = estimatedCategories._meta || {};
  const orderedCategories = TRIP_COST_CATEGORIES.filter(item => item.estimateKey).map(item => item.id);
  const ctx = tripEstimateContext(t);
  const suggestions = orderedCategories.map((categoryId) => {
    const currentAmount = currentCategoryTotal(t, categoryId);
    let suggestedAmount = estimatedCategories[categoryId] || 0;
    if (categoryId === "cat-gifts") suggestedAmount = Math.round((estimatedCategories["cat-shopping"] || 0) * 0.35 / 100) * 100;
    if (currentAmount > 0) suggestedAmount = Math.max(suggestedAmount, currentAmount);
    const difference = suggestedAmount - currentAmount;
    let message = `Estimated from ${country(ctx.destinationCode).name}, ${ctx.days} days, ${ctx.travelers} traveler(s), and ${ctx.comfortLevel} style.`;
    if (categoryId === "cat-flight") message = "Flight estimate placeholder from route/country profile. Replace with live adapter later.";
    if (categoryId === "cat-accommodation") message = "Stay estimate from country profile and trip nights. Keep your number if already booked.";
    if (categoryId === "cat-food") message = "Daily meals estimate from destination cost profile.";
    if (categoryId === "cat-transport") message = "Local movement estimate from destination cost profile.";
    if (categoryId === "cat-emergency") message = "Backup money from destination-cost profile, not planned spending.";
    if (meta.usedGenericCurrencyFallback) message += " Uses tier fallback because trip currency differs from destination profile currency.";
    if (difference < 0) message = `Your current plan is above the estimate by ${whole(Math.abs(difference), t.tripCurrency)}. Keep it if already confirmed.`;
    const effect = difference > 0 ? "increase" : difference < 0 ? "reduce" : "keep";
    return { categoryId, title: suggestionCategoryNames[categoryId] || "Trip Cost", currentAmount, suggestedAmount, difference, message, effect, estimateSource: meta.source || "cost-profile" };
  }).filter(x => x.suggestedAmount > 0 || x.currentAmount > 0);
  return suggestions;
}

const categoryName = (id) => categories.find(c => c.id === id)?.name || id || "Other";

const routeRegions = [
  { key:"popular", label:"Popular", countries:["AE","EG","SA","TR","GB","DE","FR","ES","IT","US","MY"] },
  { key:"gulf", label:"Gulf", countries:["AE","SA","QA","KW","OM","BH"] },
  { key:"middleEast", label:"Middle East", countries:["AE","EG","SA","QA","KW","OM","BH","JO","LB","TR"] },
  { key:"europe", label:"Europe", countries:["ES","FR","IT","DE","NL","BE","AT","CH","PT","GR","CZ","HU","PL","SE","NO","DK","FI","IE","GB"] },
  { key:"asia", label:"Asia", countries:["IN","PK","BD","LK","NP","TH","ID","MY","SG","VN","PH","CN","HK","JP","KR"] },
  { key:"africa", label:"Africa", countries:["EG","MA","TN","DZ","ZA","KE","ET","NG"] },
  { key:"americas", label:"Americas", countries:["US","CA","MX","BR","AR"] },
  { key:"oceania", label:"Oceania", countries:["AU","NZ"] }
];
const popularAirportCodes = new Set(["DXB","AUH","SHJ","CAI","HBE","RUH","JED","DOH","IST","LHR","CDG","FRA","MAD","BCN","FCO","AMS","JFK","LAX","KUL","SIN"]);
function routeRegionForCountry(code) {
  return routeRegions.find(r => r.key !== "popular" && r.countries.includes(code))?.key || "all";
}
function routeSearchText(airportRow) {
  const c = country(airportRow.countryCode);
  return `${airportRow.code} ${airportRow.city} ${airportRow.name || ""} ${c.name} ${airportRow.countryCode} ${c.currency}`.toLowerCase();
}

const country = (code) => countries.find(c => c.code === code) || countries[0];
const airport = (code) => airports.find(a => a.code === code);
const countryAirports = (code) => airports.filter(a => a.countryCode === code);
const sortedRegionCountries = (regionKey) => {
  const region = routeRegions.find(r => r.key === regionKey);
  const allowed = regionKey === "popular" ? routeRegions.find(r => r.key === "popular")?.countries : region?.countries;
  const list = countries.filter(c => !allowed || allowed.includes(c.code));
  return list.sort((a,b) => {
    const ap = popularAirportCodes.has(countryAirports(a.code)[0]?.code) ? 0 : 1;
    const bp = popularAirportCodes.has(countryAirports(b.code)[0]?.code) ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.name.localeCompare(b.name);
  });
};
const routeCountrySearchText = (countryRow) => `${countryRow.code} ${countryRow.name} ${countryRow.currency} ${countryAirports(countryRow.code).map(a => `${a.code} ${a.city} ${a.name}`).join(" ")}`.toLowerCase();
function isoDate(year, monthIndex, day) {
  const maxDay = new Date(year, monthIndex + 1, 0).getDate();
  const safeDay = Math.max(1, Math.min(maxDay, cleanPositiveInt(day, 1)));
  const d = new Date(year, monthIndex, safeDay);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}
function nextDateFromDay(day, startDate) {
  const base = startDate ? new Date(startDate) : new Date();
  if (Number.isNaN(base.getTime())) return "";
  let d = new Date(base.getFullYear(), base.getMonth(), Math.max(1, Math.min(31, cleanPositiveInt(day, 1))));
  if (d < base) d = new Date(base.getFullYear(), base.getMonth()+1, Math.max(1, Math.min(31, cleanPositiveInt(day, 1))));
  return isoDate(d.getFullYear(), d.getMonth(), cleanPositiveInt(day, 1));
}
function dayFromDate(value, fallback = 25) {
  const d = value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.getDate() : fallback;
}

function isValidISODate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  const [y,m,d] = value.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
function normalizeDateValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) {
    const iso = `${compact[1]}-${compact[2]}-${compact[3]}`;
    return isValidISODate(iso) ? iso : "";
  }
  if (isValidISODate(raw)) return raw;
  const slash = raw.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);
  if (slash) {
    let a = Number(slash[1]);
    let b = Number(slash[2]);
    const y = Number(slash[3]);
    // Accept common browser date display (MM/DD/YYYY), and DD/MM/YYYY when the first number is clearly a day.
    let month = a;
    let day = b;
    if (a > 12 && b <= 12) { day = a; month = b; }
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const iso = `${y}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
      return isValidISODate(iso) ? iso : "";
    }
  }
  const date = new Date(raw);
  if (!Number.isNaN(date.getTime())) {
    const iso = isoDate(date.getFullYear(), date.getMonth(), date.getDate());
    return isValidISODate(iso) ? iso : "";
  }
  return "";
}
function formatDateValue(value) {
  const clean = normalizeDateValue(value);
  return isValidISODate(clean) ? clean : "";
}
function withinDateBounds(value, min = "", max = "") {
  if (!isValidISODate(value)) return false;
  if (min && value < min) return false;
  if (max && value > max) return false;
  return true;
}
function formatDateDraft(value) { return isValidISODate(value) ? value : ""; }
const route = (t) => `${t.origin.airportCode || "FROM"} → ${t.destinationInfo.airportCode || "TO"}`;
const routeFull = (t) => `${country(t.origin.countryCode).name} → ${country(t.destinationInfo.countryCode).name}`;
const pairKey = (base, trip) => currencyPairKey(base, trip);
const currentPair = (t) => pairKey(t.baseCurrency, t.tripCurrency);
const baseToTrip = (amountBase, t) => t.baseCurrency === t.tripCurrency ? num(amountBase) : num(amountBase) * num(t.exchangeRate);
function cleanDateValue(value) { return value || ""; }
function applyPreparedCurrencyChange(t, prepared, routePatch = {}) {
  const incomeValues = convertIncomeCurrencyValues({
    oldIncomeToNewIncomeRate: prepared.incomeConversion?.rate || 1,
    startingSavingsBase: t.startingSavingsBase,
    reserveAmountBase: t.scenario?.reserveAmountBase,
    incomeSources: t.incomeSources,
    lifeCosts: t.lifeCosts,
    installments: t.installments
  });
  const tripValues = convertTripCurrencyValues({
    oldTripToNewTripRate: prepared.tripConversion?.rate || 1,
    supportLocal: t.supportLocal,
    budget: t.budget
  });
  return {
    ...t,
    ...routePatch,
    baseCurrency: prepared.nextIncome,
    tripCurrency: prepared.nextTrip,
    displayCurrency: prepared.currentTrip === prepared.nextTrip ? (t.displayCurrency || prepared.nextTrip) : prepared.nextTrip,
    exchangeRate: prepared.plan.rate,
    ratePair: pairKey(prepared.nextIncome, prepared.nextTrip),
    rateMode: "AUTO",
    rateNeedsReview: false,
    rateSource: prepared.plan.source || "api",
    rateSourceAsOf: prepared.plan.sourceAsOf || null,
    rateUpdatedAt: prepared.plan.fetchedAt || new Date().toISOString(),
    rateExpiresAt: prepared.plan.expiresAt || null,
    rateStale: !!prepared.plan.stale,
    rateConfidence: prepared.plan.confidence || "medium",
    rateBook: prepared.rateBook,
    pendingCurrencyConversion: null,
    startingSavingsBase: incomeValues?.startingSavingsBase ?? t.startingSavingsBase,
    supportLocal: tripValues?.supportLocal ?? t.supportLocal,
    incomeSources: incomeValues?.incomeSources ?? t.incomeSources,
    lifeCosts: incomeValues?.lifeCosts ?? t.lifeCosts,
    installments: incomeValues?.installments ?? t.installments,
    budget: tripValues?.budget ?? t.budget,
    scenario: {
      ...(t.scenario || {}),
      reserveAmountBase: incomeValues?.reserveAmountBase ?? t.scenario?.reserveAmountBase ?? 0
    }
  };
}
const freqLabel = (v) => frequencies.find(f => f.value === v)?.label || v || "One-time";
const isRepeat = (f) => ["daily", "weekly", "monthly", "yearly"].includes(f);
const isOne = (f) => f === "one-time";
const isTripTotal = (f) => f === "trip-total";
const rangeLabel = (item) => isTripTotal(item.frequency) ? "Trip total" : isOne(item.frequency) ? `On ${item.nextDate || "date ?"}` : `${item.nextDate || "start ?"} → ${item.untilDate || "return date"}`;

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function addMonths(date, months) { const d = new Date(date); const day = d.getDate(); d.setMonth(d.getMonth() + months); if (d.getDate() < day) d.setDate(0); return d; }
function iso(date) { return date.toISOString().slice(0, 10); }
function todayISO() { return iso(new Date()); }

function buildDates(item, trip, maxCount = 36) {
  const f = item.frequency || "monthly";
  const start = new Date(item.nextDate || trip.startDate);
  const tripEnd = new Date(trip.endDate || trip.startDate || item.nextDate || new Date());
  if (Number.isNaN(start.getTime())) return trip.startDate ? [trip.startDate] : [];
  if (f === "one-time" || f === "trip-total") return start <= tripEnd ? [iso(start)] : [];
  const until = new Date(item.untilDate || trip.endDate);
  if (Number.isNaN(until.getTime()) || start > until) return [];
  let current = start;
  const out = [];
  let count = 0;
  while (current <= until && count < maxCount) {
    out.push(iso(current));
    if (f === "daily") current = addDays(current, 1);
    else if (f === "weekly") current = addDays(current, 7);
    else if (f === "monthly") current = addMonths(current, 1);
    else if (f === "yearly") current = addMonths(current, 12);
    else break;
    count++;
  }
  return out;
}

function isPaid(t, id) {
  return !!(t.paidPayments || {})[id];
}

function paymentStatus(t, id) {
  return isPaid(t, id) ? "paid" : "upcoming";
}

function tripStatus(t, c) {
  return canTravel(t, c);
}



function mergeBackendSummary(summaryResult, localCalc, trip) {
  const summary = summaryResult?.summary || summaryResult;
  if (!summary?.cards) return localCalc;
  const displayCards = summary.displayCards || summary.cards;
  const displayCurrencyCode = summary.displayCurrency || summary.currency || displayCurrency(trip);
  const tripCards = summary.cards || {};
  const paidTripLocal = num(tripCards.paid ?? localCalc.totalPaidLocal);
  const plannedLocal = num(tripCards.tripCost ?? localCalc.plannedLocal);
  const availableLocal = num(tripCards.available ?? localCalc.availableLocal);
  const stillNeededLocal = num(tripCards.stillNeeded ?? Math.max(0, plannedLocal - availableLocal));
  const stillToPayLocal = num(tripCards.stillToPay ?? summary.ledger?.stillToPay ?? localCalc.totalStillNeededLocal);
  const totalTrackedOutgoingsLocal = num(tripCards.totalTrackedOutgoings ?? summary.ledger?.totalTrackedOutgoings ?? (paidTripLocal + stillToPayLocal));
  const displayAdapter = {
    currency: summary.currency || trip.tripCurrency,
    displayCurrency: displayCurrencyCode,
    displayCards,
    displayDetails: summary.displayDetails || summary.details || {},
    headline: summary.headline,
    message: summary.message,
    status: summary.status,
    payments: summary.payments || null,
    events: summary.events || [],
    readiness: summary.readiness,
    scoreFactors: summary.scoreFactors || [],
    verdict: summary.verdict || summary.decision?.verdict || null,
    decision: summary.decision || null,
    ledger: summary.ledger || null,
  };
  const readiness = num(summary.readiness ?? localCalc.readiness);
  return {
    ...localCalc,
    backendSummary: displayAdapter,
    availableLocal,
    plannedLocal,
    totalPaidLocal: paidTripLocal,
    totalStillNeededLocal: stillToPayLocal,
    totalTrackedOutgoingsLocal,
    needToSaveLocal: stillNeededLocal,
    remainingLocal: num((summary.details || {}).remaining ?? localCalc.remainingLocal),
    readiness,
    risk: 100 - readiness,
    miScore: readiness,
    scoreFactors: summary.scoreFactors || localCalc.scoreFactors || [],
    decision: summary.decision || localCalc.decision || null,
  };
}

function moneyIntelligence(t, c, recs = []) {
  const list = Array.isArray(recs) ? recs : [];
  const insights = list.map((item) => {
    const impact = item.impact?.amount > 0
      ? whole(item.impact.amount, item.impact.currency || t.tripCurrency)
      : item.metric || item.confidence || "";
    return {
      level: item.level || "info",
      icon: item.icon || "lightbulb",
      title: item.title || item.label,
      detail: item.detail,
      action: item.actionLabel || item.cta || "Open",
      metric: impact,
      target: item.target,
      recommendation: item,
    };
  });

  const emergency = (t.budget || []).filter(b => b.categoryId === "cat-emergency").reduce((sum, item) => sum + budgetItemCost(item, t), 0);
  const positives = [
    c.remainingLocal >= 0 ? "+ Remaining cash is not negative" : "- Remaining cash is negative",
    emergency > 0 ? "+ Emergency budget exists" : "- Emergency budget missing",
    !(c.exchangeRateMissing || t.rateNeedsReview) ? "+ Exchange rate confirmed" : "- Exchange rate needs confirmation",
    !(t.installments || []).some(i => i.enabled !== false && i.continuesAfterTrip) ? "+ No post-trip installments detected" : "- Payments continue after trip"
  ];

  const emergencyRec = list.find(item => ["EMERGENCY_MISSING", "EMERGENCY_BELOW_RANGE"].includes(item.reasonCode));
  const reductionRec = list.find(item => item.reasonCode === "FLEXIBLE_COST_ABOVE_TYPICAL");
  return {
    miScore: c.readiness,
    insights,
    positives,
    suggestedEmergency: emergencyRec?.impact?.amount || emergency,
    suggestedReduction: reductionRec?.impact?.amount || 0,
    optionalTotal: (t.budget || []).filter(b => b.priority !== "Must").reduce((sum, item) => sum + budgetItemCost(item, t), 0),
    continuingInstallments: (t.installments || []).filter(i => i.enabled !== false && i.continuesAfterTrip).reduce((sum, item) => sum + num(item.monthlyBase), 0),
  };
}

const seedTrip = {
  id: "egypt-2026", archived: false, name: "Egypt Trip — Alexandria 2026", tripType: "Couple / Family Visit",
  origin: { countryCode: "AE", airportCode: "DXB" }, destinationInfo: { countryCode: "EG", airportCode: "HBE" },
  startDate: "2026-07-19", endDate: "2026-07-29", travelers: 2,
  baseCurrency: "AED", tripCurrency: "EGP", displayCurrency: "EGP", exchangeRate: 14.36, ratePair: "AED_EGP", rateNeedsReview: false, rateBook: { "AED_EGP": 14.36 }, startingSavingsBase: 0, supportLocal: 0,
  comfortLevel: "Balanced", returnWithZero: true, paidPayments: {}, scenario: { reserveAfterTripBase: false, reserveAmountBase: 1400 },
  incomeSources: [
    { id: "salary", enabled: true, name: "Monthly Salary", amountBase: 4000, frequency: "monthly", nextDate: "2026-05-25", untilDate: "2026-07-25", period: "" }
  ],
  lifeCosts: [
    { id: "rent", enabled: true, name: "Rent", categoryId: "cat-rent", amountBase: 1400, frequency: "monthly", nextDate: "2026-05-25", untilDate: "2026-06-25", canPause: false },
    { id: "phone-may", enabled: true, name: "Phone May only", categoryId: "cat-phone", amountBase: 350, frequency: "one-time", nextDate: "2026-05-25", canPause: false },
    { id: "phone", enabled: true, name: "Phone", categoryId: "cat-phone", amountBase: 300, frequency: "monthly", nextDate: "2026-06-25", untilDate: "2026-07-25", canPause: false },
    { id: "gym", enabled: true, name: "Gym annual contract", categoryId: "cat-gym", amountBase: 170, frequency: "monthly", nextDate: "2026-05-25", untilDate: "2026-07-25", canPause: false },
    { id: "fooduae", enabled: true, name: "Food & Transport UAE", categoryId: "cat-food-uae", amountBase: 500, frequency: "monthly", nextDate: "2026-05-25", untilDate: "2026-06-25", canPause: false }
  ],
  installments: [
    { id: "air", enabled: true, name: "Air Arabia / Tabby", monthlyBase: 264.08, frequency: "monthly", paymentDay: 29, remainingMonths: 7, nextDate: "2026-05-29", untilDate: "2026-07-29", continuesAfterTrip: true },
    { id: "udrive", enabled: true, name: "Udrive.ae", monthlyBase: 177.12, frequency: "monthly", paymentDay: 25, remainingMonths: 4, nextDate: "2026-06-25", untilDate: "2026-07-25", continuesAfterTrip: true }
  ],
  budget: [
    { id: "sky", name: "Skydiving for both", categoryId: "cat-activities", amountLocal: 33000, priority: "Must", timing: "during", frequency: "trip-total", paid: false },
    { id: "cairo", name: "Cairo museum day trip", categoryId: "cat-daytrip", amountLocal: 6000, priority: "Optional", timing: "during", frequency: "one-time", nextDate: "2026-07-26", paid: false },
    { id: "food", name: "Food & cafes for 2", categoryId: "cat-food", amountLocal: 15000, priority: "Must", timing: "during", frequency: "trip-total", paid: false },
    { id: "transport", name: "Local transport", categoryId: "cat-transport", amountLocal: 5000, priority: "Must", timing: "during", frequency: "trip-total", paid: false },
    { id: "gifts", name: "Gifts for family", categoryId: "cat-gifts", amountLocal: 6000, priority: "Flexible", timing: "during", frequency: "one-time", nextDate: "2026-07-28", paid: false },
    { id: "clothes", name: "Clothes", categoryId: "cat-shopping", amountLocal: 6000, priority: "Flexible", timing: "before", frequency: "one-time", nextDate: "2026-07-15", paid: false },
    { id: "emergency", name: "Emergency buffer", categoryId: "cat-emergency", amountLocal: 5000, priority: "Must", timing: "during", frequency: "trip-total", paid: false }
  ],
  tasks: [
    { id: "t1", phase: "Today", title: "Confirm skydiving exact price and deposit", done: false },
    { id: "t2", phase: "Before Travel", title: "Set spending cap before July salary", done: false }
  ]
};


function profileToUserId(user) {
  return String(user?.email || user?.name || "guest").trim().toLowerCase().replace(/[^a-z0-9]+/g,"-") || "guest";
}
function userStorageKey(user) { return `safaryaty-v4-19:${profileToUserId(user)}:state`; }
function sessionStorageKey() { return "safaryaty-v4-19:current-user"; }
function loadUserState(user) {
  try {
    const raw = localStorage.getItem(userStorageKey(user));
    const saved = raw ? JSON.parse(raw) : null;
    return saved ? { ...saved, user, trips: saved.trips || [], drafts: saved.drafts || [], activeId: saved.activeId || null, mode: saved.mode || "beginner", cats: saved.cats || categories } : { user, trips:[], drafts:[], activeId:null, mode:"beginner", cats:categories };
  } catch { return { user, trips:[], drafts:[], activeId:null, mode:"beginner", cats:categories }; }
}

async function loadBackendUserState(user) {
  const base = loadUserState(user);
  try {
    const backendTrips = await api.loadClientTrips();
    const trips = backendTrips.filter(t => !t.draft);
    const drafts = backendTrips.filter(t => t.draft);
    const activeId = trips.find(t => !t.archived)?.id || trips[0]?.id || null;
    return { ...base, trips, drafts, activeId };
  } catch (error) {
    console.warn("Could not load backend trips", error);
    return base;
  }
}

function createBlankTrip(user, name="My First Trip", type="Personal") {
  const residence = user?.residenceCountry || "AE";
  const homeAirport = countryAirports(residence)[0];
  const destination = user?.nationality || "EG";
  const destAirport = countryAirports(destination)[0];
  const baseCurrency = user?.preferredCurrency || country(residence).currency;
  const tripCurrency = country(destination).currency || baseCurrency;
  const pair = `${baseCurrency}_${tripCurrency}`;
  return {
    id: uid("draft"), archived: false, draft: true, name, tripType:type, tripPurpose:type, tripMode:"SHORT_TOTAL", tripLengthType:"UNSET",
    origin: { countryCode: residence, airportCode: homeAirport?.code || "" },
    destinationInfo: { countryCode: destination, airportCode: destAirport?.code || "" },
    startDate: "", endDate: "", travelers: 1,
    baseCurrency, tripCurrency, displayCurrency: tripCurrency, exchangeRate: baseCurrency === tripCurrency ? 1 : "", ratePair: pair, rateNeedsReview: baseCurrency !== tripCurrency, rateBook: {},
    startingSavingsBase: 0, supportLocal: 0,
    comfortLevel: user?.defaultTravelStyle || "Balanced", travelStyle: user?.defaultTravelStyle || "Balanced", returnWithZero: true, paidPayments: {},
    scenario: { reserveAfterTripBase: false, reserveAmountBase: 0 },
    incomeSources: [], lifeCosts: [], installments: [], budget: [], tasks: []
  };
}
function createDemoPreview(user) {
  const t = clone(seedTrip);
  t.id = uid("demo");
  t.draft = true;
  t.name = "Demo Preview — Egypt Trip";
  if (user) {
    t.origin.countryCode = user.residenceCountry || t.origin.countryCode;
    t.baseCurrency = user.preferredCurrency || t.baseCurrency;
  }
  return t;
}


function verifySeedBenchmark() {
  const c = calculate(seedTrip);
  console.assert(Math.round(c.availableLocal) === 80323, "Seed benchmark changed: Egypt trip available cash should be around 80,323 EGP.");
  console.assert(seedTrip.name === "Egypt Trip — Alexandria 2026", "Seed trip name changed.");
  console.assert(seedTrip.origin.airportCode === "DXB" && seedTrip.destinationInfo.airportCode === "HBE", "Seed route changed.");
}

function Icon({ name }) { return <i className={`bi bi-${name}`} />; }

function NotificationHost({ notification, onDismiss }) {
  if (!notification) return null;
  const runAction = async () => {
    try { await notification.onAction?.(); } finally { onDismiss(notification.id); }
  };
  return <div
    className={`toast notificationToast ${notification.type}`}
    role={notification.type === "error" ? "alert" : "status"}
    aria-live={notification.type === "error" ? "assertive" : "polite"}
    aria-atomic="true"
  >
    <span className="notificationToastIcon"><Icon name={notificationIcon(notification.type)}/></span>
    <div className="notificationToastCopy">
      <b>{notification.title}</b>
      {notification.detail && <p>{notification.detail}</p>}
      {notification.count > 1 && <small>Repeated {notification.count} times</small>}
    </div>
    {notification.actionLabel && notification.onAction && <button type="button" className="notificationToastAction" onClick={runAction}>{notification.actionLabel}</button>}
    <button type="button" className="notificationToastClose" aria-label="Dismiss notification" onClick={()=>onDismiss(notification.id)}><Icon name="x-lg"/></button>
  </div>;
}
const simpleTabMeta = {
  overview: { label: "Dashboard", labelKey:"Home", icon: "house", mobile: true },
  "to pay": { label: "Trip Payments", labelKey:"Payments", icon: "credit-card", mobile: true },
  budget: { label: "Trip Costs", labelKey:"Trip Costs", icon: "pie-chart", mobile: true },
  installments: { label: "Commitments", labelKey:"Monthly Payments", icon: "calendar2-check", mobile: false },
  suggestions: { label: "Recommendations", labelKey:"Advice", icon: "lightbulb", mobile: true },
  trips: { label: "My Trips", labelKey:"My Trips", icon: "airplane", mobile: false },
  profile: { label: "Profile", labelKey:"Travel Profile", icon: "person", mobile: true },
  cashflow: { label: "Cashflow", labelKey:"Cashflow", icon: "activity", mobile: false, advanced: true },
  categories: { label: "Categories", labelKey:"Categories", icon: "tags", mobile: false, advanced: true },
  admin: { label: "Admin", labelKey:"Admin", icon: "shield-lock", mobile: false, advanced: true }
};
const simpleTabs = ["overview", "to pay", "budget", "installments", "suggestions", "trips", "profile"];
const advancedTabs = ["cashflow", "categories"];
function Button({ children, onClick, variant = "dark", disabled = false, className = "", type = "button" }) { return <button type={type} disabled={disabled} onClick={onClick} className={`btn ${variant} ${className}`.trim()}>{children}</button>; }
function Field({ label, hint, children, error, name }) { return <label data-field={name || label} className={`field ${error ? "invalidField" : ""}`}><div><span>{label}</span>{hint && <small>{hint}</small>}</div>{children}{error && <small className="fieldErrorText"><Icon name="exclamation-circle"/> {error}</small>}</label>; }
function cleanNumericInputValue(value) {
  if (value === "" || value === null || value === undefined) return "";
  const raw = String(value).replace(/,/g, "").trim();
  if (!raw) return "";
  const sign = raw.startsWith("-") ? "-" : "";
  const unsigned = sign ? raw.slice(1) : raw;
  const [intRaw, decimalRaw] = unsigned.split(".");
  const intClean = (intRaw || "0").replace(/^0+(?=\d)/, "") || "0";
  return `${sign}${intClean}${decimalRaw !== undefined ? `.${decimalRaw}` : ""}`;
}
function normalizedNumber(value, fallback = 0) {
  const cleaned = cleanNumericInputValue(value);
  if (cleaned === "" || cleaned === "-" || cleaned === ".") return fallback;
  const next = Number(cleaned);
  return Number.isFinite(next) ? next : fallback;
}
const typeNumberFields = new Set(["travelers","startingSavingsBase","supportLocal","exchangeRate","scenarioReserveAmount"]);
function Input({ value, onChange, type = "text", placeholder = "" }) {
  const isNumber = type === "number";
  const [draft, setDraft] = useState(isNumber ? cleanNumericInputValue(value) : (value ?? ""));
  useEffect(() => { setDraft(isNumber ? cleanNumericInputValue(value) : (value ?? "")); }, [value, isNumber]);
  if (!isNumber) return <input className="input" type={type} value={value ?? ""} placeholder={placeholder} onChange={e => onChange(e.target.value)} />;
  const commit = (raw) => {
    const cleaned = cleanNumericInputValue(raw);
    setDraft(cleaned);
    if (cleaned === "" || cleaned === "-" || cleaned === ".") return onChange("");
    return onChange(normalizedNumber(cleaned));
  };
  return <input
    className="input numericInput"
    type="text"
    value={draft}
    placeholder={placeholder}
    inputMode="decimal"
    autoComplete="off"
    onChange={e => {
      const raw = e.target.value.replace(/[^0-9.\-]/g, "");
      setDraft(raw);
      if (raw === "" || raw === "-" || raw === ".") return onChange("");
      onChange(normalizedNumber(raw));
    }}
    onBlur={e => commit(e.currentTarget.value)}
  />;
}

function DateInput({ value, onChange, min = "", max = "" }) {
  const hiddenRef = useRef(null);
  const [draft, setDraft] = useState(formatDateDraft(value));
  const safeValue = withinDateBounds(value, min, max) ? value : "";
  useEffect(() => { setDraft(formatDateDraft(safeValue)); }, [safeValue]);
  const openPicker = () => {
    const input = hiddenRef.current;
    if (!input) return;
    input.focus();
    if (typeof input.showPicker === "function") {
      try { input.showPicker(); } catch { input.click(); }
    } else input.click();
  };
  const commit = (raw) => {
    const next = normalizeDateValue(raw);
    if (next && withinDateBounds(next, min, max)) { setDraft(next); onChange(next); return; }
    setDraft(formatDateDraft(safeValue));
  };
  return <div className="dateInputWrap nativeDateInput">
    <input
      className="input dateTextInput"
      type="text"
      value={draft}
      placeholder="YYYY-MM-DD"
      inputMode="numeric"
      autoComplete="off"
      onClick={openPicker}
      onFocus={openPicker}
      onChange={e => {
        const raw = e.target.value.replace(/[^0-9\-\/\.]/g, "");
        setDraft(raw.replace(/^(\d{4})(\d{2})(\d{0,2}).*/, (_, y, m, d) => d ? `${y}-${m}-${d}` : `${y}-${m}`));
      }}
      onBlur={e => commit(e.currentTarget.value)}
      onKeyDown={e => { if (e.key === "Enter") e.currentTarget.blur(); }}
    />
    <input
      ref={hiddenRef}
      className="hiddenNativeDate"
      type="date"
      value={safeValue}
      min={min || undefined}
      max={max || undefined}
      onChange={e => commit(e.target.value)}
      tabIndex={-1}
      aria-hidden="true"
    />
    <button type="button" className="datePickerButton" onClick={openPicker} aria-label="Open date picker"><Icon name="calendar3"/></button>
  </div>;
}


function Select({ value, onChange, children }) { return <select className="input" value={value ?? ""} onChange={e => onChange(e.target.value)}>{children}</select>; }
function Info({ title, children, icon = "info-circle", tone = "info" }) {
  const openByDefault = tone === "danger";
  return <details className={`info ${tone} infoGuide`} open={openByDefault}>
    <summary><Icon name={icon}/><span><b>{title}</b><small>{openByDefault ? "Important" : "Tap for guidance"}</small></span><Icon name="chevron-down"/></summary>
    <p>{children}</p>
  </details>;
}
function Card({ children, className = "" }) { return <div className={`card ${className}`}>{children}</div>; }
function Mini({ label, value }) { return <div className="mini"><p>{label}</p><b>{value}</b></div>; }

function Modal({ open, title, subtitle, onClose, children, size = "standard" }) {
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevTouchAction = body.style.touchAction;
    body.classList.add("modalOpen");
    body.style.overflow = "hidden";
    body.style.touchAction = "none";
    return () => {
      body.classList.remove("modalOpen");
      body.style.overflow = prevOverflow;
      body.style.touchAction = prevTouchAction;
    };
  }, [open]);
  if (!open) return null;
  const stop = (e) => e.stopPropagation();
  return <div className="modalBack" onMouseDown={onClose} onWheel={stop} onTouchMove={stop}>
    <div className={`modalBox modal-${size}`} onMouseDown={stop} onWheel={stop} onTouchMove={stop}>
      <div className="modalHead">
        <div><h2>{title}</h2><p>{subtitle}</p></div>
        <button type="button" className="modalClose" onClick={onClose} aria-label="Close wizard"><Icon name="x-lg"/><span>Close</span></button>
      </div>
      <div className="modalBody" data-modal-body="true">{children}</div>
    </div>
  </div>;
}

function FrequencyFields({ item, currency, onChange, amountKey = "amountBase", tripCost = false, includePeriod = true, errors = {}, errorPrefix = "item" }) {
  const f = item.frequency || (tripCost ? "trip-total" : "monthly");
  const recurring = isRepeat(f);
  const once = isOne(f);
  const field = (key) => `${errorPrefix}-${item.id}-${key}`;
  return <>
    <Field label="Amount" hint={currency} name={field("amount")} error={errors[field("amount")] || errors[`${errorPrefix}-${item.id || ""}-amount`]}><Input type="number" value={item[amountKey]} onChange={v => onChange(amountKey, v)} /></Field>
    <Field label="Frequency"><Select value={f} onChange={v => onChange("frequency", v)}>{frequencies.map(x => <option key={x.value} value={x.value}>{x.label}</option>)}</Select></Field>
    {once && <Field label="Expected Date" name={field("date")} error={errors[field("date")]}><DateInput value={item.nextDate || ""} onChange={v => onChange("nextDate", v)} /></Field>}
    {recurring && <Field label="Start Date" hint="when this monthly item starts" name={field("start")} error={errors[field("start")]}><DateInput value={item.nextDate || ""} onChange={v => onChange("nextDate", v)} /></Field>}
    {recurring && <Field label="Repeat Until" hint="optional — defaults to return date" name={field("until")} error={errors[field("until")]}><DateInput value={item.untilDate || ""} onChange={v => onChange("untilDate", v)} /></Field>}
    {includePeriod && once && <Field label="Period Label" hint="optional"><Input value={item.period || ""} onChange={v => onChange("period", v)} /></Field>}
  </>;
}

function QuickAdd({ title, presets, onPick }) {
  return <div className="quick"><b>{title}</b><div>{presets.map(p => <button key={p.name} onClick={() => onPick(p)}><Icon name={p.icon || "plus-circle"}/> {p.name}</button>)}</div></div>;
}

function SmartCard({ itemId, title, subtitle, badges, insight, danger, children, onRemove, isNew = false }) {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (isNew) setOpen(true); }, [isNew]);
  return <div id={itemId ? `card-${itemId}` : undefined} className={`smart ${danger ? "risk" : ""} ${isNew ? "new" : ""}`}>
    <button className="smartHead" onClick={() => setOpen(!open)}>
      <div><h3>{title}</h3><p>{subtitle}</p><div className="badges">{badges.map(b => <span key={b}>{b}</span>)}</div></div>
      <span className="chev"><Icon name={open ? "chevron-up" : "chevron-down"}/></span>
    </button>
    <div className={`insight ${danger ? "danger" : ""}`}><Icon name={danger ? "exclamation-triangle" : "lightbulb"}/><span>{insight}</span></div>
    {open && <div className="smartBody">{children}<Button variant="danger" onClick={onRemove}><Icon name="trash3"/> Remove</Button></div>}
  </div>;
}

function RouteAirportPicker({ title, value, onPick, errors = {}, countryField, airportField }) {
  const currentAirport = airport(value.airportCode) || countryAirports(value.countryCode)[0] || airports[0];
  const currentCountry = country(value.countryCode || currentAirport?.countryCode);
  const [open, setOpen] = useState(!value.airportCode);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState(routeRegionForCountry(currentCountry.code) || "popular");
  const [selectedCountry, setSelectedCountry] = useState(currentCountry.code);

  useEffect(() => { setSelectedCountry(currentCountry.code); }, [currentCountry.code]);
  useEffect(() => {
    if (value?.airportCode) setOpen(false);
  }, [value?.airportCode]);

  const q = query.trim().toLowerCase();
  const regionCountries = routeRegions.find(r => r.key === region)?.countries || [];
  const countryMatches = countries
    .filter(c => {
      if (q) return routeCountrySearchText(c).includes(q);
      if (region === "all") return true;
      if (region === "popular") return routeRegions.find(r => r.key === "popular")?.countries.includes(c.code);
      return regionCountries.includes(c.code);
    })
    .sort((a,b)=>a.name.localeCompare(b.name))
    .slice(0, q ? 6 : 8);
  const queryAirportHits = q
    ? airports.filter(a => routeSearchText(a).includes(q)).sort((a,b) => {
        const acode = a.code.toLowerCase() === q ? 0 : 1;
        const bcode = b.code.toLowerCase() === q ? 0 : 1;
        if (acode !== bcode) return acode - bcode;
        return `${a.city} ${a.code}`.localeCompare(`${b.city} ${b.code}`);
      }).slice(0, 6)
    : [];
  const airportResults = airports
    .filter(a => {
      if (selectedCountry) return a.countryCode === selectedCountry;
      if (q) return queryAirportHits.some(hit => hit.code === a.code);
      return false;
    })
    .sort((a,b) => {
      const ap = popularAirportCodes.has(a.code) ? 0 : 1;
      const bp = popularAirportCodes.has(b.code) ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return `${a.city} ${a.code}`.localeCompare(`${b.city} ${b.code}`);
    })
    .slice(0, q ? 10 : 12);
  const pickCountry = (code) => {
    setSelectedCountry(code);
    setRegion(routeRegionForCountry(code));
    setQuery("");
  };
  const pick = (a) => {
    onPick({ countryCode: a.countryCode, airportCode: a.code });
    setSelectedCountry(a.countryCode);
    setQuery("");
    setRegion(routeRegionForCountry(a.countryCode));
    setOpen(false);
  };

  if (!open) return <div className="routeSelectedCard">
    <div>
      <span>{title}</span>
      <h3>{currentCountry.flag || "🌍"} {currentAirport?.city || "Select city"} · {currentAirport?.code || "---"}</h3>
      <p>{currentCountry.name} · {currentAirport?.name || "Airport"}</p>
    </div>
    <b>{currentCountry.currency}</b>
    <button type="button" onClick={()=>setOpen(true)}>Change</button>
  </div>;

  return <div className="routeSearchCard routeSearchCardOpen">
    <div className="routeSearchTop">
      <div><h3>{title}</h3><p>Pick a country first. Only its airports will appear.</p></div>
      <span>{currentCountry.currency}</span>
    </div>
    <Field label="Search country, city, or airport" name={airportField} error={errors[airportField] || errors[countryField]}>
      <Input value={query} placeholder="Dubai, DXB, Egypt, Germany..." onChange={setQuery}/>
    </Field>
    <div className="routeRegionChips compactRouteChips">
      {[...routeRegions, {key:"all", label:"All"}].map(r => <button type="button" key={r.key} className={region===r.key?"active":""} onClick={()=>{ setRegion(r.key); setSelectedCountry(""); setQuery(""); }}>{r.label}</button>)}
    </div>
    <div className="routeCountryStrip">
      {countryMatches.map(c => <button type="button" key={`${title}-${c.code}`} className={selectedCountry===c.code ? "active" : ""} onClick={()=>pickCountry(c.code)}>
        <span>{c.flag || "🌍"}</span><b>{c.name}</b><small>{countryAirports(c.code).length} airports</small>
      </button>)}
    </div>
    <div className="routeResultHeader"><b>{selectedCountry ? `${country(selectedCountry).name} airports` : q ? "Direct airport matches" : "Choose a country"}</b><small>{airportResults.length} shown</small></div>
    <div className="routeResultList compactAirportList">
      {airportResults.map(a => {
        const c = country(a.countryCode);
        const selected = value.airportCode === a.code;
        return <button type="button" key={`${title}-${a.code}`} className={selected ? "selected" : ""} onClick={()=>pick(a)}>
          <span className="routeResultCode">{c.flag || "🌍"} <b>{a.code}</b></span>
          <span className="routeResultMain"><b>{a.city}</b><small>{a.name}</small></span>
          <span className="routeResultMeta"><small>{c.name}</small><b>{c.currency}</b></span>
        </button>;
      })}
      {!airportResults.length && <div className="emptyMini">Choose a country to show its airports, or search a city / airport code.</div>}
    </div>
  </div>;
}

function RouteSelector({ trip, update, errors={} }) {
  const setOrigin = (next) => update("routeOrigin", next);
  const setDestination = (next) => update("routeDestination", next);
  return <div className="routeBox routeSearchBox">
    <RouteAirportPicker title="From" value={trip.origin} onPick={setOrigin} errors={errors} countryField="originCountry" airportField="originAirport" />
    <b className="routeArrow">→</b>
    <RouteAirportPicker title="To" value={trip.destinationInfo} onPick={setDestination} errors={errors} countryField="destinationCountry" airportField="destinationAirport" />
  </div>;
}

function CardManagers({ type, trip, calc, errors={}, categoriesList, add, updateItem, remove, highlightId, focusCategory="", wizardMode = false, updateTrip = null, onOpenCurrencySetup = null }) {
  const lifeCats = categoriesList.filter(c => c.type === "life");
  const tripCats = categoriesList.filter(c => c.type === "trip");

  if (type === "income") {
    const presets = [{name:"Salary",icon:"cash-stack",amountBase:0,frequency:"monthly"},{name:"Monthly Income",icon:"wallet2",amountBase:0,frequency:"monthly"},{name:"Bonus",icon:"gift",amountBase:0,frequency:"one-time"},{name:"Support",icon:"people",amountBase:0,frequency:"one-time"},{name:"Side Income",icon:"briefcase",amountBase:0,frequency:"one-time"}];
    return <Manager wizardMode={wizardMode} title="Money In" subtitle="Salary, support, bonus, or side income." info="Add money you can use for this trip. Monthly salary can use payday only; one-time money uses an expected date." presets={presets} add={add}>
      <div data-field="incomeSources" className={`validationAnchor ${errors.incomeSources ? "invalidField" : ""}`}>
        {errors.incomeSources && <small className="fieldErrorText"><Icon name="exclamation-circle"/> {errors.incomeSources}</small>}
        {!trip.incomeSources.length && <div className="emptyNudge"><Icon name="cash-stack"/><div><b>Add income arriving before travel</b><p>Pick a preset above or add a custom source.</p></div></div>}
      </div>
      {trip.incomeSources.map(x => <SmartCard key={x.id} itemId={x.id} isNew={highlightId===x.id} title={x.name} subtitle={`${money(x.amountBase, trip.baseCurrency)} · ${freqLabel(x.frequency)}`} badges={[x.enabled?"Active":"Disabled", rangeLabel(x)]} insight={x.enabled?"This increases available travel cash.":"Disabled income is ignored."} onRemove={() => remove(x.id)}>
        <Toggle label="Enabled" hint="Include this income." checked={x.enabled} onChange={v => updateItem(x.id,"enabled",v)} />
        <Field label="Edit Name"><Input value={x.name} onChange={v => updateItem(x.id,"name",v)} /></Field>
        <Field label="Amount" hint={trip.baseCurrency}><Input type="number" value={x.amountBase} onChange={v => updateItem(x.id,"amountBase",v)} /></Field>
        <Field label="Frequency"><Select value={x.frequency} onChange={v => updateItem(x.id,"frequency",v)}><option value="monthly">Monthly</option><option value="one-time">One-time</option><option value="weekly">Weekly</option><option value="daily">Daily</option></Select></Field>
        {x.frequency === "monthly" ? <>
          <Field label="Salary Day" hint="day of month"><Input type="number" value={x.salaryDay || dayFromDate(x.nextDate, 25)} onChange={v => { updateItem(x.id,"salaryDay",cleanPositiveInt(v,1)); updateItem(x.id,"nextDate",nextDateFromDay(v, trip.startDate || new Date().toISOString().slice(0,10))); }} /></Field>
          <div className="datePreview"><Icon name="calendar-check"/> Next expected income: <b>{monthLabel(x.nextDate || nextDateFromDay(x.salaryDay || 25, trip.startDate || new Date().toISOString().slice(0,10)))}</b></div>
          <details className="advancedMini"><summary>Advanced date</summary><Field label="First salary date"><DateInput value={x.nextDate || ""} onChange={v => updateItem(x.id,"nextDate",v)} /></Field></details>
        </> : <Field label="Expected Date"><DateInput value={x.nextDate || ""} onChange={v => updateItem(x.id,"nextDate",v)} /></Field>}
      </SmartCard>)}
    </Manager>;
  }

  if (type === "life") {
    const presets = [
      {name:"Rent",icon:"house-door",categoryId:"cat-rent",amountBase:0,frequency:"monthly",canPause:false},
      {name:"Phone",icon:"phone",categoryId:"cat-phone",amountBase:0,frequency:"monthly",canPause:false},
      {name:"Gym",icon:"heart-pulse",categoryId:"cat-gym",amountBase:0,frequency:"monthly",canPause:false},
      {name:"Food & Transport",icon:"bus-front",categoryId:"cat-food-uae",amountBase:0,frequency:"monthly",canPause:false},
      {name:"Subscription",icon:"collection-play",categoryId:"cat-subscriptions",amountBase:0,frequency:"monthly",canPause:true},
      {name:"Other",icon:"three-dots",categoryId:"cat-other-life",amountBase:0,frequency:"one-time",canPause:false}
    ];
    return <Manager wizardMode={wizardMode} title="Home bills" subtitle="Bills that still run while you travel." info="Add only payments you still pay from home: rent, phone, subscriptions, family support, or utilities." presets={presets} add={add}>
      {trip.lifeCosts.map(x => {
        const cat = lifeCats.find(c=>c.id===x.categoryId)?.name || "Other";
        const danger = x.enabled && !x.canPause && num(x.amountBase)>0;
        const insight = !x.enabled ? "Disabled: ignored." : x.canPause ? "Paused: will not reduce trip cash." : x.frequency==="one-time" ? "One-time: only payment date needed." : "Repeats from the start date until the return date or repeat-until date.";
        return <SmartCard key={x.id} itemId={x.id} isNew={highlightId===x.id} title={x.name} subtitle={`${money(x.amountBase, trip.baseCurrency)} · ${freqLabel(x.frequency)}`} badges={[cat, x.canPause?"Can Pause":"Cannot Pause", rangeLabel(x)]} insight={insight} danger={danger} onRemove={() => remove(x.id)}>
          <Toggle label="Enabled" hint="Include this cost." checked={x.enabled} onChange={v => updateItem(x.id,"enabled",v)} />
          <Field label="Edit Name"><Input value={x.name} onChange={v => updateItem(x.id,"name",v)} /></Field>
          <Field label="Category"><Select value={x.categoryId} onChange={v => updateItem(x.id,"categoryId",v)}>{lifeCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
          <FrequencyFields item={x} currency={trip.baseCurrency} errors={errors} errorPrefix="life" onChange={(f,v)=>updateItem(x.id,f,v)} />
          <Toggle label="Can pause?" hint="If yes, it will not reduce trip cash." checked={x.canPause} onChange={v => updateItem(x.id,"canPause",v)} />
        </SmartCard>;
      })}
    </Manager>;
  }

  if (type === "installments") {
    const presets = [
      {name:"Tabby",icon:"credit-card",monthlyBase:0,frequency:"monthly",remainingMonths:4,continuesAfterTrip:true},
      {name:"Tamara",icon:"credit-card-2-front",monthlyBase:0,frequency:"monthly",remainingMonths:4,continuesAfterTrip:true},
      {name:"Credit Card",icon:"card-checklist",monthlyBase:0,frequency:"monthly",remainingMonths:6,continuesAfterTrip:true},
      {name:"Loan",icon:"bank",monthlyBase:0,frequency:"monthly",remainingMonths:12,continuesAfterTrip:true},
      {name:"Car Installment",icon:"car-front",monthlyBase:0,frequency:"monthly",remainingMonths:12,continuesAfterTrip:true},
      {name:"Phone Installment",icon:"phone",monthlyBase:0,frequency:"monthly",remainingMonths:12,continuesAfterTrip:true},
      {name:"Education Payment",icon:"mortarboard",monthlyBase:0,frequency:"monthly",remainingMonths:4,continuesAfterTrip:false},
      {name:"Other",icon:"three-dots",monthlyBase:0,frequency:"one-time",remainingMonths:1,continuesAfterTrip:false}
    ];
    return <Manager wizardMode={wizardMode} title="Installments" subtitle="Tabby, Tamara, loans, cards, and financing." info="Add scheduled payments that repeat or still need to be tracked during this trip." presets={presets} add={add}>
      {trip.installments.map(x => <SmartCard key={x.id} itemId={x.id} isNew={highlightId===x.id} title={x.name} subtitle={`${money(x.monthlyBase, trip.baseCurrency)} · ${freqLabel(x.frequency)}`} badges={[x.enabled?"Active":"Disabled", `${x.remainingMonths || 0} months`, x.continuesAfterTrip?"Post-trip Risk":"Ends Around Trip"]} insight={x.continuesAfterTrip?"Continues after trip: increases post-trip risk.":"Lower post-trip pressure."} danger={x.enabled&&x.continuesAfterTrip} onRemove={() => remove(x.id)}>
        <Toggle label="Enabled" hint="Include this installment." checked={x.enabled} onChange={v => updateItem(x.id,"enabled",v)} />
        <Field label="Edit Name"><Input value={x.name} onChange={v => updateItem(x.id,"name",v)} /></Field>
        <FrequencyFields item={x} currency={trip.baseCurrency} amountKey="monthlyBase" errors={errors} errorPrefix="installment" onChange={(f,v)=>updateItem(x.id,f,v)} />
        <Field label="Remaining Months"><Input type="number" value={x.remainingMonths} onChange={v => updateItem(x.id,"remainingMonths",v)} /></Field>
        <Toggle label="Continues after trip?" hint="Used in risk score." checked={x.continuesAfterTrip} onChange={v => updateItem(x.id,"continuesAfterTrip",v)} />
      </SmartCard>)}
    </Manager>;
  }

  const presets = tripCostPresetsFor(trip);
  const costInfo = destinationCostInfo(trip);
  return <Manager wizardMode={wizardMode} title={costInfo.title} subtitle={costInfo.subtitle} info={costInfo.info} presets={presets} add={add}>
    <DestinationCurrencyNotice trip={trip} onOpenCurrencySetup={onOpenCurrencySetup}/>
    <PresetSuggestionPanel trip={trip} calc={calc} add={add} updateItem={updateItem} remove={remove} focusCategory={focusCategory} onOpenCurrencySetup={onOpenCurrencySetup}/>
    {trip.budget.map(x => {
      const cat = tripCats.find(c=>c.id===x.categoryId)?.name || "Other";
      const insight = x.categoryId==="cat-emergency" ? "Emergency is healthy. Recommended 5–10%." : x.priority==="Optional" ? "Optional: best place to reduce if tight." : x.priority==="Flexible" ? "Flexible: keep adjustable." : "Must-have: core trip cost.";
      return <SmartCard key={x.id} itemId={x.id} isNew={highlightId===x.id} title={x.name} subtitle={`${money(x.amountLocal, trip.tripCurrency)} · ${x.priority}`} badges={[cat, costBadge(x), x.timing, freqLabel(x.frequency), x.paid?"Paid":"Unpaid"]} insight={insight} danger={x.priority==="Must"&&!x.paid&&num(x.amountLocal)>0} onRemove={() => remove(x.id)}>
        <div className="markPaidInline">{!x.paid ? <Button variant="soft" onClick={() => updateItem(x.id,"paid",true)}><Icon name="check2"/> Mark Paid</Button> : <Button variant="soft" onClick={() => updateItem(x.id,"paid",false)}><Icon name="arrow-counterclockwise"/> Undo Paid</Button>}<small>Due date/timing does not mark this as paid automatically.</small></div>
        <Field label="Edit Name"><Input value={x.name} onChange={v => updateItem(x.id,"name",v)} /></Field>
        <Field label="Category"><Select value={x.categoryId} onChange={v => updateItem(x.id,"categoryId",v)}>{tripCats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</Select></Field>
        <FrequencyFields item={x} currency={trip.tripCurrency} amountKey="amountLocal" includePeriod={false} tripCost errors={errors} errorPrefix="budget" onChange={(f,v)=>updateItem(x.id,f,v)} />
        <Field label="Priority"><Select value={x.priority} onChange={v => updateItem(x.id,"priority",v)}><option>Must</option><option>Flexible</option><option>Optional</option></Select></Field>
        <Field label="Timing"><Select value={x.timing} onChange={v => updateItem(x.id,"timing",v)}><option value="before">Before travel</option><option value="during">During travel</option><option value="after">After travel</option></Select></Field>
      </SmartCard>;
    })}
  </Manager>;
}

function DestinationCurrencyNotice({ trip, onOpenCurrencySetup }) {
  const dest = country(trip.destinationInfo?.countryCode);
  const destinationCurrency = String(dest.currency || trip.tripCurrency || "USD").toUpperCase();
  const selectedLabel = metadataCurrencyLabel(trip.tripCurrency);
  const same = destinationCurrency === String(trip.tripCurrency || "").toUpperCase();
  return <div className={`destinationCurrencyNotice compactCurrencyNotice ${same ? "matched" : "review"}`} data-section="trip-currency-notice">
    <span className="currencyFlag">{dest.flag || "🌍"}</span>
    <div className="currencyNoticeCopy">
      <small>Trip-cost currency</small>
      <b>{selectedLabel}</b>
      <p>{same ? `Matches ${dest.name || "the destination"}.` : `${dest.name || "The destination"} normally uses ${destinationCurrency}.`}</p>
    </div>
    {onOpenCurrencySetup && <Button variant={same ? "soft" : "dark"} className="currencyNoticeAction" onClick={onOpenCurrencySetup}><Icon name="currency-exchange"/> {same ? "Currency setup" : "Review currency"}</Button>}
  </div>;
}

function SuggestionAmountEditor({ amount, recommended, currency, onChange, onSave, onCancel, saveLabel = "Add custom" }) {
  const setAmount = (next) => onChange(Math.max(0, Math.round(normalizedNumber(next))));
  const adjust = (factor) => setAmount(Math.round(recommended * factor / 100) * 100);
  const step = Math.max(100, Math.round(Math.max(recommended, 1000) * 0.05 / 100) * 100);
  return <div className="amountEditorPanel">
    <div className="amountEditorTop"><div><span>Set your amount</span><b>{whole(amount, currency)}</b></div><small>Recommended: {whole(recommended, currency)}</small></div>
    <div className="amountStepper">
      <button type="button" onClick={() => setAmount(num(amount) - step)}><Icon name="dash"/></button>
      <div><Input type="number" value={amount} onChange={setAmount}/><em>{currency}</em></div>
      <button type="button" onClick={() => setAmount(num(amount) + step)}><Icon name="plus"/></button>
    </div>
    <div className="amountQuickChoices">
      <button type="button" onClick={() => adjust(0.8)}>-20%</button>
      <button type="button" onClick={() => adjust(0.9)}>-10%</button>
      <button type="button" onClick={() => setAmount(recommended)}>Use recommended</button>
      <button type="button" onClick={() => adjust(1.1)}>+10%</button>
      <button type="button" onClick={() => adjust(1.2)}>+20%</button>
    </div>
    <div className="amountEditorActions"><Button variant="dark" onClick={onSave}><Icon name="check2"/> {saveLabel}</Button><Button variant="ghost" onClick={onCancel}>Cancel</Button></div>
  </div>;
}

function PresetSuggestionPanel({ trip, calc, add, updateItem, remove, focusCategory="", onOpenCurrencySetup = null }) {
  const localSuggestions = useMemo(() => generatePresetSuggestions(trip, calc), [trip.comfortLevel, trip.travelStyle, trip.tripCurrency, trip.tripPurpose, trip.tripType, trip.startDate, trip.endDate, trip.travelers, (trip.budget || []).map(b => `${b.categoryId}:${b.amountLocal}`).join("|")]);
  const localEstimateBundle = useMemo(() => {
    const destinationCode = trip.destinationInfo?.countryCode;
    const destinationCurrency = country(destinationCode).currency || countryProfile(destinationCode).currency || trip.tripCurrency;
    return resolveLocalCostEstimateBundle({
      destinationCountry: destinationCode,
      destinationCurrency,
      tripCurrency: trip.tripCurrency,
      rateBook: trip.rateBook || {},
      costTier: countryProfile(destinationCode).costTier,
      comfortLevel: trip.comfortLevel || trip.travelStyle || "Balanced",
      days: daysBetween(trip.startDate, trip.endDate),
      travelers: trip.travelers
    });
  }, [trip.destinationInfo?.countryCode, trip.tripCurrency, trip.comfortLevel, trip.travelStyle, trip.startDate, trip.endDate, trip.travelers, JSON.stringify(trip.rateBook || {})]);
  const localRangeProfile = localEstimateBundle.ranges;
  const [backendSuggestions, setBackendSuggestions] = useState(null);
  const [backendRangeProfile, setBackendRangeProfile] = useState(null);
  const [suggestionSource, setSuggestionSource] = useState("local");
  const [expandedSuggestion, setExpandedSuggestion] = useState("");
  const [expandedCost, setExpandedCost] = useState("");
  const [customAmounts, setCustomAmounts] = useState({});
  const [customOpen, setCustomOpen] = useState({});
  const [pendingCategories, setPendingCategories] = useState({});
  const selectedCardRefs = useRef({});
  const suggestionSignature = `${trip.backendId || trip.id || "draft"}|${trip.startDate}|${trip.endDate}|${trip.travelers}|${trip.comfortLevel || trip.travelStyle}|${trip.tripCurrency}|${JSON.stringify(trip.rateBook || {})}|${(trip.budget || []).map(b => `${b.categoryId}:${b.amountLocal}`).join("|")}`;
  useEffect(() => {
    const id = trip.backendId || (trip.id && !String(trip.id).startsWith("draft") && !String(trip.id).startsWith("demo") ? trip.id : "");
    if (!id || trip.draft) { setBackendSuggestions(null); setSuggestionSource("local"); return; }
    let cancelled = false;
    setBackendSuggestions(null);
    setSuggestionSource("loading");
    api.generateTripSuggestions(id)
      .then(result => { if (!cancelled) { setBackendSuggestions(result.suggestions || []); setSuggestionSource("backend"); } })
      .catch(() => { if (!cancelled) { setBackendSuggestions(null); setSuggestionSource("local"); } });
    return () => { cancelled = true; };
  }, [suggestionSignature]);
  useEffect(() => {
    let cancelled = false;
    setBackendRangeProfile(null);
    api.getCostProfile({
      country: trip.destinationInfo?.countryCode || "",
      currency: trip.tripCurrency,
      comfort: trip.comfortLevel || trip.travelStyle || "Balanced",
      days: daysBetween(trip.startDate, trip.endDate),
      travelers: trip.travelers
    }).then(result => {
      if (cancelled) return;
      const profile = result?.data || result;
      if (profile?.categories) setBackendRangeProfile({ ...profile, confidence: result?.confidence || profile.confidence, source: result?.source || profile.source });
    }).catch(() => { if (!cancelled) setBackendRangeProfile(null); });
    return () => { cancelled = true; };
  }, [trip.destinationInfo?.countryCode, trip.tripCurrency, trip.comfortLevel, trip.travelStyle, trip.startDate, trip.endDate, trip.travelers, JSON.stringify(trip.rateBook || {})]);
  const normalizedBackendSuggestions = useMemo(
    () => normalizeBackendSuggestions(backendSuggestions || [], trip.tripCurrency, trip.rateBook || {}),
    [backendSuggestions, trip.tripCurrency, JSON.stringify(trip.rateBook || {})]
  );
  const normalizedBackendRangeProfile = useMemo(
    () => normalizeBackendRangeProfile(backendRangeProfile, trip.tripCurrency, trip.rateBook || {}),
    [backendRangeProfile, trip.tripCurrency, JSON.stringify(trip.rateBook || {})]
  );
  const rawSuggestions = dedupeSuggestionsByCategory(normalizedBackendSuggestions.length ? normalizedBackendSuggestions : localSuggestions);
  const selectedCategories = new Set((trip.budget || []).map(b => canonicalTripCategory(b.categoryId || b.name)));
  const rawRecommendedTotal = rawSuggestions.reduce((s,x)=>s+num(x.suggestedAmount),0);
  const forcedEmergencySuggestion = rawSuggestions.find(x => x.categoryId === "cat-emergency") || {
    categoryId:"cat-emergency",
    title:"Emergency",
    suggestedAmount: Math.max(1000, Math.round(Math.max(rawRecommendedTotal * 0.08, calc.plannedLocal * 0.08, estimateDestinationBaseline(trip) * 0.08, 1000) / 100) * 100),
    currentAmount:0,
    effect:"increase",
    message:"Backup money, not planned spending.",
    source:"FORCED_SAFETY"
  };
  // Emergency is a safety suggestion, so it must be visible if not already selected.
  const suggestions = rawSuggestions.some(x => x.categoryId === "cat-emergency") ? rawSuggestions : [forcedEmergencySuggestion, ...rawSuggestions];
  const availableSuggestions = suggestions.filter(x => !selectedCategories.has(x.categoryId));
  const selectedCosts = (trip.budget || []).filter(x => suggestions.some(s => s.categoryId === canonicalTripCategory(x.categoryId || x.name)));
  const selectedTotal = selectedCosts.reduce((s, x) => s + num(x.amountLocal), 0);
  const recommendedTotal = suggestions.reduce((s,x)=>s+num(x.suggestedAmount),0);
  const rangeProfile = normalizedBackendRangeProfile || localRangeProfile;
  const categoryRange = (categoryId, fallbackTypical = 0) => rangeProfile?.categories?.[categoryId] || { low: Math.round(num(fallbackTypical) * .8), typical: num(fallbackTypical), high: Math.round(num(fallbackTypical) * 1.3), unit: "trip total" };
  const rangeTotals = rangeProfile?.totals || { low: Math.round(recommendedTotal * .8), typical: recommendedTotal, high: Math.round(recommendedTotal * 1.3) };
  const rangeConfidence = rangeProfile?.confidence || (localEstimateBundle.conversionAvailable ? "low" : "unavailable");
  const emergencySuggestion = suggestions.find(x => x.categoryId === "cat-emergency") || forcedEmergencySuggestion;
  const emergencySelected = selectedCategories.has("cat-emergency");
  const essentialSuggestions = availableSuggestions.filter(x => ["cat-flight","cat-accommodation","cat-emergency"].includes(x.categoryId));
  const quickEmergencyAmount = (ratio) => Math.max(1000, Math.round(Math.max(recommendedTotal, calc.plannedLocal, emergencySuggestion.suggestedAmount * 10, estimateDestinationBaseline(trip)) * ratio / 100) * 100);
  useEffect(() => {
    if (!focusCategory) return;
    if (selectedCategories.has(focusCategory)) setExpandedCost(focusCategory);
    else setExpandedSuggestion(focusCategory);
  }, [focusCategory, selectedCosts.length, availableSuggestions.length]);
  useEffect(() => {
    if (!expandedCost) return;
    const target = selectedCardRefs.current[expandedCost];
    if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
  }, [expandedCost, selectedCosts.length]);
  const addSuggestion = async (suggestion, amount = suggestion.suggestedAmount) => {
    const categoryId = canonicalTripCategory(suggestion.categoryId || suggestion.category || suggestion.title);
    if (selectedCategories.has(categoryId) || pendingCategories[categoryId]) return;
    setPendingCategories(current => ({ ...current, [categoryId]: true }));
    try {
      await add({
        name: suggestion.title || tripCostCategoryLabel(categoryId),
        categoryId,
        amountLocal: normalizedNumber(amount),
        priority: ["cat-flight","cat-accommodation","cat-emergency"].includes(categoryId) ? "Must" : "Flexible",
        timing: categoryId === "cat-flight" ? "before" : "during",
        frequency: "trip-total",
        costType:"TRIP_TOTAL",
        currencyScope:"DESTINATION",
        source:"SUGGESTION",
        backendSuggestionId: suggestion.backendId || suggestion.id || ""
      });
      setExpandedSuggestion("");
      setCustomOpen(o => ({ ...o, [categoryId]: false }));
      setTimeout(() => setExpandedCost(categoryId), 180);
    } finally {
      setPendingCategories(current => ({ ...current, [categoryId]: false }));
    }
  };
  const addEssentials = async () => {
    for (const suggestion of essentialSuggestions) await addSuggestion(suggestion);
  };
  const restoreSuggestion = async (cost, original) => {
    const categoryId = canonicalTripCategory(cost.categoryId || cost.name);
    if (pendingCategories[categoryId]) return;
    setPendingCategories(current => ({ ...current, [categoryId]: true }));
    try {
      await remove(cost.id);
      const suggestionId = cost.backendSuggestionId || original?.backendId || original?.id;
      if (suggestionId) await api.restoreSuggestion(suggestionId);
      setExpandedCost("");
      setTimeout(() => setExpandedSuggestion(categoryId), 120);
    } finally {
      setPendingCategories(current => ({ ...current, [categoryId]: false }));
    }
  };
  const updateCostAmount = (cost, value) => updateItem(cost.id, "amountLocal", normalizedNumber(value));
  const iconFor = (x, index = 0) => x.categoryId.includes("flight") ? "airplane" : x.categoryId.includes("accommodation") ? "building" : x.categoryId.includes("food") ? "cup-hot" : x.categoryId.includes("transport") ? "car-front" : x.categoryId.includes("emergency") ? "shield-check" : "sparkles";
  return <Card className="suggestionPanel suggestionBasketPanel">
    <div className="suggestionHead premiumSuggestionHead">
      <div><span>Destination Budget Builder</span><h3>{whole(selectedTotal, trip.tripCurrency)} selected</h3><p>Planning ranges for {country(trip.destinationInfo?.countryCode).name || "your destination"}. Estimates use your Trip Currency.</p></div>
      <div className="suggestionHeadActions">
        {onOpenCurrencySetup && <button type="button" className="suggestionCurrencyLink" onClick={onOpenCurrencySetup}><Icon name="currency-exchange"/><span><small>Trip currency</small><b>{trip.tripCurrency}</b></span><Icon name="arrow-right"/></button>}
        {!!essentialSuggestions.length && <Button variant="soft" className="suggestionApplyBtn" disabled={essentialSuggestions.some(x => pendingCategories[x.categoryId])} onClick={addEssentials}><Icon name="stars"/> Add essentials</Button>}
      </div>
    </div>
    <div className="costRangeSummary">
      <div><span>Low</span><b>{whole(rangeTotals.low, trip.tripCurrency)}</b><small>Budget-focused</small></div>
      <div className="typical"><span>Typical</span><b>{whole(rangeTotals.typical, trip.tripCurrency)}</b><small>{trip.comfortLevel || trip.travelStyle || "Balanced"} plan</small></div>
      <div><span>High</span><b>{whole(rangeTotals.high, trip.tripCurrency)}</b><small>More flexibility</small></div>
      <em className={`confidencePill ${rangeConfidence}`}>{rangeConfidence} confidence · {backendRangeProfile ? "backend profile" : "local fallback"}</em>
    </div>
    <div className="suggestionTotalsBar basketTotals">
      <Mini label="Typical estimate" value={whole(rangeTotals.typical, trip.tripCurrency)}/>
      <Mini label="Your selected costs" value={whole(selectedTotal, trip.tripCurrency)}/>
      <Mini label="Still suggested" value={`${availableSuggestions.length} items`}/>
    </div>
    <div className="basketColumns">
      <section className="basketSection">
        <div className="basketSectionHead"><div><b>Suggested costs</b><small>Cards stay compact. Open only what you need.</small></div></div>
        <div className="basketList">
          {[...availableSuggestions].sort((a,b) => (a.categoryId === "cat-emergency" ? -1 : b.categoryId === "cat-emergency" ? 1 : 0)).map((x, index) => {
            const isOpen = expandedSuggestion === x.categoryId;
            const custom = customAmounts[x.categoryId] ?? x.suggestedAmount;
            const isEmergency = x.categoryId === "cat-emergency";
            return <div key={x.categoryId} data-category={x.categoryId} className={`basketSuggestionCard ${isOpen ? "open" : ""} ${isEmergency ? "emergencyInlineCard" : ""}`}>
              <button type="button" className="basketCardTop" onClick={()=>setExpandedSuggestion(isOpen ? "" : x.categoryId)}>
                <span className="suggestionIcon"><Icon name={iconFor(x,index)}/></span>
                <div><b>{x.title}</b><p>{x.message}</p></div>
                <em>{isEmergency ? "Quick add" : `Typical ${whole(categoryRange(x.categoryId, x.suggestedAmount).typical, trip.tripCurrency)}`}</em>
              </button>
              {isEmergency && !isOpen && <div className="inlineEmergencyQuickActions">
                <Button variant="success" disabled={!!pendingCategories[x.categoryId]} onClick={()=>addSuggestion(x, x.suggestedAmount)}><Icon name="plus-circle"/> {pendingCategories[x.categoryId] ? "Adding…" : `Recommended · ${whole(x.suggestedAmount, trip.tripCurrency)}`}</Button>
                <Button variant="soft" disabled={!!pendingCategories[x.categoryId]} onClick={()=>addSuggestion(x, quickEmergencyAmount(0.05))}>5%</Button>
                <Button variant="soft" disabled={!!pendingCategories[x.categoryId]} onClick={()=>addSuggestion(x, quickEmergencyAmount(0.10))}>10%</Button>
                <Button variant="ghost" onClick={()=>{ setCustomAmounts(a=>({...a,[x.categoryId]:custom})); setCustomOpen(o=>({...o,[x.categoryId]:true})); setExpandedSuggestion(x.categoryId); }}><Icon name="sliders"/> Custom</Button>
              </div>}
              {isOpen && <div className="basketCardBody">
                <div className="suggestionCompare compactCompare rangeCompare">
                  <Mini label="Low" value={whole(categoryRange(x.categoryId, x.suggestedAmount).low, trip.tripCurrency)}/>
                  <Mini label="Typical" value={whole(categoryRange(x.categoryId, x.suggestedAmount).typical, trip.tripCurrency)}/>
                  <Mini label="High" value={whole(categoryRange(x.categoryId, x.suggestedAmount).high, trip.tripCurrency)}/>
                </div>
                <p className="rangeUnitNote"><Icon name="info-circle"/> {categoryRange(x.categoryId, x.suggestedAmount).unit} · {rangeConfidence} confidence</p>
                <div className="suggestionActions">
                  <Button variant="success" disabled={!!pendingCategories[x.categoryId]} onClick={()=>addSuggestion(x, x.suggestedAmount)}><Icon name="plus-circle"/> {pendingCategories[x.categoryId] ? "Adding…" : isEmergency ? "Add emergency" : "Add recommended"}</Button>
                  {isEmergency && <><Button variant="soft" disabled={!!pendingCategories[x.categoryId]} onClick={()=>addSuggestion(x, quickEmergencyAmount(0.05))}>5%</Button><Button variant="soft" disabled={!!pendingCategories[x.categoryId]} onClick={()=>addSuggestion(x, quickEmergencyAmount(0.10))}>10%</Button></>}
                  <Button variant="soft" onClick={()=>{ setCustomAmounts(a=>({...a,[x.categoryId]:custom})); setCustomOpen(o=>({...o,[x.categoryId]:!o[x.categoryId]})); }}><Icon name="sliders"/> Custom</Button>
                  <Button variant="ghost" onClick={()=>setExpandedSuggestion("")}><Icon name="dash-circle"/> Skip now</Button>
                </div>
                {customOpen[x.categoryId] && <SuggestionAmountEditor amount={custom} recommended={x.suggestedAmount} currency={trip.tripCurrency} onChange={v=>setCustomAmounts(a=>({...a,[x.categoryId]:normalizedNumber(v)}))} onSave={()=>addSuggestion(x, custom)} onCancel={()=>setCustomOpen(o=>({...o,[x.categoryId]:false}))}/>}
              </div>}
            </div>;
          })}
          {!availableSuggestions.length && <div className="emptyMini">All suggestions are now in your selected costs. Remove any item below to bring it back here.</div>}
        </div>
      </section>
      <section className="basketSection selectedBasketSection">
        <div className="basketSectionHead"><div><b>Your selected trip costs</b><small>Only the active card opens for editing.</small></div><strong>{whole(selectedTotal, trip.tripCurrency)}</strong></div>
        <div className="basketList">
          {selectedCosts.map(cost => {
            const original = suggestions.find(s => s.categoryId === cost.categoryId);
            const isOpen = expandedCost === cost.categoryId;
            return <div key={cost.id} ref={el => { if (el) selectedCardRefs.current[cost.categoryId] = el; }} data-category={cost.categoryId} className={`basketSelectedCard ${isOpen ? "open" : ""}`}>
              <button type="button" className="basketCardTop" onClick={()=>setExpandedCost(isOpen ? "" : cost.categoryId)}>
                <span className="suggestionIcon added"><Icon name="check2-circle"/></span>
                <div><b>{cost.name}</b><p>{whole(num(cost.amountLocal), trip.tripCurrency)} · {cost.priority || "Flexible"}</p></div>
                <em>{cost.amountLocal === original?.suggestedAmount ? "Added" : "Custom"}</em>
              </button>
              {isOpen && <div className="basketCardBody">
                <div className="suggestionCompare compactCompare rangeCompare">
                  <Mini label="Low" value={whole(categoryRange(cost.categoryId, original?.suggestedAmount || cost.amountLocal).low, trip.tripCurrency)}/>
                  <Mini label="Your amount" value={whole(cost.amountLocal, trip.tripCurrency)}/>
                  <Mini label="High" value={whole(categoryRange(cost.categoryId, original?.suggestedAmount || cost.amountLocal).high, trip.tripCurrency)}/>
                </div>
                <p className={`rangePosition ${num(cost.amountLocal) < categoryRange(cost.categoryId, original?.suggestedAmount || cost.amountLocal).low ? "below" : num(cost.amountLocal) > categoryRange(cost.categoryId, original?.suggestedAmount || cost.amountLocal).high ? "above" : "inside"}`}>
                  {num(cost.amountLocal) < categoryRange(cost.categoryId, original?.suggestedAmount || cost.amountLocal).low ? "Below the planning range" : num(cost.amountLocal) > categoryRange(cost.categoryId, original?.suggestedAmount || cost.amountLocal).high ? "Above the planning range" : "Inside the planning range"}
                </p>
                <SuggestionAmountEditor amount={cost.amountLocal} recommended={original?.suggestedAmount || cost.amountLocal} currency={trip.tripCurrency} onChange={v=>updateCostAmount(cost, v)} onSave={()=>setExpandedCost("")} onCancel={()=>setExpandedCost("")} saveLabel="Save amount"/><div className="selectedCostActions"><Button variant="soft" onClick={()=>original && updateCostAmount(cost, original.suggestedAmount)}>Use recommended</Button><Button variant="danger" disabled={!!pendingCategories[canonicalTripCategory(cost.categoryId || cost.name)]} onClick={()=>restoreSuggestion(cost, original)}><Icon name="arrow-counterclockwise"/> {pendingCategories[canonicalTripCategory(cost.categoryId || cost.name)] ? "Removing…" : "Remove"}</Button></div>
              </div>}
            </div>;
          })}
          {!selectedCosts.length && <div className="emptyMini">No selected costs yet. Add suggestions from the left to build your trip budget.</div>}
        </div>
      </section>
    </div>
  </Card>;
}

function Manager({ title, subtitle, info, presets, add, children, wizardMode = false }) {
  return <div className={wizardMode ? "wizardManager" : ""}>
    <div className="sectionHead">
      <div>{wizardMode ? <h3>{title}</h3> : <h2>{title}</h2>}<p>{subtitle}</p></div>
      <Button variant="soft" onClick={() => add()}><Icon name="plus-lg"/> Add Custom</Button>
    </div>
    {wizardMode ? <details className="wizardInlineHelp"><summary><Icon name="info-circle"/> What counts here?</summary><p>{info}</p></details> : <Info title={title} icon="info-circle">{info}</Info>}
    <QuickAdd title="Quick add" presets={presets} onPick={add}/>
    <div className="smartGrid">{children}</div>
  </div>;
}
function Toggle({ label, hint, checked, onChange }) {
  return <label className="toggle"><span><b>{label}</b><small>{hint}</small></span><input type="checkbox" checked={!!checked} onChange={e=>onChange(e.target.checked)}/></label>;
}
function RateInput({ trip, update, error }) {
  const invalid = trip.baseCurrency !== trip.tripCurrency && (trip.rateNeedsReview || num(trip.exchangeRate) <= 0);
  return <div className={invalid ? "rateField invalid" : "rateField"}>
    <Field label={`Rate: 1 ${trip.baseCurrency} = ${trip.tripCurrency}`} hint={invalid ? "needs auto/manual" : "confirmed"}>
      <Input type="number" value={trip.exchangeRate} onChange={v=>update("exchangeRate",v)} />
    </Field>
    {(error || invalid) && <div data-field="exchangeRate" className="fieldError"><Icon name="exclamation-circle"/> {error || `Use Auto rate or enter the exchange rate for ${trip.baseCurrency} → ${trip.tripCurrency}.`}</div>}
  </div>;
}
function RateControl({ trip, update, error, autoFetch=true }) {
  const [rateLoading, setRateLoading] = useState(false);
  const [rateNote, setRateNote] = useState("");
  const lastPairRef = useRef("");

  const fetchLiveRate = async (options = {}) => {
    if (!trip.baseCurrency || !trip.tripCurrency) return;
    const pair = `${trip.baseCurrency}_${trip.tripCurrency}`;
    if (trip.baseCurrency === trip.tripCurrency) {
      update("applyAutoRate", { rate: 1, source: "same-currency", fetchedAt: new Date().toISOString(), pair });
      setRateNote("Same currency. No conversion needed.");
      return;
    }
    setRateLoading(true);
    setRateNote(options.refresh ? "Refreshing the planning rate..." : "Loading the planning rate...");
    try {
      const result = await resolveApiRate(api, trip.baseCurrency, trip.tripCurrency, { refresh: !!options.refresh, rateBook: trip.rateBook || {} });
      const cleanRate = Number(result.rate.toFixed(6));
      update("applyAutoRate", {
        rate: cleanRate,
        source: result.source || "api",
        sourceAsOf: result.sourceAsOf || null,
        fetchedAt: result.fetchedAt || new Date().toISOString(),
        expiresAt: result.expiresAt || null,
        stale: !!result.stale,
        confidence: result.confidence || "medium",
        pair
      });
      setRateNote(`${result.stale ? "Saved rate" : "API rate"} · ${result.source || "provider"}${result.sourceAsOf ? ` · ${result.sourceAsOf}` : ""}`);
    } catch (rateError) {
      setRateNote("Automatic rate is unavailable. The current rate was kept. Open manual override only if necessary.");
    } finally {
      setRateLoading(false);
    }
  };

  useEffect(() => {
    const pair = `${trip.baseCurrency}_${trip.tripCurrency}`;
    if (!autoFetch || !trip.baseCurrency || !trip.tripCurrency || pair === lastPairRef.current) return;
    lastPairRef.current = pair;
    if (trip.baseCurrency === trip.tripCurrency || trip.rateNeedsReview || num(trip.exchangeRate) <= 0) fetchLiveRate();
  }, [trip.baseCurrency, trip.tripCurrency]);

  const same = trip.baseCurrency === trip.tripCurrency;
  const rateReady = same || (!trip.rateNeedsReview && num(trip.exchangeRate) > 0);
  const sourceText = same ? "No conversion" : `${trip.rateSource || "Built-in FX resolver"}${trip.rateStale ? " · saved" : ""}`;
  return <div className={`unifiedRateControl currencyGuard ${rateReady ? "ready" : "review"}`}>
    <div className="currencyGuardPanel">
      <div>
        <span>Planning exchange rate</span>
        <b>{same ? `1 ${trip.baseCurrency} = 1 ${trip.tripCurrency}` : `1 ${trip.baseCurrency} = ${num(trip.exchangeRate).toFixed(4)} ${trip.tripCurrency}`}</b>
        <small>{sourceText}{trip.rateConfidence ? ` · ${trip.rateConfidence} confidence` : ""}</small>
      </div>
      <Button variant="soft" disabled={rateLoading} onClick={() => fetchLiveRate({ refresh: true })}><Icon name="arrow-repeat"/> {rateLoading ? "Updating..." : "Refresh rate"}</Button>
    </div>
    <small className="rateNote">{rateNote || "Rates update automatically. Use manual override only when needed."}</small>
    {(error || !rateReady) && <div data-field="exchangeRate" className="fieldError"><Icon name="exclamation-circle"/> {error || "A valid rate is required before continuing."}</div>}
    {!same && <details className="manualRateOverride"><summary>Manual override</summary><p>Use only when the API rate is unavailable or you need a specific bank/card rate.</p><RateInput trip={trip} update={update} error={error}/></details>}
  </div>;
}

function KPIs({ t, c }) {
  const backend = c.backendSummary;
  const gapLocal = Math.max(0, c.needToSaveLocal ?? (c.plannedLocal - c.availableLocal));
  const remainingLocal = num(c.remainingLocal ?? (c.availableLocal - c.plannedLocal));
  const paidLocal = Math.max(0, num(c.totalPaidLocal));
  const upcomingLocal = Math.max(0, num(c.totalStillNeededLocal));
  const totalOutgoingLocal = paidLocal + upcomingLocal;
  const display = backend?.displayCurrency || displayCurrency(t);
  const shown = (amount) => whole(convertTripLocal(amount, t, display), display);
  const alt = (amount) => dualCurrencyNote(amount, { ...t, displayCurrency: display }, display);
  const progress = totalOutgoingLocal > 0 ? Math.min(100, Math.round((paidLocal / totalOutgoingLocal) * 100)) : 0;
  const gapTone = gapLocal > 0 ? "danger" : remainingLocal < num(c.plannedLocal) * 0.08 ? "warning" : "success";
  return <section className="moneySnapshot" aria-label="Money snapshot">
    <div className="moneySnapshotHead"><div><span>Money snapshot</span><h2>What is available, paid, and still coming</h2></div><small>All expense cards include trip costs and scheduled commitments.</small></div>
    <div className="kpis dashboardKpis">
      <KPI title="Ready Money" value={shown(c.availableLocal)} note="Money currently available for this plan" subnote={alt(c.availableLocal)} icon="wallet2"/>
      <KPI title="Trip Plan Cost" value={shown(c.plannedLocal)} note="Expected spending at the destination" subnote={alt(c.plannedLocal)} icon="pie-chart"/>
      <KPI title="Paid So Far" value={shown(paidLocal)} note={`${progress}% of all tracked outgoings completed`} subnote={alt(paidLocal)} icon="check2-circle" tone="success" progress={progress}/>
      <KPI title="Still To Pay" value={shown(upcomingLocal)} note="Upcoming trip costs, bills, and installments" subnote={alt(upcomingLocal)} icon="calendar2-check" tone={upcomingLocal > 0 ? "warning" : "success"}/>
    </div>
    <div className={`fundingStatusBar ${gapTone}`}>
      <div><span>{gapLocal > 0 ? "Funding gap" : "After-trip position"}</span><b>{gapLocal > 0 ? `${shown(gapLocal)} still needed` : `${shown(Math.max(0, remainingLocal))} expected left`}</b></div>
      <p>{gapLocal > 0 ? "Increase available money or reduce flexible costs." : gapTone === "warning" ? "The trip is covered, but the remaining safety buffer is thin." : "The current plan is funded with a healthier remaining buffer."}</p>
    </div>
  </section>;
}
function KPI({title,value,note,subnote="",icon,invalid=false,tone="",progress=null}) { return <Card className={`kpi ${invalid ? "invalid" : ""} ${tone ? `tone-${tone}` : ""}`}><div><p>{title}</p><b>{value}</b><small>{note}</small>{progress !== null && <div className="kpiProgress"><i style={{width:`${progress}%`}}/></div>}{subnote && <em>{subnote}</em>}</div><span><Icon name={icon}/></span></Card>; }

function ProgressBar({ value=0, label="", hint="" }) {
  const safe = Math.max(0, Math.min(100, Math.round(num(value))));
  return <div className="progressBlock">
    <div className="progressLabel"><span>{label}</span><b>{safe}%</b></div>
    <div className="progressTrack"><span style={{width:`${safe}%`}}/></div>
    {hint && <small>{hint}</small>}
  </div>;
}

function LanguageSwitch({ language="en", setLanguage=()=>{} }) {
  return <div className="languageSwitch" title={langText(language,"language")}>
    <Icon name="translate"/>
    {languages.map(l=><button key={l.value} type="button" className={language===l.value?"active":""} onClick={()=>setLanguage(l.value)}>{l.short}</button>)}
  </div>;
}


function ScoreBreakdown({ calc }) {
  const factors = (calc.scoreFactors || []).filter(Boolean);
  if (!factors.length) return null;
  return <div className="scoreBreakdown">
    {factors.map(f => {
      const score = Math.max(0, Math.min(100, Math.round(num(f.score))));
      const tone = score >= 80 ? "success" : score >= 60 ? "warning" : "danger";
      return <div key={f.key || f.label} className={`scoreFactor ${tone}`}>
        <div><b>{f.label || f.key}</b><span>{score}/100</span></div>
        <div className="miniTrack"><i style={{width:`${score}%`}}/></div>
        <p>{f.reason || "Calculated from the current plan."}</p>
      </div>;
    })}
  </div>;
}

function TripStateBadge({ status }) {
  return <div className={`tripStateCurrent ${status.key || "almost"}`}><i/> <b>{status.label || status.title}</b></div>;
}

function CanTravelSummary({ trip, calc, status, openWizard, onNextAction, language="en" }) {
  const display = displayCurrency(trip);
  const remaining = num(status.remaining ?? calc.remainingLocal);
  const remainingDisplay = convertTripLocal(remaining, trip, display);
  const tightNote = status.key === "tight" && remaining >= 0 ? `Left after trip: ${whole(remainingDisplay, display)}.` : "";
  return <Card className={`canTravelSummary decisionFirst ${status.key}`}>
    <div className="canTravelTop">
      <div>
        <span>{langText(language,"travelDecision")}</span>
        <h2>{langText(language,"canTakeTrip")}</h2>
        <p><strong>{status.title}</strong> — {status.detail}</p>
        {tightNote && <em className="decisionInlineWarning"><Icon name="shield-exclamation"/> {tightNote} Build a safer emergency buffer before calling it ready.</em>}
      </div>
      <div className={`scoreRing ${status.key}`}><b>{status.readiness}</b><small>/100</small></div>
    </div>
    <ProgressBar value={status.readiness} label={langText(language,"progress")} hint={`${status.label} · ${status.readiness}/100`}/>
    <TripStateBadge status={status}/>
    <ScoreBreakdown calc={calc}/>
    <div className="nextActionBox clarifiedActionBox">
      <Icon name="lightning-charge"/>
      <div className="nextActionCopy"><span>Recommended now</span><b>{status.nextAction?.label || langText(language,"nextAction")}</b><p>{status.nextAction?.detail || "Keep improving the plan."}</p></div>
      <div className="decisionActionGroup clarifiedActions">
        {onNextAction && <button className="actionChoice primaryChoice" onClick={()=>onNextAction(status.nextAction)}><small>Recommended fix</small><strong>{status.nextAction?.cta || "Open action"}</strong><Icon name="arrow-right"/></button>}
        {openWizard && <button className="actionChoice fullPlanChoice" onClick={openWizard}><small>Full plan editor</small><strong>{langText(language,"improve")}</strong><Icon name="sliders"/></button>}
      </div>
    </div>
  </Card>;
}

function WizardScore({ trip, calc, language="en" }) {
  const status = canTravel(trip, calc);
  return <div className={`wizardScore ${status.key}`}>
    <div><span>{langText(language,"wizardProgress")}</span><b>{status.readiness}/100</b></div>
    <ProgressBar value={status.readiness} label="" hint={`${status.label}: ${status.nextAction?.label || "Keep improving"}`}/>
  </div>;
}

function ClientDecision({ trip, calc, status }) {
  return <div className={`decisionCard ${status.key}`}>
    <div className="decisionIcon"><Icon name={status.icon}/></div>
    <div>
      <span>Can you travel?</span>
      <h2>{status.title}</h2>
      <p>{status.detail}</p>
    </div>
  </div>;
}

function ClientNumberCards({ trip, calc, status }) {
  const next = calc.nextPayment;
  const backend = calc.backendSummary;
  const dc = backend?.displayCurrency || displayCurrency(trip);
  const bcard = (key, fallback) => whole(backend?.displayCards?.[key] ?? convertTripLocal(fallback, trip, dc), dc);
  return <div className="clientCards">
    <Card className={`clientMetric ${status.key}`}>
      <p>Decision</p>
      <b>{status.label}</b>
      <small>{status.verdict || "Based on your current plan"}</small>
    </Card>
    <Card className="clientMetric">
      <p>Need to Save</p>
      <b>{bcard("stillNeeded", Math.max(0, calc.needToSaveLocal ?? (calc.plannedLocal - calc.availableLocal)))}</b>
      <small>Updated from your current plan</small>
    </Card>
    <Card className="clientMetric">
      <p>Paid</p>
      <b>{bcard("paid", calc.totalPaidLocal)}</b>
      <small>Updates after payments are marked paid</small>
    </Card>
    <Card className="clientMetric">
      <p>Next Step</p>
      <b>{next ? money(next.amount, next.currency || trip.baseCurrency) : "None"}</b>
      <small>{next ? `${next.name} · ${next.source || "Payment"} · ${next.date}` : "No upcoming payments"}</small>
    </Card>
  </div>;
}

function TopActions({ recs, onAction }) {
  const shown = (recs || []).slice(0,2);
  return <Card className="topActions">
    <div className="smallHead"><span>Top advice</span><b>Do this next</b></div>
    {shown.map((r,i)=><div key={r.id || i} className={`actionRow ${r.level || "info"}`}>
      <span>{i+1}</span>
      <div><b>{r.title || r.label}</b><p>{r.detail}</p>{onAction && <button type="button" onClick={()=>onAction(r)}>{r.actionLabel || r.cta}<Icon name="arrow-right"/></button>}</div>
    </div>)}
  </Card>;
}


function EventProcessStatus({ calc }) {
  const hasBackendEvents = !!calc.backendSummary?.events?.length;
  const hasBackendPayments = !!calc.backendSummary?.payments;
  return <div className="eventProcessStatus">
    <Icon name={hasBackendEvents || hasBackendPayments ? "diagram-3" : "cpu"}/>
    <div>
      <b>{hasBackendEvents || hasBackendPayments ? "Event process active" : "Local event process"}</b>
      <p>{hasBackendEvents || hasBackendPayments ? "Safaryaty converts income, costs, installments, and paid items into a financial timeline behind the scenes." : "Events are simulated locally until this trip is saved and synced with the backend."}</p>
    </div>
  </div>;
}

function PaymentTracker({ trip, calc, markPaid, undoPaid, compact=false }) {
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("due");
  const [busyPayment, setBusyPayment] = useState("");
  const savedBackendTrip = !!(trip?.backendId || (trip?.id && !String(trip.id).startsWith("demo")));
  const backendPayments = calc.backendSummary?.payments;
  const mapBackend = (p) => ({
    id: p.id,
    name: p.title || p.name || "Payment",
    source: p.source || "Saved plan",
    date: p.date || p.paidDate || "Planning",
    amount: p.displayAmount ?? p.amount,
    currency: p.displayCurrency || calc.backendSummary?.displayCurrency || displayCurrency(trip),
    status: p.status || (p.paidDate ? "paid" : "upcoming"),
    raw: p
  });
  const localPayments = (calc.paymentSchedule || calc.cashflow || [])
    .filter(r => r.type === "expense")
    .map(p => ({ ...p, currency: p.currency || (p.group === "destination" ? trip.tripCurrency : trip.baseCurrency), status: p.status || "upcoming" }));
  const useBackendPayments = savedBackendTrip && backendPayments;
  const awaitingBackendPayments = savedBackendTrip && !backendPayments;
  const upcomingRaw = useBackendPayments
    ? (backendPayments.upcoming || []).map(mapBackend)
    : awaitingBackendPayments ? [] : localPayments.filter(r => r.status !== "paid");
  const paidRaw = useBackendPayments
    ? (backendPayments.paid || []).map(mapBackend)
    : awaitingBackendPayments ? [] : localPayments.filter(r => r.status === "paid");
  const paymentMatches = (p) => {
    const text = `${p.name || ""} ${p.source || ""} ${p.group || ""} ${p.categoryId || ""} ${p.date || ""}`.toLowerCase();
    const q = query.trim().toLowerCase();
    if (q && !text.includes(q)) return false;
    if (filter === "all") return true;
    if (filter === "monthly") return p.group === "origin" || /life cost|monthly bill|existing commitment|rent|phone|subscription|gym/i.test(text) || text.includes("month") || text.includes("monthly") || p.frequency === "monthly";
    if (filter === "installments") return text.includes("installment") || text.includes("tabby") || text.includes("tamara") || text.includes("loan") || p.group === "installment" || p.group === "installments";
    if (filter === "trip") return p.group === "destination" || text.includes("trip") || text.includes("destination");
    return true;
  };
  const sorter = (a,b) => {
    if (sort === "amount") return num(b.amount) - num(a.amount);
    if (sort === "name") return String(a.name || "").localeCompare(String(b.name || ""));
    return String(a.date || "").localeCompare(String(b.date || ""));
  };
  const upcoming = upcomingRaw.filter(paymentMatches).sort(sorter).slice(0, compact ? 4 : 60);
  const paid = paidRaw.filter(paymentMatches).sort(sorter).slice(0, compact ? 3 : 60);
  return <div className="paymentTracker">
    <div className="trackerHead">
      <div>
        <span>Payments</span>
        <h3>What do you need to pay?</h3>
        <p>{useBackendPayments ? "Saved payment plan from your account." : awaitingBackendPayments ? "Loading saved payment plan..." : "Draft payment preview until this trip is saved."}</p>
      </div>
      <div className="trackerStats">
        <b>{upcoming.length}</b><small>upcoming</small>
      </div>
    </div>
    {!compact && <div className="paymentFilterBar">
      <Input value={query} placeholder="Search payment, category, or date..." onChange={setQuery}/>
      <div className="paymentFilterChips">
        {[['all','All'],['monthly','Monthly'],['installments','Installments'],['trip','Trip costs']].map(([k,label]) => <button key={k} type="button" className={filter===k?"active":""} onClick={()=>setFilter(k)}>{label}</button>)}
      </div>
      <Select value={sort} onChange={setSort}><option value="due">Due soon</option><option value="amount">Amount high</option><option value="name">Name</option></Select>
    </div>}
    <div className="paymentGroups">
      <div className="paymentGroup">
        <h4>Upcoming Payments</h4>
        {upcoming.length === 0 && <div className="emptyMini">{awaitingBackendPayments ? "Syncing payments from backend..." : "No upcoming payments match this filter."}</div>}
        {upcoming.map(p=><div key={p.id} className="paymentRow upcoming">
          <div><b>{p.name}</b><p>{p.source} · {formatDateValue(p.date) || p.date}</p></div>
          <strong>{money(p.amount, p.currency || trip.baseCurrency)}</strong>
          <button disabled={busyPayment === p.id || awaitingBackendPayments} onClick={async()=>{ setBusyPayment(p.id); try { await markPaid(p.id); } finally { setBusyPayment(""); } }}><Icon name="check2"/> {busyPayment === p.id ? "Saving..." : "Mark Paid"}</button>
        </div>)}
      </div>

      <div className="paymentGroup">
        <h4>Paid Payments</h4>
        {paid.length === 0 && <div className="emptyMini">No paid payments match this filter.</div>}
        {paid.map(p=><div key={p.id} className="paymentRow paid">
          <div><b>{p.name}</b><p>{p.source} · {formatDateValue(p.date) || p.date}</p></div>
          <strong>{money(p.amount, p.currency || trip.baseCurrency)}</strong>
          <button disabled={busyPayment === p.id || awaitingBackendPayments} onClick={async()=>{ setBusyPayment(p.id); try { await undoPaid(p.id); } finally { setBusyPayment(""); } }}><Icon name="arrow-counterclockwise"/> {busyPayment === p.id ? "Saving..." : "Undo"}</button>
        </div>)}
      </div>
    </div>
  </div>;
}

function EventManagementPanel({ trip, calc }) {
  const backendEvents = calc.backendSummary?.events || [];
  const backendPayments = calc.backendSummary?.payments;
  const displayCur = calc.backendSummary?.displayCurrency || displayCurrency(trip);
  const paymentEvents = backendPayments
    ? [
        ...(backendPayments.upcoming || []).map(p => ({ id: p.id, kind: "upcoming", title: p.title || p.name || "Payment", source: p.source || "Payment", date: p.date || "Planning", amount: p.displayAmount ?? p.amount, currency: p.displayCurrency || displayCur, status: "upcoming" })),
        ...(backendPayments.paid || []).map(p => ({ id: p.id, kind: "paid", title: p.title || p.name || "Paid", source: p.source || "Payment", date: p.paidDate || p.date || "Paid", amount: p.displayAmount ?? p.amount, currency: p.displayCurrency || displayCur, status: "paid" }))
      ]
    : [];
  const localEvents = !backendEvents.length && !paymentEvents.length
    ? [
        ...calc.cashflow.filter(r => r.type === "income").slice(0, 20).map(r => ({ id: `income-${r.id || r.date}-${r.name}`, kind: "income", title: r.name || "Income", source: "Income", date: r.date, amount: r.amount, currency: trip.baseCurrency, status: "income" })),
        ...calc.cashflow.filter(r => r.type === "expense").slice(0, 30).map(r => ({ id: `expense-${r.id || r.date}-${r.name}`, kind: r.status === "paid" ? "paid" : "upcoming", title: r.name || "Payment", source: r.source || "Cashflow", date: r.date, amount: r.amount, currency: trip.baseCurrency, status: r.status === "paid" ? "paid" : "upcoming" }))
      ]
    : [];
  const events = [...backendEvents, ...paymentEvents, ...localEvents].map((e, i) => ({
    id: e.id || e.key || `event-${i}`,
    kind: (e.kind || e.type || e.status || "upcoming").toLowerCase(),
    title: e.title || e.name || e.label || "Event",
    source: e.source || e.category || "Safaryaty",
    date: e.date || e.dueDate || e.paidDate || "Planning",
    amount: e.displayAmount ?? e.amount ?? e.amountBase ?? 0,
    currency: e.displayCurrency || e.currency || displayCur,
    message: e.message || e.note || ""
  }));
  const upcoming = events.filter(e => !["paid", "income", "warning"].includes(e.kind)).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const paid = events.filter(e => e.kind === "paid");
  const income = events.filter(e => e.kind === "income");
  const warnings = events.filter(e => e.kind === "warning" || /warning|risk|low|gap|review/i.test(e.message || e.title));
  const groups = [
    ["Upcoming", upcoming, "calendar2-week"],
    ["Paid", paid, "check2-circle"],
    ["Income", income, "cash-stack"],
    ["Warnings", warnings, "exclamation-triangle"]
  ];
  return <section className="eventsPanel">
    <Card className="eventsHero">
      <div><span>Event Management</span><h2>Financial Timeline</h2><p>Track what is coming in, what must be paid, and what already happened. Backend events are used when available; local cashflow remains as fallback.</p></div>
      <div className="eventsSource"><Icon name={calc.backendSummary?.events?.length ? "cloud-check" : "diagram-3"}/><b>{calc.backendSummary?.events?.length ? "Backend events" : "Cashflow fallback"}</b></div>
    </Card>
    <div className="eventGroups">
      {groups.map(([title, list, icon]) => <Card key={title} className="eventGroup">
        <div className="eventGroupHead"><div><Icon name={icon}/><h3>{title}</h3></div><b>{list.length}</b></div>
        {list.length === 0 && <div className="emptyMini">No {String(title).toLowerCase()} events yet.</div>}
        {list.slice(0, 12).map(ev => <div key={ev.id} className={`eventRow ${ev.kind}`}>
          <div className="eventDot"><Icon name={ev.kind === "paid" ? "check2" : ev.kind === "income" ? "arrow-down" : ev.kind === "warning" ? "exclamation" : "calendar-event"}/></div>
          <div><b>{ev.title}</b><p>{ev.source} · {ev.date}{ev.message ? ` · ${ev.message}` : ""}</p></div>
          <strong>{money(ev.amount, ev.currency)}</strong>
        </div>)}
      </Card>)}
    </div>
  </section>;
}

function Overview({ t, c, recs, mi, status, markPaid, undoPaid, openWizard, onNextAction, update, language="en" }) {
  return <div className="overview webDecisionLayout">
    <div className="homeMainStack">
      <CanTravelSummary trip={t} calc={c} status={status} openWizard={openWizard} onNextAction={onNextAction} language={language}/>
      {(c.exchangeRateMissing || t.rateNeedsReview) && <Info tone="danger" title="Exchange rate needs review" icon="currency-exchange">Safaryaty will try to update the rate automatically. Confirm it only if you want manual override.</Info>}
      <KPIs t={t} c={c}/>
      <PlanQuickEditCard trip={t} calc={c} update={update}/>
      <details className="advancedDetails homeAnalysis">
        <summary><Icon name="bar-chart"/> Show full analysis</summary>
        <PaymentTracker trip={t} calc={c} markPaid={markPaid} undoPaid={undoPaid} compact/>
        <div className="miniGrid"><Mini label="Route" value={route(t)}/><Mini label="Currencies" value={`${t.baseCurrency} → ${t.tripCurrency}`}/><Mini label="Rate" value={`1 ${t.baseCurrency} = ${t.exchangeRate || "?"}`}/></div>
        <div className="miniGrid"><Mini label="Money In" value={money(c.incomeBase,t.baseCurrency)}/><Mini label="Costs + Payments" value={money(c.expenseBase,t.baseCurrency)}/><Mini label="Reserved" value={money(c.reserveBase,t.baseCurrency)}/></div>
        <MoneyIntelligencePanel trip={t} calc={c} mi={mi} compact/>
        <CashflowSummary t={t} c={c}/>
      </details>
    </div>
    <aside className="homeCoachPanel">
      <Card className="coachCard actionGuideCard">
        <span>Action guide</span>
        <h3>Two different ways to edit</h3>
        <div className="actionGuideRows">
          <div><Icon name="lightning-charge"/><p><b>{status.nextAction?.cta || "Recommended action"}</b><small>Opens the exact page or card needed now.</small></p></div>
          <div><Icon name="sliders"/><p><b>{langText(language,"improve")}</b><small>Opens the full Wizard to edit the complete plan.</small></p></div>
        </div>
      </Card>
      <Card className="coachCard softCoach" data-section="display-currency">
        <h3>Show results in</h3>
        <DisplayCurrencySelect trip={t} update={update}/>
        <p>Display only. It does not mutate trip costs or reset paid payments.</p>
      </Card>
    </aside>
  </div>;
}

function DisplayCurrencySelect({ trip, update }) {
  const quick = Array.from(new Set([trip.tripCurrency, trip.baseCurrency, "USD", "EUR"].filter(Boolean).map(x => String(x).toUpperCase())));
  return <Field label="Display Currency" hint="Display only — never changes stored costs">
    <Select value={displayCurrency(trip)} onChange={v=>update("displayCurrency",v)}>
      {quick.map(c => <option key={c} value={c}>{c === trip.tripCurrency ? `${c} — trip plan` : c === trip.baseCurrency ? `${c} — income` : `${c} — global view`}</option>)}
    </Select>
  </Field>;
}

function PlanQuickEditCard({ trip, calc, update }) {
  const need = Math.max(0, calc.needToSaveLocal ?? (calc.plannedLocal - calc.availableLocal));
  return <details className="planQuickEditCard compactEditPanel" data-section="plan-money">
    <summary><div><span>Quick edit</span><b>Dates, savings, support, and reserve</b><small>Open only when you need a direct adjustment.</small></div><strong className={need > 0 ? "needChip danger" : "needChip"}>Need to Save: {displayWhole(need, trip)}</strong><Icon name="chevron-down"/></summary>
    <div className="compactEditBody">
      <div className="formGrid compactEditGrid">
        <Field label="Start date"><Input type="date" value={trip.startDate || ""} onChange={v=>update("startDate",v)}/></Field>
        <Field label="Return date"><Input type="date" value={trip.endDate || ""} onChange={v=>update("endDate",v)}/></Field>
        <Field label={`Savings (${trip.baseCurrency})`}><Input type="number" value={trip.startingSavingsBase} onChange={v=>update("startingSavingsBase",v)}/></Field>
        <Field label={`Support (${trip.tripCurrency})`}><Input type="number" value={trip.supportLocal} onChange={v=>update("supportLocal",v)}/></Field>
      </div>
      <div className="quickReserveRow">
        <Toggle label="Keep safety money after trip" hint="Protect money instead of spending it." checked={!!trip.scenario?.reserveAfterTripBase} onChange={v=>update("scenarioReserveEnabled",v)}/>
        {!!trip.scenario?.reserveAfterTripBase && <Field label={`Reserve (${trip.baseCurrency})`}><Input type="number" value={trip.scenario?.reserveAmountBase ?? 0} onChange={v=>update("scenarioReserveAmount",v)}/></Field>}
      </div>
    </div>
  </details>;
}

function CashflowSummary({ t, c }) {
  return <div className="cashSummary"><h3>Generated Cashflow</h3>{c.monthly.map(m=><div key={m.period}><b>{m.period}</b><span>Income {money(m.income,t.baseCurrency)}</span><span>Costs {money(m.expenses,t.baseCurrency)}</span><strong>Net {money(m.net,t.baseCurrency)}</strong></div>)}</div>;
}
function RecommendationPageHeader({ recs, calc }) {
  const list = recs || [];
  const critical = list.filter(item => item.priority === "critical").length;
  const high = list.filter(item => item.priority === "high").length;
  const state = critical ? "Needs attention" : high ? "Important actions" : list.length ? "Plan guidance" : "No action needed";
  return <Card className="recommendationPageHero">
    <div>
      <span>Rule-based travel coach</span>
      <h2>{state}</h2>
      <p>Safaryaty ranks up to three actions from your canonical decision, payment schedule, and destination cost ranges.</p>
    </div>
    <div className="recommendationHeroStats">
      <div><small>Readiness</small><b>{Math.round(num(calc.readiness))}/100</b></div>
      <div><small>Actions</small><b>{list.length}</b></div>
      <div><small>Top priority</small><b>{list[0]?.priority || "none"}</b></div>
    </div>
    <div className="recommendationSourceNote"><Icon name="shield-check"/> Deterministic rules only — no ML or LLM changes your money, score, or verdict.</div>
  </Card>;
}

function Recs({ recs, compact=false, onAction }) {
  const list = compact ? (recs || []).slice(0,3) : (recs || []);
  return <div className={compact ? "recs compact" : "recs recommendationGrid"}>{list.map((r,i)=><Card key={r.id || i} className={`rec recommendationCard ${r.level || "info"}`}>
    <div className="recommendationIcon"><Icon name={r.icon || "lightbulb"}/></div>
    <div className="recommendationBody">
      <div className="recommendationMeta"><span className={`priorityBadge ${r.priority || "medium"}`}>{r.priority || "medium"}</span><span>{r.confidence || "medium"} confidence</span>{r.source && <span>{r.source}</span>}</div>
      <h3>{r.title || r.label}</h3>
      <p>{r.detail}</p>
      {r.impact?.amount > 0 && <div className="recommendationImpact"><span>{r.impact.label || "Estimated impact"}</span><strong>{whole(r.impact.amount, r.impact.currency || "")}</strong></div>}
      {onAction && <button type="button" className="recommendationAction" onClick={()=>onAction(r)}><span>{r.actionLabel || r.cta || "Open"}</span><Icon name="arrow-right"/></button>}
    </div>
  </Card>)}</div>;
}


function MoneyIntelligencePanel({ trip, calc, mi, compact=false, onAction }) {
  const shown = compact ? mi.insights.slice(0,3) : mi.insights;
  return <div className="miPanel">
    <div className="miHead">
      <div>
        <span>Plan Suggestions</span>
        <h3>Actions</h3>
        <p>Simple next steps based on your current travel plan.</p>
      </div>
      <div className={`miOrb ${mi.miScore >= 70 ? "good" : mi.miScore >= 45 ? "mid" : "bad"}`}><Icon name="lightbulb"/></div>
    </div>
    <div className="miGrid">
      {shown.map((item, index)=><div key={index} className={`miCard ${item.level}`}>
        <div className="miIcon"><Icon name={item.icon}/></div>
        <div>
          <b>{item.title}</b>
          <p>{item.detail}</p>
          <div className="miAction"><span>{item.action}</span><strong>{item.metric}</strong></div>{onAction && item.recommendation && <button type="button" className="miOpenAction" onClick={()=>onAction(item.recommendation)}>Open exact place <Icon name="arrow-right"/></button>}
        </div>
      </div>)}
    </div>
    {!compact && <div className="miWhy">
      <h4>Details</h4>
      {mi.positives.map((line, i)=><p key={i} className={line.startsWith("+") ? "plus" : "minus"}>{line}</p>)}
    </div>}
  </div>;
}

function validateWizardStepDetailed(t, step) {
  const fields = {};
  const messages = [];
  const add = (field, message) => {
    if (!fields[field]) fields[field] = message;
    messages.push(message);
  };
  if (step === 0) {
    if (!String(t.name || "").trim()) add("name", "Add a trip name.");
    if (!t.origin?.countryCode) add("originCountry", "Choose origin country.");
    if (!t.origin?.airportCode) add("originAirport", "Choose origin airport.");
    if (!t.destinationInfo?.countryCode) add("destinationCountry", "Choose destination country.");
    if (!t.destinationInfo?.airportCode) add("destinationAirport", "Choose destination airport.");
    if (!t.startDate || !isValidISODate(t.startDate)) add("startDate", "Choose a valid departure date.");
    if (!t.endDate || !isValidISODate(t.endDate)) add("endDate", "Choose a valid return date.");
    if (isValidISODate(t.startDate) && isValidISODate(t.endDate) && new Date(t.endDate) < new Date(t.startDate)) add("endDate", "Return date cannot be before departure date.");
    if (num(t.travelers) < 1) add("travelers", "Travelers must be at least 1.");
  }
  if (step === 1) {
    if (!t.baseCurrency) add("baseCurrency", "Choose income currency.");
    if (!t.tripCurrency) add("tripCurrency", "Choose trip currency.");
    if (t.baseCurrency !== t.tripCurrency && (t.rateNeedsReview || num(t.exchangeRate) <= 0)) add("exchangeRate", "Confirm the exchange rate.");
    const enabled = (t.incomeSources || []).filter(x => x.enabled);
    if (!enabled.length) add("incomeSources", "Add at least one income source, like Salary.");
    enabled.forEach((x, index) => {
      const id = x.id || index;
      if (num(x.amountBase) < 0) add(`income-${id}-amount`, `${x.name || "Income"}: amount cannot be negative.`);
      if (isOne(x.frequency) && (!x.nextDate || !isValidISODate(x.nextDate))) add(`income-${id}-date`, `${x.name || "Income"}: choose a valid expected date.`);
      if (isRepeat(x.frequency) && (!x.nextDate || !isValidISODate(x.nextDate))) add(`income-${id}-start`, `${x.name || "Income"}: choose a valid start date.`);
      if (isRepeat(x.frequency) && x.untilDate && (!isValidISODate(x.untilDate) || new Date(x.untilDate) < new Date(x.nextDate))) add(`income-${id}-until`, `${x.name || "Income"}: repeat until date is invalid or before start date.`);
    });
  }
  if (step === 2) {
    (t.lifeCosts || []).filter(x => x.enabled).forEach((x, index) => {
      const id = x.id || index;
      if (num(x.amountBase) < 0) add(`life-${id}-amount`, `${x.name || "Commitment"}: amount cannot be negative.`);
      if (isOne(x.frequency) && (!x.nextDate || !isValidISODate(x.nextDate))) add(`life-${id}-date`, `${x.name || "Commitment"}: choose a valid payment date.`);
      if (isRepeat(x.frequency) && (!x.nextDate || !isValidISODate(x.nextDate))) add(`life-${id}-start`, `${x.name || "Commitment"}: choose a valid start date.`);
      if (isRepeat(x.frequency) && x.untilDate && (!isValidISODate(x.untilDate) || new Date(x.untilDate) < new Date(x.nextDate))) add(`life-${id}-until`, `${x.name || "Commitment"}: repeat until date is invalid or before start date.`);
    });
    (t.installments || []).filter(x => x.enabled).forEach((x, index) => {
      const id = x.id || index;
      if (num(x.monthlyBase) < 0) add(`installment-${id}-amount`, `${x.name || "Monthly payment"}: amount cannot be negative.`);
      if (!x.nextDate || !isValidISODate(x.nextDate)) add(`installment-${id}-start`, `${x.name || "Monthly payment"}: choose a valid next due date.`);
      if (num(x.remainingMonths) < 1) add(`installment-${id}-months`, `${x.name || "Monthly payment"}: remaining months must be at least 1.`);
      if (x.untilDate && (!isValidISODate(x.untilDate) || new Date(x.untilDate) < new Date(x.nextDate))) add(`installment-${id}-until`, `${x.name || "Monthly payment"}: repeat until date is invalid or before next due date.`);
    });
  }
  if (step === 3) {
    const costs = (t.budget || []);
    if (!costs.length) add("tripCosts", "Add at least one trip cost or use suggestions.");
    costs.forEach((x, index) => {
      const id = x.id || index;
      if (num(x.amountLocal) < 0) add(`budget-${id}-amount`, `${x.name || "Trip cost"}: amount cannot be negative.`);
      if (isOne(x.frequency) && x.timing !== "during" && (!x.nextDate || !isValidISODate(x.nextDate))) add(`budget-${id}-date`, `${x.name || "Trip cost"}: choose a valid date or set it as during-trip total.`);
    });
  }
  return { fields, messages, firstField: Object.keys(fields)[0] || "" };
}
function validateWizardStep(t, step) {
  return validateWizardStepDetailed(t, step).messages;
}
function validateTripForFinish(t) {
  return [0,1,2,3].flatMap(step => validateWizardStep(t, step));
}
function StepValidation({ errors }) {
  if (!errors?.messages?.length) return null;
  return <div className="inlineStepHint"><Icon name="exclamation-circle"/> Complete the highlighted fields before continuing.</div>;
}

function Wizard({ trip, calc, recs, mi, update, arrayOps, highlightId, onFinish, validationErrors=[], language="en", navigationRequest=null, currencyBusy="idle" }) {
  const [step,setStep]=useState(0);
  const [stepErrors,setStepErrors]=useState({ fields:{}, messages:[], firstField:"" });
  const [currencyRequest,setCurrencyRequest]=useState(null);
  const wizardMainRef = useRef(null);
  const steps = [["Trip Details","airplane"],["Available Money","wallet2"],["Commitments","shield-check"],["Trip Costs","pie-chart"],["Decision","stars"]];
  const canLeaveStep = () => {
    const result = validateWizardStepDetailed(trip, step);
    setStepErrors(result);
    if (result.firstField) setTimeout(() => {
      const target = document.querySelector(`[data-field="${result.firstField}"]`);
      target?.scrollIntoView({ behavior:"smooth", block:"center" });
      target?.querySelector?.("input, select, textarea, button")?.focus?.();
    }, 50);
    return result.messages.length === 0;
  };
  useEffect(() => {
    if (stepErrors.messages?.length) {
      const next = validateWizardStepDetailed(trip, step);
      setStepErrors(next);
    }
  }, [trip, step]);

  const resetWizardScroll = (instant=false) => {
    const main = wizardMainRef.current;
    const body = main?.closest?.(".modalBody") || document.querySelector(".modalBody");
    const box = main?.closest?.(".modalBox") || document.querySelector(".modalBox");
    [main, body, box].forEach(el => {
      if (!el) return;
      try { el.scrollTo({ top: 0, left: 0, behavior: instant ? "auto" : "smooth" }); }
      catch { el.scrollTop = 0; el.scrollLeft = 0; }
    });
  };
  useLayoutEffect(() => { resetWizardScroll(true); }, [step]);
  const setWizardStep = (next) => {
    setStep(next);
    setTimeout(() => resetWizardScroll(false), 0);
    setTimeout(() => resetWizardScroll(true), 80);
  };
  const openCurrencySetup = () => {
    const request = { target:"currency", stamp:Date.now() };
    setCurrencyRequest(request);
    setStepErrors({ fields:{}, messages:[], firstField:"" });
    setWizardStep(1);
  };
  useEffect(() => {
    if (!navigationRequest?.stamp) return;
    if (navigationRequest.target === "currency") {
      setCurrencyRequest(navigationRequest);
      setStepErrors({ fields:{}, messages:[], firstField:"" });
      setWizardStep(1);
    } else if (Number.isInteger(navigationRequest.step)) {
      setWizardStep(Math.max(0, Math.min(steps.length - 1, navigationRequest.step)));
    }
  }, [navigationRequest?.stamp]);
  const goToStep = (target) => {
    if (target <= step) { setStepErrors({ fields:{}, messages:[], firstField:"" }); setWizardStep(target); return; }
    if (canLeaveStep()) setWizardStep(Math.min(steps.length-1,target));
  };
  const nextStep = () => { if (canLeaveStep()) setWizardStep(Math.min(steps.length-1,step+1)); };
  const finish = () => { if (canLeaveStep()) onFinish(); };
  return <div className="wizard">
    <aside><h3>Build simply</h3><p>Less inputs. Smarter defaults. Clear output.</p><div className="wizardStepMeta"><span>{langText(language,"wizardProgress")}</span><b>{step+1}/{steps.length}</b></div><div className="progress"><span style={{width:`${((step+1)/steps.length)*100}%`}}/></div><WizardScore trip={trip} calc={calc} language={language}/>{steps.map((s,i)=><button key={s[0]} className={step===i?"active":""} onClick={()=>goToStep(i)}><Icon name={s[1]}/>{i+1} {s[0]}</button>)}</aside>
    <main>
      {validationErrors.length > 0 && <div className="finishErrors"><b><Icon name="exclamation-circle"/> Fix before creating the trip</b>{validationErrors.map((e,i)=><p key={i}>{e}</p>)}</div>}
      <StepValidation errors={stepErrors}/>
      {step===0 && <StepRoute trip={trip} update={update} errors={stepErrors.fields}/>}
      {step===1 && <><div className="wizardStepIntro"><span>Step 2</span><h2>Available money</h2><p>Enter what you have now, then add any money arriving before or during the trip.</p></div><MoneyBasics trip={trip} update={update} calc={calc} errors={stepErrors.fields} currencyRequest={currencyRequest} currencyBusy={currencyBusy}/><CardManagers wizardMode type="income" trip={trip} errors={stepErrors.fields} categoriesList={categories} highlightId={highlightId} {...arrayOps.income}/></>}
      {step===2 && <CommitmentsStep trip={trip} errors={stepErrors.fields} categoriesList={categories} highlightId={highlightId} lifeOps={arrayOps.life} installmentOps={arrayOps.installments}/>}
      {step===3 && <><div className="wizardStepIntro"><span>Step 4</span><h2>Trip costs</h2><p>Choose a cost currency, review realistic ranges, then add only the costs you expect.</p></div><CardManagers wizardMode type="budget" trip={trip} calc={calc} errors={stepErrors.fields} categoriesList={categories} highlightId={highlightId} focusCategory={highlightId === "cat-emergency" ? "cat-emergency" : ""} updateTrip={update} onOpenCurrencySetup={openCurrencySetup} {...arrayOps.budget}/></>}
      {step===4 && <Review trip={trip} calc={calc} recs={recs} mi={mi}/>}
      <div className="wizardActions"><Button variant="soft" disabled={step===0} onClick={()=>setWizardStep(Math.max(0,step-1))}><Icon name="arrow-left"/> Back</Button><Button onClick={()=>step===steps.length-1?finish():nextStep()}>{step===steps.length-1?"Finish & Create Trip":"Next"} <Icon name="arrow-right"/></Button></div>
    </main>
  </div>;
}


function CommitmentsStep({ trip, errors, categoriesList, highlightId, lifeOps, installmentOps }) {
  const [part, setPart] = useState("bills");
  const lifeTotal = (trip.lifeCosts || []).filter(x=>x.enabled && !x.canPause).reduce((sum,x)=>sum+num(x.amountBase),0);
  const installmentsTotal = (trip.installments || []).filter(x=>x.enabled).reduce((sum,x)=>sum+num(x.monthlyBase),0);
  return <>
    <h2>3. Commitments</h2>
    <Info title="Bills and installments" icon="shield-check">Add bills or installments that continue while you are away. Trip costs come next.</Info>
    <div className="commitmentSummary">
      <div><span>Monthly bills</span><b>{money(lifeTotal, trip.baseCurrency)}</b><small>Rent, phone, family support, subscriptions.</small></div>
      <div><span>Installments</span><b>{money(installmentsTotal, trip.baseCurrency)}</b><small>Tabby, Tamara, loans, cards, education payments.</small></div>
    </div>
    <div className="commitmentSwitch">
      <button type="button" className={part==="bills"?"active":""} onClick={()=>setPart("bills")}><b>A</b> Monthly bills</button>
      <button type="button" className={part==="installments"?"active":""} onClick={()=>setPart("installments")}><b>B</b> Installments</button>
    </div>
    {part === "bills" ? <>
      <Info title="Monthly bills" icon="house">Bills you still pay from home: rent, phone, family support, subscriptions, or utilities.</Info>
      <CardManagers wizardMode type="life" trip={trip} errors={errors} categoriesList={categoriesList} highlightId={highlightId} {...lifeOps}/>
      <div className="subStepActions"><Button variant="soft" onClick={()=>setPart("installments")}>Next: Installments <Icon name="arrow-right"/></Button></div>
    </> : <>
      <Info title="Installments" icon="credit-card">Scheduled payments that repeat or still need tracking during the trip.</Info>
      <CardManagers wizardMode type="installments" trip={trip} errors={errors} categoriesList={categoriesList} highlightId={highlightId} {...installmentOps}/>
      <div className="subStepActions"><Button variant="soft" onClick={()=>setPart("bills")}><Icon name="arrow-left"/> Back to monthly bills</Button></div>
    </>}
  </>;
}

function StepRoute({trip, update, errors={}}) {
  return <><h2>1. Route & Dates</h2><Info title="Plan intent selected" icon="compass">{trip.tripPurpose || trip.tripType || "Short Trip"} · {trip.travelStyle || trip.comfortLevel || "Balanced"}. Safaryaty will adjust the plan based on your trip length.</Info>
    <RouteSelector trip={trip} update={update} errors={errors}/>
    <div className="formGrid"><Field label="Trip Name" name="name" error={errors.name}><Input value={trip.name} onChange={v=>update("name",v)}/></Field><Field label="Trip Mode"><Input value={tripLengthLabel(trip)} onChange={()=>{}}/></Field><Field label="Start Date" name="startDate" error={errors.startDate}><DateInput value={trip.startDate} min={todayISO()} onChange={v=>update("startDate",v)}/></Field><Field label="End Date" name="endDate" error={errors.endDate}><DateInput value={trip.endDate} min={trip.startDate || todayISO()} onChange={v=>update("endDate",v)}/></Field><Field label="Travelers" name="travelers" error={errors.travelers}><Input type="number" value={trip.travelers} onChange={v=>update("travelers",v)}/></Field><Field label="Comfort Level"><Select value={trip.comfortLevel} onChange={v=>update("comfortLevel",v)}><option>Survival</option><option>Balanced</option><option>Comfortable</option><option>Premium</option></Select></Field></div></>;
}
function CurrencyMetadataHint({ trip }) {
  const dest = country(trip.destinationInfo?.countryCode);
  const origin = country(trip.origin?.countryCode);
  const destProfile = countryProfile(trip.destinationInfo?.countryCode);
  const originProfile = countryProfile(trip.origin?.countryCode);
  return <div className="currencyMetadataHint">
    <div><span>{origin.flag || "🌍"}</span><b>{origin.currency}</b><small>Income default · {originProfile.region}</small></div>
    <Icon name="arrow-right"/>
    <div><span>{dest.flag || "🌍"}</span><b>{dest.currency}</b><small>Trip default · {destProfile.region} · {destProfile.costTier}</small></div>
  </div>;
}

function CurrencyQuickOptions({ trip, update, errors={} }) {
  const autoBase = country(trip.origin.countryCode).currency;
  const autoTrip = country(trip.destinationInfo.countryCode).currency;
  const currencyChoices = preferredCurrencyOptions(autoBase || trip.baseCurrency, autoTrip || trip.tripCurrency);
  const setPair = (base, target) => update("currencyPair", { incomeCurrency: base, tripCurrency: target });
  return <div className="currencyOptions compactCurrencyOptions">
    <div className="currencyOptionHead">
      <div><span className="currencySetupEyebrow">Plan currency</span><b>Use the destination currency by default</b><p>Change this only for a long, multi-country, or specially priced trip.</p></div>
      <Button variant="soft" onClick={() => setPair(autoBase, autoTrip)}><Icon name="magic"/> Reset to route</Button>
    </div>
    <CurrencyMetadataHint trip={trip}/>
    <div className="currencySelectGrid">
      <Field label="Income / savings currency" name="baseCurrency" error={errors.baseCurrency}>
        <Select value={trip.baseCurrency} onChange={v=>setPair(v, trip.tripCurrency)}>
          {currencyChoices.map(c=><option key={c} value={c}>{currencyLabel(c)}</option>)}
        </Select>
      </Field>
      <Field label="Trip-cost currency" name="tripCurrency" error={errors.tripCurrency}>
        <Select value={trip.tripCurrency} onChange={v=>setPair(trip.baseCurrency, v)}>
          {currencyChoices.map(c=><option key={c} value={c}>{currencyLabel(c)}</option>)}
        </Select>
      </Field>
    </div>
  </div>;
}

function MoneyBasics({trip, update, calc, errors={}, currencyRequest=null, currencyBusy="idle"}) {
  const [currencyOpen, setCurrencyOpen] = useState(!!trip.rateNeedsReview);
  const [currencyFocused, setCurrencyFocused] = useState(false);
  const currencyPanelRef = useRef(null);
  const requestBaselineRef = useRef("");
  useEffect(() => { if (trip.rateNeedsReview) setCurrencyOpen(true); }, [trip.rateNeedsReview]);
  useEffect(() => {
    if (!currencyRequest?.stamp) return;
    requestBaselineRef.current = `${trip.baseCurrency}|${trip.tripCurrency}|${trip.exchangeRate}`;
    setCurrencyOpen(true);
    setCurrencyFocused(true);
    setTimeout(() => {
      currencyPanelRef.current?.scrollIntoView({ behavior:"smooth", block:"center" });
      currencyPanelRef.current?.querySelector?.("select, button")?.focus?.();
    }, 120);
  }, [currencyRequest?.stamp]);
  useEffect(() => {
    if (!currencyFocused || currencyBusy !== "idle") return;
    const currentSignature = `${trip.baseCurrency}|${trip.tripCurrency}|${trip.exchangeRate}`;
    if (!requestBaselineRef.current || currentSignature === requestBaselineRef.current || trip.rateNeedsReview) return;
    const timer = setTimeout(() => { setCurrencyOpen(false); setCurrencyFocused(false); }, 650);
    return () => clearTimeout(timer);
  }, [trip.baseCurrency, trip.tripCurrency, trip.exchangeRate, trip.rateNeedsReview, currencyBusy, currencyFocused]);
  const reserveEnabled = !!trip.scenario?.reserveAfterTripBase;
  const rateLabel = trip.baseCurrency === trip.tripCurrency ? "Same currency" : `1 ${trip.baseCurrency} = ${num(trip.exchangeRate).toFixed(4)} ${trip.tripCurrency}`;
  return <div className="wizardMoneyLayout">
    {trip.rateNeedsReview && <Info tone="danger" title="Confirm the exchange rate" icon="currency-exchange">The route currency changed. Review the rate before continuing.</Info>}

    <Card className="moneyCoreCard">
      <div className="moneyCardHead"><div><span>Available now</span><h3>Money for this trip</h3></div><strong>{displayWhole(calc.availableLocal || 0, trip)}</strong></div>
      <div className="moneyCoreGrid">
        <Field label="Current savings" hint={trip.baseCurrency}><Input type="number" value={trip.startingSavingsBase} onChange={v=>update("startingSavingsBase",v)}/>{trip.baseCurrency !== trip.tripCurrency && <small className="currencyMiniNote">≈ {whole(baseToTrip(trip.startingSavingsBase, trip), trip.tripCurrency)}</small>}</Field>
        <Field label="Support money" hint={trip.tripCurrency}><Input type="number" value={trip.supportLocal} onChange={v=>update("supportLocal",v)}/>{trip.baseCurrency !== trip.tripCurrency && <small className="currencyMiniNote">≈ {money(num(trip.supportLocal) / Math.max(0.000001, num(trip.exchangeRate)), trip.baseCurrency)}</small>}</Field>
      </div>
    </Card>

    <Card className="safetyReserveCard compactSafetyReserve">
      <div className="moneyCardHead"><div><span>After the trip</span><h3>Safety reserve</h3></div><small>{reserveEnabled ? `${money(trip.scenario?.reserveAmountBase || 0, trip.baseCurrency)} protected` : "Optional"}</small></div>
      <div className="reserveCompactGrid">
        <Toggle label="Keep money untouched" hint="Protect part of your savings after you return." checked={reserveEnabled} onChange={v=>update("scenarioReserveEnabled",v)}/>
        {reserveEnabled && <Field label="Reserve amount" hint={trip.baseCurrency}><Input type="number" value={trip.scenario?.reserveAmountBase ?? 0} onChange={v=>update("scenarioReserveAmount",v)}/></Field>}
        <Toggle label="Returning with zero is acceptable" hint="Turn off to keep a minimum buffer after travel." checked={trip.returnWithZero} onChange={v=>update("returnWithZero",v)}/>
      </div>
    </Card>

    <details ref={currencyPanelRef} data-currency-setup="true" className={`currencyAdvancedPanel ${currencyFocused ? "deepLinkFocus" : ""}`} open={currencyOpen} onToggle={e=>setCurrencyOpen(e.currentTarget.open)}>
      <summary><span><Icon name="currency-exchange"/><b>Currency setup</b><small><strong>{trip.baseCurrency}</strong> income → <strong>{trip.tripCurrency}</strong> trip costs · {rateLabel}</small></span><em>{trip.rateNeedsReview ? "Review" : "Ready"}</em><Icon name="chevron-down"/></summary>
      <div className="currencyAdvancedBody">
        <CurrencyQuickOptions trip={trip} update={update} errors={errors}/>
        <RateControl trip={trip} update={update} error={errors.exchangeRate}/>
        <p className="currencySingleOwnerNote">This is the only place that changes plan currencies. Dashboard display currency changes presentation only.</p>
      </div>
    </details>
  </div>;
}

function Review({trip, calc, recs, mi}) {
  const status = canTravel(trip, calc);
  const need = Math.max(0, calc.needToSaveLocal ?? (calc.plannedLocal - calc.availableLocal));
  const events = [
    { icon:"speedometer2", title:"Score calculated", text:`${status.readiness}/100 · ${status.label}.` },
    { icon:"wallet2", title:"Ready money", text:`${displayWhole(calc.availableLocal, trip)} available for this plan.` },
    { icon: need > 0 ? "bullseye" : "check-circle", title:"Saving gap", text: need > 0 ? `${displayWhole(need, trip)} still needed.` : "No saving gap detected." },
    { icon:"credit-card", title:"Payment timing", text: calc.nextPayment ? `Next: ${calc.nextPayment.name} · ${calc.nextPayment.date}.` : "No upcoming payment detected." },
    { icon:"lightbulb", title:"Next action", text: status.nextAction?.label || "Keep tracking payments until travel." }
  ];
  const topRecs = recs.slice(0,3);
  return <div className="reviewExperience">
    <h2>5. Travel Decision</h2>
    <div className={`reviewHero ${status.key}`}>
      <div className="reviewScoreReveal">
        <span>Can you travel?</span>
        <b style={{"--score": `${status.readiness}%`}}>{status.readiness}<small>/100</small></b>
        <div className="reviewProgress"><i style={{width:`${status.readiness}%`}}/></div>
      </div>
      <div>
        <span className="reviewVerdict">{status.label}</span>
        <h3>{status.title}</h3>
        <p>{status.detail}</p>
        <strong><Icon name="lightning-charge"/> {status.nextAction?.label || "Track payments until travel"}</strong>
      </div>
    </div>
    <div className="reviewEventTimeline">
      {events.map((e,i)=><div className="reviewEvent" key={e.title} style={{animationDelay:`${i*90}ms`}}>
        <span><Icon name={e.icon}/></span>
        <div><b>{e.title}</b><p>{e.text}</p></div>
      </div>)}
    </div>
    <div className="reviewKeyAdvice">
      <span>Top points</span>
      <div>{topRecs.map((r,i)=><div key={r.id || i} className={`reviewAdvice ${r.level || "info"}`}><b>{i+1}</b><p><strong>{r.title || r.label}</strong><br/>{r.detail}</p></div>)}</div>
    </div>
    <details className="homeAnalysis reviewAnalysis">
      <summary>View full analysis</summary>
      <div className="miniGrid"><Mini label="Route" value={route(trip)}/><Mini label="Ready Money" value={displayWhole(calc.availableLocal,trip)}/><Mini label="Need to Save" value={displayWhole(need,trip)}/></div>
      <Recs recs={recs} compact/>
    </details>
  </div>;
}

function AdvancedCashflow({ t, c }) {
  return <Card><h2>Cashflow Summary</h2><Info title="Advanced view" icon="activity">Detailed cashflow generated from income, monthly payments, installments, and trip costs.</Info><div className="tableWrap"><table><thead><tr><th>Date</th><th>Period</th><th>Type</th><th>Source</th><th>Name</th><th>Amount</th><th>Note</th></tr></thead><tbody>{c.cashflow.map(r=><tr key={r.id}><td>{r.date}</td><td>{r.period}</td><td><span className={`pill ${r.type}`}>{r.type}</span></td><td>{r.source}</td><td>{r.name}</td><td>{money(r.amount,t.baseCurrency)}</td><td>{r.note}</td></tr>)}</tbody></table></div></Card>;
}
function Trips({ trips, activeId, setActive, archive, restore, deleteTrip, showArchived, setShowArchived, showDrafts=false, setShowDrafts=()=>{}, drafts=[], resumeDraft=()=>{}, discardDraft=()=>{}, addTrip=()=>{} }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const activeTrips = trips.filter(t => !t.archived);
  const archivedTrips = trips.filter(t => t.archived);
  const baseShown = showDrafts ? drafts : (showArchived ? archivedTrips : activeTrips);
  const shown = baseShown
    .filter(t => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      const text = `${t.name || ""} ${route(t)} ${routeFull(t)} ${t.tripPurpose || ""} ${t.tripType || ""} ${t.startDate || ""} ${t.endDate || ""}`.toLowerCase();
      return text.includes(q);
    })
    .sort((a,b) => {
      if (sort === "date") return String(a.startDate || "").localeCompare(String(b.startDate || ""));
      if (sort === "score") return calculate(b).readiness - calculate(a).readiness;
      if (sort === "need") return calculate(b).stillNeededLocal - calculate(a).stillNeededLocal;
      return String(b.updatedAt || b.createdAt || b.id || "").localeCompare(String(a.updatedAt || a.createdAt || a.id || ""));
    });

  return <div className="tripsPage">
    <div className="tripsHeader tripsHeaderPolished">
      <div>
        <span className="eyebrow">Travel plans</span>
        <h2>My Trips</h2>
        <p>Open, continue, archive, or create a new travel plan.</p>
      </div>
      <div className="tripsHeaderActions">
        <Button variant="light" onClick={addTrip}><Icon name="plus-lg"/> Add Trip</Button>
      </div>
    </div>
    <div className="tripsHeader tripFiltersRow">
      <div className="tripSegment">
        <button className={!showArchived && !showDrafts ? "active" : ""} onClick={()=>{setShowArchived(false);setShowDrafts(false);}}><Icon name="airplane"/> Active <b>{activeTrips.length}</b></button>
        <button className={showDrafts ? "active" : ""} onClick={()=>{setShowArchived(false);setShowDrafts(true);}}><Icon name="file-earmark-text"/> Drafts <b>{drafts.length}</b></button>
        <button className={showArchived ? "active" : ""} onClick={()=>{setShowArchived(true);setShowDrafts(false);}}><Icon name="archive"/> Archived <b>{archivedTrips.length}</b></button>
      </div>
      <div className="tripSearchTools">
        <Input value={query} placeholder="Search trips, country, airport..." onChange={setQuery}/>
        <Select value={sort} onChange={setSort}><option value="newest">Newest</option><option value="date">Travel date</option><option value="score">Readiness score</option><option value="need">Need to save</option></Select>
      </div>
    </div>

    {shown.length === 0 && <div className="emptyState">
      <Icon name={showDrafts ? "file-earmark-text" : showArchived ? "archive" : "airplane"} />
      <b>{query ? "No trips match your search" : showDrafts ? "No drafts yet" : showArchived ? "No archived trips yet" : "No active trips"}</b>
      <p>{query ? "Try a trip name, country, airport code, or route." : showDrafts ? "Unfinished wizard trips will appear here." : showArchived ? "Archived trips will appear here before permanent deletion." : "Create or restore a trip to continue planning."}</p>{!showDrafts && !showArchived && <Button variant="light" onClick={addTrip}><Icon name="plus-lg"/> Add Trip</Button>}
    </div>}

    <div className="tripGrid appTrips">
      {shown.map(t=>{
        const c=calculate(t);
        const active=t.id===activeId;
        const rateInvalid = t.baseCurrency !== t.tripCurrency && (t.rateNeedsReview || num(t.exchangeRate) <= 0);
        return <Card key={t.id} className={`trip appTrip ${active ? "active" : ""} ${rateInvalid ? "rateInvalid" : ""}`}>
          <button className="tripMain" onClick={()=>setActive(t.id)}>
            <div className="tripTop">
              <div>
                <h3>{t.name}</h3>
                <p>{t.tripPurpose || t.tripType || "Trip"} · {route(t)} · {routeFull(t)}</p>
              </div>
              {active && <span className="activeBadge">Current</span>}
              {rateInvalid && <span className="dangerBadge">Rate Required</span>}
            </div>
            <div className="tripMeta">
              <span><Icon name="calendar"/> {t.startDate} → {t.endDate}</span>
              <span><Icon name="currency-exchange"/> {t.baseCurrency} → {t.tripCurrency}</span>
              <span><Icon name="people"/> {t.travelers} traveler(s)</span>
            </div>
            <div className="tripStats">
              <Mini label="Cash" value={whole(c.availableLocal,t.tripCurrency)}/>
              <Mini label="Need" value={whole(c.stillNeededLocal,t.tripCurrency)}/>
              <Mini label="Readiness" value={`${c.readiness}/100`}/>
            </div>
          </button>
          <div className="tripActions">
            {showDrafts && <Button variant="soft" onClick={()=>resumeDraft(t.id)}><Icon name="magic"/> Resume Draft</Button>}
            {showDrafts && <Button variant="danger" onClick={()=>discardDraft(t.id)}><Icon name="trash3"/> Discard</Button>}
            {!showDrafts && !t.archived && <Button variant="soft" onClick={()=>archive(t.id)}><Icon name="archive"/> Archive</Button>}
            {!showDrafts && t.archived && <Button variant="soft" onClick={()=>restore(t.id)}><Icon name="arrow-counterclockwise"/> Restore</Button>}
            {!showDrafts && t.archived && <Button variant="danger" onClick={()=>deleteTrip(t.id)}><Icon name="trash3"/> Delete</Button>}
          </div>
        </Card>
      })}
    </div>
  </div>;
}


function AdminPanel({ trips }) {
  const [users, setUsers] = useState([]);
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState("");
  const [countryData, setCountryData] = useState(null);
  const [countrySyncing, setCountrySyncing] = useState(false);
  const [fxData, setFxData] = useState(null);
  const [fxBase, setFxBase] = useState("AED");
  const [fxSyncing, setFxSyncing] = useState(false);
  const load = async () => {
    setState("loading");
    setMessage("");
    try {
      const [userResult, countryResult, fxResult] = await Promise.all([api.adminUsers(), api.getCountries(), api.getRate(fxBase, "USD")]);
      setUsers(userResult.users || []);
      setCountryData(countryResult || null);
      setFxData(fxResult || null);
      setState("ready");
    } catch (error) {
      setMessage(error.message || "Admin data failed to load.");
      setState("error");
    }
  };
  const syncCountries = async () => {
    setCountrySyncing(true);
    setMessage("");
    try {
      const result = await api.syncCountries();
      setCountryData(result || null);
      setMessage(`Country metadata refreshed from ${result.source || "provider"}.`);
    } catch (error) {
      setMessage(error.message || "Country sync failed.");
    } finally {
      setCountrySyncing(false);
    }
  };
  const syncFx = async () => {
    setFxSyncing(true);
    setMessage("");
    try {
      await api.syncFx(fxBase);
      const result = await api.getRate(fxBase, fxBase === "USD" ? "EUR" : "USD", { refresh: true });
      setFxData(result || null);
      setMessage(`FX snapshot refreshed for ${fxBase}.`);
    } catch (error) {
      setMessage(error.message || "FX sync failed.");
    } finally {
      setFxSyncing(false);
    }
  };
  useEffect(() => { load(); }, []);
  const activeTrips = trips.filter(t => !t.archived).length;
  const drafts = trips.filter(t => t.draft).length;
  const countryCount = countryData?.data?.length || countries.length;
  return <section className="adminConsole">
    <div className="adminHero">
      <div><span className="eyebrow">Admin Console</span><h2>System overview</h2><p>RBAC is active. Country metadata is served from a persistent backend snapshot with a bundled fallback.</p></div>
      <Button variant="light" onClick={load}><Icon name="arrow-repeat"/> Refresh</Button>
    </div>
    {message && <div className="authError"><Icon name="info-circle"/> {message}</div>}
    <div className="adminStats">
      <Mini label="Users" value={state === "loading" ? "..." : users.length}/>
      <Mini label="Trips" value={trips.length}/>
      <Mini label="Active" value={activeTrips}/>
      <Mini label="Drafts" value={drafts}/>
      <Mini label="Countries" value={countryCount}/>
      <Mini label="Airports" value={airports.length}/>
    </div>
    <div className="adminExternalGrid">
      <Card className="externalDataAdminCard">
        <div className="sectionHead compact"><div><span>External data</span><h3>Country metadata snapshot</h3><p>{countryData ? `${countryData.source} · ${countryData.stale ? "stale" : "fresh"} · fetched ${countryData.fetchedAt || "unknown"}` : "Loading snapshot status..."}</p></div><Button onClick={syncCountries} disabled={countrySyncing}><Icon name="cloud-arrow-down"/> {countrySyncing ? "Syncing..." : "Force sync"}</Button></div>
        {countryData?.notes?.length > 0 && <div className="externalNotes">{countryData.notes.map((note,index)=><span key={`${note}-${index}`}>{note}</span>)}</div>}
      </Card>
      <Card className="externalDataAdminCard">
        <div className="sectionHead compact"><div><span>External data</span><h3>FX snapshot</h3><p>{fxData ? `${fxData.source} · ${fxData.stale ? "stale" : "fresh"} · ${fxData.confidence || "medium"} confidence` : "Loading FX snapshot status..."}</p></div><Button onClick={syncFx} disabled={fxSyncing}><Icon name="currency-exchange"/> {fxSyncing ? "Syncing..." : "Force sync"}</Button></div>
        <div className="fxAdminRow"><Field label="Base currency"><Select value={fxBase} onChange={setFxBase}>{["AED","USD","EUR","EGP","GEL","SAR"].map(c=><option key={c}>{c}</option>)}</Select></Field><Mini label="Sample rate" value={fxData ? `1 ${fxData.from} = ${Number(fxData.rate).toFixed(4)} ${fxData.to}` : "—"}/><Mini label="Source date" value={fxData?.sourceAsOf || "—"}/></div>
      </Card>
    </div>
    <Card>
      <h3>Users</h3>
      <div className="tableWrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Plan</th></tr></thead><tbody>{users.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td>{u.plan}</td></tr>)}</tbody></table></div>
    </Card>
  </section>;
}

function CategoriesView({ cats, add, update }) {
  return <Card><h2>Category Settings</h2><Info title="Advanced only" icon="tags">Beginner users should use Other. Power users can add categories here.</Info><Button onClick={add}><Icon name="plus-lg"/> Add Category</Button><div className="tableWrap"><table><thead><tr><th>Name</th><th>Type</th></tr></thead><tbody>{cats.map(c=><tr key={c.id}><td><Input value={c.name} onChange={v=>update(c.id,"name",v)}/></td><td><Select value={c.type} onChange={v=>update(c.id,"type",v)}><option value="life">Life</option><option value="trip">Trip</option><option value="income">Income</option></Select></td></tr>)}</tbody></table></div></Card>;
}
function ProfilePanel({ user, updateUser }) {
  const [profile, setProfile] = useState(user || defaultUserProfile);
  const [avatarFile, setAvatarFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => setProfile(user || defaultUserProfile), [user]);
  const set = (field, value) => setProfile(p => ({ ...p, [field]: value }));
  const save = async () => {
    setBusy(true);
    setMessage("");
    try {
      const updated = await api.updateProfile(toProfilePayload(profile));
      let nextUser = normalizeBackendUser(updated.user);
      if (avatarFile) {
        const upload = await api.uploadAvatar(avatarFile);
        nextUser = normalizeBackendUser(upload.user || { ...updated.user, profileImage: upload.profileImage });
      }
      if (profile.currentPassword && profile.newPassword) {
        await api.changePassword({ currentPassword: profile.currentPassword, newPassword: profile.newPassword });
      }
      updateUser({ ...nextUser, currentPassword: "", newPassword: "" });
      setAvatarFile(null);
      setMessage("Travel profile saved.");
    } catch (err) {
      setMessage(err.message || "Profile save failed.");
    } finally {
      setBusy(false);
    }
  };
  const onAvatar = (file) => {
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => set("avatar", reader.result);
    reader.readAsDataURL(file);
  };
  return <section className="profilePage">
    <Card className="profileHero">
      <div className="avatarBox">{profile.avatar ? <img src={profile.avatar} alt="Profile"/> : <Icon name="person-circle"/>}</div>
      <div>
        <h2>Profile & Preferences</h2>
        <p>Your travel profile helps Safaryaty suggest better currencies, routes, and planning defaults.</p>
      </div>
    </Card>
    <Card>
      {message && <div className="authError neutral"><Icon name="info-circle"/> {message}</div>}
      <div className="formGrid">
        <Field label="Profile Photo"><input className="input" type="file" accept="image/*" onChange={e=>onAvatar(e.target.files?.[0])}/></Field>
        <Field label="Name"><Input value={profile.name} onChange={v=>set("name",v)}/></Field>
        <Field label="Email"><Input value={profile.email} onChange={v=>set("email",v)}/></Field>
        <Field label="Country of Residence"><Select value={profile.residenceCountry} onChange={v=>set("residenceCountry",v)}>{countries.map(c=><option key={c.code} value={c.code}>{c.flag || "🌍"} {c.name}</option>)}</Select></Field>
        <Field label="Nationality"><Select value={profile.nationality} onChange={v=>set("nationality",v)}>{countries.map(c=><option key={c.code} value={c.code}>{c.flag || "🌍"} {c.name}</option>)}</Select></Field>
        <Field label="Preferred Currency"><Select value={profile.preferredCurrency} onChange={v=>set("preferredCurrency",v)}>{supportedCurrencies.map(c=><option key={c} value={c}>{currencyLabel(c)}</option>)}</Select></Field>
        <Field label="Language"><Select value={profile.language || "en"} onChange={v=>set("language",v)}>{languages.map(l=><option key={l.value} value={l.value}>{l.label}</option>)}</Select></Field>
        <Field label="Travel Frequency"><Select value={profile.travelFrequency} onChange={v=>set("travelFrequency",v)}>{travelFrequencies.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}</Select></Field>
        <Field label="Travel Purpose"><Select value={profile.travelPurpose} onChange={v=>set("travelPurpose",v)}>{travelPurposes.map(x=><option key={x}>{x}</option>)}</Select></Field>
        <Field label="Default Style"><Select value={profile.defaultTravelStyle} onChange={v=>set("defaultTravelStyle",v)}><option>Survival</option><option>Balanced</option><option>Comfortable</option><option>Premium</option></Select></Field>
        <Field label="Current Password"><Input type="password" value={profile.currentPassword || ""} onChange={v=>set("currentPassword",v)} placeholder="Only if changing password"/></Field>
        <Field label="New Password"><Input type="password" value={profile.newPassword || ""} onChange={v=>set("newPassword",v)} placeholder="Minimum 8 characters"/></Field>
      </div>
      <div className="profileActions"><Button disabled={busy} onClick={save}><Icon name="check2"/> {busy ? "Saving..." : "Save Profile"}</Button></div>
      <small className="authNote">Photo, profile and password now go through backend API.</small>
    </Card>
  </section>;
}

function NewTrip({open,onClose,create,duplicate}) {
  const [style,setStyle]=useState("Balanced");
  return <Modal size="compact" open={open} onClose={onClose} title="What are you planning?" subtitle="Choose the purpose first. Safaryaty will use dates later to decide short, monthly, or hybrid planning.">
    <div className="styleStrip intentStyle"><div><b>Travel style</b><small>This controls future estimates and suggestions.</small></div>{["Survival","Budget","Balanced","Comfortable","Premium"].map(x=><button key={x} type="button" className={style===x?"active":""} onClick={()=>setStyle(x)}>{x}</button>)}</div>
    <div className="purposeGrid intentGrid">{tripPurposes.map(p=><button type="button" key={p.value} className="purposeCard" onClick={()=>create(p.title === "Short Trip" ? "My Trip" : `${p.title} Plan`, p.value, style)}><Icon name={p.icon}/><b>{p.title}</b><small>{p.note}</small></button>)}<button type="button" className="purposeCard duplicateIntent" onClick={duplicate}><Icon name="copy"/><b>Duplicate Current</b><small>Use current route, costs, and settings as a base.</small></button></div>
  </Modal>;
}

function formatAuthError(err, fallback) {
  const msg = err?.message || fallback;
  if (msg === "Failed to fetch" || msg.includes("Failed to fetch")) return "Backend is not reachable. Keep backend running on 127.0.0.1:4000, then try again.";
  return msg;
}

function AuthScreen({ onLogin, initialMode="entry", reason="", onDemo=null, language="en", setLanguage=()=>{} }) {
  const safeInitial = ["entry","login","register"].includes(initialMode) ? initialMode : "entry";
  const [mode, setMode] = useState(safeInitial);
  const [profile, setProfile] = useState({ ...defaultUserProfile, password:"" });
  const [login, setLogin] = useState({ email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (field, value) => setProfile(p => ({ ...p, [field]: value }));
  const go = (nextMode) => { setError(""); setMode(nextMode); };
  const register = async () => {
    setError("");
    if (!profile.name || !profile.email || !profile.password) { setError("Name, email and password are required."); return; }
    if (profile.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    setBusy(true);
    try {
      const cleanProfile = {
        ...profile,
        nationality: profile.nationality || profile.residenceCountry,
        travelFrequency: profile.travelFrequency || "sometimes",
        travelPurpose: profile.travelPurpose || "Leisure",
        defaultTravelStyle: profile.defaultTravelStyle || "Balanced"
      };
      const result = await api.register(toRegisterPayload(cleanProfile));
      onLogin(normalizeBackendUser(result.user));
    } catch (err) {
      setError(formatAuthError(err, "Registration failed."));
    } finally {
      setBusy(false);
    }
  };
  const signIn = async () => {
    setError("");
    if (!login.email || !login.password) { setError("Email and password are required."); return; }
    setBusy(true);
    try {
      const result = await api.login(login);
      onLogin(normalizeBackendUser(result.user));
    } catch (err) {
      setError(formatAuthError(err, "Login failed."));
    } finally {
      setBusy(false);
    }
  };
  return <div className="authPage authFunnel"><Card className="authCard authShell">
    <div className="authTopLine"><div className="brand dark"><span><Icon name="compass"/></span><b>Safaryaty</b><small>سفرياتي</small></div><LanguageSwitch language={language} setLanguage={setLanguage}/></div>
    {reason && mode !== "entry" && <div className="saveReason"><Icon name="shield-check"/> {reason}</div>}
    {mode === "entry" ? <div className="authLandingGrid">
      <section className="authLandingCopy">
        <span className="eyebrow"><Icon name="stars"/> Travel decision assistant</span>
        <h1>Plan smarter before you pay.</h1>
        <p>Build a quick plan, see if your money and payment timing are ready, then save it when the plan makes sense.</p>
        {reason && <div className="saveReason compact"><Icon name="shield-check"/> {reason}</div>}
        <div className="authPrimaryActions">
          {onDemo && <button className="authDemoPrimary" type="button" onClick={onDemo}><Icon name="play-circle"/> Start demo <small>No account needed</small></button>}
          <button className="authCreatePrimary" type="button" onClick={()=>go("register")}><Icon name="person-plus"/> Create account</button>
          <button className="authSigninLink" type="button" onClick={()=>go("login")}><Icon name="box-arrow-in-right"/> I already have an account</button>
        </div>
      </section>
      <aside className="authPreviewCard">
        <span>Preview</span>
        <h3>Can you travel?</h3>
        <strong>Almost ready · 76/100</strong>
        <p>Need to save: 420 AED</p>
        <small>Next action: track payments until travel.</small>
      </aside>
    </div> : <>
      <button className="authBackBtn" type="button" onClick={()=>go("entry")}><Icon name="arrow-left"/> Back to start</button>
      <div className="authIntro compactAuthIntro"><div className="authIcon"><Icon name={mode === "login" ? "box-arrow-in-right" : "person-plus"}/></div><div><h1>{mode === "login" ? "Welcome back" : "Create your account"}</h1><p>{mode === "login" ? "Sign in to continue your saved trips." : "Keep it quick. You can complete your travel profile later."}</p></div></div>
      <div className="authSwitch"><button className={mode === "login" ? "active" : ""} onClick={()=>go("login")}>Sign in</button><button className={mode === "register" ? "active" : ""} onClick={()=>go("register")}>Create account</button></div>
      <div className="socialAuthStack"><button className="googleAuthBtn" type="button" onClick={()=>{ window.location.href = googleAuthStartUrl(); }}><Icon name="google"/> Continue with Google</button></div>
      {error && <div className="authError"><Icon name="exclamation-circle"/> {error}</div>}
      {mode === "login" ? <div className="formGrid singleAuth authFormGrid">
        <Field label="Email"><Input value={login.email} onChange={v=>setLogin(x=>({...x,email:v}))} placeholder="email@example.com"/></Field>
        <Field label="Password"><Input type="password" value={login.password} onChange={v=>setLogin(x=>({...x,password:v}))} placeholder="Your password"/></Field>
        <Button disabled={busy} onClick={signIn}><Icon name="box-arrow-in-right"/> {busy ? "Signing in..." : "Sign in"}</Button>
      </div> : <div className="formGrid authFormGrid">
        <Field label="Name"><Input value={profile.name} onChange={v=>set("name",v)} placeholder="Your name"/></Field>
        <Field label="Email"><Input value={profile.email} onChange={v=>set("email",v)} placeholder="email@example.com"/></Field>
        <Field label="Password"><Input type="password" value={profile.password || ""} onChange={v=>set("password",v)} placeholder="Minimum 8 characters"/></Field>
        <Field label="Country"><Select value={profile.residenceCountry} onChange={v=>{set("residenceCountry",v); set("nationality",v); set("preferredCurrency",country(v).currency);}}>{countries.map(c=><option key={c.code} value={c.code}>{c.flag || "🌍"} {c.name}</option>)}</Select></Field>
        <Field label="Preferred Currency"><Select value={profile.preferredCurrency} onChange={v=>set("preferredCurrency",v)}>{supportedCurrencies.map(c=><option key={c} value={c}>{currencyLabel(c)}</option>)}</Select></Field>
        <Field label="Language"><Select value={profile.language} onChange={v=>set("language",v)}>{languages.map(l=><option key={l.value} value={l.value}>{l.label}</option>)}</Select></Field>
        <Button disabled={busy} onClick={register}><Icon name="person-plus"/> {busy ? "Creating account..." : "Create account"}</Button>
      </div>}
      {onDemo && <button className="demoEntryBtn subtle" type="button" onClick={onDemo}><Icon name="eye"/> Try demo instead</button>}
      <small className="authNote">Your trip can be saved after the demo. Profile details are completed later from Travel Profile.</small>
    </>}
  </Card></div>;
}

function EmptyDashboard({ user, createFirstTrip, createDemoTrip, resumeDraft, discardDraft, hasDraft, language="en" }) {
  return <div className="emptyDashboard compactStart">
    <Card className="emptyHero">
      <span>{hasDraft ? "Continue your plan" : "Start with intent"}</span>
      <h2>{hasDraft ? "Draft trip in progress" : "Choose the trip type first"}</h2>
      <p>{hasDraft ? "Resume the wizard and finish this plan, or discard it and start fresh." : "No long onboarding. Pick the trip purpose, then Safaryaty handles route, money, currency, and suggestions step by step."}</p>
      <div className="emptyActions">
        {hasDraft ? <><Button onClick={resumeDraft}><Icon name="magic"/> Resume Wizard</Button><Button variant="soft" onClick={discardDraft}><Icon name="trash3"/> Discard Draft</Button></> : <Button onClick={createFirstTrip}><Icon name="plus-lg"/> {langText(language,"newTrip")}</Button>}
        <Button variant="soft" onClick={createDemoTrip}><Icon name="eye"/> Try Demo</Button>
      </div>
    </Card>
  </div>;
}

function guestUser() {
  return {
    id: "guest",
    name: "Demo Traveler",
    email: "",
    avatar: "",
    residenceCountry: "AE",
    nationality: "AE",
    preferredCurrency: "AED",
    language: "en",
    travelFrequency: "trying",
    travelPurpose: "Demo",
    defaultTravelStyle: "Balanced",
    role: "GUEST",
    plan: "DEMO",
    isGuest: true
  };
}
function guestState() {
  const user = guestUser();
  const demo = createDemoPreview(user);
  return { user, trips:[demo], drafts:[], activeId:demo.id, mode:"beginner", cats:categories };
}
const pendingGuestTripKey = "safaryaty-v4:pending-guest-trip";
function savePendingGuestTrip(trip) {
  if (!trip) return sessionStorage.removeItem(pendingGuestTripKey);
  sessionStorage.setItem(pendingGuestTripKey, JSON.stringify(trip));
}
function loadPendingGuestTrip() {
  try { return JSON.parse(sessionStorage.getItem(pendingGuestTripKey) || "null"); } catch { return null; }
}
function clearPendingGuestTrip() { sessionStorage.removeItem(pendingGuestTripKey); }
function authRequiredMessage(action="save this plan") {
  return `Create a free account to ${action} and continue later.`;
}

function App() {
  const [state, setState] = useState(() => ({ user:null, trips:[], drafts:[], activeId:null, mode:"beginner", cats: categories }));
  const [authLoading, setAuthLoading] = useState(true);
  const [appLanguage,setAppLanguage]=useState(()=>localStorage.getItem("safaryaty-language") || "en");
  const [authMessage, setAuthMessage] = useState("Checking session...");
  const [authPrompt,setAuthPrompt]=useState(false);
  const [authReason,setAuthReason]=useState(authRequiredMessage("save your trip"));
  const [authOnly,setAuthOnly]=useState(false);
  const [draftTrip,setDraftTrip]=useState(null);
  const [tab,setTab]=useState("overview");
  const [wizard,setWizard]=useState(false);
  const [newTrip,setNewTrip]=useState(false);
  const [showArchived,setShowArchived]=useState(false);
  const [showDrafts,setShowDrafts]=useState(false);
  const { current: notification, notify, dismiss: dismissNotification, clear: clearNotifications } = useNotificationCenter();
  const notifySuccess = (title, detail = "", options = {}) => notify({ type:"success", title, detail, ...options });
  const notifyInfo = (title, detail = "", options = {}) => notify({ type:"info", title, detail, ...options });
  const notifyWarning = (title, detail = "", options = {}) => notify({ type:"warning", title, detail, ...options });
  const notifyError = (title, detail = "", options = {}) => notify({ type:"error", title, detail, ...options });
  const notifyUndo = (title, detail = "", options = {}) => notify({ type:"undo", title, detail, ...options });
  const [highlightId,setHighlightId]=useState("");
  const [coachFocus,setCoachFocus]=useState({ tab:"", categoryId:"", stamp:0 });
  const [wizardNavigation,setWizardNavigation]=useState(null);
  const [validationErrors,setValidationErrors]=useState([]);
  const [backendSummary,setBackendSummary]=useState(null);
  const [summaryState,setSummaryState]=useState("idle");
  const [backendRecommendations,setBackendRecommendations]=useState(null);
  const [recommendationState,setRecommendationState]=useState("idle");
  const [pendingGuestTrip,setPendingGuestTrip]=useState(null);
  const [currencyChangeState,setCurrencyChangeState]=useState("idle");
  const syncTimers = useRef({});
  const flags = featureFlags(state.user);
  const isGuest = !!state.user?.isGuest;

  useEffect(()=>{
    localStorage.setItem("safaryaty-language", appLanguage);
    document.documentElement.lang = appLanguage;
    document.documentElement.dir = appLanguage === "ar" ? "rtl" : "ltr";
    document.body.classList.toggle("rtl", appLanguage === "ar");
  },[appLanguage]);

  useEffect(() => {
    let alive = true;
    api.me()
      .then(async result => {
        if (!alive) return;
        const user = normalizeBackendUser(result.user);
        setAuthMessage("Loading your trips...");
        let nextState = await loadBackendUserState(user);
        const pending = loadPendingGuestTrip();
        if (pending) {
          try {
            const payload = { ...pending, backendId: undefined, id: uid("trip"), draft: false, archived: false };
            const created = await api.createTrip(payload, "ACTIVE");
            const saved = backendTripToClient(created.trip);
            nextState = { ...nextState, trips: [saved, ...(nextState.trips || [])], activeId: saved.id };
            clearPendingGuestTrip();
            notifySuccess("Trip saved.");
          } catch (error) {
            console.warn("Pending guest trip migration after OAuth failed", error);
          }
        }
        if (alive) setState(nextState);
      })
      .catch(() => {
        if (!alive) return;
        setAuthOnly(true);
        setState({ user:null, trips:[], drafts:[], activeId:null, mode:"beginner", cats:categories });
      })
      .finally(() => alive && setAuthLoading(false));
    return () => { alive = false; };
  }, []);

  const startDemo = () => {
    setAuthOnly(false);
    setAuthPrompt(false);
    setDraftTrip(null);
    setBackendSummary(null);
    setSummaryState("idle");
    setBackendRecommendations(null);
    setRecommendationState("idle");
    setPendingGuestTrip(null);
    clearPendingGuestTrip();
    setState(guestState());
  };

  const logout = async () => {
    try { await api.logout(); } catch {}
    localStorage.removeItem(sessionStorageKey());
    setDraftTrip(null);
    setBackendSummary(null);
    setSummaryState("idle");
    setBackendRecommendations(null);
    setRecommendationState("idle");
    setPendingGuestTrip(null);
    clearPendingGuestTrip();
    setAuthPrompt(false);
    setAuthOnly(true);
    setState({ user:null, trips:[], drafts:[], activeId:null, mode:"beginner", cats:categories });
  };


  const handleAuthSuccess = async (user) => {
    const nextState = await loadBackendUserState(user);
    const candidates = [];
    const storedPending = loadPendingGuestTrip();
    if (pendingGuestTrip) candidates.push(clone(pendingGuestTrip));
    if (storedPending && !candidates.some(x => x.id === storedPending.id)) candidates.push(clone(storedPending));
    if (draftTrip && !candidates.some(x => x.id === draftTrip.id)) candidates.push(clone(draftTrip));
    const activeLocal = state.trips?.find(t => t.id === state.activeId);
    if (activeLocal && !activeLocal.id?.startsWith("demo") && !candidates.some(x => x.id === activeLocal.id)) candidates.push(clone(activeLocal));
    const migratedTrips = [];
    const migratedDrafts = [];
    for (const local of candidates) {
      try {
        const payload = { ...local, backendId: undefined, id: uid("trip"), draft: !!local.draft, archived: !!local.archived };
        const result = await api.createTrip(payload, payload.draft ? "DRAFT" : "ACTIVE");
        const saved = backendTripToClient(result.trip);
        if (saved.draft) migratedDrafts.push(saved); else migratedTrips.push(saved);
      } catch (error) {
        console.warn("Guest trip migration failed", error);
      }
    }
    const trips = [...migratedTrips, ...(nextState.trips || [])];
    const drafts = [...migratedDrafts, ...(nextState.drafts || [])];
    const activeId = migratedTrips[0]?.id || trips[0]?.id || nextState.activeId || null;
    setPendingGuestTrip(null);
    clearPendingGuestTrip();
    setDraftTrip(null);
    setBackendSummary(null);
    setSummaryState("idle");
    setAuthPrompt(false);
    setAuthOnly(false);
    setNewTrip(false);
    setWizard(false);
    setTab("overview");
    setState({ ...nextState, trips, drafts, activeId });
    if (activeId) setTimeout(() => refreshBackendSummary(activeId), 250);
    notifySuccess(migratedTrips.length ? "Account ready. Trip saved." : "Account ready.");
  };

  useEffect(() => { if (state.user?.language) setAppLanguage(state.user.language); }, [state.user?.language]);
  useEffect(() => { if (highlightId) document.getElementById(`card-${highlightId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [highlightId]);

  useEffect(()=>{ if (state.user) { localStorage.setItem(userStorageKey(state.user), JSON.stringify({ trips: [], drafts: [], activeId: state.activeId, mode: state.mode, cats: state.cats })) } },[state.user, state.activeId, state.mode, state.cats]);
  const savedTrip = state.trips.find(t=>t.id===state.activeId) || state.trips.find(t=>!t.archived) || state.trips[0] || null;
  const wizardTrip = draftTrip || savedTrip;
  const trip = wizard && draftTrip ? draftTrip : savedTrip;
  const workingTrip = trip || wizardTrip || createBlankTrip(state.user);
  const localCalcData = useMemo(()=>calculate(workingTrip, { categoryName }),[workingTrip]);
  const calcData = useMemo(()=>mergeBackendSummary(backendSummary, localCalcData, workingTrip),[backendSummary, localCalcData, workingTrip]);
  const activeBackendId = savedTrip && !isGuest ? (savedTrip.backendId || savedTrip.id) : null;
  const localRecs = useMemo(()=>recommendations(workingTrip,calcData),[workingTrip,calcData]);
  const recs = useMemo(()=>activeBackendId && !wizard && recommendationState === "ready" && Array.isArray(backendRecommendations) && backendRecommendations.length
    ? backendRecommendations
    : localRecs,[activeBackendId,wizard,recommendationState,backendRecommendations,localRecs]);
  const miData = useMemo(()=>moneyIntelligence(workingTrip,calcData,recs),[workingTrip,calcData,recs]);
  const statusData = useMemo(()=>{
    const status = tripStatus(workingTrip,calcData);
    return { ...status, nextAction: recs[0] || status.nextAction };
  },[workingTrip,calcData,recs]);
  const applyBackendSummaryResult = (result) => {
    const summary = result?.summary || result;
    if (summary && (summary.payments || summary.events || summary.availableLocal !== undefined || summary.tripCostLocal !== undefined || summary.plannedLocal !== undefined)) {
      setBackendSummary(summary);
      setSummaryState("ready");
      return true;
    }
    return false;
  };

  const refreshBackendSummary = async (id = activeBackendId) => {
    if (!id || isGuest) return null;
    setSummaryState("loading");
    setRecommendationState("loading");
    try {
      const result = await api.getSummary(id);
      applyBackendSummaryResult(result);
      try {
        const recResult = await api.getTripRecommendations(id);
        setBackendRecommendations(recResult.recommendations || []);
        setRecommendationState("ready");
      } catch (recommendationError) {
        console.warn("Backend recommendations unavailable; using shared local engine", recommendationError);
        setBackendRecommendations(null);
        setRecommendationState("fallback");
      }
      return result.summary || result;
    } catch (error) {
      console.warn("Backend summary unavailable", error);
      setBackendSummary(null);
      setSummaryState("fallback");
      setBackendRecommendations(null);
      setRecommendationState("fallback");
      return null;
    }
  };

  useEffect(() => {
    if (!activeBackendId || wizard) { if (!activeBackendId) { setBackendSummary(null); setBackendRecommendations(null); setRecommendationState("idle"); } return; }
    refreshBackendSummary(activeBackendId);
  }, [activeBackendId, workingTrip?.displayCurrency]);

  const openFullWizard = () => {
    setWizardNavigation(null);
    setWizard(true);
  };

  const openCurrencySetup = () => {
    setWizardNavigation({ target:"currency", step:1, stamp:Date.now() });
    setWizard(true);
    clearNotifications();
  };

  const followCoachAction = (action) => {
    const target = action?.target || {};
    if (target.section === "currency" || target.target === "currency" || action?.reasonCode === "RATE_UNCONFIRMED") {
      openCurrencySetup();
      return;
    }
    if (target.mode === "wizard") {
      setWizardNavigation(Number.isInteger(target.step) ? { target:target.section || "step", step:target.step, stamp:Date.now() } : null);
      setWizard(true);

      return;
    }
    const nextTab = target.tab || (action?.key === "track_payments" ? "to pay" : "budget");
    setTab(nextTab);
    if (target.categoryId) {
      setCoachFocus({ tab: nextTab, categoryId: target.categoryId, stamp: Date.now() });
      setTimeout(() => document.querySelector(`.basketSuggestionCard.open, .basketSelectedCard.open, [data-category="${target.categoryId}"]`)?.scrollIntoView({ behavior:"smooth", block:"center" }), 180);
    } else if (target.section) {
      setTimeout(() => document.querySelector(`[data-section="${target.section}"]`)?.scrollIntoView({ behavior:"smooth", block:"center" }), 180);
    }

  };

  const queueTripSync = (trip, status) => {
    if (isGuest) return;
    if (!trip?.backendId && !trip?.id) return;
    const id = trip.backendId || trip.id;
    clearTimeout(syncTimers.current[id]);
    syncTimers.current[id] = setTimeout(async () => {
      try {
        const result = await api.saveClientTrip(trip, status);
        const idToRefresh = result?.trip?.id || trip.backendId || trip.id;
        if (idToRefresh) await refreshBackendSummary(idToRefresh);
      } catch (error) { console.warn("Trip sync failed", error); }
    }, 700);
  };

  // v4.29.36: display-only/header edits must not re-sync finance rows.
  // Finance snapshot sync deletes/recreates finance items, which changes occurrence keys
  // and can make PaymentMark rows look lost after a display currency change.
  const queueTripMetadataSync = (trip, status) => {
    if (isGuest) return;
    if (!trip?.backendId && !trip?.id) return;
    const id = trip.backendId || trip.id;
    const key = `${id}:metadata`;
    clearTimeout(syncTimers.current[key]);
    syncTimers.current[key] = setTimeout(async () => {
      try {
        const result = await api.updateTrip(id, trip, status);
        const idToRefresh = result?.trip?.id || trip.backendId || trip.id;
        if (idToRefresh) await refreshBackendSummary(idToRefresh);
      } catch (error) { console.warn("Trip metadata sync failed", error); }
    }, 450);
  };

  const currentWorkingTrip = () => wizard && draftTrip ? draftTrip : savedTrip;

  const commitWorkingTrip = (next) => {
    if (wizard && draftTrip) {
      setDraftTrip(next);
      return;
    }
    setState(s => ({ ...s, trips: s.trips.map(t => t.id === next.id ? next : t) }));
  };

  const updateDisplayCurrencyOnly = async (value) => {
    const clean = normalizeCurrencyCode(value);
    const current = currentWorkingTrip();
    if (!clean || !current || currencyChangeState !== "idle") return;
    if (clean === displayCurrency(current)) return;
    setCurrencyChangeState("display");

    try {
      const result = await resolveApiRate(api, current.tripCurrency, clean, { rateBook: current.rateBook || {} });
      const next = {
        ...clone(current),
        displayCurrency: clean,
        displayRateSource: result.source || "api",
        displayRateUpdatedAt: result.fetchedAt || new Date().toISOString(),
        rateBook: applyResolvedRate(current.rateBook || {}, result)
      };
      commitWorkingTrip(next);
      queueTripMetadataSync(next, next.draft ? "DRAFT" : next.archived ? "ARCHIVED" : "ACTIVE");

    } catch (error) {
      notifyError("Display currency unavailable.", `Couldn’t load ${clean}. Try again.`);
    } finally {
      setCurrencyChangeState("idle");

    }
  };

  const updatePlanningRateOnly = (payload = {}, mode = "AUTO") => {
    const current = currentWorkingTrip();
    if (!current) return;
    const cleanRate = normalizedNumber(payload.rate);
    if (current.baseCurrency !== current.tripCurrency && cleanRate <= 0) return;
    const next = {
      ...clone(current),
      exchangeRate: current.baseCurrency === current.tripCurrency ? 1 : cleanRate,
      rateNeedsReview: false,
      ratePair: currentPair(current),
      rateMode: mode,
      rateSource: payload.source || (mode === "MANUAL" ? "manual" : "api"),
      rateSourceAsOf: payload.sourceAsOf || null,
      rateUpdatedAt: payload.fetchedAt || new Date().toISOString(),
      rateExpiresAt: payload.expiresAt || null,
      rateStale: !!payload.stale,
      rateConfidence: payload.confidence || (mode === "MANUAL" ? "user" : "medium"),
      rateBook: applyResolvedRate(current.rateBook || {}, {
        from: current.baseCurrency,
        to: current.tripCurrency,
        rate: current.baseCurrency === current.tripCurrency ? 1 : cleanRate
      }),
      pendingCurrencyConversion: null
    };
    commitWorkingTrip(next);
    queueTripMetadataSync(next, next.draft ? "DRAFT" : next.archived ? "ARCHIVED" : "ACTIVE");
  };

  const changeCurrencyContext = async ({ incomeCurrency, tripCurrency, origin, destination } = {}) => {
    const current = currentWorkingTrip();
    if (!current || currencyChangeState !== "idle") return;
    const nextIncome = normalizeCurrencyCode(incomeCurrency || current.baseCurrency, current.baseCurrency);
    const nextTrip = normalizeCurrencyCode(tripCurrency || current.tripCurrency, current.tripCurrency);
    if (!nextIncome || !nextTrip) return;
    setCurrencyChangeState("plan");

    try {
      const backendId = !isGuest ? persistedTripId(current) : "";
      if (backendId) {
        const result = await api.updateTripCurrencyContext(backendId, { incomeCurrency: nextIncome, tripCurrency: nextTrip, origin, destination });
        const mapped = backendTripToClient(result.trip);
        commitWorkingTrip(mapped);
        if (result.summary) applyBackendSummaryResult({ summary: result.summary });
        notifySuccess("Trip currency updated.");
      } else {
        const prepared = await prepareCurrencyChange(api, current, nextIncome, nextTrip);
        const routePatch = {
          ...(origin ? { origin: { ...(current.origin || {}), ...origin } } : {}),
          ...(destination ? { destinationInfo: { ...(current.destinationInfo || {}), ...destination } } : {})
        };
        const next = applyPreparedCurrencyChange(clone(current), prepared, routePatch);
        commitWorkingTrip(next);
        notifySuccess("Trip currency updated.");
      }
    } catch (error) {
      notifyError("Couldn’t update trip currency.", "Your existing plan was kept.");
    } finally {
      setCurrencyChangeState("idle");

    }
  };

  const updateTrip = fn => {
    if (validationErrors.length) setValidationErrors([]);
    if (wizard && draftTrip) {
      setDraftTrip(d => {
        const next = fn(clone(d));
        queueTripSync(next, "DRAFT");
        return next;
      });
      return;
    }
    if (!savedTrip) return;
    setState(s=>({ ...s, trips: s.trips.map(t=>{
      if (t.id !== savedTrip.id) return t;
      const next = fn(clone(t));
      queueTripSync(next, next.archived ? "ARCHIVED" : "ACTIVE");
      return next;
    }) }));
  };
  const markPaid = async (paymentId) => {
    const backendId = savedTrip?.backendId || savedTrip?.id;
    if (!isGuest && backendId && calcData?.backendSummary?.payments) {
      try {
        const result = await api.markPaymentPaid(backendId, paymentId);
        if (!applyBackendSummaryResult(result)) await refreshBackendSummary(backendId);
        notifyUndo("Marked paid.", "Payment progress updated.", { actionLabel:"Undo", onAction:()=>undoPaid(paymentId), dedupeKey:`payment:${paymentId}:paid` });
      } catch (error) {
        console.warn("Backend mark paid failed", error);
        notifyError("Couldn’t mark this payment.", "Try again.", { actionLabel:"Retry", onAction:()=>markPaid(paymentId), dedupeKey:`payment:${paymentId}:mark-error` });
      }

      return;
    }
    updateTrip(t => ({ ...t, paidPayments: { ...(t.paidPayments || {}), [paymentId]: true } }));
    notifyUndo("Marked paid.", "Payment progress updated.", { actionLabel:"Undo", onAction:()=>undoPaid(paymentId), dedupeKey:`payment:${paymentId}:paid` });
  };
  const undoPaid = async (paymentId) => {
    const backendId = savedTrip?.backendId || savedTrip?.id;
    if (!isGuest && backendId && calcData?.backendSummary?.payments) {
      try {
        const result = await api.undoPaymentPaid(backendId, paymentId);
        if (!applyBackendSummaryResult(result)) await refreshBackendSummary(backendId);
        notifySuccess("Payment restored.");
      } catch (error) {
        console.warn("Backend undo paid failed", error);
        notifyError("Couldn’t restore this payment.", "Try again.", { actionLabel:"Retry", onAction:()=>undoPaid(paymentId), dedupeKey:`payment:${paymentId}:undo-error` });
      }

      return;
    }
    updateTrip(t => {
      const next = { ...(t.paidPayments || {}) };
      delete next[paymentId];
      return { ...t, paidPayments: next };
    });
    notifySuccess("Payment restored.");
  };

  const update = (field,value) => {
    if (field === "displayCurrency") return updateDisplayCurrencyOnly(value);
    if (field === "exchangeRate") return updatePlanningRateOnly({ rate: value }, "MANUAL");
    if (field === "applyAutoRate") return updatePlanningRateOnly(value || {}, "AUTO");
    if (field === "currencyPair") return changeCurrencyContext(value || {});
    if (field === "routeOrigin") return changeCurrencyContext({ incomeCurrency: country(value?.countryCode).currency, origin: value });
    if (field === "routeDestination") return changeCurrencyContext({ tripCurrency: country(value?.countryCode).currency, destination: value });
    if (field === "baseCurrency") return changeCurrencyContext({ incomeCurrency: value });
    if (field === "tripCurrency") return changeCurrencyContext({ tripCurrency: value });
    return updateTrip(t => {
    if (field === "rateMode") return { ...t, rateMode: value };
    if (field === "rateNeedsReview") return { ...t, rateNeedsReview: value };
    if (field === "startDate") {
      const startDate = normalizeDateValue(value);
      if (value && !startDate) return t;
      const endDate = startDate && (!t.endDate || new Date(t.endDate) < new Date(startDate)) ? startDate : t.endDate;
      const next = { ...t, startDate, endDate };
      return { ...next, tripLengthType: tripLengthType(next), tripMode: tripModeFor(next) };
    }
    if (field === "endDate") {
      const rawEnd = normalizeDateValue(value);
      if (value && !rawEnd) return t;
      const endDate = t.startDate && rawEnd && new Date(rawEnd) < new Date(t.startDate) ? t.startDate : rawEnd;
      const next = { ...t, endDate };
      return { ...next, tripLengthType: tripLengthType(next), tripMode: tripModeFor(next) };
    }
    if (field === "travelers") return { ...t, travelers: cleanPositiveInt(value, 1) };
    if (field === "displayCurrency") return { ...t, displayCurrency: value };
    if (field === "tripPurpose" || field === "tripType") { const next = { ...t, tripPurpose:value, tripType:value }; return { ...next, tripMode: tripModeFor(next) }; }
    if (field === "travelStyle" || field === "comfortLevel") return { ...t, travelStyle:value, comfortLevel:value };
    if (field === "scenarioReserveEnabled") return { ...t, scenario: { ...(t.scenario || {}), reserveAfterTripBase: !!value } };
    if (field === "scenarioReserveAmount") return { ...t, scenario: { ...(t.scenario || {}), reserveAmountBase: normalizedNumber(value) } };
    const next = { ...t, [field]: typeNumberFields.has(field) ? normalizedNumber(value) : value };
    return { ...next, tripLengthType: tripLengthType(next), tripMode: tripModeFor(next) };
  });
  };
  const financeTypeForArray = (arr) => ({ incomeSources: "income", lifeCosts: "life", installments: "installments", budget: "budget", expenses: "expenses" })[arr];
  const backendTripIdForFinance = () => {
    const current = wizard && draftTrip ? draftTrip : savedTrip;
    if (isGuest || !current) return null;
    return current.backendId || current.id;
  };
  const refreshFinanceAfterChange = async (tripId) => {
    if (!tripId || isGuest) return;
    try { await refreshBackendSummary(tripId); }
    catch (error) { console.warn("Finance summary refresh failed", error); }
  };
  const updateArray = (arr,id,field,value) => {
    const type = financeTypeForArray(arr);
    let changedItem = null;
    let currentTripSnapshot = null;
    updateTrip(t=>{
      const nextItems = t[arr].map(x=>{
        if (x.id !== id) return x;
        const numericFields = new Set(["amountBase","monthlyBase","amountLocal","remainingMonths","exchangeRate"]);
        const dateFields = new Set(["nextDate","untilDate"]);
        const cleanDate = dateFields.has(field) ? normalizeDateValue(value) : value;
        changedItem = { ...x, [field]: numericFields.has(field) ? normalizedNumber(value) : dateFields.has(field) ? (value && !cleanDate ? x[field] : cleanDate) : value };
        return changedItem;
      });
      currentTripSnapshot = { ...t, [arr]: nextItems };
      return currentTripSnapshot;
    });
    const tripId = backendTripIdForFinance();
    if (tripId && type && changedItem?.backendId) {
      setTimeout(async () => {
        try {
          await api.updateFinanceClientItem(type, changedItem.backendId, changedItem, currentTripSnapshot || workingTrip);
          await refreshFinanceAfterChange(tripId);
        } catch (error) { console.warn("Direct finance update failed; snapshot sync remains fallback", error); notifyError("Couldn’t save this change.", "Retry after checking your connection."); }
      }, 0);
    }
  };
  const removeArray = (arr,id) => {
    const type = financeTypeForArray(arr);
    const sourceTrip = wizard && draftTrip ? draftTrip : savedTrip;
    const item = sourceTrip?.[arr]?.find(x => x.id === id);
    const tripId = backendTripIdForFinance();
    updateTrip(t=>({...t,[arr]:t[arr].filter(x=>x.id!==id)}));
    if (!(tripId && type && item?.backendId)) return Promise.resolve({ localOnly: true });
    return new Promise((resolve) => setTimeout(async () => {
      try {
        const result = await api.deleteFinanceItem(type, item.backendId);
        await refreshFinanceAfterChange(tripId);
        resolve(result);
      } catch (error) {
        const alreadyGone = error?.status === 404 || /not found|already removed|item not found/i.test(error?.message || "");
        if (alreadyGone) {
          console.warn("Backend item was already removed; refreshing summary", error);
          await refreshFinanceAfterChange(tripId);
          notifyInfo("Item already removed.", "The plan was refreshed.");
          resolve({ alreadyRemoved: true });
        } else {
          console.warn("Direct finance delete failed; snapshot sync remains fallback", error);
          notifyError("Couldn’t delete this item.", "Try again.");
          resolve({ error });
        }

      }
    }, 0));
  };
  const addArray = (arr, base, preset={}) => {
    const newId = uid(arr);
    const label = preset.name || "Custom item";
    let itemForApi = null;
    let snapshotForApi = null;
    updateTrip(t => {
      const item = { ...base(t), ...preset, id: newId };
      itemForApi = item;
      snapshotForApi = { ...t, [arr]: [item, ...t[arr]] };
      return snapshotForApi;
    });
    const type = financeTypeForArray(arr);
    const tripId = backendTripIdForFinance();
    let operation = Promise.resolve({ localOnly: true, id: newId });
    if (tripId && type && itemForApi) {
      operation = new Promise((resolve) => setTimeout(async () => {
        try {
          const result = type === "budget" && itemForApi.backendSuggestionId
            ? await api.applySuggestion(itemForApi.backendSuggestionId, { amount: itemForApi.amountLocal })
            : await api.createFinanceItem(tripId, type, itemForApi, snapshotForApi || workingTrip);
          const created = result?.income || result?.lifeCost || result?.installment || result?.cost || result?.expense || result?.item;
          if (created?.id) {
            const assignBackendId = t => ({ ...t, [arr]: t[arr].map(x => x.id === newId ? { ...x, backendId: created.id, backendModel: type, backendSuggestionId: itemForApi.backendSuggestionId || x.backendSuggestionId || "" } : x) });
            if (wizard && draftTrip) setDraftTrip(assignBackendId);
            else setState(s => ({ ...s, trips: s.trips.map(t => t.id === savedTrip?.id ? assignBackendId(t) : t) }));
          }
          if (result?.summary) { setBackendSummary(result.summary); setSummaryState("ready"); }
          await refreshFinanceAfterChange(tripId);
          resolve(result || { id: newId });
        } catch (error) {
          console.warn("Direct finance create failed; snapshot sync remains fallback", error);
          notifyError("Couldn’t save this change.", "Retry after checking your connection.");
          resolve({ error, id: newId });
        }
      }, 0));
    }
    setHighlightId(newId);

    setTimeout(() => setHighlightId(""), 4200);
    return operation;
  };
  const arrayOps = {
    income:{add:p=>addArray("incomeSources",t=>({enabled:true,name:"New income",amountBase:0,frequency:"monthly",nextDate:todayISO(),untilDate:t.endDate,period:""}),p),updateItem:(id,f,v)=>updateArray("incomeSources",id,f,v),remove:id=>removeArray("incomeSources",id)},
    life:{add:p=>addArray("lifeCosts",t=>({enabled:true,name:"New cost",categoryId:"cat-other-life",amountBase:0,frequency:"monthly",nextDate:todayISO(),untilDate:t.endDate,canPause:false}),p),updateItem:(id,f,v)=>updateArray("lifeCosts",id,f,v),remove:id=>removeArray("lifeCosts",id)},
    installments:{add:p=>addArray("installments",t=>({enabled:true,name:"New installment",monthlyBase:0,frequency:"monthly",remainingMonths:1,nextDate:todayISO(),untilDate:t.endDate,continuesAfterTrip:true}),p),updateItem:(id,f,v)=>updateArray("installments",id,f,v),remove:id=>removeArray("installments",id)},
    budget:{add:p=>addArray("budget",t=>({name:"New trip cost",categoryId:"cat-other-trip",amountLocal:0,priority:"Flexible",timing:"during",frequency:"trip-total",nextDate:t.startDate,untilDate:t.endDate,paid:false,costType:"TRIP_TOTAL",currencyScope:"DESTINATION"}),p),updateItem:(id,f,v)=>updateArray("budget",id,f,v),remove:id=>removeArray("budget",id)}
  };
  const saveDraft = async (draft = draftTrip) => {
    if (!draft) return null;
    if (isGuest) {
      const localDraft = { ...draft, draft:true, archived:false };
      setState(s => ({ ...s, drafts:[localDraft, ...(s.drafts || []).filter(d=>d.id!==localDraft.id)] }));
      setDraftTrip(localDraft);
      notifyInfo("Draft saved on this device.", "Create an account to keep it across devices.");
      return localDraft;
    }
    try {
      const result = await api.saveClientTrip({ ...draft, draft: true, archived: false }, "DRAFT");
      const saved = backendTripToClient(result.trip);
      setState(s => {
        const existing = (s.drafts || []).some(d => d.id === saved.id);
        const drafts = existing ? (s.drafts || []).map(d => d.id === saved.id ? saved : d) : [saved, ...(s.drafts || [])];
        return { ...s, drafts };
      });
      setDraftTrip(saved);
      notifySuccess("Draft saved.");
      return saved;
    } catch (error) {
      notifyError("Couldn’t save the draft.", "Try again.");
      return null;
    }
  };
  const closeWizard = async () => {
    if (draftTrip) await saveDraft(draftTrip);
    setWizard(false);
    setWizardNavigation(null);
  };
  const resumeDraft = (id) => {
    const draft = (state.drafts || []).find(d => d.id === id) || state.drafts?.[0];
    if (!draft) return;
    setDraftTrip(clone(draft));
    setValidationErrors([]);
    setWizardNavigation(null);
    setWizard(true);

  };
  const discardDraft = async (id) => {
    const targets = id ? (state.drafts || []).filter(d => d.id === id) : (state.drafts || []);
    if (!isGuest) {
      for (const draft of targets) {
        try { await api.deleteTrip(draft.backendId || draft.id); } catch {}
      }
    }
    setState(s => ({ ...s, drafts: id ? (s.drafts || []).filter(d => d.id !== id) : [] }));
    if (draftTrip && (!id || draftTrip.id === id)) setDraftTrip(null);
    notifySuccess("Draft deleted.");
  };

  const createTrip = async (name,type,style="Balanced") => {
    const t = { ...createBlankTrip(state.user, name, type), tripPurpose:type, tripType:type, comfortLevel:style, travelStyle:style };
    if (isGuest) {
      setDraftTrip(t);
      setNewTrip(false);
      setWizard(true);
      setValidationErrors([]);
      setTab("overview");
      notifyInfo("Demo trip started.", "Create an account when you’re ready to save it.");
      return;
    }
    try {
      const result = await api.createTrip(t, "DRAFT");
      const savedDraft = backendTripToClient(result.trip);
      setDraftTrip(savedDraft);
      setState(s => ({ ...s, drafts: [savedDraft, ...(s.drafts || []).filter(d => d.id !== savedDraft.id)] }));
    } catch (error) {
      notifyError("Couldn’t create the draft.", "A local draft was opened instead.");
      setDraftTrip(t);
    }
    setNewTrip(false);
    setWizard(true);
    setValidationErrors([]);
    setTab("overview");
  };
  const createDemoTrip = () => { const t=createDemoPreview(state.user); setDraftTrip(t); setValidationErrors([]); setWizardNavigation(null); setWizard(true); setTab("overview"); };
  const finishWizard = async () => {
    const target = draftTrip || workingTrip;
    const errors = validateTripForFinish(target);
    if (errors.length) {
      setValidationErrors(errors);
      notifyWarning("Check the highlighted fields.", "Finish the required details before saving the trip.");
      return;
    }
    setValidationErrors([]);
    if (!draftTrip) { setWizard(false); notifySuccess("Trip updated."); return; }
    if (isGuest) {
      const finalTrip = { ...draftTrip, draft:false, archived:false, id: draftTrip.id || uid("trip") };
      setState(s=>({...s, trips:[finalTrip, ...(s.trips || []).filter(t=>t.id!==finalTrip.id)], drafts:(s.drafts||[]).filter(d=>d.id!==finalTrip.id), activeId:finalTrip.id }));
      setPendingGuestTrip(finalTrip);
      savePendingGuestTrip(finalTrip);
      setDraftTrip(null);
      setWizard(false);
      setAuthReason(authRequiredMessage("save this trip and continue later"));
      setAuthPrompt(true);
      notifyInfo("Your demo plan is ready.", "Create an account to keep it.");
      return;
    }
    try {
      const saved = await api.saveClientTrip({ ...draftTrip, draft: true, archived: false }, "DRAFT");
      const savedDraft = backendTripToClient(saved.trip);
      await api.finishTrip(savedDraft.backendId || savedDraft.id);
      const refreshed = await api.loadClientTrips();
      const trips = refreshed.filter(t => !t.draft);
      const drafts = refreshed.filter(t => t.draft);
      const finalTrip = trips.find(t => t.id === savedDraft.id) || trips[0];
      setState(s=>({...s,trips,drafts,activeId:finalTrip?.id || s.activeId}));
      setBackendSummary(null);
      if (finalTrip?.backendId || finalTrip?.id) refreshBackendSummary(finalTrip.backendId || finalTrip.id);
      setDraftTrip(null);
      setWizard(false);
      notifySuccess("Trip plan saved.");
    } catch (error) {
      notifyError("Couldn’t save the trip.", "Review the plan and try again.");
    }
  };
  const duplicate = async () => { if (!savedTrip) return; const t=clone(savedTrip); delete t.backendId; t.id=uid("trip"); t.name += " — Copy"; t.archived=false; t.draft=false; if (isGuest) { setState(s=>({...s,trips:[...s.trips,t],activeId:t.id})); setNewTrip(false); setAuthReason(authRequiredMessage("save duplicated trips")); return; } try { const result = await api.createTrip(t, "ACTIVE"); const copy = backendTripToClient(result.trip); setState(s=>({...s,trips:[...s.trips,copy],activeId:copy.id})); } catch { setState(s=>({...s,trips:[...s.trips,t],activeId:t.id})); } setNewTrip(false); };
  const archive = async id => { if (!isGuest) { try { await api.setTripStatus(id,"ARCHIVED"); } catch (error) { notifyError("Couldn’t archive this trip.", "Try again."); return; } } setState(s=>{ const trips=s.trips.map(t=>t.id===id?{...t,archived:true,backendStatus:"ARCHIVED"}:t); return {...s,trips,activeId:(trips.find(t=>!t.archived)?.id || trips[0]?.id || null)}; }); };
  const restore = async id => { if (!isGuest) { try { await api.setTripStatus(id,"ACTIVE"); } catch (error) { notifyError("Couldn’t restore this trip.", "Try again."); return; } } setState(s=>({...s,trips:s.trips.map(t=>t.id===id?{...t,archived:false,backendStatus:"ACTIVE"}:t),activeId:id})); };
  const deleteTrip = async id => {
    const target = state.trips.find(t => t.id === id);
    if (!target?.archived) {
      notifyWarning("Archive the trip first.", "Permanent delete is available for archived trips.");

      return;
    }
    if (!window.confirm(`Delete "${target.name}" permanently? This cannot be undone.`)) return;
    if (!isGuest) { try { await api.deleteTrip(target.backendId || target.id); } catch (error) { notifyError("Couldn’t delete this trip.", "Try again."); return; } }
    setState(s => {
      const trips = s.trips.filter(t => t.id !== id);
      const fallback = trips.find(t => !t.archived)?.id || trips[0]?.id || null;
      return { ...s, trips, activeId: s.activeId === id ? fallback : s.activeId };
    });
    notifySuccess("Trip deleted.");
  };
  const addCat = () => setState(s=>({...s,cats:[...s.cats,{id:uid("cat"),name:"New Category",type:"trip"}]}));
  const updateCat = (id,f,v) => setState(s=>({...s,cats:s.cats.map(c=>c.id===id?{...c,[f]:v}:c)}));
  const exportData = () => { const blob = new Blob([JSON.stringify(state,null,2)],{type:"application/json"}); const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download="safaryaty-v4-23-backup.json"; a.click(); };

  if (authLoading) return <div className="authPage"><Card className="authCard"><div className="brand dark"><span><Icon name="compass"/></span><b>Safaryaty</b><small>Travel Coach</small></div><h1>Loading Safaryaty</h1><p>{authMessage}</p></Card></div>;
  if (authOnly && !state.user) return <AuthScreen initialMode="entry" onLogin={handleAuthSuccess} onDemo={startDemo} reason="Sign in to continue, or try the demo without saving." language={appLanguage} setLanguage={setAppLanguage}/>;
  if (!state.user) return null;
  if (!trip) return <div className="app"><NotificationHost notification={notification} onDismiss={dismissNotification}/><div className="page"><header className="hero"><div><div className="heroBrandRow"><div className="brand"><span><Icon name="compass"/></span><b>Safaryaty</b><small>سفرياتي</small></div><LanguageSwitch language={appLanguage} setLanguage={setAppLanguage}/></div><h1>My Trips</h1><p>سفريتك محسوبة قبل ما تبدأ. Create your first smart plan or view a demo preview.</p></div><div className="heroActions"><div className="userChip">{state.user.avatar ? <img src={state.user.avatar} alt="Profile"/> : <Icon name="person-circle"/>}<div><b>{state.user.name}</b><span>{isGuest ? "Demo mode · try first" : `${state.user.plan} · ${country(state.user.nationality).name}`}</span></div></div><Button variant="light" onClick={()=>createTrip("My First Trip","Personal")}><Icon name="plus-lg"/> Create First Trip</Button><Button variant="ghost" onClick={createDemoTrip}><Icon name="eye"/> Demo Preview</Button>{isGuest ? <Button variant="ghost" onClick={()=>{setAuthReason(authRequiredMessage("save your plan"));setAuthPrompt(true);}}><Icon name="shield-check"/> Save Account</Button> : <Button variant="ghost" onClick={logout}><Icon name="box-arrow-right"/> {langText(appLanguage,"logout")}</Button>}</div></header><EmptyDashboard user={state.user} createFirstTrip={()=>createTrip("My First Trip","Personal")} createDemoTrip={createDemoTrip} hasDraft={!!draftTrip || (state.drafts || []).length > 0} resumeDraft={()=> draftTrip ? openFullWizard() : resumeDraft()} discardDraft={()=> draftTrip ? setDraftTrip(null) : discardDraft()} language={appLanguage}/><footer>Safaryaty V4.29.52.1 — Backend Build Gate & Finance Exactness.</footer></div></div>;

  return <div className="app"><NotificationHost notification={notification} onDismiss={dismissNotification}/><div className="page">
    <header className="hero"><div><div className="heroBrandRow"><div className="brand"><span><Icon name="compass"/></span><b>Safaryaty</b><small>سفرياتي</small></div><LanguageSwitch language={appLanguage} setLanguage={setAppLanguage}/></div><h1>{trip.name}{trip.draft && <span className="draftBadge">Draft</span>}</h1><p>{trip.tripPurpose || trip.tripType || "Trip"} · {tripLengthLabel(trip)} · {trip.draft ? "Finish the wizard to create it." : `${route(trip)} · ${routeFull(trip)} · ${trip.startDate} → ${trip.endDate}`}</p><div className="pills"><span><Icon name="airplane"/> {route(trip)}</span><span><Icon name="globe2"/> {routeFull(trip)}</span><span className={trip.rateNeedsReview ? "needsRate" : ""}><Icon name="currency-exchange"/> {trip.baseCurrency} → {trip.tripCurrency}{trip.rateNeedsReview ? " · review rate" : ""}</span></div></div><div className="heroActions"><div className="userChip">{state.user.avatar ? <img src={state.user.avatar} alt="Profile"/> : <Icon name="person-circle"/>}<div><b>{state.user.name}</b><span>{isGuest ? "Demo mode · try first" : `${state.user.plan} · ${country(state.user.nationality).name}`}</span></div></div><Button variant="light" onClick={()=>setNewTrip(true)}><Icon name="plus-lg"/> {langText(appLanguage,"newTrip")}</Button><Button variant="ghost" onClick={openFullWizard}><Icon name="magic"/> {draftTrip ? "Resume Draft" : langText(appLanguage,"improve")}</Button><Button variant="ghost" onClick={duplicate}><Icon name="copy"/> Duplicate</Button><Button variant="ghost" onClick={flags.canExport ? exportData : ()=>notifyInfo("Export is a Pro feature.")}><Icon name="download"/> Export</Button><Button variant="ghost" onClick={logout}><Icon name="box-arrow-right"/> {langText(appLanguage,"logout")}</Button></div></header>
    {!isGuest && state.mode==="advanced" && <div className={`summarySource ${summaryState}`}><Icon name={summaryState === "ready" ? "cloud-check" : summaryState === "loading" ? "arrow-repeat" : "cloud-slash"}/> {summaryState === "ready" ? "Backend summary active" : summaryState === "loading" ? "Loading backend summary..." : "Demo/local fallback active"}</div>}
    <div className="globalKpiStrip"><KPIs t={trip} c={calcData}/></div>
    <div className="tabs"><div>{simpleTabs.map(x=>{ const meta=simpleTabMeta[x]; return <button key={x} data-mobile={meta.mobile ? "yes" : "no"} className={tab===x?"active":""} onClick={()=>setTab(x)} title={langText(appLanguage, meta.labelKey)}><Icon name={meta.icon}/><span>{langText(appLanguage, meta.labelKey)}</span></button>; })}{state.mode==="advanced"&&[...advancedTabs, ...(flags.isAdmin ? ["admin"] : [])].map(x=>{ const meta=simpleTabMeta[x]; return <button key={x} data-mobile="no" className={tab===x?"active":""} onClick={()=>setTab(x)} title={langText(appLanguage, meta.labelKey)}><Icon name={meta.icon}/><span>{langText(appLanguage, meta.labelKey)}</span></button>; })}</div><span><button title="Simple: See only what matters to decide." className={state.mode==="beginner"?"active":""} onClick={()=>setState(s=>({...s,mode:"beginner"}))}>{langText(appLanguage,"simple")}</button><button title="Advanced: See full budget, cashflow, and detailed calculations." className={state.mode==="advanced"?"active":""} onClick={()=>setState(s=>({...s,mode:"advanced"}))}>{langText(appLanguage,"advanced")}</button></span></div>
    <div className="modeMicrocopy"><span><b>{state.mode==="advanced" ? "Advanced" : "Simple"}</b>{state.mode==="advanced" ? "Full financial planning view: cashflow, categories, exchange details, and deeper analysis." : "Quick decision view: score, ready money, missing amount, paid items, and next action."}</span><span><Icon name="currency-exchange"/> {trip.baseCurrency} → {trip.tripCurrency} uses one selected rate.</span></div>
    {tab==="overview"&&<Overview t={trip} c={calcData} recs={recs} mi={miData} status={statusData} markPaid={markPaid} undoPaid={undoPaid} openWizard={openFullWizard} onNextAction={followCoachAction} update={update} language={appLanguage}/>}
    {tab==="to pay"&&<section><PaymentTracker trip={trip} calc={calcData} markPaid={markPaid} undoPaid={undoPaid}/></section>}
    {/* Event Management is an internal backend process used by To Pay, Summary, Warnings, and Suggestions — no separate tab. */}
    {tab==="budget"&&<section><CardManagers type="budget" trip={trip} calc={calcData} categoriesList={state.cats} highlightId={highlightId} focusCategory={coachFocus.tab==="budget" ? coachFocus.categoryId : ""} updateTrip={update} onOpenCurrencySetup={openCurrencySetup} {...arrayOps.budget}/></section>}
    {tab==="installments"&&<section><CardManagers type="installments" trip={trip} categoriesList={state.cats} highlightId={highlightId} {...arrayOps.installments}/></section>}
    {tab==="suggestions"&&<section><RecommendationPageHeader recs={recs} calc={calcData}/><Recs recs={recs} onAction={followCoachAction}/></section>}
    {tab==="trips"&&<section><Trips trips={state.trips} activeId={state.activeId} setActive={id=>setState(s=>({...s,activeId:id}))} archive={archive} restore={restore} deleteTrip={deleteTrip} showArchived={showArchived} setShowArchived={setShowArchived} showDrafts={showDrafts} setShowDrafts={setShowDrafts} drafts={state.drafts || []} resumeDraft={resumeDraft} discardDraft={discardDraft} addTrip={()=>setNewTrip(true)}/></section>}
    {tab==="profile"&&<ProfilePanel user={state.user} updateUser={(user)=>setState(s=>({...s,user}))}/>}
    {tab==="cashflow"&&state.mode==="advanced"&&<section><AdvancedCashflow t={trip} c={calcData}/></section>}
    {tab==="categories"&&state.mode==="advanced"&&<section><CategoriesView cats={state.cats} add={addCat} update={updateCat}/></section>}
    {tab==="admin"&&state.mode==="advanced"&&flags.isAdmin&&<AdminPanel trips={state.trips}/>}
    <footer>Safaryaty V4.29.52.1 — Backend Build Gate & Finance Exactness.</footer>
  </div>
  <Modal size="wizard" open={wizard} onClose={closeWizard} title="Improve your travel plan" subtitle="Answer a few focused questions. Safaryaty handles the calculations behind the scenes."><Wizard trip={workingTrip} calc={calcData} recs={recs} mi={miData} update={update} arrayOps={arrayOps} highlightId={highlightId} validationErrors={validationErrors} onFinish={finishWizard} language={appLanguage} navigationRequest={wizardNavigation} currencyBusy={currencyChangeState}/></Modal>
  <NewTrip open={newTrip} onClose={()=>setNewTrip(false)} create={createTrip} duplicate={duplicate}/>
  {authPrompt && <div className="authGateBack" onMouseDown={()=>setAuthPrompt(false)}><div className="authGateBox" onMouseDown={e=>e.stopPropagation()}><button className="authGateClose" onClick={()=>setAuthPrompt(false)}><Icon name="x-lg"/></button><AuthScreen initialMode="register" reason={authReason} onLogin={handleAuthSuccess} onDemo={startDemo} language={appLanguage} setLanguage={setAppLanguage}/></div></div>}
  </div>;
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
