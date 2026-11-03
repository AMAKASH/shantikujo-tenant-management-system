"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api.client";

export function ArchiveButton({ tenantId, archived }: { tenantId: string; archived: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    if (!archived && !confirm("Archive this tenant? They will be hidden from current lists but their history is kept.")) return;
    setBusy(true);
    try {
      await apiFetch(`/tenants/${tenantId}/${archived ? "restore" : "archive"}`, { method: "POST" });
      toast.success(archived ? "Tenant restored" : "Tenant archived");
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button variant="ghost" onClick={run} loading={busy}>
      {archived ? <ArchiveRestore className="size-4" aria-hidden /> : <Archive className="size-4" aria-hidden />}
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}
