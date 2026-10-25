import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Shuffle } from 'lucide-react';
import { CLOTH_COLOURS, CLOTHES, HAIR_COLOURS, SKINS, SLOTS, clothKey, owns, type Cloth, type Look, type Slot } from './wardrobe';

interface DressingPanelProps {
  look: Look;
  owned: string[];
  coins: number;
  onChange: (look: Look) => void;
  /** Buy a piece of clothing and put it on; resolves false if it didn't go through */
  onBuy: (cloth: Cloth, look: Look) => Promise<boolean>;
  onDone: () => void;
}

const glass = 'bg-white/80 dark:bg-stone-900/70 backdrop-blur-md ring-1 ring-white/60 dark:ring-white/10 shadow-xl';
const pick = <T,>(xs: T[]) => xs[Math.floor(Math.random() * xs.length)];

/** The dressing room's closet: tabs of clothes, colours, and a till for the paid ones. */
export const DressingPanel: React.FC<DressingPanelProps> = ({ look, owned, coins, onChange, onBuy, onDone }) => {
  const [tab, setTab] = useState<Slot | 'skin'>('top');
  const [buying, setBuying] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const slot = SLOTS.find((s) => s.slot === tab)!;
  const items = CLOTHES.filter((c) => c.slot === tab);
  const colours = tab === 'hair' ? HAIR_COLOURS : CLOTH_COLOURS;

  // A pending "buy" quietly expires
  useEffect(() => {
    if (!buying) return;
    const t = setTimeout(() => setBuying(null), 4000);
    return () => clearTimeout(t);
  }, [buying]);

  const choose = async (c: Cloth) => {
    const next = { ...look, [c.slot]: c.id } as Look;
    if (owns(owned, c)) return onChange(next);
    const key = clothKey(c);
    if (buying !== key) return setBuying(key);
    setBuying(null);
    setBusy(true);
    await onBuy(c, next);
    setBusy(false);
  };

  // Surprise me: something random from what you own, in random colours
  const surprise = () => {
    const mine = (s: Slot) => CLOTHES.filter((c) => c.slot === s && owns(owned, c));
    onChange({
      ...look,
      hair: pick(mine('hair')).id,
      hairColor: pick(HAIR_COLOURS),
      top: pick(mine('top')).id,
      topColor: pick(CLOTH_COLOURS),
      bottom: pick(mine('bottom')).id,
      bottomColor: pick(CLOTH_COLOURS),
      shoes: pick(mine('shoes')).id,
      shoesColor: pick(CLOTH_COLOURS),
      hat: Math.random() < 0.5 ? 'none' : pick(mine('hat')).id,
      glasses: Math.random() < 0.6 ? 'none' : pick(mine('glasses')).id,
      extra: Math.random() < 0.6 ? 'none' : pick(mine('extra')).id,
    });
    navigator.vibrate?.(20);
  };

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="absolute inset-x-0 bottom-0 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]"
    >
      <div className={`${glass} rounded-3xl p-3 max-w-xl mx-auto`}>
        <div className="flex items-center justify-between mb-2 gap-2">
          <p className="font-serif italic text-xl text-stone-800 dark:text-stone-100">Dressing room</p>
          <div className="flex items-center gap-2">
            <button onClick={surprise} className="rounded-full px-3 py-1.5 text-xs font-semibold bg-white/80 dark:bg-white/10 text-stone-700 dark:text-stone-200 flex items-center gap-1">
              <Shuffle className="w-3.5 h-3.5" /> Surprise me
            </button>
            <span className="btn-gloss rounded-full px-3 py-1.5 text-xs font-semibold">💗 {coins.toLocaleString()}</span>
          </div>
        </div>

        {/* tabs */}
        <div className="flex gap-1.5 overflow-x-auto pb-2 -mx-1 px-1">
          {SLOTS.map((s) => (
            <button
              key={s.slot}
              onClick={() => setTab(s.slot)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${tab === s.slot ? 'btn-gloss' : 'bg-white/70 dark:bg-white/10 text-stone-600 dark:text-stone-300'}`}
            >
              {s.emoji} {s.label}
            </button>
          ))}
        </div>

        {tab === 'skin' ? (
          <div className="flex flex-wrap gap-2.5 py-2">
            {SKINS.map((c) => (
              <button key={c} onClick={() => onChange({ ...look, skin: c })} className={`w-10 h-10 rounded-full ring-2 ${look.skin === c ? 'ring-[#E05A74] scale-110' : 'ring-white'}`} style={{ background: c }} aria-label="Skin tone" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-36 overflow-y-auto pr-1">
              {items.map((c) => {
                const key = clothKey(c);
                const wearing = look[c.slot] === c.id;
                const mine = owns(owned, c);
                const isBuying = buying === key;
                return (
                  <button
                    key={key}
                    onClick={() => choose(c)}
                    disabled={busy}
                    className={`relative rounded-2xl p-2 flex flex-col items-center gap-0.5 text-center transition-transform active:scale-95 ${
                      wearing ? 'bg-rose-100 ring-2 ring-[#E05A74] dark:bg-rose-500/20' : isBuying ? 'bg-amber-100 ring-2 ring-amber-400 dark:bg-amber-500/20' : 'bg-white/70 dark:bg-white/5'
                    }`}
                  >
                    <span className="text-2xl leading-none">{c.emoji}</span>
                    <span className="text-[10px] font-semibold text-stone-700 dark:text-stone-200 leading-tight">{c.name}</span>
                    {wearing ? (
                      <span className="text-[10px] text-[#E05A74] font-bold flex items-center gap-0.5"><Check className="w-3 h-3" /> on</span>
                    ) : mine ? (
                      <span className="text-[10px] text-stone-400">{c.cost ? 'yours' : 'free'}</span>
                    ) : isBuying ? (
                      <span className={`text-[10px] font-bold ${coins >= c.cost ? 'text-amber-600' : 'text-rose-500'}`}>{coins >= c.cost ? `Buy · ${c.cost}` : `Need ${c.cost - coins}`}</span>
                    ) : (
                      <span className="text-[10px] text-stone-500 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> {c.cost} 💗</span>
                    )}
                  </button>
                );
              })}
            </div>
            {slot.color && (
              <div className="flex gap-2 overflow-x-auto pt-3 pb-1 -mx-1 px-1">
                {colours.map((c) => (
                  <button
                    key={c}
                    onClick={() => onChange({ ...look, [slot.color!]: c })}
                    className={`shrink-0 w-8 h-8 rounded-full ring-2 ${look[slot.color!] === c ? 'ring-[#E05A74] scale-110' : 'ring-white dark:ring-stone-700'}`}
                    style={{ background: c }}
                    aria-label="Colour"
                  />
                ))}
              </div>
            )}
          </>
        )}

        <p className="text-[10px] text-center text-stone-400 mt-2">Drag to turn around · tap a locked item twice to buy it</p>
        <button onClick={onDone} className="mt-2 w-full btn-gloss rounded-full py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5">
          <Check className="w-4 h-4" /> Save outfit
        </button>
      </div>
    </motion.div>
  );
};
