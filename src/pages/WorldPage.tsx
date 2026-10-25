import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, Move, Palette, Check, RotateCcw, RotateCw, Undo2, LogOut, ArrowDownToLine, Heart } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';
import { useCoupleStore } from '../store/useCoupleStore';
import { useUIStore } from '../store/useUIStore';
import { gardenLevel, sumBy } from '../utils/scores';
import { dayIndex } from '../data/gameQuestions';
import { GARDEN_ITEMS, ITEM_BY_ID } from '../data/gardenItems';
import { USER_1_ID } from '../utils/constants';
import { Avatar } from '../components/ui/Avatar';
import { gardenWeather, type Phase } from '../components/Garden/GardenScene';
import { WorldScene } from '../components/World/WorldScene';
import { Joystick } from '../components/World/Joystick';
import { HAIRS, OUTFITS, live, loadLook, useWorldUI } from '../components/World/worldState';
import { interactables, placeBuilds, WORLD_SPOTS } from '../components/World/worldData';
import { activate, climbDown, emote, hugPartner, joinWorld, leaveArea, standUp, type ActionHelpers } from '../components/World/worldActions';

function phaseFor(hour: number): Phase {
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'sunset';
  return 'night';
}

const HINT_KEY = 'ivy_world_hint_seen';
const glass = 'bg-white/70 dark:bg-stone-900/60 backdrop-blur-md ring-1 ring-white/60 dark:ring-white/10 shadow-lg';

/** Our 3D world: walk around together, sit on the swing, go inside our home, arrange everything. */
const WorldPage: React.FC = () => {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;
  const myName = me?.display_name || 'Me';
  const points = useGameStore((s) => s.points);
  const builds = useGameStore((s) => s.builds);
  const place = useGameStore((s) => s.place);
  const sendLove = useCoupleStore((s) => s.sendLove);
  const addToast = useUIStore((s) => s.addToast);

  const mode = useWorldUI((s) => s.mode);
  const area = useWorldUI((s) => s.area);
  const seat = useWorldUI((s) => s.seat);
  const nearby = useWorldUI((s) => s.nearby);
  const canHug = useWorldUI((s) => s.canHug);
  const selected = useWorldUI((s) => s.selected);
  const partnerHere = useWorldUI((s) => s.partner);
  const look = useWorldUI((s) => s.look);
  const setLook = useWorldUI((s) => s.setLook);
  const setMode = useWorldUI((s) => s.setMode);

  const [phase, setPhase] = useState<Phase>(() => phaseFor(new Date().getHours()));
  const [dressing, setDressing] = useState(false);
  // the balloon's landing state lives outside React; re-render when you ask to land
  const [, rerender] = useState(0);
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem(HINT_KEY);
    } catch {
      return true;
    }
  });

  const total = sumBy(points);
  const { current } = gardenLevel(total);
  const { season, weather, label: weatherLabel } = gardenWeather(new Date(), dayIndex());
  const placements = useMemo(() => placeBuilds(builds), [builds]);
  const list = useMemo(() => interactables(area, placements), [area, placements]);
  const builtIds = new Set(builds.map((b) => b.item));
  const toBuild = GARDEN_ITEMS.filter((i) => !builtIds.has(i.id)).length;
  const isFirst = me?.id === USER_1_ID;

  const helpers: ActionHelpers = useMemo(
    () => ({ placements, partnerName, toast: addToast, loveTap: () => void sendLove('tap') }),
    [placements, partnerName, addToast, sendLove]
  );

  // Start fresh by the love tree each visit, side by side
  useEffect(() => {
    loadLook({ outfit: isFirst ? '#60A5FA' : '#F472B6', hair: '#2B1B17', short: isFirst });
    Object.assign(live.me, { x: isFirst ? -0.9 : 0.9, y: 0, z: 4.5, ry: Math.PI, tilt: 0, pose: 'stand', moving: false });
    live.yaw = 0.25;
    live.pitch = 0.4;
    live.zoom = 1;
    live.target = null;
    live.ride = null;
    live.teleported += 1;
    useWorldUI.setState({ mode: 'play', area: 'out', seat: null, nearby: null, selected: null });
    const leave = joinWorld((here) => addToast(here ? `${partnerName} came into our world 💞` : `${partnerName} left our world`, here ? 'success' : 'info'));
    const t = setInterval(() => setPhase(phaseFor(new Date().getHours())), 60_000);
    return () => {
      leave();
      clearInterval(t);
      live.joy.x = 0;
      live.joy.y = 0;
    };
  }, [isFirst, partnerName, addToast]);

  // If the cottage or tree house disappears while you're in it, step back outside
  useEffect(() => {
    if ((area === 'home' && !builtIds.has('cottage')) || (area === 'treehouse' && !builtIds.has('treehouse'))) leaveArea();
  });

  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => {
      setHint(false);
      try {
        localStorage.setItem(HINT_KEY, '1');
      } catch {
        /* storage unavailable */
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [hint]);

  const onMove = useCallback(
    (id: string, x: number, z: number, save: boolean) => {
      const p = placements.find((pl) => pl.id === id);
      if (p) void place(id, { x, z, rot: p.rot, size: p.size }, save);
    },
    [placements, place]
  );

  const sel = selected ? placements.find((p) => p.id === selected) : undefined;
  const near = nearby ? list.find((i) => i.key === nearby) : undefined;
  const seatIt = seat ? list.find((i) => i.key === seat.key) : undefined;
  const flying = seatIt?.action === 'ride' && live.ride !== null && live.ride.landAt === null;

  const turn = (by: number) => sel && void place(sel.id, { x: sel.x, z: sel.z, rot: sel.rot + by, size: sel.size });
  const resize = (size: number, save: boolean) => sel && void place(sel.id, { x: sel.x, z: sel.z, rot: sel.rot, size }, save);

  const ui = (
    <div className="fixed inset-0 z-[45] bg-sky-200 select-none overflow-hidden" style={{ touchAction: 'none' }}>
      <WorldScene
        placements={placements}
        total={total}
        level={current.level}
        phase={phase}
        season={season}
        weather={weather}
        myName={myName}
        partnerName={partnerName}
        helpers={helpers}
        onMove={onMove}
      />

      {/* Top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 p-3 pt-[max(env(safe-area-inset-top),0.75rem)] flex items-start justify-between gap-2">
        <div className="flex flex-col gap-2 items-start">
          <button
            onClick={() => (mode === 'edit' ? setMode('play') : navigate('/garden'))}
            className={`pointer-events-auto ${glass} rounded-full pl-2 pr-3.5 py-2 flex items-center gap-1 text-sm font-semibold text-stone-700 dark:text-stone-100 active:scale-95 transition-transform`}
          >
            <ChevronLeft className="w-4 h-4" /> {mode === 'edit' ? 'Done' : 'Garden'}
          </button>
          {mode === 'play' && (
            <div className={`${glass} rounded-full px-3 py-1 text-[11px] font-medium text-stone-600 dark:text-stone-200`}>
              {area === 'home' ? '🏡 Our home' : area === 'treehouse' ? '🌳 Tree house' : weatherLabel}
            </div>
          )}
        </div>

        {mode === 'play' ? (
          <div className="flex flex-col items-end gap-2">
            <button
              onClick={() => !partnerHere && sendLove('tap')}
              className={`pointer-events-auto ${glass} rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-100`}
              title={partnerHere ? `${partnerName} is here` : `Send ${partnerName} a love tap`}
            >
              <Avatar src={partner.avatar_url} name={partnerName} size="sm" isOnline={Boolean(partnerHere)} />
              {partnerHere ? `${partnerName} is here 💞` : `Call ${partnerName} 💗`}
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setDressing((d) => !d)}
                className={`pointer-events-auto ${glass} w-10 h-10 rounded-full flex items-center justify-center text-stone-700 dark:text-stone-100 active:scale-95`}
                aria-label="Change your look"
              >
                <Palette className="w-[18px] h-[18px]" />
              </button>
              {area === 'out' && (
                <button
                  onClick={() => {
                    if (seat) standUp(list, placements);
                    setDressing(false);
                    setMode('edit');
                  }}
                  className={`pointer-events-auto ${glass} h-10 rounded-full px-3.5 flex items-center gap-1.5 text-sm font-semibold text-stone-700 dark:text-stone-100 active:scale-95`}
                >
                  <Move className="w-4 h-4" /> Arrange
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className={`${glass} rounded-2xl px-3.5 py-2 text-xs text-stone-600 dark:text-stone-200 max-w-[13rem] text-right`}>
            <p className="font-semibold text-stone-800 dark:text-stone-100">Arrange our world</p>
            Tap a build, then drag it. Drag empty space to look around.
          </div>
        )}
      </div>

      {/* Outfit picker */}
      <AnimatePresence>
        {dressing && mode === 'play' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`absolute right-3 top-32 ${glass} rounded-3xl p-4 w-64`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74] mb-2">Outfit</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {OUTFITS.map((c) => (
                <button key={c} onClick={() => setLook({ outfit: c })} className={`w-8 h-8 rounded-full ring-2 ${look.outfit === c ? 'ring-[#E05A74] scale-110' : 'ring-white'}`} style={{ background: c }} aria-label={`Outfit ${c}`} />
              ))}
            </div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74] mb-2">Hair</p>
            <div className="flex flex-wrap gap-2 mb-3">
              {HAIRS.map((c) => (
                <button key={c} onClick={() => setLook({ hair: c })} className={`w-8 h-8 rounded-full ring-2 ${look.hair === c ? 'ring-[#E05A74] scale-110' : 'ring-white'}`} style={{ background: c }} aria-label={`Hair ${c}`} />
              ))}
            </div>
            <div className="flex gap-2">
              {[
                { short: true, label: 'Short' },
                { short: false, label: 'Ponytail' },
              ].map((o) => (
                <button
                  key={o.label}
                  onClick={() => setLook({ short: o.short })}
                  className={`flex-1 rounded-full py-1.5 text-xs font-semibold ${look.short === o.short ? 'btn-gloss' : 'bg-white/70 dark:bg-white/10 text-stone-600 dark:text-stone-200'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* First-visit hint */}
      <AnimatePresence>
        {hint && mode === 'play' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 ${glass} rounded-2xl px-4 py-2.5 text-xs text-center text-stone-700 dark:text-stone-100`}
          >
            Use the stick to walk · drag to look around
            <br />
            Tap anything to go there and use it ✨
          </motion.p>
        )}
      </AnimatePresence>

      {mode === 'play' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] flex items-end justify-between gap-3">
          <div className={`pointer-events-auto ${seat ? 'opacity-0 pointer-events-none' : ''}`}>
            <Joystick />
          </div>

          {/* What you can do here */}
          <div className="flex-1 flex flex-col items-center gap-2 pb-2 min-w-0">
            {area === 'treehouse' && !seat && (
              <button onClick={() => climbDown(placements)} className={`pointer-events-auto ${glass} rounded-full px-4 py-2 text-sm font-semibold text-stone-700 dark:text-stone-100 flex items-center gap-1.5`}>
                <ArrowDownToLine className="w-4 h-4" /> Climb down
              </button>
            )}
            {area === 'home' && !seat && nearby !== 'home:door' && (
              <button onClick={() => activate(list.find((i) => i.key === 'home:door')!, helpers)} className={`pointer-events-auto ${glass} rounded-full px-4 py-2 text-sm font-semibold text-stone-700 dark:text-stone-100 flex items-center gap-1.5`}>
                <LogOut className="w-4 h-4" /> Go outside
              </button>
            )}
            <AnimatePresence mode="wait">
              {seat ? (
                <motion.button
                  key="stand"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  onClick={() => {
                    standUp(list, placements);
                    rerender((n) => n + 1);
                  }}
                  className="pointer-events-auto btn-gloss rounded-full px-5 py-3 text-sm font-semibold shadow-xl"
                >
                  {flying ? '🎈 Land the balloon' : seatIt?.action === 'ride' ? '🎈 Landing…' : 'Stand up'}
                </motion.button>
              ) : near ? (
                <motion.button
                  key={near.key}
                  initial={{ opacity: 0, y: 10, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10 }}
                  onClick={() => activate(near, helpers)}
                  className="pointer-events-auto btn-gloss rounded-full px-5 py-3 text-sm font-semibold shadow-xl max-w-full truncate"
                >
                  {near.label}
                </motion.button>
              ) : null}
            </AnimatePresence>
          </div>

          {/* Emotes */}
          <div className="pointer-events-auto flex flex-col gap-2">
            <button onClick={() => emote('hearts')} className={`${glass} w-12 h-12 rounded-full text-xl active:scale-90 transition-transform`} aria-label="Send hearts">
              💗
            </button>
            <button onClick={() => emote('wave')} className={`${glass} w-12 h-12 rounded-full text-xl active:scale-90 transition-transform`} aria-label="Wave">
              👋
            </button>
            <button
              onClick={() => hugPartner()}
              disabled={!canHug}
              className={`${glass} w-12 h-12 rounded-full text-xl active:scale-90 transition-transform disabled:opacity-40`}
              aria-label={canHug ? `Hug ${partnerName}` : `Walk up to ${partnerName} to hug`}
              title={canHug ? `Hug ${partnerName}` : `Walk up to ${partnerName} to hug`}
            >
              🤗
            </button>
          </div>
        </div>
      ) : (
        /* Arrange panel */
        <div className="absolute inset-x-0 bottom-0 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <div className={`${glass} rounded-3xl p-3 max-w-xl mx-auto`}>
            {sel ? (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold text-stone-800 dark:text-stone-100">
                    {sel.id === 'tree' ? '🌳 Our love tree' : `${ITEM_BY_ID[sel.id]?.emoji} ${ITEM_BY_ID[sel.id]?.name}`}
                  </p>
                  <div className="flex gap-1.5">
                    <button onClick={() => turn(-Math.PI / 8)} className="w-9 h-9 rounded-full bg-white/80 dark:bg-white/10 flex items-center justify-center" aria-label="Turn left">
                      <RotateCcw className="w-4 h-4" />
                    </button>
                    <button onClick={() => turn(Math.PI / 8)} className="w-9 h-9 rounded-full bg-white/80 dark:bg-white/10 flex items-center justify-center" aria-label="Turn right">
                      <RotateCw className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => void place(sel.id, { x: null, z: null, rot: 0, size: 1 })}
                      className="w-9 h-9 rounded-full bg-white/80 dark:bg-white/10 flex items-center justify-center"
                      aria-label="Back to its first spot"
                      title="Back to its first spot"
                    >
                      <Undo2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <label className="flex items-center gap-3 text-xs text-stone-600 dark:text-stone-300">
                  Size
                  <input
                    type="range"
                    min={0.5}
                    max={2.5}
                    step={0.05}
                    value={sel.size}
                    onChange={(e) => resize(Number(e.target.value), false)}
                    onPointerUp={(e) => resize(Number((e.target as HTMLInputElement).value), true)}
                    onKeyUp={(e) => resize(Number((e.target as HTMLInputElement).value), true)}
                    className="flex-1 accent-[#E05A74]"
                  />
                  <span className="w-10 text-right font-semibold">{Math.round(sel.size * 100)}%</span>
                </label>
              </div>
            ) : (
              <p className="text-xs text-stone-500 dark:text-stone-400 mb-2 px-1">Pick something to move, turn or resize:</p>
            )}
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {placements
                .filter((p) => p.id !== 'tree' && WORLD_SPOTS[p.id])
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => useWorldUI.setState({ selected: p.id })}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap ${selected === p.id ? 'btn-gloss' : 'bg-white/80 dark:bg-white/10 text-stone-700 dark:text-stone-200'}`}
                  >
                    {ITEM_BY_ID[p.id]?.emoji} {ITEM_BY_ID[p.id]?.name}
                  </button>
                ))}
              {placements.length <= 1 && <span className="text-xs text-stone-500 px-1 py-1.5">Build things in the garden shop first 🏗️</span>}
            </div>
            {toBuild > 0 && (
              <button onClick={() => navigate('/garden')} className="mt-2 w-full text-[11px] text-stone-500 dark:text-stone-400 flex items-center justify-center gap-1">
                <Heart className="w-3 h-3 text-[#E05A74]" /> {toBuild} more {toBuild === 1 ? 'thing' : 'things'} to build in the garden shop
              </button>
            )}
            <button onClick={() => setMode('play')} className="mt-2 w-full btn-gloss rounded-full py-2.5 text-sm font-semibold flex items-center justify-center gap-1.5">
              <Check className="w-4 h-4" /> Done
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Above the app's tab bar and page transitions
  return createPortal(ui, document.body);
};

export default WorldPage;
