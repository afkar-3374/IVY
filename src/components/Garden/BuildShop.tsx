import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Lock, Hammer } from 'lucide-react';
import { GARDEN_ITEMS, ITEM_BY_ID } from '../../data/gardenItems';
import { BuildDefs, DRAWINGS, PREVIEW_BOX } from './BuildDrawings';
import { useAuthStore } from '../../store/useAuthStore';
import { useGameStore } from '../../store/useGameStore';
import { useUIStore } from '../../store/useUIStore';
import { cardClass } from '../Couple/CoupleCards';

const Preview: React.FC<{ id: string }> = ({ id }) => {
  const Drawing = DRAWINGS[id];
  return (
    <svg viewBox={PREVIEW_BOX[id]} className="w-full h-full" aria-hidden>
      <defs>
        <BuildDefs />
      </defs>
      <Drawing night={false} />
    </svg>
  );
};

/** Spend love coins to build things in the shared garden. */
export const BuildShop: React.FC<{ coins: number }> = ({ coins }) => {
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;
  const builds = useGameStore((s) => s.builds);
  const build = useGameStore((s) => s.build);
  const addToast = useUIStore((s) => s.addToast);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // A pending "confirm" quietly expires
  useEffect(() => {
    if (!confirming) return;
    const t = setTimeout(() => setConfirming(null), 4000);
    return () => clearTimeout(t);
  }, [confirming]);

  const builtBy = (id: string) => builds.find((b) => b.item === id)?.built_by;
  const sorted = [...GARDEN_ITEMS].sort((a, b) => Number(Boolean(builtBy(a.id))) - Number(Boolean(builtBy(b.id))) || a.cost - b.cost);

  const onBuild = async (id: string, cost: number) => {
    if (confirming !== id) return setConfirming(id);
    setConfirming(null);
    setBusy(true);
    const ok = await build(id, cost);
    setBusy(false);
    if (ok) {
      navigator.vibrate?.([40, 30, 80]);
      addToast(`You built ${ITEM_BY_ID[id].name.toLowerCase()} ${ITEM_BY_ID[id].emoji}`, 'success');
      document.getElementById('garden-scene')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <div className={`${cardClass} p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74]">Build our world</p>
          <p className="text-xs text-stone-500 dark:text-stone-400">Spend love coins together · your garden level never goes down</p>
        </div>
        <div className="btn-gloss rounded-full px-4 py-1.5 text-sm font-semibold flex items-center gap-1.5">
          💗 <span className="font-cute">{coins.toLocaleString()}</span> love coins
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
        {sorted.map((item, i) => {
          const by = builtBy(item.id);
          const needs = item.requires && !builtBy(item.requires) ? ITEM_BY_ID[item.requires] : null;
          const affordable = coins >= item.cost;
          const isConfirming = confirming === item.id;
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 10) * 0.04 }}
              className={`relative rounded-2xl p-3 flex flex-col border transition-colors ${
                by
                  ? 'bg-emerald-50/70 border-emerald-200/70 dark:bg-emerald-500/10 dark:border-emerald-500/20'
                  : 'bg-white/60 border-white/80 dark:bg-white/5 dark:border-white/10'
              }`}
            >
              <div className={`h-20 mb-2 flex items-end justify-center ${!by && (!affordable || needs) ? 'opacity-55 grayscale-[35%]' : ''}`}>
                <div className="h-full w-full max-w-[7rem]"><Preview id={item.id} /></div>
              </div>
              <p className="text-sm font-semibold text-stone-800 dark:text-stone-100 leading-tight">{item.emoji} {item.name}</p>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 leading-snug mt-0.5 mb-2 flex-1">{item.description}</p>

              {by ? (
                <p className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Built by {by === me?.id ? 'you' : partnerName}
                </p>
              ) : needs ? (
                <p className="text-[11px] font-semibold text-stone-400 flex items-center gap-1">
                  <Lock className="w-3.5 h-3.5" /> Build the {needs.name.toLowerCase()} first
                </p>
              ) : affordable ? (
                <button
                  onClick={() => onBuild(item.id, item.cost)}
                  disabled={busy}
                  className={`btn-gloss rounded-full py-1.5 text-xs font-semibold flex items-center justify-center gap-1 ${isConfirming ? 'ring-2 ring-amber-300' : ''}`}
                >
                  <Hammer className="w-3.5 h-3.5" /> {isConfirming ? `Tap to confirm · ${item.cost}` : `Build · ${item.cost}`}
                </button>
              ) : (
                <div>
                  <div className="h-1.5 rounded-full bg-rose-100 dark:bg-stone-800 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#F9A8D4] to-[#E05A74]" style={{ width: `${Math.min(100, (coins / item.cost) * 100)}%` }} />
                  </div>
                  <p className="text-[11px] text-stone-400 mt-1 flex justify-between gap-1 whitespace-nowrap">
                    <span className="font-semibold text-stone-500 dark:text-stone-300">{item.cost} 💗</span>
                    <span>{item.cost - coins} to go</span>
                  </p>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
