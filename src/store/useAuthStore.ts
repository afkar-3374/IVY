import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '../types';
import { hashLoginId } from '../utils/cryptoUtils';
import { chatService } from '../services/chatService';
import { DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE, USER_1_ID, USER_2_ID } from '../utils/constants';
import { logger } from '../services/logger/logger';

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (loginId: string) => Promise<boolean>;
  logout: () => void;
  updateCurrentUser: (updates: Partial<UserProfile>) => Promise<void>;
  getPartnerProfile: () => UserProfile;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (loginId: string) => {
        set({ isLoading: true, error: null });
        try {
          const hash = await hashLoginId(loginId);
          logger.info('Authenticating user hash check...');

          const profile = await chatService.getProfileByHash(hash);
          if (profile) {
            set({ user: profile, isAuthenticated: true, isLoading: false });
            return true;
          }

          // Check predefined fallbacks for initial startup
          if (loginId.trim() === '220609') {
            set({ user: DEFAULT_USER_1_PROFILE, isAuthenticated: true, isLoading: false });
            return true;
          }
          if (loginId.trim() === '030309') {
            set({ user: DEFAULT_USER_2_PROFILE, isAuthenticated: true, isLoading: false });
            return true;
          }

          set({ isLoading: false, error: 'Invalid Login ID. Please check and try again.' });
          return false;
        } catch (err) {
          logger.error('Login error:', err);
          set({ isLoading: false, error: 'Authentication failed. Please try again.' });
          return false;
        }
      },

      logout: () => {
        logger.info('User logged out');
        set({ user: null, isAuthenticated: false, error: null });
      },

      updateCurrentUser: async (updates: Partial<UserProfile>) => {
        const current = get().user;
        if (!current) return;
        const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
        set({ user: updated });
        await chatService.updateProfile(updated);
      },

      getPartnerProfile: () => {
        const current = get().user;
        if (!current || current.id === USER_2_ID) {
          return DEFAULT_USER_1_PROFILE;
        }
        return DEFAULT_USER_2_PROFILE;
      }
    }),
    {
      name: 'ivy_auth_session',
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated })
    }
  )
);
