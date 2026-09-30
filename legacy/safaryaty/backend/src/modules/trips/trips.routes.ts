import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/httpError.js";
import { ok } from "../../utils/response.js";
import { calculateTrip } from "../finance/cashflow.engine.js";
import { changeTripCurrencyContext } from "../finance/currency-context.service.js";
import { getFinanceCounts, replaceFinanceFromClientTrip } from "./finance.mapper.js";
import { financeProfilePatchData, financeSettingsFromTripRow, mergeFinanceProfilePatch } from "./trip-finance-profile.service.js";
import { mergeFinanceProfileIntoClientTrip, parseTripSnapshot } from "../../../../shared/trip-finance-profile.js";
import { assertTripOwner, enforceTripLimit, includeTripRelations } from "./trips.service.js";
import { expenseSchema, incomeSchema, installmentSchema, lifeCostSchema, statusSchema, tripCostSchema, tripPatchSchema, tripSchema } from "./trips.validators.js";

const router = Router();
router.use(requireAuth);

const currencyContextSchema = z.object({
  incomeCurrency: z.string().length(3).optional(),
  tripCurrency: z.string().length(3).optional(),
  origin: z.object({ countryCode: z.string().min(2).max(3).optional(), airportCode: z.string().max(8).optional() }).optional(),
  destination: z.object({ countryCode: z.string().min(2).max(3).optional(), airportCode: z.string().max(8).optional() }).optional()
}).refine((value) => Boolean(value.incomeCurrency || value.tripCurrency || value.origin || value.destination), { message: "Provide a currency or route change" });

function asDate(value: any) {
  if (!value) return null;
  return new Date(value);
}

function dateFields<T extends Record<string, any>>(input: T, fields: readonly (keyof T)[]): T {
  const out = { ...input } as T;
  for (const field of fields) if (field in out) (out as any)[field] = asDate((out as any)[field]);
  return out;
}

router.get("/", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const status = typeof req.query.status === "string" ? req.query.status : undefined;
  const page = Math.max(1, Number(req.query.page || 1));
  const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize || 25)));
  const where = { userId: user.id, status: status as any || { not: "DELETED" } };
  const [trips, total] = await Promise.all([
    prisma.trip.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { financeProfile: true, _count: { select: { incomes: true, lifeCosts: true, installments: true, tripCosts: true, expenses: true, suggestions: true } } }
    }),
    prisma.trip.count({ where })
  ]);
  res.json(ok({ trips, pagination: { page, pageSize, total, hasMore: page * pageSize < total } }));
}));

router.post("/", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const input = tripSchema.parse(req.body);
  const { financeProfile, ...tripInput } = input;
  const status = tripInput.status || "DRAFT";
  await enforceTripLimit(user, status as any);
  const trip = await prisma.trip.create({
    data: {
      ...dateFields(tripInput, ["departureDate", "returnDate"]),
      status,
      user: { connect: { id: user.id } },
      ...(financeProfile ? { financeProfile: { create: financeProfilePatchData(financeProfile) } } : {})
    },
    include: includeTripRelations()
  });
  res.status(201).json(ok({ trip }));
}));

router.get("/:tripId", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: user.id, status: { not: "DELETED" } }, include: includeTripRelations() });
  if (!trip) throw new HttpError(404, "Trip not found");
  res.json(ok({ trip }));
}));

router.patch("/:tripId/currency-context", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const input = currencyContextSchema.parse(req.body);
  const result = await changeTripCurrencyContext(prisma, req.params.tripId, user.id, input);
  const summary = calculateTrip({
    trip: result.trip,
    incomes: result.trip.incomes,
    lifeCosts: result.trip.lifeCosts,
    installments: result.trip.installments,
    tripCosts: result.trip.tripCosts,
    expenses: result.trip.expenses,
    paymentMarks: (result.trip as any).paymentMarks || []
  });
  res.json(ok({ ...result, summary }));
}));

router.patch("/:tripId", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  await assertTripOwner(req.params.tripId, user.id);
  const input = tripPatchSchema.parse(req.body);
  const { financeProfile, ...tripInput } = input;
  const currentProfileRow = financeProfile
    ? await prisma.trip.findUnique({ where: { id: req.params.tripId }, select: { notes: true, financeProfile: true } })
    : null;
  const currentSettings = currentProfileRow ? financeSettingsFromTripRow(currentProfileRow) : null;
  const existingProfile = currentSettings ? {
    startingSavings: currentSettings.startingSavings,
    supportMoney: currentSettings.supportMoney,
    safetyReserve: currentSettings.safetyReserve,
    reserveEnabled: currentSettings.reserveEnabled,
    returnWithZero: currentSettings.returnWithZero,
    rateBookJson: currentSettings.rateBookJson,
    schemaVersion: currentSettings.schemaVersion,
  } : null;
  const profileData = financeProfile ? mergeFinanceProfilePatch(existingProfile, financeProfile) : null;
  const normalizedTripInput: Record<string, any> = { ...tripInput };
  if (profileData && currentProfileRow) {
    const snapshot = parseTripSnapshot(normalizedTripInput.notes ?? currentProfileRow.notes);
    const mergedClientTrip = mergeFinanceProfileIntoClientTrip(snapshot.trip || {}, profileData);
    normalizedTripInput.notes = JSON.stringify({ ...snapshot, version: "client-trip-v3-normalized-finance", trip: mergedClientTrip });
  }
  const trip = await prisma.trip.update({
    where: { id: req.params.tripId },
    data: {
      ...dateFields(normalizedTripInput, ["departureDate", "returnDate"]),
      ...(profileData ? { financeProfile: { upsert: { create: profileData, update: profileData } } } : {})
    },
    include: includeTripRelations()
  });
  res.json(ok({ trip }));
}));

router.patch("/:tripId/status", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  await assertTripOwner(req.params.tripId, user.id);
  const { status } = statusSchema.parse(req.body);
  if (status === "ACTIVE" || status === "DRAFT") await enforceTripLimit(user, status);
  const trip = await prisma.trip.update({ where: { id: req.params.tripId }, data: { status }, include: includeTripRelations() });
  res.json(ok({ trip }));
}));

router.post("/:tripId/finish", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const existing = await assertTripOwner(req.params.tripId, user.id);
  if (!existing.departureDate || !existing.returnDate || !existing.fromCountry || !existing.toCountry) {
    throw new HttpError(422, "Complete route and dates before finishing the draft");
  }
  await enforceTripLimit(user, "ACTIVE");
  const trip = await prisma.trip.update({ where: { id: req.params.tripId }, data: { status: "ACTIVE" }, include: includeTripRelations() });
  res.json(ok({ trip }));
}));

router.delete("/:tripId", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  await assertTripOwner(req.params.tripId, user.id);
  await prisma.trip.update({ where: { id: req.params.tripId }, data: { status: "DELETED" } });
  res.json(ok({ deleted: true }));
}));


router.get("/:tripId/finance", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: user.id, status: { not: "DELETED" } }, include: includeTripRelations() });
  if (!trip) throw new HttpError(404, "Trip not found");
  res.json(ok({
    finance: {
      incomes: trip.incomes,
      lifeCosts: trip.lifeCosts,
      installments: trip.installments,
      tripCosts: trip.tripCosts,
      expenses: trip.expenses
    },
    summary: calculateTrip({ trip, incomes: trip.incomes, lifeCosts: trip.lifeCosts, installments: trip.installments, tripCosts: trip.tripCosts, expenses: trip.expenses, paymentMarks: (trip as any).paymentMarks || [] })
  }));
}));

router.post("/:tripId/finance/sync-client-snapshot", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const trip = await assertTripOwner(req.params.tripId, user.id);
  const counts = await replaceFinanceFromClientTrip(prisma, trip.id, req.body?.trip || req.body);
  const refreshed = await prisma.trip.findFirst({ where: { id: trip.id, userId: user.id, status: { not: "DELETED" } }, include: includeTripRelations() });
  if (!refreshed) throw new HttpError(404, "Trip not found");
  res.json(ok({
    counts,
    trip: refreshed,
    summary: calculateTrip({ trip: refreshed, incomes: refreshed.incomes, lifeCosts: refreshed.lifeCosts, installments: refreshed.installments, tripCosts: refreshed.tripCosts, expenses: refreshed.expenses, paymentMarks: (refreshed as any).paymentMarks || [] })
  }));
}));

router.get("/:tripId/summary", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const trip = await prisma.trip.findFirst({ where: { id: req.params.tripId, userId: user.id, status: { not: "DELETED" } }, include: includeTripRelations() });
  if (!trip) throw new HttpError(404, "Trip not found");
  res.json(ok({ summary: calculateTrip({ trip, incomes: trip.incomes, lifeCosts: trip.lifeCosts, installments: trip.installments, tripCosts: trip.tripCosts, expenses: trip.expenses, paymentMarks: (trip as any).paymentMarks || [] }) }));
}));



router.patch("/:tripId/payments/:paymentKey/mark-paid", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const trip = await assertTripOwner(req.params.tripId, user.id);
  const mark = await prisma.paymentMark.upsert({
    where: { tripId_paymentKey: { tripId: trip.id, paymentKey: req.params.paymentKey } },
    create: { tripId: trip.id, paymentKey: req.params.paymentKey, status: "PAID", paidDate: new Date() },
    update: { status: "PAID", paidDate: new Date() }
  });
  const refreshed = await prisma.trip.findFirst({ where: { id: trip.id, userId: user.id, status: { not: "DELETED" } }, include: includeTripRelations() });
  if (!refreshed) throw new HttpError(404, "Trip not found");
  res.json(ok({ mark, summary: calculateTrip({ trip: refreshed, incomes: refreshed.incomes, lifeCosts: refreshed.lifeCosts, installments: refreshed.installments, tripCosts: refreshed.tripCosts, expenses: refreshed.expenses, paymentMarks: (refreshed as any).paymentMarks || [] }) }));
}));

router.patch("/:tripId/payments/:paymentKey/undo-paid", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const trip = await assertTripOwner(req.params.tripId, user.id);
  const mark = await prisma.paymentMark.upsert({
    where: { tripId_paymentKey: { tripId: trip.id, paymentKey: req.params.paymentKey } },
    create: { tripId: trip.id, paymentKey: req.params.paymentKey, status: "UNPAID", paidDate: null },
    update: { status: "UNPAID", paidDate: null }
  });
  const refreshed = await prisma.trip.findFirst({ where: { id: trip.id, userId: user.id, status: { not: "DELETED" } }, include: includeTripRelations() });
  if (!refreshed) throw new HttpError(404, "Trip not found");
  res.json(ok({ mark, summary: calculateTrip({ trip: refreshed, incomes: refreshed.incomes, lifeCosts: refreshed.lifeCosts, installments: refreshed.installments, tripCosts: refreshed.tripCosts, expenses: refreshed.expenses, paymentMarks: (refreshed as any).paymentMarks || [] }) }));
}));

router.post("/:tripId/incomes", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  await assertTripOwner(req.params.tripId, user.id);
  const input = incomeSchema.parse(req.body);
  const income = await prisma.income.create({ data: { ...dateFields(input, ["startDate", "endDate", "expectedDate"]), tripId: req.params.tripId } });
  res.status(201).json(ok({ income }));
}));

router.post("/:tripId/life-costs", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  await assertTripOwner(req.params.tripId, user.id);
  const input = lifeCostSchema.parse(req.body);
  const { expectedDate: _expectedDate, ...lifeCostInput } = input as any;
  const lifeCost = await prisma.lifeCost.create({ data: { ...dateFields(lifeCostInput, ["startDate", "endDate", "dueDate"]), tripId: req.params.tripId } });
  res.status(201).json(ok({ lifeCost }));
}));

router.post("/:tripId/installments", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  await assertTripOwner(req.params.tripId, user.id);
  const input = installmentSchema.parse(req.body);
  const installment = await prisma.installment.create({ data: { ...dateFields(input, ["startDate", "endDate"]), tripId: req.params.tripId } });
  res.status(201).json(ok({ installment }));
}));

router.post("/:tripId/costs", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  await assertTripOwner(req.params.tripId, user.id);
  const input = tripCostSchema.parse(req.body);
  const cost = await prisma.tripCost.create({ data: { ...dateFields(input, ["dueDate", "paidDate"]), tripId: req.params.tripId } });
  const refreshed = await prisma.trip.findUnique({ where: { id: req.params.tripId }, include: includeTripRelations() });
  const summary = refreshed ? calculateTrip({ trip: refreshed, incomes: refreshed.incomes, lifeCosts: refreshed.lifeCosts, installments: refreshed.installments, tripCosts: refreshed.tripCosts, expenses: refreshed.expenses, paymentMarks: (refreshed as any).paymentMarks || [] }) : null;
  res.status(201).json(ok({ cost, summary }));
}));

router.post("/:tripId/expenses", asyncHandler(async (req, res) => {
  const user = (req as any).user;
  const trip = await assertTripOwner(req.params.tripId, user.id);
  const input = expenseSchema.parse(req.body);
  const amountBase = input.currency === trip.tripCurrency ? input.amount : input.amount * trip.exchangeRate;
  const expense = await prisma.expense.create({ data: { ...dateFields(input, ["date"]), amountBase, tripId: req.params.tripId } });
  res.status(201).json(ok({ expense }));
}));

export default router;
