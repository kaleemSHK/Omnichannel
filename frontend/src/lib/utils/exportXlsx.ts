/**
 * Excel (.xlsx) export — uses the `xlsx` package (SheetJS CE).
 * Zero runtime state; pure function.
 */
import * as XLSX from 'xlsx';

export interface ExcelSheet {
  name: string;
  rows: Record<string, string | number>[];
}

/** Export one or more sheets into a single .xlsx file and trigger download. */
export function exportToExcel(sheets: ExcelSheet[], filename: string): void {
  if (!sheets.length) return;
  const wb = XLSX.utils.book_new();

  for (const { name, rows } of sheets) {
    if (!rows.length) continue;
    const ws = XLSX.utils.json_to_sheet(rows);

    // Auto-width: longest value in each column
    const keys = Object.keys(rows[0]);
    ws['!cols'] = keys.map(k => ({
      wch: Math.min(
        60,
        Math.max(k.length + 2, ...rows.map(r => String(r[k] ?? '').length + 1)),
      ),
    }));

    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31)); // sheet name max 31 chars
  }

  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/** Single-sheet convenience wrapper (keeps call-site tidy). */
export function exportSheetToExcel(
  rows: Record<string, string | number>[],
  filename: string,
  sheetName = 'Report',
): void {
  exportToExcel([{ name: sheetName, rows }], filename);
}
