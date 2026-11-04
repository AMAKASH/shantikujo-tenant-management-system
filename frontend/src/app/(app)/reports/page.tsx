import type { Metadata } from "next";
import Link from "next/link";
import { IncomeTrendChart } from "@/components/charts/income-trend";
import { RecordPaymentButton } from "@/components/forms/payment-dialog";
import { InvoiceStatusBadge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { CsvButton } from "@/components/ui/csv-button";
import { PageHeader, StatTile } from "@/components/ui/misc";
import { MonthPicker } from "@/components/ui/month-picker";
import { FilterTabs } from "@/components/ui/tabs";
import { api } from "@/lib/api.server";
import type { DuesRow, InvoiceStatus, PaymentMethod, TrendPoint, TypeRow } from "@/lib/types";
import { currentPeriod, LINE_LABEL, METHOD_LABEL, PERIOD_RE, periodLabel, taka } from "@/lib/utils";
import { AlertTriangle, Percent, Receipt, Wallet } from "lucide-react";

export const metadata: Metadata = { title: "Reports" };

interface Monthly {
  period: string;
  summary: { expected: number; settled: number; outstanding: number; received: number; collectionRate: number };
  byType: TypeRow[];
  byMethod: { method: PaymentMethod; amount: number; count: number }[];
  rows: {
    invoiceId: string;
    number: string;
    apartment: { id: string; number: string };
    tenant: { id: string; fullName: string };
    rent: number;
    serviceCharge: number;
    electricity: number;
    other: number;
    total: number;
    paid: number;
    balance: number;
    status: InvoiceStatus | "OVERDUE";
  }[];
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ tab?: string; period?: string; year?: string }> }) {
  const sp = await searchParams;
  const tab = sp.tab ?? "monthly";
  const period = sp.period && PERIOD_RE.test(sp.period) ? sp.period : currentPeriod();
  const year = Number(sp.year) || Number(currentPeriod().slice(0, 4));

  return (
    <>
      <PageHeader title="Reports" description="Income, dues and collection performance" />
      <FilterTabs
        active={tab}
        items={[
          { value: "monthly", label: "Monthly income", href: `/reports?tab=monthly&period=${period}` },
          { value: "dues", label: "Dues by tenant", href: "/reports?tab=dues" },
          { value: "yearly", label: "Yearly summary", href: `/reports?tab=yearly&year=${year}` },
        ]}
      />
      <div className="mt-5">
        {tab === "dues" ? <DuesReport /> : tab === "yearly" ? <YearlyReport year={year} /> : <MonthlyReport period={period} />}
      </div>
    </>
  );
}

async function MonthlyReport({ period }: { period: string }) {
  const r = await api<Monthly>(`/reports/monthly?period=${period}`);
  const s = r.summary;
  return (
    <div className="flex flex-col gap-4">
      <MonthPicker period={period} href={(p) => `/reports?tab=monthly&period=${p}`} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Billed" value={taka(s.expected, { decimals: false })} icon={Receipt} />
        <StatTile label="Settled" value={taka(s.settled, { decimals: false })} icon={Wallet} tone="success" />
        <StatTile label="Outstanding" value={taka(s.outstanding, { decimals: false })} icon={AlertTriangle} tone={s.outstanding > 0 ? "danger" : "primary"} />
        <StatTile label="Collection rate" value={`${Math.round(s.collectionRate * 100)}%`} sub={`${taka(s.received, { decimals: false })} cash received in month`} icon={Percent} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="By charge type" />
          <CardBody>
            <ul className="divide-y divide-line text-sm sm:hidden">
              {r.byType.map((t) => (
                <li key={t.type} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="font-semibold">{LINE_LABEL[t.type]}</p>
                    <p className="text-xs text-muted">
                      Settled <span className="tabular text-success">{taka(t.paid)}</span> · Due <span className="tabular">{taka(t.due)}</span>
                    </p>
                  </div>
                  <span className="tabular shrink-0 font-bold">{taka(t.billed)}</span>
                </li>
              ))}
            </ul>
            <table className="hidden w-full text-sm sm:table">
              <thead className="text-left text-xs text-muted uppercase">
                <tr>
                  <th className="pb-2 font-semibold">Type</th>
                  <th className="pb-2 text-right font-semibold">Billed</th>
                  <th className="pb-2 text-right font-semibold">Settled</th>
                  <th className="pb-2 text-right font-semibold">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {r.byType.map((t) => (
                  <tr key={t.type}>
                    <td className="py-2 font-semibold">{LINE_LABEL[t.type]}</td>
                    <td className="tabular py-2 text-right">{taka(t.billed)}</td>
                    <td className="tabular py-2 text-right text-success">{taka(t.paid)}</td>
                    <td className="tabular py-2 text-right">{taka(t.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Cash received by method" description={periodLabel(period, true)} />
          <CardBody>
            {r.byMethod.length === 0 ? (
              <p className="text-sm text-muted">No payments received.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {r.byMethod.map((m) => (
                  <li key={m.method} className="flex justify-between">
                    <span>
                      {METHOD_LABEL[m.method]} <span className="text-muted">· {m.count}</span>
                    </span>
                    <span className="tabular font-semibold">{taka(m.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title="By apartment"
          action={
            <CsvButton
              filename={`stms-income-${period}.csv`}
              header={["Invoice", "Apartment", "Tenant", "Rent", "Service charge", "Electricity", "Other", "Total", "Paid", "Balance", "Status"]}
              rows={r.rows.map((x) => [x.number, x.apartment.number, x.tenant.fullName, x.rent, x.serviceCharge, x.electricity, x.other, x.total, x.paid, x.balance, x.status])}
            />
          }
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-canvas text-left text-xs text-muted uppercase">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Apt</th>
                <th className="px-3 py-2.5 font-semibold">Tenant</th>
                <th className="px-3 py-2.5 text-right font-semibold">Rent</th>
                <th className="px-3 py-2.5 text-right font-semibold">Service</th>
                <th className="px-3 py-2.5 text-right font-semibold">Electricity</th>
                <th className="px-3 py-2.5 text-right font-semibold">Other</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                <th className="px-3 py-2.5 text-right font-semibold">Paid</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.rows.map((x) => (
                <tr key={x.invoiceId}>
                  <td className="px-5 py-2.5 font-bold">{x.apartment.number}</td>
                  <td className="px-3 py-2.5">
                    <Link href={`/billing/invoices/${x.invoiceId}`} className="hover:text-accent">{x.tenant.fullName}</Link>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{taka(x.rent)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{taka(x.serviceCharge)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{taka(x.electricity)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{taka(x.other)}</td>
                  <td className="tabular px-3 py-2.5 text-right font-semibold">{taka(x.total)}</td>
                  <td className="tabular px-3 py-2.5 text-right text-success">{taka(x.paid)}</td>
                  <td className="px-5 py-2.5"><InvoiceStatusBadge status={x.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

async function DuesReport() {
  const { items, totals } = await api<{ items: DuesRow[]; totals: Record<string, number> }>("/reports/dues");
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatTile label="Total outstanding" value={taka(totals.total, { decimals: false })} icon={AlertTriangle} tone="danger" />
        <StatTile label="Overdue" value={taka(totals.overdue, { decimals: false })} sub="Past the due date" icon={AlertTriangle} tone="warning" />
        <StatTile label="Rent & service due" value={taka(totals.rent + totals.service, { decimals: false })} icon={Receipt} />
        <StatTile label="Electricity due" value={taka(totals.electricity, { decimals: false })} icon={Receipt} />
      </div>
      <Card className="overflow-hidden">
        <CardHeader
          title={`${items.length} tenant${items.length === 1 ? "" : "s"} with dues`}
          description="Aging is counted from each bill's due date"
          action={
            <CsvButton
              filename="stms-dues.csv"
              header={["Tenant", "Phone", "Apartment", "Since", "Rent", "Service", "Electricity", "Other", "Total", "Not yet due", "1-30 days", "31-60 days", "61-90 days", "90+ days"]}
              rows={items.map((d) => [d.fullName, d.phone, d.apartment, d.oldestPeriod, d.rent, d.service, d.electricity, d.other, d.total, d.current, d.d30, d.d60, d.d90, d.d90plus])}
            />
          }
        />
        <ul className="mt-3 divide-y divide-line border-t border-line md:hidden">
          {items.map((d) => {
            const parts = [
              ["Rent", d.rent],
              ["Service", d.service],
              ["Electricity", d.electricity],
              ["Other", d.other],
            ].filter(([, v]) => Number(v) > 0) as [string, number][];
            const aging = [
              ["1–30d", d.d30],
              ["31–60d", d.d60],
              ["60d+", d.d90 + d.d90plus],
            ].filter(([, v]) => Number(v) > 0) as [string, number][];
            return (
              <li key={d.tenantId} className="flex flex-col gap-2 px-4 py-3.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/tenants/${d.tenantId}`} className="font-semibold hover:text-accent">{d.fullName}</Link>
                    <p className="text-xs text-muted">
                      {d.apartment ? `Apt ${d.apartment} · ` : ""}since {periodLabel(d.oldestPeriod)}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-base font-bold">{taka(d.total)}</span>
                </div>
                <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
                  {parts.map(([k, v]) => (
                    <span key={k}>
                      {k} <span className="tabular font-semibold text-ink">{taka(v)}</span>
                    </span>
                  ))}
                </p>
                <div className="flex items-center justify-between gap-3">
                  <p className="flex flex-wrap gap-x-3 text-xs">
                    {aging.length ? (
                      aging.map(([k, v]) => (
                        <span key={k} className={k === "60d+" ? "font-semibold text-danger" : "text-warning"}>
                          {k} overdue <span className="tabular">{taka(v)}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-muted">Not yet overdue</span>
                    )}
                  </p>
                  <RecordPaymentButton target={{ tenantId: d.tenantId, tenantName: d.fullName }} variant="outline" size="sm">
                    Pay
                  </RecordPaymentButton>
                </div>
              </li>
            );
          })}
          {items.length === 0 && <li className="px-5 py-8 text-center text-sm text-muted">No outstanding dues.</li>}
        </ul>
        <div className="mt-3 hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="bg-canvas text-left text-xs text-muted uppercase">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Tenant</th>
                <th className="px-3 py-2.5 text-right font-semibold">Rent</th>
                <th className="px-3 py-2.5 text-right font-semibold">Service</th>
                <th className="px-3 py-2.5 text-right font-semibold">Electricity</th>
                <th className="px-3 py-2.5 text-right font-semibold">Other</th>
                <th className="px-3 py-2.5 text-right font-semibold">Total</th>
                <th className="px-3 py-2.5 text-right font-semibold">1–30d</th>
                <th className="px-3 py-2.5 text-right font-semibold">31–60d</th>
                <th className="px-3 py-2.5 text-right font-semibold">60d+</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((d) => (
                <tr key={d.tenantId}>
                  <td className="px-5 py-2.5">
                    <Link href={`/tenants/${d.tenantId}`} className="font-semibold hover:text-accent">{d.fullName}</Link>
                    <p className="text-xs text-muted">
                      {d.apartment ? `Apt ${d.apartment} · ` : ""}since {periodLabel(d.oldestPeriod)}
                    </p>
                  </td>
                  <td className="tabular px-3 py-2.5 text-right">{taka(d.rent)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{taka(d.service)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{taka(d.electricity)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{taka(d.other)}</td>
                  <td className="tabular px-3 py-2.5 text-right font-bold">{taka(d.total)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{d.d30 ? taka(d.d30) : "—"}</td>
                  <td className="tabular px-3 py-2.5 text-right">{d.d60 ? taka(d.d60) : "—"}</td>
                  <td className="tabular px-3 py-2.5 text-right font-semibold text-danger">{d.d90 + d.d90plus ? taka(d.d90 + d.d90plus) : "—"}</td>
                  <td className="px-5 py-2.5 text-right">
                    <RecordPaymentButton target={{ tenantId: d.tenantId, tenantName: d.fullName }} variant="outline" size="sm">
                      Pay
                    </RecordPaymentButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No outstanding dues.</p>}
        </div>
      </Card>
    </div>
  );
}

async function YearlyReport({ year }: { year: number }) {
  const r = await api<{ year: number; months: TrendPoint[]; totals: { expected: number; collected: number } }>(`/reports/yearly?year=${year}`);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Link href={`/reports?tab=yearly&year=${year - 1}`} className="rounded-lg px-3 py-2 font-semibold text-primary hover:bg-primary-light">← {year - 1}</Link>
        <span className="text-lg font-extrabold text-primary">{year}</span>
        <Link href={`/reports?tab=yearly&year=${year + 1}`} className="rounded-lg px-3 py-2 font-semibold text-primary hover:bg-primary-light">{year + 1} →</Link>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatTile label={`Billed in ${year}`} value={taka(r.totals.expected, { decimals: false })} icon={Receipt} />
        <StatTile label={`Collected in ${year}`} value={taka(r.totals.collected, { decimals: false })} icon={Wallet} tone="success" />
      </div>
      <Card>
        <CardHeader title="Month by month" />
        <CardBody>
          <IncomeTrendChart data={r.months} />
        </CardBody>
      </Card>
      <Card className="overflow-hidden">
        <CardHeader
          title="Table"
          action={
            <CsvButton filename={`stms-${year}.csv`} header={["Month", "Billed", "Collected"]} rows={r.months.map((m) => [m.period, m.expected, m.collected])} />
          }
        />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-canvas text-left text-xs text-muted uppercase">
              <tr>
                <th className="px-5 py-2.5 font-semibold">Month</th>
                <th className="px-3 py-2.5 text-right font-semibold">Billed</th>
                <th className="px-5 py-2.5 text-right font-semibold">Collected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {r.months.map((m) => (
                <tr key={m.period}>
                  <td className="px-5 py-2.5 font-semibold">{periodLabel(m.period, true)}</td>
                  <td className="tabular px-3 py-2.5 text-right">{taka(m.expected)}</td>
                  <td className="tabular px-5 py-2.5 text-right">{taka(m.collected)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
