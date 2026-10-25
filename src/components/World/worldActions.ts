import { supabase } from '../../services/supabaseClient';
import {
  DRESS_ORIGIN,
  FIXED_SPOTS,
  HOME_ORIGIN,
  SEAT_ACTIONS,
  TREEHOUSE_HEIGHT,
  activityKey,
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

export function emote(kind: EmoteKind) {
  live.myEmote = { kind, until: now() + 3 };
  live.send('emote', { kind });
  navigator.vibrate?.(kind === 'hug' ? [60, 40, 120] : 30);
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
  live.ride = null;
  live.vehicleSpeed = 0;
  if (it) {
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
    if ((kind === 'drive' || kind === 'cycle') && idx === 1) h.toast(`${h.partnerName} is steering — enjoy the ride 💞`);
    if ((kind === 'drive' || kind === 'cycle') && idx === 0) h.toast('Use the stick to steer 🛞');
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

/** A hug arrived: turn to them and hug back if you're free and close. */
function hugBack(p: RemotePose) {
  const ui = useWorldUI.getState();
  if (ui.seat || ui.area !== p.area) return;
  const dx = p.x - live.me.x;
  const dz = p.z - live.me.z;
  if (Math.hypot(dx, dz) > 3.5) return;
  live.me.ry = Math.atan2(dx, dz);
  live.myEmote = { kind: 'hug', until: now() + 3 };
  navigator.vibrate?.([80, 60, 160]);
}

/** Private live channel: both avatars' poses and emotes. */
export function joinWorld(onPartnerChange: (here: boolean) => void, onHugged: () => void): () => void {
  if (!supabase) return () => {};
  const client = supabase;
  const channel = client.channel('ivy_world', { config: { private: true, broadcast: { self: false } } });
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
      const { kind } = payload as { kind: EmoteKind };
      live.partnerEmote = { kind, until: now() + 3 };
      if (kind === 'hug' && live.partner) {
        hugBack(live.partner);
        onHugged();
      }
    })
    .on('broadcast', { event: 'leave' }, () => {
      live.partner = null;
      syncUI(null);
    })
    .subscribe();

  live.send = (event, payload) => {
    void channel.send({ type: 'broadcast', event, payload });
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
    void channel.send({ type: 'broadcast', event: 'leave', payload: {} });
    live.send = () => {};
    live.partner = null;
    useWorldUI.setState({ partner: null });
    client.removeChannel(channel);
  };
}
