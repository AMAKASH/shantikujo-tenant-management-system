"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Send, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, SearchInput, Select, Textarea } from "@/components/ui/field";
import { CUSTOM_SMS_VARIABLES, SmsTemplateEditor } from "@/components/ui/sms-template-editor";
import { apiFetch, errorMessage } from "@/lib/api.client";
import type { SmsPreview, SmsSendResult, SmsStatus, TenantListItem } from "@/lib/types";
import { cn, number, taka } from "@/lib/utils";

/** Same rule as backend normalizeBdPhone: a Bangladeshi mobile, with or without +88. */
function normalizeBdPhone(raw: string) {
  let d = raw.replace(/[^\d]/g, "");
  if (d.startsWith("880")) d = d.slice(2);
  else if (d.startsWith("88")) d = d.slice(2);
  return /^01[3-9]\d{8}$/.test(d) ? d : null;
}

const splitNumbers = (text: string) =>
  text
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

type Mode = "single" | "multiple";

export function SmsComposer({ tenants }: { tenants: TenantListItem[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<SmsStatus | null>(null);
  const [mode, setMode] = useState<Mode>("single");
  // Single person
  const [singleKind, setSingleKind] = useState<"tenant" | "number">("tenant");
  const [singleTenant, setSingleTenant] = useState("");
  const [singleNumber, setSingleNumber] = useState("");
  // Multiple people
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [extraText, setExtraText] = useState("");
  // Message
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<SmsPreview | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SmsSendResult | null>(null);

  useEffect(() => {
    apiFetch<SmsStatus>("/sms/status")
      .then(setStatus)
      .catch(() => setStatus({ configured: false, devOverride: false, devNumber: null, balance: null }));
  }, []);

  const extra = useMemo(() => {
    const items = splitNumbers(extraText);
    return { valid: items.filter((n) => normalizeBdPhone(n)), invalid: items.filter((n) => !normalizeBdPhone(n)) };
  }, [extraText]);

  const recipients = useMemo(() => {
    if (mode === "single") {
      if (singleKind === "tenant") return { tenantIds: singleTenant ? [singleTenant] : [], numbers: [] as string[] };
      return { tenantIds: [] as string[], numbers: normalizeBdPhone(singleNumber) ? [singleNumber.trim()] : [] };
    }
    return { tenantIds: tenants.filter((t) => selected.has(t.id)).map((t) => t.id), numbers: extra.valid };
  }, [mode, singleKind, singleTenant, singleNumber, tenants, selected, extra.valid]);
  const count = recipients.tenantIds.length + recipients.numbers.length;

  // Preview as the first recipient will get it (debounced).
  const sampleTenant = recipients.tenantIds[0] ?? null;
  useEffect(() => {
    if (!message.trim()) return setPreview(null);
    let live = true;
    const t = setTimeout(() => {
      apiFetch<SmsPreview>("/sms/preview", { method: "POST", json: { message, tenantId: sampleTenant } })
        .then((p) => live && setPreview(p))
        .catch(() => live && setPreview(null));
    }, 400);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [message, sampleTenant]);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter((t) => t.fullName.toLowerCase().includes(q) || t.phone.includes(q) || t.apartment?.number.toLowerCase().includes(q));
  }, [tenants, filter]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const withDues = tenants.filter((t) => t.due > 0);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const r = await apiFetch<SmsSendResult>("/sms/send", { method: "POST", json: { message, ...recipients } });
      setResult(r);
      setConfirming(false);
      const dev = r.devOverride ? ` (test number ${r.devNumber})` : "";
      if (r.sent && !r.failed) toast.success(`SMS sent to ${r.sent} recipient${r.sent === 1 ? "" : "s"}${dev}`);
      else if (r.sent) toast.warning(`Sent ${r.sent}, failed ${r.failed}${dev}`);
      else toast.error(r.gatewayError ?? r.results[0]?.error ?? "No SMS was sent");
      if (r.sent && !r.failed) {
        setMessage("");
        setSelected(new Set());
        setExtraText("");
        setSingleNumber("");
      }
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const blocked = status != null && !status.configured;
  const parts = preview?.parts ?? 1;
  const problems = (result?.results ?? []).filter((r) => r.status !== "SENT");

  return (
    <Card>
      <CardHeader title="New message" description="Type an SMS and send it to one person or many. Tenant variables are filled in for each tenant." />
      <CardBody className="flex flex-col gap-5">
        {blocked && <Alert tone="error">SMS is not set up. Add SMS_API_KEY and SMS_SENDER_ID to the API environment and restart it.</Alert>}
        {status?.devOverride && <Alert tone="warning">Development mode: every SMS goes to {status.devNumber}, not to the people you pick.</Alert>}

        {/* Mode */}
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-canvas p-1" role="tablist" aria-label="Recipients">
          {(
            [
              ["single", "Single person", User],
              ["multiple", "Multiple people", Users],
            ] as const
          ).map(([m, label, Icon]) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors",
                mode === m ? "bg-white text-primary shadow-sm" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="size-4" aria-hidden /> {label}
            </button>
          ))}
        </div>

        {mode === "single" ? (
          <div className="flex flex-col gap-3">
            <div className="flex gap-4 text-sm font-medium">
              {(
                [
                  ["tenant", "A tenant"],
                  ["number", "Another number"],
                ] as const
              ).map(([k, label]) => (
                <label key={k} className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="single-kind" checked={singleKind === k} onChange={() => setSingleKind(k)} className="size-5 accent-primary" />
                  {label}
                </label>
              ))}
            </div>
            {singleKind === "tenant" ? (
              <Field label="Tenant" htmlFor="sms-tenant">
                <Select id="sms-tenant" value={singleTenant} onChange={(e) => setSingleTenant(e.target.value)}>
                  <option value="">Select a tenant</option>
                  {tenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.apartment ? `${t.apartment.number} · ` : ""}
                      {t.fullName} · {t.phone}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field
                label="Mobile number"
                htmlFor="sms-number"
                hint="Bangladeshi mobile, e.g. 01712345678"
                error={singleNumber.trim() && !normalizeBdPhone(singleNumber) ? "Not a valid Bangladeshi mobile number" : undefined}
              >
                <Input id="sms-number" type="tel" inputMode="tel" value={singleNumber} onChange={(e) => setSingleNumber(e.target.value)} placeholder="01XXXXXXXXX" />
              </Field>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                {selected.size} of {tenants.length} tenants selected
              </p>
              <div className="flex flex-wrap gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set(tenants.map((t) => t.id)))}>
                  All
                </Button>
                {withDues.length > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set(withDues.map((t) => t.id)))}>
                    With dues ({withDues.length})
                  </Button>
                )}
                {selected.size > 0 && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <SearchInput value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name, apartment or phone" aria-label="Filter tenants" />
            <ul className="flex max-h-[40dvh] flex-col overflow-y-auto rounded-xl border border-line">
              {visible.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">No tenants match</li>}
              {visible.map((t) => {
                const on = selected.has(t.id);
                return (
                  <li key={t.id} className="border-b border-line last:border-b-0">
                    <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-2.5", on && "bg-primary-light/50")}>
                      <input type="checkbox" checked={on} onChange={() => toggle(t.id)} className="size-5 shrink-0 accent-primary" />
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-light text-xs font-extrabold text-primary">
                        {t.apartment?.number ?? "—"}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{t.fullName}</span>
                        <span className="block truncate text-xs text-muted">{t.phone}</span>
                      </span>
                      {t.due > 0 && <span className="tabular shrink-0 text-xs font-bold text-danger">{taka(t.due)}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
            <Field label="Other numbers" htmlFor="sms-extra" hint="Optional. Separate with commas, spaces or new lines. Variables are left out for these.">
              <Textarea id="sms-extra" rows={2} value={extraText} onChange={(e) => setExtraText(e.target.value)} placeholder="01712345678, 01812345678" className="min-h-0" />
            </Field>
            {(extra.valid.length > 0 || extra.invalid.length > 0) && (
              <div className="flex flex-wrap gap-1.5">
                {extra.valid.map((n, i) => (
                  <Badge key={`v${i}`} tone="success">
                    {n}
                  </Badge>
                ))}
                {extra.invalid.map((n, i) => (
                  <Badge key={`x${i}`} tone="danger">
                    {n} · invalid
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Message */}
        <div>
          <p className="mb-2 text-sm font-semibold">Message</p>
          <SmsTemplateEditor
            id="sms-message"
            value={message}
            onChange={setMessage}
            variables={CUSTOM_SMS_VARIABLES}
            rows={6}
            placeholder="Type your message (Bangla or English)…"
            countNote="typed"
          />
        </div>

        {preview && (
          <div>
            <p className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-muted">
              <span>
                Preview
                {sampleTenant ? ` for ${tenants.find((t) => t.id === sampleTenant)?.fullName ?? "first tenant"}` : ""}
              </span>
              <span>
                {preview.characters} characters · {preview.parts} SMS part{preview.parts === 1 ? "" : "s"}
              </span>
            </p>
            <p lang="bn" className="rounded-xl bg-canvas px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line">
              {preview.message}
            </p>
          </div>
        )}

        {problems.length > 0 && (
          <Alert tone="error">
            <span className="block font-semibold">Not delivered:</span>
            <ul className="mt-1 list-inside list-disc font-normal">
              {problems.map((p, i) => (
                <li key={i}>
                  {p.name ?? p.phone}: {p.error}
                </li>
              ))}
            </ul>
          </Alert>
        )}

        <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            {count} recipient{count === 1 ? "" : "s"} · about {number(count * parts)} SMS part{count * parts === 1 ? "" : "s"}
            {status?.balance != null && <> · balance {number(status.balance)}</>}
          </p>
          <Button type="button" onClick={() => setConfirming(true)} disabled={count === 0 || !message.trim() || blocked || status == null}>
            <Send className="size-4" aria-hidden /> Send SMS
          </Button>
        </div>
      </CardBody>

      {confirming && (
        <Dialog open onClose={() => setConfirming(false)} title="Send this SMS?" description={`${count} recipient${count === 1 ? "" : "s"} · about ${count * parts} SMS parts`}>
          <div className="flex flex-col gap-4">
            {status?.devOverride && <Alert tone="warning">Development mode: it goes to {status.devNumber} only.</Alert>}
            <p lang="bn" className="max-h-60 overflow-y-auto rounded-xl bg-canvas px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line">
              {preview?.message ?? message}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setConfirming(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="button" onClick={send} loading={sending} className="flex-1">
                <Send className="size-4" aria-hidden /> Send {count}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </Card>
  );
}
