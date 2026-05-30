# PROMPT 34 — Report Export (PDF + Excel) + Custom Report Builder
## BlinkOne · blinksone.com · TRD Requirements TR-68, TR-69, TR-70

---

## CONTEXT

The reports module at `frontend/src/components/reports/` has:
- `ReportsWorkspace.tsx` — shell with 4 tabs (Overview, Agent, Inbox, Team)
- `OverviewReport.tsx` — charts using Recharts
- `AgentReport.tsx`, `InboxReport.tsx`, `TeamReport.tsx`

**What's missing**:
1. No export button on any report view
2. No PDF generation
3. No Excel/CSV export
4. No custom date range picker (only preset tabs: 7d, 30d, 90d)

---

## PART A — Install Dependencies

```bash
cd frontend
npm install xlsx jspdf html2canvas date-fns
```

- `xlsx` — generate Excel files client-side
- `jspdf` + `html2canvas` — export visible chart/table as PDF
- `date-fns` — custom date range formatting

---

## PART B — Export Utilities

Create `frontend/src/lib/utils/export.ts`:

```typescript
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// ─── Excel Export ─────────────────────────────────────────────────────────────
export function exportToExcel(
  data: Record<string, unknown>[],
  filename: string,
  sheetName = 'Report'
) {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  // Auto-size columns
  const cols = Object.keys(data[0] ?? {}).map(key => ({
    wch: Math.max(key.length, ...data.map(r => String(r[key] ?? '').length)) + 2,
  }));
  ws['!cols'] = cols;

  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ─── CSV Export ──────────────────────────────────────────────────────────────
export function exportToCSV(
  data: Record<string, unknown>[],
  filename: string
) {
  const ws = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── PDF Export ──────────────────────────────────────────────────────────────
export async function exportToPDF(
  elementId: string,
  filename: string,
  title: string
) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [canvas.width / 2, canvas.height / 2],
  });

  // Header
  pdf.setFontSize(14);
  pdf.setFont('helvetica', 'bold');
  pdf.text(title, 20, 20);
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`Generated: ${new Date().toLocaleString()}  |  BlinkOne`, 20, 35);

  pdf.addImage(imgData, 'PNG', 0, 45, canvas.width / 2, canvas.height / 2);
  pdf.save(`${filename}.pdf`);
}
```

---

## PART C — ExportButton Component

Create `frontend/src/components/reports/ExportButton.tsx`:

```tsx
'use client';

import { useState, useRef } from 'react';
import { Download, FileSpreadsheet, FileText, X } from 'lucide-react';
import { exportToExcel, exportToCSV, exportToPDF } from '@/lib/utils/export';
import { cn } from '@/lib/utils/cn';

interface ExportButtonProps {
  /** ID of the DOM element to snapshot for PDF */
  reportElementId: string;
  /** Human-readable title for the PDF header */
  reportTitle: string;
  /** Filename prefix (without extension) */
  filename: string;
  /** Raw data rows for Excel/CSV export */
  data: Record<string, unknown>[];
  /** Optional extra className */
  className?: string;
}

export function ExportButton({
  reportElementId,
  reportTitle,
  filename,
  data,
  className,
}: ExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<'pdf' | 'excel' | 'csv' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  async function handleExport(type: 'pdf' | 'excel' | 'csv') {
    setLoading(type);
    setOpen(false);
    try {
      if (type === 'pdf') {
        await exportToPDF(reportElementId, filename, reportTitle);
      } else if (type === 'excel') {
        exportToExcel(data, filename, reportTitle);
      } else {
        exportToCSV(data, filename);
      }
    } catch (e) {
      console.error('Export failed:', e);
      alert('Export failed. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        disabled={!!loading}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50',
          className
        )}
      >
        {loading ? (
          <span className="size-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
        ) : (
          <Download className="w-4 h-4 text-gray-600" />
        )}
        {loading ? `Exporting ${loading.toUpperCase()}…` : 'Export'}
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute end-0 top-full mt-1 w-44 bg-white border border-gray-200 rounded-md shadow-lg z-50 py-1"
        >
          <button
            type="button"
            onClick={() => handleExport('pdf')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 text-start"
          >
            <FileText className="w-4 h-4 text-red-500" />
            Export as PDF
          </button>
          <button
            type="button"
            onClick={() => handleExport('excel')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 text-start"
          >
            <FileSpreadsheet className="w-4 h-4 text-green-600" />
            Export as Excel
          </button>
          <button
            type="button"
            onClick={() => handleExport('csv')}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-gray-50 text-start"
          >
            <FileText className="w-4 h-4 text-blue-500" />
            Export as CSV
          </button>
        </div>
      )}
    </div>
  );
}
```

---

## PART D — Custom Date Range Picker

Create `frontend/src/components/reports/DateRangePicker.tsx`:

```tsx
'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { cn } from '@/lib/utils/cn';

export interface DateRange {
  from: Date;
  to: Date;
  label: string;
}

const PRESETS: { label: string; days: number }[] = [
  { label: 'Today', days: 0 },
  { label: 'Yesterday', days: 1 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

interface Props {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

export function DateRangePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(format(value.from, 'yyyy-MM-dd'));
  const [customTo, setCustomTo] = useState(format(value.to, 'yyyy-MM-dd'));

  function applyPreset(days: number, label: string) {
    const to = endOfDay(new Date());
    const from = days === 0 ? startOfDay(new Date()) : startOfDay(subDays(new Date(), days));
    onChange({ from, to, label });
    setOpen(false);
  }

  function applyCustom() {
    const from = startOfDay(new Date(customFrom));
    const to = endOfDay(new Date(customTo));
    if (from > to) return;
    onChange({ from, to, label: `${customFrom} → ${customTo}` });
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm border border-gray-200 rounded-md bg-white hover:bg-gray-50"
      >
        <CalendarDays className="w-4 h-4 text-gray-600" />
        {value.label}
      </button>

      {open && (
        <div className="absolute end-0 top-full mt-1 w-64 bg-white border border-gray-200 rounded-md shadow-lg z-50 p-3">
          <div className="space-y-1 mb-3">
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p.days, p.label)}
                className={cn(
                  'w-full text-start px-2 py-1.5 text-sm rounded hover:bg-gray-50',
                  value.label === p.label && 'bg-blue-50 text-brand-primary font-medium'
                )}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="border-t pt-3">
            <p className="text-xs text-muted-foreground mb-2">Custom range</p>
            <div className="space-y-2">
              <input
                type="date"
                value={customFrom}
                onChange={e => setCustomFrom(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1"
              />
              <input
                type="date"
                value={customTo}
                onChange={e => setCustomTo(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1"
              />
              <button
                type="button"
                onClick={applyCustom}
                className="w-full text-sm bg-brand-primary text-white rounded py-1.5 hover:opacity-90"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

---

## PART E — Wire Export into OverviewReport

Open `frontend/src/components/reports/OverviewReport.tsx`. Update:

```tsx
import { ExportButton } from '@/components/reports/ExportButton';
import { DateRangePicker, type DateRange } from '@/components/reports/DateRangePicker';
import { subDays, startOfDay, endOfDay } from 'date-fns';

// Add state for custom date range
const [dateRange, setDateRange] = useState<DateRange>({
  from: startOfDay(subDays(new Date(), 7)),
  to: endOfDay(new Date()),
  label: 'Last 7 days',
});

// Prepare export data
const exportData = byAgent.map(a => ({
  'Agent Name': a.name,
  'Conversations': a.conversations_count,
  'Resolved': a.resolved_count,
  'Avg First Response': a.avg_first_response_time,
  'Avg Resolution Time': a.avg_resolution_time,
}));

// In the JSX, update the header row:
<div className="flex items-center justify-between gap-4 flex-wrap">
  <h1 className="text-lg font-semibold">Overview</h1>
  <div className="flex items-center gap-2">
    <DateRangePicker value={dateRange} onChange={setDateRange} />
    <ExportButton
      reportElementId="overview-report-content"
      reportTitle={`BlinkOne Overview Report — ${dateRange.label}`}
      filename={`blinkone-overview-${new Date().toISOString().slice(0, 10)}`}
      data={exportData}
    />
  </div>
</div>

// Wrap the report content in a div with the export ID:
<div id="overview-report-content">
  {/* existing charts and tables */}
</div>
```

Do the same for `AgentReport.tsx`, `InboxReport.tsx`, and `TeamReport.tsx` — each gets:
1. `<DateRangePicker>` replacing the `<ReportRangeTabs>` (keep tabs as shortcuts if desired)
2. `<ExportButton>` next to the date picker
3. A wrapping `id` on the main content div

---

## PART F — Backend: Report Data API Endpoints

The frontend reports pull data from Chatwoot's `/api/v2/accounts/:id/reports/agents/conversations` etc. Ensure the gateway proxies these. If custom reports beyond Chatwoot are needed, add to the gateway:

```javascript
// GET /api/reports/export — returns JSON rows for Excel/CSV
app.get('/api/reports/export', cwAuth, async (req, res) => {
  const { type = 'overview', from, to, format = 'json' } = req.query;
  const accountId = req.user?.account_id;

  // Fetch from Chatwoot reporting API
  const cwRes = await cwFetch(
    `/api/v2/accounts/${accountId}/reports/agents/conversations?since=${from}&until=${to}`,
    { headers: req.headers }
  );

  const data = await cwRes.json();
  return res.json({ data: data.data ?? [] });
});
```

---

## VERIFICATION CHECKLIST

- [ ] "Export" button appears on all 4 report tabs
- [ ] "Export as PDF" generates a PDF with chart screenshot and title header
- [ ] "Export as Excel" downloads `.xlsx` with properly formatted columns
- [ ] "Export as CSV" downloads `.csv`
- [ ] Custom date range picker appears and works (selecting custom dates re-fetches data)
- [ ] Preset quick ranges (7d, 30d, 90d) still work via the date picker
- [ ] Export works for all 4 tabs: Overview, Agent, Inbox, Team

---

## TRD REQUIREMENTS COVERED

| TRD ID | Requirement | Status After Prompt |
|--------|-------------|---------------------|
| TR-68  | Report export to PDF | ✅ DONE |
| TR-69  | Report export to Excel/CSV | ✅ DONE |
| TR-70  | Custom date range for reports | ✅ DONE |
