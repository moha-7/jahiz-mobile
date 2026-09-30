import type { PrismaClient, TripStatus } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { HttpError } from "../../utils/httpError.js";
import { getPermissions } from "../rbac/permissions.js";

export async function assertTripOwner(tripId: string, userId: string) {
  const trip = await prisma.trip.findFirst({ where: { id: tripId, userId, status: { not: "DELETED" } } });
  if (!trip) throw new HttpError(404, "Trip not found");
  return trip;
}

export async function enforceTripLimit(user: any, status: TripStatus) {
  if (status !== "ACTIVE" && status !== "DRAFT") return;
  const permissions = getPermissions(user);
  const max = status === "ACTIVE" ? permissions.maxActiveTrips : permissions.maxDraftTrips;
  if (!Number.isFinite(max)) return;
  const count = await prisma.trip.count({ where: { userId: user.id, status } });
  if (count >= max) {
    throw new HttpError(403, `Your ${user.plan} plan allows only ${max} ${status.toLowerCase()} trips`);
  }
}

export function includeTripRelations() {
  return {
    incomes: true,
    lifeCosts: true,
    installments: true,
    tripCosts: true,
    expenses: true,
    suggestions: true,
    paymentMarks: true,
    financeProfile: true
  } as const;
}
