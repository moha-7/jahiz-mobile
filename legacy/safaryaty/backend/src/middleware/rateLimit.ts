import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

function keyFromRequest(req: Request, prefix: string) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase().trim() : "no-email";
  return `${prefix}:${ip}:${email}`;
}

export function rateLimit(options: { windowMs: number; max: number; prefix: string; message?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = keyFromRequest(req, options.prefix);
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }
    current.count += 1;
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    if (current.count > options.max) return next(new HttpError(429, options.message || "Too many attempts. Try again later."));
    return next();
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) if (bucket.resetAt <= now) buckets.delete(key);
}, 5 * 60 * 1000).unref();
