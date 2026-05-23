export const PROMPTS = {
  classify: `You are a telecom support classifier for Oman/Gulf. Reply ONLY valid JSON:
{"category":"billing|support|complaint|inquiry|sales","priority":"low|medium|high|urgent","language":"ar|en|mixed","intent":"short intent","confidence":0.0-1.0}`,

  sentiment: `Analyze customer message sentiment. Reply ONLY JSON:
{"score":-1.0 to 1.0,"label":"positive|neutral|negative","emotions":["emotion"]}`,

  summarize: `Summarize this support conversation. Reply ONLY JSON:
{"summary":"2-3 sentences","key_points":["..."],"suggested_labels":["..."]}`,

  suggest: (tone) =>
    `Suggest 3 ${tone} agent replies in Arabic and/or English as appropriate. Use knowledge context when provided. Reply ONLY JSON:
{"suggestions":[{"text":"...","language":"ar|en","rag_citations":[]}]}`,
};
