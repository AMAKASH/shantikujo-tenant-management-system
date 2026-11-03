import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { findSession, SESSION_COOKIE } from "../lib/auth.js";
import { HttpError } from "../lib/http.js";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  tenantId: string | null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return next(new HttpError(401, "Not authenticated"));
  const session = await findSession(token);
  if (!session) return next(new HttpError(401, "Session expired"));
  const { id, name, email, role, tenantId } = session.user;
  req.user = { id, name, email, role, tenantId };
  next();
}

export const requireRole =
  (...roles: Role[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, "Forbidden"));
    next();
  };
