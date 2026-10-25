import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, Move, Shirt, Check, RotateCcw, RotateCw, Undo2, LogOut, ArrowDownToLine, Heart, Target, BatteryLow, BatteryFull, X } from 'lucide-react';
import { useAuthStore } from '../store/useAuthStore';
import { useGameStore } from '../store/useGameStore';
import { useCoupleStore } from '../store/useCoupleStore';
import { useUIStore } from '../store/useUIStore';
import { gardenLevel, loveCoins, sumBy } from '../utils/scores';
import { dayIndex, todayKey } from '../data/gameQuestions';
import { GARDEN_ITEMS, ITEM_BY_ID } from '../data/gardenItems';
import { USER_1_ID } from '../utils/constants';
import { Avatar } from '../components/ui/Avatar';
import { gardenWeather, type Phase } from '../components/Garden/GardenScene';
import { WorldScene } from '../components/World/WorldScene';
import { Joystick } from '../components/World/Joystick';
import { DressingPanel } from '../components/World/DressingPanel';
import { live, resetVehicles, useWorldUI } from '../components/World/worldState';
import {
  ACTIVITIES,
  ACTIVITY_POINTS,
  TOGETHER_POINTS,
  VEHICLES,
  interactables,
  placeBuilds,
  vehicleInteractables,
  WORLD_SPOTS,
} from '../components/World/worldData';
import { clothKey, completeLook, type Cloth, type Look } from '../components/World/wardrobe';
import { RACE_GATES } from '../components/World/terrain';
import {
  activate,
  cancelFerrisWait,
  climbDown,
  emote,
  enterDressing,
  hugPartner,
  kissPartner,
  joinWorld,
  leaveArea,
  leaveDressing,
  standUp,
  type ActionHelpers,
} from '../components/World/worldActions';

function phaseFor(hour: number): Phase {
  if (hour >= 6 && hour < 17) return 'day';
  if (hour >= 17 && hour < 19) return 'sunset';
  return 'night';
}

const HINT_KEY = 'ivy_world_hint_seen';
const BEST_KEY = 'ivy_boat_race_best';
const EMOJIS = ['😘', '🥰', '😍', '😂', '🤣', '😊', '🥺', '😢', '😭', '😡', '😴', '🤔', '😎', '🤩', '😜', '🙈', '👍', '🙏', '👏', '💪', '🔥', '🎉', '💯', '✨', '❤️', '💕', '💋', '🌹', '🍫', '☕', '🍕', '🎶'];
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;
const glass = 'bg-white/70 dark:bg-stone-900/60 backdrop-blur-md ring-1 ring-white/60 dark:ring-white/10 shadow-lg';

/** Our 3D world: walk around together, ride things, dress up, arrange everything. */
const WorldPage: React.FC = () => {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.user);
  const partner = useAuthStore((s) => s.getPartnerProfile());
  const partnerName = me?.nickname || partner.display_name;
  const myName = me?.display_name || 'Me';
  const points = useGameStore((s) => s.points);
  const builds = useGameStore((s) => s.builds);
  const avatars = useGameStore((s) => s.avatars);
  const place = useGameStore((s) => s.place);
  const award = useGameStore((s) => s.award);
  const saveAvatar = useGameStore((s) => s.saveAvatar);
  const sendLove = useCoupleStore((s) => s.sendLove);
  const addToast = useUIStore((s) => s.addToast);

  const mode = useWorldUI((s) => s.mode);
  const area = useWorldUI((s) => s.area);
  const seat = useWorldUI((s) => s.seat);
  const nearby = useWorldUI((s) => s.nearby);
  const canHug = useWorldUI((s) => s.canHug);
  const selected = useWorldUI((s) => s.selected);
  const partnerHere = useWorldUI((s) => s.partner);
  const questsOpen = useWorldUI((s) => s.questsOpen);
  const ferrisWaiting = useWorldUI((s) => s.ferrisWaiting);
  const ferrisLeaving = useWorldUI((s) => s.ferrisLeaving);
  const race = useWorldUI((s) => s.race);
  const saver = useWorldUI((s) => s.saver);
  const setSaver = useWorldUI((s) => s.setSaver);
  const setMode = useWorldUI((s) => s.setMode);
  const [emojiOpen, setEmojiOpen] = useState(false);
  // race clock / countdown ticks
  const [, tick] = useState(0);
  useEffect(() => {
    if (!race && !ferrisWaiting) return;
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [race, ferrisWaiting]);

  const [phase, setPhase] = useState<Phase>(() => phaseFor(new Date().getHours()));
  // the balloon's landing state lives outside React; re-render when you ask to land
  const [, rerender] = useState(0);
  const [hint, setHint] = useState(() => {
    try {
      return !localStorage.getItem(HINT_KEY);
    } catch {
      return true;
    }
  });

  const isFirst = me?.id === USER_1_ID;
  const total = sumBy(points);
  const coins = loveCoins(points, builds, avatars);
  const { current } = gardenLevel(total);
  const { season, weather, label: weatherLabel } = gardenWeather(new Date(), dayIndex());
  const placements = useMemo(() => placeBuilds(builds), [builds]);
  const list = useMemo(() => interactables(area, placements), [area, placements]);
  const builtIds = new Set(builds.map((b) => b.item));
  const toBuild = GARDEN_ITEMS.filter((i) => !builtIds.has(i.id)).length;

  // Outfits: yours (a draft while you're in the dressing room) and your partner's, saved and live
  const mine = avatars.find((a) => a.user_id === me?.id);
  const theirs = avatars.find((a) => a.user_id === partner.id);
  const savedLook = useMemo(() => completeLook(mine?.look as Partial<Look>, isFirst), [mine?.look, isFirst]);
  const partnerLook = useMemo(() => completeLook(theirs?.look as Partial<Look>, !isFirst), [theirs?.look, isFirst]);
  const [draft, setDraft] = useState<Look | null>(null);
  const myLook = area === 'dressing' && draft ? draft : savedLook;

  // Today's activities
  const today = todayKey();
  const doneRefs = new Set(points.filter((p) => p.user_id === me?.id && p.ref.startsWith('world:') && p.ref.endsWith(`:${today}`)).map((p) => p.ref));
  const isDone = (key: string) => doneRefs.has(`world:${key}:${today}`);
  const doneCount = ACTIVITIES.filter((a) => isDone(a.key)).length;
  const earnedToday = points
    .filter((p) => p.user_id === me?.id && p.source === 'world' && p.ref.endsWith(`:${today}`))
    .reduce((t, p) => t + p.points, 0);

  const reward = useCallback(
    (key: string, together = false) => {
      void award('world', together ? TOGETHER_POINTS : ACTIVITY_POINTS, `world:${together ? `${key}-together` : key}:${todayKey()}`);
    },
    [award]
  );

  const helpers: ActionHelpers = useMemo(
    () => ({ placements, partnerName, isFirst, toast: addToast, loveTap: () => void sendLove('tap'), reward }),
    [placements, partnerName, isFirst, addToast, sendLove, reward]
  );

  // Start fresh by the love tree each visit, side by side
  useEffect(() => {
    Object.assign(live.me, { x: isFirst ? -0.9 : 0.9, y: 0, z: 4.5, ry: Math.PI, tilt: 0, pose: 'stand', moving: false });
    live.yaw = 0.25;
    live.pitch = 0.4;
    live.zoom = 1;
    live.target = null;
    live.ride = null;
    live.teleported += 1;
    resetVehicles();
    live.ferrisWait = null;
    live.vel = { x: 0, z: 0 };
    useWorldUI.setState({ mode: 'play', area: 'out', seat: null, nearby: null, selected: null, questsOpen: false, race: null, ferrisWaiting: false, ferrisLeaving: false });
    const leave = joinWorld(
      (here) => addToast(here ? `${partnerName} came into our world 💞` : `${partnerName} left our world`, here ? 'success' : 'info'),
      (kind) => reward(kind)
    );
    const t = setInterval(() => setPhase(phaseFor(new Date().getHours())), 60_000);
    return () => {
      leave();
      clearInterval(t);
      live.joy.x = 0;
      live.joy.y = 0;
    };
  }, [isFirst, partnerName, addToast, reward]);

  // If the cottage or tree house disappears while you're in it, step back outside
  useEffect(() => {
    if ((area === 'home' && !builtIds.has('cottage')) || (area === 'treehouse' && !builtIds.has('treehouse'))) leaveArea();
  });

  // Entering the dressing room starts a draft of your saved look
  useEffect(() => {
    if (area === 'dressing') setDraft((d) => d ?? savedLook);
    else setDraft(null);
  }, [area, savedLook]);

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

  const buy = async (c: Cloth, look: Look) => {
    if (coins < c.cost) {
      addToast(`You need ${c.cost - coins} more love coins — play together to earn them 💗`, 'info');
      return false;
    }
    const ok = await saveAvatar({ look, owned: [...(mine?.owned ?? []), clothKey(c)], spent: (mine?.spent ?? 0) + c.cost });
    if (ok) {
      setDraft(look);
      addToast(`${c.emoji} ${c.name} is yours!`, 'success');
      navigator.vibrate?.([40, 30, 80]);
    }
    return ok;
  };

  const saveOutfit = async () => {
    if (draft && JSON.stringify(draft) !== JSON.stringify(savedLook)) {
      const ok = await saveAvatar({ look: draft, owned: mine?.owned ?? [], spent: mine?.spent ?? 0 });
      if (ok) addToast('Outfit saved 👗', 'success');
    }
    leaveDressing();
  };

  const sel = selected ? placements.find((p) => p.id === selected) : undefined;
  const all = area === 'out' ? [...list, ...vehicleInteractables(live.vehicles)] : list;
  const near = nearby ? all.find((i) => i.key === nearby) : undefined;
  const seatIt = seat ? all.find((i) => i.key === seat.key) : undefined;
  const flying = seatIt?.action === 'ride' && live.ride !== null && live.ride.landAt === null;
  const driving = Boolean(seat && seat.idx === 0 && VEHICLES[seat.key]);
  const showStick = !seat || driving;

  const turn = (by: number) => sel && void place(sel.id, { x: sel.x, z: sel.z, rot: sel.rot + by, size: sel.size });
  const resize = (size: number, save: boolean) => sel && void place(sel.id, { x: sel.x, z: sel.z, rot: sel.rot, size }, save);

  // Race result: your time, your best, and who won if you raced together
  const raceTime = race?.time ?? null;
  const partnerRace = partnerHere?.race;
  const [best, setBest] = useState<number | null>(() => {
    try {
      const v = localStorage.getItem(BEST_KEY);
      return v ? Number(v) : null;
    } catch {
      return null;
    }
  });
  useEffect(() => {
    if (raceTime === null || (best !== null && best <= raceTime)) return;
    setBest(raceTime);
    try {
      localStorage.setItem(BEST_KEY, String(raceTime));
    } catch {
      /* storage unavailable */
    }
  }, [raceTime, best]);
  const together = race && partnerRace && Math.abs(partnerRace.start - race.start) < 15;
  const won = together && raceTime !== null && (partnerRace!.time === null || raceTime < partnerRace!.time);
  useEffect(() => {
    // beating your partner in a race together counts as the "together" bonus
    if (won) reward('race', true);
  }, [won, reward]);

  const standLabel =
    seatIt?.action === 'ferris'
      ? ferrisLeaving
        ? 'Getting off at the bottom…'
        : 'Get off at the bottom'
      : race
        ? race.phase === 'done'
          ? 'Back to the jetty'
          : 'Quit the race'
        : seatIt?.action === 'ride'
      ? flying
        ? '🎈 Land the balloon'
        : '🎈 Landing…'
      : seatIt?.vehicle
        ? seat?.idx === 0
          ? 'Park & get out'
          : 'Get out'
        : seatIt?.action === 'train'
          ? 'Get off'
          : 'Stand up';

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
        myLook={myLook}
        partnerLook={partnerLook}
        helpers={helpers}
        onMove={onMove}
      />

      {/* Top bar */}
      {area !== 'dressing' && (
        <div className="pointer-events-none absolute inset-x-0 top-0 p-3 pt-[max(env(safe-area-inset-top),0.75rem)] flex items-start justify-between gap-2">
          <div className="flex flex-col gap-2 items-start">
            <button
              onClick={() => (mode === 'edit' ? setMode('play') : navigate('/garden'))}
              className={`pointer-events-auto ${glass} rounded-full pl-2 pr-3.5 py-2 flex items-center gap-1 text-sm font-semibold text-stone-700 dark:text-stone-100 active:scale-95 transition-transform`}
            >
              <ChevronLeft className="w-4 h-4" /> {mode === 'edit' ? 'Done' : 'Garden'}
            </button>
            {mode === 'play' && (
              <>
                <div className={`${glass} rounded-full px-3 py-1 text-[11px] font-medium text-stone-600 dark:text-stone-200`}>
                  {area === 'home' ? '🏡 Our home' : area === 'treehouse' ? '🌳 Tree house' : weatherLabel}
                </div>
                <button
                  onClick={() => useWorldUI.setState({ questsOpen: !questsOpen })}
                  className={`pointer-events-auto ${glass} rounded-full px-3 py-1.5 text-[11px] font-semibold text-stone-700 dark:text-stone-100 flex items-center gap-1.5`}
                >
                  <Target className="w-3.5 h-3.5 text-[#E05A74]" /> {doneCount}/{ACTIVITIES.length} today · +{earnedToday} 💗
                </button>
              </>
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
                  onClick={() => {
                    setSaver(!saver);
                    addToast(saver ? 'Full graphics on ✨' : 'Battery saver on 🔋 — cooler and smoother on phones', 'info');
                  }}
                  className={`pointer-events-auto ${glass} w-10 h-10 rounded-full flex items-center justify-center ${saver ? 'text-emerald-600' : 'text-stone-700 dark:text-stone-100'} active:scale-95`}
                  aria-label={saver ? 'Battery saver is on' : 'Battery saver is off'}
                  title={saver ? 'Battery saver is on' : 'Turn on battery saver'}
                >
                  {saver ? <BatteryLow className="w-4 h-4" /> : <BatteryFull className="w-4 h-4" />}
                </button>
                {area === 'out' && (
                  <>
                    <button
                      onClick={() => {
                        if (seat) standUp(all, placements);
                        enterDressing(isFirst);
                        reward('boutique');
                      }}
                      className={`pointer-events-auto ${glass} h-10 rounded-full px-3 flex items-center gap-1.5 text-sm font-semibold text-stone-700 dark:text-stone-100 active:scale-95`}
                      aria-label="Dressing room"
                    >
                      <Shirt className="w-4 h-4" /> Dress
                    </button>
                    <button
                      onClick={() => {
                        if (seat) standUp(all, placements);
                        setMode('edit');
                      }}
                      className={`pointer-events-auto ${glass} h-10 rounded-full px-3 flex items-center gap-1.5 text-sm font-semibold text-stone-700 dark:text-stone-100 active:scale-95`}
                    >
                      <Move className="w-4 h-4" /> Arrange
                    </button>
                  </>
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
      )}

      {/* Today in our world */}
      <AnimatePresence>
        {questsOpen && mode === 'play' && area !== 'dressing' && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`absolute left-3 top-40 ${glass} rounded-3xl p-3 w-72 max-w-[calc(100vw-1.5rem)] max-h-[50vh] overflow-y-auto`}
          >
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#E05A74]">Today in our world</p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mb-2">
              +{ACTIVITY_POINTS} for each, +{TOGETHER_POINTS} more when you do it together 💞
            </p>
            <div className="flex flex-col gap-1">
              {ACTIVITIES.map((a) => {
                const done = isDone(a.key);
                const both = doneRefs.has(`world:${a.key}-together:${today}`);
                return (
                  <div key={a.key} className={`flex items-center justify-between rounded-xl px-2.5 py-1.5 text-xs ${done ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-white/60 dark:bg-white/5'}`}>
                    <span className={done ? 'text-emerald-700 dark:text-emerald-300 font-semibold' : 'text-stone-700 dark:text-stone-200'}>
                      {a.emoji} {a.label}
                    </span>
                    <span className="text-[10px] font-semibold whitespace-nowrap">
                      {both ? '💞 ✓' : done ? '✓' : <span className="text-stone-400">+{ACTIVITY_POINTS}</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Boat race */}
      {race && (
        <div className="pointer-events-none absolute inset-x-0 top-20 flex flex-col items-center gap-2">
          <div className={`${glass} rounded-full px-4 py-1.5 text-sm font-bold text-stone-800 dark:text-stone-100 tabular-nums flex items-center gap-3`}>
            <span>🏁 {race.phase === 'done' ? 'Finished!' : race.gate === 0 ? 'Start' : race.gate >= RACE_GATES ? 'Finish line next' : `Gate ${race.gate}/${RACE_GATES}`}</span>
            <span>⏱ {fmtTime(race.time ?? Math.max(0, Date.now() / 1000 - race.start))}</span>
            {best !== null && <span className="text-xs font-semibold text-stone-500">best {fmtTime(best)}</span>}
          </div>
          {partnerRace && together && race.phase !== 'done' && (
            <div className={`${glass} rounded-full px-3 py-1 text-[11px] font-semibold text-stone-600 dark:text-stone-200`}>
              {partnerName}: {partnerRace.time !== null ? `finished ${fmtTime(partnerRace.time)}` : `gate ${Math.min(partnerRace.gate, RACE_GATES)}/${RACE_GATES}`}
            </div>
          )}
          <AnimatePresence>
            {race.phase === 'countdown' && (
              <motion.p
                key={Math.ceil(race.start - Date.now() / 1000)}
                initial={{ scale: 2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-cute text-7xl font-bold text-white drop-shadow-[0_4px_10px_rgba(0,0,0,0.35)] mt-16"
              >
                {Math.max(1, Math.ceil(race.start - Date.now() / 1000))}
              </motion.p>
            )}
            {race.phase === 'go' && Date.now() / 1000 - race.start < 1 && (
              <motion.p initial={{ scale: 2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }} className="font-cute text-7xl font-bold text-emerald-400 drop-shadow-lg mt-16">
                GO!
              </motion.p>
            )}
          </AnimatePresence>
          {race.phase === 'done' && (
            <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className={`${glass} rounded-3xl px-6 py-4 text-center mt-8`}>
              <p className="text-3xl">{together ? (won ? '🏆' : partnerRace!.time === null ? '⏳' : '🥈') : '🎉'}</p>
              <p className="font-serif italic text-xl text-stone-800 dark:text-stone-100">
                {together ? (won ? 'You won!' : partnerRace!.time === null ? `Waiting for ${partnerName}…` : `${partnerName} won this time`) : 'Race finished!'}
              </p>
              <p className="text-sm text-stone-600 dark:text-stone-300 tabular-nums">
                {fmtTime(raceTime ?? 0)}
                {best !== null && raceTime !== null && raceTime <= best ? ' · new best! ✨' : ''}
              </p>
            </motion.div>
          )}
        </div>
      )}

      {/* Waiting for a Ferris wheel cabin */}
      {ferrisWaiting && live.ferrisWait && (
        <div className="absolute inset-x-0 top-24 flex justify-center pointer-events-none">
          <div className={`pointer-events-auto ${glass} rounded-full pl-4 pr-1.5 py-1.5 text-sm font-semibold text-stone-700 dark:text-stone-100 flex items-center gap-2`}>
            🎡 Cabin arriving in {Math.max(0, Math.ceil(live.ferrisWait.at - Date.now() / 1000))}s
            <button onClick={cancelFerrisWait} className="w-7 h-7 rounded-full bg-white/80 dark:bg-white/10 flex items-center justify-center" aria-label="Stop waiting">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Emoji picker */}
      <AnimatePresence>
        {emojiOpen && mode === 'play' && area !== 'dressing' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className={`absolute right-3 bottom-[17rem] ${glass} rounded-3xl p-3 w-[17rem]`}
          >
            <div className="grid grid-cols-8 gap-1">
              {EMOJIS.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    emote('emoji', e);
                    setEmojiOpen(false);
                  }}
                  className="text-2xl leading-none p-1 rounded-xl active:scale-90 hover:bg-white/60 dark:hover:bg-white/10 transition-transform"
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <button
                onClick={() => {
                  emote('dance');
                  setEmojiOpen(false);
                }}
                className="rounded-full py-2 text-xs font-semibold bg-white/80 dark:bg-white/10 text-stone-700 dark:text-stone-200"
              >
                💃 Dance
              </button>
              <button
                onClick={() => {
                  if (canHug) kissPartner(helpers);
                  else emote('kiss');
                  setEmojiOpen(false);
                }}
                className="rounded-full py-2 text-xs font-semibold btn-gloss"
              >
                💋 {canHug ? `Kiss ${partnerName}` : 'Blow a kiss'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* First-visit hint */}
      <AnimatePresence>
        {hint && mode === 'play' && area === 'out' && (
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

      {area === 'dressing' && draft ? (
        <DressingPanel look={draft} owned={mine?.owned ?? []} coins={coins} onChange={setDraft} onBuy={buy} onDone={saveOutfit} />
      ) : mode === 'play' ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 p-4 pb-[max(env(safe-area-inset-bottom),1rem)] flex items-end justify-between gap-3">
          <div className={showStick ? 'pointer-events-auto' : 'opacity-0 pointer-events-none'}>
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
                    standUp(all, placements);
                    rerender((n) => n + 1);
                  }}
                  className="pointer-events-auto btn-gloss rounded-full px-5 py-3 text-sm font-semibold shadow-xl"
                >
                  {standLabel}
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
            <button
              onClick={() => setEmojiOpen((o) => !o)}
              className={`${glass} w-12 h-12 rounded-full text-xl active:scale-90 transition-transform ${emojiOpen ? 'ring-2 ring-[#E05A74]' : ''}`}
              aria-label="Emojis, dance and kiss"
            >
              😊
            </button>
            <button onClick={() => emote('hearts')} className={`${glass} w-12 h-12 rounded-full text-xl active:scale-90 transition-transform`} aria-label="Send hearts">
              💗
            </button>
            <button onClick={() => emote('wave')} className={`${glass} w-12 h-12 rounded-full text-xl active:scale-90 transition-transform`} aria-label="Wave">
              👋
            </button>
            <button
              onClick={() => hugPartner(helpers)}
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
                    {ITEM_BY_ID[sel.id]?.emoji} {ITEM_BY_ID[sel.id]?.name}
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
