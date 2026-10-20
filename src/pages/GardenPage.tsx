import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Droplets, Sparkles, Star, Flower2, Trophy } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';
import { gardenLevel, sumBy, GARDEN_LEVELS } from '../utils/scores';
import { todayKey } from '../data/gameQuestions';
import { cardClass } from '../components/Couple/CoupleCards';
import { GardenScene, type Phase } from '../components/Garden/GardenScene';
import { Reveal } from '../components/ui/Reveal';
import { BuildShop } from '../components/Garden/BuildShop';

const LEVEL_SEEN_KEY = 'ivy_garden_level_seen';

function phaseFor(hour: number): Phase {
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'sunset';
  return 'night';
}

/** The shared love garden: grows with all-time love points, starry at night. */
const GardenPage: React.FC = () => {
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;
  const points = useGameStore((s) => s.points);
  const loaded = useGameStore((s) => s.loaded);
  const award = useGameStore((s) => s.award);
  const builds = useGameStore((s) => s.builds);
  const justBuilt = useGameStore((s) => s.justBuilt);
  const [watering, setWatering] = useState(false);
  const [levelUp, setLevelUp] = useState<string | null>(null);

  const total = sumBy(points);
  const { current, next, progress } = gardenLevel(total);
  const phase = phaseFor(new Date().getHours());
  const today = todayKey();
  const iWatered = points.some((p) => p.user_id === me?.id && p.ref === `garden:${today}`);
  const theyWatered = points.some((p) => p.user_id === partner.id && p.ref === `garden:${today}`);
  const hugs = points.filter((p) => p.source === 'hug' && p.user_id === me?.id).length;
  const flowerCount = Math.min(64, Math.floor(total / 15));
  // Love coins: everything earned minus what has been built
  const coins = Math.max(0, total - builds.reduce((t, b) => t + b.cost, 0));

  // Celebrate reaching a new level (once per level, per device)
  useEffect(() => {
    if (!loaded) return;
    let seen = current.level; // a device's first visit just remembers the level
    try {
      const stored = localStorage.getItem(LEVEL_SEEN_KEY);
      if (stored) seen = Number(stored);
    } catch {
      /* storage unavailable */
    }
    if (current.level > seen) {
      setLevelUp(current.name);
      navigator.vibrate?.([60, 40, 60, 40, 160]);
      setTimeout(() => setLevelUp(null), 3800);
    }
    try {
      localStorage.setItem(LEVEL_SEEN_KEY, String(current.level));
    } catch {
      /* storage unavailable */
    }
  }, [loaded, current.level, current.name]);

  const water = async () => {
    if (iWatered || watering) return;
    setWatering(true);
    navigator.vibrate?.(40);
    await award('garden', 3, `garden:${today}`);
    setTimeout(() => setWatering(false), 2600);
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-10">
      <div className="mb-5">
        <h1 className="font-serif italic text-4xl lg:text-5xl text-stone-800 dark:text-stone-100">
          Our <span className="text-gradient pr-1">garden</span>
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
          {phase === 'night' ? 'Every star above is a hug you shared ✨' : 'Every love tap, hug and game makes it bloom'}
        </p>
      </div>

      {/* Scene */}
      <Reveal>
        <div id="garden-scene" className="relative w-full aspect-[5/4] sm:aspect-[4/3] lg:aspect-[16/9] rounded-[2rem] overflow-hidden shadow-[0_30px_60px_-30px_rgba(120,40,90,0.55)] ring-1 ring-white/70 dark:ring-white/10">
          <GardenScene
            total={total}
            level={current.level}
            progress={progress}
            phase={phase}
            stars={hugs}
            watering={watering}
            builds={builds.map((b) => b.item)}
            justBuilt={justBuilt}
            label={`Garden level ${current.level}: ${current.name}`}
          />
          {/* glass sheen */}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/15 via-transparent to-transparent" />

          <div className="absolute top-3 left-3 glass rounded-full px-3.5 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-100 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#E05A74]" /> Level {current.level} · {current.name}
          </div>
          <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-medium text-white/90 drop-shadow whitespace-nowrap">
            Tap the tree or a flower ✨
          </p>

          <AnimatePresence>
            {levelUp && (
              <motion.div
                className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <motion.div
                  className="glass rounded-[2rem] px-8 py-6 text-center"
                  initial={{ scale: 0.6, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 220, damping: 14 }}
                >
                  <Trophy className="w-10 h-10 mx-auto text-amber-400" />
                  <p className="text-xs font-bold uppercase tracking-widest text-[#E05A74] mt-2">Level up</p>
                  <p className="font-serif italic text-2xl text-stone-800 dark:text-stone-100">{levelUp}</p>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Reveal>

      <div className="grid gap-4 md:grid-cols-3 mt-4 lg:mt-6 lg:gap-6">
        <Reveal index={1} className="md:col-span-2">
          <div className={`${cardClass} p-5 h-full`}>
            <div className="flex items-baseline justify-between">
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74]">Growing together</p>
              <p className="text-xs text-stone-400">{next ? `Next: ${next.name}` : 'Fully grown'}</p>
            </div>
            <p className="font-cute text-4xl font-semibold text-stone-800 dark:text-stone-100 mt-1">
              {total.toLocaleString()} <span className="text-base font-medium text-stone-500">love points</span>
            </p>
            <div className="relative h-3 rounded-full bg-rose-100/70 dark:bg-stone-800 overflow-hidden mt-3">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#86EFAC] via-[#F9A8D4] to-[#E05A74]"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
              />
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent" />
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
              {next ? `${next.min - total} more points to level ${current.level + 1}` : 'Your garden is complete — forever 💞'}
            </p>

            <div className="grid grid-cols-3 gap-2 mt-4">
              {[
                { icon: Flower2, value: flowerCount, label: 'flowers' },
                { icon: Star, value: hugs, label: 'stars' },
                { icon: Sparkles, value: `${current.level}/${GARDEN_LEVELS.length}`, label: 'level' },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="rounded-2xl bg-white/60 dark:bg-white/5 px-3 py-2.5 text-center">
                  <Icon className="w-4 h-4 mx-auto text-[#E05A74]" />
                  <p className="font-cute text-lg font-semibold text-stone-800 dark:text-stone-100 leading-tight mt-1">{value}</p>
                  <p className="text-[10px] text-stone-500">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal index={2}>
          <div className={`${cardClass} p-5 flex flex-col h-full`}>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74] mb-3">Daily care</p>
            <div className="flex flex-col gap-2 text-xs mb-4">
              {[
                { name: 'You', done: iWatered },
                { name: partnerName, done: theyWatered },
              ].map((r) => (
                <div key={r.name} className="flex items-center justify-between rounded-xl bg-white/60 dark:bg-white/5 px-3 py-2">
                  <span className="font-semibold text-stone-700 dark:text-stone-200">{r.name}</span>
                  <span className={r.done ? 'text-emerald-600 font-semibold' : 'text-stone-400'}>{r.done ? '💧 watered' : 'not yet'}</span>
                </div>
              ))}
            </div>
            <button
              onClick={water}
              disabled={iWatered}
              className="mt-auto relative overflow-hidden inline-flex items-center justify-center gap-2 rounded-full py-3 text-sm font-semibold text-white bg-gradient-to-b from-sky-300 via-sky-400 to-cyan-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.5),0_10px_24px_-10px_rgba(14,165,233,0.8)] disabled:from-stone-200 disabled:via-stone-200 disabled:to-stone-300 disabled:text-stone-500 disabled:shadow-none dark:disabled:from-stone-800 dark:disabled:via-stone-800 dark:disabled:to-stone-800 active:scale-[0.98] transition-transform"
            >
              <Droplets className="w-4 h-4" /> {iWatered ? 'Watered today · back tomorrow' : 'Water our garden · +3'}
            </button>
          </div>
        </Reveal>
      </div>

      <Reveal index={3} className="mt-4 lg:mt-6">
        <BuildShop coins={coins} />
      </Reveal>
    </div>
  );
};

export default GardenPage;
