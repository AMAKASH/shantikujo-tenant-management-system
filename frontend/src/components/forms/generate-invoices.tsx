"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { apiFetch, errorMessage } from "@/lib/api.client";
import { periodLabel } from "@/lib/utils";

export function GenerateInvoicesButton({ period, variant = "button" }: { period: string; variant?: "button" | "tile" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const r = await apiFetch<{ created: number }>("/invoices/generate", { method: "POST", json: { period } });
      toast.success(
        r.created ? `${r.created} invoice${r.created > 1 ? "s" : ""} created for ${periodLabel(period, true)}` : `All invoices for ${periodLabel(period, true)} already exist`,
      );
      router.refresh();
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (variant === "tile") {
    return (
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="flex flex-col items-start gap-2 rounded-xl border border-line p-3 text-left text-sm font-semibold text-ink transition-colors hover:border-accent hover:bg-primary-light disabled:opacity-60"
      >
        <FilePlus2 className="size-5 text-accent" />
        {busy ? "Generating…" : "Generate invoices"}
      </button>
    );
  }
  return (
    <Button type="button" variant="outline" onClick={run} loading={busy}>
      <FilePlus2 className="size-4" aria-hidden /> Generate invoices
    </Button>
  );
}
