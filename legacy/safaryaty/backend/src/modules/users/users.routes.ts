import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../rbac/requirePermission.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/response.js";

const router = Router();
router.use(requireAuth);

router.get("/", requirePermission("canManageUsers"), asyncHandler(async (_req, res) => {
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, name: true, email: true, role: true, plan: true, createdAt: true, updatedAt: true } });
  res.json(ok({ users }));
}));

export default router;
