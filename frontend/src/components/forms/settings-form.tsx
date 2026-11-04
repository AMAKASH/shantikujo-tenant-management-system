"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { apiFetch, errorMessage } from "@/lib/api.client";
import type { PaymentMethod, Settings } from "@/lib/types";
import { METHOD_LABEL } from "@/lib/utils";

const METHODS = Object.keys(METHOD_LABEL) as PaymentMethod[];

export function SettingsForm({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [methods, setMethods] = useState<PaymentMethod[]>(settings.paymentMethods ?? []);
  const [smsTemplate, setSmsTemplate] = useState(settings.smsTemplate ?? "");
  const smsChars = [...smsTemplate].length;
  const [flatEnabled, setFlatEnabled] = useState(settings.electricity.flatRate?.enabled ?? false);
  const [slabs, setSlabs] = useState(settings.electricity.slabs.map((s) => ({ upTo: s.upTo == null ? "" : String(s.upTo), rate: String(s.rate) })));

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSaving(true);
    try {
      await apiFetch("/settings", {
        method: "PUT",
        json: {
          propertyName: f.get("propertyName"),
          propertyAddress: f.get("propertyAddress"),
          dueDay: Number(f.get("dueDay")),
          invoicePrefix: String(f.get("invoicePrefix")).toUpperCase(),
          receiptPrefix: String(f.get("receiptPrefix")).toUpperCase(),
          defaultNoticeMonths: Number(f.get("defaultNoticeMonths")),
          contactPhone: f.get("contactPhone"),
          contactEmail: f.get("contactEmail"),
          invoiceNote: f.get("invoiceNote"),
          smsTemplate: smsTemplate,
          paymentMethods: METHODS.filter((m) => methods.includes(m)),
          electricity: {
            slabs: slabs.map((s, i) => ({ upTo: i === slabs.length - 1 || s.upTo === "" ? null : Number(s.upTo), rate: Number(s.rate) })),
            demandCharge: Number(f.get("demandCharge")),
            vatPercent: Number(f.get("vatPercent")),
            flatRate: {
              enabled: flatEnabled,
              maxUnits: Number(f.get("flatMaxUnits") ?? settings.electricity.flatRate?.maxUnits ?? 200),
              rate: Number(f.get("flatRate") ?? settings.electricity.flatRate?.rate ?? 8.5),
            },
          },
        },
      });
      toast.success("Settings saved");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <Card>
        <CardHeader title="Property" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Property name" htmlFor="propertyName" required>
            <Input id="propertyName" name="propertyName" defaultValue={settings.propertyName} required />
          </Field>
          <Field label="Address" htmlFor="propertyAddress">
            <Input id="propertyAddress" name="propertyAddress" defaultValue={settings.propertyAddress} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Billing" />
        <CardBody className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field label="Rent due day" htmlFor="dueDay" hint="Day of month">
            <Input id="dueDay" name="dueDay" type="number" min={1} max={28} defaultValue={settings.dueDay} />
          </Field>
          <Field label="Notice (months)" htmlFor="defaultNoticeMonths">
            <Input id="defaultNoticeMonths" name="defaultNoticeMonths" type="number" min={0} max={12} defaultValue={settings.defaultNoticeMonths} />
          </Field>
          <Field label="Invoice prefix" htmlFor="invoicePrefix">
            <Input id="invoicePrefix" name="invoicePrefix" defaultValue={settings.invoicePrefix} maxLength={6} className="uppercase" />
          </Field>
          <Field label="Receipt prefix" htmlFor="receiptPrefix">
            <Input id="receiptPrefix" name="receiptPrefix" defaultValue={settings.receiptPrefix} maxLength={6} className="uppercase" />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Printed invoice" description="Shown on invoices when you print them or save them as PDF." />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Office phone" htmlFor="contactPhone">
            <Input id="contactPhone" name="contactPhone" type="tel" defaultValue={settings.contactPhone} />
          </Field>
          <Field label="Office email" htmlFor="contactEmail">
            <Input id="contactEmail" name="contactEmail" type="email" defaultValue={settings.contactEmail} />
          </Field>
          <Field label="Note" htmlFor="invoiceNote" className="sm:col-span-2">
            <Textarea id="invoiceNote" name="invoiceNote" rows={2} maxLength={400} defaultValue={settings.invoiceNote} />
          </Field>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-semibold">Accepted payment methods</legend>
            <div className="flex flex-wrap gap-2">
              {METHODS.map((m) => (
                <label key={m} className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm has-[:checked]:border-primary has-[:checked]:bg-primary-light">
                  <input
                    type="checkbox"
                    checked={methods.includes(m)}
                    onChange={(e) => setMethods((xs) => (e.target.checked ? [...xs, m] : xs.filter((x) => x !== m)))}
                    className="size-4 accent-primary"
                  />
                  {METHOD_LABEL[m]}
                </label>
              ))}
            </div>
          </fieldset>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Bill SMS message"
          description="Sent from Billing → Invoices → Notify tenants. {month}, {amount} and {dueDay} are filled in with Bangla words and digits; {amount} is the balance still due."
        />
        <CardBody className="flex flex-col gap-2">
          <Textarea
            id="smsTemplate"
            lang="bn"
            rows={9}
            maxLength={1000}
            value={smsTemplate}
            onChange={(e) => setSmsTemplate(e.target.value)}
            required
            aria-describedby="smsTemplateHint"
          />
          <p id="smsTemplateHint" className="text-xs text-muted">
            {smsChars} characters before filling in · about {smsChars <= 70 ? 1 : Math.ceil(smsChars / 67)} SMS parts per tenant (Bangla SMS: 70 characters per part)
            {!smsTemplate.includes("{amount}") && <span className="ml-1 font-semibold text-danger">· must include {"{amount}"}</span>}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Electricity flat rate"
          description="For low usage: bills at or below the unit limit are charged units × flat rate, with no demand charge or VAT. Above the limit, the slab rates below apply."
        />
        <CardBody className="flex flex-col gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={flatEnabled} onChange={(e) => setFlatEnabled(e.target.checked)} className="size-5 accent-primary" />
            Use a flat rate for low usage
          </label>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Up to (units)" htmlFor="flatMaxUnits" hint="Inclusive">
              <Input id="flatMaxUnits" name="flatMaxUnits" type="number" min={0} step="1" defaultValue={settings.electricity.flatRate?.maxUnits ?? 200} disabled={!flatEnabled} required />
            </Field>
            <Field label="Flat rate per unit" htmlFor="flatRate">
              <Input id="flatRate" name="flatRate" prefix="৳" type="number" min={0} step="0.01" defaultValue={settings.electricity.flatRate?.rate ?? 8.5} disabled={!flatEnabled} required />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Electricity slab rates" description="Used to estimate bills when you leave the amount empty. Check them against your current tariff." />
        <CardBody className="flex flex-col gap-3">
          {slabs.map((s, i) => {
            const last = i === slabs.length - 1;
            const from = i === 0 ? 0 : Number(slabs[i - 1].upTo || 0) + 1;
            return (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <Field label={`Units ${from}${last ? "+" : " to"}`} htmlFor={`upTo-${i}`}>
                  {last ? (
                    <Input id={`upTo-${i}`} value="and above" disabled />
                  ) : (
                    <Input id={`upTo-${i}`} type="number" min={1} value={s.upTo} onChange={(e) => setSlabs((xs) => xs.map((x, j) => (j === i ? { ...x, upTo: e.target.value } : x)))} required />
                  )}
                </Field>
                <Field label="Rate per unit" htmlFor={`rate-${i}`}>
                  <Input id={`rate-${i}`} prefix="৳" type="number" min={0} step="0.01" value={s.rate} onChange={(e) => setSlabs((xs) => xs.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} required />
                </Field>
                <Button type="button" variant="ghost" size="icon" disabled={slabs.length === 1} onClick={() => setSlabs((xs) => xs.filter((_, j) => j !== i))} aria-label="Remove slab">
                  <Trash2 className="size-4" />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => setSlabs((xs) => [...xs.slice(0, -1), { upTo: "", rate: xs[xs.length - 1]?.rate ?? "0" }, xs[xs.length - 1]].filter(Boolean))}
          >
            <Plus className="size-4" /> Add slab
          </Button>
          <div className="grid grid-cols-2 gap-4 border-t border-line pt-4">
            <Field label="Demand charge (monthly)" htmlFor="demandCharge">
              <Input id="demandCharge" name="demandCharge" prefix="৳" type="number" min={0} step="0.01" defaultValue={settings.electricity.demandCharge} />
            </Field>
            <Field label="VAT %" htmlFor="vatPercent">
              <Input id="vatPercent" name="vatPercent" type="number" min={0} max={100} step="0.1" defaultValue={settings.electricity.vatPercent} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Button type="submit" size="lg" loading={saving} className="self-start">
        Save settings
      </Button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [saving, setSaving] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    if (f.get("newPassword") !== f.get("confirm")) return toast.error("New passwords don't match");
    setSaving(true);
    try {
      await apiFetch("/auth/change-password", { method: "POST", json: { currentPassword: f.get("currentPassword"), newPassword: f.get("newPassword") } });
      toast.success("Password changed. Other devices have been signed out.");
      form.reset();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <Field label="Current password" htmlFor="currentPassword">
        <Input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required />
      </Field>
      <Field label="New password" htmlFor="newPassword" hint="At least 8 characters">
        <Input id="newPassword" name="newPassword" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm">
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={8} required />
      </Field>
      <Button type="submit" variant="secondary" loading={saving}>
        Update password
      </Button>
    </form>
  );
}
