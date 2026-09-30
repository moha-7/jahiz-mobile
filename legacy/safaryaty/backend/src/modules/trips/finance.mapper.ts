import type { PrismaClient } from "@prisma/client";
import { canonicalTripCategory, tripCategoryLabel } from "../finance/categories.js";
import { upsertTripFinanceProfile } from "./trip-finance-profile.service.js";

type AnyTrip = Record<string, any>;

function toDate(value: any): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function currency(value: any, fallback = "AED") {
  return String(value || fallback).toUpperCase().slice(0, 3);
}

function positive(value: any) {
  const n = Number(value || 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function frequency(value: any, fallback: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY" | "ONE_TIME" | "TRIP_TOTAL" = "MONTHLY") {
  const raw = String(value || "").toLowerCase().replace(/_/g, "-");
  if (raw === "daily") return "DAILY" as const;
  if (raw === "weekly") return "WEEKLY" as const;
  if (raw === "monthly") return "MONTHLY" as const;
  if (raw === "yearly") return "YEARLY" as const;
  if (raw === "one-time" || raw === "once") return "ONE_TIME" as const;
  if (raw === "trip-total") return "TRIP_TOTAL" as const;
  return fallback;
}

function paymentStatus(value: any) {
  return value ? "PAID" as const : "UNPAID" as const;
}

function sourceType(value: any) {
  const raw = String(value || "MANUAL").toUpperCase();
  if (["MANUAL", "SUGGESTION", "PRESET", "SYSTEM"].includes(raw)) return raw as any;
  return "MANUAL" as const;
}

function categoryName(categoryId: string | undefined, fallback = "Other") {
  return tripCategoryLabel(categoryId, fallback);
}

function categoryId(value: string | undefined, fallback = "cat-other-trip") {
  return canonicalTripCategory(value, fallback);
}


export function normalizeClientTrip(raw: any): AnyTrip {
  if (!raw) return {};
  if (raw.trip) return raw.trip;
  if (raw.version && raw.trip) return raw.trip;
  return raw;
}

export async function replaceFinanceFromClientTrip(prisma: PrismaClient, tripId: string, clientTripInput: any) {
  const trip = normalizeClientTrip(clientTripInput);
  const baseCurrency = currency(trip.baseCurrency, "AED");
  const tripCurrency = currency(trip.tripCurrency, baseCurrency);

  await prisma.$transaction(async (tx) => {
    // Dual-write normalized trip-level finance settings and the legacy snapshot during transition.
    await upsertTripFinanceProfile(tx, tripId, trip);
    await tx.trip.update({
      where: { id: tripId },
      data: { notes: JSON.stringify({ version: "client-trip-v3-normalized-finance", trip }) }
    });
    await tx.income.deleteMany({ where: { tripId } });
    await tx.lifeCost.deleteMany({ where: { tripId } });
    await tx.installment.deleteMany({ where: { tripId } });
    await tx.tripCost.deleteMany({ where: { tripId } });
    await tx.expense.deleteMany({ where: { tripId } });

    const incomes = (trip.incomeSources || [])
      .filter((item: any) => item.enabled !== false && positive(item.amountBase) > 0)
      .map((item: any) => {
        const f = frequency(item.frequency, "MONTHLY");
        const startDate = f === "MONTHLY" ? toDate(item.nextDate || trip.startDate) : null;
        const expectedDate = f === "ONE_TIME" ? toDate(item.nextDate || item.expectedDate || trip.startDate) : null;
        return {
          tripId,
          title: item.name || "Income",
          amount: positive(item.amountBase),
          currency: baseCurrency,
          frequency: f === "TRIP_TOTAL" ? "ONE_TIME" as const : f,
          startDate,
          endDate: toDate(item.untilDate || trip.endDate),
          expectedDate,
          source: sourceType(item.source)
        };
      });
    if (incomes.length) await tx.income.createMany({ data: incomes });

    const lifeCosts = (trip.lifeCosts || [])
      .filter((item: any) => item.enabled !== false && item.canPause !== true && positive(item.amountBase) > 0)
      .map((item: any) => {
        const f = frequency(item.frequency, "MONTHLY");
        return {
          tripId,
          title: item.name || "Life Cost",
          category: item.categoryId || categoryName(item.categoryId, "Life Cost"),
          amount: positive(item.amountBase),
          currency: baseCurrency,
          frequency: f === "TRIP_TOTAL" ? "ONE_TIME" as const : f,
          startDate: f === "MONTHLY" ? toDate(item.nextDate || trip.startDate) : null,
          endDate: toDate(item.untilDate || trip.endDate),
          dueDate: f === "ONE_TIME" ? toDate(item.nextDate || trip.startDate) : null,
          source: sourceType(item.source)
        };
      });
    if (lifeCosts.length) await tx.lifeCost.createMany({ data: lifeCosts });

    const installments = (trip.installments || [])
      .filter((item: any) => item.enabled !== false && positive(item.monthlyBase ?? item.amountBase ?? item.amount) > 0)
      .map((item: any) => ({
        tripId,
        title: item.name || "Installment",
        amount: positive(item.monthlyBase ?? item.amountBase ?? item.amount),
        currency: baseCurrency,
        frequency: frequency(item.frequency, "MONTHLY") === "ONE_TIME" ? "ONE_TIME" as const : "MONTHLY" as const,
        startDate: toDate(item.nextDate || item.startDate || trip.startDate),
        endDate: toDate(item.untilDate || item.endDate || trip.endDate),
        remainingMonths: item.remainingMonths ? Number(item.remainingMonths) : null,
        status: "UNPAID" as const,
        paidDate: null,
        source: sourceType(item.source)
      }));
    if (installments.length) await tx.installment.createMany({ data: installments });

    const tripCosts = (trip.budget || [])
      .filter((item: any) => positive(item.amountLocal) >= 0 && item.name)
      .map((item: any) => ({
        tripId,
        title: item.name || categoryName(item.categoryId, "Trip Cost"),
        category: categoryId(item.categoryId, "cat-other-trip"),
        // amount remains the entered unit amount. Frequency determines the effective total.
        amount: positive(item.amountLocal),
        currency: tripCurrency,
        timing: item.timing || null,
        frequency: frequency(item.frequency || item.costType, "TRIP_TOTAL"),
        priority: item.priority || null,
        status: paymentStatus(item.paid),
        paidDate: item.paid ? new Date() : null,
        dueDate: toDate(item.nextDate || trip.startDate || null),
        source: sourceType(item.source)
      }));
    if (tripCosts.length) await tx.tripCost.createMany({ data: tripCosts });

    const expenses = (trip.expenses || [])
      .filter((item: any) => positive(item.amount) > 0)
      .map((item: any) => ({
        tripId,
        title: item.title || item.name || "Expense",
        category: item.category || "Other",
        amount: positive(item.amount),
        currency: currency(item.currency, tripCurrency),
        amountBase: positive(item.amountBase ?? item.amount),
        date: toDate(item.date || trip.startDate) || new Date(),
        note: item.note || null
      }));
    if (expenses.length) await tx.expense.createMany({ data: expenses });
  });

  return getFinanceCounts(prisma, tripId);
}

export async function getFinanceCounts(prisma: PrismaClient, tripId: string) {
  const [incomes, lifeCosts, installments, tripCosts, expenses] = await Promise.all([
    prisma.income.count({ where: { tripId } }),
    prisma.lifeCost.count({ where: { tripId } }),
    prisma.installment.count({ where: { tripId } }),
    prisma.tripCost.count({ where: { tripId } }),
    prisma.expense.count({ where: { tripId } })
  ]);
  return { incomes, lifeCosts, installments, tripCosts, expenses };
}
