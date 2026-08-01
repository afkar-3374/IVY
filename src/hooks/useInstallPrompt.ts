import { useEffect } from 'react';
import { useUIStore } from '../store/useUIStore';

export function useInstallPrompt() {
  const setInstallPrompt = useUIStore((state) => state.setInstallPrompt);
  const deferredInstallPrompt = useUIStore((state) => state.deferredInstallPrompt);
  const isInstallBannerVisible = useUIStore((state) => state.isInstallBannerVisible);
  const dismissInstallBanner = useUIStore((state) => state.dismissInstallBanner);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [setInstallPrompt]);

  const promptInstall = async () => {
    if (!deferredInstallPrompt) return;
    const promptEvent = deferredInstallPrompt as { prompt: () => void; userChoice: Promise<{ outcome: string }> };
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === 'accepted') {
      dismissInstallBanner();
    }
  };

  return {
    canInstall: Boolean(deferredInstallPrompt),
    isInstallBannerVisible,
    promptInstall,
    dismissInstallBanner,
  };
}
