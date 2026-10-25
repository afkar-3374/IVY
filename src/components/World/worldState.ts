import { create } from 'zustand';
import type { Area, AvatarPose } from './worldData';
import { VEHICLES } from './worldData';

export interface SeatRef {
  key: string;
  idx: number;
}

export type EmoteKind = 'hearts' | 'wave' | 'hug';

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
  setMode: (mode: WorldUI['mode']) => void;
}

export const useWorldUI = create<WorldUI>((set) => ({
  mode: 'play',
  area: 'out',
  seat: null,
  nearby: null,
  canHug: false,
  selected: null,
  partner: null,
  questsOpen: false,
  setMode: (mode) => set({ mode, selected: null }),
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
  myEmote: null as null | { kind: EmoteKind; until: number },
  partnerEmote: null as null | { kind: EmoteKind; until: number },
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
