import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTheme } from '../hooks/useTheme';
import { useWallpaper } from '../hooks/useWallpaper';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { ToastContainer } from '../components/ui/Toast';
import { InstallPromptBanner } from '../components/Pwa/InstallPromptBanner';
import { BottomTabBar } from '../components/Navigation/BottomTabBar';
import { queueProcessor } from '../services/sync/queueProcessor';
import { WifiOff } from 'lucide-react';

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const location = useLocation();
  useTheme();
  const { activePreset } = useWallpaper();
  const isOnline = useOnlineStatus();

  const isLoginPage = location.pathname === '/login';

  useEffect(() => {
    // Start periodic background queue sync
    queueProcessor.startPeriodicSync();
    return () => queueProcessor.stopPeriodicSync();
  }, []);

  return (
    <div className="min-h-screen w-full flex justify-center bg-[#FDF8F6] dark:bg-[#16151A] text-stone-900 dark:text-stone-100 font-sans antialiased overflow-x-hidden">
      {/* Desktop & Mobile Responsive Frame Container */}
      <div className={`w-full max-w-md min-h-screen flex flex-col relative shadow-2xl transition-all duration-300 ${activePreset.bgClass}`}>
        
        {/* Offline notification banner if network drops */}
        {!isOnline && (
          <div className="bg-amber-500 text-white text-[11px] font-semibold py-1 px-3 text-center flex items-center justify-center gap-1.5 z-40">
            <WifiOff className="w-3 h-3" />
            <span>You are offline. Messages will sync automatically upon reconnecting.</span>
          </div>
        )}

        {/* PWA Install Banner */}
        <InstallPromptBanner />

        {/* Toast Notifications Portal */}
        <ToastContainer />

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col w-full relative">
          {children}
        </main>

        {/* Bottom Tab Bar Navigation (Hidden on Login Page) */}
        {!isLoginPage && <BottomTabBar />}
      </div>
    </div>
  );
};
