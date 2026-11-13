import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { isProd } from "../../config.js";
import { audit } from "../../lib/audit.js";
import { body, query } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { DEV_SMS_NUMBER, getBalance, normalizeBdPhone, smsConfigured, smsParts } from "../../lib/sms.js";
import { renderCustom, sendAndLog, tenantSmsInfo, type Recipient } from "./service.js";

export const smsRouter = Router();

/** Is SMS set up, is the dev override active, and how much credit is left. */
smsRouter.get("/status", async (_req, res) => {
  const configured = smsConfigured();
  res.json({
    configured,
    devOverride: !isProd,
    devNumber: isProd ? null : DEV_SMS_NUMBER,
    balance: configured ? await getBalance() : null,
  });
});

const message = z.string().trim().min(1, "Type a message").max(1000);

/** The message as one recipient would get it: a tenant (variables filled) or a typed-in number (variables removed). */
smsRouter.post("/preview", async (req, res) => {
  const data = body(req, z.object({ message, tenantId: z.string().min(1).nullish() }));
  const info = data.tenantId ? (await tenantSmsInfo([data.tenantId])).get(data.tenantId) : undefined;
  const text = renderCustom(data.message, info ?? { name: null, apartment: null, due: null });
  res.json({ message: text, characters: [...text].length, parts: smsParts(text) });
});

const sendSchema = z
  .object({
    message,
    tenantIds: z.array(z.string().min(1)).max(200).default([]),
    numbers: z.array(z.string().trim().min(1).max(40)).max(200).default([]),
  })
  .refine((d) => d.tenantIds.length + d.numbers.length > 0, "Choose at least one recipient")
  .refine((d) => d.tenantIds.length + d.numbers.length <= 200, "Send to at most 200 recipients at a time");

smsRouter.post("/send", async (req, res) => {
  const data = body(req, sendSchema);
  if (!smsConfigured()) {
    res.status(503).json({ error: "SMS is not configured. Add SMS_API_KEY and SMS_SENDER_ID to the API environment." });
    return;
  }

  const info = await tenantSmsInfo([...new Set(data.tenantIds)]);
  const recipients: Recipient[] = [];
  const seen = new Set<string>();
  const skipped: { phone: string; tenantId: string | null; name: string | null; status: "SKIPPED"; error: string }[] = [];
  const dedupe = (phone: string) => {
    const key = normalizeBdPhone(phone) ?? phone;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };

  for (const id of new Set(data.tenantIds)) {
    const t = info.get(id);
    if (!t) {
      skipped.push({ phone: "", tenantId: id, name: null, status: "SKIPPED", error: "Tenant not found" });
      continue;
    }
    if (!dedupe(t.phone)) {
      skipped.push({ phone: t.phone, tenantId: t.id, name: t.name, status: "SKIPPED", error: "Duplicate number" });
      continue;
    }
    recipients.push({ tenantId: t.id, name: t.name, apartment: t.apartment, phone: t.phone, message: renderCustom(data.message, t) });
  }
  for (const n of data.numbers) {
    if (!dedupe(n)) {
      skipped.push({ phone: n, tenantId: null, name: null, status: "SKIPPED", error: "Duplicate number" });
      continue;
    }
    recipients.push({ tenantId: null, name: null, apartment: null, phone: n, message: renderCustom(data.message, { name: null, apartment: null, due: null }) });
  }

  const batchId = randomUUID();
  const r = await sendAndLog("CUSTOM", recipients, req.user?.id, batchId);
  const results = [...r.results, ...skipped];
  const summary = { sent: r.sent, failed: r.failed, skipped: skipped.length };
  await audit(req.user?.id, "send", "SmsMessage", batchId, { ...summary, tenantIds: data.tenantIds, numbers: data.numbers.length, devOverride: !isProd });
  res.json({ ...summary, devOverride: !isProd, devNumber: isProd ? null : DEV_SMS_NUMBER, gatewayError: r.gatewayError, results });
});

/** Recent hand-written and payment SMS, newest first. */
smsRouter.get("/history", async (req, res) => {
  const { limit } = query(req, z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) }));
  const rows = await prisma.smsMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      tenant: { select: { id: true, fullName: true } },
      payment: { select: { id: true, number: true } },
      sentBy: { select: { name: true } },
    },
  });
  res.json({
    items: rows.map((m) => ({
      id: m.id,
      kind: m.kind,
      phone: m.phone,
      sentTo: m.sentTo,
      message: m.message,
      status: m.status,
      error: m.error,
      tenant: m.tenant,
      payment: m.payment,
      sentBy: m.sentBy?.name ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
});
