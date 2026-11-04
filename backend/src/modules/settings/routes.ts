import { Router } from "express";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { body } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getSettings, saveSettings } from "../../lib/settings.js";
import { usingS3 } from "../../lib/storage.js";
import { getDefaultProperty } from "./property.js";

export const settingsRouter = Router();

settingsRouter.get("/", async (_req, res) => {
  res.json({ ...(await getSettings()), storage: usingS3 ? "s3" : "local" });
});

const schema = z.object({
  propertyName: z.string().trim().min(1).max(120),
  propertyAddress: z.string().trim().max(300),
  dueDay: z.coerce.number().int().min(1).max(28),
  invoicePrefix: z.string().trim().regex(/^[A-Z]{2,6}$/, "2–6 capital letters"),
  receiptPrefix: z.string().trim().regex(/^[A-Z]{2,6}$/, "2–6 capital letters"),
  defaultNoticeMonths: z.coerce.number().int().min(0).max(12),
  contactPhone: z.string().trim().max(40),
  contactEmail: z.union([z.literal(""), z.string().trim().email()]),
  invoiceNote: z.string().trim().max(400),
  smsTemplate: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .refine((t) => t.includes("{amount}"), "The SMS message must include {amount}"),
  paymentMethods: z.array(z.enum(["CASH", "BANK", "BKASH", "NAGAD", "ROCKET", "CHEQUE", "OTHER"])).max(7),
  electricity: z.object({
    slabs: z
      .array(z.object({ upTo: z.coerce.number().positive().nullable(), rate: z.coerce.number().min(0) }))
      .min(1)
      .max(12),
    demandCharge: z.coerce.number().min(0),
    vatPercent: z.coerce.number().min(0).max(100),
    flatRate: z
      .object({
        enabled: z.boolean(),
        maxUnits: z.coerce.number().min(0).max(100_000),
        rate: z.coerce.number().min(0),
      })
      .optional(),
  }),
});

settingsRouter.put("/", async (req, res) => {
  const data = body(req, schema.partial());
  const saved = await saveSettings(data);
  if (data.propertyName || data.propertyAddress !== undefined) {
    const p = await getDefaultProperty();
    await prisma.property.update({
      where: { id: p.id },
      data: { name: saved.propertyName, address: saved.propertyAddress || null },
    });
  }
  await audit(req.user?.id, "update", "Settings", "app", data);
  res.json({ ...saved, storage: usingS3 ? "s3" : "local" });
});

settingsRouter.get("/audit-log", async (_req, res) => {
  const items = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true } } },
  });
  res.json({ items });
});
