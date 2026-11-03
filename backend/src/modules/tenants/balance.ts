import { prisma } from "../../lib/prisma.js";
import { today } from "../../lib/dates.js";
import { num } from "../../lib/money.js";

export interface Balance {
  due: number; // total unpaid on non-void invoices
  overdue: number; // unpaid where due date has passed
  credit: number; // unallocated payment amount
}

export async function tenantBalances(tenantIds: string[]): Promise<Map<string, Balance>> {
  const map = new Map<string, Balance>();
  if (tenantIds.length === 0) return map;
  const now = today();

  const [dues, credits] = await Promise.all([
    prisma.$queryRaw<{ tenantId: string; due: number; overdue: number }[]>`
      SELECT "tenantId",
        COALESCE(SUM("total" - "paidAmount"),0)::float AS due,
        COALESCE(SUM(CASE WHEN "dueDate" < ${now} THEN "total" - "paidAmount" ELSE 0 END),0)::float AS overdue
      FROM "Invoice"
      WHERE "tenantId" = ANY(${tenantIds}) AND "status" IN ('UNPAID','PARTIAL')
      GROUP BY "tenantId"`,
    prisma.$queryRaw<{ tenantId: string; credit: number }[]>`
      SELECT p."tenantId", COALESCE(SUM(p."amount" - COALESCE(a.allocated,0)),0)::float AS credit
      FROM "Payment" p
      LEFT JOIN (SELECT "paymentId", SUM("amount") AS allocated FROM "PaymentAllocation" GROUP BY "paymentId") a
        ON a."paymentId" = p."id"
      WHERE p."tenantId" = ANY(${tenantIds})
      GROUP BY p."tenantId"`,
  ]);

  for (const id of tenantIds) map.set(id, { due: 0, overdue: 0, credit: 0 });
  for (const d of dues) Object.assign(map.get(d.tenantId)!, { due: d.due, overdue: d.overdue });
  for (const c of credits) map.get(c.tenantId)!.credit = c.credit;
  return map;
}

/** Chronological ledger: invoices are debits, payments are credits, with a running balance. */
export async function tenantLedger(tenantId: string) {
  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { tenantId, status: { not: "VOID" } },
      select: { id: true, number: true, period: true, issueDate: true, total: true, status: true },
    }),
    prisma.payment.findMany({
      where: { tenantId },
      select: { id: true, number: true, date: true, amount: true, method: true, reference: true },
    }),
  ]);

  const entries = [
    ...invoices.map((i) => ({
      kind: "invoice" as const,
      id: i.id,
      ref: i.number,
      date: i.issueDate,
      description: `Invoice for ${i.period}`,
      debit: num(i.total)!,
      credit: 0,
      status: i.status,
    })),
    ...payments.map((p) => ({
      kind: "payment" as const,
      id: p.id,
      ref: p.number,
      date: p.date,
      description: `Payment (${p.method}${p.reference ? ` · ${p.reference}` : ""})`,
      debit: 0,
      credit: num(p.amount)!,
      status: null,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime() || (a.kind === "invoice" ? -1 : 1));

  let balance = 0;
  const rows = entries.map((e) => {
    balance = Math.round((balance + e.debit - e.credit) * 100) / 100;
    return { ...e, balance };
  });
  return { entries: rows.reverse(), balance };
}
