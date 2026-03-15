import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import * as db from "../services/pgStorage.js";

const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || (
  process.env.NODE_ENV === "production"
    ? (() => { throw new Error("JWT_SECRET environment variable is required in production"); })()
    : "alphamarkets-dev-only-secret"
);
const TOKEN_EXPIRY = "7d";
const COOKIE_NAME = "am_token";

export interface AuthPayload {
  userId: string;
  username: string;
  role: "admin" | "user";
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function setAuthCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

export function clearAuthCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: "/" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!db.isAvailable()) {
    res.status(503).json({ error: "Database unavailable" });
    return;
  }

  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: "Authentication required", code: "AUTH_REQUIRED" });
    return;
  }

  let payload: AuthPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
  } catch {
    clearAuthCookie(res);
    res.status(401).json({ error: "Invalid or expired token", code: "AUTH_REQUIRED" });
    return;
  }

  db.getUserById(payload.userId).then((user) => {
    if (!user) {
      clearAuthCookie(res);
      res.status(401).json({ error: "User no longer exists", code: "AUTH_REQUIRED" });
      return;
    }
    req.user = { userId: user.id, username: user.username, role: user.role as "admin" | "user" };
    next();
  }).catch(() => {
    res.status(500).json({ error: "Internal server error" });
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    next();
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = payload;
  } catch {
    // Invalid token, continue without user
  }
  next();
}
