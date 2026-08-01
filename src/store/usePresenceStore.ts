import { create } from 'zustand';
import type { PresenceState } from '../types';

interface PresenceStoreState {
  partnerPresence: PresenceState;
  setPartnerPresence: (presence: Partial<PresenceState>) => void;
  setTyping: (isTyping: boolean) => void;
  setRecordingAudio: (isRecording: boolean) => void;
  setUploadingMedia: (isUploading: boolean) => void;
  getPresenceSubtext: () => string;
}

export const usePresenceStore = create<PresenceStoreState>((set, get) => ({
  partnerPresence: {
    profile_id: '',
    online: true,
    typing: false,
    recording_audio: false,
    uploading_media: false,
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

  getPresenceSubtext: () => {
    const { partnerPresence } = get();
    if (partnerPresence.typing) return 'Typing...';
    if (partnerPresence.recording_audio) return 'Recording Voice...';
    if (partnerPresence.uploading_media) return 'Uploading...';
    if (partnerPresence.online) return 'Online';
    return 'Online';
  },
}));
