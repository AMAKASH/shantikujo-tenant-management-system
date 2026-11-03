import type { Metadata } from "next";
import { Logo, LogoMark } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; expired?: string }> }) {
  const { next, expired } = await searchParams;
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel (desktop) */}
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-[#eef4ff] via-[#e3edff] to-[#cfe0ff] lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Logo />
        <div className="relative z-10 max-w-md">
          <h1 className="text-5xl leading-[1.05] font-extrabold tracking-tight text-primary">STMS</h1>
          <p className="mt-3 text-xl font-medium text-primary/90">Shantikunjo Tenant Management System</p>
          <span className="mt-5 block h-1 w-14 rounded-full bg-accent" />
          <p className="mt-6 text-[15px] leading-relaxed text-ink/80">
            Manage tenants, apartments and payments with ease, efficiency and transparency.
          </p>
        </div>
        <BuildingIllustration />
      </section>

      {/* Form */}
      <section className="flex flex-col justify-center bg-white px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="mb-4 grid size-16 place-items-center rounded-2xl bg-primary shadow-lg">
              <LogoMark className="h-9 w-10" inverted />
            </span>
            <p className="text-2xl font-extrabold text-primary">STMS</p>
            <p className="text-sm text-muted">Shantikunjo Tenant Management System</p>
          </div>
          <h2 className="text-2xl font-extrabold tracking-tight text-primary">Welcome back</h2>
          <p className="mt-1 mb-6 text-[15px] text-muted">Sign in to manage your property.</p>
          <LoginForm next={next} expired={Boolean(expired)} />
        </div>
      </section>
    </main>
  );
}

function BuildingIllustration() {
  return (
    <svg viewBox="0 0 520 300" className="pointer-events-none absolute right-0 bottom-0 w-[85%] max-w-[620px]" aria-hidden>
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
