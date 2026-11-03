"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, errorMessage } from "@/lib/api.client";

export function DeletePaymentButton({ id, number }: { id: string; number: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="rounded-lg p-2 text-muted hover:bg-danger-bg hover:text-danger"
      aria-label={`Delete payment ${number}`}
      onClick={async () => {
        if (!confirm(`Delete payment ${number}? The bills it paid will become unpaid again.`)) return;
        try {
          await apiFetch(`/payments/${id}`, { method: "DELETE" });
          toast.success("Payment deleted");
          router.refresh();
        } catch (e) {
          toast.error(errorMessage(e));
        }
      }}
    >
      <Trash2 className="size-4" />
    </button>
  );
}
