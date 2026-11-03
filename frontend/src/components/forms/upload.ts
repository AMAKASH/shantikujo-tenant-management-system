"use client";

import type { Doc, DocType } from "@/lib/types";

export const DOC_RULES: Record<DocType, { accept: string; maxMb: number; hint: string }> = {
  PHOTO: { accept: "image/jpeg,image/png,image/webp", maxMb: 2, hint: "JPG, PNG or WebP, up to 2 MB" },
  LEASE_FORM: { accept: "application/pdf", maxMb: 10, hint: "PDF, up to 10 MB" },
  POLICE_VERIFICATION: { accept: "application/pdf", maxMb: 10, hint: "PDF, up to 10 MB" },
  NID_COPY: { accept: "image/jpeg,image/png,image/webp,application/pdf", maxMb: 5, hint: "Image or PDF, up to 5 MB" },
  OTHER: { accept: "image/jpeg,image/png,image/webp,application/pdf", maxMb: 10, hint: "Image or PDF, up to 10 MB" },
};

export function checkFile(type: DocType, file: File): string | null {
  const rule = DOC_RULES[type];
  if (!rule.accept.split(",").includes(file.type)) return `Wrong file type. ${rule.hint}.`;
  if (file.size > rule.maxMb * 1024 * 1024) return `File is too large. ${rule.hint}.`;
  return null;
}

export async function uploadDocument(tenantId: string, type: DocType, file: File): Promise<Doc> {
  const problem = checkFile(type, file);
  if (problem) throw new Error(problem);
  const body = new FormData();
  body.append("type", type);
  body.append("file", file);
  const res = await fetch(`/api/tenants/${tenantId}/documents`, { method: "POST", body });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? `Upload failed (${res.status})`);
  return json as Doc;
}
