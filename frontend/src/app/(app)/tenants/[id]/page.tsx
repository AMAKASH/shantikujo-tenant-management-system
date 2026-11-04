import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Home, Mail, MapPin, Pencil, Phone, Users } from "lucide-react";
import { ArchiveButton } from "@/components/forms/archive-button";
import { DocumentsPanel } from "@/components/forms/documents-panel";
import { LeaseActions } from "@/components/forms/lease-actions";
import { RecordPaymentButton } from "@/components/forms/payment-dialog";
import { Badge, InvoiceStatusBadge, LeaseStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, DescList, EmptyState, PageHeader } from "@/components/ui/misc";
import { apiOrNull } from "@/lib/api.server";
import type { LedgerEntry, TenantDetail } from "@/lib/types";
import { formatDate, RELATION_LABEL, taka } from "@/lib/utils";

export const metadata: Metadata = { title: "Tenant" };

export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [t, ledger] = await Promise.all([
    apiOrNull<TenantDetail>(`/tenants/${id}`),
    apiOrNull<{ entries: LedgerEntry[]; balance: number }>(`/tenants/${id}/ledger`),
  ]);
  if (!t || !ledger) notFound();
  const lease = t.activeLease;
  const past = t.leases.filter((l) => l.status === "ENDED");

  return (
    <>
      <PageHeader
        back={{ href: "/tenants", label: "Tenants" }}
        title={
          <span className="flex items-center gap-3 sm:gap-4">
            <Avatar name={t.fullName} photoId={t.photoId} size={56} />
            <span className="min-w-0">
              <span className="block truncate">{t.fullName}</span>
              <span className="mt-1 flex flex-wrap gap-1.5 text-sm font-normal">
                {lease ? <Badge tone="success">Apt {lease.apartment?.number}</Badge> : <Badge>No apartment</Badge>}
                {t.archivedAt && <Badge tone="warning">Archived</Badge>}
              </span>
            </span>
          </span>
        }
        actions={
          <>
            <RecordPaymentButton target={{ tenantId: t.id, tenantName: t.fullName }} />
            {!lease && !t.archivedAt && (
              <ButtonLink href={`/leases/new?tenantId=${t.id}`} variant="secondary">
                <Home className="size-4" aria-hidden /> Assign apartment
              </ButtonLink>
            )}
            <ButtonLink href={`/tenants/${t.id}/edit`} variant="outline">
              <Pencil className="size-4" aria-hidden /> Edit
            </ButtonLink>
            {!lease && <ArchiveButton tenantId={t.id} archived={Boolean(t.archivedAt)} />}
          </>
        }
      />

      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Money label="Due" value={t.balance.due} tone={t.balance.due > 0 ? "text-ink" : "text-success"} />
        <Money label="Overdue" value={t.balance.overdue} tone={t.balance.overdue > 0 ? "text-danger" : "text-muted"} />
        <Money label="Advance credit" value={t.balance.credit} tone={t.balance.credit > 0 ? "text-success" : "text-muted"} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader title="Current lease" action={lease && <LeaseStatusBadge status={lease.status} />} />
            <CardBody>
              {lease ? (
                <div className="flex flex-col gap-5">
                  <DescList
                    items={[
                      ["Apartment", <Link key="a" href={`/apartments/${lease.apartmentId}`} className="text-accent underline-offset-2 hover:underline">Apartment {lease.apartment?.number}</Link>],
                      ["Start date", formatDate(lease.startDate)],
                      ["Monthly rent", taka(lease.rent)],
                      ["Service charge", taka(lease.serviceCharge)],
                      ["Security deposit", `${taka(lease.securityDeposit)}${lease.depositReceivedAt ? ` · received ${formatDate(lease.depositReceivedAt)}` : " · not received"}`],
                      ["Notice period", `${lease.noticeMonths} month${lease.noticeMonths === 1 ? "" : "s"}`],
                      ...(lease.status === "NOTICE"
                        ? ([
                            ["Notice given", `${formatDate(lease.noticeGivenAt)} by ${lease.noticeBy === "TENANT" ? "tenant" : "landlord"}`],
                            ["Moving out", formatDate(lease.moveOutDate)],
                          ] as [string, string][])
                        : []),
                      ...(lease.endDate ? ([["Lease ends", formatDate(lease.endDate)]] as [string, string][]) : []),
                    ]}
                  />
                  <LeaseActions lease={lease} />
                </div>
              ) : (
                <EmptyState
                  icon={Home}
                  title="No active lease"
                  action={!t.archivedAt && <ButtonLink href={`/leases/new?tenantId=${t.id}`}>Assign an apartment</ButtonLink>}
                />
              )}
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Ledger" description="Bills and payments, newest first" />
            {ledger.entries.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-sm text-muted">No transactions yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-canvas text-left text-xs text-muted uppercase">
                    <tr>
                      <th className="px-5 py-2.5 font-semibold">Date</th>
                      <th className="px-3 py-2.5 font-semibold">Details</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Billed</th>
                      <th className="px-3 py-2.5 text-right font-semibold">Paid</th>
                      <th className="px-5 py-2.5 text-right font-semibold">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {ledger.entries.map((e) => (
                      <tr key={`${e.kind}-${e.id}`}>
                        <td className="px-5 py-2.5 whitespace-nowrap text-muted">{formatDate(e.date)}</td>
                        <td className="px-3 py-2.5">
                          {e.kind === "invoice" ? (
                            <Link href={`/billing/invoices/${e.id}`} className="font-semibold text-ink hover:text-accent">
                              {e.description}
                            </Link>
                          ) : (
                            <span className="font-semibold">{e.description}</span>
                          )}
                          <span className="ml-2 text-xs text-muted">{e.ref}</span>
                          {e.status && e.status !== "PAID" && <span className="ml-2"><InvoiceStatusBadge status={e.status} /></span>}
                        </td>
                        <td className="tabular px-3 py-2.5 text-right">{e.debit ? taka(e.debit) : ""}</td>
                        <td className="tabular px-3 py-2.5 text-right text-success">{e.credit ? taka(e.credit) : ""}</td>
                        <td className="tabular px-5 py-2.5 text-right font-semibold">{e.balance < 0 ? `${taka(-e.balance)} cr` : taka(e.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {past.length > 0 && (
            <Card>
              <CardHeader title="Past leases" />
              <CardBody>
                <ul className="flex flex-col gap-2 text-sm">
                  {past.map((l) => (
                    <li key={l.id} className="flex justify-between gap-2">
                      <span>Apartment {l.apartment?.number}</span>
                      <span className="text-muted">
                        {formatDate(l.startDate)} – {formatDate(l.endedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Contact" />
            <CardBody className="flex flex-col gap-3 text-sm">
              <a href={`tel:${t.phone}`} className="flex items-center gap-3 font-semibold text-accent">
                <Phone className="size-4" aria-hidden /> {t.phone}
              </a>
              {t.email && (
                <a href={`mailto:${t.email}`} className="flex items-center gap-3 break-all text-ink">
                  <Mail className="size-4 shrink-0 text-muted" aria-hidden /> {t.email}
                </a>
              )}
              <p className="flex items-start gap-3">
                <MapPin className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
                <span className="whitespace-pre-line">{t.permanentAddress}</span>
              </p>
              <DescList
                className="mt-2 border-t border-line pt-4 sm:grid-cols-1"
                items={[
                  ["NID", <span key="n" className="tabular">{t.nid}</span>],
                  ["Occupation", t.occupation ?? "—"],
                  ["Emergency contact", t.emergencyContactName ? `${t.emergencyContactName}${t.emergencyContactPhone ? ` · ${t.emergencyContactPhone}` : ""}` : "—"],
                ]}
              />
              {t.notes && <p className="rounded-lg bg-canvas p-3 whitespace-pre-line">{t.notes}</p>}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title={`Family (${t.familyMembers.length + 1} people)`} />
            <CardBody>
              {t.familyMembers.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Users className="size-4" /> Lives alone
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {t.familyMembers.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <Avatar name={m.name} size={34} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{m.name}</p>
                        <p className="text-xs text-muted">{RELATION_LABEL[m.relation]}</p>
                      </div>
                      {m.phone && (
                        <a href={`tel:${m.phone}`} className="tabular text-xs font-semibold text-accent">
                          {m.phone}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card className="overflow-hidden">
            <CardHeader title="Documents" />
            <div className="mt-2">
              <DocumentsPanel tenantId={t.id} documents={t.documents} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}

function Money({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="p-3 sm:p-4">
      <p className="text-xs font-medium text-muted sm:text-sm">{label}</p>
      <p className={`tabular mt-0.5 text-base font-extrabold sm:text-xl ${tone}`}>{taka(value, { decimals: false })}</p>
    </Card>
  );
}
