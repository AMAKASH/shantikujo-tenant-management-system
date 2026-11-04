import { LineType, Prisma, type Lease } from "@prisma/client";
import { daysInPeriod, dueDateFor, isoDate, periodEnd, periodOf, periodStart, today } from "../../lib/dates.js";
import { D, sum, ZERO } from "../../lib/money.js";
import { prisma, type Tx } from "../../lib/prisma.js";
import { nextNumber } from "../../lib/sequence.js";
import { getSettings } from "../../lib/settings.js";

const round2 = (d: Prisma.Decimal) => d.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);

/**
 * Proration factor for a lease in a period: the share of days in the period that the lease covers.
 * A lease starting on the 1st and running through the month is 1.
 */
export function coverage(lease: Pick<Lease, "startDate" | "endedAt" | "moveOutDate">, period: string) {
  const start = periodStart(period);
  const end = periodEnd(period);
  const from = lease.startDate > start ? lease.startDate : start;
  const stop = lease.endedAt ?? null;
  const to = stop && stop < end ? stop : end;
  if (to < from) return { factor: 0, days: 0, total: daysInPeriod(period) };
  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;
  const total = daysInPeriod(period);
  return { factor: Math.min(1, days / total), days, total };
}

const ROUNDING_DESCRIPTION = "Rounding (to whole taka)";

/**
 * Keep the system-managed ROUNDING line so that the invoice total is a whole taka (half up).
 * Returns the rounded total. An invoice already paid to the paisa without a rounding line is left
 * as it is, so recalculating an old settled invoice never reopens it for ৳0.50.
 */
async function syncRounding(
  tx: Tx,
  invoiceId: string,
  lines: { id: string; type: LineType; amount: Prisma.Decimal }[],
  paid: Prisma.Decimal,
) {
  const existing = lines.filter((l) => l.type === LineType.ROUNDING);
  const raw = sum(lines.filter((l) => l.type !== LineType.ROUNDING).map((l) => l.amount));
  const target = raw.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  let diff = target.minus(raw);
  if (existing.length === 0 && !diff.isZero() && paid.gt(0) && paid.gte(raw)) diff = ZERO;

  const [keep, ...extra] = existing;
  if (extra.length) await tx.invoiceLine.deleteMany({ where: { id: { in: extra.map((l) => l.id) } } });
  if (diff.isZero()) {
    if (keep) await tx.invoiceLine.delete({ where: { id: keep.id } });
  } else if (keep) {
    if (!D(keep.amount).equals(diff)) await tx.invoiceLine.update({ where: { id: keep.id }, data: { amount: diff } });
  } else {
    await tx.invoiceLine.create({ data: { invoiceId, type: LineType.ROUNDING, description: ROUNDING_DESCRIPTION, amount: diff } });
  }
  return raw.plus(diff);
}

/**
 * Recompute total, paidAmount and status from lines and allocations. VOID invoices are left alone.
 * The total is rounded to a whole taka through a ROUNDING line (see syncRounding).
 * If the total dropped below what has been allocated, the newest allocations are trimmed and the
 * freed money becomes tenant credit (callers run applyCredit afterwards).
 */
export async function recalcInvoice(tx: Tx, invoiceId: string) {
  const inv = await tx.invoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: {
      lines: { select: { id: true, type: true, amount: true } },
      allocations: { select: { id: true, amount: true }, orderBy: { id: "desc" } },
    },
  });
  if (inv.status === "VOID") return inv;
  let paid = sum(inv.allocations.map((a) => a.amount));
  const total = Prisma.Decimal.max(ZERO, await syncRounding(tx, invoiceId, inv.lines, paid));
  for (const a of inv.allocations) {
    if (paid.lte(total)) break;
    const excess = paid.minus(total);
    if (excess.gte(a.amount)) {
      await tx.paymentAllocation.delete({ where: { id: a.id } });
      paid = paid.minus(a.amount);
    } else {
      await tx.paymentAllocation.update({ where: { id: a.id }, data: { amount: D(a.amount).minus(excess) } });
      paid = total;
    }
  }
  const status = paid.gte(total) ? "PAID" : paid.gt(0) ? "PARTIAL" : "UNPAID";
  return tx.invoice.update({ where: { id: invoiceId }, data: { total, paidAmount: paid, status } });
}

/**
 * Get or create the invoice for a lease and period, with rent and service charge lines.
 * Idempotent: an existing invoice is returned unchanged.
 */
export async function ensureInvoice(tx: Tx, lease: Lease, period: string) {
  const existing = await tx.invoice.findUnique({ where: { leaseId_period: { leaseId: lease.id, period } } });
  if (existing) return { invoice: existing, created: false };

  const settings = await getSettings();
  const { factor, days, total } = coverage(lease, period);
  const prorated = factor < 1;
  const note = prorated ? ` (${days}/${total} days)` : "";
  const rent = round2(D(lease.rent).times(factor));
  const service = round2(D(lease.serviceCharge).times(factor));

  const lines: Prisma.InvoiceLineCreateWithoutInvoiceInput[] = [];
  if (rent.gt(0)) lines.push({ type: LineType.RENT, description: `Rent for ${period}${note}`, amount: rent });
  if (service.gt(0))
    lines.push({ type: LineType.SERVICE_CHARGE, description: `Service charge for ${period}${note}`, amount: service });

  const year = Number(period.slice(0, 4));
  const invoice = await tx.invoice.create({
    data: {
      number: await nextNumber(tx, settings.invoicePrefix, year),
      leaseId: lease.id,
      tenantId: lease.tenantId,
      period,
      issueDate: today() < periodStart(period) ? periodStart(period) : today(),
      dueDate: dueDateFor(period, settings.dueDay),
      total: rent.plus(service),
      status: lines.length ? "UNPAID" : "PAID",
      lines: { create: lines },
    },
  });
  await recalcInvoice(tx, invoice.id); // adds the rounding line for part-month amounts
  await applyCredit(tx, lease.tenantId);
  return { invoice: await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } }), created: true };
}

/** Is a lease billable in a period? (It started on or before the period end and hadn't ended before the period start.) */
export function billable(lease: Lease, period: string) {
  if (lease.startDate > periodEnd(period)) return false;
  if (lease.endedAt && lease.endedAt < periodStart(period)) return false;
  return true;
}

/** Generate invoices for every billable lease in a period. Safe to run repeatedly. */
export async function generateForPeriod(period: string) {
  const leases = await prisma.lease.findMany({
    where: {
      startDate: { lte: periodEnd(period) },
      OR: [{ status: { in: ["ACTIVE", "NOTICE"] } }, { endedAt: { gte: periodStart(period) } }],
    },
  });
  let created = 0;
  for (const lease of leases) {
    if (!billable(lease, period)) continue;
    const r = await prisma.$transaction((tx) => ensureInvoice(tx, lease, period));
    if (r.created) created++;
  }
  return { period, leases: leases.length, created };
}

/**
 * Allocate a tenant's unallocated payment credit to their open invoices, oldest due first.
 */
export async function applyCredit(tx: Tx, tenantId: string) {
  const payments = await tx.payment.findMany({
    where: { tenantId },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { allocations: { select: { amount: true } } },
  });
  const withCredit = payments
    .map((p) => ({ id: p.id, left: D(p.amount).minus(sum(p.allocations.map((a) => a.amount))) }))
    .filter((p) => p.left.gt(0));
  if (withCredit.length === 0) return;
  await allocate(tx, tenantId, withCredit);
}

/** Spread payment amounts across open invoices (oldest due date first). Optionally limited to invoiceIds. */
export async function allocate(
  tx: Tx,
  tenantId: string,
  sources: { id: string; left: Prisma.Decimal }[],
  invoiceIds?: string[],
) {
  const invoices = await tx.invoice.findMany({
    where: {
      tenantId,
      status: { in: ["UNPAID", "PARTIAL"] },
      ...(invoiceIds?.length ? { id: { in: invoiceIds } } : {}),
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
  });

  const touched = new Set<string>();
  for (const inv of invoices) {
    let open = D(inv.total).minus(inv.paidAmount);
    for (const src of sources) {
      if (open.lte(0)) break;
      if (src.left.lte(0)) continue;
      const amt = Prisma.Decimal.min(open, src.left);
      await tx.paymentAllocation.create({ data: { paymentId: src.id, invoiceId: inv.id, amount: amt } });
      src.left = src.left.minus(amt);
      open = open.minus(amt);
      touched.add(inv.id);
    }
  }
  for (const id of touched) await recalcInvoice(tx, id);
  return sources.reduce((acc, s) => acc.plus(s.left), ZERO);
}

export const invoiceInclude = {
  // Rounding always last, whatever was added after it.
  lines: { orderBy: [{ type: "asc" }, { createdAt: "asc" }] },
  tenant: { select: { id: true, fullName: true, phone: true, email: true } },
  lease: { select: { id: true, apartment: { select: { id: true, number: true } } } },
  allocations: {
    include: { payment: { select: { id: true, number: true, date: true, method: true, reference: true } } },
  },
  notifications: { where: { status: "SENT" }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
  _count: { select: { notifications: { where: { status: "SENT" } } } },
} satisfies Prisma.InvoiceInclude;

type FullInvoice = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;

export function serializeInvoice(inv: FullInvoice) {
  const balance = Number(inv.total) - Number(inv.paidAmount);
  const overdue = (inv.status === "UNPAID" || inv.status === "PARTIAL") && inv.dueDate < today();
  return {
    id: inv.id,
    number: inv.number,
    period: inv.period,
    issueDate: isoDate(inv.issueDate),
    dueDate: isoDate(inv.dueDate),
    status: inv.status,
    displayStatus: overdue ? "OVERDUE" : inv.status,
    voidReason: inv.voidReason,
    total: Number(inv.total),
    paidAmount: Number(inv.paidAmount),
    balance: Math.round(balance * 100) / 100,
    tenant: inv.tenant,
    apartment: inv.lease.apartment,
    leaseId: inv.lease.id,
    lines: inv.lines.map((l) => ({ ...l, amount: Number(l.amount) })),
    payments: inv.allocations.map((a) => ({ ...a.payment, amount: Number(a.amount) })),
    notifiedAt: inv.notifications[0]?.createdAt.toISOString() ?? null,
    notifyCount: inv._count.notifications,
  };
}

