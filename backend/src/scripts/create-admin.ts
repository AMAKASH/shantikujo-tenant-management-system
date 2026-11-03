/**
 * Create or reset the admin user from ADMIN_EMAIL / ADMIN_PASSWORD / ADMIN_NAME.
 * Production:  docker exec <container> node backend/dist/scripts/create-admin.js
 */
import { hashPassword } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";

export async function ensureAdmin({ resetPassword = false } = {}) {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || "Landlord";
  if (!email || !password) {
    console.log("ADMIN_EMAIL / ADMIN_PASSWORD not set, skipping admin bootstrap");
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && !resetPassword) {
    console.log(`Admin ${email} already exists`);
    return;
  }
  const passwordHash = await hashPassword(password);
  await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "ADMIN" },
    update: { passwordHash, isActive: true },
  });
  if (existing) await prisma.session.deleteMany({ where: { userId: existing.id } });
  console.log(`Admin ${email} ${existing ? "password reset" : "created"}`);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  ensureAdmin({ resetPassword: process.argv.includes("--reset") })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
