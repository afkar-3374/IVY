import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Avatar } from './models/Avatar';
import { BUILD_MODELS } from './models/Builds';
import { DressingRoom, HomeInterior } from './models/Interiors';
import { BorderTrees, Clouds, Flowers, Island, LoveTree, Rocks, SkyAndLight } from './models/Nature';
import { Bike, Boutique, Car, Dock, Ferris, Horse, Lighthouse, Paddock, Parking, RaceGates, Railway, Road, SpeedBoat, Station, Train } from './models/Rides';
import {
  DRESS_ORIGIN,
  FERRIS_SPEED,
  FIXED_SPOTS,
  SWING_PIVOT,
  VEHICLES,
  activityKey,
  balloonAltitude,
  collide,
  collideWater,
  ferrisAtPlatform,
  interactables,
  now,
  reachGap,
  seatPose,
  toWorld,
  vehicleInteractables,
  type Area,
  type Interactable,
  type Placement,
} from './worldData';
import { live, useWorldUI } from './worldState';
import { activate, getInCabin, groundY, standUp, type ActionHelpers } from './worldActions';
import { GATES, GATE_HALF_WIDTH, RACE_GATES, angleOf, coastR, polar } from './terrain';
import type { Look } from './wardrobe';
import type { Phase, Season, Weather } from '../Garden/GardenScene';

export interface WorldSceneProps {
  placements: Placement[];
  total: number;
  level: number;
  phase: Phase;
  season: Season;
  weather: Weather;
  myName: string;
  partnerName: string;
  myLook: Look;
  partnerLook: Look;
  helpers: ActionHelpers;
  /** Edit mode: a build was dragged to a new spot (save = finger lifted) */
  onMove: (id: string, x: number, z: number, save: boolean) => void;
}

const SPEED = 3.6;

/** Everything usable in an area right now (vehicles move, so they're rebuilt each time). */
function usable(area: Area, list: Interactable[]): Interactable[] {
  return area === 'out' ? [...list, ...vehicleInteractables(live.vehicles)] : list;
}

/** Moves you, the camera and your partner's avatar every frame; tells your partner where you are. */
const Controller: React.FC<{ placements: Placement[]; helpers: ActionHelpers; center: React.RefObject<THREE.Vector3> }> = ({ placements, helpers, center }) => {
  const { camera, gl } = useThree();
  const area = useWorldUI((s) => s.area);
  const mode = useWorldUI((s) => s.mode);
  const list = useMemo(() => interactables(area, placements), [area, placements]);
  const outList = useMemo(() => interactables('out', placements), [placements]);
  const lastSent = useRef({ at: 0, x: 0, z: 0, ry: 0, pose: '' });
  const lastNear = useRef(0);
  const seenTeleport = useRef(-1);
  const camPos = useRef(new THREE.Vector3());
  const look = useRef(new THREE.Vector3());

  // Drag to look around (or spin yourself in the dressing room), pinch or scroll to zoom
  useEffect(() => {
    const el = gl.domElement;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      const ui = useWorldUI.getState();
      if (!p || ui.mode === 'edit') return;
      if (pts.size === 1) {
        if (ui.area === 'dressing') live.dressSpin += (e.clientX - p.x) * 0.012;
        else {
          live.yaw -= (e.clientX - p.x) * 0.008;
          live.pitch = Math.max(0.08, Math.min(1.25, live.pitch + (e.clientY - p.y) * 0.005));
        }
      } else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch) live.zoom = Math.max(0.45, Math.min(1.9, live.zoom * (pinch / d)));
        pinch = d;
      }
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const up = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      pinch = 0;
    };
    const wheel = (e: WheelEvent) => {
      if (useWorldUI.getState().mode === 'edit') return;
      live.zoom = Math.max(0.45, Math.min(1.9, live.zoom * (1 + e.deltaY * 0.001)));
    };
    el.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: true });
    return () => {
      el.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [gl]);

  // Keyboard on computers
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      live.keys.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => live.keys.delete(e.key.toLowerCase());
    const blur = () => live.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const ui = useWorldUI.getState();
    const t = now();
    const me = live.me;
    const k = live.keys;
    const all = usable(ui.area, list);

    // Your input: joystick + WASD/arrows (x = right, y = forward)
    let ix = live.joy.x + (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    let iy = live.joy.y + (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const inputMag = Math.hypot(ix, iy);
    // camera-relative input → world direction
    const toWorldDir = (x: number, y: number): [number, number] => [
      Math.cos(live.yaw) * x - Math.sin(live.yaw) * y,
      -Math.sin(live.yaw) * x - Math.cos(live.yaw) * y,
    ];

    // Balloon: whoever is riding sets the basket height
    const balloon = outList.find((i) => i.key === 'balloon');
    if (ui.seat?.key === 'balloon' && live.ride) {
      live.balloonAlt = balloonAltitude(t, live.ride.start, live.ride.landAt);
      if (live.ride.landAt === null && t > live.ride.start + 45) live.ride.landAt = live.ride.start + 45;
      if (live.ride.landAt !== null && t > live.ride.landAt + 9.5) {
        live.ride = null; // landed: step out
        standUp(all, placements);
      }
    } else if (live.partner?.seat?.key === 'balloon' && balloon) {
      live.balloonAlt = Math.max(0, live.partner.y - balloon.place.y - 0.15 * balloon.place.size);
    } else {
      live.balloonAlt = Math.max(0, live.balloonAlt - dt * 3);
    }

    let seatIt: Interactable | undefined;
    if (ui.mode === 'play') {
      if (ui.area === 'dressing') {
        // on your podium, turning as you drag
        me.moving = false;
        me.pose = live.myEmote && live.myEmote.until > t && live.myEmote.kind === 'wave' ? 'stand' : 'stand';
        me.ry = live.dressSpin;
        me.y = groundY('dressing', placements);
      } else if (ui.seat) {
        seatIt = all.find((i) => i.key === ui.seat!.key);
        if (!seatIt) {
          useWorldUI.setState({ seat: null });
        } else {
          const vehicle = seatIt.vehicle ? VEHICLES[seatIt.key] : undefined;
          if (vehicle && ui.seat.idx === 0) {
            // You're driving: steer toward the stick, speed up and slow down smoothly
            const v = live.vehicles[seatIt.key];
            const race = ui.race;
            const held = race && race.boat === seatIt.key && t < race.start; // 3-2-1…
            const [dx, dz] = toWorldDir(ix, iy);
            const mag = held ? 0 : Math.min(1, inputMag);
            const want = vehicle.speed * mag;
            live.vehicleSpeed += (want - live.vehicleSpeed) * Math.min(1, dt * (want > live.vehicleSpeed ? 1.4 : vehicle.water ? 1.2 : 3));
            if (mag > 0.1) {
              let d = Math.atan2(dx, dz) - v.ry;
              d = Math.atan2(Math.sin(d), Math.cos(d));
              const turn = vehicle.turn * dt * Math.min(1, 0.3 + live.vehicleSpeed / 3);
              v.ry += Math.max(-turn, Math.min(turn, d));
            }
            const step = live.vehicleSpeed * dt;
            const nx = v.x + Math.sin(v.ry) * step;
            const nz = v.z + Math.cos(v.ry) * step;
            if (vehicle.water) {
              const others = Object.entries(live.vehicles)
                .filter(([id]) => id !== seatIt!.key && VEHICLES[id]?.water)
                .map(([, o]) => ({ x: o.x, z: o.z, r: 1.2 }));
              [v.x, v.z] = collideWater(nx, nz, seatIt.radius, others);
            } else {
              [v.x, v.z] = collide('out', nx, nz, all, undefined, seatIt.radius, seatIt.key);
            }
            // Boat race: through the gates in order, back through the first to finish
            if (race && race.boat === seatIt.key) {
              if (race.phase === 'countdown' && t >= race.start) useWorldUI.setState({ race: { ...race, phase: 'go' } });
              if (race.phase !== 'done' && t >= race.start) {
                const g = GATES[race.gate % RACE_GATES];
                if (Math.hypot(v.x - g.x, v.z - g.z) < GATE_HALF_WIDTH + 1.2) {
                  const gate = race.gate + 1;
                  navigator.vibrate?.(30);
                  if (gate > RACE_GATES) {
                    useWorldUI.setState({ race: { ...race, gate, phase: 'done', time: t - race.start } });
                    helpers.reward('race');
                  } else {
                    useWorldUI.setState({ race: { ...race, gate } });
                  }
                }
              }
            }
            // the camera settles in behind you
            if (live.vehicleSpeed > 0.5) {
              let dy = v.ry + Math.PI - live.yaw;
              dy = Math.atan2(Math.sin(dy), Math.cos(dy));
              live.yaw += dy * Math.min(1, dt * 1.5);
            }
            seatIt = usable('out', list).find((i) => i.key === ui.seat!.key);
          } else if (!seatIt.vehicle && inputMag > 0.5 && !['ride', 'train', 'ferris'].includes(seatIt.action ?? '')) {
            standUp(all, placements);
          }
          if (seatIt?.action === 'ferris') {
            const cabin = ui.seat.cabin ?? 0;
            const fullTurn = t - live.ferrisBoarded > (Math.PI * 2) / FERRIS_SPEED - 2;
            if ((ui.ferrisLeaving || fullTurn) && ferrisAtPlatform(t, cabin) && t - live.ferrisBoarded > 3) standUp(all, placements);
          }
          if (seatIt && useWorldUI.getState().seat) {
            const p = seatPose(seatIt, ui.seat.idx, t, live.balloonAlt, ui.seat.cabin ?? 0);
            Object.assign(me, p, { moving: false });
          }
        }
      } else {
        // Tap-to-walk when you aren't steering yourself
        if (inputMag > 0.1) live.target = null;
        else if (live.target) {
          const target = live.target;
          const use = target.use ? all.find((i) => i.key === target.use) : undefined;
          const dx = (use ? use.place.x : target.x) - me.x;
          const dz = (use ? use.place.z : target.z) - me.z;
          const d = Math.hypot(dx, dz);
          if ((use && reachGap(use, me.x, me.z) <= 0) || d < 0.25) {
            live.target = null;
            if (use) activate(use, helpers);
          } else {
            // steer in camera space so the same code below moves you
            const fx = -Math.sin(live.yaw);
            const fz = -Math.cos(live.yaw);
            ix = (dx * Math.cos(live.yaw) - dz * Math.sin(live.yaw)) / d;
            iy = (dx * fx + dz * fz) / d;
            if (d < 1) [ix, iy] = [ix * Math.max(0.4, d), iy * Math.max(0.4, d)];
          }
        }

        // Smooth walking: ease into the stick's direction and speed (jogging when pushed all the way)
        const raw = Math.min(1, Math.hypot(ix, iy));
        const mag = raw < 0.08 ? 0 : raw;
        const [dx, dz] = mag ? toWorldDir(ix, iy) : [0, 0];
        const len = Math.hypot(dx, dz) || 1;
        const speed = mag > 0.92 ? SPEED * 1.35 : SPEED * Math.pow(mag, 1.3);
        const v = live.vel;
        const ease = 1 - Math.exp(-dt * (mag ? 9 : 12));
        v.x += ((dx / len) * speed - v.x) * ease;
        v.z += ((dz / len) * speed - v.z) * ease;
        const sp = Math.hypot(v.x, v.z);
        if (sp > 0.15) {
          const th = placements.find((p) => p.id === 'treehouse');
          [me.x, me.z] = collide(ui.area, me.x + v.x * dt, me.z + v.z * dt, all, th);
          me.ry = Math.atan2(v.x, v.z);
          me.moving = true;
          // a walk cancels emotes
          if (live.myEmote && live.myEmote.kind !== 'hearts' && live.myEmote.kind !== 'emoji') live.myEmote = null;
        } else {
          v.x = v.z = 0;
          me.moving = false;
        }
        me.y = groundY(ui.area, placements);
        me.tilt = 0;
        const em = live.myEmote && live.myEmote.until > t ? live.myEmote.kind : null;
        me.pose = em === 'hug' ? 'hug' : em === 'kiss' ? 'kiss' : em === 'dance' ? 'dance' : 'stand';
        // Ferris wheel: your cabin has come down to the platform
        if (live.ferrisWait && t >= live.ferrisWait.at) getInCabin(live.ferrisWait.cabin, helpers);
      }

      // What can you use right now? (and points for doing it together)
      if (t - lastNear.current > 0.2) {
        lastNear.current = t;
        let near: string | null = null;
        if (!ui.seat && ui.area !== 'dressing') {
          let best = 0;
          for (const it of all) {
            if (!it.action) continue;
            const g = reachGap(it, me.x, me.z);
            if (g <= best) [best, near] = [g, it.key];
          }
        }
        const p = live.partner;
        const canHug = Boolean(p && !ui.seat && !p.seat && p.area === ui.area && ui.area !== 'dressing' && Math.hypot(p.x - me.x, p.z - me.z) < 2.6);
        if (near !== ui.nearby || canHug !== ui.canHug) useWorldUI.setState({ nearby: near, canHug });
        if (ui.seat && p?.seat?.key === ui.seat.key) {
          const key = activityKey(ui.seat.key);
          if (key) helpers.reward(key, true);
        }
      }

      // Camera
      const indoor = ui.area === 'home';
      if (ui.area === 'dressing') {
        // aim low so the two of you stand in the top half, above the closet panel
        camPos.current.set(DRESS_ORIGIN[0], DRESS_ORIGIN[1] + 1.25, DRESS_ORIGIN[2] + 6 * Math.min(1.2, live.zoom));
        camera.position.lerp(camPos.current, seenTeleport.current !== live.teleported ? 1 : 1 - Math.exp(-dt * 6));
        seenTeleport.current = live.teleported;
        camera.lookAt(DRESS_ORIGIN[0], DRESS_ORIGIN[1] - 0.05, DRESS_ORIGIN[2]);
      } else if (seatIt?.action === 'stargaze') {
        const fx = Math.sin(me.ry);
        const fz = Math.cos(me.ry);
        camPos.current.set(me.x - fx * 1.4, me.y + 1.9, me.z - fz * 1.4);
        camera.position.lerp(camPos.current, 1 - Math.exp(-dt * 4));
        camera.lookAt(me.x + fx * 8, me.y + 9, me.z + fz * 8);
      } else {
        // look at a steady point: your head, or the swing's crossbar area while swinging (no seasickness)
        const head =
          seatIt?.action === 'swing'
            ? look.current.set(...toWorld(seatIt.place, 0, SWING_PIVOT * 0.45, 0))
            : look.current.set(me.x, me.y + (ui.seat ? 0.75 : 1.3), me.z);
        const action = seatIt?.action;
        const dist =
          (action === 'ride' ? 13 : action === 'ferris' ? 14 : action === 'train' ? 10 : action === 'sail' ? 11 : action === 'drive' || action === 'cycle' || action === 'gallop' ? 9 : indoor ? 6.5 : 7.5) *
          live.zoom;
        const pitch = indoor ? Math.max(0.75, live.pitch) : action === 'ride' || action === 'ferris' ? Math.max(0.25, live.pitch) : live.pitch;
        camPos.current.set(
          head.x + Math.sin(live.yaw) * Math.cos(pitch) * dist,
          head.y + Math.sin(pitch) * dist,
          head.z + Math.cos(live.yaw) * Math.cos(pitch) * dist
        );
        if (ui.area === 'out') camPos.current.y = Math.max(0.6, camPos.current.y);
        if (seenTeleport.current !== live.teleported) {
          seenTeleport.current = live.teleported;
          camera.position.copy(camPos.current);
        } else {
          camera.position.lerp(camPos.current, 1 - Math.exp(-dt * 7));
        }
        camera.lookAt(head);
      }
    }
    center.current!.set(me.x, me.y, me.z);

    // Partner: glide toward the latest pose from their phone
    const p = live.partner;
    if (p) {
      const s = live.partnerShown;
      const a = 1 - Math.exp(-dt * 10);
      // Seated partners are placed exactly (swing/boat/balloon/train move on the shared clock)
      const it = p.seat ? usable(p.area, interactables(p.area, placements)).find((i) => i.key === p.seat!.key) : undefined;
      if (it && p.seat) {
        Object.assign(s, seatPose(it, p.seat.idx, t, live.balloonAlt, p.seat.cabin ?? 0), { moving: false });
      } else {
        s.x += (p.x - s.x) * a;
        s.y += (p.y - s.y) * a;
        s.z += (p.z - s.z) * a;
        s.ry = p.ry;
        s.tilt = p.tilt;
        s.pose = p.pose;
        s.moving = p.moving;
      }
    }

    // Tell your partner where you are (10× a second while moving, once a second when still)
    const L = lastSent.current;
    const changed = Math.abs(me.x - L.x) + Math.abs(me.z - L.z) > 0.02 || Math.abs(me.ry - L.ry) > 0.05 || me.pose !== L.pose;
    if ((changed && t - L.at > 0.1) || t - L.at > 1) {
      Object.assign(L, { at: t, x: me.x, z: me.z, ry: me.ry, pose: me.pose });
      const driving = ui.seat && ui.seat.idx === 0 && VEHICLES[ui.seat.key] ? ui.seat.key : null;
      live.send('pose', {
        x: me.x, y: me.y, z: me.z, ry: me.ry, tilt: me.tilt, pose: me.pose, moving: me.moving,
        area: ui.area, seat: ui.seat, ride: live.ride?.start ?? null,
        drive: driving ? { id: driving, ...live.vehicles[driving] } : undefined,
        race: ui.race ? { start: ui.race.start, gate: ui.race.gate, time: ui.race.time } : undefined,
      });
    }
  });

  // Edit mode starts looking down at where you are
  const orbit = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  useEffect(() => {
    if (mode !== 'edit' || !orbit.current) return;
    orbit.current.target.set(live.me.x, 0, live.me.z);
    camera.position.set(live.me.x + 8, 16, live.me.z + 12);
    orbit.current.update();
  }, [mode, camera]);

  return mode === 'edit' ? (
    <OrbitControls
      ref={(c) => {
        orbit.current = c;
        editDrag.orbit = c;
      }}
      makeDefault
      maxPolarAngle={1.35}
      minDistance={5}
      maxDistance={60}
      enableDamping
    />
  ) : null;
};

/** A build being dragged in edit mode; the camera orbit pauses meanwhile */
const editDrag = { active: false, id: '', dx: 0, dz: 0, orbit: null as null | { enabled: boolean } };

/** One build in its spot; in edit mode it can be picked and dragged. */
const PlacedBuild: React.FC<{ p: Placement; night: boolean; busy: boolean; selected: boolean; editing: boolean; onPick: (id: string, e: ThreeEvent<PointerEvent>) => void; onUse: (id: string, e: ThreeEvent<MouseEvent>) => void }> = ({
  p,
  night,
  busy,
  selected,
  editing,
  onPick,
  onUse,
}) => {
  const Model = BUILD_MODELS[p.id];
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4) * 0.05);
  });
  if (!Model) return null;
  return (
    <group
      position={[p.x, p.y, p.z]}
      rotation={[0, p.rot, 0]}
      scale={p.size}
      onPointerDown={editing ? (e) => onPick(p.id, e) : undefined}
      onClick={editing ? undefined : (e) => onUse(p.id, e)}
    >
      <Model night={night} busy={busy} />
      {selected && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[1.6, 1.85, 40]} />
          <meshBasicMaterial color="#F43F5E" transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
};

/**
 * Keeps phones cool: draws at a capped frame rate (on demand) and only re-renders
 * shadows a few times a second.
 */
const FrameDriver: React.FC<{ fps: number; shadows: boolean }> = ({ fps, shadows }) => {
  const { invalidate, gl } = useThree();
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      if (ts - last >= 1000 / fps - 2) {
        last = ts;
        invalidate();
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);
  const since = useRef(0);
  useEffect(() => {
    gl.shadowMap.autoUpdate = false;
    gl.shadowMap.needsUpdate = true;
  }, [gl]);
  useFrame((_, dt) => {
    since.current += dt;
    if (shadows && since.current > 0.15) {
      since.current = 0;
      gl.shadowMap.needsUpdate = true;
    }
  });
  return null;
};

/** Something that's always in the world, at its fixed spot. */
const Fixed: React.FC<{ id: keyof typeof FIXED_SPOTS; onUse: (id: string, e: ThreeEvent<MouseEvent>) => void; children: React.ReactNode }> = ({ id, onUse, children }) => {
  const d = FIXED_SPOTS[id];
  return (
    <group position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]} onClick={(e) => onUse(id, e)}>
      {children}
    </group>
  );
};

/** Drawn at each phone's own speed; heavy bits are memoised so walking stays smooth. */
export const WorldScene: React.FC<WorldSceneProps> = ({ placements, total, level, phase, season, weather, myName, partnerName, myLook, partnerLook, helpers, onMove }) => {
  const center = useRef(new THREE.Vector3());
  const mode = useWorldUI((s) => s.mode);
  const area = useWorldUI((s) => s.area);
  const seat = useWorldUI((s) => s.seat);
  const selected = useWorldUI((s) => s.selected);
  const partnerPose = useWorldUI((s) => s.partner);
  const saver = useWorldUI((s) => s.saver);
  const race = useWorldUI((s) => s.race);
  const editing = mode === 'edit';
  // phones run cooler at a capped frame rate
  const coarse = typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches;
  const fps = saver ? 30 : coarse ? 45 : 60;
  const stargazing = seat?.key === 'telescope';
  const shownPhase: Phase = stargazing ? 'night' : phase;
  const night = shownPhase === 'night';
  const outList = useMemo(() => interactables('out', placements), [placements]);
  const tree = placements.find((p) => p.id === 'tree')!;
  const hasCottage = placements.some((p) => p.id === 'cottage');
  // Rooms (and their lights) only exist while one of you is inside, so the island stays fast
  const showHome = hasCottage && (area === 'home' || partnerPose?.area === 'home');
  const showDressing = area === 'dressing' || partnerPose?.area === 'dressing';

  const busy = (id: string) => seat?.key === id || partnerPose?.seat?.key === id;

  const pick = (id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const p = placements.find((x) => x.id === id);
    if (!p) return;
    useWorldUI.setState({ selected: id });
    Object.assign(editDrag, { active: true, id, dx: p.x - e.point.x, dz: p.z - e.point.z });
    if (editDrag.orbit) editDrag.orbit.enabled = false;
  };

  // Finger lifted: save where the build ended up
  useEffect(() => {
    const up = () => {
      if (!editDrag.active) return;
      editDrag.active = false;
      if (editDrag.orbit) editDrag.orbit.enabled = true;
      const p = placements.find((x) => x.id === editDrag.id);
      if (p) onMove(p.id, p.x, p.z, true);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [placements, onMove]);

  const dragOver = (e: ThreeEvent<PointerEvent>) => {
    if (!editing || !editDrag.active) return;
    let x = e.point.x + editDrag.dx;
    let z = e.point.z + editDrag.dz;
    const a = angleOf(x, z);
    const max = coastR(a) - 2.5;
    if (Math.hypot(x, z) > max) [x, z] = polar(max, a);
    onMove(editDrag.id, x, z, false);
  };

  const use = (id: string, e: ThreeEvent<MouseEvent>) => {
    if (editing || e.delta > 8) return; // that was a camera drag
    e.stopPropagation();
    const it = usable('out', outList).find((i) => i.key === id);
    if (it?.action && useWorldUI.getState().area === 'out') activate(it, helpers);
  };

  const walkTo = (e: ThreeEvent<MouseEvent>) => {
    if (editing || e.delta > 8 || useWorldUI.getState().seat || useWorldUI.getState().area !== 'out') return;
    live.target = { x: e.point.x, z: e.point.z };
  };

  return (
    <Canvas
      key={saver ? 'saver' : 'full'}
      shadows={!saver}
      frameloop="demand"
      dpr={saver ? 1 : [1, 1.5]}
      camera={{ fov: 55, near: 0.1, far: 700, position: [6, 6, 14] }}
      gl={{ antialias: !saver && (typeof window === 'undefined' || window.devicePixelRatio < 2), powerPreference: saver ? 'low-power' : 'high-performance' }}
      onPointerMissed={() => editing && !editDrag.active && useWorldUI.setState({ selected: null })}
    >
      <FrameDriver fps={fps} shadows={!saver} />
      <SkyAndLight phase={shownPhase} weather={weather} center={center} />
      <Clouds weather={weather} phase={shownPhase} center={center} />
      <Island season={season} onGround={walkTo} onGroundMove={dragOver} />
      {/* while dragging, a big invisible floor keeps tracking the finger even off the island */}
      {editing && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} onPointerMove={dragOver} visible={false}>
          <planeGeometry args={[200, 200]} />
          <meshBasicMaterial />
        </mesh>
      )}
      <Road />
      <Railway />
      <Rocks />
      <Dock />
      <RaceGates next={race && race.phase !== 'done' ? race.gate % RACE_GATES : null} />
      <BorderTrees season={season} placements={placements} />
      <Flowers total={total} season={season} placements={placements} />
      <group onClick={(e) => use('tree', e)}>
        <LoveTree level={level} season={season} place={tree} />
      </group>
      {placements
        .filter((p) => p.id !== 'tree')
        .map((p) => (
          <PlacedBuild key={p.id} p={p} night={night} busy={busy(p.id)} selected={editing && selected === p.id} editing={editing} onPick={pick} onUse={use} />
        ))}

      <Fixed id="boutique" onUse={use}>
        <Boutique night={night} />
      </Fixed>
      <Fixed id="station" onUse={use}>
        <Station />
      </Fixed>
      <Fixed id="ferris" onUse={use}>
        <Ferris night={night} />
      </Fixed>
      <Fixed id="parking" onUse={use}>
        <Parking />
      </Fixed>
      <Fixed id="paddock" onUse={use}>
        <Paddock />
      </Fixed>
      <Fixed id="lighthouse" onUse={use}>
        <Lighthouse night={night} />
      </Fixed>
      <Train night={night} />
      <Car night={night} onClick={(e) => use('car', e)} />
      <Bike onClick={(e) => use('bike', e)} />
      <Horse onClick={(e) => use('horse', e)} />
      <SpeedBoat id="boatA" color="#F472B6" onClick={(e) => use('boatA', e)} />
      <SpeedBoat id="boatB" color="#60A5FA" onClick={(e) => use('boatB', e)} />

      {showHome && <HomeInterior night={night} />}
      {showDressing && <DressingRoom />}

      <Avatar frame={() => live.me} emote={() => live.myEmote} look={myLook} name={myName} />
      {partnerPose && (
        <Avatar frame={() => live.partnerShown} emote={() => live.partnerEmote} look={partnerLook} name={partnerName} />
      )}
      <Controller placements={placements} helpers={helpers} center={center} />
    </Canvas>
  );
};
