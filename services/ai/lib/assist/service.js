import { parseJsonFromLlm } from '../llm/openai-adapter.js';

const ASSIST_STUB = {
  classify: {
    category: 'inquiry',
    priority: 'medium',
    language: 'en',
    intent: 'general',
    confidence: 0.5,
  },
  sentiment: { score: 0, label: 'neutral', emotions: [] },
  summarize: {
    summary: 'Summary unavailable — configure OpenAI API key in AI settings.',
    key_points: [],
    suggested_labels: [],
  },
  suggest: {
    suggestions: [
      {
        text: 'Thank you for contacting us. How may I assist you today?',
        language: 'en',
        rag_citations: [],
      },
    ],
  },
};

function parseAssistJson(text, fallback) {
  const trimmed = (text || '').trim();
  if (trimmed.startsWith('[STUB]')) return fallback;
  try {
    return parseJsonFromLlm(text);
  } catch {
    return fallback;
  }
}
import { chatCompletions, resolveModels } from '../llm/gateway.js';
import { getPool } from '../db.js';
import { queryRag } from '../rag/service.js';
import { PROMPTS } from './prompts.js';
import { redact } from '../pii/redactor.js';

export async function classifyTicket(tenantId, { message_sample }) {
  const models = await resolveModels(tenantId);
  const { content } = await chatCompletions(tenantId, {
    messages: [
      { role: 'system', content: PROMPTS.classify },
      { role: 'user', content: redact(message_sample || '') },
    ],
    model: models.fast,
    maxTokens: 300,
  });
  return parseAssistJson(content, ASSIST_STUB.classify);
}

export async function analyzeSentiment(tenantId, { text, conversation_id, message_id }) {
  const models = await resolveModels(tenantId);
  const { content } = await chatCompletions(tenantId, {
    messages: [
      { role: 'system', content: PROMPTS.sentiment },
      { role: 'user', content: redact(text) },
    ],
    model: models.fast,
    maxTokens: 200,
  });
  const result = parseAssistJson(content, ASSIST_STUB.sentiment);
  if (conversation_id != null && message_id != null) {
    const p = getPool();
    if (p) {
      await p.query(
        `INSERT INTO message_signals (tenant_id, conversation_id, message_id, sentiment_score, sentiment_label, emotions)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb)
         ON CONFLICT (message_id) DO UPDATE SET sentiment_score = $4, sentiment_label = $5, emotions = $6`,
        [
          tenantId,
          Number(conversation_id),
          Number(message_id),
          result.score ?? 0,
          result.label ?? 'neutral',
          JSON.stringify(result.emotions ?? []),
        ],
      );
    }
  }
  return result;
}

export async function summarizeConversation(tenantId, { conversation_id, text }) {
  const models = await resolveModels(tenantId);
  const { content } = await chatCompletions(tenantId, {
    messages: [
      { role: 'system', content: PROMPTS.summarize },
      { role: 'user', content: redact(text || `Conversation ${conversation_id}`) },
    ],
    model: models.default,
    maxTokens: 600,
  });
  return parseAssistJson(content, ASSIST_STUB.summarize);
}

export async function suggestReply(tenantId, { conversation_id, text, collection_id, tone = 'professional' }) {
  const models = await resolveModels(tenantId);
  let ragContext = '';
  if (collection_id && text) {
    const { chunks } = await queryRag(tenantId, { collection_id, query: text.slice(0, 500), top_k: 3 });
    ragContext = chunks.map((c) => c.content).join('\n---\n');
  }
  const { content } = await chatCompletions(tenantId, {
    messages: [
      { role: 'system', content: PROMPTS.suggest(tone) },
      {
        role: 'user',
        content: `${ragContext ? `Knowledge:\n${ragContext}\n\n` : ''}Conversation:\n${redact(text || String(conversation_id))}`,
      },
    ],
    model: models.default,
    maxTokens: 800,
  });
  return parseAssistJson(content, ASSIST_STUB.suggest);
}
