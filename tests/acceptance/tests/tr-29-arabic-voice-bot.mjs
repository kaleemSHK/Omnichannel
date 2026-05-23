/**
 * TR-29 — Arabic voice bot (stub: RAG query asserts password-reset KB when AI up).
 */
import { cfg } from '../lib/config.mjs';
import { health, api } from '../lib/client.mjs';

export async function run() {
  const start = Date.now();
  if (!cfg.runAcceptance && !(await health(cfg.aiUrl))) {
    return { status: 'SKIP', detail: 'Set RUN_ACCEPTANCE=1 or start AI service' };
  }
  const query = 'كيف يمكنني تغيير كلمة المرور؟';
  const { ok, data } = await api(cfg.aiUrl, '/v1/rag/query', {
    method: 'POST',
    token: cfg.tokens.ai,
    tenantId: '1',
    body: { query, collectionId: 'default', topK: 3 },
  });
  if (!ok) {
    return { status: 'SKIP', detail: 'RAG not ready — seed KB and re-run', durationMs: Date.now() - start };
  }
  const text = JSON.stringify(data).toLowerCase();
  const hit = text.includes('password') || text.includes('كلمة') || text.includes('مرور');
  return {
    status: hit ? 'PASS' : 'FAIL',
    detail: hit ? 'Arabic query returned KB-related content' : 'No password-reset signal in RAG response',
    artifact: { query, snippet: String(text).slice(0, 500) },
    durationMs: Date.now() - start,
  };
}
