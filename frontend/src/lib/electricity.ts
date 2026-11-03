import type { Settings } from "./types";

export type BillEstimate = { mode: "flat" | "slab"; total: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Mirrors the backend calculator (calcElectricity) so the estimate shows while typing. */
export function estimateBill(units: number, s: Settings["electricity"]): BillEstimate {
  const flat = s.flatRate;
  if (flat?.enabled && units <= flat.maxUnits) return { mode: "flat", total: round2(units * flat.rate) };

  let remaining = units;
  let prev = 0;
  let energy = 0;
  for (const slab of s.slabs) {
    if (remaining <= 0) break;
    const width = slab.upTo == null ? remaining : Math.max(0, slab.upTo - prev);
    const used = Math.min(remaining, width);
    energy += used * slab.rate;
    remaining -= used;
    if (slab.upTo != null) prev = slab.upTo;
  }
  const total = (energy + s.demandCharge) * (1 + s.vatPercent / 100);
  return { mode: "slab", total: round2(total) };
}
