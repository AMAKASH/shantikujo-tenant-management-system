import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn, initials } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  back,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: { href: string; label: string };
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5 sm:mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-primary"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-primary sm:text-[28px]">{title}</h1>
          {description && <p className="mt-1 text-[15px] text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-primary-light text-primary">
        <Icon className="size-6" />
      </div>
      <p className="font-bold text-primary">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Avatar({ name, photoId, size = 40, className }: { name: string; photoId?: string | null; size?: number; className?: string }) {
  const style = { width: size, height: size };
  if (photoId) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/documents/${photoId}/file`}
        alt=""
        style={style}
        className={cn("shrink-0 rounded-full border border-line object-cover", className)}
      />
    );
  }
  return (
    <span
      style={style}
      className={cn(
        "grid shrink-0 place-items-center rounded-full bg-primary-light font-bold text-primary",
        size >= 64 ? "text-xl" : "text-sm",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function DescList({ items, className }: { items: [string, React.ReactNode][]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs font-semibold tracking-wide text-muted uppercase">{k}</dt>
          <dd className="mt-0.5 break-words text-[15px] font-medium text-ink">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "primary" | "danger" | "success" | "warning";
}) {
  const iconTone = {
    primary: "bg-primary-light text-primary",
    danger: "bg-danger-bg text-danger",
    success: "bg-success-bg text-success",
    warning: "bg-warning-bg text-warning",
  }[tone];
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted">{label}</p>
        <span className={cn("grid size-9 shrink-0 place-items-center rounded-xl", iconTone)}>
          <Icon className="size-[18px]" />
        </span>
      </div>
      <p className="tabular mt-1 text-[22px] leading-tight font-extrabold text-primary sm:text-[26px]">{value}</p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}
