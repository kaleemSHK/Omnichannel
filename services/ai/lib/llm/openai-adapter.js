import { redactMessages } from '../pii/redactor.js';

/** Deterministic bag-of-words vector so RAG works without OpenAI (dev/demo). */
function stubEmbedVector(text) {
  const vec = new Float32Array(1536);
  const words = String(text)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2);
  for (const w of words) {
    let h = 0;
    for (let i = 0; i < w.length; i++) h = ((h << 5) - h + w.charCodeAt(i)) | 0;
    const idx = Math.abs(h) % 1536;
    vec[idx] += 1;
  }
  let norm = 0;
  for (let i = 0; i < vec.length; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  return Array.from(vec, (v) => v / norm);
}

const DEFAULT_BASE = () => (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

export function createOpenAiAdapter({ apiKey, baseUrl = DEFAULT_BASE() }) {
  if (!apiKey?.trim()) {
    return {
      name: 'stub',
      async complete({ messages, model, maxTokens = 1000 }) {
        const last = messages.filter((m) => m.role === 'user').pop()?.content ?? '';
        return { content: `[STUB] ${last.slice(0, 120)}`, usage: { prompt_tokens: 0, completion_tokens: 0 } };
      },
      async embed(texts) {
        return texts.map((text) => stubEmbedVector(text));
      },
    };
  }

  return {
    name: 'openai',
    async complete({ messages, model, maxTokens = 1000, stream = false }) {
      const body = {
        model: model || process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
        messages: redactMessages(messages),
        max_tokens: maxTokens,
        stream,
      };
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
      }
      const j = await res.json();
      return {
        content: j.choices?.[0]?.message?.content ?? '',
        usage: j.usage ?? { prompt_tokens: 0, completion_tokens: 0 },
      };
    },
    async embed(texts, model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small') {
      const res = await fetch(`${baseUrl}/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, input: texts.map((t) => String(t).slice(0, 8000)) }),
      });
      if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}`);
      const j = await res.json();
      return (j.data ?? []).sort((a, b) => a.index - b.index).map((d) => d.embedding);
    },
  };
}

export function parseJsonFromLlm(text) {
  const trimmed = (text || '').trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fence ? fence[1] : trimmed;
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('LLM did not return valid JSON');
  }
}
