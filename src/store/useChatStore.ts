import { create } from 'zustand';
import type { Message, MessageReaction, MessageType } from '../types';
import { chatService } from '../services/chatService';
import { generateLocalUuid } from '../utils/message';
import { notificationService } from '../services/notificationService';
import { USER_1_ID, DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE } from '../utils/constants';
import { useAuthStore } from './useAuthStore';

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

const TICK_ORDER: Record<string, number> = { Failed: 0, Queued: 1, Sending: 1, Retrying: 1, Sent: 2, Delivered: 3, Read: 4 };
/** Keep the furthest delivery status (e.g. a late "sent" event must not undo "read"). */
function furthest(a: Message['status'], b: Message['status']): Message['status'] {
  return (TICK_ORDER[b] ?? 0) >= (TICK_ORDER[a] ?? 0) ? b : a;
}

/** Results from the send queue (and background file downloads) update the visible chat directly. */
if (typeof window !== 'undefined') {
  window.addEventListener('ivy:message-content', (e) => {
    const { localUuid, content } = (e as CustomEvent<{ localUuid: string; content: string }>).detail;
    useChatStore.setState((state) => ({
      messages: state.messages.map((m) => (m.local_uuid === localUuid ? { ...m, content } : m)),
    }));
  });
  window.addEventListener('ivy:message-status', (e) => {
    const { localUuid, status, id } = (e as CustomEvent<{ localUuid: string; status: Message['status']; id?: string }>).detail;
    useChatStore.setState((state) => ({
      messages: state.messages.map((m) =>
        m.local_uuid === localUuid && m.status !== 'Read' && m.status !== 'Delivered'
          ? { ...m, status, id: id || m.id }
          : m
      ),
    }));
  });
}

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

    // Connect live first: nothing sent while history loads can be missed
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
                  ? {
                      ...m,
                      ...incomingMsg,
                      status: furthest(m.status, incomingMsg.status),
                      delivered_at: incomingMsg.delivered_at ?? m.delivered_at,
                      read_at: incomingMsg.read_at ?? m.read_at,
                    }
                  : m
              ),
            };
          }
          const currentUserId = useAuthStore.getState().user?.id;
          const isIncoming = Boolean(currentUserId) &&
            incomingMsg.sender_id !== currentUserId &&
            incomingMsg.message_type !== 'system';
          if (isIncoming) {
            const senderProfile = incomingMsg.sender_id === USER_1_ID
              ? DEFAULT_USER_1_PROFILE
              : DEFAULT_USER_2_PROFILE;
            notificationService.notifyNewMessage(
              incomingMsg.local_uuid || incomingMsg.id || String(Date.now()),
              senderProfile.nickname || senderProfile.display_name,
              'Sent you a message ❤️', // never show message text on the lock screen
              incomingMsg.message_type
            );
          }
          const nextMessages = [...state.messages, incomingMsg];
          if (isIncoming) {
            const unreadCount = nextMessages.filter((message) =>
              message.sender_id === incomingMsg.sender_id && message.status !== 'Read'
            ).length;
            void notificationService.setBadge(unreadCount);
          }
          return { messages: nextMessages };
        });
      }, (allMessages) => {
        set((state) => {
          const byId = new Map(allMessages.map((m) => [m.local_uuid, m]));
          return { messages: state.messages.map((m) => byId.get(m.local_uuid) || m) };
        });
      }, async () => {
        // Catch up on anything missed while (re)connecting, keeping the loaded window size
        const all = await chatService.getMessages();
        set((state) => {
          const keep = Math.max(PAGE_SIZE, state.messages.length);
          return { messages: all.slice(-keep), hasMoreMessages: all.length > keep };
        });
      });
    }

    // Show what is cached on this device straight away, then refresh from the server
    const cached = await chatService.getMessages(false);
    if (cached.length > 0 && get().messages.length === 0) {
      set({ messages: cached.slice(-PAGE_SIZE), hasMoreMessages: cached.length > PAGE_SIZE, isLoadingMessages: false });
    }
    const msgs = await chatService.getMessages();
    set((state) => {
      const keep = Math.max(PAGE_SIZE, state.messages.length);
      return {
        messages: msgs.slice(-keep),
        isLoadingMessages: false,
        hasMoreMessages: msgs.length > keep,
        pageOffset: 0,
      };
    });
  },

  loadMoreMessages: async () => {
    const { isLoadingMessages, hasMoreMessages, messages } = get();
    if (isLoadingMessages || !hasMoreMessages) return;
    set({ isLoadingMessages: true });
    try {
      // The page just before the oldest message on screen (from this device's copy)
      const all = await chatService.getMessages(false);
      const oldest = messages[0];
      const end = oldest ? all.findIndex((m) => m.local_uuid === oldest.local_uuid) : all.length;
      const stop = end === -1 ? 0 : end;
      const start = Math.max(0, stop - PAGE_SIZE);
      const older = all.slice(start, stop);
      set((state) => ({
        messages: [...older, ...state.messages],
        pageOffset: state.pageOffset + older.length,
        hasMoreMessages: start > 0,
        isLoadingMessages: false,
      }));
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
    await notificationService.clearBadge();
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
