"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { apiFetch, errorMessage } from "@/lib/api.client";
import type { Invoice, Payment, TenantListItem } from "@/lib/types";
import { METHOD_LABEL, periodLabel, taka, todayISO } from "@/lib/utils";

export interface PaymentTarget {
  tenantId?: string;
  tenantName?: string;
  invoiceId?: string;
  amount?: number;
}

/**
 * Record a payment. With a tenant, it lists their open invoices; the payment is applied to the
 * selected invoice first, then other open invoices (oldest first), and any remainder is kept as credit.
 */
export function PaymentDialog({ open, onClose, target }: { open: boolean; onClose: () => void; target: PaymentTarget }) {
  const router = useRouter();
  const [tenants, setTenants] = useState<TenantListItem[] | null>(null);
  const [tenantId, setTenantId] = useState(target.tenantId ?? "");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoiceId, setInvoiceId] = useState(target.invoiceId ?? "");
  const [amount, setAmount] = useState(target.amount ? String(target.amount) : "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTenantId(target.tenantId ?? "");
    setInvoiceId(target.invoiceId ?? "");
    setAmount(target.amount ? String(target.amount) : "");
    if (!target.tenantId) {
      apiFetch<{ items: TenantListItem[] }>("/tenants?status=all").then((r) => setTenants(r.items.filter((t) => !t.archivedAt)));
    }
  }, [open, target.tenantId, target.invoiceId, target.amount]);

  useEffect(() => {
    if (!open || !tenantId) return setInvoices([]);
    apiFetch<{ items: Invoice[] }>(`/invoices?tenantId=${tenantId}&status=OPEN`).then((r) => {
      setInvoices(r.items);
      if (!target.amount && !amount) {
        const due = r.items.reduce((a, i) => a + i.balance, 0);
        if (due > 0) setAmount(String(Math.round(due * 100) / 100));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantId]);

  const totalDue = invoices.reduce((a, i) => a + i.balance, 0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    try {
      const p = await apiFetch<Payment>("/payments", {
        method: "POST",
        json: {
          tenantId,
          amount: Number(amount),
          date: f.get("date"),
          method: f.get("method"),
          reference: f.get("reference") || null,
          note: f.get("note") || null,
          invoiceIds: invoiceId ? [invoiceId] : undefined,
        },
      });
      toast.success(`Payment ${p.number} recorded`, {
        description: p.unallocated > 0 ? `${taka(p.unallocated)} kept as advance credit` : undefined,
      });
      onClose();
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Record payment" description={target.tenantName}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {!target.tenantId && (
          <Field label="Tenant" htmlFor="pay-tenant" required>
            <Select id="pay-tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required>
              <option value="">{tenants ? "Select a tenant" : "Loading…"}</option>
              {tenants?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName}
                  {t.apartment ? ` · ${t.apartment.number}` : ""}
                  {t.due > 0 ? ` · due ${taka(t.due)}` : ""}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {tenantId && (
          <div className="rounded-xl bg-primary-light px-4 py-3 text-sm">
            {invoices.length === 0 ? (
              <p className="text-primary">No open invoices. This payment will be kept as advance credit.</p>
            ) : (
              <p className="text-primary">
                <span className="font-bold">{taka(totalDue)}</span> due across {invoices.length} invoice
                {invoices.length > 1 ? "s" : ""}
              </p>
            )}
          </div>
        )}

        {invoices.length > 1 && (
          <Field label="Apply to" htmlFor="pay-invoice" hint="Anything left over goes to the oldest open invoices, then advance credit.">
            <Select id="pay-invoice" value={invoiceId} onChange={(e) => setInvoiceId(e.target.value)}>
              <option value="">Oldest invoices first</option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {periodLabel(i.period, true)} · {i.number} · {taka(i.balance)}
                </option>
              ))}
            </Select>
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="Amount" htmlFor="pay-amount" required className="col-span-2 sm:col-span-1">
            <Input
              id="pay-amount"
              prefix="৳"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </Field>
          <Field label="Date" htmlFor="pay-date" required className="col-span-2 sm:col-span-1">
            <Input id="pay-date" name="date" type="date" defaultValue={todayISO()} max={todayISO()} required />
          </Field>
          <Field label="Method" htmlFor="pay-method" required>
            <Select id="pay-method" name="method" defaultValue="CASH">
              {Object.entries(METHOD_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Reference / TrxID" htmlFor="pay-ref">
            <Input id="pay-ref" name="reference" placeholder="Optional" />
          </Field>
        </div>
        <Field label="Note" htmlFor="pay-note">
          <Textarea id="pay-note" name="note" rows={2} placeholder="Optional" className="min-h-0" />
        </Field>
        <Button type="submit" size="lg" loading={saving} disabled={!tenantId || !amount}>
          Save payment
        </Button>
      </form>
    </Dialog>
  );
}

/** A button that opens the payment dialog. */
export function RecordPaymentButton({
  target = {},
  children = "Record payment",
  variant = "primary",
  size = "md",
  className,
}: {
  target?: PaymentTarget;
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} onClick={() => setOpen(true)} className={className}>
        {children}
      </Button>
      <PaymentDialog open={open} onClose={() => setOpen(false)} target={target} />
    </>
  );
}
