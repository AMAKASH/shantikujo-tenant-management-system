import { forwardRef } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

const control =
  "w-full rounded-xl border border-line bg-white px-3.5 text-[15px] text-ink placeholder:text-muted/80 transition-colors " +
  "focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15 disabled:bg-gray-50 disabled:text-muted " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:ring-danger/15";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
        {required && <span className="ml-0.5 text-danger" aria-hidden>*</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { prefix?: string }>(
  function Input({ className, prefix, ...props }, ref) {
    if (prefix) {
      return (
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-sm font-semibold text-muted">
            {prefix}
          </span>
          <input ref={ref} className={cn(control, "h-11 pl-8", className)} {...props} />
        </div>
      );
    }
    return <input ref={ref} className={cn(control, "h-11", className)} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(control, "min-h-[88px] py-2.5", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(control, "h-11 appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink" aria-hidden />
    </div>
  );
});

export function SearchInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input type="search" className={cn(control, "h-11 pl-10")} {...props} />
    </div>
  );
}
