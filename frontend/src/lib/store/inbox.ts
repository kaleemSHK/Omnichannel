import { create } from 'zustand';

interface InboxState {
  selectedConversationId: number | null;
  draftContent: string;
  pendingReplyInsert: string | null;
  setSelectedConversationId: (id: number | null) => void;
  setDraftContent: (content: string) => void;
  insertReplySnippet: (text: string) => void;
  takePendingReplyInsert: () => string | null;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  selectedConversationId: null,
  draftContent: '',
  pendingReplyInsert: null,

  setSelectedConversationId: id => set({ selectedConversationId: id }),
  setDraftContent: content => set({ draftContent: content }),

  insertReplySnippet: text =>
    set({ pendingReplyInsert: text, draftContent: text }),

  takePendingReplyInsert: () => {
    const text = get().pendingReplyInsert;
    if (text) set({ pendingReplyInsert: null });
    return text;
  },
}));
