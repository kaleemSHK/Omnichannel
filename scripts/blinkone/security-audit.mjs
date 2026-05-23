#!/usr/bin/env node
/**
 * Prompt 11 — run npm audit across sidecars; print Trivy commands for images.
 */
import { execSync } from 'node:child_process';
import { readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const services = readdirSync(join(root, 'services')).filter((d) =>
  existsSync(join(root, 'services', d, 'package.json')),
);

console.log('=== BlinkOne security audit ===\n');

if (existsSync(join(root, 'package.json'))) {
  try {
    execSync('pnpm audit --audit-level=high', { cwd: root, stdio: 'inherit' });
  } catch {
    console.warn('pnpm audit reported issues (review above)');
  }
}

for (const svc of services) {
  const dir = join(root, 'services', svc);
  console.log(`\n--- ${svc} ---`);
  try {
    execSync('npm audit --audit-level=high', { cwd: dir, stdio: 'inherit' });
  } catch {
    console.warn(`${svc}: npm audit findings`);
  }
}

console.log('\n=== Trivy (run manually) ===');
console.log('trivy image blinkone/chatwoot:v4.13.0-ce-b1');
for (const svc of services) {
  console.log(`docker compose build ${svc} && trivy image blinkone-${svc}`);
}
console.log('\n=== OWASP ZAP ===');
console.log('zap-baseline.py -t $FRONTEND_URL');
console.log('\n=== truffleHog ===');
console.log('trufflehog git file://.');
