import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Heart, Lock, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useUIStore } from '../store/useUIStore';
import { validateLoginId } from '../utils/validation';
import confetti from 'canvas-confetti';

const LoginPage: React.FC = () => {
  const [loginId, setLoginId] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const login = useAuthStore((state) => state.login);
  const isLoading = useAuthStore((state) => state.isLoading);
  const authError = useAuthStore((state) => state.error);
  const addToast = useUIStore((state) => state.addToast);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateLoginId(loginId);
    if (!validation.isValid) {
      setInputError(validation.error || 'Invalid Login ID');
      return;
    }
    setInputError(null);

    const success = await login(loginId);
    if (success) {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
      addToast('Welcome back to Ivy ❤️', 'success');
    }
  };

  const handleQuickDemo = async (id: string) => {
    setLoginId(id);
    setInputError(null);
    const success = await login(id);
    if (success) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.7 } });
      addToast('Welcome back to Ivy ❤️', 'success');
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-6 bg-gradient-to-b from-[#FDF8F6] via-[#FCE8EC]/50 to-[#FDF8F6] dark:from-[#16151A] dark:via-[#4A1D28]/30 dark:to-[#16151A] relative overflow-hidden">
      {/* Decorative Wave & Floral Graphic Overlay */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-gradient-to-bl from-rose-200/40 to-transparent rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-80 h-80 bg-gradient-to-tr from-amber-100/40 to-transparent rounded-full blur-3xl pointer-events-none" />

      {/* Top spacing */}
      <div className="pt-8" />

      {/* Central Card Container */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-sm mx-auto flex flex-col items-center text-center z-10"
      >
        {/* Logo Header */}
        <div className="relative mb-3 inline-block">
          <h1 className="font-serif italic text-6xl font-bold tracking-tight text-stone-900 dark:text-stone-100 font-cursive">
            Ivy
          </h1>
          <Heart className="w-5 h-5 text-[#C95565] fill-[#C95565] absolute -top-1 -right-4 animate-bounce" />
        </div>
        <p className="text-xs font-semibold tracking-wide text-stone-500 dark:text-stone-400 mb-10">
          Our space, just for us 🌹
        </p>

        {/* Input Form Card */}
        <form onSubmit={handleSubmit} className="w-full bg-white dark:bg-[#1E1D24] p-6 rounded-3xl shadow-soft-lg border border-stone-100 dark:border-stone-800/80 mb-6">
          <label className="block text-left text-xs font-semibold text-stone-600 dark:text-stone-300 mb-2">
            Enter your Login ID
          </label>
          <div className="relative mb-4">
            <input
              type="password"
              value={loginId}
              onChange={(e) => {
                setLoginId(e.target.value);
                setInputError(null);
              }}
              placeholder="e.g. 220609"
              className="w-full rounded-full bg-stone-50 dark:bg-[#16151A] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 px-5 py-3.5 text-base tracking-widest text-center focus:outline-none focus:border-[#C95565] focus:ring-2 focus:ring-[#C95565]/20 font-mono transition-all"
            />
            <Heart className="w-4 h-4 text-[#C95565]/60 absolute right-4 top-1/2 -translate-y-1/2" />
          </div>

          {(inputError || authError) && (
            <p className="text-xs text-rose-500 font-medium mb-4">
              {inputError || authError}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3.5 px-6 rounded-full bg-[#C95565] hover:bg-[#B34757] text-white font-semibold text-sm shadow-soft active-scale transition-all flex items-center justify-center gap-2"
          >
            <span>{isLoading ? 'Checking...' : 'Continue'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Quick Demo Login Switcher */}
        <div className="w-full bg-stone-100/70 dark:bg-stone-800/40 p-3.5 rounded-2xl border border-stone-200/50 dark:border-stone-700/40">
          <p className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mb-2 uppercase tracking-wider">
            Quick Test Switcher
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleQuickDemo('220609')}
              className="flex-1 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#1E1D24] text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 shadow-sm hover:border-[#C95565] active-scale"
            >
              Afkar (220609)
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemo('030309')}
              className="flex-1 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-[#1E1D24] text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700 shadow-sm hover:border-[#C95565] active-scale"
            >
              Princess (030309)
            </button>
          </div>
        </div>
      </motion.div>

      {/* Footer */}
      <div className="text-center pb-4">
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
