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
  targetMessageId: string | null;
  searchQuery: string;
  isRealtimeSubscribed: boolean;
  stopRealtimeSubscription: () => void;

  loadInitialMessages: () => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  sendMessage: (senderId: string, receiverId: string, content: string, messageType?: MessageType) => Promise<void>;
  retryFailedMessage: (localUuid: string) => Promise<void>;
  editMessage: (localUuid: string, newContent: string) => Promise<void>;
  deleteMessage: (localUuid: string) => Promise<void>;
  togglePin: (localUuid: string) => Promise<void>;
  toggleStar: (localUuid: string) => Promise<void>;
  toggleReaction: (messageId: string, userId: string, emoji: string) => Promise<void>;
  markAsRead: (partnerId: string, currentUserId: string) => Promise<void>;
  setActiveReplyTarget: (msg: Message | null) => void;
  setSelectedMessage: (msg: Message | null) => void;
  setEditingMessage: (msg: Message | null) => void;
  setTargetMessageId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
}

const PAGE_SIZE = 50;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoadingMessages: false,
  hasMoreMessages: false,
  pageOffset: 0,
  activeReplyTarget: null,
  selectedMessage: null,
  editingMessage: null,
  targetMessageId: null,
  searchQuery: '',
  isRealtimeSubscribed: false,

  loadInitialMessages: async () => {
    set({ isLoadingMessages: true });
    const msgs = await chatService.getMessages();
    const visibleMessages = msgs.slice(-PAGE_SIZE);
    set({
      messages: visibleMessages,
      isLoadingMessages: false,
      hasMoreMessages: msgs.length > PAGE_SIZE,
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

  loadMoreMessages: async () => {
    const { isLoadingMessages, hasMoreMessages, pageOffset, messages } = get();
    if (isLoadingMessages || !hasMoreMessages) return;
    set({ isLoadingMessages: true });
    try {
      const allMessages = await chatService.getMessages();
      const nextOffset = pageOffset + PAGE_SIZE;
      const end = Math.max(0, allMessages.length - pageOffset - PAGE_SIZE);
      const start = Math.max(0, end - PAGE_SIZE);
      const olderMessages = allMessages.slice(start, end);
      set({
        messages: [...olderMessages, ...messages],
        pageOffset: nextOffset,
        hasMoreMessages: start > 0,
        isLoadingMessages: false,
      });
    } catch {
      set({ isLoadingMessages: false });
    }
  },

  stopRealtimeSubscription: () => {
    chatService.unsubscribeRealtimeMessages();
    set({ isRealtimeSubscribed: false });
  },

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

  retryFailedMessage: async (localUuid) => {
    await chatService.retryFailedMessage(localUuid);
    set((state) => ({
      messages: state.messages.map((m) =>
        m.local_uuid === localUuid ? { ...m, status: 'Sending' } : m
      ),
    }));
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
    // Optimistic UI update enforcing single reaction per user per message
    set((state) => ({
      messages: state.messages.map((m) => {
        if (m.id === messageId || m.local_uuid === messageId) {
          const currentReactions = m.reactions || [];
          const existingUserReaction = currentReactions.find((r) => r.profile_id === userId);

          let updatedReactions: MessageReaction[];
          if (existingUserReaction) {
            if (existingUserReaction.emoji === emoji) {
              // Same emoji -> remove reaction
              updatedReactions = currentReactions.filter((r) => r.profile_id !== userId);
            } else {
              // Different emoji -> replace reaction
              updatedReactions = currentReactions.map((r) =>
                r.profile_id === userId
                  ? { ...r, emoji, created_at: new Date().toISOString() }
                  : r
              );
            }
          } else {
            // New reaction
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

    await chatService.toggleReaction(messageId, userId, emoji);
  },

  markAsRead: async (partnerId, currentUserId) => {
    await chatService.markMessagesAsRead(partnerId, currentUserId);
    set((state) => ({
      messages: state.messages.map((m) =>
        m.sender_id === partnerId && m.status !== 'Read' ? { ...m, status: 'Read' } : m
      ),
    }));
  },

  setActiveReplyTarget: (msg) => set({ activeReplyTarget: msg }),
  setSelectedMessage: (msg) => set({ selectedMessage: msg }),
  setEditingMessage: (msg) => set({ editingMessage: msg }),
  setTargetMessageId: (id) => set({ targetMessageId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
