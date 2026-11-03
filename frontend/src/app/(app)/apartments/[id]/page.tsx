import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, UserPlus } from "lucide-react";
import { ApartmentStatusBadge, LeaseStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Avatar, DescList, PageHeader } from "@/components/ui/misc";
import { apiOrNull } from "@/lib/api.server";
import type { ApartmentDetail } from "@/lib/types";
import { FACING_LABEL, formatDate, number, periodLabel, taka } from "@/lib/utils";

export const metadata: Metadata = { title: "Apartment" };

export default async function ApartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const a = await apiOrNull<ApartmentDetail>(`/apartments/${id}`);
  if (!a) notFound();
  const lease = a.currentLease;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Apartment {a.number} <ApartmentStatusBadge status={a.status} />
          </span>
        }
        description={`${a.floor != null ? `Floor ${a.floor} · ` : ""}${FACING_LABEL[a.facing]} facing`}
        back={{ href: "/apartments", label: "Apartments" }}
        actions={
          <>
            {!lease && a.status !== "MAINTENANCE" && (
              <ButtonLink href={`/leases/new?apartmentId=${a.id}`}>
                <UserPlus className="size-4" aria-hidden /> Assign tenant
              </ButtonLink>
            )}
            <ButtonLink href={`/apartments/${a.id}/edit`} variant="outline">
              <Pencil className="size-4" aria-hidden /> Edit
            </ButtonLink>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader title="Current tenant" />
            <CardBody>
              {lease ? (
                <div className="flex flex-col gap-4">
                  <Link href={`/tenants/${lease.tenant.id}`} className="flex items-center gap-3">
                    <Avatar name={lease.tenant.fullName} size={48} />
                    <div>
                      <p className="font-bold text-primary">{lease.tenant.fullName}</p>
                      <p className="text-sm text-muted">{lease.tenant.phone}</p>
                    </div>
                    <span className="ml-auto">
                      <LeaseStatusBadge status={lease.status} />
                    </span>
                  </Link>
                  <DescList
                    items={[
                      ["Rent", taka(lease.rent)],
                      ["Service charge", taka(lease.serviceCharge)],
                      ["Since", formatDate(lease.startDate)],
                      ["Moving out", lease.moveOutDate ? formatDate(lease.moveOutDate) : "—"],
                    ]}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted">
                  {a.status === "MAINTENANCE" ? "This apartment is under maintenance." : "This apartment is vacant."}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Meter readings" description="Sub-meter history" />
            {a.meterReadings.length === 0 ? (
              <p className="px-5 pt-2 pb-5 text-sm text-muted">No readings yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-muted uppercase">
                    <tr className="border-b border-line">
                      <th className="px-5 py-2 font-semibold">Date</th>
                      <th className="px-3 py-2 font-semibold">Reading</th>
                      <th className="px-3 py-2 text-right font-semibold">Units</th>
                      <th className="px-5 py-2 text-right font-semibold">Bill</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {a.meterReadings.map((r) => (
                      <tr key={r.id}>
                        <td className="px-5 py-2.5 whitespace-nowrap">
                          {formatDate(r.readingDate)}
                          {r.isInitial && <span className="ml-1.5 text-xs text-muted">(move-in)</span>}
                        </td>
                        <td className="tabular px-3 py-2.5">{number(r.current)}</td>
                        <td className="tabular px-3 py-2.5 text-right">{r.isInitial ? "—" : number(r.units)}</td>
                        <td className="tabular px-5 py-2.5 text-right font-semibold">{r.isInitial ? "—" : taka(r.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="Details" />
            <CardBody>
              <DescList
                className="sm:grid-cols-2"
                items={[
                  ["Rooms", a.rooms],
                  ["Toilets", a.toilets],
                  ["Balconies", a.balconies],
                  ["Facing", FACING_LABEL[a.facing]],
                  ["Size", a.sizeSqft ? `${a.sizeSqft} sq ft` : "—"],
                  ["Sub-meter", a.meterNo ?? "—"],
                  ["Default rent", a.defaultRent != null ? taka(a.defaultRent) : "—"],
                  ["Service charge", a.defaultServiceCharge != null ? taka(a.defaultServiceCharge) : "—"],
                ]}
              />
              {a.notes && <p className="mt-4 rounded-lg bg-canvas p-3 text-sm whitespace-pre-line">{a.notes}</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Collected" description="Last 12 billed months" />
            <CardBody>
              {a.income.length === 0 ? (
                <p className="text-sm text-muted">No income yet.</p>
              ) : (
                <ul className="flex flex-col gap-1.5 text-sm">
                  {a.income.map((i) => (
                    <li key={i.period} className="flex justify-between">
                      <span className="text-muted">{periodLabel(i.period, true)}</span>
                      <span className="tabular font-semibold">{taka(i.collected)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Lease history" />
            <CardBody>
              {a.leaseHistory.length === 0 ? (
                <p className="text-sm text-muted">No tenants yet.</p>
              ) : (
                <ul className="flex flex-col gap-3 text-sm">
                  {a.leaseHistory.map((l) => (
                    <li key={l.id} className="flex items-center justify-between gap-2">
                      <Link href={`/tenants/${l.tenant.id}`} className="min-w-0">
                        <p className="truncate font-semibold">{l.tenant.fullName}</p>
                        <p className="text-xs text-muted">
                          {formatDate(l.startDate)} – {l.endedAt ? formatDate(l.endedAt) : "now"}
                        </p>
                      </Link>
                      <LeaseStatusBadge status={l.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
