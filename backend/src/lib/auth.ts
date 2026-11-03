import { createHash, randomBytes } from "node:crypto";
import argon2 from "argon2";
import type { Response } from "express";
import { config, isProd } from "../config.js";
import { prisma } from "./prisma.js";

export const SESSION_COOKIE = "stms_session";

export const hashPassword = (pw: string) => argon2.hash(pw, { type: argon2.argon2id });
export const verifyPassword = (hash: string, pw: string) => argon2.verify(hash, pw).catch(() => false);

const hashToken = (token: string) =>
  createHash("sha256").update(`${token}.${config.SESSION_SECRET}`).digest("hex");

/**
 * Opaque, server-side sessions: the cookie holds a random token, and the DB stores its hash.
 * This is revocable (logout and password change kill sessions) and works with SSR.
 */
export async function createSession(userId: string, meta: { userAgent?: string; ip?: string }) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + config.SESSION_DAYS * 86_400_000);
  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, userAgent: meta.userAgent?.slice(0, 255), ip: meta.ip },
  });
  return { token, expiresAt };
}

export async function findSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, name: true, email: true, role: true, isActive: true, tenantId: true } } },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null;

  // Sliding expiry: refresh at most once per hour to avoid a write on every request.
  if (Date.now() - session.lastUsedAt.getTime() > 3_600_000) {
    await prisma.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(), expiresAt: new Date(Date.now() + config.SESSION_DAYS * 86_400_000) },
    });
  }
  return session;
}

export const revokeSession = (token: string) =>
  prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });

export function setSessionCookie(res: Response, token: string, expires: Date) {
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export const clearSessionCookie = (res: Response) =>
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: isProd, sameSite: "lax", path: "/" });
