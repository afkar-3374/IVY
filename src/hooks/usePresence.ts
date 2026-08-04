import { usePresenceStore } from '../store/usePresenceStore';

export function usePresence() {
  const partnerPresence = usePresenceStore((state) => state.partnerPresence);
  const getPresenceSubtext = usePresenceStore((state) => state.getPresenceSubtext);
  const initPresenceChannel = usePresenceStore((state) => state.initPresenceChannel);

  return {
    partnerPresence,
    subtext: getPresenceSubtext(),
    initPresenceChannel,
  };
}

