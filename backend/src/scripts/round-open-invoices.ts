/**
 * One-off: bring every open (UNPAID/PARTIAL) invoice to a whole-taka total by adding its ROUNDING line.
 * Paid and void invoices are not touched. Safe to run more than once.
 *
 *   npm run round-invoices -- --dry-run   (show what would change)
 *   npm run round-invoices                (apply)
 * In the Docker image: node dist/scripts/round-open-invoices.js [--dry-run]
 */
import { prisma } from "../lib/prisma.js";
import { audit } from "../lib/audit.js";
import { applyCredit, recalcInvoice } from "../modules/invoices/service.js";

const dryRun = process.argv.includes("--dry-run");

async function main() {
  const open = await prisma.invoice.findMany({
    where: { status: { in: ["UNPAID", "PARTIAL"] } },
    select: { id: true, number: true, tenantId: true, total: true },
    orderBy: { number: "asc" },
  });
  const fractional = open.filter((i) => !i.total.isInteger());
  console.log(`${open.length} open invoices, ${fractional.length} with paisa${dryRun ? " (dry run)" : ""}`);

  const changes: { number: string; from: number; to: number }[] = [];
  for (const inv of fractional) {
    const to = Number(inv.total.toDecimalPlaces(0, 4 /* ROUND_HALF_UP */));
    changes.push({ number: inv.number, from: Number(inv.total), to });
    if (dryRun) continue;
    await prisma.$transaction(async (tx) => {
      await recalcInvoice(tx, inv.id);
      await applyCredit(tx, inv.tenantId);
    });
  }
  for (const c of changes) console.log(`  ${c.number}: ${c.from.toFixed(2)} → ${c.to}`);
  if (!dryRun && changes.length) await audit(undefined, "round", "Invoice", undefined, { invoices: changes.length });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
