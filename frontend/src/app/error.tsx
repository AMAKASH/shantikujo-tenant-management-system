"use client";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-6 py-20">
      <h1 className="text-2xl font-extrabold text-primary">Something went wrong</h1>
      <Alert tone="error">{error.message || "Unexpected error"}</Alert>
      <Button onClick={reset} className="self-start">
        Try again
      </Button>
    </main>
  );
}
