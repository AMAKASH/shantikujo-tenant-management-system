import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus, ShieldAlert, Users } from "lucide-react";
import { Badge, LeaseStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, EmptyState, PageHeader } from "@/components/ui/misc";
import { FilterTabs } from "@/components/ui/tabs";
import { SearchBox } from "@/components/ui/search-box";
import { api } from "@/lib/api.server";
import type { TenantListItem } from "@/lib/types";
import { taka } from "@/lib/utils";

export const metadata: Metadata = { title: "Tenants" };

export default async function TenantsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const { status = "active", q = "" } = await searchParams;
  const qs = new URLSearchParams({ status, ...(q ? { q } : {}) });
  const { items } = await api<{ items: TenantListItem[] }>(`/tenants?${qs}`);
  const tab = (s: string) => `/tenants?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <>
      <PageHeader
        title="Tenants"
        description="Everyone renting from you, with family and documents"
        actions={
          <ButtonLink href="/tenants/new">
            <Plus className="size-4" aria-hidden /> Add tenant
          </ButtonLink>
        }
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs
          active={status}
          items={[
            { value: "active", label: "Current", href: tab("active") },
            { value: "former", label: "Former", href: tab("former") },
            { value: "archived", label: "Archived", href: tab("archived") },
            { value: "all", label: "All", href: tab("all") },
          ]}
        />
        <SearchBox placeholder="Search name, phone, NID, apt…" className="sm:w-80" />
      </div>

      <Card className="mt-4 overflow-hidden">
        {items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={q ? "No tenants match your search" : "No tenants here yet"}
            action={!q && status === "active" && <ButtonLink href="/tenants/new">Add a tenant</ButtonLink>}
          >
            {q ? "Try a different name, phone or NID." : "Tenants with an active lease appear here."}
          </EmptyState>
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead className="bg-canvas text-left text-xs text-muted uppercase">
                <tr>
                  <th className="px-5 py-3 font-semibold">Tenant</th>
                  <th className="px-3 py-3 font-semibold">Apartment</th>
                  <th className="px-3 py-3 font-semibold">Phone</th>
                  <th className="px-3 py-3 font-semibold">Family</th>
                  <th className="px-3 py-3 font-semibold">Documents</th>
                  <th className="px-5 py-3 text-right font-semibold">Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((t) => (
                  <tr key={t.id} className="hover:bg-primary-light/40">
                    <td className="px-5 py-3">
                      <Link href={`/tenants/${t.id}`} className="flex items-center gap-3">
                        <Avatar name={t.fullName} photoId={t.photoId} size={38} />
                        <span>
                          <span className="block font-semibold text-ink">{t.fullName}</span>
                          <span className="block text-xs text-muted">NID {t.nidMasked}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      {t.apartment ? (
                        <span className="flex items-center gap-2">
                          <span className="font-semibold">{t.apartment.number}</span>
                          {t.leaseStatus === "NOTICE" && <LeaseStatusBadge status="NOTICE" />}
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="tabular px-3 py-3">{t.phone}</td>
                    <td className="px-3 py-3">{t.familyCount + 1} people</td>
                    <td className="px-3 py-3">
                      <DocBadges t={t} />
                    </td>
                    <td className="tabular px-5 py-3 text-right font-semibold">{t.due > 0 ? taka(t.due) : <span className="text-success">Paid up</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile list */}
            <ul className="divide-y divide-line md:hidden">
              {items.map((t) => (
                <li key={t.id}>
                  <Link href={`/tenants/${t.id}`} className="flex items-center gap-3 px-4 py-3.5 active:bg-primary-light/50">
                    <Avatar name={t.fullName} photoId={t.photoId} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{t.fullName}</p>
                      <p className="truncate text-xs text-muted">
                        {t.apartment ? `Apt ${t.apartment.number} · ` : ""}
                        {t.phone} · {t.familyCount + 1} people
                      </p>
                      {!t.hasPoliceVerification && !t.archivedAt && (
                        <p className="mt-1 flex items-center gap-1 text-xs font-medium text-warning">
                          <ShieldAlert className="size-3.5" /> Police verification missing
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {t.due > 0 ? <p className="tabular text-sm font-bold">{taka(t.due, { decimals: false })}</p> : <Badge tone="success">Paid</Badge>}
                    </div>
                    <ChevronRight className="size-4 text-muted" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </>
  );
}

function DocBadges({ t }: { t: TenantListItem }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone={t.hasLeaseForm ? "success" : "neutral"}>Lease</Badge>
      <Badge tone={t.hasPoliceVerification ? "success" : "warning"}>Police</Badge>
    </span>
  );
}
