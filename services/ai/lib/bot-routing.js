/**
 * Bot Routing Rules Engine — Sprint 2 A01
 *
 * Provides configurable per-call, per-tenant routing rules that determine
 * when a voicebot should hand off to a human agent and which queue to use.
 *
 * Rule evaluation replaces the hard-coded intent/misunderstanding logic in
 * fsm.js. Rules are evaluated in descending priority order; first match wins.
 *
 * Trigger types:
 *   intent               — fires when LLM returns a listed intent
 *   keyword              — fires when transcript contains any listed substring
 *   misunderstanding_count — fires when count >= threshold
 *   sentiment            — fires when LLM detects the listed sentiment label
 *
 * Action types:
 *   transfer_to_agent    — hand off to queueKey (default: 'default')
 *   end_call             — terminate the call
 */

import { randomUUID } from 'node:crypto';
import { getPool } from './db.js';

// ─── Default rules (used when no config exists for a tenant) ─────────────────

export const DEFAULT_RULES = [
  {
    id: 'default-complaint',
    name: 'Complaint → support queue',
    enabled: true,
    priority: 10,
    trigger: { type: 'intent', intents: ['complaint'] },
    action: {
      type: 'transfer_to_agent',
      queueKey: 'support',
      message: 'جاري تحويلك إلى قسم الشكاوى، يرجى الانتظار.',
    },
  },
  {
    id: 'default-billing',
    name: 'Billing inquiry → billing queue',
    enabled: true,
    priority: 8,
    trigger: { type: 'intent', intents: ['billing_inquiry'] },
    action: {
      type: 'transfer_to_agent',
      queueKey: 'billing',
      message: 'جاري تحويلك إلى قسم الفواتير، يرجى الانتظار.',
    },
  },
  {
    id: 'default-human-keyword',
    name: 'Human request keyword',
    enabled: true,
    priority: 9,
    trigger: {
      type: 'keyword',
      keywords: ['agent', 'human', 'operator', 'موظف', 'تحويل', 'إنسان'],
    },
    action: {
      type: 'transfer_to_agent',
      queueKey: 'default',
      message: 'جاري تحويلك إلى أحد موظفينا، يرجى الانتظار.',
    },
  },
  {
    id: 'default-misunderstanding',
    name: 'Max misunderstandings fallback',
    enabled: true,
    priority: 5,
    trigger: { type: 'misunderstanding_count', threshold: 3 },
    action: {
      type: 'transfer_to_agent',
      queueKey: 'default',
      message: 'جاري تحويلك إلى أحد موظفينا، يرجى الانتظار.',
    },
  },
];

// ─── File-store fallback ──────────────────────────────────────────────────────

/** In-process map for file-store mode: tenantId → rules[] */
const fileConfigs = new Map();

// ─── Persistence ──────────────────────────────────────────────────────────────

/**
 * Load routing config for a tenant.
 * Returns { name, isActive, rules } — always resolves (falls back to defaults).
 */
export async function loadConfig(tenantId) {
  const p = getPool();
  if (p) {
    const { rows } = await p.query(
      'SELECT name, is_active, rules FROM bot_routing_configs WHERE tenant_id = $1',
      [tenantId],
    );
    if (rows.length) {
      return {
        name: rows[0].name,
        isActive: rows[0].is_active,
        rules: Array.isArray(rows[0].rules) ? rows[0].rules : JSON.parse(rows[0].rules ?? '[]'),
      };
    }
  } else {
    const cached = fileConfigs.get(tenantId);
    if (cached) return cached;
  }
  // Return defaults
  return { name: 'Default', isActive: true, rules: DEFAULT_RULES };
}

/**
 * Save (upsert) routing config for a tenant.
 * @param {string} tenantId
 * @param {{ name?: string, isActive?: boolean, rules: Array }} config
 */
export async function saveConfig(tenantId, config) {
  const name = config.name?.trim() || 'Default';
  const isActive = config.isActive !== false;
  const rules = Array.isArray(config.rules) ? config.rules : DEFAULT_RULES;

  const p = getPool();
  if (p) {
    await p.query(
      `INSERT INTO bot_routing_configs (tenant_id, name, is_active, rules)
       VALUES ($1, $2, $3, $4::jsonb)
       ON CONFLICT (tenant_id) DO UPDATE SET
         name = $2, is_active = $3, rules = $4::jsonb, updated_at = now()`,
      [tenantId, name, isActive, JSON.stringify(rules)],
    );
  } else {
    fileConfigs.set(tenantId, { name, isActive, rules });
  }
  return { name, isActive, rules };
}

/**
 * Reset a tenant's config to the built-in defaults.
 */
export async function resetToDefaults(tenantId) {
  return saveConfig(tenantId, { name: 'Default', isActive: true, rules: DEFAULT_RULES });
}

// ─── Rule evaluation ──────────────────────────────────────────────────────────

/**
 * Evaluate routing rules against the current turn result.
 *
 * @param {object} session — voice_sessions row (has misunderstanding_count, max_misunderstandings)
 * @param {object} turn    — { intent, transcript, misunderstanding_count, sentiment? }
 * @param {Array}  rules   — from loadConfig().rules
 * @returns {{ matched: boolean, action?: object, rule?: object }}
 */
export function evaluateHandoff(session, turn, rules) {
  if (!Array.isArray(rules) || !rules.length) return { matched: false };

  const activeRules = rules
    .filter((r) => r.enabled !== false)
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

  const transcript = (turn.transcript ?? '').toLowerCase();
  const intent = turn.intent ?? 'unrecognized';
  const miscCount = turn.misunderstanding_count ?? 0;
  const sentiment = turn.sentiment ?? null;

  for (const rule of activeRules) {
    const { trigger } = rule;
    let matched = false;

    switch (trigger?.type) {
      case 'intent':
        matched = Array.isArray(trigger.intents) && trigger.intents.includes(intent);
        break;

      case 'keyword':
        matched =
          Array.isArray(trigger.keywords) &&
          trigger.keywords.some((kw) => transcript.includes(kw.toLowerCase()));
        break;

      case 'misunderstanding_count':
        matched = miscCount >= (trigger.threshold ?? session.max_misunderstandings ?? 3);
        break;

      case 'sentiment':
        matched = sentiment != null && sentiment === trigger.sentiment;
        break;

      default:
        break;
    }

    if (matched) return { matched: true, action: rule.action, rule };
  }

  return { matched: false };
}

// ─── Validation ───────────────────────────────────────────────────────────────

const TRIGGER_TYPES = new Set(['intent', 'keyword', 'misunderstanding_count', 'sentiment']);
const ACTION_TYPES = new Set(['transfer_to_agent', 'end_call']);

/**
 * Validate a rules array. Returns an error string or null.
 * @param {unknown} rules
 * @returns {string|null}
 */
export function validateRules(rules) {
  if (!Array.isArray(rules)) return 'rules must be an array';
  for (let i = 0; i < rules.length; i++) {
    const r = rules[i];
    if (!r?.trigger?.type) return `rule[${i}]: trigger.type required`;
    if (!TRIGGER_TYPES.has(r.trigger.type))
      return `rule[${i}]: trigger.type must be one of ${[...TRIGGER_TYPES].join(', ')}`;
    if (!r?.action?.type) return `rule[${i}]: action.type required`;
    if (!ACTION_TYPES.has(r.action.type))
      return `rule[${i}]: action.type must be one of ${[...ACTION_TYPES].join(', ')}`;
    if (r.trigger.type === 'intent' && !Array.isArray(r.trigger.intents))
      return `rule[${i}]: trigger.intents[] required for intent trigger`;
    if (r.trigger.type === 'keyword' && !Array.isArray(r.trigger.keywords))
      return `rule[${i}]: trigger.keywords[] required for keyword trigger`;
    if (r.trigger.type === 'misunderstanding_count' && typeof r.trigger.threshold !== 'number')
      return `rule[${i}]: trigger.threshold (number) required for misunderstanding_count trigger`;
    if (r.action.type === 'transfer_to_agent' && !r.action.queueKey?.trim())
      return `rule[${i}]: action.queueKey required for transfer_to_agent`;
  }
  return null;
}

/**
 * Convenience: ensure each rule has an id.
 * @param {Array} rules
 * @returns {Array}
 */
export function normaliseRules(rules) {
  return (rules ?? []).map((r) => ({ ...r, id: r.id || randomUUID() }));
}
