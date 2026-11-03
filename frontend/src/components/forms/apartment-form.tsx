"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { apiFetch, ClientApiError, errorMessage } from "@/lib/api.client";
import type { Apartment } from "@/lib/types";
import { FACING_LABEL } from "@/lib/utils";

const num = (v: FormDataEntryValue | null) => (v === null || v === "" ? null : Number(v));

export function ApartmentForm({ apartment }: { apartment?: Apartment }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const err = (k: string) => errors[k]?.[0];

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      number: String(f.get("number")).trim(),
      floor: num(f.get("floor")),
      rooms: num(f.get("rooms")),
      toilets: num(f.get("toilets")),
      balconies: num(f.get("balconies")),
      facing: f.get("facing"),
      sizeSqft: num(f.get("sizeSqft")),
      meterNo: (f.get("meterNo") as string) || null,
      defaultRent: num(f.get("defaultRent")),
      defaultServiceCharge: num(f.get("defaultServiceCharge")),
      underMaintenance: f.get("underMaintenance") === "on",
      notes: (f.get("notes") as string) || null,
    };
    setSaving(true);
    setErrors({});
    try {
      const saved = await apiFetch<Apartment>(apartment ? `/apartments/${apartment.id}` : "/apartments", {
        method: apartment ? "PATCH" : "POST",
        json: payload,
      });
      toast.success(apartment ? "Apartment updated" : `Apartment ${saved.number} added`);
      router.push(`/apartments/${saved.id}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError && e.fieldErrors) setErrors(e.fieldErrors);
      toast.error(errorMessage(e));
      setSaving(false);
    }
  }

  const a = apartment;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Card>
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Apartment number" htmlFor="number" required error={err("number")}>
            <Input id="number" name="number" defaultValue={a?.number} placeholder="e.g. 3B" required maxLength={20} />
          </Field>
          <Field label="Floor" htmlFor="floor" error={err("floor")}>
            <Input id="floor" name="floor" type="number" inputMode="numeric" min={0} defaultValue={a?.floor ?? ""} />
          </Field>
          <Field label="Side facing" htmlFor="facing" required className="col-span-2 sm:col-span-1">
            <Select id="facing" name="facing" defaultValue={a?.facing ?? "SOUTH"}>
              {Object.entries(FACING_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rooms" htmlFor="rooms" required error={err("rooms")}>
            <Input id="rooms" name="rooms" type="number" inputMode="numeric" min={0} defaultValue={a?.rooms ?? 3} required />
          </Field>
          <Field label="Toilets" htmlFor="toilets" required error={err("toilets")}>
            <Input id="toilets" name="toilets" type="number" inputMode="numeric" min={0} defaultValue={a?.toilets ?? 2} required />
          </Field>
          <Field label="Balconies" htmlFor="balconies" required error={err("balconies")}>
            <Input id="balconies" name="balconies" type="number" inputMode="numeric" min={0} defaultValue={a?.balconies ?? 1} required />
          </Field>
          <Field label="Size (sq ft)" htmlFor="sizeSqft">
            <Input id="sizeSqft" name="sizeSqft" type="number" inputMode="numeric" min={0} defaultValue={a?.sizeSqft ?? ""} />
          </Field>
          <Field label="Sub-meter no." htmlFor="meterNo">
            <Input id="meterNo" name="meterNo" defaultValue={a?.meterNo ?? ""} />
          </Field>
        </CardBody>
      </Card>
      <Card>
        <CardBody className="grid grid-cols-2 gap-4">
          <Field label="Default rent" htmlFor="defaultRent" hint="Pre-fills new leases">
            <Input id="defaultRent" name="defaultRent" prefix="৳" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={a?.defaultRent ?? ""} />
          </Field>
          <Field label="Default service charge" htmlFor="defaultServiceCharge">
            <Input id="defaultServiceCharge" name="defaultServiceCharge" prefix="৳" type="number" inputMode="decimal" min={0} step="0.01" defaultValue={a?.defaultServiceCharge ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="notes" className="col-span-2">
            <Textarea id="notes" name="notes" defaultValue={a?.notes ?? ""} rows={3} />
          </Field>
          <label className="col-span-2 flex items-center gap-3 text-sm font-medium">
            <input type="checkbox" name="underMaintenance" defaultChecked={a?.underMaintenance} className="size-5 rounded accent-primary" />
            Under maintenance (not available to rent)
          </label>
        </CardBody>
      </Card>
      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={saving} arrow className="flex-1 sm:flex-none">
          {apartment ? "Save changes" : "Add apartment"}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
