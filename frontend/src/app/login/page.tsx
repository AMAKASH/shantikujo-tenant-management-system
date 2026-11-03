import type { Metadata } from "next";
import { Logo, LogoMark } from "@/components/logo";
import { LoginForm } from "./login-form";
import { BuildingIllustration } from "@/components/building-illustration";

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
        <BuildingIllustration className="absolute right-0 bottom-0 w-[85%] max-w-[620px]" />
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
