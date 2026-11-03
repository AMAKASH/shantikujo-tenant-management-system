"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RetryButton() {
  return (
    <Button className="mt-6" onClick={() => (window.location.pathname === "/offline" ? window.location.assign("/dashboard") : window.location.reload())}>
      <RotateCw className="size-4" aria-hidden /> Try again
    </Button>
  );
}
