#!/usr/bin/env node
/**
 * Append npm license summaries to THIRD_PARTY_LICENSES.md (run from repo root).
 */
import { execSync } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
let out = readFileSync(join(root, 'THIRD_PARTY_LICENSES.md'), 'utf8');

try {
  const licenses = execSync('pnpm licenses list --prod --json', { cwd: root, encoding: 'utf8' });
  out += `\n\n## pnpm prod licenses (generated ${new Date().toISOString()})\n\n\`\`\`json\n${licenses.slice(0, 50000)}\n\`\`\`\n`;
} catch (e) {
  out += `\n\n_Generation failed: ${e.message}. Run \`pnpm install\` first._\n`;
}

writeFileSync(join(root, 'THIRD_PARTY_LICENSES.md'), out);
console.log('Updated THIRD_PARTY_LICENSES.md');
