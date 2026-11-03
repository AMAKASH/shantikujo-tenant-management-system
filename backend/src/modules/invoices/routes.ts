import { Router } from "express";
import { LineType, Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { currentPeriod, PERIOD_RE, today } from "../../lib/dates.js";
import { badRequest, body, conflict, notFound, param, query } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { applyCredit, generateForPeriod, invoiceInclude, recalcInvoice, serializeInvoice } from "./service.js";

export const invoicesRouter = Router();

const period = z.string().regex(PERIOD_RE, "Period must be YYYY-MM");

const listQuery = z.object({
  period: period.optional(),
  status: z.enum(["UNPAID", "PARTIAL", "PAID", "VOID", "OVERDUE", "OPEN"]).optional(),
  tenantId: z.string().optional(),
  q: z.string().trim().optional(),
});

invoicesRouter.get("/", async (req, res) => {
  const { period: p, status, tenantId, q } = query(req, listQuery);
  const where: Prisma.InvoiceWhereInput = {};
  if (p) where.period = p;
  if (tenantId) where.tenantId = tenantId;
  if (status === "OVERDUE") Object.assign(where, { status: { in: ["UNPAID", "PARTIAL"] }, dueDate: { lt: today() } });
  else if (status === "OPEN") where.status = { in: ["UNPAID", "PARTIAL"] };
  else if (status) where.status = status;
  if (q) {
    where.OR = [
      { number: { contains: q, mode: "insensitive" } },
      { tenant: { fullName: { contains: q, mode: "insensitive" } } },
      { lease: { apartment: { number: { contains: q, mode: "insensitive" } } } },
    ];
  }
  const rows = await prisma.invoice.findMany({
    where,
    include: invoiceInclude,
    orderBy: [{ period: "desc" }, { number: "desc" }],
    take: 500,
  });
  const items = rows.map(serializeInvoice);
  const totals = items
    .filter((i) => i.status !== "VOID")
    .reduce(
      (acc, i) => ({ total: acc.total + i.total, paid: acc.paid + i.paidAmount, balance: acc.balance + i.balance }),
      { total: 0, paid: 0, balance: 0 },
    );
  res.json({ items, totals });
});

invoicesRouter.post("/generate", async (req, res) => {
  const { period: p } = body(req, z.object({ period: period.default(currentPeriod()) }));
  const result = await generateForPeriod(p);
  await audit(req.user?.id, "generate", "Invoice", undefined, result);
  res.json(result);
});

invoicesRouter.get("/:id", async (req, res) => {
  const inv = await prisma.invoice.findUnique({ where: { id: param(req, "id") }, include: invoiceInclude });
  if (!inv) throw notFound("Invoice");
  res.json(serializeInvoice(inv));
});

const lineSchema = z.object({
  type: z.nativeEnum(LineType).refine((t) => t !== "ELECTRICITY", "Add electricity through meter readings"),
  description: z.string().trim().min(1).max(200),
  amount: z.coerce.number().positive().max(99_999_999),
});

invoicesRouter.post("/:id/lines", async (req, res) => {
  const id = param(req, "id");
  const data = body(req, lineSchema);
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) throw notFound("Invoice");
  if (inv.status === "VOID") throw conflict("Cannot change a void invoice");
  const amount = data.type === "DISCOUNT" ? -data.amount : data.amount;

  const updated = await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.create({ data: { invoiceId: id, type: data.type, description: data.description, amount } });
    await recalcInvoice(tx, id);
    await applyCredit(tx, inv.tenantId);
    return tx.invoice.findUniqueOrThrow({ where: { id }, include: invoiceInclude });
  });
  await audit(req.user?.id, "add-line", "Invoice", id, { ...data, amount });
  res.status(201).json(serializeInvoice(updated));
});

invoicesRouter.delete("/:id/lines/:lineId", async (req, res) => {
  const id = param(req, "id");
  const lineId = param(req, "lineId");
  const line = await prisma.invoiceLine.findFirst({ where: { id: lineId, invoiceId: id }, include: { invoice: true } });
  if (!line) throw notFound("Line");
  if (line.invoice.status === "VOID") throw conflict("Cannot change a void invoice");
  if (line.invoice.status === "PAID") throw conflict("This invoice is paid. Void it or add a discount line instead.");
  if (line.meterReadingId) throw badRequest("Remove electricity charges from the meter readings screen");

  const updated = await prisma.$transaction(async (tx) => {
    await tx.invoiceLine.delete({ where: { id: lineId } });
    const inv = await recalcInvoice(tx, id);
    if (Number(inv.paidAmount) > Number(inv.total)) throw conflict("Line removal would leave the invoice overpaid");
    return tx.invoice.findUniqueOrThrow({ where: { id }, include: invoiceInclude });
  });
  await audit(req.user?.id, "remove-line", "Invoice", id, { lineId, amount: Number(line.amount) });
  res.json(serializeInvoice(updated));
});

invoicesRouter.post("/:id/void", async (req, res) => {
  const id = param(req, "id");
  const { reason } = body(req, z.object({ reason: z.string().trim().min(3).max(300) }));
  const inv = await prisma.invoice.findUnique({ where: { id } });
  if (!inv) throw notFound("Invoice");
  if (inv.status === "VOID") throw conflict("Invoice is already void");

  const updated = await prisma.$transaction(async (tx) => {
    // Payments on a voided invoice become tenant credit and are re-applied to other open invoices.
    await tx.paymentAllocation.deleteMany({ where: { invoiceId: id } });
    await tx.invoiceLine.updateMany({ where: { invoiceId: id }, data: { meterReadingId: null } });
    await tx.invoice.update({ where: { id }, data: { status: "VOID", voidReason: reason, paidAmount: 0 } });
    await applyCredit(tx, inv.tenantId);
    return tx.invoice.findUniqueOrThrow({ where: { id }, include: invoiceInclude });
  });
  await audit(req.user?.id, "void", "Invoice", id, { reason });
  res.json(serializeInvoice(updated));
});
