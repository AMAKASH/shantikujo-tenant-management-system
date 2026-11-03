import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TenantForm } from "@/components/forms/tenant-form";
import { PageHeader } from "@/components/ui/misc";
import { apiOrNull } from "@/lib/api.server";
import type { TenantDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Edit tenant" };

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await apiOrNull<TenantDetail>(`/tenants/${id}`);
  if (!t) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit ${t.fullName}`} back={{ href: `/tenants/${id}`, label: t.fullName }} />
      <TenantForm tenant={t} />
    </div>
  );
}
