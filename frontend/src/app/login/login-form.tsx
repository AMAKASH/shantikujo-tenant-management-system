"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { apiFetch, errorMessage } from "@/lib/api.client";

export function LoginForm({ next, expired }: { next?: string; expired: boolean }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);
    try {
      await apiFetch("/auth/login", { method: "POST", json: { email: form.get("email"), password: form.get("password") } });
      const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
      window.location.assign(dest);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {expired && !error && <Alert tone="warning">Your session has expired. Please sign in again.</Alert>}
      {error && <Alert tone="error">{error}</Alert>}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="username" required placeholder="you@example.com" />
      </Field>
      <Field label="Password" htmlFor="password">
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="pr-11" />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted hover:text-ink"
            aria-label={show ? "Hide password" : "Show password"}
          >
            {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>
      <Button type="submit" size="lg" loading={loading} arrow className="mt-2 w-full">
        Sign in
      </Button>
    </form>
  );
}
