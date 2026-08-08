import { create } from 'zustand';
import type { PresenceState } from '../types';
import { supabase } from '../services/supabaseClient';
import { formatLastSeen } from '../utils/date';
import { logger } from '../services/logger/logger';

let room: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
let activeUserId: string | null = null;
let recoveryTimer: number | null = null;
let lifecycleCleanup: (() => void) | null = null;
let ownPresence = {
  online: true,
  typing: false,
  recording_audio: false,
  uploading_media: false,
  in_call: false,
};

interface PresenceStoreState {
  partnerPresence: PresenceState;
  setPartnerPresence: (presence: Partial<PresenceState>) => void;
  setTyping: (isTyping: boolean) => void;
  setRecordingAudio: (isRecording: boolean) => void;
  setUploadingMedia: (isUploading: boolean) => void;
  setInCall: (inCall: boolean) => void;
  getPresenceSubtext: () => string;
  initPresenceChannel: (userId: string) => () => void;
  refreshPresence: () => void;
}

const trackOwnPresence = () => {
  if (!room) return;
  room.track({ ...ownPresence, last_seen: new Date().toISOString() }).catch((error) => {
    logger.warn('Unable to refresh presence:', error);
  });
};

export const usePresenceStore = create<PresenceStoreState>((set, get) => ({
  partnerPresence: {
    profile_id: '',
    online: false,
    typing: false,
    recording_audio: false,
    uploading_media: false,
    in_call: false,
    last_seen: new Date().toISOString(),
  },

  setPartnerPresence: (updates) =>
    set((state) => ({
      partnerPresence: { ...state.partnerPresence, ...updates },
    })),

  setTyping: (isTyping) => {
    ownPresence.typing = isTyping;
    trackOwnPresence();
  },

  setRecordingAudio: (isRecording) => {
    ownPresence.recording_audio = isRecording;
    trackOwnPresence();
  },

  setUploadingMedia: (isUploading) => {
    ownPresence.uploading_media = isUploading;
    trackOwnPresence();
  },

  setInCall: (inCall) => {
    ownPresence.in_call = inCall;
    trackOwnPresence();
  },

  getPresenceSubtext: () => {
    const { partnerPresence } = get();
    if (partnerPresence.typing) return 'Typing...';
    if (partnerPresence.recording_audio) return 'Recording Voice...';
    if (partnerPresence.uploading_media) return 'Uploading media...';
    if (partnerPresence.in_call) return 'In Call';
    if (partnerPresence.online) return 'Online';
    return formatLastSeen(partnerPresence.last_seen);
  },

  initPresenceChannel: (userId: string) => {
    if (!supabase) return () => {};

    if (room && activeUserId === userId) return () => {};
    if (room) supabase.removeChannel(room);
    lifecycleCleanup?.();
    activeUserId = userId;

    room = supabase.channel('ivy_presence_room', {
      config: { presence: { key: userId } },
    });

    const activeRoom = room;

    activeRoom
      .on('presence', { event: 'sync' }, () => {
        const state = activeRoom.presenceState();
        let foundPartner = false;
        Object.keys(state).forEach((key) => {
          if (key !== userId) {
            foundPartner = true;
            const presences = state[key] as any[];
            if (presences && presences.length > 0) {
              const latest = presences[presences.length - 1];
              set({
                partnerPresence: {
                  profile_id: key,
                  online: true,
                  typing: Boolean(latest.typing),
                  recording_audio: Boolean(latest.recording_audio),
                  uploading_media: Boolean(latest.uploading_media),
                  in_call: Boolean(latest.in_call),
                  last_seen: latest.last_seen || new Date().toISOString(),
                },
              });
            }
          }
        });
        if (!foundPartner) {
          set((state) => ({ partnerPresence: { ...state.partnerPresence, online: false, typing: false, recording_audio: false, uploading_media: false, in_call: false } }));
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (leftPresences && leftPresences.length > 0) {
          set((state) => ({
            partnerPresence: {
              ...state.partnerPresence,
              online: false,
              typing: false,
              last_seen: new Date().toISOString(),
            },
          }));
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          trackOwnPresence();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          if (recoveryTimer === null) {
            recoveryTimer = window.setTimeout(() => {
              recoveryTimer = null;
              if (activeUserId === userId) get().refreshPresence();
            }, 1500);
          }
        }
      });

    const recover = () => get().refreshPresence();
    const onVisible = () => { if (document.visibilityState === 'visible') recover(); };
    window.addEventListener('online', recover);
    window.addEventListener('pageshow', recover);
    document.addEventListener('visibilitychange', onVisible);
    lifecycleCleanup = () => {
      window.removeEventListener('online', recover);
      window.removeEventListener('pageshow', recover);
      document.removeEventListener('visibilitychange', onVisible);
    };

    return () => {
      if (activeUserId !== userId) return;
      lifecycleCleanup?.();
      lifecycleCleanup = null;
      if (recoveryTimer !== null) clearTimeout(recoveryTimer);
      recoveryTimer = null;
      if (supabase && room) supabase.removeChannel(room);
      room = null;
      activeUserId = null;
    };
  },

  refreshPresence: () => {
    if (!activeUserId) return;
    const userId = activeUserId;
    if (room && supabase) supabase.removeChannel(room);
    room = null;
    activeUserId = null;
    get().initPresenceChannel(userId);
  },
}));
