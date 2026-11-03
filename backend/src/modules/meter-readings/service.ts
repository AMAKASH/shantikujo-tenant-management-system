import { Prisma, type Lease } from "@prisma/client";
import { isoDate } from "../../lib/dates.js";
import { badRequest, conflict } from "../../lib/http.js";
import { D } from "../../lib/money.js";
import type { Tx } from "../../lib/prisma.js";
import { calcElectricity, getSettings } from "../../lib/settings.js";
import { applyCredit, ensureInvoice, recalcInvoice } from "../invoices/service.js";

/** Most recent reading for an apartment, optionally excluding one (when editing). */
export function lastReading(tx: Tx, apartmentId: string, excludeId?: string) {
  return tx.meterReading.findFirst({
    where: { apartmentId, ...(excludeId ? { id: { not: excludeId } } : {}) },
    orderBy: [{ readingDate: "desc" }, { createdAt: "desc" }],
  });
}

export async function recordInitialReading(tx: Tx, lease: Lease, value: number, date: Date) {
  return tx.meterReading.create({
    data: {
      apartmentId: lease.apartmentId,
      leaseId: lease.id,
      period: isoDate(date).slice(0, 7),
      readingDate: date,
      previous: value,
      current: value,
      units: 0,
      amount: 0,
      isInitial: true,
    },
  });
}

/**
 * Record (or update) the billing reading for a lease and period, and put the charge on that
 * period's invoice as an ELECTRICITY line. The amount is entered manually; if it is left out,
 * it is estimated from the slab table in Settings.
 */
export async function recordBillingReading(
  tx: Tx,
  lease: Lease,
  input: {
    period: string;
    readingDate: Date;
    current: number;
    amount?: number | null;
    isReset?: boolean;
    /** Always add a new reading (e.g. the final reading at move-out) instead of updating this period's one. */
    append?: boolean;
  },
) {
  if (input.readingDate < lease.startDate) {
    throw badRequest(`Reading date can't be before the lease start (${isoDate(lease.startDate)})`);
  }
  const existing = input.append
    ? null
    : await tx.meterReading.findFirst({
        where: { leaseId: lease.id, period: input.period, isInitial: false },
        orderBy: { createdAt: "desc" },
        include: { invoiceLine: { include: { invoice: true } } },
      });
  const prev = await lastReading(tx, lease.apartmentId, existing?.id);
  const previous = existing ? D(existing.previous) : D(prev?.current ?? 0);
  const current = D(input.current);

  if (!input.isReset && current.lt(previous)) {
    throw badRequest(`Current reading (${current}) is lower than the previous reading (${previous}). Tick "meter reset" if the meter was replaced.`);
  }
  const units = input.isReset ? current : current.minus(previous);
  const amount =
    input.amount != null
      ? D(input.amount)
      : D(calcElectricity(units.toNumber(), (await getSettings()).electricity).total);

  const { invoice } = await ensureInvoice(tx, lease, input.period);
  if (invoice.status === "VOID") throw conflict(`The invoice for ${input.period} is void`);

  const data = { readingDate: input.readingDate, previous, current, units, amount, isReset: Boolean(input.isReset) };
  const description = `Electricity ${input.period}: ${units.toString()} units (${previous} → ${current})`;

  let reading;
  if (existing) {
    reading = await tx.meterReading.update({ where: { id: existing.id }, data });
    if (existing.invoiceLine) {
      await tx.invoiceLine.update({ where: { id: existing.invoiceLine.id }, data: { amount, description } });
    } else {
      await tx.invoiceLine.create({
        data: { invoiceId: invoice.id, type: "ELECTRICITY", description, amount, meterReadingId: reading.id },
      });
    }
  } else {
    reading = await tx.meterReading.create({
      data: { ...data, apartmentId: lease.apartmentId, leaseId: lease.id, period: input.period },
    });
    await tx.invoiceLine.create({
      data: { invoiceId: invoice.id, type: "ELECTRICITY", description, amount, meterReadingId: reading.id },
    });
  }
  await recalcInvoice(tx, invoice.id);
  await applyCredit(tx, lease.tenantId);
  return reading;
}

export const serializeReading = (r: Prisma.MeterReadingGetPayload<object>) => ({
  ...r,
  readingDate: isoDate(r.readingDate),
  previous: Number(r.previous),
  current: Number(r.current),
  units: Number(r.units),
  amount: Number(r.amount),
});
