import React, { useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useCoupleStore } from '../../store/useCoupleStore';
import { useAuthStore } from '../../store/useAuthStore';

const HEARTS = ['💗', '💖', '💕', '❤️', '💞', '💓'];

/** Floating hearts for love taps; a big message when one arrives from the partner. */
export const LoveBurstOverlay: React.FC = () => {
  const burst = useCoupleStore((s) => s.burst);
  const clearBurst = useCoupleStore((s) => s.clearBurst);
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;

  useEffect(() => {
    if (!burst) return;
    const t = setTimeout(clearBurst, burst.fromMe ? 2000 : 3200);
    return () => clearTimeout(t);
  }, [burst, clearBurst]);

  const hearts = useMemo(
    () =>
      Array.from({ length: burst?.fromMe ? 8 : 18 }, (_, i) => ({
        id: i,
        left: 8 + Math.random() * 84,
        delay: Math.random() * (burst?.fromMe ? 0.4 : 0.9),
        size: burst?.fromMe ? 18 + Math.random() * 14 : 22 + Math.random() * 26,
        emoji: HEARTS[i % HEARTS.length],
      })),
    [burst?.id]
  );

  return (
    <AnimatePresence>
      {burst && (
        <motion.div
          key={burst.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] pointer-events-none overflow-hidden"
          aria-live="polite"
        >
          {hearts.map((h) => (
            <span
              key={h.id}
              className="absolute bottom-0 animate-float-up"
              style={{ left: `${h.left}%`, fontSize: h.size, animationDelay: `${h.delay}s` }}
            >
              {h.emoji}
            </span>
          ))}

          {!burst.fromMe && (
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0.3, opacity: 0 }}
                animate={{ scale: [0.3, 1.15, 1], opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center gap-2 rounded-[2rem] bg-white/90 dark:bg-[#1E1D24]/90 backdrop-blur px-8 py-6 shadow-soft-lg"
              >
                <span className="text-6xl animate-heartbeat">{burst.kind === 'hug' ? '🤗' : '💗'}</span>
                <p className="font-cute text-lg font-semibold text-stone-800 dark:text-stone-100 text-center">
                  {burst.kind === 'hug' ? `A big hug from ${partnerName}` : `${partnerName} is thinking of you`}
                </p>
              </motion.div>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
