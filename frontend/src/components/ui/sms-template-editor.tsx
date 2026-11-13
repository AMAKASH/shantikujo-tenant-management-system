"use client";

import { useRef } from "react";
import { Plus } from "lucide-react";
import { Textarea } from "./field";
import { cn } from "@/lib/utils";

export interface SmsVariable {
  key: string;
  label: string;
}

/** Bill SMS (Settings → Bill SMS message). Keep in sync with BILL_SMS_VARS in backend lib/sms.ts. */
export const BILL_SMS_VARIABLES: SmsVariable[] = [
  { key: "month", label: "Bill month" },
  { key: "amount", label: "Amount due" },
  { key: "dueDay", label: "Due day" },
  { key: "units", label: "Electricity units" },
  { key: "electricity", label: "Electricity bill" },
  { key: "rent", label: "Rent" },
  { key: "total", label: "Invoice total" },
  { key: "name", label: "Tenant name" },
  { key: "apartment", label: "Apartment" },
];

/** Payment confirmation SMS. Keep in sync with PAYMENT_SMS_VARS in backend modules/sms/service.ts. */
export const PAYMENT_SMS_VARIABLES: SmsVariable[] = [
  { key: "name", label: "Tenant name" },
  { key: "amount", label: "Amount paid" },
  { key: "month", label: "Bill month(s)" },
  { key: "receipt", label: "Receipt no." },
  { key: "date", label: "Payment date" },
  { key: "due", label: "Still due" },
];

/** Hand-written SMS (SMS page). Filled per tenant; removed for typed-in numbers. */
export const CUSTOM_SMS_VARIABLES: SmsVariable[] = [
  { key: "name", label: "Tenant name" },
  { key: "apartment", label: "Apartment" },
  { key: "due", label: "Amount due" },
];

export const smsPartsOf = (chars: number) => (chars <= 70 ? 1 : Math.ceil(chars / 67));

/**
 * Bangla SMS textarea with clickable variable chips that insert {token} at the cursor,
 * a live character / SMS-part count and an optional required-token check.
 */
export function SmsTemplateEditor({
  id,
  value,
  onChange,
  variables,
  required,
  rows = 8,
  placeholder,
  countNote = "before filling in",
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  variables: SmsVariable[];
  /** Token keys the message must contain, e.g. ["amount"]. */
  required?: string[];
  rows?: number;
  placeholder?: string;
  countNote?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const chars = [...value].length;
  const missing = (required ?? []).filter((k) => !value.includes(`{${k}}`));

  function insert(key: string) {
    const el = ref.current;
    const token = `{${key}}`;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Insert a variable">
        {variables.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => insert(v.key)}
            title={`Insert {${v.key}}`}
            className={cn(
              "inline-flex min-h-9 items-center gap-1 rounded-lg border border-line bg-white px-2.5 text-xs font-semibold text-primary",
              "hover:border-primary hover:bg-primary-light",
              value.includes(`{${v.key}}`) && "border-primary/40 bg-primary-light/60",
            )}
          >
            <Plus className="size-3" aria-hidden />
            {v.label}
            <code className="font-mono text-[11px] font-normal text-muted">{`{${v.key}}`}</code>
          </button>
        ))}
      </div>
      <Textarea
        ref={ref}
        id={id}
        lang="bn"
        rows={rows}
        maxLength={1000}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="text-xs text-muted">
        {chars} characters {countNote} · about {smsPartsOf(chars)} SMS part{smsPartsOf(chars) === 1 ? "" : "s"} each (Bangla SMS: 70 characters per part)
        {missing.length > 0 && (
          <span className="ml-1 font-semibold text-danger">· must include {missing.map((k) => `{${k}}`).join(", ")}</span>
        )}
      </p>
    </div>
  );
}
