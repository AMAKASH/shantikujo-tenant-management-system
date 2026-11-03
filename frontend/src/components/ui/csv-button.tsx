"use client";

import { Download } from "lucide-react";
import { Button } from "./button";

type Cell = string | number | null | undefined;

export function CsvButton({ filename, header, rows }: { filename: string; header: string[]; rows: Cell[][] }) {
  function download() {
    const esc = (v: Cell) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [header, ...rows].map((r) => r.map(esc).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={download}>
      <Download className="size-4" aria-hidden /> CSV
    </Button>
  );
}
