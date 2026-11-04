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
  /** Shown on printed invoices. */
  contactPhone: string;
  contactEmail: string;
  invoiceNote: string;
  paymentMethods: string[];
  /** Bill SMS. Placeholders: {month}, {amount}, {dueDay}. */
  smsTemplate: string;
  electricity: {
    slabs: SlabRow[];
    demandCharge: number;
    vatPercent: number;
    /** Low-usage flat rate: at or below maxUnits, bill units × rate with no demand charge or VAT. */
    flatRate: { enabled: boolean; maxUnits: number; rate: number };
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
  contactPhone: "",
  contactEmail: "",
  invoiceNote: "Please make the payment by the due date to avoid further charges.",
  paymentMethods: ["BANK", "BKASH", "CASH"],
  smsTemplate: [
    "আপনার {month} মাসের বিদ্যুৎ বিলসহ সর্বমোট বাসা ভাড়া {amount} টাকা।",
    "",
    "অনুগ্রহপূর্বক প্রতি মাসের {dueDay} তারিখের মধ্যে বাসা ভাড়া ও অন্যান্য বিল পরিশোধ করার জন্য অনুরোধ করা হলো।",
    "",
    "ধন্যবাদান্তে,",
    "",
    "শান্তিকুঞ্জ",
    "",
    "বাসা নং ২৭, রোড নং ৫, ব্লক ডি",
    "ঢাকা উদ্যান, ঢাকা।",
  ].join("\n"),
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
    flatRate: { enabled: true, maxUnits: 200, rate: 8.5 },
  },
};

const KEY = "app";

export async function getSettings(): Promise<AppSettings> {
  const row = await prisma.setting.findUnique({ where: { key: KEY } });
  const stored = (row?.value ?? {}) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    electricity: {
      ...DEFAULT_SETTINGS.electricity,
      ...(stored.electricity ?? {}),
      flatRate: { ...DEFAULT_SETTINGS.electricity.flatRate, ...(stored.electricity?.flatRate ?? {}) },
    },
  };
}

export type SettingsPatch = Partial<Omit<AppSettings, "electricity">> & { electricity?: Partial<AppSettings["electricity"]> };

export async function saveSettings(patch: SettingsPatch): Promise<AppSettings> {
  const current = await getSettings();
  const merged: AppSettings = {
    ...current,
    ...patch,
    electricity: {
      ...current.electricity,
      ...patch.electricity,
      flatRate: patch.electricity?.flatRate ?? current.electricity.flatRate,
    },
  };
  await prisma.setting.upsert({
    where: { key: KEY },
    create: { key: KEY, value: merged as object },
    update: { value: merged as object },
  });
  return merged;
}

/**
 * Electricity estimate, rounded to 2 decimals.
 * - Flat mode (when enabled and units ≤ maxUnits): units × flat rate, no demand charge or VAT.
 * - Slab mode otherwise: tiered energy charge + demand charge, plus VAT.
 */
export function calcElectricity(units: number, s: AppSettings["electricity"]) {
  const flat = s.flatRate;
  if (flat?.enabled && units <= flat.maxUnits) {
    const energy = round2(units * flat.rate);
    return { mode: "flat" as const, energy, demandCharge: 0, vat: 0, total: energy };
  }
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
  return { mode: "slab" as const, energy: round2(energy), demandCharge: s.demandCharge, vat: round2(total - base), total: round2(total) };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
