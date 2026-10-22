import React, { useEffect, useRef, useState } from 'react';
import { motion, useAnimationControls } from 'framer-motion';
import { Play, Pause, RotateCcw, Minus, Plus } from 'lucide-react';

/**
 * What Ivy shows when it opens or locks (and after a wrong PIN): a fully working
 * kitty timer. Tapping the kitty three times quickly opens the PIN screen.
 */

const PRESETS = [1, 5, 10, 25];
const TAP_WINDOW_MS = 2000;
const THEME_COLOR = '#FFF4E8';
const APP_THEME_COLOR = '#FDF8F6';
const RING_RADIUS = 118;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function playChime(): void {
  try {
    const ctx = new AudioContext();
    [659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* audio unavailable */
  }
  navigator.vibrate?.([200, 100, 200]);
}

interface KittyTimerProps {
  onSecretTap: () => void;
}

export const KittyTimer: React.FC<KittyTimerProps> = ({ onSecretTap }) => {
  const [minutes, setMinutes] = useState(5);
  const [remaining, setRemaining] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const wiggle = useAnimationControls();
  const endAtRef = useRef<number | null>(null);
  const tapsRef = useRef<number[]>([]);

  // Looks like a timer app all the way: tab title and status bar
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    document.title = 'Kitty Timer';
    if (meta) meta.content = THEME_COLOR;
    // Unlocked: Ivy's own name and status bar
    return () => {
      document.title = 'Ivy';
      if (meta) meta.content = APP_THEME_COLOR;
    };
  }, []);

  const total = minutes * 60;
  const progress = total > 0 ? remaining / total : 0;

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.round(((endAtRef.current ?? Date.now()) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        setFinished(true);
        endAtRef.current = null;
        playChime();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);

  const setDuration = (m: number) => {
    const clamped = Math.min(99, Math.max(1, m));
    setMinutes(clamped);
    setRemaining(clamped * 60);
    setRunning(false);
    setFinished(false);
    endAtRef.current = null;
  };

  const toggleRun = () => {
    if (running) {
      setRunning(false);
      endAtRef.current = null;
      return;
    }
    const startFrom = remaining > 0 ? remaining : total;
    setRemaining(startFrom);
    setFinished(false);
    endAtRef.current = Date.now() + startFrom * 1000;
    setRunning(true);
  };

  const reset = () => setDuration(minutes);

  const handleKittyTap = () => {
    void wiggle.start({ rotate: [0, -8, 8, -4, 0], transition: { duration: 0.4 } });
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < TAP_WINDOW_MS), now];
    if (tapsRef.current.length >= 3) {
      tapsRef.current = [];
      onSecretTap();
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-between px-6 py-10 bg-gradient-to-b from-[#FFF4E8] via-[#FFE9EF] to-[#F3EDFF] dark:from-[#1B1722] dark:via-[#251B2A] dark:to-[#16151A] select-none">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 tracking-tight">Kitty Timer</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
          {finished ? 'Time is up! 🐾' : running ? 'Purring along…' : 'Pick a time and press start'}
        </p>
      </div>

      {/* Kitty + progress ring */}
      <div className="relative w-[280px] h-[280px] flex items-center justify-center">
        <svg viewBox="0 0 280 280" className="absolute inset-0 -rotate-90" aria-hidden>
          <circle cx="140" cy="140" r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth="14" className="text-white/70 dark:text-white/10" />
          <circle
            cx="140"
            cy="140"
            r={RING_RADIUS}
            fill="none"
            stroke="url(#ringGradient)"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - progress)}
            style={{ transition: 'stroke-dashoffset 0.3s linear' }}
          />
          <defs>
            <linearGradient id="ringGradient" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F9A8D4" />
              <stop offset="100%" stopColor="#C4B5FD" />
            </linearGradient>
          </defs>
        </svg>

        <motion.button
          type="button"
          onClick={handleKittyTap}
          aria-label="Kitty"
          animate={wiggle}
          className="relative focus:outline-none"
        >
          <motion.svg
            width="170"
            height="170"
            viewBox="0 0 170 170"
            animate={running ? { y: [0, -6, 0] } : finished ? { y: [0, -14, 0] } : { y: 0 }}
            transition={{ duration: running ? 1.2 : 0.5, repeat: running || finished ? Infinity : 0, ease: 'easeInOut' }}
          >
            {/* ears */}
            <path d="M32 62 L44 14 L78 44 Z" fill="#FBCFE8" stroke="#F472B6" strokeWidth="3" strokeLinejoin="round" />
            <path d="M138 62 L126 14 L92 44 Z" fill="#FBCFE8" stroke="#F472B6" strokeWidth="3" strokeLinejoin="round" />
            <path d="M44 52 L49 28 L66 44 Z" fill="#F9A8D4" />
            <path d="M126 52 L121 28 L104 44 Z" fill="#F9A8D4" />
            {/* head */}
            <ellipse cx="85" cy="92" rx="66" ry="58" fill="#FFF7FB" stroke="#F472B6" strokeWidth="3" />
            {/* eyes (blink) */}
            <motion.g
              animate={{ scaleY: finished ? 0.15 : [1, 1, 0.1, 1] }}
              transition={{ duration: 3.5, repeat: finished ? 0 : Infinity, times: [0, 0.9, 0.95, 1] }}
              style={{ originY: '86px' }}
            >
              <ellipse cx="62" cy="86" rx="8" ry="10" fill="#3F3F46" />
              <ellipse cx="108" cy="86" rx="8" ry="10" fill="#3F3F46" />
              <circle cx="65" cy="82" r="3" fill="#fff" />
              <circle cx="111" cy="82" r="3" fill="#fff" />
            </motion.g>
            {/* blush */}
            <ellipse cx="46" cy="106" rx="10" ry="6" fill="#FBCFE8" />
            <ellipse cx="124" cy="106" rx="10" ry="6" fill="#FBCFE8" />
            {/* nose + mouth */}
            <path d="M80 100 L90 100 L85 106 Z" fill="#F472B6" />
            <path d="M85 106 Q78 116 70 110 M85 106 Q92 116 100 110" fill="none" stroke="#3F3F46" strokeWidth="2.5" strokeLinecap="round" />
            {/* whiskers */}
            <path d="M30 98 L52 102 M28 110 L52 108 M140 98 L118 102 M142 110 L118 108" stroke="#D4D4D8" strokeWidth="2" strokeLinecap="round" />
          </motion.svg>
        </motion.button>
      </div>

      <div className="w-full max-w-xs flex flex-col items-center gap-5">
        <div className="text-6xl font-bold tabular-nums text-stone-800 dark:text-stone-100 tracking-tight">
          {formatTime(remaining)}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setDuration(minutes - 1)}
            disabled={running}
            aria-label="One minute less"
            className="w-10 h-10 rounded-full bg-white/80 dark:bg-white/10 text-stone-600 dark:text-stone-200 flex items-center justify-center shadow-sm disabled:opacity-40"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-stone-600 dark:text-stone-300 w-16 text-center">{minutes} min</span>
          <button
            type="button"
            onClick={() => setDuration(minutes + 1)}
            disabled={running}
            aria-label="One minute more"
            className="w-10 h-10 rounded-full bg-white/80 dark:bg-white/10 text-stone-600 dark:text-stone-200 flex items-center justify-center shadow-sm disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDuration(p)}
              disabled={running}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors disabled:opacity-40 ${
                minutes === p ? 'bg-pink-400 text-white' : 'bg-white/80 dark:bg-white/10 text-stone-600 dark:text-stone-300'
              }`}
            >
              {p}m
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={reset}
            aria-label="Reset"
            className="w-12 h-12 rounded-full bg-white/80 dark:bg-white/10 text-stone-600 dark:text-stone-200 flex items-center justify-center shadow-sm"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={toggleRun}
            aria-label={running ? 'Pause' : 'Start'}
            className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-violet-400 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
          >
            {running ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
          </button>
          <div className="w-12 h-12" />
        </div>
      </div>
    </div>
  );
};
