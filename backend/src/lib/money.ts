import { Prisma } from "@prisma/client";

export const D = (v: Prisma.Decimal.Value | null | undefined) => new Prisma.Decimal(v ?? 0);
export const ZERO = new Prisma.Decimal(0);

export const sum = (values: Array<Prisma.Decimal.Value | null | undefined>) =>
  values.reduce<Prisma.Decimal>((acc, v) => acc.plus(D(v)), ZERO);

/** Serialize Decimal as a plain number for JSON (values fit comfortably in a double at 2dp). */
export const num = (v: Prisma.Decimal.Value | null | undefined) => (v == null ? null : Number(v));
