import { create } from 'zustand';
import type { PresenceState } from '../types';
import { supabase } from '../services/supabaseClient';
import { formatLastSeen } from '../utils/date';

interface PresenceStoreState {
  partnerPresence: PresenceState;
  setPartnerPresence: (presence: Partial<PresenceState>) => void;
  setTyping: (isTyping: boolean) => void;
  setRecordingAudio: (isRecording: boolean) => void;
  setUploadingMedia: (isUploading: boolean) => void;
  setInCall: (inCall: boolean) => void;
  getPresenceSubtext: () => string;
  initPresenceChannel: (userId: string) => () => void;
}

export const usePresenceStore = create<PresenceStoreState>((set, get) => ({
  partnerPresence: {
    profile_id: '',
    online: true,
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

  setTyping: (isTyping) =>
    set((state) => ({
      partnerPresence: { ...state.partnerPresence, typing: isTyping },
    })),

  setRecordingAudio: (isRecording) =>
    set((state) => ({
      partnerPresence: { ...state.partnerPresence, recording_audio: isRecording },
    })),

  setUploadingMedia: (isUploading) =>
    set((state) => ({
      partnerPresence: { ...state.partnerPresence, uploading_media: isUploading },
    })),

  setInCall: (inCall) =>
    set((state) => ({
      partnerPresence: { ...state.partnerPresence, in_call: inCall },
    })),

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

    const room = supabase.channel('ivy_presence_room', {
      config: { presence: { key: userId } },
    });

    room
      .on('presence', { event: 'sync' }, () => {
        const state = room.presenceState();
        Object.keys(state).forEach((key) => {
          if (key !== userId) {
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
          await room.track({
            online: true,
            typing: false,
            recording_audio: false,
            uploading_media: false,
            in_call: false,
            last_seen: new Date().toISOString(),
          });
        }
      });

    return () => {
      if (supabase && room) {
        supabase.removeChannel(room);
      }
    };
  },
}));
