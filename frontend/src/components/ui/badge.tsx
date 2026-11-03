import { cn } from "@/lib/utils";

type Tone = "success" | "danger" | "warning" | "info" | "neutral" | "primary";

const tones: Record<Tone, string> = {
  success: "bg-success-bg text-success",
  danger: "bg-danger-bg text-danger",
  warning: "bg-warning-bg text-warning",
  info: "bg-primary-light text-accent",
  primary: "bg-primary text-white",
  neutral: "bg-gray-100 text-muted",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const INVOICE_TONE: Record<string, [Tone, string]> = {
  PAID: ["success", "Paid"],
  PARTIAL: ["warning", "Partially paid"],
  UNPAID: ["info", "Unpaid"],
  OVERDUE: ["danger", "Overdue"],
  VOID: ["neutral", "Void"],
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const [tone, label] = INVOICE_TONE[status] ?? ["neutral", status];
  return <Badge tone={tone}>{label}</Badge>;
}

const APT_TONE: Record<string, [Tone, string]> = {
  OCCUPIED: ["success", "Occupied"],
  VACANT: ["info", "Vacant"],
  MAINTENANCE: ["warning", "Maintenance"],
};

export function ApartmentStatusBadge({ status }: { status: string }) {
  const [tone, label] = APT_TONE[status] ?? ["neutral", status];
  return <Badge tone={tone}>{label}</Badge>;
}

const LEASE_TONE: Record<string, [Tone, string]> = {
  ACTIVE: ["success", "Active"],
  NOTICE: ["warning", "Notice given"],
  ENDED: ["neutral", "Ended"],
};

export function LeaseStatusBadge({ status }: { status: string }) {
  const [tone, label] = LEASE_TONE[status] ?? ["neutral", status];
  return <Badge tone={tone}>{label}</Badge>;
}
