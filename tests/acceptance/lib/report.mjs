import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export function renderHtml(results, meta) {
  const rows = results
    .map(
      (r) => `<tr class="${r.status}">
      <td>${r.trId}</td><td>${escapeHtml(r.title)}</td>
      <td><strong>${r.status}</strong></td>
      <td>${escapeHtml(r.detail || '')}</td>
      <td>${r.durationMs ?? ''}</td>
    </tr>`,
    )
    .join('\n');
  const pass = results.filter((r) => r.status === 'PASS').length;
  const fail = results.filter((r) => r.status === 'FAIL').length;
  const skip = results.filter((r) => r.status === 'SKIP').length;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>BlinkOne Acceptance Report</title>
<style>
body{font-family:Inter,system-ui,sans-serif;margin:2rem;color:#37352f}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{border:0.5px solid #d3d1cb;padding:8px;text-align:left}
th{background:#f7f7f5}
.PASS{color:#12b76a}.FAIL{color:#f04438}.SKIP{color:#7a7a72}
summary{margin:1rem 0}
</style></head><body>
<h1>BlinkOne Acceptance Report</h1>
<p>Generated: ${meta.generatedAt} · ${pass} pass · ${fail} fail · ${skip} skip</p>
<table><thead><tr><th>TR</th><th>Requirement</th><th>Status</th><th>Detail</th><th>ms</th></tr></thead>
<tbody>${rows}</tbody></table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function writeReport(results, outDir) {
  mkdirSync(outDir, { recursive: true });
  const meta = { generatedAt: new Date().toISOString() };
  const html = renderHtml(results, meta);
  const jsonPath = join(outDir, 'acceptance-results.json');
  const htmlPath = join(outDir, 'acceptance-report.html');
  writeFileSync(jsonPath, JSON.stringify({ meta, results }, null, 2));
  writeFileSync(htmlPath, html);
  return { jsonPath, htmlPath };
}
