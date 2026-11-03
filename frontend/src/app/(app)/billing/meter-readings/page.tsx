import type { Metadata } from "next";
import { Gauge } from "lucide-react";
import { MeterSheet, type SheetRow } from "@/components/forms/meter-sheet";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";
import { MonthPicker } from "@/components/ui/month-picker";
import { api } from "@/lib/api.server";
import type { Settings } from "@/lib/types";
import { currentPeriod, PERIOD_RE } from "@/lib/utils";

export const metadata: Metadata = { title: "Meter readings" };

export default async function MeterReadingsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const sp = await searchParams;
  const period = sp.period && PERIOD_RE.test(sp.period) ? sp.period : currentPeriod();
  const [{ items }, settings] = await Promise.all([
    api<{ items: SheetRow[] }>(`/meter-readings?period=${period}`),
    api<Settings>("/settings"),
  ]);
  const done = items.filter((i) => i.reading).length;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <MonthPicker period={period} href={(p) => `/billing/meter-readings?period=${p}`} />
        <p className="text-sm font-semibold text-muted">
          {done} of {items.length} entered
        </p>
      </div>
      <Alert tone="info" className="mt-4">
        Enter each sub-meter reading and the bill amount. Leave the amount empty to use the slab estimate. The charge is added to that month&apos;s invoice.
      </Alert>
      {items.length === 0 ? (
        <Card className="mt-4">
          <EmptyState icon={Gauge} title="No occupied apartments">Readings are taken for apartments with an active lease.</EmptyState>
        </Card>
      ) : (
        <MeterSheet key={period} period={period} rows={items} electricity={settings.electricity} />
      )}
    </>
  );
}
