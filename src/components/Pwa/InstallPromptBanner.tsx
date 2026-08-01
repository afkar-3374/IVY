import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';

export const InstallPromptBanner: React.FC = () => {
  const { canInstall, isInstallBannerVisible, promptInstall, dismissInstallBanner } = useInstallPrompt();

  if (!canInstall || !isInstallBannerVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -50, opacity: 0 }}
        className="fixed top-2 left-4 right-4 z-40 max-w-md mx-auto bg-gradient-to-r from-[#FCE8EC] to-[#F3DBD3] dark:from-[#4A1D28] dark:to-[#28262E] p-3 rounded-2xl shadow-soft border border-[#C95565]/30 flex items-center justify-between"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[#C95565] text-white flex items-center justify-center font-serif text-sm font-bold shadow-soft">
            Ivy
          </div>
          <div>
            <p className="text-xs font-bold text-stone-900 dark:text-stone-100">Install Ivy App</p>
            <p className="text-[10px] text-stone-500 dark:text-stone-300">Add to home screen for native experience</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={promptInstall}
            className="px-3 py-1 bg-[#C95565] text-white text-xs font-semibold rounded-full shadow-soft hover:bg-[#B34757] flex items-center gap-1 active-scale"
          >
            <Download className="w-3 h-3" />
            <span>Install</span>
          </button>
          <button
            onClick={dismissInstallBanner}
            className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
