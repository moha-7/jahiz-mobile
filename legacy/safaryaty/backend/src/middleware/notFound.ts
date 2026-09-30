import type { Request, Response } from "express";

export function notFound(req: Request, res: Response) {
  return res.status(404).json({ ok: false, message: `Route not found: ${req.method} ${req.path}` });
}
