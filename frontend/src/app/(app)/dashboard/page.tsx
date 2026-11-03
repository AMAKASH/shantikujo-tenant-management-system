import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, Gauge, Home, Receipt, UserPlus, Wallet } from "lucide-react";
import { ByTypeChart } from "@/components/charts/by-type";
import { IncomeTrendChart } from "@/components/charts/income-trend";
import { RecordPaymentButton } from "@/components/forms/payment-dialog";
import { GenerateInvoicesButton } from "@/components/forms/generate-invoices";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader, StatTile } from "@/components/ui/misc";
import { api } from "@/lib/api.server";
import type { Dashboard } from "@/lib/types";
import { formatDate, periodLabel, taka } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const d = await api<Dashboard>("/dashboard");
  const k = d.kpis;
  const settledPct = k.expected > 0 ? Math.round((k.settled / k.expected) * 100) : 0;

  const dueText =
    d.daysToDue > 1
      ? `Rent is due in ${d.daysToDue} days (${formatDate(d.dueDate)})`
      : d.daysToDue === 1
        ? "Rent is due tomorrow"
        : d.daysToDue === 0
          ? "Rent is due today"
          : `Rent was due on ${formatDate(d.dueDate)}`;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`${periodLabel(d.period, true)} · ${dueText}`}
        actions={
          <>
            <RecordPaymentButton />
            <ButtonLink href="/tenants/new" variant="outline">
              <UserPlus className="size-4" aria-hidden /> Add tenant
            </ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        <StatTile
          label="Collected this month"
          value={taka(k.collectedThisMonth, { decimals: false })}
          sub={`${k.paymentsThisMonth} payment${k.paymentsThisMonth === 1 ? "" : "s"} received`}
          icon={Wallet}
          tone="success"
        />
        <StatTile
          label="Billed this month"
          value={taka(k.expected, { decimals: false })}
          sub={`${settledPct}% settled · ${k.invoicesThisMonth} invoices`}
          icon={Receipt}
        />
        <StatTile
          label="Outstanding dues"
          value={taka(k.outstanding, { decimals: false })}
          sub={k.overdueTenants ? `${k.overdueTenants} tenant${k.overdueTenants > 1 ? "s" : ""} overdue · ${taka(k.overdueAmount, { decimals: false })}` : "Nobody is overdue"}
          icon={AlertTriangle}
          tone={k.overdueTenants ? "danger" : "primary"}
        />
        <StatTile
          label="Occupancy"
          value={`${k.occupied}/${k.apartments}`}
          sub={`${Math.round(k.occupancyRate * 100)}% · ${k.vacant} vacant${k.maintenance ? ` · ${k.maintenance} in maintenance` : ""}`}
          icon={Home}
        />
      </div>

      {k.missingPoliceVerification > 0 && (
        <Alert tone="warning" className="mt-4">
          {k.missingPoliceVerification} current tenant{k.missingPoliceVerification > 1 ? "s are" : " is"} missing a police verification form.{" "}
          <Link href="/tenants" className="underline underline-offset-2">Review tenants</Link>
        </Alert>
      )}

      <div className="mt-4 grid gap-4 sm:mt-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Income, last 12 months" description="Cash collected each month against what was billed" action={<ButtonLink href="/reports" variant="ghost" size="sm">Reports <ArrowRight className="size-3.5" /></ButtonLink>} />
          <CardBody>
            <IncomeTrendChart data={d.trend} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="This month by type" description={periodLabel(d.period, true)} />
          <CardBody>
            <ByTypeChart data={d.byType} />
          </CardBody>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 sm:mt-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Who still owes"
            description="Tenants with unpaid bills, largest first"
            action={<ButtonLink href="/reports?tab=dues" variant="ghost" size="sm">All dues <ArrowRight className="size-3.5" /></ButtonLink>}
          />
          {d.dues.length === 0 ? (
            <EmptyState icon={Wallet} title="All settled">Every tenant is paid up.</EmptyState>
          ) : (
            <ul className="mt-2 divide-y divide-line">
              {d.dues.map((r) => (
                <li key={r.tenantId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <Avatar name={r.fullName} size={38} />
                  <Link href={`/tenants/${r.tenantId}`} className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{r.fullName}</p>
                    <p className="truncate text-xs text-muted">
                      {r.apartment ? `Apt ${r.apartment} · ` : ""}since {periodLabel(r.oldestPeriod)} · {r.invoices} bill{r.invoices > 1 ? "s" : ""}
                    </p>
                  </Link>
                  <div className="text-right">
                    <p className="tabular font-bold text-ink">{taka(r.total, { decimals: false })}</p>
                    {r.overdue > 0 ? <Badge tone="danger">Overdue</Badge> : <Badge tone="info">Due {formatDate(d.dueDate).replace(/ \d{4}$/, "")}</Badge>}
                  </div>
                  <RecordPaymentButton
                    target={{ tenantId: r.tenantId, tenantName: r.fullName }}
                    variant="outline"
                    size="sm"
                    className="hidden sm:inline-flex"
                  >
                    Pay
                  </RecordPaymentButton>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Quick actions" />
            <CardBody className="grid grid-cols-2 gap-2">
              <QuickLink href="/billing/meter-readings" icon={Gauge} label="Meter readings" />
              <QuickLink href="/tenants/new" icon={UserPlus} label="Add tenant" />
              <QuickLink href="/leases/new" icon={Home} label="Assign apartment" />
              <GenerateInvoicesButton period={d.period} variant="tile" />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Coming up" description="Move-outs and lease ends, next 60 days" />
            {d.upcoming.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-sm text-muted">Nothing scheduled.</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {d.upcoming.map((u) => (
                  <li key={u.leaseId} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <span className="grid size-9 place-items-center rounded-xl bg-warning-bg text-warning">
                      <CalendarClock className="size-4" />
                    </span>
                    <Link href={`/tenants/${u.tenant.id}`} className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{u.tenant.fullName}</p>
                      <p className="text-xs text-muted">
                        Apt {u.apartment.number} · {u.status === "NOTICE" ? "moves out" : "lease ends"} {formatDate(u.date)}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function QuickLink({ href, icon: Icon, label }: { href: string; icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <Link
      href={href}
      className="flex flex-col items-start gap-2 rounded-xl border border-line p-3 text-sm font-semibold text-ink transition-colors hover:border-accent hover:bg-primary-light"
    >
      <Icon className="size-5 text-accent" />
      {label}
    </Link>
  );
}
