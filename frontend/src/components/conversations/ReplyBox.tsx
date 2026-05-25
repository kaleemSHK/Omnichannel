'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock, Mic, Paperclip, SendHorizontal, Square } from 'lucide-react';
import { toast } from 'sonner';
import { AgentMentionPicker } from '@/components/conversations/AgentMentionPicker';
import { CannedResponsePicker } from '@/components/conversations/CannedResponsePicker';
import { EmojiPicker } from '@/components/conversations/EmojiPicker';
import { PendingAttachmentChip } from '@/components/conversations/MessageAttachments';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useSendMessage } from '@/lib/hooks/useConversations';
import { useInboxStore } from '@/lib/store/inbox';
import { cn } from '@/lib/utils/cn';
import { activeMentionQuery, formatAgentMention } from '@/lib/utils/mentions';
import type { MentionableAgent } from '@/lib/hooks/useChatwootExtras';

const FILE_ACCEPT =
  'image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip,.rar';

export function ReplyBox({ conversationId }: { conversationId: number }) {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [cannedQuery, setCannedQuery] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mutation = useSendMessage(conversationId);
  const { isRecording, startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const skipStoreInsertRef = useRef(false);

  const canSend = Boolean(content.trim() || pendingFiles.length);

  // Two insert paths: (1) insert-reply CustomEvent from AgentAssistPanel, (2) inbox store
  // takePendingReplyInsert for canned responses / cross-page snippets. Guard against double-insert.
  useEffect(() => {
    const onInsert = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) {
        skipStoreInsertRef.current = true;
        setContent(prev => (prev ? `${prev}\n\n${detail}` : detail));
      }
    };
    window.addEventListener('insert-reply', onInsert as EventListener);
    return () => window.removeEventListener('insert-reply', onInsert as EventListener);
  }, []);

  useEffect(() => {
    if (skipStoreInsertRef.current) {
      skipStoreInsertRef.current = false;
      return;
    }
    const snippet = useInboxStore.getState().takePendingReplyInsert();
    if (snippet) setContent(prev => (prev ? `${prev}\n\n${snippet}` : snippet));
  }, [conversationId]);

  useEffect(() => {
    if (mode === 'reply') setMentionQuery(null);
  }, [mode]);

  useEffect(() => {
    if (!isRecording) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') cancelRecording();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isRecording, cancelRecording]);

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setContent(val);
    const lastLine = val.split('\n').pop() ?? '';

    const mention = mode === 'note' ? activeMentionQuery(lastLine) : null;
    if (mention !== null) {
      setMentionQuery(mention);
      setCannedQuery(null);
      return;
    }

    if (lastLine.startsWith('/')) {
      setCannedQuery(lastLine.slice(1));
      setMentionQuery(null);
    } else {
      setCannedQuery(null);
      setMentionQuery(null);
    }
  }

  function applyAgentMention(agent: MentionableAgent) {
    setContent(prev => {
      const lines = prev.split('\n');
      const lastIdx = lines.length - 1;
      const last = lines[lastIdx] ?? '';
      const atIdx = last.lastIndexOf('@');
      const token = formatAgentMention(agent);
      if (atIdx === -1) {
        lines[lastIdx] = `${last}${token} `;
      } else {
        lines[lastIdx] = `${last.slice(0, atIdx)}${token} `;
      }
      return lines.join('\n');
    });
    setMentionQuery(null);
  }

  function applyCannedResponse(replacement: string) {
    setContent(prev => {
      const lines = prev.split('\n');
      const lastIdx = lines.length - 1;
      const last = lines[lastIdx] ?? '';
      const slashAt = last.lastIndexOf('/');
      if (slashAt === -1) return replacement;
      lines[lastIdx] = last.slice(0, slashAt) + replacement;
      return lines.join('\n');
    });
    setCannedQuery(null);
  }

  function insertEmoji(emoji: string) {
    const el = textareaRef.current;
    if (!el) {
      setContent(prev => prev + emoji);
      return;
    }
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length) {
      setPendingFiles(prev => [...prev, ...files]);
    }
    e.target.value = '';
  }

  function removePendingFile(index: number) {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function toggleRecording() {
    if (isRecording) {
      try {
        const file = await stopRecording();
        if (file) {
          setPendingFiles(prev => [...prev, file]);
        }
      } catch {
        toast.error('Could not save voice message');
      }
      return;
    }

    try {
      await startRecording();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Microphone access denied');
    }
  }

  function resetComposer() {
    setContent('');
    setCannedQuery(null);
    setMentionQuery(null);
    setPendingFiles([]);
  }

  function handleSend() {
    const trimmed = content.trim();
    if (!trimmed && !pendingFiles.length) return;
    mutation.mutate(
      {
        content: trimmed,
        private: mode === 'note',
        attachments: pendingFiles.length ? pendingFiles : undefined,
      },
      {
        onSuccess: () => resetComposer(),
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

      {pendingFiles.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {pendingFiles.map((file, i) => (
            <PendingAttachmentChip
              key={`${file.name}-${file.size}-${i}`}
              file={file}
              onRemove={() => removePendingFile(i)}
            />
          ))}
        </div>
      )}

      {isRecording && (
        <p className="text-xs text-red-600 mb-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Recording… click stop or press Esc to cancel
        </p>
      )}

      <div className="flex gap-2 items-end">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className="hidden"
          onChange={handleFileSelect}
        />
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="shrink-0 mb-0.5"
          aria-label="Attach file"
          disabled={mutation.isPending || isRecording}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="w-4 h-4" />
        </Button>
        <EmojiPicker onSelect={insertEmoji} disabled={mutation.isPending || isRecording} />
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className={cn(
            'shrink-0 mb-0.5',
            isRecording && 'bg-red-100 text-red-600 hover:bg-red-100 hover:text-red-700',
          )}
          aria-label={isRecording ? 'Stop recording' : 'Record voice message'}
          disabled={mutation.isPending}
          onClick={toggleRecording}
        >
          {isRecording ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-4 h-4" />}
        </Button>
        <div className="relative flex-1">
          {mentionQuery !== null && mode === 'note' && (
            <AgentMentionPicker
              query={mentionQuery}
              onSelect={applyAgentMention}
              onClose={() => setMentionQuery(null)}
            />
          )}
          {cannedQuery !== null && (
            <CannedResponsePicker
              query={cannedQuery}
              onSelect={applyCannedResponse}
              onClose={() => setCannedQuery(null)}
            />
          )}
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={
              mode === 'note'
                ? 'Private note… (@ to mention agent, / for canned responses)'
                : 'Reply… (Enter to send, / for canned responses)'
            }
            className={cn(
              'min-h-[40px] max-h-32 resize-none w-full',
              mode === 'note' && 'bg-amber-50 border-amber-200',
            )}
            rows={1}
            disabled={isRecording}
          />
        </div>
        <Button
          type="button"
          onClick={handleSend}
          disabled={!canSend || mutation.isPending || isRecording}
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
