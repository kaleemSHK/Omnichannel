import { useEffect, useRef, useState } from 'react';
import { getSentiment } from '@/lib/api/ai';
import type { CWMessage } from '@/types';

type Sentiment = 'positive' | 'neutral' | 'negative';

interface SentimentHistory {
  messageId: number;
  sentiment: Sentiment;
  timestamp: string;
}

export function useSentiment(messages: CWMessage[]) {
  const [currentSentiment, setCurrentSentiment] = useState<Sentiment>('neutral');
  const [history, setHistory] = useState<SentimentHistory[]>([]);
  const lastProcessedId = useRef<number>(0);

  useEffect(() => {
    const latestInbound = [...messages]
      .reverse()
      .find(m => m.message_type === 0 && m.id > lastProcessedId.current);

    if (!latestInbound?.content) return;
    lastProcessedId.current = latestInbound.id;

    const text = latestInbound.content;
    const isArabic = /[؀-ۿ]/.test(text);

    getSentiment({ text, language: isArabic ? 'ar' : 'en' }).then(result => {
      setCurrentSentiment(result.sentiment);
      setHistory(h => [
        ...h.slice(-19),
        {
          messageId: latestInbound.id,
          sentiment: result.sentiment,
          timestamp: new Date().toISOString(),
        },
      ]);
    }).catch(() => {
      // getSentiment failure is non-fatal — keep the last known sentiment
    });
  }, [messages]);

  const trend = history.slice(-5).reduce((score, h) => {
    if (h.sentiment === 'positive') return score + 1;
    if (h.sentiment === 'negative') return score - 1;
    return score;
  }, 0);

  return { currentSentiment, history, trend };
}
