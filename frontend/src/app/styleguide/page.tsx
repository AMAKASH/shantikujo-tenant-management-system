import type { Metadata } from "next";
import { Bell, BarChart3, Calendar, CreditCard, FileText, Filter, HelpCircle, Home, LogOut, Search, Settings, Users } from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Input, SearchInput, Select } from "@/components/ui/field";

export const metadata: Metadata = { title: "Style guide" };

const COLORS = [
  ["Primary", "#0B2D6B", "bg-primary"],
  ["Accent", "#2563EB", "bg-accent"],
  ["Primary Light", "#E8F0FF", "bg-primary-light"],
  ["Text", "#1F2937", "bg-ink"],
  ["Muted", "#6B7280", "bg-muted"],
  ["Border", "#E5E7EB", "bg-line"],
];

const ICONS = [Home, Users, FileText, CreditCard, BarChart3, Settings, Calendar, Bell, Search, Filter, HelpCircle, LogOut];

/** Renders the brand tokens and components side by side with docs/STMS Brand Style Guide Board.png. */
export default function StyleguidePage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <section className="flex flex-wrap items-center gap-8">
        <Logo />
        <span className="grid size-24 place-items-center rounded-3xl bg-primary">
          <LogoMark className="h-12 w-14" inverted />
        </span>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-primary">Color palette</h2>
        <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
          {COLORS.map(([name, hex, cls]) => (
            <div key={name}>
              <div className={`h-20 rounded-xl border border-line ${cls}`} />
              <p className="mt-2 text-sm font-semibold">{name}</p>
              <p className="text-xs text-muted">{hex}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-primary">Typography: Plus Jakarta Sans</h2>
        <p className="text-6xl font-extrabold text-primary">Aa</p>
        <p className="mt-2 text-muted">Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk Ll Mm Nn Oo Pp Qq Rr Ss Tt Uu Vv Ww Xx Yy Zz 0123456789 ৳</p>
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold text-primary">Icon style</h2>
        <div className="flex flex-wrap gap-6 text-primary">
          {ICONS.map((I, i) => (
            <I key={i} className="size-8" strokeWidth={1.75} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-primary">UI elements</h2>
          <Button arrow>Primary Button</Button>
          <Button variant="secondary" arrow>Secondary Button</Button>
          <Button variant="outline">Outline Button</Button>
          <SearchInput placeholder="Search..." />
          <Select defaultValue="">
            <option value="">Select Option</option>
          </Select>
          <Field label="Amount" htmlFor="sg-amt" hint="Helper text">
            <Input id="sg-amt" prefix="৳" placeholder="0" />
          </Field>
          <Alert tone="success">Operation successful!</Alert>
          <Alert tone="error">Something went wrong.</Alert>
        </div>
        <div className="flex flex-col gap-3">
          <h2 className="text-xl font-bold text-primary">Cards & panels</h2>
          <Card className="p-4">
            <div className="flex items-start gap-4">
              <div className="h-20 w-28 rounded-lg bg-gradient-to-br from-primary-light to-[#bcd2fb]" />
              <div>
                <p className="font-bold">Shantikunjo Residency</p>
                <p className="text-sm text-muted">123 Shantikunjo Road</p>
                <Badge tone="success" className="mt-2">Active</Badge>
              </div>
            </div>
            <div className="mt-4 flex justify-between border-t border-line pt-3">
              <div>
                <p className="text-sm text-muted">Tenants</p>
                <p className="text-xl font-bold">48</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted">Units</p>
                <p className="text-xl font-bold">72</p>
              </div>
            </div>
          </Card>
          <div className="flex flex-wrap gap-2">
            <Badge tone="success">Paid</Badge>
            <Badge tone="warning">Partially paid</Badge>
            <Badge tone="info">Unpaid</Badge>
            <Badge tone="danger">Overdue</Badge>
            <Badge>Void</Badge>
          </div>
        </div>
      </section>
    </main>
  );
}
