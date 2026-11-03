"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, FileText, ImageIcon, Loader2, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { apiFetch, errorMessage } from "@/lib/api.client";
import type { Doc, DocType } from "@/lib/types";
import { DOC_LABEL, formatDate } from "@/lib/utils";
import { DOC_RULES, uploadDocument } from "./upload";

const SLOTS: { type: DocType; icon: React.ComponentType<{ className?: string }>; required?: boolean }[] = [
  { type: "PHOTO", icon: ImageIcon, required: true },
  { type: "LEASE_FORM", icon: FileText, required: true },
  { type: "POLICE_VERIFICATION", icon: ShieldCheck, required: true },
  { type: "NID_COPY", icon: FileText },
  { type: "OTHER", icon: FileText },
];

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

export function DocumentsPanel({ tenantId, documents }: { tenantId: string; documents: Doc[] }) {
  return (
    <ul className="divide-y divide-line">
      {SLOTS.map((slot) => {
        const docs = documents.filter((d) => d.type === slot.type);
        return <DocSlot key={slot.type} tenantId={tenantId} slot={slot} docs={docs} />;
      })}
    </ul>
  );
}

function DocSlot({ tenantId, slot, docs }: { tenantId: string; slot: (typeof SLOTS)[number]; docs: Doc[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const single = slot.type === "PHOTO" || slot.type === "LEASE_FORM" || slot.type === "POLICE_VERIFICATION";

  async function onFile(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      await uploadDocument(tenantId, slot.type, file);
      toast.success(`${DOC_LABEL[slot.type]} uploaded`);
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(doc: Doc) {
    if (!confirm(`Delete ${doc.fileName}? This cannot be undone.`)) return;
    try {
      await apiFetch(`/documents/${doc.id}`, { method: "DELETE" });
      toast.success("Document deleted");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <li className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-light text-primary">
          <slot.icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold">
            {DOC_LABEL[slot.type]}
            {slot.required && docs.length === 0 && <Badge tone="warning">Missing</Badge>}
          </p>
          <p className="text-xs text-muted">{DOC_RULES[slot.type].hint}</p>
        </div>
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold text-primary hover:bg-primary-light disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {docs.length && single ? "Replace" : "Upload"}
        </button>
        <input ref={input} type="file" accept={DOC_RULES[slot.type].accept} className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
      {docs.map((d) => (
        <div key={d.id} className="ml-13 flex items-center gap-2 rounded-lg bg-canvas px-3 py-2 text-sm">
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{d.fileName}</span>
            <span className="block text-xs text-muted">
              {kb(d.size)} · {formatDate(d.uploadedAt)}
            </span>
          </span>
          <a href={`/api/documents/${d.id}/file`} target="_blank" rel="noreferrer" className="rounded-lg p-2 text-primary hover:bg-white" aria-label={`View ${d.fileName}`}>
            <Eye className="size-4" />
          </a>
          <button type="button" onClick={() => remove(d)} className="rounded-lg p-2 text-danger hover:bg-white" aria-label={`Delete ${d.fileName}`}>
            <Trash2 className="size-4" />
          </button>
        </div>
      ))}
    </li>
  );
}
