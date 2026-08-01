import { useState, useRef, useCallback } from 'react';
import { usePresenceStore } from '../store/usePresenceStore';

export function useTyping(timeoutMs = 2500) {
  const [isSelfTyping, setIsSelfTyping] = useState(false);
  const timerRef = useRef<number | null>(null);
  const setTyping = usePresenceStore((state) => state.setTyping);

  const triggerTyping = useCallback(() => {
    setIsSelfTyping(true);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    timerRef.current = window.setTimeout(() => {
      setIsSelfTyping(false);
      setTyping(false);
    }, timeoutMs);
  }, [setTyping, timeoutMs]);

  return { isSelfTyping, triggerTyping };
}
