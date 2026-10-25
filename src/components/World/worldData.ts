/** Layout, collisions and things to do in our 3D world (pure data + math, no React). */

export type Area = 'out' | 'home' | 'treehouse' | 'dressing';
export type AvatarPose = 'stand' | 'walk' | 'sit' | 'sitLow' | 'lie' | 'hug' | 'wave' | 'swing' | 'pedal';
export type ActionKind =
  | 'sit' | 'swing' | 'boat' | 'ride' | 'lie' | 'stand' | 'wish' | 'stargaze'
  | 'drive' | 'cycle' | 'train' | 'ferris'
  | 'enter' | 'exit' | 'climb' | 'pet' | 'letter' | 'dress';

/** A spot to sit/lie/stand, in the item's own space (before turning and resizing). */
export interface Seat {
  x: number;
  y: number;
  z: number;
  ry: number;
  pose: AvatarPose;
}

export interface Placement {
  id: string;
  x: number;
  /** Ground height the item stands on (indoors and up in the tree house it isn't 0) */
  y: number;
  z: number;
  rot: number;
  size: number;
}

export interface SpotDef {
  /** Collision circle at size 1 (0 = you can walk through it) */
  radius: number;
  /** How close (beyond the radius) you need to be to use it */
  reach: number;
  action?: ActionKind;
  label?: string;
  seats?: Seat[];
  /** Where you step off to, in the item's own space */
  exit?: [number, number, number];
  /** Long things (the bridge): closeness is measured to a line this far either side along x */
  span?: number;
}

export const ISLAND_RADIUS = 33;
/** The ring road the train runs on (and the car loves) */
export const ROAD_RADIUS = 28;
export const ROAD_WIDTH = 2.6;
/** The dressing room, far below the island too */
export const DRESS_ORIGIN: [number, number, number] = [0, -200, 0];
/** The inside of our cottage lives far below the island */
export const HOME_ORIGIN: [number, number, number] = [0, -100, 0];
export const HOME_HALF: [number, number] = [4.6, 3.6];
export const TREEHOUSE_HEIGHT = 3.4;
export const PLAYER_RADIUS = 0.32;
export const BALLOON_TOP = 16;

const pair = (x: number, y: number, z: number, ry: number, pose: AvatarPose, gap = 0.4): Seat[] => [
  { x: x - gap, y, z, ry, pose },
  { x: x + gap, y, z, ry, pose },
];

/** Default spot for every build (and the love tree) on the island, plus what you can do there. */
export const WORLD_SPOTS: Record<string, SpotDef & { x: number; z: number; rot: number }> = {
  tree: { x: 0, z: -2, rot: 0, radius: 0.7, reach: 1.6, action: 'sit', label: 'Sit under our tree', seats: pair(0, 0.12, 1.25, 0, 'sitLow', 0.45), exit: [0, 0, 2.2] },
  mailbox: { x: 3.6, z: 3.4, rot: -0.3, radius: 0.3, reach: 1.2, action: 'letter', label: 'Send a love letter' },
  bench: { x: 5.2, z: 0.4, rot: -0.5, radius: 1.0, reach: 1.0, action: 'sit', label: 'Sit on the bench', seats: pair(0, 0.5, 0.05, 0, 'sit'), exit: [0, 0, 1.1] },
  picnic: {
    x: 2.6, z: 6.4, rot: 0.2, radius: 0, reach: 1.4, action: 'sit', label: 'Have a picnic',
    seats: [{ x: -0.55, y: 0.12, z: 0.1, ry: Math.PI / 2, pose: 'sitLow' }, { x: 0.55, y: 0.12, z: 0.1, ry: -Math.PI / 2, pose: 'sitLow' }],
    exit: [0, 0, 1.4],
  },
  lanterns: { x: -0.5, z: 8.5, rot: 0, radius: 0, reach: 0 },
  mushrooms: { x: -4.4, z: 6.6, rot: 0, radius: 0, reach: 0 },
  bunnies: { x: -12, z: 8.5, rot: 0.4, radius: 0.6, reach: 1.2, action: 'pet', label: 'Pet the bunnies' },
  pets: { x: 8.2, z: 4.2, rot: -0.6, radius: 0.6, reach: 1.2, action: 'pet', label: 'Pet the kitty & puppy' },
  swing: { x: -5.4, z: 1.2, rot: 0.35, radius: 0, reach: 1.4, action: 'swing', label: 'Swing together', seats: pair(0, 0, 0.06, 0, 'swing', 0.36), exit: [0, 0, 1.4] },
  pond: { x: -11, z: -0.5, rot: 0, radius: 3.1, reach: 1.0, action: 'boat', label: 'Row the boat', exit: [0, 0, 3.8] },
  bridge: { x: -11, z: -0.5, rot: 0, radius: 0, reach: 1.0, span: 4, action: 'stand', label: 'Stand on the bridge', seats: pair(0, 0.62, 0, 0, 'stand', 0.3), exit: [0, 0, 3.8] },
  arch: { x: 0, z: 10.5, rot: 0, radius: 0, reach: 0 },
  fountain: { x: 9.5, z: 9.5, rot: 0, radius: 1.4, reach: 1.0, action: 'wish', label: 'Make a wish', seats: pair(0, 0, 1.75, Math.PI, 'stand', 0.45), exit: [0, 0, 2.3] },
  hammock: { x: -8.5, z: -8, rot: 0.3, radius: 0, reach: 1.4, action: 'lie', label: 'Lie in the hammock', seats: [{ x: 0.15, y: 0.85, z: -0.22, ry: Math.PI / 2, pose: 'lie' }, { x: 0.15, y: 0.85, z: 0.22, ry: Math.PI / 2, pose: 'lie' }], exit: [0, 0, 1.4] },
  telescope: { x: 14, z: 3, rot: -1.2, radius: 0.5, reach: 1.0, action: 'stargaze', label: 'Look at the stars', seats: [{ x: 0, y: 0, z: 0.75, ry: Math.PI, pose: 'stand' }, { x: 0.7, y: 0, z: 0.85, ry: Math.PI, pose: 'stand' }], exit: [0, 0, 1.5] },
  treehouse: { x: 12.5, z: -8.5, rot: -0.4, radius: 0.75, reach: 1.4, action: 'climb', label: 'Climb the tree house' },
  balloon: { x: -15, z: 10, rot: 0.5, radius: 1.0, reach: 1.0, action: 'ride', label: 'Ride the balloon', seats: pair(0, 0.15, 0, 0, 'stand', 0.28), exit: [0, 0, 1.8] },
  windmill: { x: 18, z: -13, rot: -0.7, radius: 1.6, reach: 0 },
  cottage: { x: -14.5, z: -10, rot: 0.55, radius: 2.7, reach: 1.2, action: 'enter', label: 'Go inside our home' },
  gazebo: { x: 5.5, z: -11, rot: 0.1, radius: 0, reach: 0.4, action: 'sit', label: 'Sit in the gazebo', seats: pair(0, 0.48, -0.95, 0, 'sit'), exit: [0, 0, 0.6] },
};

/** Always in our world (not bought in the shop, can't be moved). */
export const FIXED_SPOTS: Record<string, SpotDef & { x: number; z: number; rot: number }> = {
  boutique: { x: 17, z: 13.5, rot: -0.9, radius: 2.3, reach: 1.3, action: 'dress', label: 'Dressing room 👗' },
  station: { x: 8, z: 24.6, rot: 0, radius: 0, reach: 1.6, action: 'train', label: 'Ride the train 🚂', span: 2.2 },
  ferris: { x: -18, z: -17, rot: 0.75, radius: 2.4, reach: 1.4, action: 'ferris', label: 'Ride the Ferris wheel 🎡' },
  parking: { x: -5, z: 21.5, rot: 0, radius: 0, reach: 0 },
};

/** Vehicles: where they wait at first, and their seats (in vehicle space, facing +z). */
export const VEHICLES: Record<string, SpotDef & { x: number; z: number; rot: number; speed: number }> = {
  car: {
    x: -6.6, z: 21.5, rot: Math.PI / 2, speed: 9, radius: 1.1, reach: 0.9, action: 'drive', label: 'Drive the car 🚗',
    seats: [{ x: -0.36, y: 0.42, z: -0.1, ry: 0, pose: 'sit' }, { x: 0.36, y: 0.42, z: -0.1, ry: 0, pose: 'sit' }],
    exit: [-1.6, 0, 0],
  },
  bike: {
    x: -2.8, z: 21.8, rot: Math.PI / 2, speed: 6, radius: 0.7, reach: 1.0, action: 'cycle', label: 'Ride the bike for two 🚲',
    seats: [{ x: 0, y: 0.82, z: 0.42, ry: 0, pose: 'pedal' }, { x: 0, y: 0.82, z: -0.42, ry: 0, pose: 'pedal' }],
    exit: [-1.1, 0, 0],
  },
};

/** Furniture inside our home, in room space (the room is centred on HOME_ORIGIN). */
export const HOME_SPOTS: Record<string, SpotDef & { x: number; z: number; rot: number }> = {
  sofa: { x: -2.6, z: -3.1, rot: 0, radius: 0.75, reach: 0.9, action: 'sit', label: 'Cuddle on the sofa', seats: pair(0, 0.48, 0.05, 0, 'sit', 0.38), exit: [0, 0, 1.2] },
  bed: { x: 2.9, z: -2.4, rot: 0, radius: 1.15, reach: 0.7, action: 'lie', label: 'Lie down together', seats: pair(0, 0.62, 0.2, 0, 'lie', 0.42), exit: [0, 0, 1.9] },
  fire: { x: -3.6, z: 0.8, rot: Math.PI / 2, radius: 0, reach: 1.2, action: 'sit', label: 'Sit by the fire', seats: pair(0, 0.1, 0.1, Math.PI, 'sitLow', 0.45), exit: [0, 0, -0.9] },
  table: { x: 2.8, z: 1.8, rot: 0, radius: 0.6, reach: 1.0, action: 'sit', label: 'Dinner for two', seats: [{ x: -0.85, y: 0.47, z: 0, ry: Math.PI / 2, pose: 'sit' }, { x: 0.85, y: 0.47, z: 0, ry: -Math.PI / 2, pose: 'sit' }], exit: [0, 0, 1.2] },
  door: { x: 0, z: 3.6, rot: 0, radius: 0, reach: 1.2, action: 'exit', label: 'Go outside' },
  shelf: { x: -4.2, z: -2.2, rot: Math.PI / 2, radius: 0.5, reach: 0 },
  kitchen: { x: 4.2, z: 0.2, rot: -Math.PI / 2, radius: 0.55, reach: 0 },
};

/** Up in the tree house: sit on the edge with your legs dangling. */
export const TREEHOUSE_SPOTS: Record<string, SpotDef & { x: number; z: number; rot: number }> = {
  edge: { x: 0, z: 1.55, rot: 0, radius: 0, reach: 0.8, action: 'sit', label: 'Sit on the edge', seats: pair(0, 0.1, 0.12, 0, 'sit'), exit: [0, 0, -0.5] },
  hut: { x: 0, z: -0.85, rot: 0, radius: 0.85, reach: 0 },
};

export interface Interactable extends SpotDef {
  /** Vehicles move, so their spot comes from `live.vehicles` */
  vehicle?: boolean;
  key: string;
  /** World spot id ('bench'), home furniture ('home:sofa') or tree-house spot ('top:edge') */
  place: Placement;
}

/** Turn a point in an item's own space into world space. */
export function toWorld(p: Placement, lx: number, ly: number, lz: number): [number, number, number] {
  const c = Math.cos(p.rot);
  const s = Math.sin(p.rot);
  const x = lx * p.size;
  const z = lz * p.size;
  return [p.x + x * c + z * s, p.y + ly * p.size, p.z - x * s + z * c];
}

/** Where every build stands (stored spot, else its default). */
export function placeBuilds(builds: { item: string; x?: number | null; z?: number | null; rot?: number; size?: number }[]): Placement[] {
  const out: Placement[] = [{ id: 'tree', x: WORLD_SPOTS.tree.x, y: 0, z: WORLD_SPOTS.tree.z, rot: 0, size: 1 }];
  for (const b of builds) {
    const d = WORLD_SPOTS[b.item];
    if (!d) continue;
    out.push({ id: b.item, x: b.x ?? d.x, y: 0, z: b.z ?? d.z, rot: b.x == null ? d.rot : b.rot ?? 0, size: b.size ?? 1 });
  }
  return out;
}

/** Everything you can bump into or use in an area. */
export function interactables(area: Area, placements: Placement[]): Interactable[] {
  if (area === 'home') {
    return Object.entries(HOME_SPOTS).map(([id, d]) => ({
      ...d,
      key: `home:${id}`,
      place: { id, x: HOME_ORIGIN[0] + d.x, y: HOME_ORIGIN[1], z: HOME_ORIGIN[2] + d.z, rot: d.rot, size: 1 },
    }));
  }
  if (area === 'treehouse') {
    const th = placements.find((p) => p.id === 'treehouse');
    if (!th) return [];
    return Object.entries(TREEHOUSE_SPOTS).map(([id, d]) => {
      const [x, y, z] = toWorld(th, d.x, TREEHOUSE_HEIGHT, d.z);
      return { ...d, key: `top:${id}`, place: { id, x, y, z, rot: th.rot + d.rot, size: th.size } };
    });
  }
  if (area === 'dressing') return [];
  return [
    ...placements.map((p) => ({ ...WORLD_SPOTS[p.id], key: p.id, place: p })),
    ...Object.entries(FIXED_SPOTS).map(([id, d]) => ({ ...d, key: id, place: { id, x: d.x, y: 0, z: d.z, rot: d.rot, size: 1 } })),
  ];
}

/** Vehicles where they are right now. */
export function vehicleInteractables(at: Record<string, { x: number; z: number; ry: number }>): Interactable[] {
  return Object.entries(VEHICLES).map(([id, d]) => {
    const v = at[id] ?? { x: d.x, z: d.z, ry: d.rot };
    return { ...d, key: id, vehicle: true, place: { id, x: v.x, y: 0, z: v.z, rot: v.ry, size: 1 } };
  });
}

/** How far you are from being able to use `it` (≤ 0 means close enough). */
export function reachGap(it: Interactable, x: number, z: number): number {
  const p = it.place;
  let dx = x - p.x;
  let dz = z - p.z;
  if (it.span) {
    // distance to the segment along the item's own x axis
    const c = Math.cos(p.rot);
    const s = Math.sin(p.rot);
    const along = Math.max(-it.span * p.size, Math.min(it.span * p.size, dx * c - dz * s));
    dx -= along * c;
    dz += along * s;
  }
  return Math.hypot(dx, dz) - it.radius * p.size - it.reach;
}

/* ── Moving things (shared clock so both phones agree) ── */

export const now = () => Date.now() / 1000;

export function swingAngle(t: number): number {
  return 0.42 * Math.sin(t * 1.9);
}
export const SWING_PIVOT = 2.45;
export const SWING_ROPE = 1.95;

/** The pond's boat drifts in a slow circle. */
export function boatAt(t: number): { x: number; z: number; heading: number } {
  const w = t * 0.22;
  return { x: Math.cos(w) * 1.65, z: Math.sin(w) * 1.65, heading: Math.atan2(-Math.sin(w), Math.cos(w)) };
}
const BOAT_SEATS: Seat[] = [
  { x: 0, y: 0.2, z: -0.42, ry: 0, pose: 'sitLow' },
  { x: 0, y: 0.2, z: 0.42, ry: Math.PI, pose: 'sitLow' },
];

/** Balloon ride: up for 10s, float, then down; `landAt` starts the way down early. */
export function balloonAltitude(t: number, start: number, landAt: number | null): number {
  const up = Math.min(1, Math.max(0, (t - start) / 10));
  const autoLand = start + 45;
  const land = landAt ?? autoLand;
  const down = 1 - Math.min(1, Math.max(0, (t - land) / 9));
  const k = Math.min(up, down);
  return BALLOON_TOP * (k * k * (3 - 2 * k)) + (k > 0.99 ? Math.sin(t * 0.8) * 0.4 : 0);
}

export interface WorldPose {
  x: number;
  y: number;
  z: number;
  ry: number;
  /** Lean forward/back (swinging) */
  tilt: number;
  pose: AvatarPose;
}

/** Where someone sitting in seat `idx` of `it` is right now. */
export function seatPose(it: Interactable, idx: number, t: number, balloonAlt = 0): WorldPose {
  const p = it.place;
  if (it.action === 'swing') {
    // the seat hangs below the pivot and swings with it (same maths as the model's rotation.x)
    const a = swingAngle(t);
    const s = it.seats![idx];
    const r = SWING_ROPE - 0.08;
    const [x, y, z] = toWorld(p, s.x, SWING_PIVOT - r * Math.cos(a) - s.z * Math.sin(a), -r * Math.sin(a) + s.z * Math.cos(a));
    return { x, y, z, ry: p.rot, tilt: a, pose: 'swing' };
  }
  if (it.action === 'train') {
    const c = trainAt(t, 1);
    const s = TRAIN_SEATS[idx];
    const cs = Math.cos(c.heading);
    const sn = Math.sin(c.heading);
    return { x: c.x + s.x * cs + s.z * sn, y: s.y, z: c.z - s.x * sn + s.z * cs, ry: c.heading, tilt: 0, pose: 'sit' };
  }
  if (it.action === 'ferris') {
    const cab = ferrisCabin(t, 0);
    const s = FERRIS_SEATS[idx];
    const [x, y, z] = toWorld(p, cab.x + s.x, cab.y + s.y, s.z);
    return { x, y, z, ry: p.rot + s.ry, tilt: 0, pose: 'sit' };
  }
  if (it.action === 'boat') {
    const b = boatAt(t);
    const s = BOAT_SEATS[idx];
    const c = Math.cos(b.heading);
    const sn = Math.sin(b.heading);
    const [x, y, z] = toWorld(p, b.x + s.x * c + s.z * sn, s.y, b.z - s.x * sn + s.z * c);
    return { x, y, z, ry: p.rot + b.heading + s.ry, tilt: 0, pose: s.pose };
  }
  const s = it.seats![idx];
  const [x, y, z] = toWorld(p, s.x, s.y, s.z);
  // Hips sit on the seat; the size changes the seat height, not us
  return { x, y: it.action === 'ride' ? p.y + balloonAlt + s.y * p.size : y, z, ry: p.rot + s.ry, tilt: 0, pose: s.pose };
}

export function seatCount(it: Interactable): number {
  return it.action === 'boat' || it.action === 'train' || it.action === 'ferris' ? 2 : it.seats?.length ?? 0;
}

export const SEAT_ACTIONS: ActionKind[] = ['sit', 'swing', 'boat', 'ride', 'lie', 'stand', 'wish', 'stargaze', 'drive', 'cycle', 'train', 'ferris'];

/* ── The train goes round the ring road ── */
export const TRAIN_CARS = 3;
const TRAIN_SPEED = 0.07; // radians a second: about 90 s round the island
const TRAIN_GAP = 0.13; // radians between cars
const TRAIN_SEATS: Seat[] = [
  { x: -0.32, y: 0.62, z: 0, ry: 0, pose: 'sit' },
  { x: 0.32, y: 0.62, z: 0, ry: 0, pose: 'sit' },
];
/** Car `i` (0 = engine) of the train: position on the road and which way it faces. */
export function trainAt(t: number, i: number): { x: number; z: number; heading: number } {
  const a = t * TRAIN_SPEED - i * TRAIN_GAP;
  // moving along d/da = (-sin a, -cos a); a heading `ry` faces (sin ry, cos ry)
  return { x: Math.cos(a) * ROAD_RADIUS, z: -Math.sin(a) * ROAD_RADIUS, heading: Math.atan2(-Math.sin(a), -Math.cos(a)) };
}

/* ── The Ferris wheel turns slowly; you ride in cabin 0 ── */
export const FERRIS_HUB = 8.2;
export const FERRIS_RADIUS = 5.6;
export const FERRIS_CABINS = 8;
const FERRIS_SEATS: Seat[] = [
  { x: -0.3, y: -0.08, z: -0.18, ry: 0, pose: 'sit' },
  { x: 0.3, y: -0.08, z: -0.18, ry: 0, pose: 'sit' },
];
/** Where cabin `i` hangs right now (wheel space: x across, y up). */
export function ferrisCabin(t: number, i: number): { x: number; y: number } {
  const a = t * 0.1 + (i / FERRIS_CABINS) * Math.PI * 2 - Math.PI / 2;
  return { x: Math.cos(a) * FERRIS_RADIUS, y: FERRIS_HUB + Math.sin(a) * FERRIS_RADIUS - 1.65 };
}

/** Where to step off a moving ride (beside the road for the train). */
export function rideExit(it: Interactable, t: number): [number, number] | null {
  if (it.action === 'train') {
    const c = trainAt(t, 1);
    const k = (ROAD_RADIUS - 2.4) / ROAD_RADIUS;
    return [c.x * k, c.z * k];
  }
  return null;
}

/* ── Love points for playing ── */
/** Which spots give points (once a day each) and what they're called in "Today in our world". */
export const ACTIVITIES: { key: string; label: string; emoji: string }[] = [
  { key: 'swing', label: 'Swing together', emoji: '🎠' },
  { key: 'picnic', label: 'Have a picnic', emoji: '🧺' },
  { key: 'bench', label: 'Sit on the bench', emoji: '🪑' },
  { key: 'tree', label: 'Rest under our tree', emoji: '🌳' },
  { key: 'pond', label: 'Row the boat', emoji: '🛶' },
  { key: 'hammock', label: 'Lie in the hammock', emoji: '🌴' },
  { key: 'gazebo', label: 'Sit in the gazebo', emoji: '✨' },
  { key: 'fountain', label: 'Make a wish', emoji: '⛲' },
  { key: 'telescope', label: 'Look at the stars', emoji: '🔭' },
  { key: 'treehouse', label: 'Climb the tree house', emoji: '🏠' },
  { key: 'balloon', label: 'Ride the balloon', emoji: '🎈' },
  { key: 'bridge', label: 'Stand on the bridge', emoji: '🌉' },
  { key: 'car', label: 'Go for a drive', emoji: '🚗' },
  { key: 'bike', label: 'Ride the bike for two', emoji: '🚲' },
  { key: 'train', label: 'Ride the train', emoji: '🚂' },
  { key: 'ferris', label: 'Ride the Ferris wheel', emoji: '🎡' },
  { key: 'cottage', label: 'Visit our home', emoji: '🏡' },
  { key: 'home-sofa', label: 'Cuddle on the sofa', emoji: '🛋️' },
  { key: 'home-table', label: 'Dinner for two', emoji: '🕯️' },
  { key: 'home-fire', label: 'Sit by the fire', emoji: '🔥' },
  { key: 'home-bed', label: 'Lie down together', emoji: '🛏️' },
  { key: 'pets', label: 'Pet the kitty & puppy', emoji: '🐱' },
  { key: 'bunnies', label: 'Pet the bunnies', emoji: '🐰' },
  { key: 'boutique', label: 'Try on outfits', emoji: '👗' },
  { key: 'hug', label: 'Hug in our world', emoji: '🤗' },
];
export const ACTIVITY_POINTS = 3;
export const TOGETHER_POINTS = 5;
/** Points key for an interactable ('home:sofa' → 'home-sofa'), or null if it gives none. */
export function activityKey(key: string): string | null {
  const k = key.replace(':', '-');
  return ACTIVITIES.some((a) => a.key === k) ? k : null;
}

/** Push a point out of everything solid and keep it inside the area. */
export function collide(area: Area, x: number, z: number, list: Interactable[], treehouse?: Placement, self = PLAYER_RADIUS, skip?: string): [number, number] {
  for (const it of list) {
    if (!it.radius || it.key === skip) continue;
    const r = it.radius * it.place.size + self;
    const dx = x - it.place.x;
    const dz = z - it.place.z;
    const d = Math.hypot(dx, dz);
    if (d < r && d > 1e-4) {
      x = it.place.x + (dx / d) * r;
      z = it.place.z + (dz / d) * r;
    }
  }
  if (area === 'out') {
    const d = Math.hypot(x, z);
    if (d > ISLAND_RADIUS) [x, z] = [(x / d) * ISLAND_RADIUS, (z / d) * ISLAND_RADIUS];
  } else if (area === 'home') {
    x = Math.max(HOME_ORIGIN[0] - HOME_HALF[0], Math.min(HOME_ORIGIN[0] + HOME_HALF[0], x));
    z = Math.max(HOME_ORIGIN[2] - HOME_HALF[1], Math.min(HOME_ORIGIN[2] + HOME_HALF[1], z));
  } else if (treehouse) {
    const max = 1.75 * treehouse.size;
    const dx = x - treehouse.x;
    const dz = z - treehouse.z;
    const d = Math.hypot(dx, dz);
    if (d > max) [x, z] = [treehouse.x + (dx / d) * max, treehouse.z + (dz / d) * max];
  }
  return [x, z];
}
