import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { ApiError } from "../common/api-error";

export type Role = "rep" | "rsm" | "nsm" | "admin";

export interface AuthUser {
  id: number;
  role: Role;
  territoryId: number | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized("Missing bearer token"));
  }

  const token = header.slice("Bearer ".length);
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret) as AuthUser;
    req.user = { id: payload.id, role: payload.role, territoryId: payload.territoryId };
    return next();
  } catch {
    return next(ApiError.unauthorized("Invalid or expired token"));
  }
}

/** Restricts a route to one or more roles. Use after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires one of roles: ${roles.join(", ")}`));
    }
    return next();
  };
}
