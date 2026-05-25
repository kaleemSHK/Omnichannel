'use client';

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { classifyConversation, queryRAG, suggestReply, summarizeConversation } from '@/lib/api/ai';
import { useMessages } from '@/lib/hooks/useConversations';
import { isDemoDataEnabled } from '@/lib/demo/config';
import { DEMO_RAG_RESULTS } from '@/lib/demo/aiFixture';
import { scorePercent } from '@/lib/utils/ai';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/Dialog';
import { cn } from '@/lib/utils/cn';
import type { CWMessage } from '@/types';

interface Props {
  conversationId: number;
}

function lastInboundText(messages: CWMessage[]): string {
  const inbound = [...messages].reverse().find(m => m.message_type === 0);
  return inbound?.content ?? '';
}

function toSuggestPayload(messages: CWMessage[]) {
  return messages
    .filter(m => m.message_type === 0 || m.message_type === 1)
    .slice(-8)
    .map(m => ({
      role: (m.message_type === 1 ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    }));
}

export function AgentAssistPanel({ conversationId }: Props) {
  const { data: messages = [] } = useMessages(conversationId);
  const lastInbound = lastInboundText(messages);

  const [suggestOpen, setSuggestOpen] = useState(true);
  const [ragOpen, setRagOpen] = useState(true);
  const [insightsOpen, setInsightsOpen] = useState(true);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState('');

  const { data: suggestion, isLoading: suggestLoading } = useQuery({
    queryKey: ['suggestReply', conversationId, messages.length],
    queryFn: async () => {
      const payload = toSuggestPayload(messages);
      if (!payload.length) return { suggestion: '', confidence: 0 };
      try {
        return await suggestReply({
          conversationId: String(conversationId),
          messages: payload,
        });
      } catch {
        return { suggestion: '', confidence: 0 };
      }
    },
    enabled: !!conversationId && messages.length > 0,
  });

  const { data: ragResults = [] } = useQuery({
    queryKey: ['ragQuery', conversationId, lastInbound],
    queryFn: async () => {
      if (!lastInbound) return [];
      if (isDemoDataEnabled()) {
        return DEMO_RAG_RESULTS.slice(0, 3).map(r => ({
          score: r.score,
          title: r.filename,
          excerpt: r.excerpt,
        }));
      }
      try {
        const rows = await queryRAG({ query: lastInbound, topK: 3 });
        return rows.map(r => ({
          score: r.score,
          title: r.title,
          excerpt: r.excerpt,
        }));
      } catch {
        return DEMO_RAG_RESULTS.slice(0, 3).map(r => ({
          score: r.score,
          title: r.filename,
          excerpt: r.excerpt,
        }));
      }
    },
    enabled: !!lastInbound,
  });

  const { data: insights } = useQuery({
    queryKey: ['classify', conversationId],
    queryFn: async (): Promise<{
      category: string;
      intent: string;
      confidence: number;
      sentiment: 'positive' | 'neutral' | 'negative';
    }> => {
      if (isDemoDataEnabled()) {
        return {
          category: 'support',
          intent: 'plan_change',
          confidence: 0.8,
          sentiment: 'neutral',
        };
      }
      try {
        const res = await classifyConversation(String(conversationId));
        return {
          category: res.category ?? 'support',
          intent: res.intent ?? 'general',
          confidence: res.confidence ?? 0.5,
          sentiment: ((res as { sentiment?: string }).sentiment ?? 'neutral') as
            | 'positive'
            | 'neutral'
            | 'negative',
        };
      } catch {
        return {
          category: 'support',
          intent: 'general',
          confidence: 0.5,
          sentiment: 'neutral',
        };
      }
    },
    enabled: !!conversationId,
  });

  const summarize = useMutation({
    mutationFn: () => summarizeConversation(String(conversationId)),
    onSuccess: data => {
      setSummaryText(`${data.summary}\n\n• ${data.keyPoints.join('\n• ')}`);
      setSummaryOpen(true);
    },
  });

  const sentiment = insights?.sentiment ?? 'neutral';
  const sentimentClass =
    sentiment === 'positive'
      ? 'bg-green-50 text-green-700'
      : sentiment === 'negative'
        ? 'bg-red-50 text-red-700'
        : 'bg-gray-100 text-gray-600';

  const insertSuggestion = () => {
    const text = suggestion?.suggestion;
    if (!text) return;
    window.dispatchEvent(new CustomEvent('insert-reply', { detail: text }));
  };

  return (
    <aside className="w-[300px] border-s flex flex-col h-full overflow-y-auto bg-muted/30 shrink-0">
      <Section
        title="Suggested reply"
        open={suggestOpen}
        onToggle={() => setSuggestOpen(v => !v)}
      >
        <div className="bg-background border rounded-md p-3 text-sm min-h-[60px]">
          {suggestLoading ? 'Loading…' : suggestion?.suggestion || 'No suggestion yet'}
        </div>
        <Button
          type="button"
          variant="outline"
          className="w-full mt-2 h-8 text-xs"
          disabled={!suggestion?.suggestion}
          onClick={insertSuggestion}
        >
          Insert
        </Button>
      </Section>

      <Section title="Knowledge sources" open={ragOpen} onToggle={() => setRagOpen(v => !v)}>
        <div className="space-y-2">
          {ragResults.length === 0 && (
            <p className="text-xs text-muted-foreground">No sources for last message</p>
          )}
          {ragResults.map((r, i) => (
            <div key={i} className="bg-background border rounded-md p-2">
              <span className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                {scorePercent(r.score)}% match
              </span>
              <p className="text-xs font-medium mt-1">{r.title}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.excerpt}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section title="AI Insights" open={insightsOpen} onToggle={() => setInsightsOpen(v => !v)}>
        <span className={cn('text-xs px-2 py-1 rounded-full capitalize inline-block', sentimentClass)}>
          {sentiment}
        </span>
        <Button
          type="button"
          variant="outline"
          className="w-full mt-3"
          disabled={summarize.isPending}
          onClick={() => summarize.mutate()}
        >
          {summarize.isPending ? 'Summarizing…' : 'Summarize'}
        </Button>
      </Section>

      <Dialog open={summaryOpen} onClose={() => setSummaryOpen(false)} title="Conversation summary">
        <p className="text-sm whitespace-pre-wrap">{summaryText}</p>
      </Dialog>
    </aside>
  );
}

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-200/80 p-3">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-medium text-gray-900 mb-2"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && children}
    </div>
  );
}
