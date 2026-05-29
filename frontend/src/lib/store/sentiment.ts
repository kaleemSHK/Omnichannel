import { create } from 'zustand';

type Sentiment = 'positive' | 'neutral' | 'negative';

interface SentimentStore {
  byConversation: Record<number, Sentiment>;
  setSentiment: (conversationId: number, sentiment: Sentiment) => void;
}

export const useSentimentStore = create<SentimentStore>(set => ({
  byConversation: {},
  setSentiment: (conversationId, sentiment) =>
    set(s => ({
      byConversation: { ...s.byConversation, [conversationId]: sentiment },
    })),
}));
