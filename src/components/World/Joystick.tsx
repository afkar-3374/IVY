import React, { useRef, useState } from 'react';
import { live } from './worldState';

const SIZE = 124;
const KNOB = 52;

/** Thumb stick for walking; up is "away from the camera". */
export const Joystick: React.FC = () => {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const pointer = useRef<number | null>(null);

  const update = (e: React.PointerEvent) => {
    const r = base.current!.getBoundingClientRect();
    const max = (SIZE - KNOB) / 2;
    let x = e.clientX - (r.left + r.width / 2);
    let y = e.clientY - (r.top + r.height / 2);
    const d = Math.hypot(x, y);
    if (d > max) [x, y] = [(x / d) * max, (y / d) * max];
    setKnob({ x, y });
    live.joy.x = x / max;
    live.joy.y = -y / max;
  };

  const end = () => {
    pointer.current = null;
    setKnob({ x: 0, y: 0 });
    live.joy.x = 0;
    live.joy.y = 0;
  };

  return (
    <div
      ref={base}
      className="relative rounded-full bg-white/25 backdrop-blur-md ring-1 ring-white/50 shadow-lg touch-none select-none"
      style={{ width: SIZE, height: SIZE }}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        pointer.current = e.pointerId;
        live.target = null;
        update(e);
      }}
      onPointerMove={(e) => pointer.current === e.pointerId && update(e)}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Walk"
    >
      <div
        className="absolute rounded-full bg-gradient-to-b from-white to-rose-100 shadow-[0_6px_16px_-4px_rgba(190,24,93,0.5)] ring-2 ring-white"
        style={{ width: KNOB, height: KNOB, left: (SIZE - KNOB) / 2 + knob.x, top: (SIZE - KNOB) / 2 + knob.y }}
      />
    </div>
  );
};
