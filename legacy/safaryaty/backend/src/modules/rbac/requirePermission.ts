import type { NextFunction, Request, Response } from "express";
import { getPermissions } from "./permissions.js";
import { HttpError } from "../../utils/httpError.js";

export function requirePermission(permission: keyof ReturnType<typeof getPermissions>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user) return next(new HttpError(401, "Authentication required"));
    const permissions = getPermissions(user);
    if (!permissions[permission]) return next(new HttpError(403, "You do not have permission to perform this action"));
    return next();
  };
}
