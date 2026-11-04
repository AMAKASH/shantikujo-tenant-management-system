"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TrendPoint } from "@/lib/types";
import { compactTaka, periodLabel, taka } from "@/lib/utils";

// Blue vs orange: validated with the dataviz palette checker (light surface). Normal-vision ΔE 42,
// CVD ΔE ≥ 32, both ≥ 3:1 contrast. Two hues, not two shades, so the series are easy to tell apart.
const COLLECTED = "#1D4ED8";
const EXPECTED = "#E8710A";

export function IncomeTrendChart({ data }: { data: TrendPoint[] }) {
  const rows = data.map((d) => ({ ...d, label: periodLabel(d.period) }));
  return (
    <div>
      <Legend
        items={[
          { color: COLLECTED, label: "Collected" },
          { color: EXPECTED, label: "Billed" },
        ]}
      />
      <div className="h-64 sm:h-72" role="img" aria-label="Monthly income: collected versus billed for the last 12 months">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#EEF0F3" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#E5E7EB" }} tick={{ fill: "#6B7280", fontSize: 11 }} interval="preserveStartEnd" minTickGap={4} />
            <YAxis tickFormatter={compactTaka} tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} width={56} />
            <Tooltip cursor={{ fill: "#E8F0FF", opacity: 0.6 }} content={<TrendTooltip />} />
            <Bar dataKey="collected" name="Collected" fill={COLLECTED} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="expected" name="Billed" fill={EXPECTED} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TrendTooltip({ active, payload }: { active?: boolean; payload?: { payload: TrendPoint & { label: string } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const rate = p.expected > 0 ? Math.round((p.settled / p.expected) * 100) : null;
  return (
    <div className="min-w-44 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm shadow-lg">
      <p className="mb-1.5 font-bold text-primary">{periodLabel(p.period, true)}</p>
      <Row color={COLLECTED} label="Collected" value={taka(p.collected)} />
      <Row color={EXPECTED} label="Billed" value={taka(p.expected)} />
      {rate != null && <p className="mt-1.5 border-t border-line pt-1.5 text-xs text-muted">{rate}% of this month&apos;s bills settled</p>}
    </div>
  );
}

function Row({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-2 text-muted">
        <span className="size-2.5 rounded-sm" style={{ background: color }} />
        {label}
      </span>
      <span className="tabular font-semibold text-ink">{value}</span>
    </div>
  );
}

export function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm" style={{ background: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
