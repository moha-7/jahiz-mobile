import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/httpError.js";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(422).json({ ok: false, message: "Validation failed", errors: err.flatten() });
  }

  if (err instanceof HttpError) {
    return res.status(err.status).json({ ok: false, message: err.message, details: err.details });
  }

  if (err instanceof Error) {
    return res.status(500).json({ ok: false, message: err.message || "Internal server error" });
  }

  return res.status(500).json({ ok: false, message: "Internal server error" });
};
