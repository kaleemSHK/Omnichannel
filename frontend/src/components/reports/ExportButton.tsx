'use client';

/**
 * ExportButton — dropdown with PDF / Excel / CSV options.
 * Used on all 4 report tabs.
 */
import { useEffect, useRef, useState } from 'react';
import { Download, FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { exportSheetToExcel } from '@/lib/utils/exportXlsx';
import { exportToPdf, type PdfColumn } from '@/lib/utils/exportPdf';
import { downloadCsv } from '@/lib/utils/exportCsv';

export interface ExportRow {
  [key: string]: string | number;
}

export interface ExportSpec {
  /** Human-readable title for PDF header */
  title: string;
  /** Optional sub-heading (e.g. agent name) */
  subtitle?: string;
  /** Date range label displayed in PDF */
  dateLabel: string;
  /** Column definitions for PDF — key maps to data row field */
  columns: PdfColumn[];
  /** Raw rows */
  rows: ExportRow[];
  /** Filename prefix (without extension) */
  filename: string;
}

type ExportType = 'pdf' | 'excel' | 'csv';

interface Props {
  spec: ExportSpec;
  disabled?: boolean;
  className?: string;
}

export function ExportButton({ spec, disabled, className }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<ExportType | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function handleExport(type: ExportType) {
    setOpen(false);
    setLoading(type);
    try {
      if (type === 'pdf') {
        exportToPdf({
          title: spec.title,
          subtitle: spec.subtitle,
          dateLabel: spec.dateLabel,
          columns: spec.columns,
          rows: spec.rows,
        });
      } else if (type === 'excel') {
        // Map rows to header-keyed objects for xlsx
        const excelRows = spec.rows.map(row =>
          Object.fromEntries(
            spec.columns.map(col => [col.header, row[col.key] ?? '—']),
          ) as Record<string, string | number>,
        );
        exportSheetToExcel(excelRows, spec.filename, spec.title.slice(0, 31));
      } else {
        const csvRows = spec.rows.map(row =>
          Object.fromEntries(
            spec.columns.map(col => [col.header, row[col.key] ?? '—']),
          ) as Record<string, string | number>,
        );
        downloadCsv(csvRows, `${spec.filename}.csv`);
      }
    } catch (err) {
      console.error('[ExportButton] export failed:', err);
    } finally {
      setLoading(null);
    }
  }

  const isLoading = !!loading;

  return (
    <div ref={menuRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => !isLoading && setOpen(v => !v)}
        disabled={disabled || isLoading}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded-lg bg-white hover:bg-muted transition-colors',
          (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
        )}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {isLoading ? (
          <Loader2 size={13} className="animate-spin" />
        ) : (
          <Download size={13} className="text-muted-foreground" />
        )}
        {loading ? `Exporting ${loading.toUpperCase()}…` : 'Export'}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute end-0 top-full mt-1.5 w-44 bg-white border rounded-xl shadow-lg z-50 py-1.5"
        >
          <button
            role="menuitem"
            type="button"
            onClick={() => handleExport('pdf')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted text-start transition-colors"
          >
            <FileText size={14} className="text-red-500 shrink-0" />
            Export as PDF
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => handleExport('excel')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted text-start transition-colors"
          >
            <FileSpreadsheet size={14} className="text-green-600 shrink-0" />
            Export as Excel
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => handleExport('csv')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted text-start transition-colors"
          >
            <FileText size={14} className="text-blue-500 shrink-0" />
            Export as CSV
          </button>
        </div>
      )}
    </div>
  );
}
