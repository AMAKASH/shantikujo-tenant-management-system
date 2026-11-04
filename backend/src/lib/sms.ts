import { config, isProd } from "../config.js";
import { logger } from "./logger.js";

/** Outside production every SMS goes here instead of the tenant's number. */
export const DEV_SMS_NUMBER = "01973054376";

export const smsConfigured = () => Boolean(config.SMS_API_KEY && config.SMS_SENDER_ID);

/** "01973054376", "+880 1973-054376", "8801973054376" → "8801973054376". Returns null if not a BD mobile. */
export function normalizeBdPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("880")) d = d.slice(2);
  else if (d.startsWith("88")) d = d.slice(2);
  return /^01[3-9]\d{8}$/.test(d) ? `88${d}` : null;
}

/** The number an SMS is actually delivered to: the tenant's in production, the test number otherwise. */
export const deliveryNumber = (tenantPhone: string) => (isProd ? tenantPhone : normalizeBdPhone(DEV_SMS_NUMBER)!);

// ───────── Message text ─────────

const bnNumber = new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 2, minimumFractionDigits: 0 });
const bnNumber2 = new Intl.NumberFormat("bn-BD", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const bnMonth = new Intl.DateTimeFormat("bn-BD", { month: "long", timeZone: "UTC" });

/** Bangla digits with lakh grouping; paisa shown with 2 decimals only when present. */
export function bnAmount(n: number) {
  const r = Math.round(n * 100) / 100;
  return (Number.isInteger(r) ? bnNumber : bnNumber2).format(r);
}

export function bnMonthName(period: string) {
  const [y, m] = period.split("-").map(Number);
  return bnMonth.format(new Date(Date.UTC(y, m - 1, 1)));
}

export function renderSms(template: string, v: { period: string; amount: number; dueDay: number }) {
  return template
    .replaceAll("{month}", bnMonthName(v.period))
    .replaceAll("{amount}", bnAmount(v.amount))
    .replaceAll("{dueDay}", bnNumber.format(v.dueDay));
}

/** Unicode (Bangla) SMS: 70 characters in one part, 67 per part when split. */
export function smsParts(text: string) {
  const n = [...text].length;
  return n <= 70 ? 1 : Math.ceil(n / 67);
}

// ───────── Gateway (bulksmsbd.net) ─────────

const CODES: Record<number, string> = {
  202: "SMS submitted successfully",
  1001: "Invalid number",
  1002: "Sender ID not correct or disabled",
  1003: "Required fields missing",
  1005: "SMS gateway internal error",
  1006: "Balance validity not available",
  1007: "Insufficient SMS balance",
  1011: "SMS account user not found",
  1012: "Masking SMS must be sent in Bengali",
  1013: "Sender ID has no gateway for this API key",
  1014: "Sender type not found for this sender ID",
  1015: "Sender ID has no valid gateway",
  1016: "No active price for this sender ID",
  1017: "No price info for this sender ID",
  1018: "SMS account is disabled",
  1019: "Sender type price is disabled for this account",
  1020: "Parent account not found",
  1021: "Parent account has no active price",
  1031: "SMS account not verified",
  1032: "Server IP is not whitelisted with the SMS provider",
};

export interface SmsResult {
  ok: boolean;
  code: string | null;
  error: string | null;
}

async function post(body: BodyInit, contentType: string) {
  const res = await fetch(config.SMS_API_URL, {
    method: "POST",
    headers: { "Content-Type": contentType, Accept: "application/json" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* non-JSON reply */
  }
  const code = json && json.response_code != null ? Number(json.response_code) : null;
  return { httpOk: res.ok, status: res.status, code, json, text };
}

/** Send one batch through the "many" API. The provider returns one code for the whole batch. */
export async function sendMany(messages: { to: string; message: string }[]): Promise<SmsResult> {
  if (!smsConfigured()) return { ok: false, code: null, error: "SMS is not configured" };
  try {
    let r = await post(
      JSON.stringify({ api_key: config.SMS_API_KEY, senderid: config.SMS_SENDER_ID, messages }),
      "application/json",
    );
    // The docs don't say whether JSON or form encoding is expected; fall back to a form post once.
    if (r.code !== 202 && (r.code === 1003 || (!r.httpOk && r.status < 500) || r.code == null)) {
      const form = new URLSearchParams({
        api_key: config.SMS_API_KEY,
        senderid: config.SMS_SENDER_ID,
        messages: JSON.stringify(messages),
      });
      r = await post(form.toString(), "application/x-www-form-urlencoded");
    }
    if (r.code === 202) return { ok: true, code: "202", error: null };
    const error =
      (r.code != null && CODES[r.code]) ||
      (typeof r.json?.error_message === "string" && r.json.error_message) ||
      `Unexpected SMS gateway reply (HTTP ${r.status})`;
    logger.warn({ code: r.code, status: r.status, reply: r.text.slice(0, 300) }, "SMS send failed");
    return { ok: false, code: r.code != null ? String(r.code) : null, error };
  } catch (err) {
    logger.error({ err }, "SMS gateway request failed");
    return { ok: false, code: null, error: "Could not reach the SMS gateway" };
  }
}

/** Account balance from the provider, or null if it can't be read. */
export async function getBalance(): Promise<number | null> {
  if (!smsConfigured()) return null;
  try {
    const url = `${config.SMS_BALANCE_URL}?api_key=${encodeURIComponent(config.SMS_API_KEY)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    const json = (await res.json()) as Record<string, unknown>;
    const b = Number(json.balance ?? json.Balance);
    return Number.isFinite(b) ? b : null;
  } catch {
    return null;
  }
}
