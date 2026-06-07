import { parseJsonFromLlm } from '../llm/openai-adapter.js';
import { chatCompletions, resolveModels } from '../llm/gateway.js';
import { getPool } from '../db.js';
import { queryRag, resolveDefaultCollectionId } from '../rag/service.js';
import { PROMPTS } from './prompts.js';
import { redact } from '../pii/redactor.js';
import {
  isGreetingMessage,
  isValidCustomerMessage,
  isValidRagQuery,
  lastCustomerUtterance,
  recentConversationText,
} from './message-filter.js';
import { getAgentScript } from '../agent-scripts.js';

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
function isTocOrNoiseLine(line) {
  const t = line.trim();
  if (t.length < 30) return true;
  if (/^(\d+\.)+\d*\s/.test(t)) return true;
  if (/^[A-Z]\.\d+/i.test(t)) return true;
  if (/^appendix\b/i.test(t)) return true;
  if (/^table of contents/i.test(t)) return true;
  if (/\.{4,}/.test(t)) return true;
  if (/^\d+\s*$/.test(t)) return true;
  return false;
}

function keywordsFromText(text) {
  return String(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2);
}

function scoreLineForQuestion(line, keywords) {
  const lower = line.toLowerCase();
  let score = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) score += 3;
  }
  if (line.length >= 60 && line.length <= 500) score += 1;
  return score;
}

/** Build a short agent-ready reply from RAG chunks (no OpenAI). */
function buildKbDraftReply(customerQuestion, chunks) {
  const keywords = keywordsFromText(customerQuestion);
  const lines = chunks
    .flatMap((c) => String(c.content ?? '').split(/\n+/))
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !isTocOrNoiseLine(l));

  const ranked = lines
    .map((line) => ({ line, score: scoreLineForQuestion(line, keywords) }))
    .sort((a, b) => b.score - a.score);

  let picked = ranked.filter((r) => r.score > 0).slice(0, 2).map((r) => r.line);
  if (!picked.length) {
    for (const chunk of chunks) {
      const content = String(chunk.content ?? '');
      const sentences = content.split(/(?<=[.!?])\s+/);
      const hit = sentences.find(
        (s) =>
          keywords.some((kw) => s.toLowerCase().includes(kw)) &&
          s.length >= 40 &&
          !isTocOrNoiseLine(s),
      );
      if (hit) {
        picked = [hit.trim()];
        break;
      }
    }
  }
  if (!picked.length) {
    picked = lines.filter((l) => l.length >= 50 && l.length <= 450).slice(0, 2);
  }
  if (!picked.length) {
    return '';
  }

  const body = picked.join(' ').replace(/\s+/g, ' ').trim();
  const trimmed = body.length > 420 ? `${body.slice(0, 417)}…` : body;
  const q = customerQuestion.replace(/\s+/g, ' ').trim().slice(0, 100);
  return (
    `Thank you for your question.\n\n` +
    `Regarding "${q}": ${trimmed}\n\n` +
    `Please let me know if you would like more detail.`
  );
}

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

function buildLocalSummary(text, conversation_id) {
  const lines = String(text ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const userLines = lines.filter((l) => /^user:\s*/i.test(l));
  const agentLines = lines.filter((l) => /^assistant:\s*/i.test(l));
  const lastUser = userLines.at(-1)?.replace(/^user:\s*/i, '').trim() ?? '';
  const lastAgent = agentLines.at(-1)?.replace(/^assistant:\s*/i, '').trim() ?? '';

  const summaryParts = [];
  if (conversation_id != null) summaryParts.push(`Conversation #${conversation_id}`);
  summaryParts.push(
    `${userLines.length} customer message(s) and ${agentLines.length} agent reply(ies).`,
  );
  if (lastUser) summaryParts.push(`Latest customer message: "${lastUser.slice(0, 160)}".`);

  const key_points = [
    lastUser ? `Customer said: ${lastUser.slice(0, 120)}` : null,
    lastAgent ? `Agent replied: ${lastAgent.slice(0, 120)}` : null,
    userLines.length > 1 ? `${userLines.length} customer messages in thread` : null,
  ].filter(Boolean);

  return {
    summary: summaryParts.join(' '),
    key_points,
    suggested_labels: [],
    sentiment: 'neutral',
  };
}

export async function summarizeConversation(tenantId, { conversation_id, text }) {
  const input = String(text ?? '').trim();
  if (!input) {
    return {
      summary: 'No conversation messages to summarize yet.',
      key_points: [],
      suggested_labels: [],
      sentiment: 'neutral',
    };
  }

  const models = await resolveModels(tenantId);
  const { content } = await chatCompletions(tenantId, {
    messages: [
      { role: 'system', content: PROMPTS.summarize },
      { role: 'user', content: redact(input) },
    ],
    model: models.default,
    maxTokens: 600,
  });
  const parsed = parseAssistJson(content, ASSIST_STUB.summarize);
  const isStub =
    String(content).trim().startsWith('[STUB]') ||
    parsed.summary === ASSIST_STUB.summarize.summary;

  if (isStub) {
    return buildLocalSummary(input, conversation_id);
  }

  return {
    summary: parsed.summary ?? '',
    key_points: parsed.key_points ?? parsed.keyPoints ?? [],
    suggested_labels: parsed.suggested_labels ?? [],
    sentiment: parsed.sentiment ?? 'neutral',
  };
}

export async function suggestReply(
  tenantId,
  { conversation_id, text, messages, collection_id, tone = 'professional' },
) {
  const customerQuestion =
    lastCustomerUtterance(messages) ||
    (isValidCustomerMessage(text) ? String(text ?? '').trim() : '');

  if (!isValidCustomerMessage(customerQuestion)) {
    return {
      suggestions: [],
      suggestion: '',
      confidence: 0,
      ragSources: [],
      rag_citations: [],
    };
  }

  const script = getAgentScript(tenantId);
  const openingLine = script.openingLine || ASSIST_STUB.suggest.suggestions[0].text;
  const useRag = isValidRagQuery(customerQuestion);

  const models = await resolveModels(tenantId);
  const conversationText = recentConversationText(messages) || customerQuestion;

  const colId = collection_id ?? (await resolveDefaultCollectionId(tenantId));
  let ragContext = '';
  let ragSources = [];
  let ragChunks = [];

  if (colId && useRag) {
    const { chunks } = await queryRag(tenantId, {
      collection_id: colId,
      query: customerQuestion,
      top_k: 3,
      min_score: 0.1,
    });
    ragChunks = chunks;
    ragContext = chunks.map((c) => c.content).join('\n---\n');
    ragSources = chunks.map((c) => ({
      id: c.chunk_id,
      title: c.metadata?.filename ?? 'Knowledge',
      excerpt: c.content.slice(0, 280),
      score: c.score,
      collectionId: colId,
    }));
  }

  const { content } = await chatCompletions(tenantId, {
    messages: [
      { role: 'system', content: PROMPTS.suggest(tone) },
      {
        role: 'user',
        content: `${ragContext ? `Knowledge:\n${ragContext}\n\n` : ''}Customer message: ${redact(customerQuestion)}\n\nRecent conversation:\n${redact(conversationText)}`,
      },
    ],
    model: models.default,
    maxTokens: 800,
  });
  const parsed = parseAssistJson(content, ASSIST_STUB.suggest);
  const first = parsed.suggestions?.[0];
  let suggestionText = first?.text ?? '';

  const isStub = !suggestionText || String(content).trim().startsWith('[STUB]');
  if (isStub && ragChunks.length && useRag) {
    suggestionText = buildKbDraftReply(customerQuestion, ragChunks);
  } else if (isStub && (isGreetingMessage(customerQuestion) || !useRag)) {
    suggestionText = openingLine;
  } else if (isStub) {
    suggestionText = '';
  }

  return {
    suggestions: parsed.suggestions ?? [],
    suggestion: suggestionText,
    confidence: suggestionText ? 0.85 : 0,
    ragSources,
    rag_citations: first?.rag_citations ?? [],
  };
}
