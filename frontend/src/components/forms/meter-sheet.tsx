"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { apiFetch, errorMessage } from "@/lib/api.client";
import { estimateBill } from "@/lib/electricity";
import type { MeterReading, Settings } from "@/lib/types";
import { number, taka } from "@/lib/utils";

export interface SheetRow {
  leaseId: string;
  apartment: { id: string; number: string; floor: number | null; meterNo: string | null };
  tenant: { id: string; fullName: string };
  previousReading: number;
  reading: MeterReading | null;
}

export function MeterSheet({ period, rows, electricity }: { period: string; rows: SheetRow[]; electricity: Settings["electricity"] }) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-2">
      {rows.map((r) => (
        <MeterRow key={r.leaseId} period={period} row={r} electricity={electricity} />
      ))}
    </div>
  );
}

function MeterRow({ period, row, electricity }: { period: string; row: SheetRow; electricity: Settings["electricity"] }) {
  const router = useRouter();
  const [current, setCurrent] = useState(row.reading ? String(row.reading.current) : "");
  const [amount, setAmount] = useState(row.reading ? String(row.reading.amount) : "");
  const [reset, setReset] = useState(row.reading?.isReset ?? false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(Boolean(row.reading));

  const cur = current === "" ? null : Number(current);
  const units = cur == null ? null : reset ? cur : cur - row.previousReading;
  const invalid = units != null && units < 0;
  const estimate = units != null && units >= 0 ? estimateBill(units, electricity) : null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (cur == null || invalid) return;
    setSaving(true);
    try {
      const r = await apiFetch<MeterReading>("/meter-readings", {
        method: "POST",
        json: { leaseId: row.leaseId, period, current: cur, amount: amount === "" ? null : Number(amount), isReset: reset },
      });
      setAmount(String(r.amount));
      setSaved(true);
      toast.success(`Apt ${row.apartment.number}: ${number(r.units)} units · ${taka(r.amount)}`);
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="p-4">
      <form onSubmit={save} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-sm font-extrabold text-white">{row.apartment.number}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold">{row.tenant.fullName}</p>
            <p className="text-xs text-muted">
              Previous: <span className="tabular font-semibold text-ink">{number(row.previousReading)}</span>
              {row.apartment.meterNo ? ` · ${row.apartment.meterNo}` : ""}
            </p>
          </div>
          {saved && <Badge tone="success"><Check className="size-3" /> Saved</Badge>}
        </div>
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Current reading
            <Input
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value);
                setSaved(false);
              }}
              aria-invalid={invalid}
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-semibold">
            Bill amount
            <Input
              prefix="৳"
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              placeholder={estimate != null ? String(estimate.total) : ""}
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setSaved(false);
              }}
            />
          </label>
          <button
            type="submit"
            disabled={saving || cur == null || invalid}
            className="grid h-11 w-14 place-items-center rounded-xl bg-primary font-semibold text-white disabled:opacity-40"
            aria-label={`Save reading for apartment ${row.apartment.number}`}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : "Save"}
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className={invalid ? "font-semibold text-danger" : "text-muted"}>
            {invalid
              ? "Lower than the previous reading. Tick 'meter reset' if it was replaced."
              : units != null
                ? `${number(units)} units${amount === "" && estimate != null ? ` · ${estimate.mode === "flat" ? "flat-rate" : "slab"} estimate ${taka(estimate.total)}` : ""}`
                : "Enter the current reading"}
          </span>
          <label className="flex items-center gap-1.5 text-muted">
            <input type="checkbox" checked={reset} onChange={(e) => setReset(e.target.checked)} className="size-4 accent-primary" />
            Meter reset
          </label>
        </div>
      </form>
    </Card>
  );
}
