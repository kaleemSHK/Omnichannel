# CURSOR PROMPT — STEP 14: Fix All Broken Files (Full Rewrites)
> Paste this ENTIRE file into Cursor Composer.
> Every file listed below is corrupt — truncated content mixed with broken append attempts.
> For EVERY file: delete all existing content and write it from scratch.
> Do NOT append. Do NOT merge. REPLACE entirely.
> Run `npm run type-check` after. Target: 0 errors.
> Read `.cursorrules` before writing anything.

---

## WHAT HAPPENED

A null-byte padding bug truncated ~27 files mid-write. Repair attempts created further corruption.
Every file below must be completely rewritten. Use the specs in `.cursorrules` for component behaviour.
The existing API files (`src/lib/api/*.ts`) and types are already correct — do not modify them.

---

## FILES TO FULLY REWRITE

### `src/components/layout/TopBar.tsx`

```tsx
'use client';

import { useAuthStore } from '@/lib/store/auth';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ROLE_META, type UserRole } from '@/lib/rbac';
import { cn } from '@/lib/utils/cn';

const PAGE_TITLES: Record<string, string> = {
  '/conversations': 'Conversations',
  '/calling': 'Calling',
  '/contacts': 'Contacts',
  '/sla': 'SLA Dashboard',
  '/escalation': 'Escalation Rules',
  '/ai': 'AI Knowledge',
  '/billing': 'Billing & Usage',
  '/platform': 'Platform Admin',
  '/tickets': 'Tickets',
  '/reports': 'Reports',
  '/settings': 'Settings',
};

export function TopBar() {
  const { user, clearAuth } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();

  const pageTitle =
    Object.entries(PAGE_TITLES)
      .filter(([route]) => pathname.startsWith(route))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? 'BlinkOne';

  const roleMeta = user?.role ? ROLE_META[user.role as UserRole] : null;

  function handleLogout() {
    clearAuth();
    router.push('/login');
  }

  return (
    <header className="h-12 shrink-0 border-b border-gray-100 bg-white flex items-center justify-between px-4 gap-4">
      <h1 className="text-sm font-semibold text-gray-900 truncate">{pageTitle}</h1>
      <div className="flex items-center gap-2 shrink-0">
        {roleMeta && (
          <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium hidden sm:inline', roleMeta.color)}>
            {roleMeta.label}
          </span>
        )}
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold flex items-center justify-center">
          {user?.name?.slice(0, 2).toUpperCase() ?? '?'}
        </div>
        <span className="text-sm text-gray-600 hidden md:inline">{user?.name}</span>
        <button
          type="button"
          onClick={handleLogout}
          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
          title="Sign out"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
```

---

### `src/components/conversations/MessageBubble.tsx`

```tsx
'use client';

import { cn } from '@/lib/utils/cn';
import type { CWMessage } from '@/types';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts * 1000;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface Props {
  message: CWMessage;
}

export function MessageBubble({ message }: Props) {
  const isOutbound = message.message_type === 1;
  const isPrivateNote = message.content_type === 'private_note' || message.private === true;
  const senderName = message.sender?.name ?? 'Agent';

  return (
    <div className={cn('flex gap-2 max-w-[75%]', isOutbound ? 'ms-auto flex-row-reverse' : 'me-auto')}>
      {!isOutbound && (
        <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs flex items-center justify-center shrink-0 mt-1">
          {initials(senderName)}
        </div>
      )}
      <div>
        <div
          className={cn(
            'rounded-lg px-3 py-2 text-sm',
            isPrivateNote
              ? 'bg-amber-50 border border-amber-200 rounded-tl-none'
              : isOutbound
              ? 'bg-blue-50 border border-blue-100 rounded-tr-none'
              : 'bg-muted rounded-tl-none',
          )}
        >
          {isPrivateNote && (
            <span className="text-[10px] text-amber-600 font-medium block mb-1">Private note</span>
          )}
          <p dir="auto">{message.content}</p>
        </div>
        <p className="text-xs text-muted-foreground mt-1 px-1">
          {relativeTime(message.created_at)}
        </p>
      </div>
    </div>
  );
}
```

---

### `src/components/conversations/ConversationListItem.tsx`

```tsx
'use client';

import { cn } from '@/lib/utils/cn';
import type { CWConversation } from '@/types';

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('');
}

function relativeTime(ts: number) {
  const diff = Date.now() - ts * 1000;
  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

interface Props {
  conversation: CWConversation;
  selected: boolean;
  onClick: () => void;
}

export function ConversationListItem({ conversation, selected, onClick }: Props) {
  const name = conversation.meta?.sender?.name ?? 'Unknown';
  const channel = conversation.channel ?? conversation.inbox_name ?? 'chat';

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full text-start flex items-start gap-3 px-3 py-2.5 cursor-pointer transition-colors border-s-2',
        selected
          ? 'bg-blue-50 border-s-brand-primary'
          : 'border-s-transparent hover:bg-muted',
      )}
    >
      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 text-xs font-medium flex items-center justify-center shrink-0">
        {initials(name)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm truncate">{name}</span>
          <span className="text-xs text-muted-foreground ms-auto shrink-0">
            {relativeTime(conversation.last_activity_at)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{channel}</span>
          {conversation.unread_count > 0 && (
            <span className="bg-brand-primary text-white text-xs rounded-full px-1.5 min-w-[18px] text-center">
              {conversation.unread_count}
            </span>
          )}
        </div>
        {conversation.messages?.[0]?.content && (
          <p className="text-sm text-muted-foreground truncate mt-0.5">
            {conversation.messages[0].content}
          </p>
        )}
      </div>
    </button>
  );
}
```

---

### `src/components/conversations/ReplyBox.tsx`

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock, Paperclip, SendHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { CannedResponsePicker } from './CannedResponsePicker';
import { useSendMessage } from '@/lib/hooks/useConversations';
import { useInboxStore } from '@/lib/store/inbox';
import { cn } from '@/lib/utils/cn';

interface Props {
  conversationId: number;
}

export function ReplyBox({ conversationId }: Props) {
  const [content, setContent] = useState('');
  const [mode, setMode] = useState<'reply' | 'note'>('reply');
  const [cannedQuery, setCannedQuery] = useState<string | null>(null);
  const mutation = useSendMessage(conversationId);

  // Listen for "insert-reply" events from AgentAssistPanel
  useEffect(() => {
    const handler = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (text) setContent(text);
    };
    window.addEventListener('insert-reply', handler);
    return () => window.removeEventListener('insert-reply', handler);
  }, []);

  // Expose setter to inbox store so other components can prefill
  const setDraftContent = useInboxStore(s => s.setDraftContent);
  useEffect(() => {
    setDraftContent(content);
  }, [content, setDraftContent]);

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
        onSuccess: () => setContent(''),
        onError: err => toast.error(err instanceof Error ? err.message : 'Failed to send'),
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent) {
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
      {/* Reply / Note tabs */}
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

      {/* Canned picker + input row */}
      <div className="relative">
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
        <div className="flex gap-2 items-end">
          <Button variant="ghost" size="icon" className="shrink-0 mb-0.5">
            <Paperclip className="w-4 h-4" />
          </Button>
          <Textarea
            value={content}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={mode === 'note' ? 'Write a private note…' : 'Reply… (Enter to send)'}
            className={cn(
              'min-h-[40px] max-h-32 resize-none flex-1',
              mode === 'note' && 'bg-amber-50 border-amber-200 focus-visible:ring-amber-300',
            )}
            rows={1}
          />
          <Button
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
    </div>
  );
}
```

---

### `src/components/conversations/AgentAssistPanel.tsx`

Preserve the existing file content EXACTLY up to and including the `</Dialog>` closing tag at the bottom of the main component. Then replace everything AFTER that with the correct `Section` sub-component:

Find the line that says:
```
function Section({
  title,
  ope
```
Delete from that line to end of file. Replace with:

```tsx
function Section({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-b">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50"
      >
        {title}
        <ChevronDown className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
```

---

### `src/components/conversations/ConversationList.tsx`

Preserve content up to and including the closing `</button>` of the tabs map. Then replace everything after the truncation with:

```tsx
        </div>
      </div>

      {/* Inbox filter */}
      <div className="px-3 pb-2">
        <select
          value={inboxFilter}
          onChange={e => setInboxFilter(e.target.value)}
          className="w-full text-xs border rounded-md px-2 py-1 bg-white"
        >
          <option value="">All inboxes</option>
          {inboxes.map((inbox: { id: number; name: string }) => (
            <option key={inbox.id} value={String(inbox.id)}>{inbox.name}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="space-y-1 p-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 mx-1 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}
        {isError && (
          <div className="p-4 text-sm text-destructive">
            Failed to load.{' '}
            <button type="button" onClick={() => refetch()} className="underline">
              Retry
            </button>
          </div>
        )}
        {allConversations.map(conv => (
          <ConversationListItem
            key={conv.id}
            conversation={conv}
            selected={selectedId === conv.id}
            onClick={() => onSelect(conv)}
          />
        ))}
        <div ref={sentinel} className="h-4" />
        {isFetchingNextPage && (
          <p className="text-xs text-center text-muted-foreground py-2">Loading more…</p>
        )}
      </div>
    </div>
  );
}
```

---

### `src/components/conversations/MessageThread.tsx`

Preserve content up to and including the `Resolve` button block. After the truncation point (`hover:bg-green`), close it cleanly:

```tsx
              className="h-8 text-xs border-green-200 text-green-700 hover:bg-green-50"
              disabled={statusMutation.isPending}
              onClick={() => statusMutation.mutate('open')}
            >
              Reopen
            </Button>
          ))}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto flex flex-col gap-2 px-4 py-4 min-h-0">
        {isLoadingMessages ? (
          [1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={cn(
                'h-12 rounded-lg bg-muted animate-pulse max-w-[60%]',
                i % 2 === 0 ? 'ms-auto' : '',
              )}
            />
          ))
        ) : (
          messages.map(msg => <MessageBubble key={msg.id} message={msg} />)
        )}
        <div ref={messagesEndRef} />
      </div>

      <ReplyBox conversationId={conversation.id} />
    </div>
  );
}
```

---

### `src/components/calling/ActiveCallBar.tsx`

Find the truncation point (after `title="Mute"`). Replace everything from there to end of file:

```tsx
          onClick={() => {
            if (muted) unmute();
            else mute();
            setMuted(m => !m);
          }}
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center',
            muted ? 'bg-white/20' : 'hover:bg-white/20',
          )}
        >
          {muted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
        </button>
        <button
          type="button"
          title="Hold"
          onClick={() => hold()}
          className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-white/20"
        >
          <PauseCircle className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          title="End call"
          onClick={handleHangup}
          className="w-7 h-7 rounded-full bg-red-500 flex items-center justify-center hover:bg-red-400"
        >
          <PhoneOff className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
```

---

### `src/components/calling/DialPad.tsx`

Find the truncation (inside the tab button className). Replace everything from there to end of file:

```tsx
                tab === t
                  ? 'flex-1 py-1.5 bg-blue-50 text-brand-primary font-medium capitalize'
                  : 'flex-1 py-1.5 text-gray-500 capitalize hover:bg-muted'
              }
            >
              {t === 'pstn' ? 'Phone' : 'WhatsApp'}
            </button>
          ))}
        </div>
      )}

      <Input
        value={number}
        onChange={e => setNumber(e.target.value)}
        className="text-center text-lg font-mono"
        placeholder="+968"
      />

      <div className="grid grid-cols-3 gap-2">
        {KEYS.flat().map(key => (
          <button
            key={key}
            type="button"
            onClick={() => setNumber(n => n + key)}
            className="h-12 rounded-lg bg-muted hover:bg-muted/80 text-base font-medium transition-colors"
          >
            {key}
          </button>
        ))}
      </div>

      <Button
        onClick={handleCall}
        disabled={!number.trim() || disabled}
        className="w-full bg-green-500 hover:bg-green-600 text-white"
      >
        <Phone className="w-4 h-4 me-2" /> Call
      </Button>
    </div>
  );
}
```

---

### `src/components/calling/PhonePanel.tsx`

Find the truncation (inside `showIncomingCallToast`). Replace from truncation point to end:

```tsx
            {
              onAnswer: () => {
                sipAnswer();
                answer.mutate(session.id);
                setActiveCall({ ...session, status: 'connected' });
                removeIncoming(session.id);
              },
              onDecline: () => {
                void declineCall(session.id);
                removeIncoming(session.id);
              },
            },
          );
        });
      }
    });
  }, [user, addIncoming, removeIncoming, setActiveCall, answer, sipAnswer]);

  if (!activeCall || activeCall.status !== 'connected') {
    return (
      <div className="fixed bottom-4 end-4 z-50">
        <button
          type="button"
          className="w-12 h-12 rounded-full bg-brand-primary text-white flex items-center justify-center shadow-lg hover:bg-brand-primary/90"
          title="Phone"
        >
          <Phone className="w-5 h-5" />
        </button>
      </div>
    );
  }

  const name = demoCallerName(activeCall);

  return (
    <div className="fixed bottom-4 end-4 z-50 w-72 rounded-xl bg-white border shadow-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-green-100 text-green-700 flex items-center justify-center font-medium text-sm">
          {name.slice(0, 2).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{activeCall.customerPhone}</p>
        </div>
        <CallTimer
          startTime={activeCall.connectedAt ?? activeCall.startedAt}
          className="ms-auto font-mono text-brand-primary font-semibold text-sm"
        />
      </div>
      <CallControls />
    </div>
  );
}
```

---

### `src/components/calling/CallListItem.tsx`

Find the truncation (inside `</p`). Replace from there to end:

```tsx
>
          {mins}:{secs}
        </p>
      </div>
    </button>
  );
}
```

---

### `src/components/contacts/ContactListItem.tsx`

Find the truncation (`</spa`). Replace from there to end:

```tsx
n>
    </button>
  );
}
```

---

### `src/components/contacts/ContactDetailPanel.tsx`

Find the truncation (inside `Link` href className `hover:underlin`). Replace from there to end:

```tsx
e hover:text-brand-primary">
            View all
          </Link>
        </div>
      </section>
    </div>
  );
}
```

---

### `src/components/contacts/ContactForm.tsx`

Find the truncation (`text-destru`). Replace from there to end:

```tsx
ctive">{errors.phone_number.message}</p>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="px-4 py-2 text-sm bg-brand-primary text-white rounded-md hover:bg-brand-primary/90 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
```

---

### `src/components/contacts/ContactsWorkspace.tsx`

Find the truncation (inside `title={editContact ? 'E`). Replace from there to end:

```tsx
dit contact' : 'New contact'}
      >
        <ContactForm
          contact={editContact ?? undefined}
          onSave={() => { setSheetOpen(false); setEditContact(null); }}
          onCancel={() => { setSheetOpen(false); setEditContact(null); }}
        />
      </Sheet>
    </div>
  );
}
```

---

### `src/components/contacts/ContactList.tsx`

Find the truncation (after sentinel div + loading text). Replace from there to end:

```tsx
      </div>
    </div>
  );
}
```

---

### `src/components/billing/BillingWorkspace.tsx`

Find the truncation (inside addons map, after `resolvedAddons.map(addon => (`). Replace from there to end:

```tsx
                    <div key={addon.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{addon.name}</p>
                          <p className="text-xs text-gray-500">{addon.description}</p>
                        </div>
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-medium',
                          addon.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500',
                        )}>
                          {addon.active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold">{addon.price === 0 ? 'Free' : `$${addon.price}/mo`}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### `src/components/ivr/IVRFlowCanvas.tsx`

Find the truncation (`</di`). Replace from there to end:

```tsx
v>
    </div>
  );
}
```

---

### `src/components/settings/SettingsNav.tsx`

Find the truncation (inside className `'w`). Replace from there to end:

```tsx
full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors',
                active === id
                  ? 'bg-blue-50 text-brand-primary font-medium'
                  : 'text-gray-700 hover:bg-muted',
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      ))}
    </aside>
  );
}
```

---

### `src/app/login/page.tsx`

Find the truncation (`Signin`). Replace from there to end:

```tsx
g in…
                  </>
                ) : (
                  'Sign in'
                )}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
```

---

## AFTER ALL REWRITES

```bash
npm run type-check
```

Fix any remaining type errors in the same session. Common issues:
- Missing imports (add from lucide-react, @tanstack/react-query, etc.)
- Properties that don't exist on a type — check `src/types/index.ts`
- `useState` / `useEffect` imported at top of file

**Target: 0 type errors before finishing.**
