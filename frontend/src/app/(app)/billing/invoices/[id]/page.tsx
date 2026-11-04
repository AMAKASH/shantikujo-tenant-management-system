import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InvoiceActions, RemoveLineButton } from "@/components/forms/invoice-actions";
import { LogoMark } from "@/components/logo";
import { PrintInvoice } from "@/components/print-invoice";
import { Alert } from "@/components/ui/alert";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { api, apiOrNull } from "@/lib/api.server";
import type { Invoice, Settings } from "@/lib/types";
import { dhakaDay, formatDate, METHOD_LABEL, ordinal, periodLabel, taka } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [inv, settings] = await Promise.all([apiOrNull<Invoice>(`/invoices/${id}`), api<Settings>("/settings")]);
  if (!inv) notFound();

  return (
    <div className="max-w-3xl print:max-w-none">
      <div className="mb-4 flex flex-col gap-3 print:hidden sm:flex-row sm:items-center sm:justify-between">
        <Link href={`/billing?period=${inv.period}`} className="text-sm font-semibold text-muted hover:text-primary">
          ← {periodLabel(inv.period, true)} invoices
        </Link>
        <InvoiceActions invoice={inv} />
      </div>

      {inv.status === "VOID" && (
        <Alert tone="error" className="mb-4 print:hidden">
          This invoice is void{inv.voidReason ? `: ${inv.voidReason}` : ""}.
        </Alert>
      )}

      <Card className="overflow-hidden print:hidden">
        <div className="flex flex-col gap-4 bg-primary px-5 py-5 text-white sm:flex-row sm:items-start sm:justify-between sm:px-7">
          <div className="flex items-center gap-3">
            <LogoMark className="h-10 w-11" inverted />
            <div>
              <p className="text-lg font-extrabold">{settings.propertyName}</p>
              {settings.propertyAddress && <p className="text-sm text-white/75">{settings.propertyAddress}</p>}
            </div>
          </div>
          <div className="sm:text-right">
            <p className="text-xs tracking-widest text-white/70 uppercase">Invoice</p>
            <p className="text-xl font-extrabold">{inv.number}</p>
          </div>
        </div>

        <div className="grid gap-4 border-b border-line px-5 py-5 sm:grid-cols-3 sm:px-7">
          <div>
            <p className="text-xs font-semibold text-muted uppercase">Billed to</p>
            <Link href={`/tenants/${inv.tenant.id}`} className="font-bold text-primary hover:underline">
              {inv.tenant.fullName}
            </Link>
            <p className="text-sm text-muted">
              Apartment {inv.apartment.number} · {inv.tenant.phone}
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted uppercase">Billing month</p>
            <p className="font-bold">{periodLabel(inv.period, true)}</p>
            <p className="text-sm text-muted">Issued {formatDate(inv.issueDate)}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-muted uppercase">Due date</p>
            <p className="font-bold">{formatDate(inv.dueDate)}</p>
            <InvoiceStatusBadge status={inv.displayStatus} />
            {inv.notifiedAt && (
              <p className="mt-1 text-xs text-muted">
                SMS sent {formatDate(dhakaDay(inv.notifiedAt))}
                {inv.notifyCount > 1 ? ` · ${inv.notifyCount} times` : ""}
              </p>
            )}
          </div>
        </div>

        <table className="w-full text-sm">
          <thead className="text-left text-xs text-muted uppercase">
            <tr className="border-b border-line">
              <th className="px-5 py-3 font-semibold sm:px-7">Description</th>
              <th className="px-5 py-3 text-right font-semibold sm:px-7">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {inv.lines.map((l) => (
              <tr key={l.id}>
                <td className="px-5 py-3 sm:px-7">{l.description}</td>
                <td className="tabular px-5 py-3 text-right font-semibold sm:px-7">
                  <span className="inline-flex items-center gap-2">
                    {taka(l.amount)}
                    {inv.status !== "VOID" && inv.status !== "PAID" && !l.meterReadingId && l.type !== "ROUNDING" && <RemoveLineButton invoiceId={inv.id} lineId={l.id} />}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line">
            <tr>
              <td className="px-5 pt-4 text-right font-semibold text-muted sm:px-7">Total</td>
              <td className="tabular px-5 pt-4 text-right text-lg font-extrabold text-primary sm:px-7">{taka(inv.total)}</td>
            </tr>
            <tr>
              <td className="px-5 pt-1 text-right font-semibold text-muted sm:px-7">Paid</td>
              <td className="tabular px-5 pt-1 text-right font-semibold text-success sm:px-7">{taka(inv.paidAmount)}</td>
            </tr>
            <tr>
              <td className="px-5 pt-1 pb-5 text-right font-semibold text-muted sm:px-7">Balance</td>
              <td className="tabular px-5 pt-1 pb-5 text-right text-lg font-extrabold sm:px-7">{taka(inv.balance)}</td>
            </tr>
          </tfoot>
        </table>

        {inv.payments.length > 0 && (
          <div className="border-t border-line px-5 py-5 sm:px-7">
            <p className="mb-2 text-xs font-semibold text-muted uppercase">Payments</p>
            <ul className="flex flex-col gap-2 text-sm">
              {inv.payments.map((p) => (
                <li key={`${p.id}`} className="flex justify-between gap-3">
                  <span>
                    {formatDate(p.date)} · {METHOD_LABEL[p.method]}
                    {p.reference ? ` · ${p.reference}` : ""}
                    <span className="ml-2 text-xs text-muted">{p.number}</span>
                  </span>
                  <span className="tabular font-semibold">{taka(p.amount)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <p className="mt-4 text-center text-xs text-muted print:hidden">Rent is due by the {ordinal(settings.dueDay)} of each month.</p>
      <PrintInvoice inv={inv} settings={settings} />
    </div>
  );
}
