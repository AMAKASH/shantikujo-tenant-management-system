import { Router } from "express";
import { NoticeBy, Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { addMonthsToDate, currentPeriod, isoDate, periodOf, toDate, todayISO } from "../../lib/dates.js";
import { badRequest, body, conflict, notFound, param, query } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { getSettings } from "../../lib/settings.js";
import { activeLeaseWhere } from "../apartments/routes.js";
import { applyCredit, coverage, ensureInvoice, invoiceInclude, recalcInvoice, serializeInvoice } from "../invoices/service.js";
import { D } from "../../lib/money.js";
import { recordBillingReading, recordInitialReading, serializeReading } from "../meter-readings/service.js";
import { serializeLease } from "./serialize.js";

export const leasesRouter = Router();

const money = z.coerce.number().min(0).max(99_999_999);
const date = z.string().date();

const leaseInclude = {
  tenant: { select: { id: true, fullName: true, phone: true } },
  apartment: { select: { id: true, number: true, floor: true } },
} satisfies Prisma.LeaseInclude;

leasesRouter.get("/", async (req, res) => {
  const { status } = query(req, z.object({ status: z.enum(["ACTIVE", "NOTICE", "ENDED", "CURRENT"]).optional() }));
  const where: Prisma.LeaseWhereInput =
    status === "CURRENT" || !status ? activeLeaseWhere : { status };
  const rows = await prisma.lease.findMany({ where, include: leaseInclude, orderBy: { startDate: "desc" } });
  res.json({ items: rows.map(serializeLease) });
});

const createSchema = z.object({
  tenantId: z.string().min(1),
  apartmentId: z.string().min(1),
  startDate: date,
  endDate: date.nullish(),
  rent: money,
  serviceCharge: money.default(0),
  securityDeposit: money.default(0),
  depositReceivedAt: date.nullish(),
  noticeMonths: z.coerce.number().int().min(0).max(12).optional(),
  initialMeterReading: z.coerce.number().min(0).nullish(),
  notes: z.string().max(2000).nullish(),
});

leasesRouter.post("/", async (req, res) => {
  const data = body(req, createSchema);
  const settings = await getSettings();
  if (data.endDate && data.endDate < data.startDate) throw badRequest("End date must be after the start date");

  const lease = await prisma.$transaction(async (tx) => {
    const [apt, tenant, aptBusy, tenantBusy] = await Promise.all([
      tx.apartment.findUnique({ where: { id: data.apartmentId } }),
      tx.tenant.findUnique({ where: { id: data.tenantId } }),
      tx.lease.count({ where: { apartmentId: data.apartmentId, ...activeLeaseWhere } }),
      tx.lease.count({ where: { tenantId: data.tenantId, ...activeLeaseWhere } }),
    ]);
    if (!apt) throw notFound("Apartment");
    if (!tenant) throw notFound("Tenant");
    if (tenant.archivedAt) throw conflict("This tenant is archived. Restore them first.");
    if (aptBusy) throw conflict(`Apartment ${apt.number} already has an active lease`);
    if (tenantBusy) throw conflict(`${tenant.fullName} already has an active lease`);

    const lease = await tx.lease.create({
      data: {
        tenantId: data.tenantId,
        apartmentId: data.apartmentId,
        startDate: toDate(data.startDate),
        endDate: data.endDate ? toDate(data.endDate) : null,
        rent: data.rent,
        serviceCharge: data.serviceCharge,
        securityDeposit: data.securityDeposit,
        depositReceivedAt: data.depositReceivedAt ? toDate(data.depositReceivedAt) : null,
        noticeMonths: data.noticeMonths ?? settings.defaultNoticeMonths,
        notes: data.notes ?? null,
      },
    });
    if (data.initialMeterReading != null) {
      await recordInitialReading(tx, lease, data.initialMeterReading, lease.startDate);
    }
    if (apt.underMaintenance) await tx.apartment.update({ where: { id: apt.id }, data: { underMaintenance: false } });
    // Bill the move-in month right away if it has started (prorated by days).
    if (periodOf(lease.startDate) <= currentPeriod()) await ensureInvoice(tx, lease, periodOf(lease.startDate));
    return tx.lease.findUniqueOrThrow({ where: { id: lease.id }, include: leaseInclude });
  });

  await audit(req.user?.id, "create", "Lease", lease.id, {
    tenantId: data.tenantId,
    apartmentId: data.apartmentId,
    rent: data.rent,
  });
  res.status(201).json(serializeLease(lease));
});

leasesRouter.get("/:id", async (req, res) => {
  const id = param(req, "id");
  const lease = await prisma.lease.findUnique({
    where: { id },
    include: {
      ...leaseInclude,
      meterReadings: { orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }] },
      invoices: { include: invoiceInclude, orderBy: { period: "desc" } },
    },
  });
  if (!lease) throw notFound("Lease");
  res.json({
    ...serializeLease(lease),
    meterReadings: lease.meterReadings.map(serializeReading),
    invoices: lease.invoices.map(serializeInvoice),
  });
});

const updateSchema = z.object({
  endDate: date.nullish(),
  rent: money.optional(),
  serviceCharge: money.optional(),
  securityDeposit: money.optional(),
  depositReceivedAt: date.nullish(),
  noticeMonths: z.coerce.number().int().min(0).max(12).optional(),
  notes: z.string().max(2000).nullish(),
});

/** Edit terms. Rent/service charge changes apply to invoices generated from now on. */
leasesRouter.patch("/:id", async (req, res) => {
  const id = param(req, "id");
  const data = body(req, updateSchema);
  const lease = await prisma.lease.findUnique({ where: { id } });
  if (!lease) throw notFound("Lease");
  if (lease.status === "ENDED") throw conflict("This lease has ended");
  const updated = await prisma.lease.update({
    where: { id },
    data: {
      ...data,
      endDate: data.endDate === undefined ? undefined : data.endDate ? toDate(data.endDate) : null,
      depositReceivedAt:
        data.depositReceivedAt === undefined ? undefined : data.depositReceivedAt ? toDate(data.depositReceivedAt) : null,
    },
    include: leaseInclude,
  });
  await audit(req.user?.id, "update", "Lease", id, {
    before: { rent: Number(lease.rent), serviceCharge: Number(lease.serviceCharge) },
    after: data,
  } as Prisma.InputJsonValue);
  res.json(serializeLease(updated));
});

const noticeSchema = z.object({
  noticeGivenAt: date.default(() => todayISO()),
  noticeBy: z.nativeEnum(NoticeBy),
  moveOutDate: date.optional(),
});

leasesRouter.post("/:id/notice", async (req, res) => {
  const id = param(req, "id");
  const data = body(req, noticeSchema);
  const lease = await prisma.lease.findUnique({ where: { id } });
  if (!lease) throw notFound("Lease");
  if (lease.status !== "ACTIVE") throw conflict("Notice can only be given on an active lease");
  const given = toDate(data.noticeGivenAt);
  const moveOut = data.moveOutDate ? toDate(data.moveOutDate) : addMonthsToDate(given, lease.noticeMonths);
  const updated = await prisma.lease.update({
    where: { id },
    data: { status: "NOTICE", noticeGivenAt: given, noticeBy: data.noticeBy, moveOutDate: moveOut },
    include: leaseInclude,
  });
  await audit(req.user?.id, "notice", "Lease", id, { ...data, moveOutDate: isoDate(moveOut) });
  res.json(serializeLease(updated));
});

leasesRouter.post("/:id/cancel-notice", async (req, res) => {
  const id = param(req, "id");
  const lease = await prisma.lease.findUnique({ where: { id } });
  if (!lease || lease.status !== "NOTICE") throw conflict("This lease is not under notice");
  const updated = await prisma.lease.update({
    where: { id },
    data: { status: "ACTIVE", noticeGivenAt: null, noticeBy: null, moveOutDate: null },
    include: leaseInclude,
  });
  await audit(req.user?.id, "cancel-notice", "Lease", id);
  res.json(serializeLease(updated));
});

const endSchema = z.object({
  endedAt: date.default(() => todayISO()),
  finalMeterReading: z.coerce.number().min(0).nullish(),
  finalElectricityAmount: z.coerce.number().min(0).nullish(),
  /** Charge only the days stayed in the final month. Any overpayment becomes tenant credit. */
  prorateFinalMonth: z.boolean().default(true),
});

/**
 * End a lease. The final month's invoice is created (or re-prorated if it is still unpaid),
 * the final electricity reading is billed, and the apartment becomes vacant.
 */
leasesRouter.post("/:id/end", async (req, res) => {
  const id = param(req, "id");
  const data = body(req, endSchema);
  const lease = await prisma.lease.findUnique({ where: { id } });
  if (!lease) throw notFound("Lease");
  if (lease.status === "ENDED") throw conflict("This lease has already ended");
  const endedAt = toDate(data.endedAt);
  if (endedAt < lease.startDate) throw badRequest("End date cannot be before the lease start date");
  const period = periodOf(endedAt);

  const result = await prisma.$transaction(async (tx) => {
    const ended = await tx.lease.update({
      where: { id },
      data: { status: "ENDED", endedAt, moveOutDate: lease.moveOutDate ?? endedAt },
    });

    // Re-prorate the final month's invoice so the tenant pays only for the days they stayed.
    const existing = await tx.invoice.findUnique({
      where: { leaseId_period: { leaseId: id, period } },
      include: { lines: true },
    });
    if (existing && data.prorateFinalMonth && existing.status !== "VOID") {
      const { factor, days, total } = coverage(ended, period);
      const note = factor < 1 ? ` (${days}/${total} days)` : "";
      for (const l of existing.lines) {
        if (l.type !== "RENT" && l.type !== "SERVICE_CHARGE") continue;
        const base = l.type === "RENT" ? ended.rent : ended.serviceCharge;
        const label = l.type === "RENT" ? "Rent" : "Service charge";
        await tx.invoiceLine.update({
          where: { id: l.id },
          data: {
            amount: D(base).times(factor).toDecimalPlaces(2),
            description: `${label} for ${period}${note}`,
          },
        });
      }
      await recalcInvoice(tx, existing.id);
      await applyCredit(tx, ended.tenantId);
    } else if (!existing) {
      await ensureInvoice(tx, ended, period);
    }

    if (data.finalMeterReading != null) {
      await recordBillingReading(tx, { ...ended, status: "NOTICE" }, {
        period,
        readingDate: endedAt,
        current: data.finalMeterReading,
        amount: data.finalElectricityAmount,
        append: true,
      });
    }
    return tx.lease.findUniqueOrThrow({ where: { id }, include: leaseInclude });
  });

  const finalInvoice = await prisma.invoice.findUnique({
    where: { leaseId_period: { leaseId: id, period } },
    include: invoiceInclude,
  });
  await audit(req.user?.id, "end", "Lease", id, data);
  res.json({ lease: serializeLease(result), finalInvoice: finalInvoice ? serializeInvoice(finalInvoice) : null });
});
