import { FileSpreadsheet } from "lucide-react";
import { buttonClass } from "./button";

/**
 * Downloads a formatted .xlsx built by the API (GET /api/reports/export). A plain link, not next/link:
 * the browser downloads the file with the session cookie (same origin).
 */
export function ExcelButton({ tab, params = {} }: { tab: "monthly" | "dues" | "yearly"; params?: Record<string, string | number> }) {
  const qs = new URLSearchParams({ tab, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  return (
    <a href={`/api/reports/export?${qs}`} download className={buttonClass("outline", "sm", "print:hidden")} title="Download as an Excel workbook">
      <FileSpreadsheet className="size-4" aria-hidden /> Excel
    </a>
  );
}
