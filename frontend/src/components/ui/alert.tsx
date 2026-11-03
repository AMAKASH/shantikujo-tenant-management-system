import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const styles = {
  success: ["bg-success-bg text-success", CheckCircle2],
  error: ["bg-danger-bg text-danger", AlertCircle],
  warning: ["bg-warning-bg text-warning", TriangleAlert],
  info: ["bg-primary-light text-primary", Info],
} as const;

export function Alert({
  tone = "info",
  className,
  children,
}: {
  tone?: keyof typeof styles;
  className?: string;
  children: React.ReactNode;
}) {
  const [cls, Icon] = styles[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium", cls, className)}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
