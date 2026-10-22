import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Delete } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { TimerApp } from '../components/Decoy/TimerApp';
import confetti from 'canvas-confetti';

const PIN_LENGTH = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

const LoginPage: React.FC = () => {
  const [pin, setPin] = useState('');
  // Opens as a plain timer; three taps on the time show the PIN screen
  const [showTimer, setShowTimer] = useState(true);
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const addToast = useUIStore((state) => state.addToast);

  const submit = async (code: string) => {
    const success = await login(code);
    setPin('');
    if (success) {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      addToast('Welcome back to Ivy ❤️', 'success');
    } else if (!useAuthStore.getState().error) {
      // Wrong PIN: back to the timer instead of an error
      setShowTimer(true);
    }
  };

  const press = (key: string) => {
    if (isLoading) return;
    if (key === 'del') {
      setPin((p) => p.slice(0, -1));
      return;
    }
    if (!key || pin.length >= PIN_LENGTH) return;
    const next = pin + key;
    setPin(next);
    if (next.length === PIN_LENGTH) void submit(next);
  };

  // Physical keyboard support
  useEffect(() => {
    if (showTimer) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (showTimer) {
    return <TimerApp onSecretTap={() => setShowTimer(false)} />;
  }

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 bg-gradient-to-b from-[#FDF8F6] via-[#FCE8EC]/50 to-[#FDF8F6] dark:from-[#16151A] dark:via-[#4A1D28]/30 dark:to-[#16151A] relative overflow-hidden">
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-rose-200/40 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-amber-100/40 to-transparent rounded-full blur-3xl pointer-events-none" />

      <div className="pt-6" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-sm mx-auto flex flex-col items-center text-center z-10"
      >
        <div className="relative mb-3 inline-block">
          <h1 className="font-serif italic text-6xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-cursive">
            Ivy
          </h1>
          <Heart className="w-5 h-5 text-[#C95565] fill-[#C95565] absolute -top-1 -right-4 animate-bounce" />
        </div>
        <p className="text-xs font-semibold tracking-wide text-stone-500 dark:text-stone-400 mb-8">
          Our space, just for us 🌹
        </p>

        <p className="text-xs font-semibold text-stone-600 dark:text-stone-300 mb-4">
          {isLoading ? 'Checking…' : 'Enter your PIN'}
        </p>

        {/* PIN dots */}
        <div className="flex gap-3 mb-3" aria-label={`${pin.length} of ${PIN_LENGTH} digits entered`}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <motion.span
              key={i}
              animate={{ scale: i < pin.length ? 1.15 : 1 }}
              className={`w-3.5 h-3.5 rounded-full border-2 border-[#C95565] ${
                i < pin.length ? 'bg-[#C95565]' : 'bg-transparent'
              } ${isLoading ? 'animate-pulse' : ''}`}
            />
          ))}
        </div>

        <p className="text-xs text-rose-500 font-medium h-4 mb-4">{authError}</p>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-[17rem]">
          {KEYS.map((key, i) =>
            key === '' ? (
              <span key={i} />
            ) : (
              <button
                key={i}
                type="button"
                onClick={() => press(key)}
                disabled={isLoading}
                aria-label={key === 'del' ? 'Delete' : key}
                className="h-16 rounded-full bg-white dark:bg-[#1E1D24] border border-stone-100 dark:border-stone-800 shadow-soft text-2xl font-semibold text-stone-800 dark:text-stone-100 flex items-center justify-center active:scale-95 active:bg-rose-50 dark:active:bg-[#2A1E24] transition-all disabled:opacity-60"
              >
                {key === 'del' ? <Delete className="w-6 h-6 text-stone-500" /> : key}
              </button>
            )
          )}
        </div>
      </motion.div>

      <div className="text-center pb-2 pt-6">
        <p className="text-[11px] font-medium text-stone-400 dark:text-stone-500 flex items-center justify-center gap-1">
          <span>Made with</span>
          <Heart className="w-3 h-3 text-[#C95565] fill-[#C95565] inline" />
          <span>for us</span>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
