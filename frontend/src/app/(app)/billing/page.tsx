import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Receipt } from "lucide-react";
import { GenerateInvoicesButton } from "@/components/forms/generate-invoices";
import { NotifiedBadge, NotifyTenantsButton } from "@/components/forms/notify-dialog";
import { RecordPaymentButton } from "@/components/forms/payment-dialog";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { MonthPicker } from "@/components/ui/month-picker";
import { FilterTabs } from "@/components/ui/tabs";
import { api } from "@/lib/api.server";
import type { Invoice } from "@/lib/types";
import { currentPeriod, formatDate, PERIOD_RE, taka } from "@/lib/utils";

export const metadata: Metadata = { title: "Invoices" };

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ period?: string; status?: string }> }) {
  const sp = await searchParams;
  const period = sp.period && PERIOD_RE.test(sp.period) ? sp.period : currentPeriod();
  const status = sp.status ?? "ALL";
  const { items, totals } = await api<{ items: Invoice[]; totals: { total: number; paid: number; balance: number } }>(`/invoices?period=${period}`);
  const shown = status === "ALL" ? items : items.filter((i) => i.displayStatus === status);
  const n = (s: string) => items.filter((i) => i.displayStatus === s).length;
  const link = (p: string, s = status) => `/billing?period=${p}${s !== "ALL" ? `&status=${s}` : ""}`;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MonthPicker period={period} href={(p) => link(p)} />
        <div className="flex flex-wrap gap-2">
          <GenerateInvoicesButton period={period} />
          <NotifyTenantsButton invoices={items} period={period} />
          <RecordPaymentButton />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <Total label="Billed" value={totals.total} />
        <Total label="Collected" value={totals.paid} className="text-success" />
        <Total label="Outstanding" value={totals.balance} className={totals.balance > 0 ? "text-danger" : "text-muted"} />
      </div>

      <div className="mt-4">
        <FilterTabs
          active={status}
          items={[
            { value: "ALL", label: "All", href: link(period, "ALL"), count: items.length },
            { value: "OVERDUE", label: "Overdue", href: link(period, "OVERDUE"), count: n("OVERDUE") },
            { value: "UNPAID", label: "Unpaid", href: link(period, "UNPAID"), count: n("UNPAID") },
            { value: "PARTIAL", label: "Partial", href: link(period, "PARTIAL"), count: n("PARTIAL") },
            { value: "PAID", label: "Paid", href: link(period, "PAID"), count: n("PAID") },
          ]}
        />
      </div>

      <Card className="mt-4 overflow-hidden">
        {shown.length === 0 ? (
          <EmptyState icon={Receipt} title={items.length ? "Nothing in this filter" : "No invoices for this month"}>
            {items.length ? "Try another status." : "Generate this month's invoices to bill every active lease."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((i) => (
              <li key={i.id}>
                <Link href={`/billing/invoices/${i.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-primary-light/40 sm:px-5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-light text-sm font-extrabold text-primary">
                    {i.apartment.number}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{i.tenant.fullName}</p>
                    <p className="truncate text-xs text-muted">
                      {i.number} · due {formatDate(i.dueDate)}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="tabular font-bold">{taka(i.total)}</p>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                      {i.notifiedAt && <NotifiedBadge at={i.notifiedAt} />}
                      {i.balance > 0 && i.status !== "VOID" && i.status !== "UNPAID" && (
                        <span className="tabular hidden text-xs text-muted sm:inline">{taka(i.balance)} left</span>
                      )}
                      <InvoiceStatusBadge status={i.displayStatus} />
                    </div>
                  </div>
                  <ChevronRight className="size-4 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function Total({ label, value, className = "text-primary" }: { label: string; value: number; className?: string }) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
      <p className={`tabular mt-0.5 text-base font-extrabold sm:text-xl ${className}`}>{taka(value, { decimals: false })}</p>
    </Card>
  );
}
