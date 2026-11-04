"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch, errorMessage } from "@/lib/api.client";
import type { Invoice, NotifyResult, SmsStatus } from "@/lib/types";
import { dhakaDay, formatDate, number, periodLabel, taka } from "@/lib/utils";

/** Invoices an SMS can be sent for: open (unpaid/partial, overdue included) with something left to pay. */
const notifiable = (i: Invoice) => (i.status === "UNPAID" || i.status === "PARTIAL") && i.balance > 0;

export function NotifyTenantsButton({ invoices, period }: { invoices: Invoice[]; period: string }) {
  const [open, setOpen] = useState(false);
  const count = invoices.filter(notifiable).length;
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={count === 0} title={count === 0 ? "No open invoices this month" : undefined}>
        <MessageSquare className="size-4" aria-hidden /> Notify tenants
      </Button>
      {open && <NotifyDialog invoices={invoices.filter(notifiable)} period={period} onClose={() => setOpen(false)} />}
    </>
  );
}

function NotifyDialog({ invoices, period, onClose }: { invoices: Invoice[]; period: string; onClose: () => void }) {
  const router = useRouter();
  const [status, setStatus] = useState<SmsStatus | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(invoices.filter((i) => !i.notifiedAt).map((i) => i.id)));
  const [preview, setPreview] = useState<{ message: string; characters: number; parts: number } | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<NotifyResult | null>(null);

  useEffect(() => {
    apiFetch<SmsStatus>("/sms/status")
      .then(setStatus)
      .catch(() => setStatus({ configured: false, devOverride: false, devNumber: null, balance: null }));
  }, []);

  const firstSelected = useMemo(() => invoices.find((i) => selected.has(i.id))?.id ?? invoices[0]?.id, [invoices, selected]);
  useEffect(() => {
    if (!firstSelected) return;
    let live = true;
    apiFetch<{ message: string; characters: number; parts: number }>(`/invoices/notify/preview?invoiceId=${firstSelected}`)
      .then((p) => live && setPreview(p))
      .catch(() => live && setPreview(null));
    return () => {
      live = false;
    };
  }, [firstSelected]);

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = selected.size === invoices.length;
  const notNotified = invoices.filter((i) => !i.notifiedAt);

  async function send() {
    setSending(true);
    setResult(null);
    try {
      const r = await apiFetch<NotifyResult>("/invoices/notify", { method: "POST", json: { invoiceIds: [...selected] } });
      setResult(r);
      if (r.sent && !r.failed) toast.success(`SMS sent to ${r.sent} tenant${r.sent === 1 ? "" : "s"}${r.devOverride ? ` (test number ${r.devNumber})` : ""}`);
      else if (r.sent) toast.warning(`Sent ${r.sent}, failed ${r.failed}`);
      else toast.error(r.gatewayError ?? "No SMS was sent");
      router.refresh();
      if (r.sent && !r.failed && !r.skipped) onClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const failures = result?.results.filter((r) => r.status !== "SENT") ?? [];
  const blocked = status != null && !status.configured;

  return (
    <Dialog open onClose={onClose} title="Notify tenants by SMS" description={`${periodLabel(period, true)} bills · amount sent is the balance still due`}>
      <div className="flex flex-col gap-4">
        {blocked && <Alert tone="error">SMS is not set up. Add SMS_API_KEY and SMS_SENDER_ID to the API environment and restart it.</Alert>}
        {status?.devOverride && (
          <Alert tone="warning">Development mode: every SMS goes to {status.devNumber}, not to tenants.</Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <p className="font-semibold">
            {selected.size} of {invoices.length} selected
            {status?.balance != null && <span className="ml-2 font-normal text-muted">· SMS balance {number(status.balance)}</span>}
          </p>
          <div className="flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(allSelected ? new Set() : new Set(invoices.map((i) => i.id)))}>
              {allSelected ? "Clear" : "Select all"}
            </Button>
            {notNotified.length > 0 && notNotified.length < invoices.length && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set(notNotified.map((i) => i.id)))}>
                Not notified
              </Button>
            )}
          </div>
        </div>

        <ul className="-mx-1 flex max-h-[42dvh] flex-col overflow-y-auto rounded-xl border border-line">
          {invoices.map((i) => {
            const on = selected.has(i.id);
            const failed = failures.find((f) => f.invoiceId === i.id);
            return (
              <li key={i.id} className="border-b border-line last:border-b-0">
                <label className={`flex cursor-pointer items-center gap-3 px-3 py-3 ${on ? "bg-primary-light/50" : ""}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(i.id)} className="size-5 shrink-0 accent-primary" />
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary-light text-xs font-extrabold text-primary">{i.apartment.number}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{i.tenant.fullName}</span>
                    <span className="block truncate text-xs text-muted">{i.tenant.phone}</span>
                    {failed && <span className="block text-xs font-semibold text-danger">{failed.error}</span>}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="tabular text-sm font-bold">{taka(i.balance)}</span>
                    {i.notifiedAt && <NotifiedBadge at={i.notifiedAt} />}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {preview && (
          <div>
            <p className="mb-1.5 flex items-center justify-between text-xs font-semibold text-muted">
              <span>Message preview</span>
              <span>
                {preview.characters} characters · {preview.parts} SMS part{preview.parts === 1 ? "" : "s"} each
              </span>
            </p>
            <p lang="bn" className="rounded-xl bg-canvas px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line">
              {preview.message}
            </p>
          </div>
        )}

        <div className="sticky bottom-0 -mx-5 -mb-5 flex gap-2 border-t border-line bg-white px-5 py-3">
          <Button type="button" variant="ghost" onClick={onClose} className="flex-1 sm:flex-none">
            Cancel
          </Button>
          <Button type="button" onClick={send} loading={sending} disabled={selected.size === 0 || blocked || status == null} className="flex-1">
            <MessageSquareText className="size-4" aria-hidden /> Notify {selected.size || ""} tenant{selected.size === 1 ? "" : "s"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

export function NotifiedBadge({ at }: { at: string }) {
  return (
    <span title={`SMS sent ${formatDate(dhakaDay(at))}`}>
      <Badge tone="neutral">
        <MessageSquareText className="size-3" aria-hidden /> Notified
      </Badge>
    </span>
  );
}
