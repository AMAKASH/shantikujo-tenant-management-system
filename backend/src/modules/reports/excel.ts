import ExcelJS from "exceljs";

/** Brand colours (ARGB) from the style guide. */
const C = {
  primary: "FF0B2D6B",
  primaryLight: "FFE8EEF8",
  zebra: "FFF7F9FC",
  line: "FFD9DEE7",
  muted: "FF6B7280",
  white: "FFFFFFFF",
  success: "FFDCFCE7",
  successInk: "FF166534",
  warning: "FFFEF3C7",
  warningInk: "FF92400E",
  danger: "FFFEE2E2",
  dangerInk: "FF991B1B",
};

export const MONEY = '"৳"#,##0.00;[Red]-"৳"#,##0.00;"–"';
const PERCENT = "0.0%";

export type ColType = "text" | "money" | "int" | "percent" | "status";

export interface Column<T> {
  header: string;
  width: number;
  type?: ColType;
  value: (row: T) => string | number | null | undefined;
  /** Sum this column in the totals row (money/int columns default to true). */
  total?: boolean;
}

export interface SheetSpec<T> {
  name: string;
  title: string;
  subtitle: string;
  columns: Column<T>[];
  rows: T[];
  totalsLabel?: string;
  /** Extra colouring per cell, e.g. aging buckets. Return an ARGB fill or null. */
  cellFill?: (row: T, colIndex: number, value: unknown) => string | null;
}

const thin = { style: "thin" as const, color: { argb: C.line } };
const border = { top: thin, bottom: thin, left: thin, right: thin };
const fill = (argb: string): ExcelJS.Fill => ({ type: "pattern", pattern: "solid", fgColor: { argb } });

const STATUS: Record<string, { bg: string; ink: string; label: string }> = {
  PAID: { bg: C.success, ink: C.successInk, label: "Paid" },
  PARTIAL: { bg: C.warning, ink: C.warningInk, label: "Partial" },
  UNPAID: { bg: C.primaryLight, ink: C.primary, label: "Unpaid" },
  OVERDUE: { bg: C.danger, ink: C.dangerInk, label: "Overdue" },
  VOID: { bg: C.zebra, ink: C.muted, label: "Void" },
};

const colLetter = (n: number) => {
  let s = "";
  for (; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
};

/**
 * One formatted sheet: a title and subtitle, a brand-coloured header with filters and a frozen pane,
 * zebra rows, ৳ number formats, coloured status cells and a bold totals row with SUM formulas.
 */
export function addTableSheet<T>(wb: ExcelJS.Workbook, spec: SheetSpec<T>) {
  const ws = wb.addWorksheet(spec.name, {
    views: [{ state: "frozen", ySplit: 4, showGridLines: false }],
    pageSetup: { paperSize: 9, orientation: spec.columns.length > 7 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    headerFooter: { oddFooter: "&L&8Shantikunjo Tenant Management System&R&8Page &P of &N" },
  });
  const n = spec.columns.length;
  const last = colLetter(n);
  ws.columns = spec.columns.map((c) => ({ width: c.width }));

  ws.mergeCells(`A1:${last}1`);
  const title = ws.getCell("A1");
  title.value = spec.title;
  title.font = { size: 15, bold: true, color: { argb: C.primary } };
  ws.getRow(1).height = 24;

  ws.mergeCells(`A2:${last}2`);
  const sub = ws.getCell("A2");
  sub.value = spec.subtitle;
  sub.font = { size: 10, color: { argb: C.muted } };

  const header = ws.getRow(4);
  spec.columns.forEach((c, i) => {
    const cell = header.getCell(i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: C.white } };
    cell.fill = fill(C.primary);
    cell.border = border;
    cell.alignment = { vertical: "middle", horizontal: isNumeric(c.type) ? "right" : "left", wrapText: true };
  });
  header.height = 22;

  const first = 5;
  spec.rows.forEach((row, r) => {
    const xr = ws.getRow(first + r);
    spec.columns.forEach((c, i) => {
      const cell = xr.getCell(i + 1);
      const v = c.value(row);
      cell.border = border;
      if (r % 2 === 1) cell.fill = fill(C.zebra);
      if (c.type === "status" && typeof v === "string") {
        const s = STATUS[v];
        cell.value = s?.label ?? v;
        if (s) {
          cell.fill = fill(s.bg);
          cell.font = { bold: true, color: { argb: s.ink } };
        }
        cell.alignment = { horizontal: "center" };
        return;
      }
      cell.value = v ?? null;
      applyFormat(cell, c.type);
      const extra = spec.cellFill?.(row, i, v);
      if (extra) cell.fill = fill(extra);
    });
  });

  const lastData = first + spec.rows.length - 1;
  if (spec.rows.length > 0) {
    const tr = ws.getRow(lastData + 1);
    spec.columns.forEach((c, i) => {
      const cell = tr.getCell(i + 1);
      const sum = c.total ?? (c.type === "money" || c.type === "int");
      if (i === 0) cell.value = spec.totalsLabel ?? "Total";
      else if (sum) {
        const L = colLetter(i + 1);
        cell.value = { formula: `SUM(${L}${first}:${L}${lastData})` };
        applyFormat(cell, c.type);
      }
      cell.font = { bold: true, color: { argb: C.primary } };
      cell.fill = fill(C.primaryLight);
      cell.border = { top: { style: "medium", color: { argb: C.primary } }, bottom: thin, left: thin, right: thin };
    });
    tr.height = 20;
  }

  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: Math.max(4, lastData), column: n } };
  return ws;
}

/** A two-column key/value block (summary sheet). */
export function addSummarySheet(
  wb: ExcelJS.Workbook,
  name: string,
  title: string,
  subtitle: string,
  sections: { heading: string; rows: [string, number | string, ColType?][] }[],
) {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false }] });
  ws.columns = [{ width: 30 }, { width: 20 }, { width: 12 }];
  ws.mergeCells("A1:C1");
  ws.getCell("A1").value = title;
  ws.getCell("A1").font = { size: 15, bold: true, color: { argb: C.primary } };
  ws.getRow(1).height = 24;
  ws.mergeCells("A2:C2");
  ws.getCell("A2").value = subtitle;
  ws.getCell("A2").font = { size: 10, color: { argb: C.muted } };

  let r = 4;
  for (const s of sections) {
    const h = ws.getRow(r++);
    ws.mergeCells(`A${h.number}:B${h.number}`);
    h.getCell(1).value = s.heading;
    h.getCell(1).font = { bold: true, color: { argb: C.white } };
    h.getCell(1).fill = fill(C.primary);
    for (const [label, value, type] of s.rows) {
      const row = ws.getRow(r++);
      row.getCell(1).value = label;
      row.getCell(1).border = border;
      const v = row.getCell(2);
      v.value = value;
      v.border = border;
      applyFormat(v, type ?? (typeof value === "number" ? "money" : "text"));
    }
    r++;
  }
  return ws;
}

function isNumeric(t?: ColType) {
  return t === "money" || t === "int" || t === "percent";
}

function applyFormat(cell: ExcelJS.Cell, type?: ColType) {
  if (type === "money") cell.numFmt = MONEY;
  else if (type === "int") cell.numFmt = "#,##0";
  else if (type === "percent") cell.numFmt = PERCENT;
  if (isNumeric(type)) cell.alignment = { horizontal: "right" };
}

export function newWorkbook() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "STMS";
  wb.created = new Date();
  return wb;
}

export const AGING = { d30: C.warning, d60: "FFFDE68A", d90: "FFFECACA", d90plus: C.danger };
