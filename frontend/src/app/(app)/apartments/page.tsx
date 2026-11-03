import type { Metadata } from "next";
import Link from "next/link";
import { Bath, BedDouble, Building2, Compass, Plus, Sun } from "lucide-react";
import { ApartmentStatusBadge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { FilterTabs } from "@/components/ui/tabs";
import { api } from "@/lib/api.server";
import type { Apartment } from "@/lib/types";
import { FACING_SHORT, taka } from "@/lib/utils";

export const metadata: Metadata = { title: "Apartments" };

export default async function ApartmentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status = "ALL" } = await searchParams;
  const { items } = await api<{ items: Apartment[] }>("/apartments");
  const count = (s: string) => items.filter((a) => a.status === s).length;
  const shown = status === "ALL" ? items : items.filter((a) => a.status === status);

  return (
    <>
      <PageHeader
        title="Apartments"
        description={`${items.length} units · ${count("OCCUPIED")} occupied · ${count("VACANT")} vacant`}
        actions={
          <ButtonLink href="/apartments/new">
            <Plus className="size-4" aria-hidden /> Add apartment
          </ButtonLink>
        }
      />
      <FilterTabs
        active={status}
        items={[
          { value: "ALL", label: "All", href: "/apartments", count: items.length },
          { value: "OCCUPIED", label: "Occupied", href: "/apartments?status=OCCUPIED", count: count("OCCUPIED") },
          { value: "VACANT", label: "Vacant", href: "/apartments?status=VACANT", count: count("VACANT") },
          { value: "MAINTENANCE", label: "Maintenance", href: "/apartments?status=MAINTENANCE", count: count("MAINTENANCE") },
        ]}
      />

      {shown.length === 0 ? (
        <Card className="mt-4">
          <EmptyState
            icon={Building2}
            title={items.length ? "No apartments match" : "No apartments yet"}
            action={!items.length && <ButtonLink href="/apartments/new">Add your first apartment</ButtonLink>}
          >
            {items.length ? "Try another filter." : "Add the units in your building to start assigning tenants."}
          </EmptyState>
        </Card>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {shown.map((a) => (
            <Link key={a.id} href={`/apartments/${a.id}`} className="group">
              <Card className="h-full p-4 transition-shadow group-hover:shadow-md sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-xl bg-primary text-lg font-extrabold text-white">{a.number}</span>
                    <div>
                      <p className="font-bold text-primary">Apartment {a.number}</p>
                      <p className="text-xs text-muted">
                        {a.floor != null ? `Floor ${a.floor}` : "—"}
                        {a.sizeSqft ? ` · ${a.sizeSqft} sq ft` : ""}
                      </p>
                    </div>
                  </div>
                  <ApartmentStatusBadge status={a.status} />
                </div>
                <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs text-muted">
                  <Spec icon={BedDouble} value={a.rooms} label="Rooms" />
                  <Spec icon={Bath} value={a.toilets} label="Toilets" />
                  <Spec icon={Sun} value={a.balconies} label="Balcony" />
                  <Spec icon={Compass} value={FACING_SHORT[a.facing]} label="Facing" />
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
                  {a.currentLease ? (
                    <>
                      <span className="truncate font-semibold text-ink">{a.currentLease.tenant.fullName}</span>
                      <span className="tabular shrink-0 font-bold text-primary">{taka(a.currentLease.rent, { decimals: false })}/mo</span>
                    </>
                  ) : (
                    <>
                      <span className="text-muted">No tenant</span>
                      {a.defaultRent != null && <span className="tabular font-semibold text-muted">{taka(a.defaultRent, { decimals: false })}/mo</span>}
                    </>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function Spec({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-lg bg-canvas px-1 py-2">
      <Icon className="mx-auto mb-1 size-4 text-accent" />
      <p className="font-bold text-ink">{value}</p>
      <p>{label}</p>
    </div>
  );
}
