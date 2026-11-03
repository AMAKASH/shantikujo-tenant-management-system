import type { Metadata } from "next";
import { LeaseForm } from "@/components/forms/lease-form";
import { PageHeader } from "@/components/ui/misc";
import { api } from "@/lib/api.server";
import type { Apartment, TenantListItem } from "@/lib/types";

export const metadata: Metadata = { title: "Assign apartment" };

export default async function NewLeasePage({ searchParams }: { searchParams: Promise<{ tenantId?: string; apartmentId?: string }> }) {
  const { tenantId, apartmentId } = await searchParams;
  const [apts, tenants] = await Promise.all([
    api<{ items: Apartment[] }>("/apartments"),
    api<{ items: TenantListItem[] }>("/tenants?status=former"),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Assign apartment"
        description="Start a lease. The first month's bill is created automatically (prorated if mid-month)."
        back={tenantId ? { href: `/tenants/${tenantId}`, label: "Tenant" } : apartmentId ? { href: `/apartments/${apartmentId}`, label: "Apartment" } : { href: "/dashboard", label: "Dashboard" }}
      />
      <LeaseForm
        apartments={apts.items.filter((a) => a.status !== "OCCUPIED")}
        tenants={tenants.items.filter((t) => !t.archivedAt)}
        tenantId={tenantId}
        apartmentId={apartmentId}
      />
    </div>
  );
}
