/** Whitelisted JSON-Logic subset — no eval (Prompt 6). */

const ALLOWED_OPS = new Set([
  '==', '===', '!=', '!==', '>', '>=', '<', '<=',
  'and', 'or', '!', '!!', 'in', 'var', 'if', 'cat',
]);

const TRIGGER_WHITELIST = new Set([
  'sla.warning',
  'sla.breached',
  'conversation.unassigned_for_minutes',
  'conversation.no_response_for_minutes',
  'conversation.priority_changed_to',
  'call.abandoned_in_queue',
  'call.long_wait',
]);

const ACTION_WHITELIST = new Set([
  'reassign_to_team',
  'reassign_to_agent',
  'change_priority',
  'add_label',
  'post_internal_note',
  'send_webhook',
  'notify_slack',
  'bump_queue_priority',
]);

export function validateTrigger(trigger) {
  return TRIGGER_WHITELIST.has(trigger);
}

export function validateActions(actions) {
  if (!Array.isArray(actions)) return false;
  return actions.every((a) => ACTION_WHITELIST.has(a?.type));
}

export function validateLogic(node, depth = 0) {
  if (depth > 12) return false;
  if (node === true || node === false || node === null) return true;
  if (typeof node === 'number' || typeof node === 'string') return true;
  if (Array.isArray(node)) return node.every((n) => validateLogic(n, depth + 1));
  if (typeof node !== 'object') return false;
  const keys = Object.keys(node);
  if (keys.length !== 1) return false;
  const op = keys[0];
  if (!ALLOWED_OPS.has(op)) return false;
  const val = node[op];
  if (Array.isArray(val)) return val.every((n) => validateLogic(n, depth + 1));
  return validateLogic(val, depth + 1);
}

function getVar(data, path) {
  const parts = path.split('.');
  let cur = data;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
}

export function applyLogic(logic, data) {
  if (!validateLogic(logic)) throw Object.assign(new Error('Invalid JSON-Logic'), { code: 'VALIDATION_ERROR' });
  return evalNode(logic, data);
}

function evalNode(node, data) {
  if (node === true) return true;
  if (node === false) return false;
  if (typeof node === 'number' || typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map((n) => evalNode(n, data));
  const op = Object.keys(node)[0];
  const args = node[op];
  switch (op) {
    case 'var': {
      const path = Array.isArray(args) ? args[0] : args;
      const d = getVar(data, path);
      return d === undefined && Array.isArray(args) ? args[1] : d;
    }
    case '==': return evalNode(args[0], data) == evalNode(args[1], data);
    case '===': return evalNode(args[0], data) === evalNode(args[1], data);
    case '!=': return evalNode(args[0], data) != evalNode(args[1], data);
    case '>': return evalNode(args[0], data) > evalNode(args[1], data);
    case '>=': return evalNode(args[0], data) >= evalNode(args[1], data);
    case '<': return evalNode(args[0], data) < evalNode(args[1], data);
    case '<=': return evalNode(args[0], data) <= evalNode(args[1], data);
    case 'and': return args.every((a) => evalNode(a, data));
    case 'or': return args.some((a) => evalNode(a, data));
    case '!': return !evalNode(args[0], data);
    case 'in': {
      const needle = evalNode(args[0], data);
      const hay = evalNode(args[1], data);
      return Array.isArray(hay) && hay.includes(needle);
    }
    default:
      return false;
  }
}

export function simulateRule(rule, eventPayload) {
  const eventCtx =
    eventPayload?.event && typeof eventPayload.event === 'object' && !Array.isArray(eventPayload.event)
      ? eventPayload.event
      : {};
  const data = {
    event: eventCtx,
    conversation: eventPayload?.conversation ?? {},
    customer: eventPayload?.customer ?? {},
    agent: eventPayload?.agent ?? {},
  };
  const conditionsPassed = applyLogic(rule.conditions ?? true, data);
  const actions = conditionsPassed ? (rule.actions ?? []) : [];
  return { conditionsPassed, actions, dryRun: true };
}
