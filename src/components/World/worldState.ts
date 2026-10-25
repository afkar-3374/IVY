import { create } from 'zustand';
import type { Area, AvatarPose } from './worldData';

export interface SeatRef {
  key: string;
  idx: number;
}

export type EmoteKind = 'hearts' | 'wave' | 'hug';

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
  look: Look;
  /** Balloon ride start (seconds) so the basket follows the rider */
  ride: number | null;
}

/** How your avatar looks (kept on this phone, sent to your partner live) */
export interface Look {
  outfit: string;
  hair: string;
  short: boolean;
}

export const OUTFITS = ['#F472B6', '#60A5FA', '#A78BFA', '#34D399', '#FBBF24', '#F87171', '#FFFFFF', '#374151'];
export const HAIRS = ['#2B1B17', '#5B3A29', '#A0522D', '#E6BE8A', '#B91C1C', '#6D28D9'];

const LOOK_KEY = 'ivy_world_look';
function savedLook(fallback: Look): Look {
  try {
    const raw = localStorage.getItem(LOOK_KEY);
    return raw ? { ...fallback, ...(JSON.parse(raw) as Partial<Look>) } : fallback;
  } catch {
    return fallback;
  }
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
  look: Look;
  setMode: (mode: WorldUI['mode']) => void;
  setLook: (look: Partial<Look>) => void;
}

export const useWorldUI = create<WorldUI>((set) => ({
  mode: 'play',
  area: 'out',
  seat: null,
  nearby: null,
  canHug: false,
  selected: null,
  partner: null,
  look: { outfit: '#F472B6', hair: '#2B1B17', short: false },
  setMode: (mode) => set({ mode, selected: null }),
  setLook: (patch) =>
    set((s) => {
      const look = { ...s.look, ...patch };
      try {
        localStorage.setItem(LOOK_KEY, JSON.stringify(look));
      } catch {
        /* storage unavailable */
      }
      return { look };
    }),
}));

export function loadLook(fallback: Look) {
  useWorldUI.setState({ look: savedLook(fallback) });
}

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
  /** Set by the sync hook */
  send: (_event: 'pose' | 'emote' | 'leave', _payload: unknown) => {},
  /** Bumped when you teleport (enter/exit/climb) so the camera snaps instead of gliding */
  teleported: 0,
};
