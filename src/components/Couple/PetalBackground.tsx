import React, { useMemo } from 'react';

/** Ambient backdrop: slow aurora glows with a few petals drifting down (static for reduced motion). */
export const PetalBackground: React.FC = () => {
  const petals = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => ({
        id: i,
        left: (i * 41 + 7) % 100,
        delay: (i * 2.3) % 18,
        duration: 20 + ((i * 7) % 12),
        size: 9 + ((i * 5) % 8),
        glyph: i % 3 === 0 ? '♥' : '❀',
      })),
    []
  );
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="aurora-blob absolute -top-[20vh] -left-[10vw] w-[60vw] h-[60vh] rounded-full bg-[radial-gradient(closest-side,rgba(244,138,160,0.35),transparent)] dark:bg-[radial-gradient(closest-side,rgba(190,60,95,0.25),transparent)]" />
      <div className="aurora-blob absolute top-[30vh] -right-[15vw] w-[55vw] h-[65vh] rounded-full bg-[radial-gradient(closest-side,rgba(182,140,240,0.28),transparent)] dark:bg-[radial-gradient(closest-side,rgba(110,70,180,0.25),transparent)]" style={{ animationDelay: '-9s', animationDuration: '32s' }} />
      <div className="aurora-blob absolute -bottom-[25vh] left-[20vw] w-[50vw] h-[55vh] rounded-full bg-[radial-gradient(closest-side,rgba(255,200,150,0.28),transparent)] dark:bg-[radial-gradient(closest-side,rgba(200,110,70,0.15),transparent)]" style={{ animationDelay: '-17s', animationDuration: '38s' }} />
      {petals.map((p) => (
        <span
          key={p.id}
          className="petal absolute -top-8 text-rose-300/40 dark:text-rose-400/15"
          style={{ left: `${p.left}%`, fontSize: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
};
