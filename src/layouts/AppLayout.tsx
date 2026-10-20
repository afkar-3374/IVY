import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useWallpaper } from '../hooks/useWallpaper';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ToastContainer } from '../components/ui/Toast';
import { InstallPromptBanner } from '../components/Pwa/InstallPromptBanner';
import { BottomTabBar } from '../components/Navigation/BottomTabBar';
import { SideNav } from '../components/Navigation/SideNav';
import { UsDashboard } from '../components/Couple/CoupleCards';
import { LoveBurstOverlay } from '../components/Couple/LoveBurstOverlay';
import { useCoupleStore } from '../store/useCoupleStore';
import { useGameStore } from '../store/useGameStore';
import { WeeklyScores } from '../components/Games/WeeklyScores';
import { usePresenceStore } from '../store/usePresenceStore';
import { pushService } from '../services/pushService';
import { PetalBackground } from '../components/Couple/PetalBackground';
import { CallOverlay } from '../components/Call/CallOverlay';
import { queueProcessor } from '../services/sync/queueProcessor';
import { notificationService } from '../services/notificationService';
import { useSettingsStore } from '../store/useSettingsStore';
import { useAuthStore } from '../store/useAuthStore';
import { WifiOff } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

// Re-lock with the PIN after the app has been in the background this long
const AUTO_LOCK_MS = 30_000;

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  useTheme();
  const { activePreset } = useWallpaper();
  const isOnline = useOnlineStatus();
  const notificationsEnabled = useSettingsStore((state) => state.notificationsEnabled);
  const notifyMessages = useSettingsStore((state) => state.notifyMessages);
  const notifyCalls = useSettingsStore((state) => state.notifyCalls);
  const notifySound = useSettingsStore((state) => state.notifySound);
  const notifyVibration = useSettingsStore((state) => state.notifyVibration);
  const dndEnabled = useSettingsStore((state) => state.dndEnabled);

  const isUnlocked = useAuthStore((state) => state.isAuthenticated && state.isUnlocked);
  const isChat = location.pathname === '/chat';
  const reduceMotion = useReducedMotion();
  // Settings-style pages read best as a centered column on wide screens
  const isNarrowPage = ['/settings', '/profile', '/search', '/chat/info'].includes(location.pathname);
  // Phone: the chat screen has its own composer at the bottom, so no tab bar there
  const showNav = isUnlocked && location.pathname !== '/login';

  // Couple data (start date, special dates, love taps) while unlocked
  useEffect(() => {
    if (!isUnlocked) return;
    const stopCouple = useCoupleStore.getState().init();
    const stopGames = useGameStore.getState().init();
    // Online status on every screen (used to decide when a push is needed)
    const me = useAuthStore.getState().user?.id;
    const stopPresence = me ? usePresenceStore.getState().initPresenceChannel(me) : () => {};
    void pushService.refresh();
    return () => {
      stopCouple();
      stopGames();
      stopPresence();
    };
  }, [isUnlocked]);

  useEffect(() => {
    // Start periodic background queue sync
    queueProcessor.startPeriodicSync();
    return () => queueProcessor.stopPeriodicSync();
  }, []);

  useEffect(() => {
    let hiddenAt: number | null = null;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAt = Date.now();
      } else if (hiddenAt !== null && Date.now() - hiddenAt > AUTO_LOCK_MS) {
        useAuthStore.getState().lock();
        hiddenAt = null;
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  useEffect(() => {
    notificationService.updatePreferences({ enabled: notificationsEnabled, messages: notifyMessages, calls: notifyCalls, sound: notifySound, vibration: notifyVibration, dnd: dndEnabled });
  }, [notificationsEnabled, notifyMessages, notifyCalls, notifySound, notifyVibration, dndEnabled]);

  return (
    <div className="h-[100dvh] w-full flex bg-gradient-to-br from-[#FFF7F5] via-[#FDF2F4] to-[#F7F1FB] dark:from-[#16151A] dark:via-[#1A1620] dark:to-[#16151A] text-stone-900 dark:text-stone-100 font-sans antialiased overflow-hidden">
      {!isChat && <PetalBackground />}
      {showNav && <SideNav />}

      <div className="flex-1 min-w-0 flex flex-col relative">
        {/* Offline notification banner if network drops */}
        {!isOnline && (
          <div className="bg-amber-500 text-white text-[11px] font-semibold py-1 px-3 text-center flex items-center justify-center gap-1.5 z-40">
            <WifiOff className="w-3 h-3" />
            <span>You are offline. Messages will sync automatically upon reconnecting.</span>
          </div>
        )}

        {/* PWA Install Banner */}
        <InstallPromptBanner />

        {/* Global WebRTC Audio/Video Call Overlay */}
        <CallOverlay />

        {/* Toast Notifications Portal */}
        <ToastContainer />

        {/* Floating hearts for love taps and hugs */}
        {isUnlocked && <LoveBurstOverlay />}

        {/* Main Content Area: the chat manages its own scrolling, other pages scroll here */}
        <main
          className={`flex-1 min-h-0 w-full relative ${
            isChat ? `flex flex-col ${activePreset.bgClass}` : 'block overflow-y-auto'
          }`}
        >
          {/* Smooth page entrance on every navigation */}
          <motion.div
            key={location.pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
            className={isChat ? 'flex-1 min-h-0 flex flex-col' : 'relative z-[1]'}
          >
            {isNarrowPage ? <div className="w-full max-w-2xl mx-auto lg:py-4">{children}</div> : children}
          </motion.div>
        </main>

        {showNav && !isChat && <BottomTabBar />}
      </div>

      {/* Desktop: "Us" panel next to the chat */}
      {showNav && isChat && (
        <aside className="hidden xl:block w-[22rem] flex-shrink-0 border-l border-rose-100/80 dark:border-stone-800 bg-white/50 dark:bg-[#1A1920]/60 overflow-y-auto p-5">
          <div className="flex flex-col gap-4">
            <UsDashboard compact />
            <WeeklyScores compact />
          </div>
        </aside>
      )}
    </div>
  );
};
