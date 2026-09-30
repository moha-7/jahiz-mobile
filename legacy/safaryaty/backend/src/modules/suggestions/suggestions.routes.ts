import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/httpError.js";
import { ok } from "../../utils/response.js";
import { assertTripOwner, includeTripRelations } from "../trips/trips.service.js";
import { generateTripSuggestions } from "./suggestions.engine.js";
import { canonicalTripCategory, tripCategoryLabel } from "../finance/categories.js";
import { getCostProfileEnvelope } from "../external/costProfile.adapter.js";
import { readFinanceSettingsFromTripRow } from "../../../../shared/trip-finance-profile.js";

const router = Router();
router.use(requireAuth);

router.post("/trips/:tripId/suggestions/generate", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  await assertTripOwner(req.params.tripId, user.id);
  const trip = await prisma.trip.findUniqueOrThrow({ where: { id: req.params.tripId }, include: includeTripRelations() });
  const financeSettings = readFinanceSettingsFromTripRow(trip as any);
  const tripDays = trip.departureDate && trip.returnDate
    ? Math.max(1, Math.ceil((trip.returnDate.getTime() - trip.departureDate.getTime()) / 86400000))
    : 7;
  const profileEnvelope = await getCostProfileEnvelope({
    destinationCountry: trip.toCountry,
    tripCurrency: trip.tripCurrency,
    comfortLevel: trip.travelStyle || "Balanced",
    days: tripDays,
    travelers: Math.max(1, Number(trip.travelers || 1)),
    rateBook: financeSettings.rateBook || {}
  });
  const profile: any = profileEnvelope.data || {};
  if (String(profile.currency || "").toUpperCase() !== String(trip.tripCurrency || "").toUpperCase()) {
    throw new HttpError(502, `Unable to convert destination estimates to ${trip.tripCurrency}`);
  }
  const estimatedCategories = Object.fromEntries(
    Object.entries(profile.categories || {}).map(([categoryId, row]: any) => [categoryId, Number(row?.typical || 0)])
  );
  const generated = generateTripSuggestions({ trip, tripCosts: trip.tripCosts, estimatedCategories });
  const existing = await prisma.presetSuggestion.findMany({ where: { tripId: trip.id }, orderBy: { updatedAt: "desc" } });
  const coveredCategories = new Set(trip.tripCosts.map((cost) => canonicalTripCategory(cost.category || cost.title)));

  await prisma.$transaction(async (tx) => {
    for (const item of generated) {
      const category = canonicalTripCategory(item.category);
      const matches = existing.filter((row) => canonicalTripCategory(row.category) === category);
      const keeper = matches.find((row) => row.status === "ACCEPTED") || matches[0];
      const status = coveredCategories.has(category) ? "ACCEPTED" : keeper?.status === "IGNORED" ? "IGNORED" : "PENDING";
      const data = {
        category,
        currentAmount: item.currentAmount,
        suggestedAmount: item.suggestedAmount,
        currency: item.currency,
        difference: item.difference,
        message: item.message,
        status: status as any
      };
      if (keeper) await tx.presetSuggestion.update({ where: { id: keeper.id }, data });
      else await tx.presetSuggestion.create({ data: { tripId: trip.id, ...data } });
      const duplicateIds = matches.filter((row) => row.id !== keeper?.id).map((row) => row.id);
      if (duplicateIds.length) await tx.presetSuggestion.deleteMany({ where: { id: { in: duplicateIds } } });
    }
  });

  const suggestions = await prisma.presetSuggestion.findMany({
    where: { tripId: trip.id, status: { in: ["PENDING", "ACCEPTED"] } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }]
  });
  res.json(ok({ suggestions }));
}));

router.get("/trips/:tripId/suggestions", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  await assertTripOwner(req.params.tripId, user.id);
  const suggestions = await prisma.presetSuggestion.findMany({
    where: { tripId: req.params.tripId, status: { in: ["PENDING", "ACCEPTED"] } },
    orderBy: { updatedAt: "desc" }
  });
  res.json(ok({ suggestions }));
}));

router.post("/suggestions/:id/apply", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const suggestion = await prisma.presetSuggestion.findFirst({ where: { id: req.params.id }, include: { trip: true } });
  if (!suggestion || suggestion.trip.userId !== user.id) throw new HttpError(404, "Suggestion not found");
  const requestedAmount = Number((req.body || {}).amount);
  const amount = Number.isFinite(requestedAmount) && requestedAmount >= 0 ? requestedAmount : suggestion.suggestedAmount;
  const category = canonicalTripCategory(suggestion.category);
  const title = tripCategoryLabel(category, suggestion.category || "Trip Cost");

  const result = await prisma.$transaction(async (tx) => {
    const suggestionCosts = await tx.tripCost.findMany({
      where: {
        tripId: suggestion.tripId,
        source: "SUGGESTION",
        OR: [{ category }, { category: suggestion.category }, { title }]
      },
      orderBy: { updatedAt: "desc" }
    });
    const existing = suggestionCosts[0];
    const cost = existing
      ? await tx.tripCost.update({ where: { id: existing.id }, data: { amount, currency: suggestion.currency, category, title, source: "SUGGESTION" } })
      : await tx.tripCost.create({ data: { tripId: suggestion.tripId, title, category, amount, currency: suggestion.currency, source: "SUGGESTION" } });
    const duplicateIds = suggestionCosts.slice(1).map((row) => row.id);
    if (duplicateIds.length) await tx.tripCost.deleteMany({ where: { id: { in: duplicateIds } } });
    const updated = await tx.presetSuggestion.update({
      where: { id: suggestion.id },
      data: { status: "ACCEPTED", suggestedAmount: amount, difference: amount - suggestion.currentAmount, category }
    });
    return { suggestion: updated, cost };
  });
  res.json(ok(result));
}));

router.post("/suggestions/:id/restore", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const suggestion = await prisma.presetSuggestion.findFirst({ where: { id: req.params.id }, include: { trip: true } });
  if (!suggestion || suggestion.trip.userId !== user.id) throw new HttpError(404, "Suggestion not found");
  const updated = await prisma.presetSuggestion.update({
    where: { id: suggestion.id },
    data: { status: "PENDING", category: canonicalTripCategory(suggestion.category) }
  });
  res.json(ok({ suggestion: updated }));
}));

router.post("/suggestions/:id/ignore", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const suggestion = await prisma.presetSuggestion.findFirst({ where: { id: req.params.id }, include: { trip: true } });
  if (!suggestion || suggestion.trip.userId !== user.id) throw new HttpError(404, "Suggestion not found");
  const updated = await prisma.presetSuggestion.update({ where: { id: suggestion.id }, data: { status: "IGNORED" } });
  res.json(ok({ suggestion: updated }));
}));

export default router;
