import { Router } from "express";
import { Prisma, Relation } from "@prisma/client";
import { z } from "zod";
import { audit } from "../../lib/audit.js";
import { body, conflict, notFound, param, query } from "../../lib/http.js";
import { num } from "../../lib/money.js";
import { prisma } from "../../lib/prisma.js";
import { activeLeaseWhere } from "../apartments/routes.js";
import { serializeLease } from "../leases/serialize.js";
import { tenantBalances, tenantLedger } from "./balance.js";

export const tenantsRouter = Router();

const bdPhone = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s-]/g, "").replace(/^\+?88/, ""))
  .refine((v) => /^01[3-9]\d{8}$/.test(v), "Enter a valid Bangladeshi mobile number (01XXXXXXXXX)");

const optPhone = z
  .union([z.literal(""), bdPhone])
  .nullish()
  .transform((v) => v || null);

const optStr = (max = 200) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => v || null);

const familySchema = z.object({
  name: z.string().trim().min(1).max(120),
  relation: z.nativeEnum(Relation),
  phone: optPhone,
});

const tenantSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  nid: z
    .string()
    .trim()
    .regex(/^(\d{10}|\d{13}|\d{17})$/, "NID must be 10, 13 or 17 digits"),
  phone: bdPhone,
  email: z
    .union([z.literal(""), z.string().trim().toLowerCase().email()])
    .nullish()
    .transform((v) => v || null),
  permanentAddress: z.string().trim().min(3).max(500),
  occupation: optStr(),
  dateOfBirth: z.coerce.date().nullish(),
  emergencyContactName: optStr(120),
  emergencyContactPhone: optPhone,
  notes: optStr(2000),
  familyMembers: z.array(familySchema).max(30).optional(),
});

const maskNid = (nid: string) => `${"•".repeat(Math.max(0, nid.length - 4))}${nid.slice(-4)}`;

const listQuery = z.object({
  q: z.string().trim().optional(),
  status: z.enum(["active", "former", "archived", "all"]).default("active"),
});

tenantsRouter.get("/", async (req, res) => {
  const { q, status } = query(req, listQuery);
  const where: Prisma.TenantWhereInput = {};
  if (status === "archived") where.archivedAt = { not: null };
  else if (status !== "all") where.archivedAt = null;
  if (status === "active") where.leases = { some: activeLeaseWhere };
  if (status === "former") where.leases = { none: activeLeaseWhere };
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { nid: { contains: q } },
      { leases: { some: { ...activeLeaseWhere, apartment: { number: { contains: q, mode: "insensitive" } } } } },
    ];
  }

  const tenants = await prisma.tenant.findMany({
    where,
    orderBy: { fullName: "asc" },
    include: {
      _count: { select: { familyMembers: true } },
      leases: { where: activeLeaseWhere, take: 1, include: { apartment: { select: { id: true, number: true } } } },
      documents: { where: { supersededAt: null }, select: { id: true, type: true } },
    },
  });
  const balances = await tenantBalances(tenants.map((t) => t.id));

  res.json({
    items: tenants.map((t) => ({
      id: t.id,
      fullName: t.fullName,
      phone: t.phone,
      email: t.email,
      nidMasked: maskNid(t.nid),
      familyCount: t._count.familyMembers,
      archivedAt: t.archivedAt,
      photoId: t.documents.find((d) => d.type === "PHOTO")?.id ?? null,
      hasPoliceVerification: t.documents.some((d) => d.type === "POLICE_VERIFICATION"),
      hasLeaseForm: t.documents.some((d) => d.type === "LEASE_FORM"),
      apartment: t.leases[0]?.apartment ?? null,
      leaseStatus: t.leases[0]?.status ?? null,
      due: balances.get(t.id)?.due ?? 0,
    })),
  });
});

tenantsRouter.post("/", async (req, res) => {
  const { familyMembers = [], ...data } = body(req, tenantSchema);
  const tenant = await prisma.tenant.create({
    data: { ...data, familyMembers: { create: familyMembers } },
  });
  await audit(req.user?.id, "create", "Tenant", tenant.id, { fullName: tenant.fullName });
  res.status(201).json(tenant);
});

tenantsRouter.get("/:id", async (req, res) => {
  const id = param(req, "id");
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      familyMembers: { orderBy: { createdAt: "asc" } },
      documents: { where: { supersededAt: null }, orderBy: { uploadedAt: "desc" } },
      leases: {
        orderBy: { startDate: "desc" },
        include: { apartment: { select: { id: true, number: true, floor: true } } },
      },
    },
  });
  if (!tenant) throw notFound("Tenant");
  const balance = (await tenantBalances([id])).get(id) ?? { due: 0, credit: 0, overdue: 0 };

  res.json({
    ...tenant,
    leases: tenant.leases.map(serializeLease),
    activeLease: tenant.leases.map(serializeLease).find((l) => l.status !== "ENDED") ?? null,
    photoId: tenant.documents.find((d) => d.type === "PHOTO")?.id ?? null,
    balance,
  });
});

tenantsRouter.get("/:id/ledger", async (req, res) => {
  res.json(await tenantLedger(param(req, "id")));
});

tenantsRouter.patch("/:id", async (req, res) => {
  const id = param(req, "id");
  const { familyMembers, ...data } = body(req, tenantSchema.partial());
  const tenant = await prisma.$transaction(async (tx) => {
    if (familyMembers) {
      await tx.familyMember.deleteMany({ where: { tenantId: id } });
      await tx.familyMember.createMany({ data: familyMembers.map((f) => ({ ...f, tenantId: id })) });
    }
    return tx.tenant.update({ where: { id }, data, include: { familyMembers: true } });
  });
  await audit(req.user?.id, "update", "Tenant", id, { ...data, familyMembers: familyMembers?.length } as Prisma.InputJsonValue);
  res.json(tenant);
});

tenantsRouter.post("/:id/archive", async (req, res) => {
  const id = param(req, "id");
  const active = await prisma.lease.count({ where: { tenantId: id, ...activeLeaseWhere } });
  if (active) throw conflict("End the tenant's active lease before archiving.");
  const t = await prisma.tenant.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit(req.user?.id, "archive", "Tenant", id);
  res.json(t);
});

tenantsRouter.post("/:id/restore", async (req, res) => {
  const id = param(req, "id");
  const t = await prisma.tenant.update({ where: { id }, data: { archivedAt: null } });
  await audit(req.user?.id, "restore", "Tenant", id);
  res.json(t);
});

/** Hard delete only for tenants with no lease history (e.g. created by mistake). */
tenantsRouter.delete("/:id", async (req, res) => {
  const id = param(req, "id");
  const leases = await prisma.lease.count({ where: { tenantId: id } });
  if (leases) throw conflict("This tenant has lease history. Archive them instead.");
  await prisma.tenant.delete({ where: { id } });
  await audit(req.user?.id, "delete", "Tenant", id);
  res.status(204).end();
});

