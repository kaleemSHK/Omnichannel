'use client';

import { useEffect, useState } from 'react';
import { Lock, Paperclip, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { CannedResponsePicker } from '@/components/conversations/CannedResponsePicker';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useSendMessage } from '@/lib/hooks/useConversations';
import { useInboxStore } from '@/lib/store/inbox';
import { cn } from '@/lib/utils/cn';

export function ReplyBox({ conversationId }: { conversationId: number }) {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [cannedQuery, setCannedQuery] = useState<string | null>(null);
  const takePendingInsert = useInboxStore(s => s.takePendingReplyInsert);
  const mutation = useSendMessage(conversationId);

  useEffect(() => {
    const onInsert = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) setContent(prev => (prev ? `${prev}\n\n${detail}` : detail));
    };
    window.addEventListener('insert-reply', onInsert as EventListener);
    return () => window.removeEventListener('insert-reply', onInsert as EventListener);
  }, []);

  useEffect(() => {
    const snippet = takePendingInsert();
    if (snippet) setContent(prev => (prev ? `${prev}\n\n${snippet}` : snippet));
  }, [conversationId, takePendingInsert]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    const lastLine = val.split('\n').pop() ?? '';
    if (lastLine.startsWith('/') && lastLine.length > 1) {
      setCannedQuery(lastLine.slice(1));
    } else {
      setCannedQuery(null);
    }
  }

  function handleSend() {
    if (!content.trim()) return;
    mutation.mutate(
      { content: content.trim(), private: mode === 'note' },
      {
        onSuccess: () => {
          setContent('');
          setCannedQuery(null);
        },
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to send'),
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div
      className={cn(
        'border-t p-3 shrink-0 bg-white',
        mode === 'note' && 'bg-amber-50/50 border-amber-100',
      )}
    >
      <div className="flex border-b mb-2">
        <button
          type="button"
          onClick={() => setMode('reply')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors',
            mode === 'reply'
              ? 'border-brand-primary text-brand-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          Reply
        </button>
        <button
          type="button"
          onClick={() => setMode('note')}
          className={cn(
            'px-3 py-1.5 text-xs font-medium border-b-2 transition-colors flex items-center gap-1',
            mode === 'note'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          <Lock className="w-3 h-3" /> Note
        </button>
      </div>

      <div className="flex gap-2 items-end">
        <Button variant="ghost" size="icon" type="button" className="shrink-0 mb-0.5" aria-label="Attach">
          <Paperclip className="w-4 h-4" />
        </Button>
        <div className="relative flex-1">
          {cannedQuery !== null && (
            <CannedResponsePicker
              query={cannedQuery}
              onSelect={text => {
                setContent(text);
                setCannedQuery(null);
              }}
              onClose={() => setCannedQuery(null)}
            />
          )}
          <Textarea
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'note'
                ? 'Private note (visible to team only)…'
                : 'Reply… (Enter to send, / for canned responses)'
            }
            className={cn(
              'min-h-[40px] max-h-32 resize-none w-full',
              mode === 'note' && 'bg-amber-50 border-amber-200',
            )}
            rows={1}
          />
        </div>
        <Button
          type="button"
          onClick={handleSend}
          disabled={!content.trim() || mutation.isPending}
          className={cn(
            'shrink-0 mb-0.5',
            mode === 'note'
              ? 'bg-amber-500 hover:bg-amber-600'
              : 'bg-brand-primary hover:bg-brand-primary/90',
          )}
          size="icon"
        >
          <SendHorizontal className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
