import { forwardRef } from "react";
import Link from "next/link";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover shadow-sm",
  secondary: "bg-accent text-white hover:bg-accent-hover shadow-sm",
  outline: "border border-primary/80 text-primary bg-white hover:bg-primary-light",
  ghost: "text-ink hover:bg-primary-light/70",
  danger: "bg-danger text-white hover:bg-red-700 shadow-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-lg",
  md: "h-11 px-4 text-[15px] gap-2 rounded-xl",
  lg: "h-12 px-6 text-base gap-2 rounded-xl",
  icon: "h-10 w-10 rounded-xl",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", className?: string) {
  return cn(
    "inline-flex select-none items-center justify-center font-semibold whitespace-nowrap transition-colors disabled:pointer-events-none disabled:opacity-50",
    variants[variant],
    sizes[size],
    className,
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  arrow?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, arrow, className, children, disabled, ...props },
  ref,
) {
  return (
    <button ref={ref} className={buttonClass(variant, size, className)} disabled={disabled || loading} {...props}>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
      {arrow && !loading && <ArrowRight className="size-4" aria-hidden />}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  arrow,
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
      {arrow && <ArrowRight className="size-4" aria-hidden />}
    </Link>
  );
}
