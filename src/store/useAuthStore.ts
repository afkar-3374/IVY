import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserProfile } from '../types';
import { supabase } from '../services/supabaseClient';
import { chatService } from '../services/chatService';
import {
  unwrapCoupleKey,
  setCoupleKey,
  cacheVault,
  getCachedVault,
  clearCachedVault,
  type KeyVaultRow,
} from '../services/crypto/coupleCrypto';
import { DEFAULT_USER_1_PROFILE, DEFAULT_USER_2_PROFILE, USER_1_ID, ACCOUNT_EMAILS } from '../utils/constants';
import { logger } from '../services/logger/logger';
import { ivyDb } from '../db/ivyDb';
import { useChatStore } from './useChatStore';

interface AuthState {
  user: UserProfile | null;
  partner: UserProfile | null;
  isAuthenticated: boolean;
  /** True only while the couple key is in memory. Never persisted: every app start is locked. */
  isUnlocked: boolean;
  isLoading: boolean;
  error: string | null;
  login: (pin: string) => Promise<boolean>;
  lock: () => void;
  logout: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  updateCurrentUser: (updates: Partial<UserProfile>) => Promise<void>;
  getPartnerProfile: () => UserProfile;
}

const defaultProfileFor = (id: string) => (id === USER_1_ID ? DEFAULT_USER_1_PROFILE : DEFAULT_USER_2_PROFILE);

async function clearLocalData(): Promise<void> {
  await Promise.all([
    ivyDb.messages.clear(),
    ivyDb.reactions.clear(),
    ivyDb.syncQueue.clear(),
    ivyDb.profiles.clear(),
    ivyDb.attachments.clear(),
    ivyDb.callLogs.clear(),
  ]);
}

let profilesUnsubscribe: (() => void) | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      partner: null,
      isAuthenticated: false,
      isUnlocked: false,
      isLoading: false,
      error: null,

      login: async (pin: string) => {
        set({ isLoading: true, error: null });
        const code = pin.trim();
        try {
          // 1. Unlocking the account already signed in on this device works offline.
          const cached = getCachedVault();
          const { data: sessionData } = supabase ? await supabase.auth.getSession() : { data: { session: null } };
          if (cached && sessionData.session?.user.id === cached.userId && get().user?.id === cached.userId) {
            try {
              setCoupleKey(await unwrapCoupleKey(code, cached.vault));
              set({ isUnlocked: true, isLoading: false });
              void get().refreshProfiles();
              return true;
            } catch {
              /* not this account's PIN: fall through to a full sign-in */
            }
          }

          if (!supabase) throw new Error('Backend not configured');

          // 2. The PIN is the account password; find which partner it belongs to.
          for (const email of ACCOUNT_EMAILS) {
            const { data, error } = await supabase.auth.signInWithPassword({ email, password: code });
            if (error || !data.user) continue;

            const { data: vault, error: vaultError } = await supabase
              .from('key_vault')
              .select('salt, iv, wrapped_key, iterations')
              .eq('user_id', data.user.id)
              .single();
            if (vaultError || !vault) throw new Error(vaultError?.message || 'Missing key');

            setCoupleKey(await unwrapCoupleKey(code, vault as KeyVaultRow));
            cacheVault(data.user.id, vault as KeyVaultRow);

            if (get().user && get().user!.id !== data.user.id) {
              // Different partner on this device: never show the other one's cached data.
              useChatStore.getState().stopRealtimeSubscription();
              useChatStore.setState({ messages: [] });
              await clearLocalData();
            }

            set({ user: defaultProfileFor(data.user.id), isAuthenticated: true, isUnlocked: true, isLoading: false });
            await get().refreshProfiles();
            return true;
          }

          set({ isLoading: false });
          return false;
        } catch (err) {
          logger.error('Login error:', err);
          set({ isLoading: false, error: 'Something went wrong. Please try again.' });
          return false;
        }
      },

      lock: () => {
        if (!get().isUnlocked) return;
        useChatStore.getState().stopRealtimeSubscription();
        setCoupleKey(null);
        set({ isUnlocked: false });
      },

      logout: async () => {
        logger.info('User logged out');
        useChatStore.getState().stopRealtimeSubscription();
        useChatStore.setState({ messages: [], activeReplyTarget: null, selectedMessage: null, editingMessage: null });
        profilesUnsubscribe?.();
        profilesUnsubscribe = null;
        setCoupleKey(null);
        clearCachedVault();
        await clearLocalData();
        if (supabase) await supabase.auth.signOut();
        set({ user: null, partner: null, isAuthenticated: false, isUnlocked: false, error: null });
      },

      refreshProfiles: async () => {
        const current = get().user;
        if (!current) return;
        const profiles = await chatService.getProfiles();
        const me = profiles.find((p) => p.id === current.id);
        const partner = profiles.find((p) => p.id !== current.id);
        set({ user: me || current, partner: partner || get().partner });

        if (!profilesUnsubscribe) {
          profilesUnsubscribe = chatService.subscribeToProfileChanges(() => {
            void get().refreshProfiles();
          });
        }
      },

      updateCurrentUser: async (updates: Partial<UserProfile>) => {
        const current = get().user;
        if (!current) return;
        const updated = { ...current, ...updates, updated_at: new Date().toISOString() };
        set({ user: updated });
        await chatService.updateProfile(updated);
      },

      getPartnerProfile: () => {
        const { user, partner } = get();
        if (partner) return partner;
        return defaultProfileFor(user?.id === USER_1_ID ? DEFAULT_USER_2_PROFILE.id : USER_1_ID);
      },
    }),
    {
      name: 'ivy_auth_session',
      // Only remember who is signed in; decrypted profile details stay in memory.
      partialize: (state) => ({
        user: state.user ? defaultProfileFor(state.user.id) : null,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
