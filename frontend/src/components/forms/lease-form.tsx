"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { apiFetch, errorMessage } from "@/lib/api.client";
import type { Apartment, Lease, TenantListItem } from "@/lib/types";
import { taka, todayISO } from "@/lib/utils";

export function LeaseForm({
  apartments,
  tenants,
  tenantId: initialTenant,
  apartmentId: initialApt,
}: {
  apartments: Apartment[];
  tenants: TenantListItem[];
  tenantId?: string;
  apartmentId?: string;
}) {
  const router = useRouter();
  const [tenantId, setTenantId] = useState(initialTenant ?? "");
  const [aptId, setAptId] = useState(initialApt ?? "");
  const apt = apartments.find((a) => a.id === aptId);
  const [rent, setRent] = useState(apt?.defaultRent?.toString() ?? "");
  const [service, setService] = useState(apt?.defaultServiceCharge?.toString() ?? "");
  const [deposit, setDeposit] = useState(apt?.defaultRent ? String(apt.defaultRent * 2) : "");
  const [saving, setSaving] = useState(false);

  function chooseApt(id: string) {
    setAptId(id);
    const a = apartments.find((x) => x.id === id);
    if (a?.defaultRent != null) {
      setRent(String(a.defaultRent));
      setDeposit(String(a.defaultRent * 2));
    }
    if (a?.defaultServiceCharge != null) setService(String(a.defaultServiceCharge));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const opt = (k: string) => (f.get(k) ? String(f.get(k)) : null);
    setSaving(true);
    try {
      const lease = await apiFetch<Lease>("/leases", {
        method: "POST",
        json: {
          tenantId,
          apartmentId: aptId,
          startDate: f.get("startDate"),
          endDate: opt("endDate"),
          rent: Number(rent),
          serviceCharge: Number(service || 0),
          securityDeposit: Number(deposit || 0),
          depositReceivedAt: f.get("depositReceived") === "on" ? f.get("startDate") : null,
          noticeMonths: Number(f.get("noticeMonths")),
          initialMeterReading: opt("initialMeterReading"),
          notes: opt("notes"),
        },
      });
      toast.success(`Apartment ${lease.apartment?.number} assigned to ${lease.tenant?.fullName}`);
      router.push(`/tenants/${tenantId}`);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setSaving(false);
    }
  }

  const tenantMissing = initialTenant && !tenants.some((t) => t.id === initialTenant);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      {tenantMissing && <Alert tone="warning">This tenant already has an active lease.</Alert>}
      <Card>
        <CardHeader title="Who and where" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Tenant" htmlFor="tenantId" required hint={tenants.length === 0 ? undefined : "Only tenants without an active lease are listed"}>
            <Select id="tenantId" value={tenantId} onChange={(e) => setTenantId(e.target.value)} required>
              <option value="">Select tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} · {t.phone}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Apartment" htmlFor="aptId" required>
            <Select id="aptId" value={aptId} onChange={(e) => chooseApt(e.target.value)} required>
              <option value="">Select apartment</option>
              {apartments.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.number} · {a.rooms} rooms{a.status === "MAINTENANCE" ? " (maintenance)" : ""}
                </option>
              ))}
            </Select>
          </Field>
          {tenants.length === 0 && (
            <p className="text-sm text-muted sm:col-span-2">
              No tenants available. <Link href="/tenants/new" className="font-semibold text-accent">Add a tenant</Link> first.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Terms" description="Rent is due on the 10th of every month" />
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Field label="Start date" htmlFor="startDate" required>
            <Input id="startDate" name="startDate" type="date" defaultValue={todayISO()} required />
          </Field>
          <Field label="End date" htmlFor="endDate" hint="Optional">
            <Input id="endDate" name="endDate" type="date" />
          </Field>
          <Field label="Notice period (months)" htmlFor="noticeMonths" className="col-span-2 sm:col-span-1">
            <Input id="noticeMonths" name="noticeMonths" type="number" inputMode="numeric" min={0} max={12} defaultValue={2} />
          </Field>
          <Field label="Monthly rent" htmlFor="rent" required>
            <Input id="rent" prefix="৳" type="number" inputMode="decimal" step="0.01" min={0} value={rent} onChange={(e) => setRent(e.target.value)} required />
          </Field>
          <Field label="Service charge" htmlFor="service">
            <Input id="service" prefix="৳" type="number" inputMode="decimal" step="0.01" min={0} value={service} onChange={(e) => setService(e.target.value)} />
          </Field>
          <Field label="Security deposit" htmlFor="deposit" className="col-span-2 sm:col-span-1">
            <Input id="deposit" prefix="৳" type="number" inputMode="decimal" step="0.01" min={0} value={deposit} onChange={(e) => setDeposit(e.target.value)} />
          </Field>
          <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-3">
            {[1, 2, 3].map((m) => (
              <button
                key={m}
                type="button"
                disabled={!rent}
                onClick={() => setDeposit(String(Number(rent) * m))}
                className="rounded-full border border-line px-3 py-1 text-xs font-semibold text-primary hover:bg-primary-light disabled:opacity-40"
              >
                Deposit = {m}× rent
              </button>
            ))}
          </div>
          <label className="col-span-2 flex items-center gap-3 text-sm font-medium sm:col-span-3">
            <input type="checkbox" name="depositReceived" defaultChecked className="size-5 accent-primary" />
            Security deposit received on the start date
          </label>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Move-in" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Sub-meter reading at move-in" htmlFor="initialMeterReading" hint="Used to calculate the first electricity bill">
            <Input id="initialMeterReading" name="initialMeterReading" type="number" inputMode="decimal" step="0.01" min={0} />
          </Field>
          <Field label="Notes" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={2} className="min-h-11" />
          </Field>
        </CardBody>
      </Card>

      {rent && (
        <Alert tone="info">
          Monthly bill: <strong>{taka(Number(rent) + Number(service || 0))}</strong> (rent + service charge) plus electricity.
        </Alert>
      )}

      <div className="flex gap-2">
        <Button type="submit" size="lg" arrow loading={saving} disabled={!tenantId || !aptId} className="flex-1 sm:flex-none">
          Start lease
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
