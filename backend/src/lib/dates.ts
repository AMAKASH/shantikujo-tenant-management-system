/**
 * Date helpers. All business dates are calendar dates in Asia/Dhaka.
 * We store them as Postgres DATE (midnight UTC in JS), so we build them in UTC.
 */
const TZ = "Asia/Dhaka";

/** Today's calendar date in Dhaka as YYYY-MM-DD. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

export const toDate = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00.000Z`);
export const today = () => toDate(todayISO());
export const currentPeriod = () => todayISO().slice(0, 7);

export const isoDate = (d: Date) => d.toISOString().slice(0, 10);
export const periodOf = (d: Date) => isoDate(d).slice(0, 7);

export function periodStart(period: string) {
  return toDate(`${period}-01`);
}

export function periodEnd(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0));
}

export function daysInPeriod(period: string) {
  return periodEnd(period).getUTCDate();
}

export function dueDateFor(period: string, dueDay: number) {
  const day = Math.min(dueDay, daysInPeriod(period));
  return toDate(`${period}-${String(day).padStart(2, "0")}`);
}

export function addMonths(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return isoDate(d).slice(0, 7);
}

export function addMonthsToDate(d: Date, n: number): Date {
  const r = new Date(d);
  r.setUTCMonth(r.getUTCMonth() + n);
  return r;
}

/** Last N periods ending with `end` (inclusive), oldest first. */
export function lastPeriods(end: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addMonths(end, i - (n - 1)));
}

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
