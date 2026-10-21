import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Undo2, Trash2, Send, Lock } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/useGameStore';
import { DOODLE_PROMPTS, dayIndex, todayKey } from '../../data/gameQuestions';
import { cardClass } from '../Couple/CoupleCards';
import type { GameAnswer } from '../../services/gameService';

const SIZE = 320;
const COLOURS = ['#1f1d24', '#E05A74', '#F2A93B', '#3BA7C9', '#4FA86C', '#9B5DE5'];
const WIDTHS = [3, 9];

type Stroke = { colour: string; width: number; points: [number, number][] };

function draw(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) {
    ctx.strokeStyle = s.colour;
    ctx.lineWidth = s.width;
    ctx.beginPath();
    const [first, ...rest] = s.points;
    ctx.moveTo(first[0], first[1]);
    if (rest.length === 0) ctx.lineTo(first[0] + 0.1, first[1]);
    // smooth curve through the midpoints
    for (let i = 0; i < rest.length; i++) {
      const [x, y] = rest[i];
      const next = rest[i + 1];
      if (next) ctx.quadraticCurveTo(x, y, (x + next[0]) / 2, (y + next[1]) / 2);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

/** Both draw today's prompt; the drawings are revealed when you've both sent yours. */
export const DailyDoodle: React.FC = () => {
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;
  const answers = useGameStore((s) => s.answers);
  const loadAnswers = useGameStore((s) => s.loadAnswers);
  const submitAnswer = useGameStore((s) => s.submitAnswer);
  const award = useGameStore((s) => s.award);
  const today = todayKey();
  const roundKey = `doodle:${today}`;
  const prompt = DOODLE_PROMPTS[dayIndex() % DOODLE_PROMPTS.length];

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [colour, setColour] = useState(COLOURS[1]);
  const [width, setWidth] = useState(WIDTHS[0]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    void loadAnswers('know_me', [roundKey]);
  }, [roundKey, loadAnswers]);

  const rows: GameAnswer[] = answers[`know_me:${roundKey}`] || [];
  const loaded = `know_me:${roundKey}` in answers;
  const mine = rows.find((r) => r.user_id === me?.id)?.answer as { img: string } | undefined;
  const theirs = rows.find((r) => r.user_id !== me?.id)?.answer as { img: string } | undefined;

  useEffect(() => {
    if (mine && theirs) void award('know_me', 5, `doodle-both:${today}`);
  }, [Boolean(mine && theirs), today, award]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) draw(ctx, current.current ? [...strokes, current.current] : strokes);
  }, [strokes, loaded, mine]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const rect = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - rect.left) / rect.width) * SIZE, ((e.clientY - rect.top) / rect.height) * SIZE];
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    current.current = { colour, width, points: [point(e)] };
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) draw(ctx, [...strokes, current.current]);
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!current.current) return;
    current.current.points.push(point(e));
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx) draw(ctx, [...strokes, current.current]);
  };
  const onUp = () => {
    if (!current.current) return;
    const done = current.current;
    current.current = null;
    setStrokes((s) => [...s, done]);
  };

  const send = async () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;
    setSending(true);
    let img = canvas.toDataURL('image/webp', 0.8);
    if (!img.startsWith('data:image/webp')) img = canvas.toDataURL('image/jpeg', 0.8);
    await submitAnswer('know_me', roundKey, { img });
    void award('know_me', 5, `doodle:${today}`);
    setSending(false);
  };

  return (
    <div className={`${cardClass} p-5`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74] mb-1">Daily doodle 🎨</p>
      <h3 className="font-serif italic text-xl text-stone-800 dark:text-stone-100 mb-1">{prompt}</h3>
      <p className="text-xs text-stone-500 dark:text-stone-400 mb-4">Draw it, send it, then see {partnerName}'s. 5 points each, +5 when you both draw.</p>

      {!loaded ? null : !mine ? (
        <div className="flex flex-col gap-3">
          {theirs && <p className="text-xs font-semibold text-[#E05A74]">💌 {partnerName} has drawn theirs — send yours to see it!</p>}
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            className="w-full max-w-[320px] aspect-square mx-auto rounded-2xl border border-rose-100 dark:border-stone-700 bg-white touch-none cursor-crosshair"
            aria-label="Drawing canvas"
          />
          <div className="flex flex-wrap items-center justify-center gap-2">
            {COLOURS.map((c) => (
              <button
                key={c}
                onClick={() => setColour(c)}
                aria-label={`Colour ${c}`}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${colour === c ? 'border-stone-800 dark:border-white scale-110' : 'border-white dark:border-stone-700'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <span className="w-px h-6 bg-stone-200 dark:bg-stone-700 mx-1" />
            {WIDTHS.map((w) => (
              <button
                key={w}
                onClick={() => setWidth(w)}
                aria-label={w === WIDTHS[0] ? 'Thin brush' : 'Thick brush'}
                className={`w-8 h-8 rounded-full flex items-center justify-center ${width === w ? 'bg-rose-100 dark:bg-white/10' : ''}`}
              >
                <span className="rounded-full bg-stone-700 dark:bg-stone-200" style={{ width: w + 2, height: w + 2 }} />
              </button>
            ))}
            <button onClick={() => setStrokes((s) => s.slice(0, -1))} disabled={!strokes.length} className="p-2 rounded-full text-stone-500 disabled:opacity-30" aria-label="Undo">
              <Undo2 className="w-5 h-5" />
            </button>
            <button onClick={() => setStrokes([])} disabled={!strokes.length} className="p-2 rounded-full text-stone-500 disabled:opacity-30" aria-label="Clear">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
          <button
            onClick={send}
            disabled={sending || strokes.length === 0}
            className="btn-gloss self-center inline-flex items-center gap-2 rounded-full px-6 py-2 text-sm font-semibold"
          >
            <Send className="w-4 h-4" /> Send my doodle
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[
            { name: 'You', img: mine.img },
            { name: partnerName, img: theirs?.img },
          ].map((d) => (
            <div key={d.name}>
              <p className="text-[11px] font-bold text-stone-500 mb-1">{d.name}</p>
              {d.img ? (
                <motion.img
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  src={d.img}
                  alt={`${d.name}'s doodle`}
                  className="w-full aspect-square rounded-2xl border border-rose-100 dark:border-stone-700 bg-white"
                />
              ) : (
                <div className="w-full aspect-square rounded-2xl border border-dashed border-rose-200 dark:border-stone-700 flex flex-col items-center justify-center gap-2 text-center p-3">
                  <Lock className="w-5 h-5 text-stone-400" />
                  <p className="text-xs text-stone-500 dark:text-stone-400">Revealed when {partnerName} draws too</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
