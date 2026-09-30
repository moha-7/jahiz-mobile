import { z } from "zod";

const optionalDate = z.string().datetime().or(z.string().date()).optional().nullable();


export const tripFinanceProfileSchema = z.object({
  startingSavings: z.coerce.number().min(0).default(0),
  supportMoney: z.coerce.number().min(0).default(0),
  safetyReserve: z.coerce.number().min(0).default(0),
  reserveEnabled: z.boolean().default(false),
  returnWithZero: z.boolean().default(true),
  rateBookJson: z.string().max(20000).optional().nullable(),
  schemaVersion: z.coerce.number().int().min(1).default(1)
});

export const tripFinanceProfilePatchSchema = z.object({
  startingSavings: z.coerce.number().min(0).optional(),
  supportMoney: z.coerce.number().min(0).optional(),
  safetyReserve: z.coerce.number().min(0).optional(),
  reserveEnabled: z.boolean().optional(),
  returnWithZero: z.boolean().optional(),
  rateBookJson: z.string().max(20000).optional().nullable(),
  schemaVersion: z.coerce.number().int().min(1).optional()
});

export const tripSchema = z.object({
  title: z.string().min(2).max(120),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED", "DELETED"]).optional(),
  fromCountry: z.string().max(80).optional().nullable(),
  fromAirport: z.string().max(80).optional().nullable(),
  toCountry: z.string().max(80).optional().nullable(),
  toAirport: z.string().max(80).optional().nullable(),
  departureDate: optionalDate,
  returnDate: optionalDate,
  travelers: z.coerce.number().int().min(1).max(50).default(1),
  incomeCurrency: z.string().min(3).max(3).default("AED"),
  tripCurrency: z.string().min(3).max(3).default("AED"),
  displayCurrency: z.string().min(3).max(3).optional().nullable(),
  exchangeRate: z.coerce.number().positive().default(1),
  rateMode: z.string().max(30).default("MANUAL"),
  travelStyle: z.string().max(40).default("Balanced"),
  financeProfile: tripFinanceProfileSchema.optional(),
  notes: z.string().max(200000).optional().nullable()
});

export const tripPatchSchema = tripSchema.omit({ financeProfile: true }).partial().extend({ financeProfile: tripFinanceProfilePatchSchema.optional() });

const moneyItemBase = z.object({
  title: z.string().min(1).max(120),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(3),
  frequency: z.enum(["MONTHLY", "ONE_TIME", "TRIP_TOTAL"]).default("MONTHLY"),
  startDate: optionalDate,
  endDate: optionalDate,
  expectedDate: optionalDate,
  source: z.enum(["MANUAL", "SUGGESTION", "PRESET", "SYSTEM"]).default("MANUAL")
});

export const incomeSchema = moneyItemBase.refine((v) => v.frequency !== "MONTHLY" || !!v.startDate, { message: "Monthly income needs a start date", path: ["startDate"] }).refine((v) => v.frequency !== "ONE_TIME" || !!v.expectedDate, { message: "One-time income needs an expected date", path: ["expectedDate"] });

export const lifeCostSchema = moneyItemBase.extend({ category: z.string().max(80).optional(), dueDate: optionalDate }).refine((v) => v.frequency !== "MONTHLY" || !!v.startDate, { message: "Monthly cost needs a start date", path: ["startDate"] }).refine((v) => v.frequency !== "ONE_TIME" || !!v.expectedDate, { message: "One-time cost needs an expected date", path: ["expectedDate"] });

export const installmentSchema = z.object({
  title: z.string().min(1).max(120),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(3),
  frequency: z.enum(["MONTHLY", "ONE_TIME"]).default("MONTHLY"),
  startDate: optionalDate,
  endDate: optionalDate,
  remainingMonths: z.coerce.number().int().positive().optional().nullable(),
  source: z.enum(["MANUAL", "SUGGESTION", "PRESET", "SYSTEM"]).default("MANUAL")
}).refine((v) => !!v.startDate, { message: "Installment needs a next/start due date", path: ["startDate"] });

export const tripCostSchema = z.object({
  title: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  amount: z.coerce.number().min(0),
  currency: z.string().min(3).max(3),
  timing: z.string().max(40).optional().nullable(),
  frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "ONE_TIME", "TRIP_TOTAL"]).default("TRIP_TOTAL"),
  priority: z.string().max(40).optional().nullable(),
  status: z.enum(["UNPAID", "PAID"]).optional(),
  paidDate: optionalDate,
  dueDate: optionalDate,
  source: z.enum(["MANUAL", "SUGGESTION", "PRESET", "SYSTEM"]).default("MANUAL")
});

export const expenseSchema = z.object({
  title: z.string().min(1).max(120),
  category: z.string().min(1).max(80),
  amount: z.coerce.number().positive(),
  currency: z.string().min(3).max(3),
  date: z.string().datetime().or(z.string().date()),
  note: z.string().max(1000).optional().nullable()
});

export const statusSchema = z.object({ status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED", "DELETED"]) });
