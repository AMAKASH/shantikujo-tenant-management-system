import { Prisma, SmsKind } from "@prisma/client";
import { isoDate, periodOf } from "../../lib/dates.js";
import { prisma } from "../../lib/prisma.js";
import { getSettings } from "../../lib/settings.js";
import { bnAmount, bnDate, bnMonthList, deliveryNumber, fillTemplate, normalizeBdPhone, sendMany } from "../../lib/sms.js";
import { tenantBalances } from "../tenants/balance.js";

/** Placeholders a hand-written SMS can use (filled per tenant; removed for typed-in numbers). */
export const CUSTOM_SMS_VARS = ["name", "apartment", "due"] as const;

export interface Recipient {
  tenantId: string | null;
  name: string | null;
  apartment: string | null;
  /** Raw phone as stored or typed. */
  phone: string;
  message: string;
  paymentId?: string;
}

export interface SendResult {
  phone: string;
  tenantId: string | null;
  name: string | null;
  status: "SENT" | "FAILED" | "SKIPPED";
  error?: string;
}

/**
 * Send one batch and log every attempt as an SmsMessage. Invalid numbers are logged as FAILED without
 * calling the gateway. The provider returns one code for the whole batch.
 */
export async function sendAndLog(kind: SmsKind, recipients: Recipient[], sentById: string | undefined, batchId?: string) {
  const valid: (Recipient & { normalized: string; sentTo: string })[] = [];
  const invalid: Recipient[] = [];
  for (const r of recipients) {
    const normalized = normalizeBdPhone(r.phone);
    if (normalized) valid.push({ ...r, normalized, sentTo: deliveryNumber(normalized) });
    else invalid.push(r);
  }

  const gateway = valid.length ? await sendMany(valid.map((r) => ({ to: r.sentTo, message: r.message }))) : null;

  const rows: Prisma.SmsMessageCreateManyInput[] = [
    ...valid.map((r) => ({
      kind,
      batchId,
      tenantId: r.tenantId,
      paymentId: r.paymentId,
      phone: r.normalized,
      sentTo: r.sentTo,
      message: r.message,
      status: gateway?.ok ? ("SENT" as const) : ("FAILED" as const),
      providerCode: gateway?.code,
      error: gateway?.ok ? null : (gateway?.error ?? "Not sent"),
      sentById,
    })),
    ...invalid.map((r) => ({
      kind,
      batchId,
      tenantId: r.tenantId,
      paymentId: r.paymentId,
      phone: r.phone,
      sentTo: "",
      message: r.message,
      status: "FAILED" as const,
      error: "Not a valid Bangladeshi mobile number",
      sentById,
    })),
  ];
  if (rows.length) await prisma.smsMessage.createMany({ data: rows });

  const results: SendResult[] = [
    ...valid.map((r) => ({
      phone: r.normalized,
      tenantId: r.tenantId,
      name: r.name,
      ...(gateway?.ok ? { status: "SENT" as const } : { status: "FAILED" as const, error: gateway?.error ?? "Not sent" }),
    })),
    ...invalid.map((r) => ({ phone: r.phone, tenantId: r.tenantId, name: r.name, status: "FAILED" as const, error: "Invalid phone number" })),
  ];
  const count = (st: SendResult["status"]) => results.filter((r) => r.status === st).length;
  return {
    sent: count("SENT"),
    failed: count("FAILED"),
    skipped: count("SKIPPED"),
    gatewayError: gateway?.ok === false ? gateway.error : null,
    results,
  };
}

// ───────── Hand-written SMS ─────────

/** Tenant name, current/last apartment and amount due, for filling {name} {apartment} {due}. */
export async function tenantSmsInfo(tenantIds: string[]) {
  if (tenantIds.length === 0) return new Map<string, { id: string; name: string; phone: string; apartment: string | null; due: number }>();
  const [tenants, balances] = await Promise.all([
    prisma.tenant.findMany({
      where: { id: { in: tenantIds } },
      select: {
        id: true,
        fullName: true,
        phone: true,
        leases: {
          orderBy: [{ startDate: "desc" }],
          select: { status: true, apartment: { select: { number: true } } },
        },
      },
    }),
    tenantBalances(tenantIds),
  ]);
  return new Map(
    tenants.map((t) => {
      const lease = t.leases.find((l) => l.status !== "ENDED") ?? t.leases[0];
      return [t.id, { id: t.id, name: t.fullName, phone: t.phone, apartment: lease?.apartment.number ?? null, due: balances.get(t.id)?.due ?? 0 }];
    }),
  );
}

export function renderCustom(template: string, info: { name: string | null; apartment: string | null; due: number | null }) {
  return fillTemplate(template, {
    name: info.name,
    apartment: info.apartment,
    due: info.due == null ? null : bnAmount(info.due),
  });
}

// ───────── Payment confirmation ─────────

export const PAYMENT_SMS_VARS = ["name", "amount", "receipt", "date", "month", "due"] as const;

/** The payment confirmation text for one payment, plus the tenant it goes to. */
export async function paymentSms(paymentId: string) {
  const p = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      tenant: { select: { id: true, fullName: true, phone: true } },
      allocations: { select: { invoice: { select: { period: true } } } },
    },
  });
  if (!p) return null;
  const [settings, balances] = await Promise.all([getSettings(), tenantBalances([p.tenantId])]);
  const periods = p.allocations.map((a) => a.invoice.period);
  const message = fillTemplate(settings.paymentSmsTemplate, {
    name: p.tenant.fullName,
    amount: bnAmount(Number(p.amount)),
    receipt: p.number,
    date: bnDate(isoDate(p.date)),
    month: bnMonthList(periods.length ? periods : [periodOf(p.date)]),
    due: bnAmount(Math.max(0, balances.get(p.tenantId)?.due ?? 0)),
  });
  return { payment: p, message };
}
