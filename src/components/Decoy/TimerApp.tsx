import React, { useEffect, useRef, useState } from 'react';
import { Flag, Minus, Pause, Play, Plus, RotateCcw } from 'lucide-react';

/**
 * What Ivy shows when it opens or locks: a plain, fully working timer and stopwatch.
 * Tapping the time three times quickly opens the PIN screen.
 */

const PRESETS = [1, 3, 5, 10, 15, 30];
const SECRET_TAPS = 3;
const TAP_WINDOW_MS = 1200;
const RING_RADIUS = 122;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;
const THEME_COLOR = '#12161C';
const APP_THEME_COLOR = '#FDF8F6';

type Mode = 'timer' | 'stopwatch';

const pad = (n: number) => String(n).padStart(2, '0');

function formatTimer(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

function formatStopwatch(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  return `${pad(m)}:${pad(totalSeconds % 60)}.${pad(Math.floor((ms % 1000) / 10))}`;
}

function ring(): void {
  try {
    const ctx = new AudioContext();
    for (let i = 0; i < 6; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 880;
      const start = ctx.currentTime + i * 0.3;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    }
    setTimeout(() => ctx.close(), 2500);
  } catch {
    /* audio unavailable */
  }
  navigator.vibrate?.([300, 150, 300, 150, 300]);
}

interface TimerAppProps {
  onSecretTap: () => void;
}

export const TimerApp: React.FC<TimerAppProps> = ({ onSecretTap }) => {
  const [mode, setMode] = useState<Mode>('timer');

  // Timer
  const [minutes, setMinutes] = useState(5);
  const [remaining, setRemaining] = useState(5 * 60);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const endAtRef = useRef<number | null>(null);

  // Stopwatch
  const [elapsed, setElapsed] = useState(0);
  const [swRunning, setSwRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const swStartRef = useRef(0);
  const swBaseRef = useRef(0);

  const tapsRef = useRef<number[]>([]);

  // Looks like a timer app all the way: tab title and status bar
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    document.title = 'Timer';
    if (meta) meta.content = THEME_COLOR;
    // Unlocked: Ivy's own name and light status bar
    return () => {
      document.title = 'Ivy';
      if (meta) meta.content = APP_THEME_COLOR;
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const left = Math.max(0, Math.round(((endAtRef.current ?? Date.now()) - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        setFinished(true);
        endAtRef.current = null;
        ring();
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!swRunning) return;
    const id = window.setInterval(() => setElapsed(swBaseRef.current + Date.now() - swStartRef.current), 31);
    return () => window.clearInterval(id);
  }, [swRunning]);

  const setDuration = (m: number) => {
    const clamped = Math.min(180, Math.max(1, m));
    setMinutes(clamped);
    setRemaining(clamped * 60);
    setRunning(false);
    setFinished(false);
    endAtRef.current = null;
  };

  const toggleTimer = () => {
    if (running) {
      setRunning(false);
      endAtRef.current = null;
      return;
    }
    const startFrom = remaining > 0 ? remaining : minutes * 60;
    setRemaining(startFrom);
    setFinished(false);
    endAtRef.current = Date.now() + startFrom * 1000;
    setRunning(true);
  };

  const toggleStopwatch = () => {
    if (swRunning) {
      swBaseRef.current += Date.now() - swStartRef.current;
      setElapsed(swBaseRef.current);
      setSwRunning(false);
    } else {
      swStartRef.current = Date.now();
      setSwRunning(true);
    }
  };

  const resetStopwatch = () => {
    swBaseRef.current = 0;
    setElapsed(0);
    setLaps([]);
    setSwRunning(false);
  };

  const tapTime = () => {
    const now = Date.now();
    tapsRef.current = [...tapsRef.current.filter((t) => now - t < TAP_WINDOW_MS), now];
    if (tapsRef.current.length >= SECRET_TAPS) {
      tapsRef.current = [];
      onSecretTap();
    }
  };

  const total = minutes * 60;
  const progress = mode === 'timer' ? (total > 0 ? remaining / total : 0) : (elapsed % 60_000) / 60_000;
  const isRunning = mode === 'timer' ? running : swRunning;

  const roundBtn = 'w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#12161C] text-[#E8EAED] select-none overflow-y-auto">
      <div className="flex-1 w-full max-w-md mx-auto flex flex-col items-center px-6 pt-[max(env(safe-area-inset-top),20px)] pb-[max(env(safe-area-inset-bottom),20px)]">
        {/* Timer | Stopwatch */}
        <div className="flex p-1 rounded-full bg-[#1C222B] text-sm font-medium">
          {(['timer', 'stopwatch'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`px-5 py-2 rounded-full capitalize transition-colors ${mode === m ? 'bg-[#FF8A3D] text-[#12161C]' : 'text-[#9AA0A6]'}`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* Dial */}
        <div className="relative w-[280px] h-[280px] mt-8 flex items-center justify-center">
          <svg viewBox="0 0 280 280" className="absolute inset-0 -rotate-90" aria-hidden="true">
            <circle cx="140" cy="140" r={RING_RADIUS} fill="none" stroke="#252C36" strokeWidth="10" />
            <circle
              cx="140"
              cy="140"
              r={RING_RADIUS}
              fill="none"
              stroke="#FF8A3D"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={RING_LENGTH}
              strokeDashoffset={RING_LENGTH * (1 - progress)}
              style={{ transition: mode === 'timer' ? 'stroke-dashoffset 0.3s linear' : undefined }}
            />
          </svg>
          {/* The time: three quick taps open the PIN screen */}
          <button
            type="button"
            onClick={tapTime}
            aria-label="Time"
            className={`relative px-4 py-6 font-light tabular-nums tracking-tight focus:outline-none [-webkit-tap-highlight-color:transparent] ${
              finished && mode === 'timer' ? 'text-[#FF8A3D] animate-pulse' : ''
            } ${mode === 'stopwatch' ? 'text-[44px]' : remaining >= 3600 ? 'text-[48px]' : 'text-[60px]'}`}
          >
            {mode === 'timer' ? formatTimer(remaining) : formatStopwatch(elapsed)}
          </button>
          <p className="absolute bottom-16 text-xs text-[#9AA0A6]">
            {mode === 'timer' ? (finished ? "Time's up" : running ? 'Running' : `${minutes} min`) : swRunning ? 'Running' : elapsed ? 'Paused' : ''}
          </p>
        </div>

        {mode === 'timer' ? (
          <>
            <div className="flex items-center gap-5 mt-6">
              <button type="button" onClick={() => setDuration(minutes - 1)} disabled={running} aria-label="One minute less" className="w-10 h-10 rounded-full bg-[#1C222B] flex items-center justify-center disabled:opacity-40">
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-sm text-[#9AA0A6] w-16 text-center">{minutes} min</span>
              <button type="button" onClick={() => setDuration(minutes + 1)} disabled={running} aria-label="One minute more" className="w-10 h-10 rounded-full bg-[#1C222B] flex items-center justify-center disabled:opacity-40">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDuration(p)}
                  disabled={running}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors disabled:opacity-40 ${
                    minutes === p ? 'bg-[#FF8A3D]/15 text-[#FF8A3D] ring-1 ring-[#FF8A3D]/40' : 'bg-[#1C222B] text-[#9AA0A6]'
                  }`}
                >
                  {p} min
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="w-full mt-6 flex-1 min-h-[96px] max-h-48 overflow-y-auto">
            {laps.map((lap, i) => (
              <div key={i} className="flex justify-between px-4 py-2 border-b border-[#1C222B] text-sm tabular-nums">
                <span className="text-[#9AA0A6]">Lap {laps.length - i}</span>
                <span>{formatStopwatch(lap)}</span>
              </div>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="mt-auto pt-8 flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={mode === 'timer' ? () => setDuration(minutes) : resetStopwatch}
            aria-label="Reset"
            className={`${roundBtn} bg-[#1C222B] text-[#E8EAED]`}
          >
            <RotateCcw className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={mode === 'timer' ? toggleTimer : toggleStopwatch}
            aria-label={isRunning ? 'Pause' : 'Start'}
            className={`w-20 h-20 rounded-full flex items-center justify-center active:scale-95 transition-transform ${isRunning ? 'bg-[#1C222B] text-[#FF8A3D]' : 'bg-[#FF8A3D] text-[#12161C]'}`}
          >
            {isRunning ? <Pause className="w-8 h-8" fill="currentColor" /> : <Play className="w-8 h-8 ml-1" fill="currentColor" />}
          </button>
          {mode === 'stopwatch' ? (
            <button
              type="button"
              onClick={() => setLaps((l) => [elapsed, ...l])}
              disabled={!swRunning}
              aria-label="Lap"
              className={`${roundBtn} bg-[#1C222B] text-[#E8EAED] disabled:opacity-40`}
            >
              <Flag className="w-5 h-5" />
            </button>
          ) : (
            <span className="w-14 h-14" />
          )}
        </div>
      </div>
    </div>
  );
};
