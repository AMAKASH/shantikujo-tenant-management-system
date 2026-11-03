import { cn } from "@/lib/utils";

/** STMS mark: a house with a window grid and rising bars, on a wave (from the brand board). */
export function LogoMark({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  const main = inverted ? "#FFFFFF" : "#0B2D6B";
  const accent = inverted ? "#FFFFFF" : "#2563EB";
  return (
    <svg viewBox="0 0 64 56" className={cn("shrink-0", className)} aria-hidden>
      <path d="M8 26 L30 6 L52 26" fill="none" stroke={main} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13 23 V44" stroke={main} strokeWidth="6" strokeLinecap="round" />
      <rect x="23" y="18" width="4" height="4" rx="0.6" fill={main} />
      <rect x="28.5" y="18" width="4" height="4" rx="0.6" fill={main} />
      <rect x="23" y="23.5" width="4" height="4" rx="0.6" fill={main} />
      <rect x="28.5" y="23.5" width="4" height="4" rx="0.6" fill={main} />
      <rect x="25" y="34" width="5" height="10" rx="1" fill={accent} />
      <rect x="33" y="28" width="5" height="16" rx="1" fill={accent} />
      <rect x="41" y="20" width="5" height="24" rx="1" fill={accent} />
      <path d="M2 50 C 18 40, 40 42, 62 47 L62 49 C 42 46, 20 46, 4 53 Z" fill={accent} />
    </svg>
  );
}

export function Logo({ className, inverted = false, subtitle = true }: { className?: string; inverted?: boolean; subtitle?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-9 w-10" inverted={inverted} />
      <span className="flex flex-col leading-none">
        <span className={cn("text-xl font-extrabold tracking-tight", inverted ? "text-white" : "text-primary")}>STMS</span>
        {subtitle && (
          <span className={cn("mt-0.5 text-[10px] font-medium", inverted ? "text-white/75" : "text-muted")}>
            Shantikunjo Tenant Management
          </span>
        )}
      </span>
    </span>
  );
}
