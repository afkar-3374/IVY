import { supabase } from '../../services/supabaseClient';
import {
  DRESS_ORIGIN,
  FIXED_SPOTS,
  HOME_ORIGIN,
  SEAT_ACTIONS,
  TREEHOUSE_HEIGHT,
  VEHICLES,
  activityKey,
  ferrisAtPlatform,
  ferrisNext,
  reachGap,
  rideExit,
  seatCount,
  toWorld,
  now,
  type Area,
  type Interactable,
  type Placement,
} from './worldData';
import { live, useWorldUI, type EmoteKind, type RemotePose } from './worldState';
import { raceStart } from './terrain';

export interface ActionHelpers {
  placements: Placement[];
  partnerName: string;
  /** You are the first of the two (decides your podium in the dressing room) */
  isFirst: boolean;
  toast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  loveTap: () => void;
  /** Love points for doing something in the world (once a day per thing) */
  reward: (key: string, together?: boolean) => void;
}

/** Ground height of an area (where your feet are when standing). */
export function groundY(area: Area, placements: Placement[]): number {
  if (area === 'home') return HOME_ORIGIN[1];
  if (area === 'dressing') return DRESS_ORIGIN[1] + 0.2;
  if (area === 'treehouse') {
    const th = placements.find((p) => p.id === 'treehouse');
    return th ? th.y + TREEHOUSE_HEIGHT * th.size : 0;
  }
  return 0;
}

/** Move yourself somewhere else at once (going inside, climbing up). */
function teleport(area: Area, x: number, y: number, z: number, ry: number, cameraYaw: number) {
  Object.assign(live.me, { x, y, z, ry, tilt: 0, pose: 'stand', moving: false });
  live.target = null;
  live.yaw = cameraYaw;
  live.teleported += 1;
  useWorldUI.setState({ area, seat: null, nearby: null });
}

export function emote(kind: EmoteKind, emoji?: string) {
  live.myEmote = { kind, until: now() + (kind === 'dance' ? 6 : 3), emoji };
  live.send('emote', { kind, emoji });
  navigator.vibrate?.(kind === 'hug' || kind === 'kiss' ? [60, 40, 120] : 30);
}

/** Step off whatever you're sitting on (or out of whatever you're driving). */
export function standUp(list: Interactable[], placements: Placement[]) {
  const { seat, area } = useWorldUI.getState();
  if (!seat) return;
  const it = list.find((i) => i.key === seat.key);
  if (it?.action === 'ride' && live.ride && live.ride.landAt === null) {
    // can't jump out of a flying balloon: start landing instead
    live.ride.landAt = now();
    return;
  }
  if (it?.action === 'ferris' && !ferrisAtPlatform(now(), seat.cabin ?? 0)) {
    // you get off when your cabin comes down to the platform
    useWorldUI.setState({ ferrisLeaving: true });
    return;
  }
  live.ride = null;
  live.vehicleSpeed = 0;
  useWorldUI.setState({ ferrisLeaving: false, race: null });
  if (it && it.vehicle && VEHICLES[it.key]?.water) {
    // boats drop you back on the jetty
    const d = FIXED_SPOTS.dock;
    Object.assign(live.me, { x: d.x, z: d.z, y: 0, tilt: 0, pose: 'stand' });
    live.teleported += 1;
  } else if (it) {
    const off = rideExit(it, now());
    if (off) {
      Object.assign(live.me, { x: off[0], z: off[1], y: 0, tilt: 0, pose: 'stand' });
    } else {
      const e = it.exit ?? [0, 0, it.radius + 0.7];
      // passengers step out the other side of the car
      const side = it.vehicle && seat.idx === 1 ? -1 : 1;
      const [x, , z] = toWorld(it.place, e[0] * side, 0, e[2]);
      Object.assign(live.me, { x, z, y: groundY(area, placements), tilt: 0, pose: 'stand' });
    }
  }
  useWorldUI.setState({ seat: null });
}

/** Into the dressing room, onto your own podium. */
export function enterDressing(isFirst: boolean) {
  live.dressSpin = 0;
  teleport('dressing', DRESS_ORIGIN[0] + (isFirst ? -0.9 : 0.9), DRESS_ORIGIN[1] + 0.2, DRESS_ORIGIN[2], 0, 0);
}

/** Back out of the boutique's door. */
export function leaveDressing() {
  const b = FIXED_SPOTS.boutique;
  const p = { id: 'boutique', x: b.x, y: 0, z: b.z, rot: b.rot, size: 1 };
  const [x, , z] = toWorld(p, 0.9, 0, 2.6);
  teleport('out', x, 0, z, b.rot, b.rot + Math.PI);
}

/** Use a thing: walk there first if it's too far, then sit/enter/climb/etc. */
export function activate(it: Interactable, h: ActionHelpers) {
  const ui = useWorldUI.getState();
  if (ui.seat) return;
  if (reachGap(it, live.me.x, live.me.z) > 0) {
    live.target = { x: it.place.x, z: it.place.z, use: it.key };
    return;
  }
  live.target = null;
  const kind = it.action;
  if (!kind) return;
  const points = activityKey(it.key);

  if (kind === 'ferris') return boardFerris(it, h);
  if (kind === 'race') return startRace(h);

  if (SEAT_ACTIONS.includes(kind)) {
    const partner = ui.partner;
    const taken = partner?.seat?.key === it.key ? partner.seat.idx : -1;
    const idx = Array.from({ length: seatCount(it) }, (_, i) => i).find((i) => i !== taken);
    if (idx === undefined) return h.toast(`${h.partnerName} is using it — join them another way 💞`);
    if (kind === 'ride') live.ride = { start: now(), landAt: null };
    useWorldUI.setState({ seat: { key: it.key, idx }, nearby: null });
    navigator.vibrate?.(25);
    if (points) h.reward(points);
    if (kind === 'wish') {
      emote('hearts');
      h.toast('Your wish is in the fountain ✨');
    }
    if (kind === 'stargaze') h.toast('Look up — every star is a hug 🌟');
    const steered = kind === 'drive' || kind === 'cycle' || kind === 'gallop' || kind === 'sail';
    if (steered && idx === 1) h.toast(`${h.partnerName} is steering — enjoy the ride 💞`);
    if (steered && idx === 0) h.toast('Use the stick to steer 🛞');
    return;
  }

  const cottage = h.placements.find((p) => p.id === 'cottage');
  const th = h.placements.find((p) => p.id === 'treehouse');
  switch (kind) {
    case 'enter':
      teleport('home', HOME_ORIGIN[0], HOME_ORIGIN[1], HOME_ORIGIN[2] + 2.6, Math.PI, 0);
      if (points) h.reward(points);
      break;
    case 'exit':
      if (cottage) {
        const [x, , z] = toWorld(cottage, 0, 0, 2.6);
        teleport('out', x, 0, z, cottage.rot, cottage.rot + Math.PI);
      }
      break;
    case 'climb':
      if (th) {
        const [x, y, z] = toWorld(th, 0, TREEHOUSE_HEIGHT, 0.9);
        teleport('treehouse', x, y, z, th.rot, th.rot);
        if (points) h.reward(points);
      }
      break;
    case 'dress':
      enterDressing(h.isFirst);
      if (points) h.reward(points);
      break;
    case 'pet':
      emote('hearts');
      if (points) h.reward(points);
      h.toast(['They love you 💕', 'Purr purr 🐾', 'So fluffy 🥹'][Math.floor(Math.random() * 3)]);
      break;
    case 'letter':
      h.loveTap();
      h.toast(`Love letter sent to ${h.partnerName} 💌`, 'success');
      break;
  }
}

/** Ferris wheel: get into the cabin at the platform (or wait for the next one). */
function boardFerris(it: Interactable, h: ActionHelpers) {
  const t = now();
  const partner = useWorldUI.getState().partner;
  // ride with your partner if their cabin is at the platform right now
  const theirs = partner?.seat?.key === 'ferris' ? partner.seat.cabin ?? 0 : null;
  const next = theirs !== null && ferrisAtPlatform(t, theirs) ? { cabin: theirs, wait: 0 } : ferrisNext(t);
  // stand on the platform facing the wheel meanwhile
  const [x, , z] = toWorld(it.place, 0, 0, 2.4);
  Object.assign(live.me, { x, z, ry: it.place.rot + Math.PI, pose: 'stand', moving: false });
  live.target = null;
  if (next.wait > 0.3) {
    live.ferrisWait = { cabin: next.cabin, at: t + next.wait };
    useWorldUI.setState({ ferrisWaiting: true, nearby: null });
    h.toast(`Next cabin in ${Math.ceil(next.wait)}s — wait on the platform 🎡`);
    return;
  }
  getInCabin(next.cabin, h);
}

/** Step into a Ferris cabin that's at the platform now. */
export function getInCabin(cabin: number, h: ActionHelpers) {
  const partner = useWorldUI.getState().partner;
  const taken = partner?.seat?.key === 'ferris' && (partner.seat.cabin ?? 0) === cabin ? partner.seat.idx : -1;
  live.ferrisWait = null;
  live.ferrisBoarded = now();
  useWorldUI.setState({ ferrisWaiting: false, ferrisLeaving: false, seat: { key: 'ferris', idx: taken === 0 ? 1 : 0, cabin }, nearby: null });
  navigator.vibrate?.(25);
  h.reward('ferris');
}

export function cancelFerrisWait() {
  live.ferrisWait = null;
  useWorldUI.setState({ ferrisWaiting: false });
}

/** Boat race: into your own speedboat on the start line, 3-2-1-go. */
function startRace(h: ActionHelpers) {
  const boat = h.isFirst ? 'boatA' : 'boatB';
  const start = raceStart(h.isFirst ? 0 : 1);
  live.vehicles[boat] = { x: start.x, z: start.z, ry: start.ry };
  live.vehicleSpeed = 0;
  live.yaw = start.ry + Math.PI;
  live.teleported += 1;
  useWorldUI.setState({
    seat: { key: boat, idx: 0 },
    nearby: null,
    race: { phase: 'countdown', start: now() + 3.5, gate: 0, time: null, boat },
  });
  h.reward('speedboat');
}

export function climbDown(placements: Placement[]) {
  const th = placements.find((p) => p.id === 'treehouse');
  if (!th) return;
  const [x, , z] = toWorld(th, 0, 0, 1.6);
  teleport('out', x, 0, z, th.rot, th.rot + Math.PI);
}

/** Leave the home or tree house if what holds it was removed. */
export function leaveArea() {
  teleport('out', 0, 0, 6, Math.PI, 0.6);
}

/** Walk up to your partner and hug. */
export function hugPartner(h: ActionHelpers) {
  const p = live.partner;
  if (!p) return;
  const dx = p.x - live.me.x;
  const dz = p.z - live.me.z;
  const d = Math.hypot(dx, dz) || 1;
  live.me.ry = Math.atan2(dx, dz);
  if (d > 0.7) {
    live.me.x = p.x - (dx / d) * 0.62;
    live.me.z = p.z - (dz / d) * 0.62;
  }
  emote('hug');
  h.reward('hug');
}

/** Walk up to your partner and kiss. */
export function kissPartner(h: ActionHelpers) {
  const p = live.partner;
  if (!p) return;
  const dx = p.x - live.me.x;
  const dz = p.z - live.me.z;
  const d = Math.hypot(dx, dz) || 1;
  live.me.ry = Math.atan2(dx, dz);
  if (d > 0.6) {
    live.me.x = p.x - (dx / d) * 0.5;
    live.me.z = p.z - (dz / d) * 0.5;
  }
  emote('kiss');
  h.reward('kiss');
}

/** A hug or kiss arrived: turn to them and do it back if you're free and close. */
function hugBack(p: RemotePose, kind: 'hug' | 'kiss') {
  const ui = useWorldUI.getState();
  if (ui.seat || ui.area !== p.area) return;
  const dx = p.x - live.me.x;
  const dz = p.z - live.me.z;
  if (Math.hypot(dx, dz) > 3.5) return;
  live.me.ry = Math.atan2(dx, dz);
  live.myEmote = { kind, until: now() + 3 };
  navigator.vibrate?.([80, 60, 160]);
}

/** Private live channel: both avatars' poses and emotes. */
export function joinWorld(onPartnerChange: (here: boolean) => void, onHugged: (kind: 'hug' | 'kiss') => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client.channel('ivy_world', { config: { private: true, broadcast: { self: false } } });
  // Only send over the open socket: before it connects, supabase falls back to one HTTP
  // request per message (10 a second while walking), which drains the battery
  let joined = false;
  const syncUI = (p: RemotePose | null) => {
    const prev = useWorldUI.getState().partner;
    if (!p) {
      if (prev) {
        useWorldUI.setState({ partner: null, canHug: false });
        onPartnerChange(false);
      }
      return;
    }
    if (!prev) onPartnerChange(true);
    if (!prev || prev.area !== p.area || prev.seat?.key !== p.seat?.key || prev.seat?.idx !== p.seat?.idx || (prev.ride === null) !== (p.ride === null)) {
      useWorldUI.setState({ partner: p });
    }
  };
  channel
    .on('broadcast', { event: 'pose' }, ({ payload }) => {
      const p = payload as RemotePose;
      if (!live.partner || Math.hypot(p.x - live.partnerShown.x, p.y - live.partnerShown.y, p.z - live.partnerShown.z) > 6) {
        Object.assign(live.partnerShown, { x: p.x, y: p.y, z: p.z, ry: p.ry });
      }
      // they are driving: the car/bike goes where they say
      if (p.drive) live.vehicles[p.drive.id] = { x: p.drive.x, z: p.drive.z, ry: p.drive.ry };
      live.partner = p;
      live.partnerSeenAt = Date.now();
      syncUI(p);
    })
    .on('broadcast', { event: 'emote' }, ({ payload }) => {
      const { kind, emoji } = payload as { kind: EmoteKind; emoji?: string };
      live.partnerEmote = { kind, until: now() + (kind === 'dance' ? 6 : 3), emoji };
      if ((kind === 'hug' || kind === 'kiss') && live.partner) {
        hugBack(live.partner, kind);
        onHugged(kind);
      }
    })
    .on('broadcast', { event: 'leave' }, () => {
      live.partner = null;
      syncUI(null);
    })
    .subscribe((status) => {
      joined = status === 'SUBSCRIBED';
    });

  live.send = (event, payload) => {
    if (joined) void channel.send({ type: 'broadcast', event, payload });
  };
  // Forget a partner whose phone went quiet
  const stale = window.setInterval(() => {
    if (live.partner && Date.now() - live.partnerSeenAt > 6000) {
      live.partner = null;
      syncUI(null);
    }
  }, 2000);

  return () => {
    window.clearInterval(stale);
    if (joined) void channel.send({ type: 'broadcast', event: 'leave', payload: {} });
    live.send = () => {};
    live.partner = null;
    useWorldUI.setState({ partner: null });
    client.removeChannel(channel);
  };
}
