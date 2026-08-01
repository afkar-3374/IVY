import { useEffect } from 'react';
import { useChatStore } from '../store/useChatStore';

export function useInfiniteMessages() {
  const messages = useChatStore((state) => state.messages);
  const isLoadingMessages = useChatStore((state) => state.isLoadingMessages);
  const hasMoreMessages = useChatStore((state) => state.hasMoreMessages);
  const loadInitialMessages = useChatStore((state) => state.loadInitialMessages);
  const loadMoreMessages = useChatStore((state) => state.loadMoreMessages);

  useEffect(() => {
    loadInitialMessages();
  }, [loadInitialMessages]);

  return {
    messages,
    isLoadingMessages,
    hasMoreMessages,
    loadMoreMessages,
  };
}
