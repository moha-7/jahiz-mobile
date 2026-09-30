import { canonicalTripCategory as sharedCanonicalTripCategory, tripCostCategoryLabel } from "../../../../shared/trip-cost-domain.js";

export const tripCategoryLabels: Record<string, string> = {
  "cat-flight": "Flights",
  "cat-accommodation": "Accommodation",
  "cat-food": "Food & Cafes",
  "cat-transport": "Local Transport",
  "cat-activities": "Activities",
  "cat-shopping": "Shopping",
  "cat-gifts": "Gifts",
  "cat-emergency": "Emergency",
  "cat-daytrip": "Day Trips",
  "cat-university-fees": "Academic / University Fees",
  "cat-student-accommodation": "Student Accommodation",
  "cat-transport-pass": "Transport Pass",
  "cat-visa-documents": "Visa & Documents",
  "cat-health-insurance": "Health Insurance",
  "cat-books-materials": "Books / Materials",
  "cat-sim-internet": "SIM / Internet",
  "cat-deposit": "Deposit",
  "cat-first-rent": "First Rent",
  "cat-furniture": "Furniture Basics",
  "cat-moving": "Moving Costs",
  "cat-event-ticket": "Event Ticket",
  "cat-medical-fees": "Clinic / Hospital Fees",
  "cat-medication": "Medication",
  "cat-meeting": "Meeting / Work Costs",
  "cat-gear": "Gear / Equipment",
  "cat-family-outings": "Family Outings",
  "cat-food-contribution": "Food Contributions",
  "cat-other-trip": "Other Destination Cost"
};

const extendedAliases: Record<string, string> = {
  "day trips": "cat-daytrip", "day trip": "cat-daytrip",
  "academic / university fees": "cat-university-fees",
  "student accommodation": "cat-student-accommodation",
  "transport pass": "cat-transport-pass",
  "visa & documents": "cat-visa-documents",
  "health insurance": "cat-health-insurance",
  "books / materials": "cat-books-materials",
  "sim / internet": "cat-sim-internet",
  deposit: "cat-deposit", "first rent": "cat-first-rent",
  "furniture basics": "cat-furniture", "moving costs": "cat-moving",
  "event ticket": "cat-event-ticket", "clinic / hospital fees": "cat-medical-fees",
  medication: "cat-medication", "meeting / work costs": "cat-meeting",
  "gear / equipment": "cat-gear", "family outings": "cat-family-outings",
  "food contributions": "cat-food-contribution"
};

export function canonicalTripCategory(value: string | null | undefined, fallback = "cat-other-trip") {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (tripCategoryLabels[raw]) return raw;
  const extended = extendedAliases[raw.toLowerCase().replace(/\s+/g, " ")];
  return extended || sharedCanonicalTripCategory(raw, fallback);
}

export function tripCategoryLabel(category: string | null | undefined, fallback = "Trip Cost") {
  const canonical = canonicalTripCategory(category, "cat-other-trip");
  return tripCategoryLabels[canonical] || tripCostCategoryLabel(canonical, fallback);
}
