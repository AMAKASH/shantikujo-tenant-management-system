"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "./field";

/** Search input synced to ?q= (debounced), so results are server-rendered. */
export function SearchBox({ placeholder, className }: { placeholder: string; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set("q", value.trim());
      else next.delete("q");
      if (next.toString() !== params.toString()) router.replace(`${pathname}?${next}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  }, [value, params, pathname, router]);

  return (
    <SearchInput
      className={className}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      aria-label={placeholder}
    />
  );
}
