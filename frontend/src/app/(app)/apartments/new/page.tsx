import type { Metadata } from "next";
import { ApartmentForm } from "@/components/forms/apartment-form";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Add apartment" };

export default function NewApartmentPage() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add apartment" back={{ href: "/apartments", label: "Apartments" }} />
      <ApartmentForm />
    </div>
  );
}
