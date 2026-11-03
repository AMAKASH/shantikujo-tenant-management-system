import type { Metadata } from "next";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { DeletePaymentButton } from "@/components/forms/delete-payment";
import { RecordPaymentButton } from "@/components/forms/payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { MonthPicker } from "@/components/ui/month-picker";
import { api } from "@/lib/api.server";
import type { Payment } from "@/lib/types";
import { currentPeriod, formatDate, METHOD_LABEL, PERIOD_RE, periodLabel, taka } from "@/lib/utils";

export const metadata: Metadata = { title: "Payments" };

function monthRange(period: string) {
  const [y, m] = period.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${period}-01`, to: `${period}-${String(last).padStart(2, "0")}` };
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = sp.period && PERIOD_RE.test(sp.period) ? sp.period : currentPeriod();
  const { from, to } = monthRange(period);
  const { items, total } = await api<{ items: Payment[]; total: number }>(`/payments?from=${from}&to=${to}`);

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MonthPicker period={period} href={(p) => `/billing/payments?period=${p}`} />
        <RecordPaymentButton />
      </div>
      <Card className="mt-4 flex items-center justify-between p-4">
        <span className="text-sm font-medium text-muted">Received in {periodLabel(period, true)}</span>
        <span className="tabular text-xl font-extrabold text-success">{taka(total)}</span>
      </Card>

      <Card className="mt-4 overflow-hidden">
        {items.length === 0 ? (
          <EmptyState icon={Wallet} title="No payments this month" />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <div className="min-w-0 flex-1">
                  <Link href={`/tenants/${p.tenant.id}`} className="block truncate font-semibold hover:text-accent">
                    {p.tenant.fullName}
                  </Link>
                  <p className="truncate text-xs text-muted">
                    {formatDate(p.date)} · {p.number} · {METHOD_LABEL[p.method]}
                    {p.reference ? ` · ${p.reference}` : ""}
                  </p>
                  {p.allocations.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-muted">
                      For {p.allocations.map((a) => periodLabel(a.invoice.period)).join(", ")}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="tabular font-bold">{taka(p.amount)}</p>
                  {p.unallocated > 0 && <Badge tone="info">{taka(p.unallocated)} credit</Badge>}
                </div>
                <DeletePaymentButton id={p.id} number={p.number} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
