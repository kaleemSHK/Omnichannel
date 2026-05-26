/**
 * PDF export — opens a formatted print window and triggers window.print().
 * Zero dependencies; works in all modern browsers.
 * The user selects "Save as PDF" in the native print dialog.
 */

export interface PdfColumn {
  header: string;
  key: string;
  align?: 'left' | 'right' | 'center';
}

export interface PdfExportOptions {
  title: string;
  subtitle?: string;
  dateLabel: string;
  columns: PdfColumn[];
  rows: Record<string, string | number>[];
}

const BRAND_BLUE = '#0B5FFF';

function buildPrintHtml(opts: PdfExportOptions): string {
  const { title, subtitle, dateLabel, columns, rows } = opts;

  const thead = `<tr>${columns.map(c => `<th class="${c.align ?? 'left'}">${c.header}</th>`).join('')}</tr>`;
  const tbody = rows
    .map(
      row =>
        `<tr>${columns
          .map(c => `<td class="${c.align ?? 'left'}">${row[c.key] ?? '—'}</td>`)
          .join('')}</tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>${title}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
    font-size: 12px;
    color: #111;
    padding: 24px 32px;
  }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid ${BRAND_BLUE}; padding-bottom: 12px; }
  .header-left h1 { font-size: 18px; font-weight: 700; color: ${BRAND_BLUE}; margin-bottom: 4px; }
  .header-left .subtitle { font-size: 11px; color: #555; }
  .header-right { text-align: right; font-size: 10px; color: #888; line-height: 1.6; }
  .brand { font-size: 13px; font-weight: 700; color: ${BRAND_BLUE}; }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  thead tr { background: #EFF6FF; }
  th { padding: 7px 10px; font-weight: 600; font-size: 11px; color: #374151; border-bottom: 2px solid #DBEAFE; }
  td { padding: 6px 10px; font-size: 11px; color: #374151; border-bottom: 1px solid #F3F4F6; }
  tr:last-child td { border-bottom: none; }
  tr:nth-child(even) td { background: #F9FAFB; }
  .left { text-align: left; }
  .right { text-align: right; }
  .center { text-align: center; }
  .footer { margin-top: 20px; font-size: 10px; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 8px; display: flex; justify-content: space-between; }
  @media print {
    @page { margin: 1.5cm; size: A4 landscape; }
    body { padding: 0; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; }
  }
</style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>${title}</h1>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
    </div>
    <div class="header-right">
      <div class="brand">BlinkOne</div>
      <div>Period: ${dateLabel}</div>
      <div>Generated: ${new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</div>
    </div>
  </div>

  <table>
    <thead>${thead}</thead>
    <tbody>${tbody.length ? tbody : `<tr><td colspan="${columns.length}" style="text-align:center;padding:20px;color:#9CA3AF">No data for this period</td></tr>`}</tbody>
  </table>

  <div class="footer">
    <span>BlinkOne — Contact Centre Platform</span>
    <span>${rows.length} row${rows.length !== 1 ? 's' : ''}</span>
  </div>
</body>
</html>`;
}

export function exportToPdf(opts: PdfExportOptions): void {
  const html = buildPrintHtml(opts);
  const printWin = window.open('', '_blank', 'width=1000,height=700,scrollbars=yes');
  if (!printWin) {
    // Fallback: alert user
    alert('Please allow pop-ups to export PDF, or use "Print" (Ctrl+P) from the browser menu.');
    return;
  }
  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  printWin.focus();
  // Short delay lets the browser render fonts/styles before print dialog
  setTimeout(() => {
    printWin.print();
    // Close after print dialog (user may cancel — don't close immediately)
    printWin.addEventListener('afterprint', () => printWin.close());
  }, 350);
}
