#!/usr/bin/env node
/**
 * BlinkOne acceptance gauntlet — TR-matrix report for LABBIK sign-off.
 * Usage: RUN_ACCEPTANCE=1 node tests/acceptance/runner.mjs
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cfg } from './lib/config.mjs';
import { writeReport } from './lib/report.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const matrix = JSON.parse(readFileSync(join(__dirname, 'tr-matrix.json'), 'utf8'));
const runAll = process.argv.includes('--all-tr');

const seen = new Set();
const results = [];

async function runEntry(entry) {
  if (seen.has(entry.trId)) return;
  seen.add(entry.trId);
  const mod = await import(pathToFileURL(join(__dirname, entry.module)).href);
  if (!mod.run) {
    results.push({ trId: entry.trId, title: entry.title, status: 'SKIP', detail: 'No run()' });
    return;
  }
  try {
    const out = await mod.run();
    results.push({
      trId: entry.trId,
      title: entry.title,
      status: out.status || 'FAIL',
      detail: out.detail || '',
      durationMs: out.durationMs,
      artifact: out.artifact,
    });
  } catch (e) {
    results.push({ trId: entry.trId, title: entry.title, status: 'FAIL', detail: e.message });
  }
}

for (const entry of matrix) {
  if (runAll || entry.priority === 'featured' || entry.priority === 'smoke') {
    await runEntry(entry);
  }
}

const { htmlPath, jsonPath } = writeReport(results, cfg.artifactsDir);
const fail = results.filter((r) => r.status === 'FAIL').length;
console.log(`Report: ${htmlPath}`);
console.log(`JSON:  ${jsonPath}`);
console.log(`PASS ${results.filter((r) => r.status === 'PASS').length} · FAIL ${fail} · SKIP ${results.filter((r) => r.status === 'SKIP').length}`);
process.exit(fail > 0 ? 1 : 0);
