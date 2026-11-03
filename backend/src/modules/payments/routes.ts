import { Router } from "express";
import { PaymentMethod, Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { isoDate, toDate, todayISO } from "../../lib/dates.js";
import { body, notFound, param, query } from "../../lib/http.js";
import { D } from "../../lib/money.js";
import { prisma } from "../../lib/prisma.js";
import { nextNumber } from "../../lib/sequence.js";
import { getSettings } from "../../lib/settings.js";
import { allocate, applyCredit, recalcInvoice } from "../invoices/service.js";

export const paymentsRouter = Router();

const paymentInclude = {
  tenant: { select: { id: true, fullName: true, phone: true } },
  allocations: { include: { invoice: { select: { id: true, number: true, period: true } } } },
} satisfies Prisma.PaymentInclude;

function serializePayment(p: Prisma.PaymentGetPayload<{ include: typeof paymentInclude }>) {
  const allocated = p.allocations.reduce((a, x) => a + Number(x.amount), 0);
  return {
    id: p.id,
    number: p.number,
    date: isoDate(p.date),
    amount: Number(p.amount),
    method: p.method,
    reference: p.reference,
    note: p.note,
    tenant: p.tenant,
    allocated,
    unallocated: Math.round((Number(p.amount) - allocated) * 100) / 100,
    allocations: p.allocations.map((a) => ({ invoice: a.invoice, amount: Number(a.amount) })),
    createdAt: p.createdAt,
  };
}

const listQuery = z.object({
  tenantId: z.string().optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
});

paymentsRouter.get("/", async (req, res) => {
  const { tenantId, from, to, method } = query(req, listQuery);
  const rows = await prisma.payment.findMany({
    where: {
      tenantId,
      method,
      date: from || to ? { gte: from ? toDate(from) : undefined, lte: to ? toDate(to) : undefined } : undefined,
    },
    include: paymentInclude,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  const items = rows.map(serializePayment);
  res.json({ items, total: items.reduce((a, p) => a + p.amount, 0) });
});

const createSchema = z.object({
  tenantId: z.string().min(1),
  amount: z.coerce.number().positive().max(99_999_999),
  date: z.string().date().default(() => todayISO()),
  method: z.nativeEnum(PaymentMethod),
  reference: z.string().trim().max(100).nullish(),
  note: z.string().trim().max(500).nullish(),
  /** Pay these invoices first (oldest-first among them); anything left goes to other open invoices, then credit. */
  invoiceIds: z.array(z.string()).optional(),
});

paymentsRouter.post("/", async (req, res) => {
  const data = body(req, createSchema);
  const tenant = await prisma.tenant.findUnique({ where: { id: data.tenantId }, select: { id: true } });
  if (!tenant) throw notFound("Tenant");
  const settings = await getSettings();

  const payment = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.create({
      data: {
        number: await nextNumber(tx, settings.receiptPrefix, Number(data.date.slice(0, 4))),
        tenantId: data.tenantId,
        amount: data.amount,
        date: toDate(data.date),
        method: data.method,
        reference: data.reference || null,
        note: data.note || null,
      },
    });
    const src = [{ id: p.id, left: D(data.amount) }];
    if (data.invoiceIds?.length) await allocate(tx, data.tenantId, src, data.invoiceIds);
    await allocate(tx, data.tenantId, src);
    return tx.payment.findUniqueOrThrow({ where: { id: p.id }, include: paymentInclude });
  });
  await audit(req.user?.id, "create", "Payment", payment.id, {
    tenantId: data.tenantId,
    amount: data.amount,
    method: data.method,
  });
  res.status(201).json(serializePayment(payment));
});

paymentsRouter.get("/:id", async (req, res) => {
  const p = await prisma.payment.findUnique({ where: { id: param(req, "id") }, include: paymentInclude });
  if (!p) throw notFound("Payment");
  res.json(serializePayment(p));
});

/** Reverse a payment entered by mistake. Its allocations are removed and invoices recalculated. */
paymentsRouter.delete("/:id", async (req, res) => {
  const id = param(req, "id");
  const p = await prisma.payment.findUnique({ where: { id }, include: { allocations: true } });
  if (!p) throw notFound("Payment");
  await prisma.$transaction(async (tx) => {
    await tx.payment.delete({ where: { id } });
    for (const a of p.allocations) await recalcInvoice(tx, a.invoiceId);
    await applyCredit(tx, p.tenantId);
  });
  await audit(req.user?.id, "delete", "Payment", id, {
    number: p.number,
    amount: Number(p.amount),
    tenantId: p.tenantId,
  });
  res.status(204).end();
});
