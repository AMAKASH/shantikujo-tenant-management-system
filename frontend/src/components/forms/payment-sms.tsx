"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquareText, Send } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { apiFetch, errorMessage } from "@/lib/api.client";
import type { Payment, SmsSendResult, SmsStatus } from "@/lib/types";
import { formatDate, METHOD_LABEL, taka } from "@/lib/utils";
import { NotifiedBadge } from "./notify-dialog";

type Preview = { message: string; characters: number; parts: number; phone: string; validPhone: boolean };

/**
 * Preview and send the payment confirmation SMS. Nothing is sent until the user presses Send.
 * Used on the "Payment recorded" step of the payment dialog and from the Payments list.
 */
export function PaymentSmsPanel({
  payment,
  onDone,
  doneLabel = "Done",
}: {
  payment: Pick<Payment, "id" | "notifiedAt">;
  onDone: () => void;
  doneLabel?: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<SmsStatus | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sentAt, setSentAt] = useState<string | null>(payment.notifiedAt);

  useEffect(() => {
    let live = true;
    apiFetch<SmsStatus>("/sms/status")
      .then((s) => live && setStatus(s))
      .catch(() => live && setStatus({ configured: false, devOverride: false, devNumber: null, balance: null }));
    apiFetch<Preview>(`/payments/${payment.id}/notify/preview`)
      .then((p) => live && setPreview(p))
      .catch((err) => live && setLoadError(errorMessage(err)));
    return () => {
      live = false;
    };
  }, [payment.id]);

  async function send() {
    setSending(true);
    try {
      const r = await apiFetch<SmsSendResult>(`/payments/${payment.id}/notify`, { method: "POST" });
      if (r.sent) {
        toast.success(`Confirmation SMS sent${r.devOverride ? ` (test number ${r.devNumber})` : ""}`);
        setSentAt(new Date().toISOString());
        router.refresh();
        onDone();
      } else {
        toast.error(r.results[0]?.error ?? r.gatewayError ?? "SMS was not sent");
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  }

  const blocked = status != null && !status.configured;
  const badPhone = preview != null && !preview.validPhone;

  return (
    <div className="flex flex-col gap-3">
      {blocked && <Alert tone="error">SMS is not set up. Add SMS_API_KEY and SMS_SENDER_ID to the API environment.</Alert>}
      {status?.devOverride && <Alert tone="warning">Development mode: the SMS goes to {status.devNumber}, not to the tenant.</Alert>}
      {badPhone && <Alert tone="error">The tenant&apos;s phone number ({preview.phone}) is not a valid Bangladeshi mobile number.</Alert>}
      {loadError && <Alert tone="error">{loadError}</Alert>}

      <div>
        <p className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-muted">
          <span>
            Confirmation SMS{preview ? ` to ${preview.phone}` : ""}
            {sentAt && <span className="ml-2 align-middle"><NotifiedBadge at={sentAt} /></span>}
          </span>
          {preview && (
            <span>
              {preview.characters} chars · {preview.parts} part{preview.parts === 1 ? "" : "s"}
            </span>
          )}
        </p>
        <p lang="bn" className="min-h-16 rounded-xl bg-canvas px-3.5 py-3 text-sm leading-relaxed whitespace-pre-line">
          {preview?.message ?? (loadError ? "" : "Loading preview…")}
        </p>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onDone} className="flex-1">
          {doneLabel}
        </Button>
        <Button
          type="button"
          onClick={send}
          loading={sending}
          disabled={!preview || blocked || badPhone || status == null}
          className="flex-1"
        >
          <Send className="size-4" aria-hidden /> {sentAt ? "Send again" : "Send SMS"}
        </Button>
      </div>
    </div>
  );
}

/** Row action on the Payments list: opens a confirm dialog with the SMS preview. */
export function PaymentSmsButton({ payment }: { payment: Payment }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setOpen(true)}
        aria-label={payment.notifiedAt ? `Resend confirmation SMS for ${payment.number}` : `Send confirmation SMS for ${payment.number}`}
        title={payment.notifiedAt ? "Confirmation SMS sent · send again" : "Send confirmation SMS"}
        className={payment.notifiedAt ? "text-success" : "text-primary"}
      >
        <MessageSquareText className="size-5" aria-hidden />
      </Button>
      {open && (
        <Dialog open onClose={() => setOpen(false)} title="Payment confirmation SMS" description={payment.tenant.fullName}>
          <p className="mb-4 text-sm text-muted">
            <span className="tabular font-bold text-ink">{taka(payment.amount)}</span> · {payment.number} · {formatDate(payment.date)} ·{" "}
            {METHOD_LABEL[payment.method]}
          </p>
          <PaymentSmsPanel payment={payment} onDone={() => setOpen(false)} doneLabel="Cancel" />
        </Dialog>
      )}
    </>
  );
}
