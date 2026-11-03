import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

// Bangladesh uses lakh/crore grouping (1,00,000), which matches the en-IN locale.
const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const nf0 = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export const taka = (n: number | null | undefined, opts: { decimals?: boolean } = {}) =>
  n == null ? "—" : `৳${(opts.decimals === false ? nf0 : nf).format(n)}`;

export const number = (n: number | null | undefined) => (n == null ? "—" : nf.format(n));

export function compactTaka(n: number) {
  if (Math.abs(n) >= 1_00_00_000) return `৳${(n / 1_00_00_000).toFixed(1).replace(/\.0$/, "")}Cr`;
  if (Math.abs(n) >= 1_00_000) return `৳${(n / 1_00_000).toFixed(1).replace(/\.0$/, "")}L`;
  if (Math.abs(n) >= 1_000) return `৳${(n / 1_000).toFixed(0)}K`;
  return `৳${n}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function periodLabel(period: string, long = false) {
  const [y, m] = period.split("-").map(Number);
  if (long) return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
  return `${MONTHS[m - 1]} ${String(y).slice(2)}`;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" });
}

export function todayISO() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

export const currentPeriod = () => todayISO().slice(0, 7);

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

export function shiftPeriod(period: string, n: number) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export const initials = (name: string) =>
  name
    .replace(/^(md\.?|mohammad|mohammed)\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

export const FACING_LABEL: Record<string, string> = {
  NORTH: "North",
  NORTH_EAST: "North-East",
  EAST: "East",
  SOUTH_EAST: "South-East",
  SOUTH: "South",
  SOUTH_WEST: "South-West",
  WEST: "West",
  NORTH_WEST: "North-West",
};

export const FACING_SHORT: Record<string, string> = {
  NORTH: "N",
  NORTH_EAST: "NE",
  EAST: "E",
  SOUTH_EAST: "SE",
  SOUTH: "S",
  SOUTH_WEST: "SW",
  WEST: "W",
  NORTH_WEST: "NW",
};

export const RELATION_LABEL: Record<string, string> = {
  SPOUSE: "Spouse",
  SON: "Son",
  DAUGHTER: "Daughter",
  FATHER: "Father",
  MOTHER: "Mother",
  SIBLING: "Sibling",
  RELATIVE: "Relative",
  OTHER: "Other",
};

export const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank transfer",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
  CHEQUE: "Cheque",
  OTHER: "Other",
};

export const LINE_LABEL: Record<string, string> = {
  RENT: "Rent",
  SERVICE_CHARGE: "Service charge",
  ELECTRICITY: "Electricity",
  WATER: "Water",
  GAS: "Gas",
  OTHER: "Other",
  DISCOUNT: "Discount",
};

export const DOC_LABEL: Record<string, string> = {
  PHOTO: "Passport photo",
  LEASE_FORM: "Lease form",
  POLICE_VERIFICATION: "Police verification",
  NID_COPY: "NID copy",
  OTHER: "Other document",
};
