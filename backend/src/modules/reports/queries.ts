import { Prisma } from "@prisma/client";
import { addMonths, periodEnd, periodStart, today } from "../../lib/dates.js";
import { prisma } from "../../lib/prisma.js";

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Billed vs paid per line type for invoices in the given periods. Paid share is spread pro rata across lines. */
export async function byType(periods: string[]) {
  const rows = await prisma.$queryRaw<{ type: string; billed: number; paid: number }[]>`
    SELECT l."type",
      COALESCE(SUM(l."amount"),0)::float AS billed,
      COALESCE(SUM(CASE WHEN i."total" > 0 THEN l."amount" * i."paidAmount" / i."total" ELSE 0 END),0)::float AS paid
    FROM "InvoiceLine" l JOIN "Invoice" i ON i."id" = l."invoiceId"
    WHERE i."status" <> 'VOID' AND i."period" = ANY(${periods})
    GROUP BY l."type"`;
  return rows.map((r) => ({ type: r.type, billed: r2(r.billed), paid: r2(r.paid), due: r2(r.billed - r.paid) }));
}

/** Expected (invoiced) and collected (cash received) per month. */
export async function monthlySeries(fromPeriod: string, toPeriod: string) {
  const [billed, received] = await Promise.all([
    prisma.$queryRaw<{ period: string; expected: number; settled: number }[]>`
      SELECT "period", COALESCE(SUM("total"),0)::float AS expected, COALESCE(SUM("paidAmount"),0)::float AS settled
      FROM "Invoice" WHERE "status" <> 'VOID' AND "period" BETWEEN ${fromPeriod} AND ${toPeriod}
      GROUP BY "period"`,
    prisma.$queryRaw<{ period: string; collected: number }[]>`
      SELECT to_char("date", 'YYYY-MM') AS period, COALESCE(SUM("amount"),0)::float AS collected
      FROM "Payment" WHERE "date" BETWEEN ${periodStart(fromPeriod)} AND ${periodEnd(toPeriod)}
      GROUP BY 1`,
  ]);
  const out: { period: string; expected: number; collected: number; settled: number }[] = [];
  for (let p = fromPeriod; p <= toPeriod; p = addMonths(p, 1)) {
    const b = billed.find((x) => x.period === p);
    const c = received.find((x) => x.period === p);
    out.push({ period: p, expected: r2(b?.expected ?? 0), settled: r2(b?.settled ?? 0), collected: r2(c?.collected ?? 0) });
  }
  return out;
}

/** Outstanding dues per tenant with type split and aging buckets. */
export async function duesByTenant() {
  const now = today();
  const rows = await prisma.$queryRaw<
    {
      tenantId: string;
      fullName: string;
      phone: string;
      apartment: string | null;
      oldestPeriod: string;
      oldestDue: Date;
      invoices: number;
      rent: number;
      service: number;
      electricity: number;
      other: number;
      total: number;
      current: number;
      d30: number;
      d60: number;
      d90: number;
      d90plus: number;
    }[]
  >`
    WITH open AS (
      SELECT i.*, (i."total" - i."paidAmount") AS bal,
        CASE WHEN i."total" > 0 THEN (i."total" - i."paidAmount") / i."total" ELSE 0 END AS share,
        (${now}::date - i."dueDate") AS late
      FROM "Invoice" i WHERE i."status" IN ('UNPAID','PARTIAL')
    ),
    lines AS (
      SELECT o."tenantId",
        SUM(CASE WHEN l."type" = 'RENT' THEN l."amount" * o.share ELSE 0 END) AS rent,
        SUM(CASE WHEN l."type" = 'SERVICE_CHARGE' THEN l."amount" * o.share ELSE 0 END) AS service,
        SUM(CASE WHEN l."type" = 'ELECTRICITY' THEN l."amount" * o.share ELSE 0 END) AS electricity,
        SUM(CASE WHEN l."type" NOT IN ('RENT','SERVICE_CHARGE','ELECTRICITY') THEN l."amount" * o.share ELSE 0 END) AS other
      FROM open o JOIN "InvoiceLine" l ON l."invoiceId" = o."id"
      GROUP BY o."tenantId"
    ),
    agg AS (
      SELECT "tenantId", MIN("period") AS "oldestPeriod", MIN("dueDate") AS "oldestDue", COUNT(*)::int AS invoices,
        SUM(bal) AS total,
        SUM(CASE WHEN late <= 0 THEN bal ELSE 0 END) AS current,
        SUM(CASE WHEN late BETWEEN 1 AND 30 THEN bal ELSE 0 END) AS d30,
        SUM(CASE WHEN late BETWEEN 31 AND 60 THEN bal ELSE 0 END) AS d60,
        SUM(CASE WHEN late BETWEEN 61 AND 90 THEN bal ELSE 0 END) AS d90,
        SUM(CASE WHEN late > 90 THEN bal ELSE 0 END) AS d90plus
      FROM open GROUP BY "tenantId"
    )
    SELECT a."tenantId", t."fullName", t."phone",
      (SELECT ap."number" FROM "Lease" le JOIN "Apartment" ap ON ap."id" = le."apartmentId"
        WHERE le."tenantId" = a."tenantId" ORDER BY (le."status" = 'ENDED'), le."startDate" DESC LIMIT 1) AS apartment,
      a."oldestPeriod", a."oldestDue", a.invoices,
      COALESCE(l.rent,0)::float AS rent, COALESCE(l.service,0)::float AS service,
      COALESCE(l.electricity,0)::float AS electricity, COALESCE(l.other,0)::float AS other,
      a.total::float AS total, a.current::float AS current, a.d30::float AS d30, a.d60::float AS d60,
      a.d90::float AS d90, a.d90plus::float AS d90plus
    FROM agg a JOIN "Tenant" t ON t."id" = a."tenantId"
    LEFT JOIN lines l ON l."tenantId" = a."tenantId"
    WHERE a.total > 0
    ORDER BY a.total DESC`;

  return rows.map((r) => ({
    ...r,
    rent: r2(r.rent),
    service: r2(r.service),
    electricity: r2(r.electricity),
    other: r2(r.other),
    total: r2(r.total),
    current: r2(r.current),
    d30: r2(r.d30),
    d60: r2(r.d60),
    d90: r2(r.d90),
    d90plus: r2(r.d90plus),
    overdue: r2(r.total - r.current),
  }));
}

/** Per-apartment breakdown for one period. */
export async function periodRows(period: string) {
  const invoices = await prisma.invoice.findMany({
    where: { period, status: { not: "VOID" } },
    include: {
      lines: true,
      tenant: { select: { id: true, fullName: true } },
      lease: { select: { apartment: { select: { id: true, number: true } } } },
    },
    orderBy: { lease: { apartment: { number: "asc" } } },
  });
  const t = (lines: { type: string; amount: Prisma.Decimal }[], ...types: string[]) =>
    r2(lines.filter((l) => types.includes(l.type)).reduce((a, l) => a + Number(l.amount), 0));
  return invoices.map((i) => ({
    invoiceId: i.id,
    number: i.number,
    apartment: i.lease.apartment,
    tenant: i.tenant,
    rent: t(i.lines, "RENT"),
    serviceCharge: t(i.lines, "SERVICE_CHARGE"),
    electricity: t(i.lines, "ELECTRICITY"),
    other: t(i.lines, "WATER", "GAS", "OTHER", "DISCOUNT"),
    total: Number(i.total),
    paid: Number(i.paidAmount),
    balance: r2(Number(i.total) - Number(i.paidAmount)),
    status: (i.status === "UNPAID" || i.status === "PARTIAL") && i.dueDate < today() ? "OVERDUE" : i.status,
  }));
}
