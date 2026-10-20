import React, { useMemo } from 'react';

/** Soft petals and hearts drifting behind the pages (hidden for reduced motion). */
export const PetalBackground: React.FC = () => {
  const petals = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        id: i,
        left: (i * 37) % 100,
        delay: (i * 1.7) % 14,
        duration: 16 + ((i * 5) % 10),
        size: 10 + ((i * 7) % 10),
        glyph: i % 3 === 0 ? '♥' : '❀',
      })),
    []
  );
  return (
    <div className="petals pointer-events-none fixed inset-0 z-0 overflow-hidden motion-reduce:hidden" aria-hidden>
      {petals.map((p) => (
        <span
          key={p.id}
          className="petal absolute -top-8 text-rose-300/50 dark:text-rose-400/20"
          style={{ left: `${p.left}%`, fontSize: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s` }}
        >
          {p.glyph}
        </span>
      ))}
    </div>
  );
};
