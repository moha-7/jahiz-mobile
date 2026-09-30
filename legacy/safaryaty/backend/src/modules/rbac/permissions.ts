import type { Plan, Role } from "@prisma/client";

export function getPermissions(user: { role: Role; plan: Plan }) {
  const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
  const isSuperAdmin = user.role === "SUPER_ADMIN";
  const isPro = user.plan === "PRO" || user.plan === "BUSINESS" || isAdmin;

  return {
    isAdmin,
    isSuperAdmin,
    isPro,
    maxActiveTrips: isPro ? Number.POSITIVE_INFINITY : 2,
    maxDraftTrips: isPro ? Number.POSITIVE_INFINITY : 2,
    canUseAdvancedSuggestions: isPro,
    canSaveCustomPresets: isPro,
    canExportPDF: isPro,
    canManageUsers: isAdmin,
    canManagePresets: isAdmin
  };
}
