import { Router } from "express";
import { z } from "zod";
import { currentPeriod, PERIOD_RE, periodEnd, periodStart } from "../../lib/dates.js";
import { query } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { byType, duesByTenant, monthlySeries, periodRows } from "./queries.js";
import { byApartmentThenName } from "../../lib/sort.js";

export const reportsRouter = Router();

const r2 = (n: number) => Math.round(n * 100) / 100;
const round = <T extends Record<string, number>>(o: T) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [k, r2(v)])) as T;

reportsRouter.get("/monthly", async (req, res) => {
  const { period = currentPeriod() } = query(req, z.object({ period: z.string().regex(PERIOD_RE).optional() }));
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
  res.json({
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
  });
});

reportsRouter.get("/dues", async (_req, res) => {
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
  res.json({ items, totals: round(totals) });
});

reportsRouter.get("/yearly", async (req, res) => {
  const { year = Number(currentPeriod().slice(0, 4)) } = query(
    req,
    z.object({ year: z.coerce.number().int().min(2000).max(2100).optional() }),
  );
  const months = await monthlySeries(`${year}-01`, `${year}-12`);
  res.json({
    year,
    months,
    totals: round(months.reduce(
      (a, m) => ({ expected: a.expected + m.expected, collected: a.collected + m.collected }),
      { expected: 0, collected: 0 },
    )),
  });
});
