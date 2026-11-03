import { cn } from "@/lib/utils";

/** Apartment blocks with trees, used on the login hero and the printed invoice. */
export function BuildingIllustration({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 520 300" className={cn("pointer-events-none", className)} aria-hidden>
      <ellipse cx="300" cy="300" rx="320" ry="40" fill="#bcd2fb" opacity="0.6" />
      <g fill="#ffffff" stroke="#9db8e8" strokeWidth="1.5">
        <rect x="150" y="60" width="150" height="240" rx="4" />
        <rect x="300" y="110" width="120" height="190" rx="4" />
        <rect x="90" y="150" width="70" height="150" rx="4" />
      </g>
      <g fill="#0B2D6B" opacity="0.85">
        {Array.from({ length: 6 }).flatMap((_, r) =>
          Array.from({ length: 4 }).map((__, c) => (
            <rect key={`a${r}${c}`} x={165 + c * 33} y={80 + r * 35} width="20" height="22" rx="2" />
          )),
        )}
        {Array.from({ length: 5 }).flatMap((_, r) =>
          Array.from({ length: 3 }).map((__, c) => (
            <rect key={`b${r}${c}`} x={315 + c * 35} y={128 + r * 33} width="20" height="20" rx="2" />
          )),
        )}
        {Array.from({ length: 4 }).flatMap((_, r) =>
          Array.from({ length: 2 }).map((__, c) => (
            <rect key={`c${r}${c}`} x={102 + c * 28} y={168 + r * 30} width="16" height="18" rx="2" />
          )),
        )}
      </g>
      <g fill="#2f7d4f">
        <circle cx="70" cy="262" r="26" />
        <circle cx="455" cy="252" r="34" />
        <circle cx="490" cy="270" r="22" />
      </g>
      <g fill="#7a5a3a">
        <rect x="67" y="270" width="6" height="30" />
        <rect x="452" y="270" width="6" height="30" />
      </g>
    </svg>
  );
}
