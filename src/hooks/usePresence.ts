import { usePresenceStore } from '../store/usePresenceStore';

export function usePresence() {
  const partnerPresence = usePresenceStore((state) => state.partnerPresence);
  const getPresenceSubtext = usePresenceStore((state) => state.getPresenceSubtext);

  return {
    partnerPresence,
    subtext: getPresenceSubtext(),
  };
}
