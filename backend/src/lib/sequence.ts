import type { Tx } from "./prisma.js";

/** Atomically increment a named counter and return a formatted number, e.g. INV-2026-0001. */
export async function nextNumber(tx: Tx, prefix: string, year: number): Promise<string> {
  const name = `${prefix}-${year}`;
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Sequence" ("name", "value") VALUES (${name}, 1)
    ON CONFLICT ("name") DO UPDATE SET "value" = "Sequence"."value" + 1
    RETURNING "value"`;
  return `${name}-${String(rows[0].value).padStart(4, "0")}`;
}
