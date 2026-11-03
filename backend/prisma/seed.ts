/**
 * Development seed: admin user, one property, apartments, tenants with families,
 * leases and ~8 months of invoices, meter readings and payments.
 *
 *   npm run db:seed            (refuses to run if tenants exist)
 *   npm run db:seed -- --force (wipes business data first)
 */
import { PrismaClient, type Facing, type PaymentMethod, type Relation } from "@prisma/client";
import { ensureAdmin } from "../src/scripts/create-admin.js";
import { addMonths, currentPeriod, dueDateFor, periodStart, toDate } from "../src/lib/dates.js";
import { D } from "../src/lib/money.js";
import { nextNumber } from "../src/lib/sequence.js";
import { saveSettings } from "../src/lib/settings.js";
import { allocate, generateForPeriod } from "../src/modules/invoices/service.js";
import { recordBillingReading, recordInitialReading } from "../src/modules/meter-readings/service.js";

const prisma = new PrismaClient();
const force = process.argv.includes("--force");

const APARTMENTS: { number: string; floor: number; rooms: number; toilets: number; balconies: number; facing: Facing; size: number; rent: number }[] = [
  { number: "1A", floor: 1, rooms: 3, toilets: 2, balconies: 2, facing: "SOUTH", size: 1250, rent: 22000 },
  { number: "1B", floor: 1, rooms: 2, toilets: 2, balconies: 1, facing: "NORTH_EAST", size: 950, rent: 16000 },
  { number: "2A", floor: 2, rooms: 3, toilets: 2, balconies: 2, facing: "SOUTH", size: 1250, rent: 23000 },
  { number: "2B", floor: 2, rooms: 2, toilets: 2, balconies: 1, facing: "NORTH_EAST", size: 950, rent: 16500 },
  { number: "3A", floor: 3, rooms: 3, toilets: 3, balconies: 2, facing: "SOUTH_EAST", size: 1350, rent: 25000 },
  { number: "3B", floor: 3, rooms: 2, toilets: 2, balconies: 1, facing: "WEST", size: 950, rent: 16500 },
  { number: "4A", floor: 4, rooms: 3, toilets: 3, balconies: 2, facing: "SOUTH_EAST", size: 1350, rent: 25500 },
  { number: "4B", floor: 4, rooms: 2, toilets: 1, balconies: 1, facing: "EAST", size: 850, rent: 15000 },
];

const TENANTS: {
  fullName: string;
  nid: string;
  phone: string;
  email?: string;
  address: string;
  occupation: string;
  apt: string;
  monthsAgo: number;
  payer: "good" | "late" | "partial";
  family: { name: string; relation: Relation; phone?: string }[];
}[] = [
  {
    fullName: "Md. Rafiqul Islam",
    nid: "1987654321012",
    phone: "01711000001",
    email: "rafiq@example.com",
    address: "Village Kashimpur, Gazipur Sadar, Gazipur",
    occupation: "Bank officer",
    apt: "1A",
    monthsAgo: 14,
    payer: "good",
    family: [
      { name: "Nasrin Akter", relation: "SPOUSE", phone: "01711000011" },
      { name: "Rahim Islam", relation: "SON" },
      { name: "Riya Islam", relation: "DAUGHTER" },
    ],
  },
  {
    fullName: "Farhana Haque",
    nid: "6543219870",
    phone: "01819000002",
    address: "House 12, Road 4, Uposhohor, Rajshahi",
    occupation: "Doctor",
    apt: "2A",
    monthsAgo: 9,
    payer: "good",
    family: [{ name: "Tanvir Haque", relation: "SPOUSE", phone: "01819000022" }],
  },
  {
    fullName: "Abdul Karim",
    nid: "19901234567890123",
    phone: "01912000003",
    address: "Ward 5, Sylhet Sadar, Sylhet",
    occupation: "Businessman",
    apt: "2B",
    monthsAgo: 7,
    payer: "late",
    family: [
      { name: "Shirin Begum", relation: "SPOUSE" },
      { name: "Hasina Begum", relation: "MOTHER" },
    ],
  },
  {
    fullName: "Sabbir Ahmed",
    nid: "2345678901",
    phone: "01611000004",
    email: "sabbir@example.com",
    address: "Chawkbazar, Chattogram",
    occupation: "Software engineer",
    apt: "3A",
    monthsAgo: 5,
    payer: "partial",
    family: [{ name: "Mitu Ahmed", relation: "SPOUSE", phone: "01611000044" }],
  },
  {
    fullName: "Nusrat Jahan",
    nid: "8765432109876",
    phone: "01511000005",
    address: "Kotwali, Barishal",
    occupation: "Teacher",
    apt: "4A",
    monthsAgo: 3,
    payer: "good",
    family: [],
  },
  {
    fullName: "Kamal Hossain",
    nid: "3456789012",
    phone: "01311000006",
    address: "Sadar, Cumilla",
    occupation: "Government employee",
    apt: "1B",
    monthsAgo: 11,
    payer: "late",
    family: [
      { name: "Rokeya Hossain", relation: "SPOUSE" },
      { name: "Arif Hossain", relation: "SON", phone: "01311000066" },
    ],
  },
];

const METHODS: PaymentMethod[] = ["CASH", "BKASH", "BANK", "NAGAD", "CASH"];

async function main() {
  const tenantCount = await prisma.tenant.count();
  if (tenantCount > 0 && !force) {
    console.log("Database already has tenants. Re-run with --force to wipe and reseed.");
    await ensureAdmin();
    return;
  }
  if (force) {
    console.log("Wiping business data…");
    await prisma.$transaction([
      prisma.paymentAllocation.deleteMany(),
      prisma.payment.deleteMany(),
      prisma.invoiceLine.deleteMany(),
      prisma.invoice.deleteMany(),
      prisma.meterReading.deleteMany(),
      prisma.lease.deleteMany(),
      prisma.document.deleteMany(),
      prisma.familyMember.deleteMany(),
      prisma.tenant.deleteMany(),
      prisma.apartment.deleteMany(),
      prisma.property.deleteMany(),
      prisma.sequence.deleteMany(),
      prisma.auditLog.deleteMany(),
    ]);
  }

  await ensureAdmin();
  await saveSettings({ propertyName: "Shantikunjo Residency", propertyAddress: "123 Shantikunjo Road, Dhaka" });
  const property = await prisma.property.create({
    data: { name: "Shantikunjo Residency", address: "123 Shantikunjo Road, Dhaka", floors: 4 },
  });

  const apts = new Map<string, string>();
  for (const a of APARTMENTS) {
    const apt = await prisma.apartment.create({
      data: {
        propertyId: property.id,
        number: a.number,
        floor: a.floor,
        rooms: a.rooms,
        toilets: a.toilets,
        balconies: a.balconies,
        facing: a.facing,
        sizeSqft: a.size,
        meterNo: `SM-${a.number}`,
        defaultRent: a.rent,
        defaultServiceCharge: 2500,
        underMaintenance: a.number === "4B",
      },
    });
    apts.set(a.number, apt.id);
  }

  const now = currentPeriod();
  const leases: { id: string; tenantId: string; payer: string; meter: number }[] = [];

  for (const t of TENANTS) {
    const tenant = await prisma.tenant.create({
      data: {
        fullName: t.fullName,
        nid: t.nid,
        phone: t.phone,
        email: t.email,
        permanentAddress: t.address,
        occupation: t.occupation,
        emergencyContactName: t.family[0]?.name,
        emergencyContactPhone: t.family[0]?.phone,
        familyMembers: { create: t.family },
      },
    });
    const apt = APARTMENTS.find((a) => a.number === t.apt)!;
    const startPeriod = addMonths(now, -t.monthsAgo);
    const lease = await prisma.lease.create({
      data: {
        tenantId: tenant.id,
        apartmentId: apts.get(t.apt)!,
        startDate: periodStart(startPeriod),
        rent: apt.rent,
        serviceCharge: 2500,
        securityDeposit: apt.rent * 2,
        depositReceivedAt: periodStart(startPeriod),
        noticeMonths: 2,
      },
    });
    const meter = 1000 + Math.floor(Math.random() * 4000);
    await prisma.$transaction((tx) => recordInitialReading(tx, lease, meter, lease.startDate));
    leases.push({ id: lease.id, tenantId: tenant.id, payer: t.payer, meter });
  }

  // Bill and pay history for the last 8 months (older months are left out to keep the seed fast).
  for (let i = 7; i >= 0; i--) {
    const period = addMonths(now, -i);
    await generateForPeriod(period);

    for (const l of leases) {
      const lease = await prisma.lease.findUniqueOrThrow({ where: { id: l.id } });
      const inv = await prisma.invoice.findUnique({ where: { leaseId_period: { leaseId: l.id, period } } });
      if (!inv) continue;

      // Electricity for the month: 120–380 units.
      l.meter += 120 + Math.floor(Math.random() * 260);
      await prisma.$transaction((tx) =>
        recordBillingReading(tx, lease, {
          period,
          readingDate: toDate(`${period}-05`),
          current: l.meter,
        }),
      );

      // Payments: good payers pay in full before the due date; late payers miss recent months; partial pays ~60%.
      const fresh = await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } });
      const total = Number(fresh.total);
      let pay = 0;
      let day = 3 + Math.floor(Math.random() * 6);
      if (l.payer === "good") pay = i === 0 ? (Math.random() > 0.4 ? total : 0) : total;
      if (l.payer === "late") {
        pay = i >= 2 ? total : 0;
        day = 15 + Math.floor(Math.random() * 10);
      }
      if (l.payer === "partial") pay = i === 0 ? 0 : Math.round(total * 0.6);
      if (pay <= 0) continue;

      const due = dueDateFor(period, 10);
      const date = new Date(due.getTime() + (day - 10) * 86_400_000);
      if (date > new Date()) continue;
      await prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({
          data: {
            number: await nextNumber(tx, "RCT", date.getUTCFullYear()),
            tenantId: l.tenantId,
            amount: pay,
            date,
            method: METHODS[Math.floor(Math.random() * METHODS.length)],
            reference: Math.random() > 0.5 ? `TRX${Math.floor(Math.random() * 1e8)}` : null,
          },
        });
        await allocate(tx, l.tenantId, [{ id: p.id, left: D(pay) }], [inv.id]);
      });
    }
  }

  const [invoices, payments] = await Promise.all([prisma.invoice.count(), prisma.payment.count()]);
  console.log(`Seeded ${APARTMENTS.length} apartments, ${TENANTS.length} tenants, ${invoices} invoices, ${payments} payments.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
