import type { Metadata } from "next";
import { TenantForm } from "@/components/forms/tenant-form";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Add tenant" };

export default function NewTenantPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add tenant" description="Create the tenant record, then assign an apartment." back={{ href: "/tenants", label: "Tenants" }} />
      <TenantForm />
    </div>
  );
}
