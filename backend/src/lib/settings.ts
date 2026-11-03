import { prisma } from "./prisma.js";

export type SlabRow = { upTo: number | null; rate: number };

export interface AppSettings {
  propertyName: string;
  propertyAddress: string;
  dueDay: number;
  invoicePrefix: string;
  receiptPrefix: string;
  defaultNoticeMonths: number;
  currency: string;
  electricity: {
    slabs: SlabRow[];
    demandCharge: number;
    vatPercent: number;
  };
}

export const DEFAULT_SETTINGS: AppSettings = {
  propertyName: "Shantikunjo Residency",
  propertyAddress: "",
  dueDay: 10,
  invoicePrefix: "INV",
  receiptPrefix: "RCT",
  defaultNoticeMonths: 2,
  currency: "BDT",
  // Default: BD residential (LT-A) style slabs. Editable in Settings; verify against the current tariff.
  electricity: {
    slabs: [
      { upTo: 75, rate: 5.26 },
      { upTo: 200, rate: 7.2 },
      { upTo: 300, rate: 7.59 },
      { upTo: 400, rate: 8.02 },
      { upTo: 600, rate: 12.67 },
      { upTo: null, rate: 14.61 },
    ],
    demandCharge: 42,
    vatPercent: 5,
  },
};

const KEY = "app";

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const stored = (row?.value ?? {}) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    electricity: { ...DEFAULT_SETTINGS.electricity, ...(stored.electricity ?? {}) },
  };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const merged = { ...(await getSettings()), ...patch };
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: merged as object },
    update: { value: merged as object },
  });
  return merged;
}

/** Slab-based electricity estimate. Returns the amount rounded to 2 decimals. */
export function calcElectricity(units: number, s: AppSettings["electricity"]) {
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
  const base = energy + s.demandCharge;
  const total = base * (1 + s.vatPercent / 100);
  return { energy: round2(energy), demandCharge: s.demandCharge, vat: round2(total - base), total: round2(total) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
