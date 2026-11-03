import type { Settings } from "./types";

/** Mirrors the backend slab calculator so the estimate shows while typing. */
export function estimateBill(units: number, s: Settings["electricity"]) {
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
  return Math.round(total * 100) / 100;
}
