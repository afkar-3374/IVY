import { create } from 'zustand';

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'error';
  message: string;
}

interface UIState {
  activeModal: string | null;
  activeBottomSheet: string | null;
  isEmojiPickerOpen: boolean;
  isActionSheetOpen: boolean;
  isReactionsModalOpen: boolean;
  isInstallBannerVisible: boolean;
  deferredInstallPrompt: unknown | null;
  toasts: ToastMessage[];
  globalLoading: boolean;

  openModal: (modalId: string) => void;
  closeModal: () => void;
  openBottomSheet: (sheetId: string) => void;
  closeBottomSheet: () => void;
  setEmojiPickerOpen: (open: boolean) => void;
  setActionSheetOpen: (open: boolean) => void;
  setReactionsModalOpen: (open: boolean) => void;
  setInstallPrompt: (prompt: unknown) => void;
  dismissInstallBanner: () => void;
  addToast: (message: string, type?: ToastMessage['type']) => void;
  removeToast: (id: string) => void;
  setGlobalLoading: (loading: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  activeModal: null,
  activeBottomSheet: null,
  isEmojiPickerOpen: false,
  isActionSheetOpen: false,
  isReactionsModalOpen: false,
  isInstallBannerVisible: true,
  deferredInstallPrompt: null,
  toasts: [],
  globalLoading: false,

  openModal: (modalId) => set({ activeModal: modalId }),
  closeModal: () => set({ activeModal: null }),
  openBottomSheet: (sheetId) => set({ activeBottomSheet: sheetId }),
  closeBottomSheet: () => set({ activeBottomSheet: null }),
  setEmojiPickerOpen: (open) => set({ isEmojiPickerOpen: open }),
  setActionSheetOpen: (open) => set({ isActionSheetOpen: open }),
  setReactionsModalOpen: (open) => set({ isReactionsModalOpen: open }),
  setInstallPrompt: (prompt) => set({ deferredInstallPrompt: prompt }),
  dismissInstallBanner: () => set({ isInstallBannerVisible: false }),
  addToast: (message, type = 'info') => {
    const id = 'toast_' + Math.random().toString(36).substring(2, 9);
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 3500);
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  setGlobalLoading: (loading) => set({ globalLoading: loading }),
}));
