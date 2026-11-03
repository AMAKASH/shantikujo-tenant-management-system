"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, ImagePlus, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { apiFetch, ClientApiError, errorMessage } from "@/lib/api.client";
import type { DocType, Relation, TenantDetail } from "@/lib/types";
import { cn, RELATION_LABEL } from "@/lib/utils";
import { checkFile, DOC_RULES, uploadDocument } from "./upload";

interface Member {
  key: number;
  name: string;
  relation: Relation;
  phone: string;
}

let k = 0;

export function TenantForm({ tenant }: { tenant?: TenantDetail }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [members, setMembers] = useState<Member[]>(
    tenant?.familyMembers.map((m) => ({ key: ++k, name: m.name, relation: m.relation, phone: m.phone ?? "" })) ?? [],
  );
  const [files, setFiles] = useState<Partial<Record<DocType, File>>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const err = (key: string) => errors[key]?.[0];

  const setMember = (key: number, patch: Partial<Member>) =>
    setMembers((ms) => ms.map((m) => (m.key === key ? { ...m, ...patch } : m)));

  function pick(type: DocType, file: File | undefined) {
    if (!file) return;
    const problem = checkFile(type, file);
    if (problem) return toast.error(problem);
    setFiles((f) => ({ ...f, [type]: file }));
    if (type === "PHOTO") setPhotoPreview(URL.createObjectURL(file));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const payload = {
      fullName: f.get("fullName"),
      nid: String(f.get("nid")).replace(/\s/g, ""),
      phone: f.get("phone"),
      email: f.get("email"),
      permanentAddress: f.get("permanentAddress"),
      occupation: f.get("occupation"),
      emergencyContactName: f.get("emergencyContactName"),
      emergencyContactPhone: f.get("emergencyContactPhone"),
      notes: f.get("notes"),
      familyMembers: members.filter((m) => m.name.trim()).map(({ name, relation, phone }) => ({ name, relation, phone })),
    };
    setSaving(true);
    setErrors({});
    try {
      const saved = await apiFetch<{ id: string }>(tenant ? `/tenants/${tenant.id}` : "/tenants", {
        method: tenant ? "PATCH" : "POST",
        json: payload,
      });
      const failed: string[] = [];
      for (const [type, file] of Object.entries(files) as [DocType, File][]) {
        try {
          await uploadDocument(saved.id, type, file);
        } catch (e) {
          failed.push(`${type.toLowerCase().replace("_", " ")}: ${errorMessage(e)}`);
        }
      }
      if (failed.length) toast.warning("Saved, but some files did not upload", { description: failed.join("\n") });
      else toast.success(tenant ? "Tenant updated" : "Tenant added");
      router.push(`/tenants/${saved.id}`);
      router.refresh();
    } catch (e) {
      if (e instanceof ClientApiError && e.fieldErrors) setErrors(e.fieldErrors);
      toast.error(errorMessage(e));
      setSaving(false);
    }
  }

  const t = tenant;
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <Card>
        <CardHeader title="Primary tenant" />
        <CardBody className="flex flex-col gap-5 sm:flex-row">
          {!tenant && (
            <label className="group relative mx-auto flex h-36 w-28 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 border-dashed border-line bg-canvas text-center text-xs text-muted hover:border-accent sm:mx-0">
              {photoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoPreview} alt="Passport photo preview" className="absolute inset-0 size-full object-cover" />
              ) : (
                <>
                  <ImagePlus className="size-6 text-accent" />
                  <span className="px-2 font-semibold">Passport photo</span>
                </>
              )}
              <input type="file" accept={DOC_RULES.PHOTO.accept} className="sr-only" onChange={(e) => pick("PHOTO", e.target.files?.[0])} />
            </label>
          )}
          <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Full name" htmlFor="fullName" required error={err("fullName")} className="sm:col-span-2">
              <Input id="fullName" name="fullName" defaultValue={t?.fullName} autoComplete="off" required />
            </Field>
            <Field label="NID number" htmlFor="nid" required error={err("nid")} hint="10, 13 or 17 digits">
              <Input id="nid" name="nid" inputMode="numeric" defaultValue={t?.nid} required />
            </Field>
            <Field label="Mobile number" htmlFor="phone" required error={err("phone")}>
              <Input id="phone" name="phone" type="tel" inputMode="tel" placeholder="01XXXXXXXXX" defaultValue={t?.phone} required />
            </Field>
            <Field label="Email" htmlFor="email" error={err("email")}>
              <Input id="email" name="email" type="email" defaultValue={t?.email ?? ""} />
            </Field>
            <Field label="Occupation" htmlFor="occupation">
              <Input id="occupation" name="occupation" defaultValue={t?.occupation ?? ""} />
            </Field>
            <Field label="Permanent address" htmlFor="permanentAddress" required error={err("permanentAddress")} className="sm:col-span-2">
              <Textarea id="permanentAddress" name="permanentAddress" rows={2} defaultValue={t?.permanentAddress} required />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title={`Family members (${members.length})`}
          description="People living with the primary tenant"
          action={
            <Button type="button" variant="outline" size="sm" onClick={() => setMembers((m) => [...m, { key: ++k, name: "", relation: "SPOUSE", phone: "" }])}>
              <Plus className="size-4" aria-hidden /> Add
            </Button>
          }
        />
        <CardBody className="flex flex-col gap-3">
          {members.length === 0 && <p className="text-sm text-muted">No family members added.</p>}
          {members.map((m, i) => (
            <div key={m.key} className="grid grid-cols-2 gap-3 rounded-xl bg-canvas p-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-end">
              <Field label="Name" htmlFor={`fm-name-${m.key}`} required className="col-span-2 sm:col-span-1" error={err(`familyMembers.${i}.name`)}>
                <Input id={`fm-name-${m.key}`} value={m.name} onChange={(e) => setMember(m.key, { name: e.target.value })} required />
              </Field>
              <Field label="Relation" htmlFor={`fm-rel-${m.key}`}>
                <Select id={`fm-rel-${m.key}`} value={m.relation} onChange={(e) => setMember(m.key, { relation: e.target.value as Relation })}>
                  {Object.entries(RELATION_LABEL).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Phone (optional)" htmlFor={`fm-phone-${m.key}`}>
                <Input id={`fm-phone-${m.key}`} type="tel" inputMode="tel" value={m.phone} onChange={(e) => setMember(m.key, { phone: e.target.value })} />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="col-span-2 w-full text-danger sm:col-span-1 sm:w-10"
                onClick={() => setMembers((ms) => ms.filter((x) => x.key !== m.key))}
                aria-label={`Remove ${m.name || "family member"}`}
              >
                <Trash2 className="size-4" />
                <span className="sm:hidden">Remove</span>
              </Button>
            </div>
          ))}
        </CardBody>
      </Card>

      {!tenant && (
        <Card>
          <CardHeader title="Documents" description="You can also upload these later from the tenant's page" />
          <CardBody className="grid gap-3 sm:grid-cols-2">
            <FilePick icon={FileText} label="Lease form" file={files.LEASE_FORM} accept={DOC_RULES.LEASE_FORM.accept} hint={DOC_RULES.LEASE_FORM.hint} onPick={(f) => pick("LEASE_FORM", f)} />
            <FilePick icon={ShieldCheck} label="Police verification form" file={files.POLICE_VERIFICATION} accept={DOC_RULES.POLICE_VERIFICATION.accept} hint={DOC_RULES.POLICE_VERIFICATION.hint} onPick={(f) => pick("POLICE_VERIFICATION", f)} />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Emergency contact & notes" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact name" htmlFor="emergencyContactName">
            <Input id="emergencyContactName" name="emergencyContactName" defaultValue={t?.emergencyContactName ?? ""} />
          </Field>
          <Field label="Contact phone" htmlFor="emergencyContactPhone" error={err("emergencyContactPhone")}>
            <Input id="emergencyContactPhone" name="emergencyContactPhone" type="tel" inputMode="tel" defaultValue={t?.emergencyContactPhone ?? ""} />
          </Field>
          <Field label="Notes" htmlFor="notes" className="sm:col-span-2">
            <Textarea id="notes" name="notes" rows={3} defaultValue={t?.notes ?? ""} />
          </Field>
        </CardBody>
      </Card>

      <div className="flex gap-2">
        <Button type="submit" size="lg" loading={saving} arrow className="flex-1 sm:flex-none">
          {tenant ? "Save changes" : "Add tenant"}
        </Button>
        <Button type="button" variant="ghost" size="lg" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FilePick({
  icon: Icon,
  label,
  file,
  accept,
  hint,
  onPick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  file?: File;
  accept: string;
  hint: string;
  onPick: (f: File | undefined) => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-4 transition-colors hover:border-accent",
        file ? "border-success/40 bg-success-bg/50" : "border-line bg-canvas",
      )}
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-accent shadow-sm">
        <Icon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted">{file ? file.name : hint}</span>
      </span>
      <input type="file" accept={accept} className="sr-only" onChange={(e) => onPick(e.target.files?.[0])} />
    </label>
  );
}
