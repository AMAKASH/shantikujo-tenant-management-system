"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Plus, Printer, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { apiFetch, errorMessage } from "@/lib/api.client";
import type { Invoice } from "@/lib/types";
import { LINE_LABEL } from "@/lib/utils";
import { RecordPaymentButton } from "./payment-dialog";

export function InvoiceActions({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [mode, setMode] = useState<"line" | "void" | null>(null);
  const [saving, setSaving] = useState(false);
  const isVoid = invoice.status === "VOID";

  async function submit(path: string, json: unknown, msg: string) {
    setSaving(true);
    try {
      await apiFetch(path, { method: "POST", json });
      toast.success(msg);
      setMode(null);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      {!isVoid && invoice.balance > 0 && (
        <RecordPaymentButton target={{ tenantId: invoice.tenant.id, tenantName: invoice.tenant.fullName, invoiceId: invoice.id, amount: invoice.balance }} />
      )}
      {!isVoid && (
        <Button variant="outline" onClick={() => setMode("line")}>
          <Plus className="size-4" aria-hidden /> Add charge
        </Button>
      )}
      <Button variant="ghost" onClick={() => window.print()}>
        <Printer className="size-4" aria-hidden /> Print
      </Button>
      {!isVoid && (
        <Button variant="ghost" className="text-danger" onClick={() => setMode("void")}>
          <Ban className="size-4" aria-hidden /> Void
        </Button>
      )}

      <Dialog open={mode === "line"} onClose={() => setMode(null)} title="Add charge" description="Electricity is added from Meter readings.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            submit(`/invoices/${invoice.id}/lines`, { type: f.get("type"), description: f.get("description"), amount: Number(f.get("amount")) }, "Charge added");
          }}
        >
          <Field label="Type" htmlFor="type">
            <Select id="type" name="type" defaultValue="OTHER">
              {(["WATER", "GAS", "OTHER", "DISCOUNT", "RENT", "SERVICE_CHARGE"] as const).map((t) => (
                <option key={t} value={t}>
                  {LINE_LABEL[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Description" htmlFor="description" required>
            <Input id="description" name="description" required placeholder="e.g. Water bill, plumbing repair" />
          </Field>
          <Field label="Amount" htmlFor="amount" required hint="Discounts are subtracted automatically">
            <Input id="amount" name="amount" prefix="৳" type="number" inputMode="decimal" step="0.01" min="0.01" required />
          </Field>
          <Button type="submit" size="lg" loading={saving}>
            Add to invoice
          </Button>
        </form>
      </Dialog>

      <Dialog open={mode === "void"} onClose={() => setMode(null)} title="Void invoice" description="Payments on it become advance credit and are re-applied to other open bills.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(`/invoices/${invoice.id}/void`, { reason: new FormData(e.currentTarget).get("reason") }, "Invoice voided");
          }}
        >
          <Field label="Reason" htmlFor="reason" required>
            <Input id="reason" name="reason" required minLength={3} placeholder="e.g. Created by mistake" />
          </Field>
          <Button type="submit" variant="danger" size="lg" loading={saving}>
            Void invoice
          </Button>
        </form>
      </Dialog>
    </div>
  );
}

export function RemoveLineButton({ invoiceId, lineId }: { invoiceId: string; lineId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm("Remove this charge?")) return;
        setBusy(true);
        try {
          await apiFetch(`/invoices/${invoiceId}/lines/${lineId}`, { method: "DELETE" });
          toast.success("Charge removed");
          router.refresh();
        } catch (e) {
          toast.error(errorMessage(e));
        } finally {
          setBusy(false);
        }
      }}
      className="rounded-md p-1 text-muted hover:bg-danger-bg hover:text-danger print:hidden"
      aria-label="Remove charge"
    >
      <X className="size-4" />
    </button>
  );
}
