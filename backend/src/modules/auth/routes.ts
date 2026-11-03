import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  clearSessionCookie,
  createSession,
  hashPassword,
  revokeSession,
  SESSION_COOKIE,
  setSessionCookie,
  verifyPassword,
} from "../../lib/auth.js";
import { body, HttpError } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { requireAuth } from "../../middleware/auth.js";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  skipSuccessfulRequests: true,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many failed login attempts. Try again in 15 minutes." },
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

authRouter.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = body(req, loginSchema);
  const user = await prisma.user.findUnique({ where: { email } });
  const ok = user && user.isActive && (await verifyPassword(user.passwordHash, password));
  if (!ok) throw new HttpError(401, "Invalid email or password");

  const { token, expiresAt } = await createSession(user.id, { userAgent: req.get("user-agent"), ip: req.ip });
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  setSessionCookie(res, token, expiresAt);
  res.json({ user: { id: user.id, name: user.name, email: user.email, role: user.role } });
});

authRouter.post("/logout", async (req, res) => {
  const token = req.cookies?.[SESSION_COOKIE];
  if (token) await revokeSession(token);
  clearSessionCookie(res);
  res.status(204).end();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const changePwSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Use at least 8 characters"),
});

authRouter.post("/change-password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = body(req, changePwSchema);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  if (!(await verifyPassword(user.passwordHash, currentPassword))) {
    throw new HttpError(400, "Current password is incorrect");
  }
  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(newPassword) } }),
    prisma.session.deleteMany({ where: { userId: user.id } }),
  ]);
  const { token, expiresAt } = await createSession(user.id, { userAgent: req.get("user-agent"), ip: req.ip });
  setSessionCookie(res, token, expiresAt);
  res.json({ ok: true });
});
