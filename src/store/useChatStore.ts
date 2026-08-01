import { create } from 'zustand';
import type { Message, MessageReaction, MessageType } from '../types';
import { chatService } from '../services/chatService';
import { generateLocalUuid } from '../utils/message';

interface ChatState {
  messages: Message[];
  isLoadingMessages: boolean;
  hasMoreMessages: boolean;
  pageOffset: number;
  activeReplyTarget: Message | null;
  selectedMessage: Message | null;
  editingMessage: Message | null;
  searchQuery: string;
  isRealtimeSubscribed: boolean;

  loadInitialMessages: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (senderId: string, receiverId: string, content: string, messageType?: MessageType) => Promise<void>;
  editMessage: (localUuid: string, newContent: string) => Promise<void>;
  deleteMessage: (localUuid: string) => Promise<void>;
  togglePin: (localUuid: string) => Promise<void>;
  toggleStar: (localUuid: string) => Promise<void>;
  toggleReaction: (messageId: string, userId: string, emoji: string) => Promise<void>;
  setActiveReplyTarget: (msg: Message | null) => void;
  setSelectedMessage: (msg: Message | null) => void;
  setEditingMessage: (msg: Message | null) => void;
  setSearchQuery: (query: string) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoadingMessages: false,
  hasMoreMessages: false,
  pageOffset: 0,
  activeReplyTarget: null,
  selectedMessage: null,
  editingMessage: null,
  searchQuery: '',
  isRealtimeSubscribed: false,

  loadInitialMessages: async () => {
    set({ isLoadingMessages: true });
    const msgs = await chatService.getMessages();
    set({
      messages: msgs,
      isLoadingMessages: false,
      hasMoreMessages: false,
      pageOffset: 0,
    });

    if (!get().isRealtimeSubscribed) {
      set({ isRealtimeSubscribed: true });
      chatService.subscribeToRealtimeMessages((incomingMsg) => {
        set((state) => {
          const exists = state.messages.some(
            (m) => m.local_uuid === incomingMsg.local_uuid || m.id === incomingMsg.id
          );
          if (exists) {
            return {
              messages: state.messages.map((m) =>
                m.local_uuid === incomingMsg.local_uuid || m.id === incomingMsg.id
                  ? { ...m, ...incomingMsg }
                  : m
              ),
            };
          }
          return { messages: [...state.messages, incomingMsg] };
        });
      });
    }
  },

  loadMoreMessages: async () => {},

  sendMessage: async (senderId, receiverId, content, messageType = 'text') => {
    const replyTarget = get().activeReplyTarget;
    const replyRef = replyTarget
      ? {
          id: replyTarget.local_uuid,
          sender_name: replyTarget.sender_id === senderId ? 'You' : 'Partner',
          content: replyTarget.content,
          message_type: replyTarget.message_type,
        }
      : undefined;

    const newMsg = await chatService.sendMessage({
      sender_id: senderId,
      receiver_id: receiverId,
      content,
      message_type: messageType,
      reply_to: replyTarget?.local_uuid,
      reply_to_msg: replyRef,
    });

    set((state) => {
      const exists = state.messages.some((m) => m.local_uuid === newMsg.local_uuid);
      if (exists) {
        return {
          messages: state.messages.map((m) => (m.local_uuid === newMsg.local_uuid ? newMsg : m)),
          activeReplyTarget: null,
        };
      }
      return {
        messages: [...state.messages, newMsg],
        activeReplyTarget: null,
      };
    });
  },

  editMessage: async (localUuid, newContent) => {
    await chatService.editMessage(localUuid, newContent);
    set((state) => ({
      messages: state.messages.map((m) =>
        m.local_uuid === localUuid ? { ...m, content: newContent, edited: true } : m
      ),
      editingMessage: null,
      selectedMessage: null,
    }));
  },

  deleteMessage: async (localUuid) => {
    await chatService.deleteMessage(localUuid);
    set((state) => ({
      messages: state.messages.map((m) =>
        m.local_uuid === localUuid
          ? { ...m, deleted: true, content: 'This message was deleted.' }
          : m
      ),
      selectedMessage: null,
    }));
  },

  togglePin: async (localUuid) => {
    await chatService.togglePin(localUuid);
    set((state) => ({
      messages: state.messages.map((m) =>
        m.local_uuid === localUuid ? { ...m, pinned: !m.pinned } : m
      ),
    }));
  },

  toggleStar: async (localUuid) => {
    await chatService.toggleStar(localUuid);
    set((state) => ({
      messages: state.messages.map((m) =>
        m.local_uuid === localUuid ? { ...m, starred: !m.starred } : m
      ),
    }));
  },

  toggleReaction: async (messageId, userId, emoji) => {
    // 1. Optimistic UI update so reaction badge displays instantly
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id === messageId || m.local_uuid === messageId) {
          const currentReactions = m.reactions || [];
          const existingIdx = currentReactions.findIndex(
            (r) => r.profile_id === userId && r.emoji === emoji
          );
          let updatedReactions: MessageReaction[];
          if (existingIdx >= 0) {
            updatedReactions = currentReactions.filter((_, idx) => idx !== existingIdx);
          } else {
            updatedReactions = [
              ...currentReactions,
              {
                id: generateLocalUuid(),
                message_id: messageId,
                profile_id: userId,
                emoji,
                created_at: new Date().toISOString(),
              },
            ];
          }
          return { ...m, reactions: updatedReactions };
        }
        return m;
      }),
    }));

    // 2. Persist asynchronously to Supabase
    await chatService.toggleReaction(messageId, userId, emoji);
  },

  setActiveReplyTarget: (msg) => set({ activeReplyTarget: msg }),
  setSelectedMessage: (msg) => set({ selectedMessage: msg }),
  setEditingMessage: (msg) => set({ editingMessage: msg }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
