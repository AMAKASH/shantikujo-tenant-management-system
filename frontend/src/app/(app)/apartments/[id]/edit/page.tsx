import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ApartmentForm } from "@/components/forms/apartment-form";
import { PageHeader } from "@/components/ui/misc";
import { apiOrNull } from "@/lib/api.server";
import type { ApartmentDetail } from "@/lib/types";

export const metadata: Metadata = { title: "Edit apartment" };

export default async function EditApartmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const apt = await apiOrNull<ApartmentDetail>(`/apartments/${id}`);
  if (!apt) notFound();
  return (
    <div className="max-w-3xl">
      <PageHeader title={`Edit apartment ${apt.number}`} back={{ href: `/apartments/${id}`, label: `Apartment ${apt.number}` }} />
      <ApartmentForm apartment={apt} />
    </div>
  );
}
