import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { hashToken } from "../utils/crypto.js";
import { HttpError } from "../utils/httpError.js";

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const bearer = req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null;
  const cookieToken = req.cookies?.[env.SESSION_COOKIE_NAME];
  const token = bearer || cookieToken;

  if (!token) return next(new HttpError(401, "Authentication required"));

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true }
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    return next(new HttpError(401, "Session expired or invalid"));
  }

  (req as any).session = session;
  (req as any).user = session.user;
  next();
}
