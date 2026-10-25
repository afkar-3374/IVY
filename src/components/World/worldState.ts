import { create } from 'zustand';
import type { Area, AvatarPose } from './worldData';
import { VEHICLES } from './worldData';

export interface SeatRef {
  key: string;
  idx: number;
  /** Which Ferris wheel cabin */
  cabin?: number;
}

export type EmoteKind = 'hearts' | 'wave' | 'hug' | 'dance' | 'kiss' | 'emoji';
export interface Emote {
  kind: EmoteKind;
  until: number;
  /** The emoji shown in a bubble for kind 'emoji' */
  emoji?: string;
}

export interface RaceState {
  phase: 'countdown' | 'go' | 'done';
  /** When the race starts (after the countdown), seconds */
  start: number;
  /** Next gate to pass (RACE_GATES = through the finish) */
  gate: number;
  /** Your time once finished */
  time: number | null;
  boat: string;
}

export interface VehiclePos {
  x: number;
  z: number;
  ry: number;
}

/** What each phone sends about its own avatar. */
export interface RemotePose {
  x: number;
  y: number;
  z: number;
  ry: number;
  tilt: number;
  pose: AvatarPose;
  moving: boolean;
  area: Area;
  seat: SeatRef | null;
  /** Balloon ride start (seconds) so the basket follows the rider */
  ride: number | null;
  /** The vehicle they are driving and where it is */
  drive?: { id: string } & VehiclePos;
  /** Their boat race, if they're in one */
  race?: { start: number; gate: number; time: number | null };
}

interface WorldUI {
  mode: 'play' | 'edit';
  area: Area;
  seat: SeatRef | null;
  /** Interactable key you are close enough to use */
  nearby: string | null;
  /** Partner is close enough (and free) to hug */
  canHug: boolean;
  /** Build picked in edit mode */
  selected: string | null;
  partner: RemotePose | null;
  /** "Today in our world" panel open */
  questsOpen: boolean;
  /** Waiting on the Ferris wheel platform for the next cabin */
  ferrisWaiting: boolean;
  /** Asked to get off the Ferris wheel; happens at the bottom */
  ferrisLeaving: boolean;
  race: RaceState | null;
  /** Battery saver: 30 fps, no shadows, lower resolution */
  saver: boolean;
  setMode: (mode: WorldUI['mode']) => void;
  setSaver: (on: boolean) => void;
}

const SAVER_KEY = 'ivy_world_saver';
const savedSaver = () => {
  try {
    return localStorage.getItem(SAVER_KEY) === '1';
  } catch {
    return false;
  }
};

export const useWorldUI = create<WorldUI>((set) => ({
  mode: 'play',
  area: 'out',
  seat: null,
  nearby: null,
  canHug: false,
  selected: null,
  partner: null,
  questsOpen: false,
  ferrisWaiting: false,
  ferrisLeaving: false,
  race: null,
  saver: savedSaver(),
  setMode: (mode) => set({ mode, selected: null }),
  setSaver: (saver) => {
    try {
      localStorage.setItem(SAVER_KEY, saver ? '1' : '0');
    } catch {
      /* storage unavailable */
    }
    set({ saver });
  },
}));

const parked = (): Record<string, VehiclePos> =>
  Object.fromEntries(Object.entries(VEHICLES).map(([id, v]) => [id, { x: v.x, z: v.z, ry: v.rot }]));

/**
 * Per-frame values the 3D loop reads and writes without re-rendering React.
 * Angles in radians; the camera orbits the player at `yaw`/`pitch`.
 */
export const live = {
  joy: { x: 0, y: 0 },
  keys: new Set<string>(),
  yaw: 0.6,
  pitch: 0.42,
  zoom: 1,
  me: { x: 0, y: 0, z: 6, ry: Math.PI, tilt: 0, pose: 'stand' as AvatarPose, moving: false },
  /** Tap-to-walk destination, and what to use on arrival */
  target: null as null | { x: number; z: number; use?: string },
  ride: null as null | { start: number; landAt: number | null },
  myEmote: null as null | Emote,
  partnerEmote: null as null | Emote,
  /** Your walking velocity (smoothed, so starting and stopping feel soft) */
  vel: { x: 0, z: 0 },
  /** Ferris wheel: the cabin you're waiting for and when it arrives, and when you boarded */
  ferrisWait: null as null | { cabin: number; at: number },
  ferrisBoarded: 0,
  partnerSeenAt: 0,
  /** Latest pose from the partner's phone, and where we are drawing them (smoothed) */
  partner: null as RemotePose | null,
  partnerShown: { x: 0, y: 0, z: 0, ry: 0, tilt: 0, pose: 'stand' as AvatarPose, moving: false },
  /** Height of the balloon basket above the ground */
  balloonAlt: 0,
  /** Where the car and bike are (whoever drives moves them; both phones follow) */
  vehicles: parked(),
  /** Current speed of the vehicle you drive (for the wheels and the camera) */
  vehicleSpeed: 0,
  /** Dressing room: how far you've spun your avatar round */
  dressSpin: 0,
  /** Set by the sync hook */
  send: (_event: 'pose' | 'emote' | 'leave', _payload: unknown) => {},
  /** Bumped when you teleport (enter/exit/climb) so the camera snaps instead of gliding */
  teleported: 0,
};

export function resetVehicles() {
  live.vehicles = parked();
  live.vehicleSpeed = 0;
}
