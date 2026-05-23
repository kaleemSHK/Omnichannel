import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../../..');

export async function run() {
  const start = Date.now();
  const required = [
    'docs/blinkone/HANDOVER_CHECKLIST.md',
    'docs/blinkone/KT_PLAN.md',
    'BlinkOne-Commercial-Proposal.md',
    'BlinkOne-Deliverables-v1.0/README.md',
    'docs/blinkone/SECURITY_REVIEW.md',
    'docs/blinkone/PERFORMANCE_BASELINE.md',
  ];
  const missing = required.filter((p) => !existsSync(join(root, p)));
  return {
    status: missing.length ? 'FAIL' : 'PASS',
    detail: missing.length ? `Missing: ${missing.join(', ')}` : 'Handover docs present',
    durationMs: Date.now() - start,
  };
}
