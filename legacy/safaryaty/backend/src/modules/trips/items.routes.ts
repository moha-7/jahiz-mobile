import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { HttpError } from "../../utils/httpError.js";
import { ok } from "../../utils/response.js";
import { z } from "zod";

const router = Router();
router.use(requireAuth);

const optionalDate = z.string().datetime().or(z.string().date()).optional().nullable();
const currencySchema = z.string().trim().length(3).transform((v) => v.toUpperCase());
const frequencySchema = z.enum(["MONTHLY", "ONE_TIME", "TRIP_TOTAL"]);
const tripCostFrequencySchema = z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "ONE_TIME", "TRIP_TOTAL"]);
const sourceSchema = z.enum(["MANUAL", "SUGGESTION", "PRESET", "SYSTEM"]);

const incomePatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  amount: z.coerce.number().positive().optional(),
  currency: currencySchema.optional(),
  frequency: frequencySchema.optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  expectedDate: optionalDate,
  source: sourceSchema.optional()
}).strict();

const lifeCostPatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  category: z.string().max(80).optional().nullable(),
  amount: z.coerce.number().positive().optional(),
  currency: currencySchema.optional(),
  frequency: frequencySchema.optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  dueDate: optionalDate,
  source: sourceSchema.optional()
}).strict();

const installmentPatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  amount: z.coerce.number().positive().optional(),
  currency: currencySchema.optional(),
  frequency: z.enum(["MONTHLY", "ONE_TIME"]).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
  remainingMonths: z.coerce.number().int().positive().optional().nullable(),
  status: z.enum(["UNPAID", "PAID"]).optional(),
  paidDate: optionalDate,
  source: sourceSchema.optional()
}).strict();

const tripCostPatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(80).optional(),
  amount: z.coerce.number().min(0).optional(),
  currency: currencySchema.optional(),
  timing: z.string().max(40).optional().nullable(),
  frequency: tripCostFrequencySchema.optional(),
  priority: z.string().max(40).optional().nullable(),
  status: z.enum(["UNPAID", "PAID"]).optional(),
  dueDate: optionalDate,
  paidDate: optionalDate,
  source: sourceSchema.optional()
}).strict();

const expensePatchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  category: z.string().min(1).max(80).optional(),
  amount: z.coerce.number().positive().optional(),
  currency: currencySchema.optional(),
  amountBase: z.coerce.number().positive().optional(),
  date: optionalDate,
  note: z.string().max(1000).optional().nullable()
}).strict();

function asDate(value: any) {
  if (!value) return null;
  return new Date(value);
}

function dateFields<T extends Record<string, any>>(input: T, fields: string[]) {
  const out: Record<string, any> = { ...input };
  for (const field of fields) if (field in out) out[field] = asDate(out[field]);
  return out;
}

const patchMap: Record<string, { model: any; schema: z.ZodTypeAny; dateFields: string[] }> = {
  incomes: { model: prisma.income, schema: incomePatchSchema, dateFields: ["startDate", "endDate", "expectedDate"] },
  "life-costs": { model: prisma.lifeCost, schema: lifeCostPatchSchema, dateFields: ["startDate", "endDate", "dueDate"] },
  installments: { model: prisma.installment, schema: installmentPatchSchema, dateFields: ["startDate", "endDate", "paidDate"] },
  costs: { model: prisma.tripCost, schema: tripCostPatchSchema, dateFields: ["dueDate", "paidDate"] },
  expenses: { model: prisma.expense, schema: expensePatchSchema, dateFields: ["date"] }
};

async function assertItemOwner(model: any, id: string, userId: string) {
  const item = await model.findFirst({ where: { id }, include: { trip: true } });
  if (!item || item.trip.userId !== userId || item.trip.status === "DELETED") throw new HttpError(404, "Item not found");
  return item;
}

router.patch("/costs/:id/mark-paid", asyncHandler(async (req, res) => {
  await assertItemOwner(prisma.tripCost, req.params.id, (req as any).user.id);
  const cost = await prisma.tripCost.update({ where: { id: req.params.id }, data: { status: "PAID", paidDate: new Date() } });
  res.json(ok({ cost }));
}));

router.patch("/costs/:id/undo-paid", asyncHandler(async (req, res) => {
  await assertItemOwner(prisma.tripCost, req.params.id, (req as any).user.id);
  const cost = await prisma.tripCost.update({ where: { id: req.params.id }, data: { status: "UNPAID", paidDate: null } });
  res.json(ok({ cost }));
}));

router.patch("/installments/:id/mark-paid", asyncHandler(async (req, res) => {
  await assertItemOwner(prisma.installment, req.params.id, (req as any).user.id);
  const installment = await prisma.installment.update({ where: { id: req.params.id }, data: { status: "PAID", paidDate: new Date() } });
  res.json(ok({ installment }));
}));

router.patch("/installments/:id/undo-paid", asyncHandler(async (req, res) => {
  await assertItemOwner(prisma.installment, req.params.id, (req as any).user.id);
  const installment = await prisma.installment.update({ where: { id: req.params.id }, data: { status: "UNPAID", paidDate: null } });
  res.json(ok({ installment }));
}));

router.patch("/:model/:id", asyncHandler(async (req, res) => {
  const config = patchMap[req.params.model];
  if (!config) throw new HttpError(404, "Unknown item type");
  await assertItemOwner(config.model, req.params.id, (req as any).user.id);
  const input = config.schema.parse(req.body);
  if (Object.keys(input as Record<string, unknown>).length === 0) throw new HttpError(422, "No valid fields to update");
  const item = await config.model.update({ where: { id: req.params.id }, data: dateFields(input as Record<string, any>, config.dateFields) });
  res.json(ok({ item }));
}));

router.delete("/:model/:id", asyncHandler(async (req, res) => {
  const map: Record<string, any> = {
    incomes: prisma.income,
    "life-costs": prisma.lifeCost,
    installments: prisma.installment,
    costs: prisma.tripCost,
    expenses: prisma.expense
  };
  const model = map[req.params.model];
  if (!model) throw new HttpError(404, "Unknown item type");
  const item = await model.findFirst({ where: { id: req.params.id }, include: { trip: true } });
  if (!item) return res.json(ok({ deleted: true, alreadyRemoved: true }));
  if (item.trip.userId !== (req as any).user.id || item.trip.status === "DELETED") throw new HttpError(404, "Item not found");
  await model.delete({ where: { id: req.params.id } });
  res.json(ok({ deleted: true }));
}));

export default router;
