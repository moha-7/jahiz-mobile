// Safaryaty Recommendation Engine v1
// Pure, deterministic, framework-free. It ranks actions; it never recalculates money truth.

export const RECOMMENDATION_ENGINE_VERSION = "4.29.42";

const PRIORITY_SCORE = Object.freeze({ critical: 100, high: 80, medium: 60, low: 40, positive: 20 });
const CONFIDENCE_SCORE = Object.freeze({ low: 1, medium: 2, high: 3 });

const CORE_CATEGORIES = Object.freeze({
  "cat-flight": { title: "Flights", required: true, priority: "Must" },
  "cat-accommodation": { title: "Accommodation", required: true, priority: "Must" },
  "cat-food": { title: "Food & Cafes", required: false, priority: "Flexible" },
  "cat-transport": { title: "Local Transport", required: false, priority: "Flexible" },
  "cat-activities": { title: "Activities", required: false, priority: "Optional" },
  "cat-shopping": { title: "Shopping", required: false, priority: "Optional" },
  "cat-emergency": { title: "Emergency", required: true, priority: "Must" },
});

const num = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const cleanConfidence = (value) => (CONFIDENCE_SCORE[value] ? value : "medium");
const minConfidence = (...values) => values.map(cleanConfidence).sort((a, b) => CONFIDENCE_SCORE[a] - CONFIDENCE_SCORE[b])[0] || "medium";

function categoryMeta(categoryId) {
  return CORE_CATEGORIES[categoryId] || { title: categoryId || "Trip cost", required: false, priority: "Flexible" };
}

function makeRecommendation(input) {
  const priority = input.priority || "medium";
  return {
    id: input.id,
    key: input.id,
    reasonCode: input.reasonCode || input.id,
    family: input.family || input.id,
    level: input.level || (priority === "critical" ? "danger" : priority === "high" ? "warning" : "info"),
    priority,
    rank: PRIORITY_SCORE[priority] || 0,
    title: input.title,
    label: input.title,
    detail: input.detail,
    actionLabel: input.actionLabel,
    action: input.actionLabel,
    cta: input.actionLabel,
    target: input.target || { tab: "overview" },
    icon: input.icon || "lightbulb",
    confidence: cleanConfidence(input.confidence || "high"),
    source: input.source || "recommendation-rules",
    categoryId: input.categoryId || null,
    impact: input.impact || null,
    metric: input.metric || null,
    dismissible: input.dismissible !== false,
  };
}

function categoryAmount(input, id) {
  return Math.max(0, num(input.categoryAmounts?.[id]));
}

function categoryRange(input, id) {
  const raw = input.categoryRanges?.[id] || {};
  return {
    low: Math.max(0, num(raw.low)),
    typical: Math.max(0, num(raw.typical)),
    high: Math.max(0, num(raw.high)),
    unit: raw.unit || "trip total",
  };
}

function topRangeProblem(input) {
  const profileConfidence = cleanConfidence(input.costProfile?.confidence || "medium");
  const source = input.costProfile?.source || "cost-profile";

  const missingRequired = ["cat-flight", "cat-accommodation"]
    .map((categoryId) => {
      const amount = categoryAmount(input, categoryId);
      const range = categoryRange(input, categoryId);
      return { categoryId, amount, range, deficit: Math.max(0, range.low - amount) };
    })
    .filter((item) => item.range.low > 0 && item.amount < item.range.low)
    .sort((a, b) => b.deficit - a.deficit)[0];

  if (missingRequired) {
    const meta = categoryMeta(missingRequired.categoryId);
    return makeRecommendation({
      id: `complete-${missingRequired.categoryId}`,
      reasonCode: "REQUIRED_COST_BELOW_RANGE",
      family: "required-cost-completeness",
      priority: "high",
      level: "warning",
      title: `${meta.title} looks under-planned`,
      detail: `Your ${meta.title.toLowerCase()} budget is below the low planning range. Add a realistic amount before trusting the final decision.`,
      actionLabel: `Review ${meta.title}`,
      target: { tab: "budget", categoryId: missingRequired.categoryId },
      icon: missingRequired.categoryId === "cat-flight" ? "airplane" : "building",
      confidence: minConfidence(profileConfidence, "medium"),
      source,
      categoryId: missingRequired.categoryId,
      impact: { direction: "increase", amount: missingRequired.deficit, currency: input.currency, label: "Minimum planning gap" },
    });
  }

  if (num(input.gap) > 0) {
    const reducible = ["cat-shopping", "cat-activities", "cat-food", "cat-transport"]
      .map((categoryId) => {
        const amount = categoryAmount(input, categoryId);
        const range = categoryRange(input, categoryId);
        const target = range.typical || range.low;
        return { categoryId, amount, range, savings: Math.max(0, amount - target) };
      })
      .filter((item) => item.savings > 0 && item.range.high > 0)
      .sort((a, b) => b.savings - a.savings)[0];

    if (reducible) {
      const meta = categoryMeta(reducible.categoryId);
      return makeRecommendation({
        id: `reduce-${reducible.categoryId}`,
        reasonCode: "FLEXIBLE_COST_ABOVE_TYPICAL",
        family: "cost-optimization",
        priority: "high",
        level: "warning",
        title: `Reduce ${meta.title.toLowerCase()} first`,
        detail: `${meta.title} is above the typical planning range. Reducing it is the least disruptive way to close part of the saving gap.`,
        actionLabel: `Edit ${meta.title}`,
        target: { tab: "budget", categoryId: reducible.categoryId },
        icon: "graph-down-arrow",
        confidence: minConfidence(profileConfidence, "medium"),
        source,
        categoryId: reducible.categoryId,
        impact: { direction: "reduce", amount: reducible.savings, currency: input.currency, label: "Possible reduction" },
      });
    }
  }

  return null;
}

function dedupeAndLimit(items, limit) {
  const seenIds = new Set();
  const seenFamilies = new Set();
  const output = [];
  const sorted = [...items].sort((a, b) => b.rank - a.rank || String(a.id).localeCompare(String(b.id)));
  for (const item of sorted) {
    if (!item || seenIds.has(item.id)) continue;
    // Only one cost-range action and one financing action should compete for attention at a time.
    if (["cost-optimization", "required-cost-completeness"].includes(item.family) && seenFamilies.has("cost-range-action")) continue;
    if (item.family === "financing" && seenFamilies.has("financing")) continue;
    seenIds.add(item.id);
    seenFamilies.add(item.family);
    if (["cost-optimization", "required-cost-completeness"].includes(item.family)) seenFamilies.add("cost-range-action");
    output.push(item);
    if (output.length >= limit) break;
  }
  return output;
}

export function generateRecommendations(raw = {}, options = {}) {
  const input = {
    ...raw,
    currency: String(raw.currency || "USD").toUpperCase(),
    planned: Math.max(0, num(raw.planned ?? raw.decision?.planned)),
    available: num(raw.available ?? raw.decision?.available),
    paid: Math.max(0, num(raw.paid ?? raw.decision?.paid)),
    remaining: num(raw.remaining ?? raw.decision?.remaining),
    gap: Math.max(0, num(raw.gap ?? raw.decision?.gap)),
    rateUnsure: Boolean(raw.rateUnsure ?? raw.decision?.inputs?.rateUnsure),
    everNegative: Boolean(raw.everNegative ?? raw.decision?.inputs?.everNegative),
    continuingInstallments: Boolean(raw.continuingInstallments ?? raw.decision?.inputs?.continuingInstallments),
  };
  const limit = Math.max(1, Math.min(5, Number(options.limit || 3)));
  const candidates = [];

  if (input.rateUnsure || input.decision?.reasonCode === "EXCHANGE_RATE_UNCONFIRMED") {
    candidates.push(makeRecommendation({
      id: "confirm-exchange-rate",
      reasonCode: "EXCHANGE_RATE_UNCONFIRMED",
      family: "blocking-truth",
      priority: "critical",
      level: "danger",
      title: "Confirm the exchange rate first",
      detail: "The plan cannot be trusted until the selected currency pair has a confirmed automatic or manual rate.",
      actionLabel: "Review rate",
      target: { tab: "overview", section: "display-currency" },
      icon: "currency-exchange",
      confidence: "high",
      source: "decision-engine",
      dismissible: false,
    }));
    return dedupeAndLimit(candidates, limit);
  }

  if (input.planned <= 0 || input.decision?.reasonCode === "MISSING_TRIP_COSTS") {
    candidates.push(makeRecommendation({
      id: "add-trip-costs",
      reasonCode: "MISSING_TRIP_COSTS",
      family: "blocking-truth",
      priority: "critical",
      level: "danger",
      title: "Add the main trip costs",
      detail: "Safaryaty needs at least the core destination costs before it can produce a reliable decision or recommendation.",
      actionLabel: "Edit costs",
      target: { tab: "budget" },
      icon: "pie-chart",
      confidence: "high",
      source: "decision-engine",
      dismissible: false,
    }));
    return dedupeAndLimit(candidates, limit);
  }

  const rangeProblem = topRangeProblem(input);
  if (rangeProblem) candidates.push(rangeProblem);

  if (input.gap > 0) {
    candidates.push(makeRecommendation({
      id: "close-saving-gap",
      reasonCode: "SAVING_GAP",
      family: "financing",
      priority: input.gap > input.planned * 0.2 ? "critical" : "high",
      level: "danger",
      title: "Close the saving gap",
      detail: `The current plan still needs more ready money or a lower trip budget.`,
      actionLabel: "Open money",
      target: { tab: "overview", section: "plan-money" },
      icon: "bullseye",
      confidence: "high",
      source: "decision-engine",
      impact: { direction: "increase", amount: input.gap, currency: input.currency, label: "Still needed" },
      dismissible: false,
    }));
  }

  if (input.everNegative) {
    candidates.push(makeRecommendation({
      id: "fix-negative-cashflow",
      reasonCode: "NEGATIVE_CASHFLOW_PERIOD",
      family: "cashflow-timing",
      priority: "high",
      level: "warning",
      title: "Fix a negative cashflow period",
      detail: "At least one month drops below zero before or during travel. Review payment dates and incoming money timing.",
      actionLabel: "Review cashflow",
      target: { tab: "cashflow" },
      icon: "activity",
      confidence: "high",
      source: "cashflow-engine",
    }));
  }

  const emergencyAmount = categoryAmount(input, "cat-emergency");
  const emergencyRange = categoryRange(input, "cat-emergency");
  const emergencyTarget = emergencyRange.typical || Math.max(input.planned * 0.08, 0);
  const emergencyLow = emergencyRange.low || emergencyTarget * 0.75;
  if (emergencyAmount <= 0) {
    candidates.push(makeRecommendation({
      id: "add-emergency-buffer",
      reasonCode: "EMERGENCY_MISSING",
      family: "safety-buffer",
      priority: "high",
      level: "warning",
      title: "Add an emergency buffer",
      detail: "The plan has no dedicated backup money for unexpected costs.",
      actionLabel: "Add emergency",
      target: { tab: "budget", categoryId: "cat-emergency" },
      icon: "shield-exclamation",
      confidence: minConfidence(input.costProfile?.confidence || "medium", "medium"),
      source: input.costProfile?.source || "cost-profile",
      categoryId: "cat-emergency",
      impact: { direction: "increase", amount: emergencyTarget, currency: input.currency, label: "Suggested buffer" },
    }));
  } else if (emergencyLow > 0 && emergencyAmount < emergencyLow) {
    candidates.push(makeRecommendation({
      id: "increase-emergency-buffer",
      reasonCode: "EMERGENCY_BELOW_RANGE",
      family: "safety-buffer",
      priority: "medium",
      level: "info",
      title: "Strengthen the emergency buffer",
      detail: "Your emergency amount is below the low planning range for this trip.",
      actionLabel: "Increase emergency",
      target: { tab: "budget", categoryId: "cat-emergency" },
      icon: "shield-check",
      confidence: minConfidence(input.costProfile?.confidence || "medium", "medium"),
      source: input.costProfile?.source || "cost-profile",
      categoryId: "cat-emergency",
      impact: { direction: "increase", amount: Math.max(0, emergencyTarget - emergencyAmount), currency: input.currency, label: "Suggested increase" },
    }));
  }

  if (input.continuingInstallments) {
    candidates.push(makeRecommendation({
      id: "review-post-trip-installments",
      reasonCode: "INSTALLMENTS_CONTINUE_AFTER_TRIP",
      family: "payment-pressure",
      priority: input.gap > 0 ? "high" : "medium",
      level: "info",
      title: "Protect money for post-trip payments",
      detail: "Some installments continue after you return. Keep enough money outside the destination budget.",
      actionLabel: "Open payments",
      target: { tab: "to pay", filter: "installments" },
      icon: "credit-card",
      confidence: "high",
      source: "payment-schedule",
    }));
  }

  if (num(input.upcomingPayments) > 0 && input.gap <= 0) {
    candidates.push(makeRecommendation({
      id: "track-upcoming-payments",
      reasonCode: "UPCOMING_PAYMENTS_EXIST",
      family: "payment-tracking",
      priority: input.decision?.verdict === "READY" ? "medium" : "low",
      level: "info",
      title: "Keep upcoming payments updated",
      detail: "Mark each payment when it happens so Ready Money and Still To Pay remain accurate.",
      actionLabel: "Open payments",
      target: { tab: "to pay" },
      icon: "check2-circle",
      confidence: "high",
      source: "payment-schedule",
      metric: `${Math.round(num(input.upcomingPayments))} upcoming`,
    }));
  }

  if (!candidates.length || (input.decision?.verdict === "READY" && candidates.every((item) => item.priority === "low"))) {
    candidates.push(makeRecommendation({
      id: "plan-ready-track",
      reasonCode: "PLAN_READY",
      family: "healthy-plan",
      priority: "positive",
      level: "success",
      title: "The plan looks healthy",
      detail: "Keep real prices and paid items updated as the trip gets closer.",
      actionLabel: "Open payments",
      target: { tab: "to pay" },
      icon: "check-circle",
      confidence: "high",
      source: "decision-engine",
    }));
  }

  return dedupeAndLimit(candidates, limit);
}

export function recommendationSummary(items = []) {
  const list = Array.isArray(items) ? items : [];
  return {
    version: RECOMMENDATION_ENGINE_VERSION,
    count: list.length,
    critical: list.filter((item) => item.priority === "critical").length,
    high: list.filter((item) => item.priority === "high").length,
    topReasonCode: list[0]?.reasonCode || null,
  };
}
