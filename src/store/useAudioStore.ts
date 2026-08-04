import { create } from 'zustand';

interface AudioStoreState {
  activeAudioId: string | null;
  playbackSpeed: 1 | 1.5 | 2;
  setActiveAudioId: (id: string | null) => void;
  setPlaybackSpeed: (speed: 1 | 1.5 | 2) => void;
  stopAll: () => void;
}

export const useAudioStore = create<AudioStoreState>((set) => ({
  activeAudioId: null,
  playbackSpeed: 1,

  setActiveAudioId: (id) => set({ activeAudioId: id }),
  setPlaybackSpeed: (speed) => set({ playbackSpeed: speed }),
  stopAll: () => set({ activeAudioId: null }),
}));
