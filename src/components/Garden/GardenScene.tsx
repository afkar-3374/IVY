import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { GARDEN_ITEMS, type GardenItem } from '../../data/gardenItems';
import { BuildDefs, DRAWINGS } from './BuildDrawings';

export type Phase = 'day' | 'sunset' | 'night';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type Weather = 'clear' | 'cloudy' | 'rain';

/** Season from the month, and the day's weather (the same on both phones). */
export function gardenWeather(date: Date, dayIndex: number): { season: Season; weather: Weather; label: string } {
  const m = date.getMonth();
  const season: Season = m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
  const roll = seeded(dayIndex + 4242);
  const weather: Weather = roll < 0.2 ? 'rain' : roll < 0.45 ? 'cloudy' : 'clear';
  const seasonLabel = { spring: '🌸 Spring', summer: '☀️ Summer', autumn: '🍂 Autumn', winter: '❄️ Winter' }[season];
  const weatherLabel = { clear: 'clear skies', cloudy: 'cloudy', rain: 'rainy day' }[weather];
  return { season, weather, label: `${seasonLabel} · ${weatherLabel}` };
}

/** Deterministic pseudo-random numbers so the garden looks the same on both phones. */
export function seeded(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const SKIES: Record<Phase, [string, string, string]> = {
  day: ['#9FD3F5', '#F6D9EC', '#FFE9DF'],
  sunset: ['#6B5BB5', '#F08AA6', '#FFC58F'],
  night: ['#0B0A26', '#231B52', '#4A2F6E'],
};

type FlowerKind = 'tulip' | 'daisy' | 'rose' | 'lavender' | 'heart';
const KINDS_BY_LEVEL: FlowerKind[][] = [
  ['tulip'],
  ['tulip', 'daisy'],
  ['tulip', 'daisy', 'lavender'],
  ['tulip', 'daisy', 'lavender', 'rose'],
  ['tulip', 'daisy', 'lavender', 'rose', 'heart'],
];

/* ── Flower drawings (all in a 0..20 wide, 0..-40 tall box, base at 0,0) ── */
const Flower: React.FC<{ kind: FlowerKind; hue: number }> = ({ kind, hue }) => {
  const stem = (
    <>
      <path d="M0 0 C 0.6 -8 -0.6 -16 0 -24" stroke="url(#stem)" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <path d="M0 -8 C 4 -10 6 -14 6 -16 C 2 -15 0.5 -12 0 -9 Z" fill="url(#leaf)" />
      <path d="M0 -13 C -4 -15 -5.5 -18 -5.5 -20 C -2 -19 -0.5 -16 0 -14 Z" fill="url(#leaf)" />
    </>
  );
  switch (kind) {
    case 'tulip':
      return (
        <g>
          {stem}
          <path d="M-5 -30 C -5.5 -24 -3 -21 0 -21 C 3 -21 5.5 -24 5 -30 L 2.6 -27 L 0 -32 L -2.6 -27 Z" fill={`url(#tulip${hue})`} />
          <path d="M-3 -28 C -3 -25 -1.6 -23 0 -22.6" stroke="#fff" strokeOpacity="0.55" strokeWidth="0.7" fill="none" strokeLinecap="round" />
        </g>
      );
    case 'daisy':
      return (
        <g>
          {stem}
          <g transform="translate(0 -27)">
            {Array.from({ length: 10 }, (_, i) => (
              <ellipse key={i} cx="0" cy="-4" rx="1.5" ry="3.6" fill="url(#petalWhite)" transform={`rotate(${i * 36})`} />
            ))}
            <circle r="2.4" fill="url(#daisyCenter)" />
            <circle cx="-0.7" cy="-0.8" r="0.7" fill="#fff" opacity="0.6" />
          </g>
        </g>
      );
    case 'rose':
      return (
        <g>
          {stem}
          <g transform="translate(0 -28)">
            <circle r="5" fill={`url(#rose${hue})`} />
            <path d="M-3.4 0.6 C -3 -2.6 0.6 -3.6 2.6 -1.4 C 3.8 0 3 2.4 0.8 2.6 C -1 2.8 -1.8 1.2 -1 0 C -0.2 -1 1.2 -0.6 1.2 0.4" stroke="#7A1530" strokeOpacity="0.45" strokeWidth="0.6" fill="none" strokeLinecap="round" />
            <ellipse cx="-1.6" cy="-2.6" rx="1.6" ry="0.9" fill="#fff" opacity="0.4" />
          </g>
        </g>
      );
    case 'lavender':
      return (
        <g>
          {stem}
          {Array.from({ length: 7 }, (_, i) => (
            <ellipse key={i} cx={i % 2 ? 1 : -1} cy={-24 - i * 1.8} rx="1.3" ry="1.6" fill="url(#lavender)" />
          ))}
        </g>
      );
    case 'heart':
      return (
        <g>
          {stem}
          <g transform="translate(0 -29)">
            <circle r="7" fill="url(#heartGlow)" />
            <path d="M0 3.4 C -5.5 -0.4 -5 -5 -2.4 -5 C -1 -5 0 -4 0 -3 C 0 -4 1 -5 2.4 -5 C 5 -5 5.5 -0.4 0 3.4 Z" fill="url(#heartFill)" />
            <ellipse cx="-2" cy="-3" rx="1.2" ry="0.7" fill="#fff" opacity="0.6" />
          </g>
        </g>
      );
  }
};

interface Burst {
  id: number;
  x: number;
  y: number;
  kind: 'hearts' | 'sparkle';
}

interface GardenSceneProps {
  total: number;
  level: number;
  progress: number;
  phase: Phase;
  stars: number;
  watering: boolean;
  label: string;
  /** Built item ids */
  builds: string[];
  /** Item to animate into place */
  justBuilt: string | null;
  /** Both of you watered today */
  rainbow?: boolean;
  season?: Season;
  weather?: Weather;
}

const BUTTERFLY_COLOURS = ['#FF8FB0', '#C38BFF', '#FFC56B', '#7CD4F5'];

/** A little butterfly drawn around 0,0, flapping in place (the parent moves it). */
const Butterfly: React.FC<{ colour: string; flap: number }> = ({ colour, flap }) => (
  <g className="flap" style={{ animationDuration: `${flap}s` }}>
    <ellipse cx="-1.5" cy="-1" rx="1.7" ry="2.2" fill={colour} transform="rotate(-25 -1.5 -1)" />
    <ellipse cx="1.5" cy="-1" rx="1.7" ry="2.2" fill={colour} transform="rotate(25 1.5 -1)" />
    <ellipse cx="-1.1" cy="1.3" rx="1.1" ry="1.3" fill={colour} opacity="0.85" />
    <ellipse cx="1.1" cy="1.3" rx="1.1" ry="1.3" fill={colour} opacity="0.85" />
    <rect x="-0.3" y="-2" width="0.6" height="4.2" rx="0.3" fill="#4A3048" />
  </g>
);

const PlacedItem: React.FC<{ item: GardenItem; night: boolean; isNew: boolean }> = ({ item, night, isNew }) => {
  const Drawing = DRAWINGS[item.id];
  return (
    <g transform={`translate(${item.x} ${item.y}) scale(${item.scale})`}>
      <g className={isNew ? 'bloom' : undefined}>
        <Drawing night={night} />
      </g>
    </g>
  );
};

/** The animated love garden. Purely visual; growth comes from `total` and `level`. */
export const GardenScene: React.FC<GardenSceneProps> = ({ total, level, progress, phase, stars, watering, label, builds, justBuilt, rainbow, season = 'summer', weather = 'clear' }) => {
  const [bursts, setBursts] = useState<Burst[]>([]);
  const night = phase === 'night';
  const sky = SKIES[phase];

  const built = useMemo(() => GARDEN_ITEMS.filter((i) => builds.includes(i.id)), [builds]);

  const flowers = useMemo(() => {
    // flowers make room for whatever has been built
    const blocked = (x: number, y: number) =>
      built.some((b) => Math.abs(x - b.x) < b.clear[0] && y <= b.y + 2 && y >= b.y - b.clear[1]);
    const count = Math.min(64, Math.floor(total / 15));
    const kinds = KINDS_BY_LEVEL[Math.min(KINDS_BY_LEVEL.length - 1, Math.max(0, level - 2))];
    return Array.from({ length: count }, (_, i) => {
      // keep the middle clear for the tree
      let x = 8 + seeded(i + 1) * 144;
      if (x > 64 && x < 96) x = x < 80 ? x - 18 : x + 18;
      const y = 74 + seeded(i + 101) * 23;
      const depth = (y - 74) / 23; // 0 far … 1 near
      return {
        id: i,
        x,
        y,
        scale: 0.32 + depth * 0.32 + Math.min(level, 9) * 0.012,
        kind: kinds[i % kinds.length],
        hue: i % 3,
        delay: 0.15 + i * 0.035,
        sway: 3.2 + seeded(i + 301) * 2.4,
      };
    })
      .filter((f) => !blocked(f.x, f.y))
      .sort((a, b) => a.y - b.y);
  }, [total, level, built]);

  // Near items share depth ordering with the flowers
  const nearItems = built.filter((b) => !b.far);
  const farItems = built.filter((b) => b.far);
  const depthList = [
    ...flowers.map((f) => ({ kind: 'flower' as const, y: f.y, f })),
    ...nearItems.map((b, i) => ({ kind: 'item' as const, y: b.y + i * 0.001, b })),
  ].sort((a, b) => a.y - b.y);

  const starDots = useMemo(
    () => Array.from({ length: Math.min(120, 20 + stars * 3) }, (_, i) => ({ x: seeded(i + 500) * 160, y: 4 + seeded(i + 600) * 50, r: 0.18 + seeded(i + 700) * 0.4, d: seeded(i + 800) * 3 })),
    [stars]
  );

  const grass = useMemo(
    () => Array.from({ length: 90 }, (_, i) => ({ x: (i / 90) * 162 - 1, h: 3 + seeded(i + 1200) * 4, d: seeded(i + 1300) * 3 })),
    []
  );

  // More butterflies as the garden grows (daytime only)
  const butterflies = night || weather === 'rain' || season === 'winter' ? 0 : Math.min(8, 1 + Math.floor(level / 2) + (season === 'summer' ? 2 : 0));
  const overcast = weather !== 'clear';

  const treeScale = level <= 1 ? 0.22 : 0.26 + level * 0.04 + progress * 0.04;
  const risingHearts = Math.min(8, Math.max(0, level - 2));

  const burst = (x: number, y: number, kind: Burst['kind']) => {
    const id = Date.now() + Math.random();
    setBursts((b) => [...b, { id, x, y, kind }]);
    navigator.vibrate?.(15);
    setTimeout(() => setBursts((b) => b.filter((p) => p.id !== id)), 1400);
  };

  return (
    <div className="relative w-full h-full select-none">
      <svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMax slice" className="absolute inset-0 w-full h-full" role="img" aria-label={label}>
        <defs>
          <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={sky[0]} />
            <stop offset="60%" stopColor={sky[1]} />
            <stop offset="100%" stopColor={sky[2]} />
          </linearGradient>
          <radialGradient id="sunGlow"><stop offset="0%" stopColor="#FFF4C2" stopOpacity="0.95" /><stop offset="100%" stopColor="#FFF4C2" stopOpacity="0" /></radialGradient>
          <radialGradient id="sunBody" cx="40%" cy="35%"><stop offset="0%" stopColor="#FFFBE8" /><stop offset="100%" stopColor={phase === 'sunset' ? '#FF9E6B' : '#FFD66B'} /></radialGradient>
          <radialGradient id="moonGlow"><stop offset="0%" stopColor="#E8E4FF" stopOpacity="0.8" /><stop offset="100%" stopColor="#E8E4FF" stopOpacity="0" /></radialGradient>
          <linearGradient id="mountain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={night ? '#3B2E6B' : '#C9B8E8'} />
            <stop offset="100%" stopColor={night ? '#24204A' : '#E9D9F0'} />
          </linearGradient>
          <linearGradient id="hillFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={night ? '#2D5B57' : '#9EDDB4'} />
            <stop offset="100%" stopColor={night ? '#1C3B3A' : '#7CC99B'} />
          </linearGradient>
          <linearGradient id="meadow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={night ? '#2F6A56' : '#A8E6B5'} />
            <stop offset="100%" stopColor={night ? '#163829' : '#5DB37A'} />
          </linearGradient>
          <linearGradient id="stem" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#5FAE6E" /><stop offset="100%" stopColor="#2F7A45" /></linearGradient>
          <linearGradient id="leaf" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#8BD99A" /><stop offset="100%" stopColor="#3D8F55" /></linearGradient>
          {[['#FF9DB4', '#E0456A'], ['#FFD08A', '#F28A3C'], ['#E5B5FF', '#9B5DE5']].map(([a, b], i) => (
            <linearGradient key={i} id={`tulip${i}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} /></linearGradient>
          ))}
          {[['#FF7A93', '#B5173F'], ['#FFB3C6', '#E0456A'], ['#FF9E7A', '#C93A3A']].map(([a, b], i) => (
            <radialGradient key={i} id={`rose${i}`} cx="40%" cy="35%"><stop offset="0%" stopColor={a} /><stop offset="100%" stopColor={b} /></radialGradient>
          ))}
          <linearGradient id="petalWhite" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FFFFFF" /><stop offset="100%" stopColor="#F3E8FF" /></linearGradient>
          <radialGradient id="daisyCenter" cx="40%" cy="35%"><stop offset="0%" stopColor="#FFE58A" /><stop offset="100%" stopColor="#F2A93B" /></radialGradient>
          <linearGradient id="lavender" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#D6B8FF" /><stop offset="100%" stopColor="#8E5BD8" /></linearGradient>
          <radialGradient id="heartGlow"><stop offset="0%" stopColor="#FF8FB0" stopOpacity="0.55" /><stop offset="100%" stopColor="#FF8FB0" stopOpacity="0" /></radialGradient>
          <linearGradient id="heartFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#FF9DB8" /><stop offset="100%" stopColor="#E0335E" /></linearGradient>
          <linearGradient id="trunk" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#6E4630" /><stop offset="50%" stopColor="#9C6A48" /><stop offset="100%" stopColor="#5A3825" /></linearGradient>
          <radialGradient id="canopy" cx="38%" cy="30%" r="75%">
            <stop offset="0%" stopColor={night ? '#FF8FB0' : '#FFC2D2'} />
            <stop offset="55%" stopColor={night ? '#D8436E' : '#F27A93'} />
            <stop offset="100%" stopColor={night ? '#8E1F48' : '#C9435F'} />
          </radialGradient>
          <linearGradient id="aurora" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#7CF5C8" stopOpacity="0" />
            <stop offset="40%" stopColor="#7CF5C8" stopOpacity="0.35" />
            <stop offset="70%" stopColor="#C38BFF" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#C38BFF" stopOpacity="0" />
          </linearGradient>
          <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" /></filter>
          <BuildDefs />
        </defs>

        <rect width="160" height="100" fill="url(#sky)" />

        {/* ── Sky ── */}
        {night ? (
          <>
            <path d="M-10 38 C 30 22 60 40 95 26 S 150 18 175 30" stroke="url(#aurora)" strokeWidth="9" fill="none" filter="url(#soft)" className="twinkle" style={{ animationDuration: '9s' }} />
            <path d="M-10 46 C 40 34 70 50 110 36 S 160 32 175 40" stroke="url(#aurora)" strokeWidth="6" fill="none" filter="url(#soft)" className="twinkle" style={{ animationDuration: '12s', animationDelay: '-4s' }} />
            {starDots.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#FFF8E6" className="twinkle" style={{ animationDelay: `${s.d}s`, animationDuration: `${2.4 + s.d}s` }} />
            ))}
            <g className="shooting-star"><path d="M130 10 l 8 -3" stroke="#fff" strokeWidth="0.5" strokeLinecap="round" opacity="0.9" /></g>
            <circle cx="128" cy="24" r="14" fill="url(#moonGlow)" />
            <circle cx="128" cy="24" r="6.5" fill="#FFF6DA" />
            <circle cx="131" cy="22" r="5.8" fill={sky[0]} opacity="0.92" />
          </>
        ) : (
          <>
            <g transform={`translate(126 ${phase === 'sunset' ? 50 : 22})`} opacity={overcast ? 0.45 : 1}>
              <g className="rays" opacity="0.35">
                {Array.from({ length: 12 }, (_, i) => (
                  <path key={i} d="M0 0 L -2 -30 L 2 -30 Z" fill="#FFF3C4" transform={`rotate(${i * 30})`} />
                ))}
              </g>
              <circle r="16" fill="url(#sunGlow)" />
              <circle r="7" fill="url(#sunBody)" />
            </g>
            {[[0, 18, 1], [55, 12, 0.8], [100, 28, 1.1]].map(([x, y, s], i) => (
              <g key={i} className="cloud" style={{ animationDelay: `${-i * 22}s`, animationDuration: `${70 + i * 15}s` }}>
                <g transform={`translate(${x - 20} ${y}) scale(${s})`} opacity={phase === 'sunset' ? 0.7 : 0.92}>
                  <ellipse cx="0" cy="0" rx="11" ry="3.6" fill={phase === 'sunset' ? '#FFD3DF' : '#fff'} />
                  <ellipse cx="4" cy="-2.4" rx="6" ry="3.4" fill={phase === 'sunset' ? '#FFE1E8' : '#fff'} />
                  <ellipse cx="-4" cy="-1.5" rx="4.5" ry="2.6" fill={phase === 'sunset' ? '#FFE1E8' : '#fff'} />
                </g>
              </g>
            ))}
          </>
        )}

        {/* ── Weather clouds ── */}
        {overcast &&
          [[10, 14, 1.4], [62, 9, 1.2], [112, 16, 1.5], [150, 8, 1]].map(([x, y, sc], i) => (
            <g key={`wc${i}`} className="cloud" style={{ animationDelay: `${-i * 18}s`, animationDuration: `${80 + i * 12}s` }}>
              <g transform={`translate(${x - 20} ${y}) scale(${sc})`} opacity={night ? 0.35 : 0.9}>
                <ellipse cx="0" cy="0" rx="12" ry="4" fill={weather === 'rain' ? '#9AA3B5' : '#E4E7EF'} />
                <ellipse cx="5" cy="-2.6" rx="6.5" ry="3.8" fill={weather === 'rain' ? '#AEB6C6' : '#F1F3F8'} />
                <ellipse cx="-5" cy="-1.6" rx="5" ry="3" fill={weather === 'rain' ? '#AEB6C6' : '#F1F3F8'} />
              </g>
            </g>
          ))}
        {weather === 'rain' && <rect width="160" height="100" fill="#3B4A63" opacity={night ? 0.15 : 0.18} />}

        {/* ── Rainbow on days you both watered ── */}
        {rainbow && !night && weather !== 'rain' && (
          <g className="rainbow" opacity="0.5">
            {['#FF6B8B', '#FFA26B', '#FFE07A', '#8FE3A0', '#7CC4F5', '#B48CFF'].map((c, i) => (
              <path key={c} d={`M${14 + i * 2.2} 70 A ${52 - i * 2.2} ${46 - i * 2.2} 0 0 1 ${118 - i * 2.2} 70`} stroke={c} strokeWidth="2.3" fill="none" />
            ))}
          </g>
        )}

        {/* ── Land layers ── */}
        <path d="M0 62 L 18 46 L 32 56 L 50 40 L 70 55 L 88 44 L 108 57 L 126 42 L 146 54 L 160 47 V 100 H 0 Z" fill="url(#mountain)" opacity="0.9" />
        <path d="M0 66 Q 40 54 80 64 T 160 60 V 100 H 0 Z" fill="url(#hillFar)" />
        <path d="M0 74 Q 50 64 100 73 T 160 70 V 100 H 0 Z" fill="url(#meadow)" />

        {/* ── Far buildings (behind the tree and flowers) ── */}
        {farItems.map((b) => (
          <PlacedItem key={b.id} item={b} night={night} isNew={justBuilt === b.id} />
        ))}

        {/* ── Love tree ── */}
        <g transform={`translate(80 76) scale(${treeScale})`} onClick={() => burst(80, 50, 'hearts')} style={{ cursor: 'pointer' }}>
          <g className="breathe">
            <path d="M-3 0 C -2.4 -14 -4.4 -22 -6 -30 L 6 -30 C 4.4 -22 2.4 -14 3 0 Z" fill="url(#trunk)" />
            <path d="M-1 -24 C -6 -28 -10 -30 -13 -34 M 1 -26 C 5 -30 9 -31 12 -35" stroke="#7A4E34" strokeWidth="1.6" fill="none" strokeLinecap="round" />
            <path d="M0 -32 C -12 -50 -40 -46 -37 -24 C -34 -10 -12 -4 0 8 C 12 -4 34 -10 37 -24 C 40 -46 12 -50 0 -32 Z" transform="translate(0 -26)" fill="url(#canopy)" />
            <path d="M-6 -60 C -14 -66 -26 -62 -28 -52" stroke="#fff" strokeOpacity="0.55" strokeWidth="2.6" fill="none" strokeLinecap="round" />
            <ellipse cx="-16" cy="-56" rx="5" ry="2.6" fill="#fff" opacity="0.35" />
          </g>
          {Array.from({ length: risingHearts }, (_, i) => (
            <g key={i} transform={`translate(${-22 + i * 6.5} ${-60 + (i % 3) * 8})`}>
              <path className="rise" style={{ animationDelay: `${i * 0.75}s`, ['--dx' as string]: `${(i % 2 ? 1 : -1) * 6}px` }} d="M0 2.2 C -3.5 -0.3 -3.2 -3.2 -1.5 -3.2 C -0.6 -3.2 0 -2.6 0 -2 C 0 -2.6 0.6 -3.2 1.5 -3.2 C 3.2 -3.2 3.5 -0.3 0 2.2 Z" fill="#FF8FB0" />
            </g>
          ))}
        </g>

        {/* ── Flowers and nearby buildings, back to front ── */}
        {depthList.map((d) =>
          d.kind === 'item' ? (
            <PlacedItem key={d.b.id} item={d.b} night={night} isNew={justBuilt === d.b.id} />
          ) : (
            <g key={d.f.id} transform={`translate(${d.f.x} ${d.f.y}) scale(${d.f.scale})`} onClick={() => burst(d.f.x, d.f.y - 12 * d.f.scale, 'sparkle')} style={{ cursor: 'pointer' }}>
              <g className="bloom" style={{ animationDelay: `${d.f.delay}s` }}>
                <g className="sway" style={{ animationDuration: `${d.f.sway}s`, animationDelay: `${-d.f.sway * seeded(d.f.id)}s` }}>
                  <g key={watering ? 'w' : 'n'} className={watering ? 'bloom' : undefined} style={watering ? { animationDelay: `${1.2 + seeded(d.f.id + 3) * 0.6}s` } : undefined}>
                    <Flower kind={d.f.kind} hue={d.f.hue} />
                  </g>
                </g>
              </g>
            </g>
          )
        )}

        {/* first sprout before any flowers */}
        {flowers.length === 0 && (
          <g transform="translate(46 86)" className="sway">
            <path d="M0 0 C 0 -4 0 -6 0 -8" stroke="url(#stem)" strokeWidth="1" />
            <path d="M0 -6 C 3 -9 5 -8 5 -7 C 3 -6 1 -6 0 -6 Z M0 -7 C -3 -10 -5 -9 -5 -8 C -3 -7 -1 -7 0 -7 Z" fill="url(#leaf)" />
          </g>
        )}

        {/* ── Foreground grass ── */}
        {grass.map((g, i) => (
          <path
            key={i}
            d={`M${g.x} 100 Q ${g.x + 0.6} ${100 - g.h / 2} ${g.x + 1.2} ${100 - g.h}`}
            stroke={night ? '#1F4A38' : '#4FA86C'}
            strokeWidth="0.9"
            fill="none"
            strokeLinecap="round"
            className="sway"
            style={{ animationDuration: `${3 + g.d}s`, animationDelay: `${-g.d}s` }}
          />
        ))}

        {/* ── Floating light: fireflies at night, pollen by day ── */}
        {Array.from({ length: night ? 16 : 10 }, (_, i) => (
          <g key={i} className="drift" style={{ animationDuration: `${6 + seeded(i + 40) * 6}s`, animationDelay: `${-seeded(i + 41) * 6}s` }}>
            <circle cx={10 + seeded(i + 900) * 140} cy={45 + seeded(i + 950) * 40} r={night ? 0.7 : 0.45} fill={night ? '#FFF59D' : '#FFFFFF'} className="twinkle" style={{ animationDelay: `${seeded(i) * 3}s` }} />
          </g>
        ))}

        {/* ── Drifting petals ── */}
        {/* ── Season: falling leaves, snow, extra spring petals ── */}
        {season === 'autumn' &&
          Array.from({ length: 8 }, (_, i) => (
            <path
              key={`leaf${i}`}
              d="M0 0 C 1.6 -1.6 3.4 -0.6 3 1 C 2.2 2.4 0.4 1.6 0 0 Z"
              fill={['#F2A93B', '#E0703A', '#C9473A', '#F6C453'][i % 4]}
              transform={`translate(${8 + i * 19} ${20 + (i % 3) * 8})`}
              className="petal-fall"
              style={{ animationDelay: `${i * 1.1}s`, animationDuration: `${9 + (i % 3) * 2}s` }}
            />
          ))}
        {season === 'winter' &&
          Array.from({ length: 36 }, (_, i) => (
            <circle
              key={`snow${i}`}
              cx={seeded(i + 2000) * 160}
              cy={-4}
              r={0.35 + seeded(i + 2100) * 0.45}
              fill="#fff"
              opacity="0.9"
              className="snow"
              style={{ animationDelay: `${-seeded(i + 2200) * 10}s`, animationDuration: `${7 + seeded(i + 2300) * 6}s` }}
            />
          ))}
        {weather === 'rain' &&
          Array.from({ length: 50 }, (_, i) => (
            <path
              key={`rain${i}`}
              d={`M${seeded(i + 2400) * 170} -6 l -1.2 4`}
              stroke="#CFE3F7"
              strokeWidth="0.35"
              strokeLinecap="round"
              opacity="0.8"
              className="rain"
              style={{ animationDelay: `${-seeded(i + 2500) * 1.2}s`, animationDuration: `${0.7 + seeded(i + 2600) * 0.5}s` }}
            />
          ))}
        {(level >= 4 || season === 'spring') &&
          Array.from({ length: season === 'spring' ? 12 : 6 }, (_, i) => (
            <path
              key={i}
              d="M0 0 C 1.2 -1 2.4 0 1.2 1.4 C 0 2 -1 1 0 0 Z"
              fill="#FFB3C6"
              transform={`translate(${(20 + i * 22) % 160} ${30 + (i % 3) * 6})`}
              className="petal-fall"
              style={{ animationDelay: `${i * 1.4}s`, animationDuration: `${8 + (i % 3) * 2}s` }}
            />
          ))}
        {/* ── Butterflies ── */}
        {Array.from({ length: butterflies }, (_, i) => (
          <g key={i} transform={`translate(${18 + seeded(i + 1500) * 120} ${48 + seeded(i + 1600) * 30})`}>
            <g className="flutter" style={{ animationDuration: `${11 + seeded(i + 1700) * 8}s`, animationDelay: `${-seeded(i + 1800) * 10}s` }}>
              <g transform="scale(0.9)">
                <Butterfly colour={BUTTERFLY_COLOURS[i % BUTTERFLY_COLOURS.length]} flap={0.22 + seeded(i + 1900) * 0.12} />
              </g>
            </g>
          </g>
        ))}
      </svg>

      {/* Tap bursts */}
      <AnimatePresence>
        {bursts.map((b) =>
          Array.from({ length: b.kind === 'hearts' ? 9 : 5 }, (_, i) => (
            <motion.span
              key={`${b.id}-${i}`}
              className="absolute pointer-events-none text-lg"
              style={{ left: `${(b.x / 160) * 100}%`, top: `${b.y}%` }}
              initial={{ opacity: 1, x: 0, y: 0, scale: 0.4 }}
              animate={{ opacity: 0, x: (seeded(i + b.id) - 0.5) * 120, y: -40 - seeded(i + 7) * 60, scale: 1.2 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            >
              {b.kind === 'hearts' ? '💗' : '✨'}
            </motion.span>
          ))
        )}
      </AnimatePresence>

      {/* Watering: can tilts in and rain falls */}
      <AnimatePresence>
        {watering && (
          <motion.div className="absolute inset-0 pointer-events-none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.svg
              viewBox="0 0 64 48"
              className="absolute right-[6%] top-[4%] w-20 h-16 drop-shadow-lg"
              initial={{ rotate: 0, x: 50, y: -24 }}
              animate={{ rotate: -32, x: 0, y: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 12 }}
              aria-hidden
            >
              <defs>
                <linearGradient id="can" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#9FE3F2" /><stop offset="100%" stopColor="#3BA7C9" /></linearGradient>
              </defs>
              <path d="M18 14 H 44 V 40 Q 44 44 40 44 H 22 Q 18 44 18 40 Z" fill="url(#can)" />
              <path d="M18 22 L 4 12 L 2 15 L 18 28 Z" fill="#3BA7C9" />
              <path d="M44 18 Q 56 18 54 30 Q 52 36 44 34" stroke="#3BA7C9" strokeWidth="3" fill="none" />
              <rect x="22" y="17" width="5" height="22" rx="2.5" fill="#fff" opacity="0.35" />
            </motion.svg>
            {Array.from({ length: 34 }, (_, i) => (
              <motion.span
                key={i}
                className="absolute w-[3px] h-3 rounded-full bg-gradient-to-b from-sky-200 to-sky-400"
                style={{ left: `${8 + seeded(i + 40) * 84}%`, top: '10%' }}
                initial={{ y: 0, opacity: 0 }}
                animate={{ y: '320%', opacity: [0, 1, 1, 0] }}
                transition={{ duration: 0.9 + seeded(i + 60) * 0.5, delay: 0.4 + seeded(i + 80) * 0.8, ease: 'easeIn' }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
