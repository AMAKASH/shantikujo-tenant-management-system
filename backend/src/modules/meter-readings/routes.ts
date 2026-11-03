import { Router } from "express";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { currentPeriod, PERIOD_RE, toDate, todayISO } from "../../lib/dates.js";
import { body, conflict, notFound, param, query } from "../../lib/http.js";
import { prisma } from "../../lib/prisma.js";
import { calcElectricity, getSettings } from "../../lib/settings.js";
import { activeLeaseWhere } from "../apartments/routes.js";
import { recalcInvoice } from "../invoices/service.js";
import { recordBillingReading, serializeReading } from "./service.js";

export const meterReadingsRouter = Router();

/** Bulk-entry sheet: every occupied apartment with its previous reading and this period's reading, if any. */
meterReadingsRouter.get("/", async (req, res) => {
  const { period = currentPeriod() } = query(req, z.object({ period: z.string().regex(PERIOD_RE).optional() }));
  const leases = await prisma.lease.findMany({
    where: activeLeaseWhere,
    include: {
      apartment: { select: { id: true, number: true, floor: true, meterNo: true } },
      tenant: { select: { id: true, fullName: true } },
    },
    orderBy: { apartment: { number: "asc" } },
  });

  const items = await Promise.all(
    leases.map(async (l) => {
      const [thisPeriod, previous] = await Promise.all([
        prisma.meterReading.findFirst({ where: { leaseId: l.id, period, isInitial: false } }),
        prisma.meterReading.findFirst({
          where: { apartmentId: l.apartmentId, NOT: { leaseId: l.id, period, isInitial: false } },
          orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
        }),
      ]);
      return {
        leaseId: l.id,
        apartment: l.apartment,
        tenant: l.tenant,
        previousReading: thisPeriod ? Number(thisPeriod.previous) : previous ? Number(previous.current) : 0,
        reading: thisPeriod ? serializeReading(thisPeriod) : null,
      };
    }),
  );
  res.json({ period, items });
});

meterReadingsRouter.get("/estimate", async (req, res) => {
  const { units } = query(req, z.object({ units: z.coerce.number().min(0) }));
  res.json(calcElectricity(units, (await getSettings()).electricity));
});

const readingSchema = z.object({
  leaseId: z.string().min(1),
  period: z.string().regex(PERIOD_RE).default(() => currentPeriod()),
  readingDate: z.string().date().default(() => todayISO()),
  current: z.coerce.number().min(0).max(99_999_999),
  amount: z.coerce.number().min(0).max(9_999_999).nullish(),
  isReset: z.boolean().optional(),
});

meterReadingsRouter.post("/", async (req, res) => {
  const data = body(req, readingSchema);
  const lease = await prisma.lease.findUnique({ where: { id: data.leaseId } });
  if (!lease) throw notFound("Lease");
  if (lease.status === "ENDED") throw conflict("This lease has ended. Enter the final reading when ending a lease.");
  const reading = await prisma.$transaction((tx) =>
    recordBillingReading(tx, lease, { ...data, readingDate: toDate(data.readingDate) }),
  );
  await audit(req.user?.id, "record", "MeterReading", reading.id, {
    leaseId: lease.id,
    period: data.period,
    current: data.current,
    amount: Number(reading.amount),
  });
  res.status(201).json(serializeReading(reading));
});

meterReadingsRouter.delete("/:id", async (req, res) => {
  const id = param(req, "id");
  const r = await prisma.meterReading.findUnique({ where: { id }, include: { invoiceLine: { include: { invoice: true } } } });
  if (!r) throw notFound("Meter reading");
  if (r.isInitial) throw conflict("The move-in reading cannot be deleted");
  if (r.invoiceLine?.invoice.status === "PAID") {
    throw conflict("That electricity charge is on a paid invoice. Void the invoice first.");
  }
  await prisma.$transaction(async (tx) => {
    if (r.invoiceLine) {
      await tx.invoiceLine.delete({ where: { id: r.invoiceLine.id } });
      await recalcInvoice(tx, r.invoiceLine.invoiceId);
    }
    await tx.meterReading.delete({ where: { id } });
  });
  await audit(req.user?.id, "delete", "MeterReading", id);
  res.status(204).end();
});
