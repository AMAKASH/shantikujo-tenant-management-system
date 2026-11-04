"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarX2, DoorOpen, Pencil, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { apiFetch, errorMessage } from "@/lib/api.client";
import type { Lease } from "@/lib/types";
import { taka, todayISO } from "@/lib/utils";

type Mode = "notice" | "end" | "edit" | null;

export function LeaseActions({ lease }: { lease: Lease }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [saving, setSaving] = useState(false);
  const close = () => setMode(null);

  async function submit(path: string, json: unknown, msg: string, method = "POST") {
    setSaving(true);
    try {
      await apiFetch(path, { method, json });
      toast.success(msg);
      close();
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  const val = (f: FormData, k: string) => {
    const v = f.get(k);
    return v === null || v === "" ? null : String(v);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
          <Pencil className="size-4" aria-hidden /> Edit terms
        </Button>
        {lease.status === "ACTIVE" && (
          <Button variant="outline" size="sm" onClick={() => setMode("notice")}>
            <CalendarX2 className="size-4" aria-hidden /> Record notice
          </Button>
        )}
        {lease.status === "NOTICE" && (
          <Button
            variant="ghost"
            size="sm"
            loading={saving}
            onClick={() => submit(`/leases/${lease.id}/cancel-notice`, {}, "Notice withdrawn")}
          >
            <Undo2 className="size-4" aria-hidden /> Withdraw notice
          </Button>
        )}
        <Button variant="danger" size="sm" onClick={() => setMode("end")}>
          <DoorOpen className="size-4" aria-hidden /> End lease
        </Button>
      </div>

      <Dialog open={mode === "notice"} onClose={close} title="Record notice" description={`Notice period: ${lease.noticeMonths} month(s)`}>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            submit(
              `/leases/${lease.id}/notice`,
              { noticeBy: f.get("noticeBy"), noticeGivenAt: f.get("noticeGivenAt"), moveOutDate: val(f, "moveOutDate") ?? undefined },
              "Notice recorded",
            );
          }}
        >
          <Field label="Given by" htmlFor="noticeBy">
            <Select id="noticeBy" name="noticeBy" defaultValue="TENANT">
              <option value="TENANT">Tenant</option>
              <option value="LANDLORD">Landlord</option>
            </Select>
          </Field>
          <Field label="Notice date" htmlFor="noticeGivenAt" required>
            <Input id="noticeGivenAt" name="noticeGivenAt" type="date" defaultValue={todayISO()} required />
          </Field>
          <Field label="Move-out date" htmlFor="moveOutDate" hint={`Leave empty to use notice date + ${lease.noticeMonths} month(s)`}>
            <Input id="moveOutDate" name="moveOutDate" type="date" />
          </Field>
          <Button type="submit" size="lg" loading={saving}>
            Save notice
          </Button>
        </form>
      </Dialog>

      <Dialog open={mode === "end"} onClose={close} title="End lease" description="The tenant moves out and the apartment becomes vacant.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            submit(
              `/leases/${lease.id}/end`,
              {
                endedAt: f.get("endedAt"),
                finalMeterReading: val(f, "finalMeterReading"),
                finalElectricityAmount: val(f, "finalElectricityAmount"),
                prorateFinalMonth: f.get("prorate") === "on",
              },
              "Lease ended",
            );
          }}
        >
          <Field label="Move-out date" htmlFor="endedAt" required>
            <Input id="endedAt" name="endedAt" type="date" defaultValue={lease.moveOutDate ?? todayISO()} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Final meter reading" htmlFor="finalMeterReading">
              <Input id="finalMeterReading" name="finalMeterReading" type="number" inputMode="decimal" step="0.01" min={0} />
            </Field>
            <Field label="Final electricity bill" htmlFor="finalElectricityAmount" hint="Empty = estimated from Settings">
              <Input id="finalElectricityAmount" name="finalElectricityAmount" prefix="৳" type="number" inputMode="decimal" step="0.01" min={0} />
            </Field>
          </div>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="prorate" defaultChecked className="mt-0.5 size-5 accent-primary" />
            <span>
              <span className="font-semibold">Charge only the days stayed</span>
              <span className="block text-muted">Rent and service charge for the final month are prorated. Any overpayment becomes credit.</span>
            </span>
          </label>
          <Alert tone="info">Security deposit held: {taka(lease.securityDeposit)}. Settle it with the tenant separately.</Alert>
          <Button type="submit" variant="danger" size="lg" loading={saving}>
            End lease
          </Button>
        </form>
      </Dialog>

      <Dialog open={mode === "edit"} onClose={close} title="Edit lease terms" description="Rent changes apply to invoices generated from now on.">
        <form
          className="grid grid-cols-2 gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            submit(
              `/leases/${lease.id}`,
              {
                rent: Number(f.get("rent")),
                serviceCharge: Number(f.get("serviceCharge")),
                securityDeposit: Number(f.get("securityDeposit")),
                depositReceivedAt: val(f, "depositReceivedAt"),
                endDate: val(f, "endDate"),
                noticeMonths: Number(f.get("noticeMonths")),
              },
              "Lease updated",
              "PATCH",
            );
          }}
        >
          <Field label="Monthly rent" htmlFor="rent" required>
            <Input id="rent" name="rent" prefix="৳" type="number" inputMode="decimal" step="0.01" min={0} defaultValue={lease.rent} required />
          </Field>
          <Field label="Service charge" htmlFor="serviceCharge" required>
            <Input id="serviceCharge" name="serviceCharge" prefix="৳" type="number" inputMode="decimal" step="0.01" min={0} defaultValue={lease.serviceCharge} required />
          </Field>
          <Field label="Security deposit" htmlFor="securityDeposit">
            <Input id="securityDeposit" name="securityDeposit" prefix="৳" type="number" inputMode="decimal" step="0.01" min={0} defaultValue={lease.securityDeposit} />
          </Field>
          <Field label="Deposit received" htmlFor="depositReceivedAt">
            <Input id="depositReceivedAt" name="depositReceivedAt" type="date" defaultValue={lease.depositReceivedAt ?? ""} />
          </Field>
          <Field label="Lease end date" htmlFor="endDate" hint="Optional">
            <Input id="endDate" name="endDate" type="date" defaultValue={lease.endDate ?? ""} />
          </Field>
          <Field label="Notice (months)" htmlFor="noticeMonths">
            <Input id="noticeMonths" name="noticeMonths" type="number" inputMode="numeric" min={0} max={12} defaultValue={lease.noticeMonths} />
          </Field>
          <Button type="submit" size="lg" loading={saving} className="col-span-2">
            Save changes
          </Button>
        </form>
      </Dialog>
    </>
  );
}
