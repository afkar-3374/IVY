import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Droplets, Sparkles } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';
import { gardenLevel, sumBy } from '../utils/scores';
import { todayKey } from '../data/gameQuestions';
import { cardClass } from '../components/Couple/CoupleCards';

const FLOWERS = ['🌷', '🌸', '🌼', '🌹', '🌻', '💐', '🪷', '🌺'];

/** Deterministic pseudo-random numbers so the garden looks the same on both phones. */
function seeded(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

type Phase = 'day' | 'sunset' | 'night';
function phaseFor(hour: number): Phase {
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'sunset';
  return 'night';
}

const SKY: Record<Phase, [string, string]> = {
  day: ['#FDE2E4', '#CDE7F7'],
  sunset: ['#FBC2A4', '#C9A7E4'],
  night: ['#1B1440', '#3B2A6B'],
};

/** The shared love garden: grows with all-time love points, starry at night. */
const GardenPage: React.FC = () => {
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;
  const points = useGameStore((s) => s.points);
  const award = useGameStore((s) => s.award);
  const [watering, setWatering] = useState(false);

  const total = sumBy(points);
  const { current, next, progress } = gardenLevel(total);
  const phase = phaseFor(new Date().getHours());
  const today = todayKey();
  const iWatered = points.some((p) => p.user_id === me?.id && p.ref === `garden:${today}`);
  const theyWatered = points.some((p) => p.user_id === partner.id && p.ref === `garden:${today}`);
  const hugs = points.filter((p) => p.source === 'hug' && p.user_id === me?.id).length;

  const flowers = useMemo(() => {
    const count = Math.min(56, Math.floor(total / 15));
    return Array.from({ length: count }, (_, i) => {
      const x = 4 + seeded(i + 1) * 92;
      const y = 72 + seeded(i + 101) * 22; // on the hills
      return {
        x,
        y,
        size: 3 + seeded(i + 201) * 2.2 + current.level * 0.2,
        emoji: FLOWERS[(i + current.level) % Math.min(FLOWERS.length, 2 + current.level)],
        sway: 2 + seeded(i + 301) * 3,
      };
    });
  }, [total, current.level]);

  const stars = useMemo(
    () => Array.from({ length: Math.min(90, 15 + hugs * 3) }, (_, i) => ({ x: seeded(i + 500) * 100, y: 38 + seeded(i + 600) * 26, r: 0.15 + seeded(i + 700) * 0.35, d: seeded(i + 800) * 3 })),
    [hugs]
  );

  // Tree grows with the level: from a seed to a big heart-shaped tree
  const treeScale = current.level <= 1 ? 0 : 0.12 + current.level * 0.06 + progress * 0.06;

  const water = async () => {
    if (iWatered || watering) return;
    setWatering(true);
    navigator.vibrate?.(40);
    await award('garden', 3, `garden:${today}`);
    setTimeout(() => setWatering(false), 2200);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 pt-5 pb-28 lg:px-8 lg:pt-8 lg:pb-10">
      <h1 className="font-serif italic text-4xl text-stone-800 dark:text-stone-100">Our garden</h1>
      <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 mb-5">
        Every love tap, hug and game makes it bloom{phase === 'night' ? ' · each star is a hug ✨' : ''}
      </p>

      {/* Scene */}
      <div className="relative w-full aspect-[4/3] md:aspect-[16/10] rounded-[2rem] overflow-hidden shadow-soft-lg border border-white/60 dark:border-stone-800">
        <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full" role="img" aria-label={`Garden level ${current.level}: ${current.name}`}>
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={SKY[phase][1]} />
              <stop offset="100%" stopColor={SKY[phase][0]} />
            </linearGradient>
            <linearGradient id="hill1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={phase === 'night' ? '#2E5A4A' : '#A7E3B8'} />
              <stop offset="100%" stopColor={phase === 'night' ? '#1E3D33' : '#7CCB95'} />
            </linearGradient>
            <linearGradient id="hill2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={phase === 'night' ? '#244A3D' : '#8FD6A5'} />
              <stop offset="100%" stopColor={phase === 'night' ? '#173329' : '#5FB47E'} />
            </linearGradient>
            <radialGradient id="glow">
              <stop offset="0%" stopColor="#FFF6C9" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#FFF6C9" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect width="100" height="100" fill="url(#sky)" />

          {phase === 'night' ? (
            <>
              {stars.map((s, i) => (
                <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFF8E1">
                  <animate attributeName="opacity" values="0.3;1;0.3" dur={`${2 + s.d}s`} repeatCount="indefinite" />
                </circle>
              ))}
              <circle cx="82" cy="47" r="9" fill="url(#glow)" />
              <circle cx="82" cy="47" r="5" fill="#FFF3C4" />
              <circle cx="84" cy="45.5" r="4.4" fill={SKY.night[1]} opacity="0.9" />
            </>
          ) : (
            <>
              <circle cx="80" cy={phase === 'sunset' ? 58 : 47} r="12" fill="url(#glow)" />
              <circle cx="80" cy={phase === 'sunset' ? 58 : 47} r="6" fill={phase === 'sunset' ? '#FFB27A' : '#FFE08A'} />
              {[[15, 46], [42, 42], [62, 50]].map(([x, y], i) => (
                <g key={i} opacity="0.85">
                  <animateTransform attributeName="transform" type="translate" values="0 0; 4 0; 0 0" dur={`${18 + i * 6}s`} repeatCount="indefinite" />
                  <ellipse cx={x} cy={y} rx="7" ry="2.6" fill="#fff" />
                  <ellipse cx={x + 3} cy={y - 1.6} rx="4" ry="2.4" fill="#fff" />
                </g>
              ))}
            </>
          )}

          {/* hills */}
          <path d="M0 72 Q 25 60 50 70 T 100 66 V100 H0Z" fill="url(#hill2)" />
          <path d="M0 80 Q 30 70 60 79 T 100 76 V100 H0Z" fill="url(#hill1)" />

          {/* love tree */}
          {treeScale > 0 ? (
            <g transform={`translate(50 74) scale(${treeScale})`}>
              <path d="M-2 0 Q -1.5 -14 -3 -24 L 3 -24 Q 1.5 -14 2 0 Z" fill="#8B5E3C" />
              <path d="M0 -20 C -8 -32 -26 -30 -24 -16 C -22 -6 -8 -2 0 6 C 8 -2 22 -6 24 -16 C 26 -30 8 -32 0 -20 Z" transform="translate(0 -18)" fill={phase === 'night' ? '#C2416A' : '#F27A93'} />
              <path d="M0 -20 C -5 -28 -16 -27 -15 -18" transform="translate(0 -18)" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.2" strokeLinecap="round" />
              {current.level >= 5 &&
                [[-12, -34], [10, -38], [-4, -44], [16, -28], [-17, -26]].slice(0, current.level - 3).map(([x, y], i) => (
                  <text key={i} x={x} y={y} fontSize="5" textAnchor="middle">💗</text>
                ))}
            </g>
          ) : (
            <g transform="translate(50 76)">
              <ellipse cx="0" cy="1" rx="5" ry="1.6" fill="#7A5236" />
              <ellipse cx="0" cy="-0.5" rx="1.4" ry="2" fill="#C69C6D" />
            </g>
          )}

          {/* flowers */}
          {flowers.map((f, i) => (
            <text key={i} x={f.x} y={f.y} fontSize={f.size} textAnchor="middle">
              <animateTransform attributeName="transform" type="rotate" values={`-4 ${f.x} ${f.y}; 4 ${f.x} ${f.y}; -4 ${f.x} ${f.y}`} dur={`${f.sway}s`} repeatCount="indefinite" />
              {f.emoji}
            </text>
          ))}

          {/* fireflies at night, butterflies by day */}
          {phase === 'night'
            ? Array.from({ length: 10 }, (_, i) => (
                <circle key={i} cx={10 + seeded(i + 900) * 80} cy={55 + seeded(i + 950) * 25} r="0.6" fill="#FFF59D">
                  <animate attributeName="opacity" values="0;1;0" dur={`${2 + seeded(i) * 2}s`} repeatCount="indefinite" />
                  <animateTransform attributeName="transform" type="translate" values="0 0; 2 -3; -1 -1; 0 0" dur={`${5 + i}s`} repeatCount="indefinite" />
                </circle>
              ))
            : current.level >= 3 &&
              [0, 1].map((i) => (
                <text key={i} x={25 + i * 45} y={56 - i * 5} fontSize="5">
                  <animateTransform attributeName="transform" type="translate" values="0 0; 6 -4; 12 1; 6 4; 0 0" dur={`${9 + i * 3}s`} repeatCount="indefinite" />
                  🦋
                </text>
              ))}
        </svg>

        {/* watering animation */}
        <AnimatePresence>
          {watering && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 pointer-events-none">
              {Array.from({ length: 22 }, (_, i) => (
                <motion.span
                  key={i}
                  className="absolute text-lg"
                  style={{ left: `${5 + seeded(i + 40) * 90}%`, top: '-5%' }}
                  animate={{ top: '85%' }}
                  transition={{ duration: 1.1 + seeded(i + 60) * 0.6, delay: seeded(i + 80) * 0.5, ease: 'easeIn' }}
                >
                  💧
                </motion.span>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* level badge */}
        <div className="absolute top-3 left-3 rounded-full bg-white/80 dark:bg-black/40 backdrop-blur px-3 py-1.5 text-xs font-semibold text-stone-700 dark:text-stone-100 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-[#E05A74]" /> Level {current.level} · {current.name}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 mt-4 lg:mt-6 lg:gap-6">
        <div className={`${cardClass} p-5`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74] mb-2">Growing</p>
          <p className="font-cute text-3xl font-semibold text-stone-800 dark:text-stone-100">
            {total.toLocaleString()} <span className="text-base font-medium text-stone-500">love points</span>
          </p>
          <div className="h-3 rounded-full bg-rose-50 dark:bg-stone-800 overflow-hidden mt-3">
            <div className="h-full rounded-full bg-gradient-to-r from-[#86EFAC] via-[#F9A8D4] to-[#E05A74] transition-all duration-700" style={{ width: `${progress * 100}%` }} />
          </div>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-2">
            {next ? `${next.min - total} more to "${next.name}"` : 'Your garden is fully grown — forever 💞'}
          </p>
          <p className="text-xs text-stone-400 mt-1">{flowers.length} flowers · {hugs} stars</p>
        </div>

        <div className={`${cardClass} p-5 flex flex-col`}>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74] mb-2">Daily care</p>
          <div className="flex gap-2 text-xs mb-4">
            <span className={`rounded-full px-3 py-1 font-semibold ${iWatered ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-stone-100 text-stone-500 dark:bg-stone-800'}`}>
              You {iWatered ? '✓ watered' : '· not yet'}
            </span>
            <span className={`rounded-full px-3 py-1 font-semibold ${theyWatered ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10' : 'bg-stone-100 text-stone-500 dark:bg-stone-800'}`}>
              {partnerName} {theyWatered ? '✓ watered' : '· not yet'}
            </span>
          </div>
          <button
            onClick={water}
            disabled={iWatered}
            className="mt-auto inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-400 to-cyan-400 text-white py-3 text-sm font-semibold shadow-soft disabled:from-stone-200 disabled:to-stone-200 disabled:text-stone-500 dark:disabled:from-stone-800 dark:disabled:to-stone-800"
          >
            <Droplets className="w-4 h-4" /> {iWatered ? 'Watered today 💧 come back tomorrow' : 'Water our garden (+3)'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default GardenPage;
