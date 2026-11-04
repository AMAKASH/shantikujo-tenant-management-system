import { Router } from "express";
import { Facing, Prisma } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { body, conflict, notFound, param, query } from "../../lib/http.js";
import { num } from "../../lib/money.js";
import { prisma } from "../../lib/prisma.js";
import { getDefaultProperty } from "../settings/property.js";
import { isoDate } from "../../lib/dates.js";
import { serializeReading } from "../meter-readings/service.js";
import { compareApt } from "../../lib/sort.js";

export const apartmentsRouter = Router();

const money = z.coerce.number().min(0).max(99_999_999);
const optInt = z.coerce.number().int().min(0).nullish();

const apartmentSchema = z.object({
  number: z.string().trim().min(1).max(20),
  floor: optInt,
  rooms: z.coerce.number().int().min(0).max(50),
  toilets: z.coerce.number().int().min(0).max(50),
  balconies: z.coerce.number().int().min(0).max(50),
  facing: z.nativeEnum(Facing),
  sizeSqft: optInt,
  meterNo: z.string().trim().max(50).nullish(),
  defaultRent: money.nullish(),
  defaultServiceCharge: money.nullish(),
  underMaintenance: z.boolean().optional(),
  notes: z.string().max(2000).nullish(),
});

export const activeLeaseWhere = { status: { in: ["ACTIVE", "NOTICE"] } } satisfies Prisma.LeaseWhereInput;

const withLease = {
  leases: {
    where: activeLeaseWhere,
    take: 1,
    include: { tenant: { select: { id: true, fullName: true, phone: true } } },
  },
} satisfies Prisma.ApartmentInclude;

type ApartmentWithLease = Prisma.ApartmentGetPayload<{ include: typeof withLease }>;

export function serializeApartment(a: ApartmentWithLease) {
  const lease = a.leases[0];
  const status = lease ? "OCCUPIED" : a.underMaintenance ? "MAINTENANCE" : "VACANT";
  return {
    ...a,
    leases: undefined,
    defaultRent: num(a.defaultRent),
    defaultServiceCharge: num(a.defaultServiceCharge),
    status,
    currentLease: lease
      ? {
          id: lease.id,
          status: lease.status,
          rent: num(lease.rent),
          serviceCharge: num(lease.serviceCharge),
          startDate: isoDate(lease.startDate),
          moveOutDate: lease.moveOutDate ? isoDate(lease.moveOutDate) : null,
          tenant: lease.tenant,
        }
      : null,
  };
}

const listQuery = z.object({
  status: z.enum(["VACANT", "OCCUPIED", "MAINTENANCE"]).optional(),
  q: z.string().optional(),
});

apartmentsRouter.get("/", async (req, res) => {
  const { status, q } = query(req, listQuery);
  const rows = await prisma.apartment.findMany({
    where: q ? { number: { contains: q, mode: "insensitive" } } : undefined,
    include: withLease,
    orderBy: [{ floor: "asc" }, { number: "asc" }],
  });
  let items = rows.map(serializeApartment).sort((a, b) => compareApt(a.number, b.number));
  if (status) items = items.filter((a) => a.status === status);
  res.json({ items });
});

apartmentsRouter.post("/", async (req, res) => {
  const data = body(req, apartmentSchema);
  const property = await getDefaultProperty();
  const apt = await prisma.apartment.create({
    data: { ...data, propertyId: property.id },
    include: withLease,
  });
  await audit(req.user?.id, "create", "Apartment", apt.id, { number: apt.number });
  res.status(201).json(serializeApartment(apt));
});

apartmentsRouter.get("/:id", async (req, res) => {
  const id = param(req, "id");
  const apt = await prisma.apartment.findUnique({ where: { id }, include: withLease });
  if (!apt) throw notFound("Apartment");

  const [leases, readings, income] = await Promise.all([
    prisma.lease.findMany({
      where: { apartmentId: id },
      orderBy: { startDate: "desc" },
      include: { tenant: { select: { id: true, fullName: true, phone: true } } },
    }),
    prisma.meterReading.findMany({ where: { apartmentId: id }, orderBy: { readingDate: "desc" }, take: 24 }),
    prisma.$queryRaw<{ period: string; collected: number }[]>`
      SELECT i."period", COALESCE(SUM(pa."amount"),0)::float AS collected
      FROM "Invoice" i
      JOIN "Lease" l ON l."id" = i."leaseId"
      LEFT JOIN "PaymentAllocation" pa ON pa."invoiceId" = i."id"
      WHERE l."apartmentId" = ${id} AND i."status" <> 'VOID'
      GROUP BY i."period" ORDER BY i."period" DESC LIMIT 12`,
  ]);

  res.json({
    ...serializeApartment(apt),
    leaseHistory: leases.map((l) => ({
      id: l.id,
      status: l.status,
      startDate: isoDate(l.startDate),
      endedAt: l.endedAt ? isoDate(l.endedAt) : null,
      rent: num(l.rent),
      tenant: l.tenant,
    })),
    meterReadings: readings.map(serializeReading),
    income,
  });
});

apartmentsRouter.patch("/:id", async (req, res) => {
  const id = param(req, "id");
  const data = body(req, apartmentSchema.partial());
  const apt = await prisma.apartment.update({ where: { id }, data, include: withLease });
  await audit(req.user?.id, "update", "Apartment", id, data as Prisma.InputJsonValue);
  res.json(serializeApartment(apt));
});

apartmentsRouter.delete("/:id", async (req, res) => {
  const id = param(req, "id");
  const leases = await prisma.lease.count({ where: { apartmentId: id } });
  if (leases > 0) throw conflict("This apartment has lease history and cannot be deleted. Mark it under maintenance instead.");
  await prisma.meterReading.deleteMany({ where: { apartmentId: id } });
  await prisma.apartment.delete({ where: { id } });
  await audit(req.user?.id, "delete", "Apartment", id);
  res.status(204).end();
});
