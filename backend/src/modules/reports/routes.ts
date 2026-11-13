import { Router } from "express";
import { z } from "zod";
import { currentPeriod, PERIOD_RE, periodEnd, periodStart, todayISO } from "../../lib/dates.js";
import { query } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getSettings } from "../../lib/settings.js";
import { byType, duesByTenant, monthlySeries, periodRows } from "./queries.js";
import { byApartmentThenName } from "../../lib/sort.js";
import { addSummarySheet, addTableSheet, AGING, newWorkbook } from "./excel.js";

export const reportsRouter = Router();

const r2 = (n: number) => Math.round(n * 100) / 100;
const round = <T extends Record<string, number>>(o: T) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r2(v)])) as T;

const monthFmt = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const periodLabel = (p: string) => monthFmt.format(new Date(`${p}-01T00:00:00Z`));

const LINE_LABEL: Record<string, string> = {
  RENT: "Rent",
  SERVICE_CHARGE: "Service charge",
  ELECTRICITY: "Electricity",
  WATER: "Water",
  GAS: "Gas",
  OTHER: "Other",
  DISCOUNT: "Discount",
  ROUNDING: "Rounding",
};
const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

// ───────── Report data (shared by JSON and Excel) ─────────

async function monthlyReport(period: string) {
  const [rows, types, received] = await Promise.all([
    periodRows(period),
    byType([period]),
    prisma.payment.groupBy({
      by: ["method"],
      where: { date: { gte: periodStart(period), lte: periodEnd(period) } },
      _sum: { amount: true },
      _count: true,
    }),
  ]);
  const expected = rows.reduce((a, r) => a + r.total, 0);
  const settled = rows.reduce((a, r) => a + r.paid, 0);
  const byMethod = received.map((m) => ({ method: m.method, amount: Number(m._sum.amount ?? 0), count: m._count }));
  return {
    period,
    summary: {
      expected: r2(expected),
      settled: r2(settled),
      outstanding: r2(expected - settled),
      received: r2(byMethod.reduce((a, m) => a + m.amount, 0)),
      collectionRate: expected > 0 ? settled / expected : 0,
    },
    byType: types,
    byMethod,
    rows,
  };
}

async function duesReport() {
  // Dues report: apartment order. (The dashboard keeps duesByTenant's largest-first order for its top list.)
  const items = (await duesByTenant()).sort(byApartmentThenName((r) => r.apartment, (r) => r.fullName));
  const totals = items.reduce(
    (a, r) => ({
      total: a.total + r.total,
      overdue: a.overdue + r.overdue,
      rent: a.rent + r.rent,
      service: a.service + r.service,
      electricity: a.electricity + r.electricity,
      other: a.other + r.other,
    }),
    { total: 0, overdue: 0, rent: 0, service: 0, electricity: 0, other: 0 },
  );
  return { items, totals: round(totals) };
}

async function yearlyReport(year: number) {
  const months = await monthlySeries(`${year}-01`, `${year}-12`);
  return {
    year,
    months,
    totals: round(
      months.reduce((a, m) => ({ expected: a.expected + m.expected, collected: a.collected + m.collected }), {
        expected: 0,
        collected: 0,
      }),
    ),
  };
}

const periodQuery = z.object({ period: z.string().regex(PERIOD_RE).optional() });
const yearQuery = z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() });
const thisYear = () => Number(currentPeriod().slice(0, 4));

reportsRouter.get("/monthly", async (req, res) => {
  const { period = currentPeriod() } = query(req, periodQuery);
  res.json(await monthlyReport(period));
});

reportsRouter.get("/dues", async (_req, res) => {
  res.json(await duesReport());
});

reportsRouter.get("/yearly", async (req, res) => {
  const { year = thisYear() } = query(req, yearQuery);
  res.json(await yearlyReport(year));
});

// ───────── Excel export ─────────

reportsRouter.get("/export", async (req, res) => {
  const q = query(req, z.object({ tab: z.enum(["monthly", "dues", "yearly"]) }).merge(periodQuery).merge(yearQuery));
  const settings = await getSettings();
  const wb = newWorkbook();
  const generated = `Generated ${todayISO()}`;
  const place = [settings.propertyName, settings.propertyAddress].filter(Boolean).join(" · ");
  let filename: string;

  if (q.tab === "monthly") {
    const period = q.period ?? currentPeriod();
    const r = await monthlyReport(period);
    const label = periodLabel(period);
    addTableSheet(wb, {
      name: "By apartment",
      title: `${settings.propertyName}: income for ${label}`,
      subtitle: `${place} · ${generated}`,
      rows: r.rows,
      columns: [
        { header: "Apartment", width: 12, value: (x) => x.apartment.number },
        { header: "Tenant", width: 26, value: (x) => x.tenant.fullName },
        { header: "Invoice", width: 16, value: (x) => x.number },
        { header: "Rent", width: 14, type: "money", value: (x) => x.rent },
        { header: "Service charge", width: 14, type: "money", value: (x) => x.serviceCharge },
        { header: "Electricity", width: 14, type: "money", value: (x) => x.electricity },
        { header: "Other", width: 12, type: "money", value: (x) => x.other },
        { header: "Total", width: 15, type: "money", value: (x) => x.total },
        { header: "Paid", width: 15, type: "money", value: (x) => x.paid },
        { header: "Balance", width: 15, type: "money", value: (x) => x.balance },
        { header: "Status", width: 12, type: "status", value: (x) => x.status },
      ],
    });
    addSummarySheet(wb, "Summary", `${settings.propertyName}: ${label} summary`, `${place} · ${generated}`, [
      {
        heading: "Collection",
        rows: [
          ["Billed", r.summary.expected],
          ["Settled against bills", r.summary.settled],
          ["Outstanding", r.summary.outstanding],
          ["Received this month (all payments)", r.summary.received],
          ["Collection rate", r.summary.collectionRate, "percent"],
        ],
      },
      { heading: "Billed by type", rows: r.byType.map((t) => [LINE_LABEL[t.type] ?? t.type, t.billed] as [string, number]) },
      {
        heading: "Received by method",
        rows: r.byMethod.map((m) => [`${METHOD_LABEL[m.method] ?? m.method} (${m.count})`, m.amount] as [string, number]),
      },
    ]);
    filename = `stms-income-${period}.xlsx`;
  } else if (q.tab === "dues") {
    const r = await duesReport();
    const agingCol = new Map<number, keyof typeof AGING>([[10, "d30"], [11, "d60"], [12, "d90"], [13, "d90plus"]]);
    addTableSheet(wb, {
      name: "Dues",
      title: `${settings.propertyName}: outstanding dues`,
      subtitle: `${place} · As of ${todayISO()} · Aging counted from each bill's due date`,
      rows: r.items,
      columns: [
        { header: "Apartment", width: 12, value: (x) => x.apartment ?? "" },
        { header: "Tenant", width: 26, value: (x) => x.fullName },
        { header: "Phone", width: 15, value: (x) => x.phone },
        { header: "Since", width: 15, value: (x) => periodLabel(x.oldestPeriod) },
        { header: "Rent", width: 13, type: "money", value: (x) => x.rent },
        { header: "Service", width: 13, type: "money", value: (x) => x.service },
        { header: "Electricity", width: 13, type: "money", value: (x) => x.electricity },
        { header: "Other", width: 12, type: "money", value: (x) => x.other },
        { header: "Total due", width: 15, type: "money", value: (x) => x.total },
        { header: "Not yet due", width: 13, type: "money", value: (x) => x.current },
        { header: "1–30 days", width: 13, type: "money", value: (x) => x.d30 },
        { header: "31–60 days", width: 13, type: "money", value: (x) => x.d60 },
        { header: "61–90 days", width: 13, type: "money", value: (x) => x.d90 },
        { header: "90+ days", width: 13, type: "money", value: (x) => x.d90plus },
      ],
      cellFill: (_row, i, v) => {
        const k = agingCol.get(i);
        return k && typeof v === "number" && v > 0 ? AGING[k] : null;
      },
    });
    filename = `stms-dues-${todayISO()}.xlsx`;
  } else {
    const year = q.year ?? thisYear();
    const r = await yearlyReport(year);
    addTableSheet(wb, {
      name: String(year),
      title: `${settings.propertyName}: ${year} month by month`,
      subtitle: `${place} · ${generated}`,
      rows: r.months,
      columns: [
        { header: "Month", width: 18, value: (m) => periodLabel(m.period) },
        { header: "Billed", width: 16, type: "money", value: (m) => m.expected },
        { header: "Settled against bills", width: 20, type: "money", value: (m) => m.settled },
        { header: "Collected", width: 16, type: "money", value: (m) => m.collected },
        {
          header: "Collection rate",
          width: 15,
          type: "percent",
          total: false,
          value: (m) => (m.expected > 0 ? m.settled / m.expected : null),
        },
      ],
    });
    filename = `stms-${year}.xlsx`;
  }

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.setHeader("Cache-Control", "no-store");
  await wb.xlsx.write(res);
  res.end();
});
