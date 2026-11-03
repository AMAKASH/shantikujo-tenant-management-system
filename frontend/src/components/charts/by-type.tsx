"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { TypeRow } from "@/lib/types";
import { compactTaka, LINE_LABEL, taka } from "@/lib/utils";
import { Legend } from "./income-trend";

const PAID = "#1D4ED8";
const DUE = "#5B8DEF";
const ORDER = ["RENT", "SERVICE_CHARGE", "ELECTRICITY", "WATER", "GAS", "OTHER", "DISCOUNT"];

/** This month's bills by charge type, split into collected and still due (stacked horizontal bars). */
export function ByTypeChart({ data }: { data: TypeRow[] }) {
  const rows = [...data]
    .filter((d) => d.billed > 0)
    .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))
    .map((d) => ({ ...d, label: LINE_LABEL[d.type] ?? d.type }));

  if (rows.length === 0) return <p className="py-10 text-center text-sm text-muted">No bills for this month yet.</p>;

  return (
    <div>
      <Legend
        items={[
          { color: PAID, label: "Collected" },
          { color: DUE, label: "Still due" },
        ]}
      />
      <div style={{ height: rows.length * 52 + 30 }} role="img" aria-label="This month's bills by type: collected versus still due">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid horizontal={false} stroke="#EEF0F3" />
            <XAxis type="number" tickFormatter={compactTaka} tickLine={false} axisLine={false} tick={{ fill: "#6B7280", fontSize: 11 }} />
            <YAxis type="category" dataKey="label" tickLine={false} axisLine={false} width={104} tick={{ fill: "#1F2937", fontSize: 12, fontWeight: 600 }} />
            <Tooltip cursor={{ fill: "#E8F0FF", opacity: 0.6 }} content={<TypeTooltip />} />
            <Bar dataKey="paid" stackId="a" fill={PAID} maxBarSize={22} stroke="#fff" strokeWidth={2} radius={[4, 0, 0, 4]} />
            <Bar dataKey="due" stackId="a" fill={DUE} maxBarSize={22} stroke="#fff" strokeWidth={2} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function TypeTooltip({ active, payload }: { active?: boolean; payload?: { payload: TypeRow & { label: string } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="min-w-44 rounded-xl border border-line bg-white px-3.5 py-2.5 text-sm shadow-lg">
      <p className="mb-1.5 font-bold text-primary">{p.label}</p>
      <p className="flex justify-between gap-4"><span className="text-muted">Billed</span><span className="tabular font-semibold">{taka(p.billed)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-muted">Collected</span><span className="tabular font-semibold">{taka(p.paid)}</span></p>
      <p className="flex justify-between gap-4"><span className="text-muted">Still due</span><span className="tabular font-semibold">{taka(p.due)}</span></p>
    </div>
  );
}
