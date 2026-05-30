/**
 * Next.js standalone server only serves files under .next/standalone/.
 * After `next build`, copy .next/static and public into the standalone tree.
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const standaloneDir = join(root, '.next/standalone');
const staticSrc = join(root, '.next/static');
const staticDest = join(standaloneDir, '.next/static');
const publicSrc = join(root, 'public');
const publicDest = join(standaloneDir, 'public');

if (!existsSync(standaloneDir)) {
  console.warn('[sync-standalone-static] No .next/standalone — skip');
  process.exit(0);
}

if (!existsSync(staticSrc)) {
  console.error('[sync-standalone-static] Missing .next/static — run next build first');
  process.exit(1);
}

mkdirSync(join(standaloneDir, '.next'), { recursive: true });
cpSync(staticSrc, staticDest, { recursive: true });
if (existsSync(publicSrc)) {
  cpSync(publicSrc, publicDest, { recursive: true });
}
console.log('[sync-standalone-static] Copied static + public into .next/standalone');
