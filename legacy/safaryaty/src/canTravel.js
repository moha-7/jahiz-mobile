import { evaluateDecision } from "../shared/decision-engine.js";
import { buildDecisionInput } from "./engine.js";

// Safaryaty presentation/action layer built on the canonical decision engine.
// It gives the product answer the user actually needs: can I travel, what is missing, and what should I do next?

export const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
function optionalAmount(trip, calc) {
  const scheduleOptional = (calc.paymentSchedule || [])
    .filter((row) => row.group === "destination" && row.priority !== "Must" && row.status !== "paid")
    .reduce((sum, row) => sum + num(row.amount), 0);
  if (scheduleOptional > 0) return scheduleOptional;
  return (trip.budget || []).filter((item) => item.priority !== "Must").reduce((sum, item) => sum + num(item.amountLocal), 0);
}

function missingRequiredCosts(trip) {
  const required = (trip.budget || []).filter((item) => item.priority === "Must");
  if (!required.length) return ["No required destination costs added yet."];
  const empty = required.filter((item) => num(item.amountLocal) <= 0).map((item) => item.name || "Required cost");
  return empty.slice(0, 3);
}

function nextBestAction(trip, calc, gap, decision) {
  if (decision?.reasonCode === "EXCHANGE_RATE_UNCONFIRMED" || calc.exchangeRateMissing || trip.rateNeedsReview) return {
    key: "confirm_rate",
    label: "Confirm exchange rate",
    detail: `Update ${trip.baseCurrency} → ${trip.tripCurrency} before trusting the numbers.`,
    cta: "Review rate",
    target: { tab: "overview", section: "display-currency" },
    impact: "Required"
  };
  const missing = missingRequiredCosts(trip);
  if (missing.length) return {
    key: "complete_costs",
    label: "Complete required costs",
    detail: `Add a value for ${missing.join(", ")}.`,
    cta: "Edit costs",
    target: { tab: "budget" },
    impact: "Improves accuracy"
  };
  if (gap > 0) {
    const optional = optionalAmount(trip, calc);
    if (optional > 0) return {
      key: "reduce_optional",
      label: "Reduce flexible costs",
      detail: `You need about ${Math.ceil(gap)} ${trip.tripCurrency}. Start with optional destination costs.`,
      cta: "Edit costs",
      target: { tab: "budget", mode: "optional" },
      impact: Math.min(optional, gap)
    };
    return {
      key: "add_money",
      label: "Add money",
      detail: `You need about ${Math.ceil(gap)} ${trip.tripCurrency} more to make this plan safer.`,
      cta: "Open money",
      target: { tab: "overview", section: "plan-money" },
      impact: gap
    };
  }
  const emergency = (trip.budget || []).some((item) => item.categoryId === "cat-emergency" && num(item.amountLocal) > 0);
  if (!emergency) return {
    key: "add_emergency",
    label: "Add emergency",
    detail: "Your plan fits, but emergency money makes it safer.",
    cta: "Add emergency",
    target: { tab: "budget", categoryId: "cat-emergency" },
    impact: "Safety"
  };
  return {
    key: "track_payments",
    label: "Track payments",
    detail: "Your plan looks good. Keep Mark Paid updated as payments happen.",
    cta: "Open payments",
    target: { tab: "to pay" },
    impact: "Tracking"
  };
}

function decisionCopy(decision, trip) {
  const amount = (value) => Math.max(0, Math.ceil(num(value))).toLocaleString();
  switch (decision.reasonCode) {
    case "EXCHANGE_RATE_UNCONFIRMED":
      return { label: "Blocked", title: "Confirm exchange rate first", detail: "Safaryaty cannot trust this plan until the exchange rate is updated.", icon: "currency-exchange" };
    case "MISSING_TRIP_COSTS":
      return { label: "Blocked", title: "Add destination costs first", detail: "Safaryaty needs the main destination costs before it can judge the trip.", icon: "plus-circle" };
    case "COVERED_BUT_THIN_BUFFER":
      return { label: "Can go, but tight", title: "You can take this trip, but it is tight", detail: `The plan is covered, but only about ${amount(decision.remaining)} ${trip.tripCurrency} remains after planned trip costs. Add emergency reserve or reduce flexible costs.`, icon: "exclamation-triangle" };
    case "READY":
      return { label: "Ready", title: "Yes, this trip looks ready", detail: "Your money, payments, and safety buffer look strong enough for this plan.", icon: "check2-circle" };
    case "SMALL_SAVING_GAP":
      return { label: "Almost ready", title: "Almost ready", detail: `You need about ${amount(decision.gap)} ${trip.tripCurrency} more.`, icon: "bullseye" };
    case "STRENGTHEN_SAFETY_OR_TIMING":
      return { label: "Almost ready", title: "Almost ready", detail: "The plan fits, but strengthen reserve, emergency, or payment timing before calling it ready.", icon: "bullseye" };
    case "MATERIAL_SAVING_GAP":
      return { label: "Tight", title: "Possible, but tight", detail: `The plan is short by about ${amount(decision.gap)} ${trip.tripCurrency}.`, icon: "exclamation-triangle" };
    case "WEAK_TIMING_OR_BUFFER":
      return { label: "Tight", title: "Possible, but tight", detail: "The plan fits, but timing and buffer are weak.", icon: "exclamation-triangle" };
    case "LARGE_SAVING_GAP":
      return { label: "Risky", title: "Not safe yet", detail: `You need about ${amount(decision.gap)} ${trip.tripCurrency} or a cheaper plan.`, icon: "exclamation-octagon" };
    default:
      return { label: "Risky", title: "Not safe yet", detail: "The score is low because required costs, timing, or safety are weak.", icon: "exclamation-octagon" };
  }
}

export function canTravel(trip, calc) {
  const decision = calc?.decision || evaluateDecision(buildDecisionInput(trip, calc || {}));
  const nextAction = nextBestAction(trip, calc || {}, decision.gap, decision);
  const copy = decisionCopy(decision, trip);
  return {
    ...decision,
    ...copy,
    nextAction,
  };
}
