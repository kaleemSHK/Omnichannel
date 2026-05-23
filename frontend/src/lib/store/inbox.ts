import { create } from 'zustand';

interface InboxState {
  selectedConversationId: number | null;
  pendingReplyInsert: string | null;
  setSelectedConversationId: (id: number | null) => void;
  insertReplySnippet: (text: string) => void;
  takePendingReplyInsert: () => string | null;
}

export const useInboxStore = create<InboxState>((set, get) => ({
  selectedConversationId: null,
  pendingReplyInsert: null,
  setSelectedConversationId: id => set({ selectedConversationId: id }),
  insertReplySnippet: text =>
    set({ pendingReplyInsert: text }),
  takePendingReplyInsert: () => {
    const text = get().pendingReplyInsert;
    if (text) set({ pendingReplyInsert: null });
    return text;
  },
}));
