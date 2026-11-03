import { Router } from "express";
import { addMonths, currentPeriod, dueDateFor, isoDate, periodEnd, periodStart, today } from "../../lib/dates.js";
import { prisma } from "../../lib/prisma.js";
import { getSettings } from "../../lib/settings.js";
import { activeLeaseWhere } from "../apartments/routes.js";
import { byType, duesByTenant, monthlySeries } from "../reports/queries.js";

export const dashboardRouter = Router();

dashboardRouter.get("/", async (_req, res) => {
  const period = currentPeriod();
  const settings = await getSettings();
  const now = today();
  const in60 = new Date(now.getTime() + 60 * 86_400_000);

  const [apartments, occupied, maintenance, thisMonth, received, trend, types, dues, upcoming, missingDocs] =
    await Promise.all([
      prisma.apartment.count(),
      prisma.lease.count({ where: activeLeaseWhere }),
      prisma.apartment.count({ where: { underMaintenance: true, leases: { none: activeLeaseWhere } } }),
      prisma.invoice.aggregate({
        where: { period, status: { not: "VOID" } },
        _sum: { total: true, paidAmount: true },
        _count: true,
      }),
      prisma.payment.aggregate({
        where: { date: { gte: periodStart(period), lte: periodEnd(period) } },
        _sum: { amount: true },
        _count: true,
      }),
      monthlySeries(addMonths(period, -11), period),
      byType([period]),
      duesByTenant(),
      prisma.lease.findMany({
        where: {
          OR: [
            { status: "NOTICE", moveOutDate: { lte: in60 } },
            { status: "ACTIVE", endDate: { gte: now, lte: in60 } },
          ],
        },
        include: {
          tenant: { select: { id: true, fullName: true } },
          apartment: { select: { id: true, number: true } },
        },
        orderBy: [{ moveOutDate: "asc" }, { endDate: "asc" }],
        take: 10,
      }),
      prisma.tenant.count({
        where: {
          archivedAt: null,
          leases: { some: activeLeaseWhere },
          documents: { none: { type: "POLICE_VERIFICATION", supersededAt: null } },
        },
      }),
    ]);

  const expected = Number(thisMonth._sum.total ?? 0);
  const settled = Number(thisMonth._sum.paidAmount ?? 0);
  const dueDate = dueDateFor(period, settings.dueDay);

  res.json({
    period,
    dueDate: isoDate(dueDate),
    daysToDue: Math.round((dueDate.getTime() - now.getTime()) / 86_400_000),
    kpis: {
      expected,
      settled,
      collectedThisMonth: Number(received._sum.amount ?? 0),
      paymentsThisMonth: received._count,
      outstanding: Math.round(dues.reduce((a, d) => a + d.total, 0) * 100) / 100,
      overdueAmount: Math.round(dues.reduce((a, d) => a + d.overdue, 0) * 100) / 100,
      overdueTenants: dues.filter((d) => d.overdue > 0).length,
      invoicesThisMonth: thisMonth._count,
      apartments,
      occupied,
      vacant: apartments - occupied - maintenance,
      maintenance,
      occupancyRate: apartments ? occupied / apartments : 0,
      missingPoliceVerification: missingDocs,
    },
    trend,
    byType: types,
    dues: dues.slice(0, 8),
    upcoming: upcoming.map((l) => ({
      leaseId: l.id,
      status: l.status,
      tenant: l.tenant,
      apartment: l.apartment,
      date: isoDate((l.status === "NOTICE" ? l.moveOutDate : l.endDate) ?? now),
    })),
  });
});
