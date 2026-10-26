import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useCoupleStore } from '../store/useCoupleStore';
import { useGameStore } from '../store/useGameStore';
import { coupleService, type HugSignal } from '../services/coupleService';
import { USER_1_ID } from '../utils/constants';
import { LoveTapCard } from '../components/Couple/CoupleCards';

const HUG_MS = 3000; // both thumbs down this long = hug
const HEARTBEAT_MS = 400; // how often "still holding" is re-sent
const PARTNER_STALE_MS = 1200; // partner counts as released if no heartbeat this long

/** Hold-to-hug: both partners hold the heart at the same time until it pops into a hug. */
const LovePage: React.FC = () => {
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;
  const sendLove = useCoupleStore((s) => s.sendLove);
  const setInHugRoom = useCoupleStore((s) => s.setInHugRoom);

  const [holding, setHolding] = useState(false);
  const [partnerHolding, setPartnerHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hugged, setHugged] = useState(false);

  const roomRef = useRef<ReturnType<typeof coupleService.joinHugRoom> | null>(null);
  const partnerSeenRef = useRef(0);
  const holdingRef = useRef(false);

  // Join the private hug room
  useEffect(() => {
    if (!me) return;
    setInHugRoom(true);
    const room = coupleService.joinHugRoom((signal: HugSignal) => {
      if (signal.userId === me.id) return;
      partnerSeenRef.current = signal.holding ? Date.now() : 0;
      setPartnerHolding(signal.holding);
    });
    roomRef.current = room;
    return () => {
      room.send({ userId: me.id, holding: false });
      room.leave();
      setInHugRoom(false);
    };
  }, [me?.id, setInHugRoom]);

  // Heartbeat while holding; expire the partner's hold if their heartbeat stops
  useEffect(() => {
    const id = window.setInterval(() => {
      if (holdingRef.current && me) roomRef.current?.send({ userId: me.id, holding: true });
      if (partnerSeenRef.current && Date.now() - partnerSeenRef.current > PARTNER_STALE_MS) {
        partnerSeenRef.current = 0;
        setPartnerHolding(false);
      }
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [me?.id]);

  // Fill while both hold, drain otherwise
  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      // Pure updater (React may run it twice): a finished hug stays full until reset
      setProgress((p) => {
        if (p >= 1) return 1;
        return holding && partnerHolding ? Math.min(1, p + dt / HUG_MS) : Math.max(0, p - dt / 800);
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [holding, partnerHolding]);

  // Hug complete: celebrate; one partner records it so it is counted once
  useEffect(() => {
    if (progress < 1 || hugged) return;
    setHugged(true);
    navigator.vibrate?.([100, 60, 100, 60, 300]);
    if (me?.id === USER_1_ID) void sendLove('hug');
    void useGameStore.getState().award('hug', 5, `hug:${Date.now()}`);
  }, [progress, hugged, me?.id, sendLove]);

  // Ready for another hug after the celebration
  useEffect(() => {
    if (!hugged) return;
    const t = setTimeout(() => {
      setHugged(false);
      setProgress(0);
    }, 3500);
    return () => clearTimeout(t);
  }, [hugged]);

  // Gentle haptic pulses while filling
  useEffect(() => {
    if (holding && partnerHolding && progress > 0 && progress < 1) {
      const step = Math.floor(progress * 6);
      navigator.vibrate?.(10 + step * 6);
    }
  }, [Math.floor(progress * 6)]); // eslint-disable-line react-hooks/exhaustive-deps

  const press = useCallback(
    (down: boolean) => {
      if (!me || holdingRef.current === down) return;
      holdingRef.current = down;
      setHolding(down);
      roomRef.current?.send({ userId: me.id, holding: down });
    },
    [me]
  );

  const scale = 1 + progress * 0.9;
  const status = hugged
    ? 'Hug sent 🤗'
    : holding && partnerHolding
    ? 'Keep holding…'
    : holding
    ? `Waiting for ${partnerName} to hold too…`
    : partnerHolding
    ? `${partnerName} is holding — hold the heart!`
    : 'Hold the heart together for a hug';

  return (
    <div className="flex-1 flex flex-col items-center px-5 pt-6 pb-[calc(7rem+var(--safe-bottom))] lg:pb-8 gap-6 select-none">
      <div className="text-center">
        <h1 className="font-cute text-3xl font-semibold text-stone-800 dark:text-stone-100">Virtual hug</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Both of you hold the heart at the same time</p>
      </div>

      <div className="flex items-center gap-6 text-xs font-semibold">
        <span className={`flex items-center gap-1.5 ${holding ? 'text-[#E05A74]' : 'text-stone-400'}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${holding ? 'bg-[#E05A74] animate-pulse' : 'bg-stone-300'}`} /> You
        </span>
        <span className={`flex items-center gap-1.5 ${partnerHolding ? 'text-[#E05A74]' : 'text-stone-400'}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${partnerHolding ? 'bg-[#E05A74] animate-pulse' : 'bg-stone-300'}`} />
          {partnerName}
        </span>
      </div>

      <div className="relative w-72 h-72 flex items-center justify-center">
        {/* glow grows with progress */}
        <div
          className="absolute inset-0 rounded-full bg-[#F27A93] blur-3xl transition-opacity"
          style={{ opacity: 0.15 + progress * 0.55, transform: `scale(${0.6 + progress * 0.6})` }}
        />
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100" aria-hidden>
          <circle cx="50" cy="50" r="46" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-rose-100 dark:text-stone-800" />
          <circle
            cx="50" cy="50" r="46" fill="none" stroke="#E05A74" strokeWidth="2.5" strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 46}
            strokeDashoffset={2 * Math.PI * 46 * (1 - progress)}
          />
        </svg>

        <button
          type="button"
          aria-label="Hold for a hug"
          onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); press(true); }}
          onPointerUp={() => press(false)}
          onPointerCancel={() => press(false)}
          onLostPointerCapture={() => press(false)}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); press(true); } }}
          onKeyUp={() => press(false)}
          onContextMenu={(e) => e.preventDefault()}
          className="relative w-44 h-44 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-4 focus-visible:ring-rose-300"
          style={{ touchAction: 'none' }}
        >
          <motion.div animate={{ scale: holding ? scale : 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
            <Heart
              className={`w-36 h-36 drop-shadow-xl transition-colors ${
                holding || partnerHolding ? 'text-[#E05A74] fill-[#E05A74]' : 'text-[#F5A3B3] fill-[#FCD5DD]'
              } ${!holding ? 'animate-heartbeat' : ''}`}
            />
          </motion.div>
        </button>

        <AnimatePresence>
          {hugged && (
            <motion.div
              initial={{ scale: 0.2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.4, opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
              <span className="text-8xl">🤗</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="font-cute text-lg font-medium text-stone-700 dark:text-stone-200 text-center min-h-[1.75rem]" aria-live="polite">
        {status}
      </p>

      <div className="w-full max-w-md">
        <LoveTapCard />
      </div>
    </div>
  );
};

export default LovePage;
