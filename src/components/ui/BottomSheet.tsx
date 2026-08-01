import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 350 }}
            className="relative w-full max-h-[85vh] bg-white dark:bg-[#1E1D24] rounded-t-3xl shadow-soft-lg z-10 p-5 overflow-y-auto pb-safe border-t border-stone-100 dark:border-stone-800"
          >
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-stone-200 dark:bg-stone-700 rounded-full mx-auto mb-4" />

            {title && (
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 text-center mb-4">
                {title}
              </h3>
            )}

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
