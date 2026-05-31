/**
 * Per-tenant agent script checklists for the conversation assist panel.
 * Stored as JSON on disk (no DB required).
 */

import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const DATA_DIR = process.env.AGENT_SCRIPTS_DIR || path.join(process.cwd(), 'data', 'agent-scripts');
const FILE = path.join(DATA_DIR, 'scripts.json');

export const DEFAULT_AGENT_SCRIPT = {
  openingLine: 'Thank you for contacting us. How can I help you today?',
  steps: [
    { id: '1', label: 'Greet customer', description: 'Introduce yourself and confirm customer identity', done: false },
    { id: '2', label: 'Verify account', description: 'Ask for account number or email to pull up record', done: false },
    { id: '3', label: 'Understand issue', description: "Listen and paraphrase the customer's concern", done: false },
    { id: '4', label: 'Resolve or escalate', description: 'Apply solution from knowledge base or escalate to tier 2', done: false },
    { id: '5', label: 'Close & survey', description: 'Confirm resolution and offer satisfaction survey', done: false },
  ],
};

function ensureDir() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll() {
  ensureDir();
  if (!fs.existsSync(FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(data) {
  ensureDir();
  fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getAgentScript(tenantId) {
  const key = String(tenantId || 'default');
  const row = readAll()[key];
  if (!row?.steps?.length) return { ...DEFAULT_AGENT_SCRIPT, steps: DEFAULT_AGENT_SCRIPT.steps.map((s) => ({ ...s })) };
  return {
    openingLine: row.openingLine ?? DEFAULT_AGENT_SCRIPT.openingLine,
    steps: row.steps.map((s) => ({
      id: String(s.id ?? randomUUID()),
      label: String(s.label ?? ''),
      description: String(s.description ?? ''),
      done: false,
    })),
  };
}

export function saveAgentScript(tenantId, payload) {
  const key = String(tenantId || 'default');
  const steps = (payload.steps ?? []).map((s, i) => ({
    id: String(s.id ?? `step-${i + 1}`),
    label: String(s.label ?? '').trim(),
    description: String(s.description ?? '').trim(),
  })).filter((s) => s.label);
  const next = {
    openingLine: String(payload.openingLine ?? '').trim() || DEFAULT_AGENT_SCRIPT.openingLine,
    steps: steps.length ? steps : DEFAULT_AGENT_SCRIPT.steps,
    updatedAt: new Date().toISOString(),
  };
  const all = readAll();
  all[key] = next;
  writeAll(all);
  return next;
}
