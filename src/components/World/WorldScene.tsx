import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Avatar } from './models/Avatar';
import { BUILD_MODELS } from './models/Builds';
import { HomeInterior } from './models/Interiors';
import { BorderTrees, Clouds, Flowers, Island, LoveTree, SkyAndLight } from './models/Nature';
import {
  ISLAND_RADIUS,
  balloonAltitude,
  collide,
  interactables,
  now,
  reachGap,
  seatPose,
  type Interactable,
  type Placement,
} from './worldData';
import { live, useWorldUI } from './worldState';
import { activate, groundY, standUp, type ActionHelpers } from './worldActions';
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
  helpers: ActionHelpers;
  /** Edit mode: a build was dragged to a new spot (save = finger lifted) */
  onMove: (id: string, x: number, z: number, save: boolean) => void;
}

const SPEED = 3.6;

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

  // Drag to look around, pinch or scroll to zoom
  useEffect(() => {
    const el = gl.domElement;
    const pts = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    const down = (e: PointerEvent) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    };
    const move = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p || useWorldUI.getState().mode === 'edit') return;
      if (pts.size === 1) {
        live.yaw -= (e.clientX - p.x) * 0.008;
        live.pitch = Math.max(0.08, Math.min(1.25, live.pitch + (e.clientY - p.y) * 0.005));
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

    // Your input: joystick + WASD/arrows (x = right, y = forward)
    let ix = live.joy.x + (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    let iy = live.joy.y + (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    const inputMag = Math.hypot(ix, iy);

    // Balloon: whoever is riding sets the basket height
    const balloon = outList.find((i) => i.key === 'balloon');
    if (ui.seat?.key === 'balloon' && live.ride) {
      live.balloonAlt = balloonAltitude(t, live.ride.start, live.ride.landAt);
      if (live.ride.landAt === null && t > live.ride.start + 45) live.ride.landAt = live.ride.start + 45;
      if (live.ride.landAt !== null && t > live.ride.landAt + 9.5) {
        live.ride = null; // landed: step out

        standUp(outList, placements);
      }
    } else if (live.partner?.seat?.key === 'balloon' && balloon) {
      live.balloonAlt = Math.max(0, live.partner.y - balloon.place.y - 0.15 * balloon.place.size);
    } else {
      live.balloonAlt = Math.max(0, live.balloonAlt - dt * 3);
    }

    if (ui.mode === 'play') {
      if (ui.seat) {
        const it = list.find((i) => i.key === ui.seat!.key);
        if (!it) {
          useWorldUI.setState({ seat: null });
        } else {
          const p = seatPose(it, ui.seat.idx, t, live.balloonAlt);
          Object.assign(me, p, { moving: false });
          if (inputMag > 0.5 && it.action !== 'ride') standUp(list, placements);
        }
      } else {
        // Tap-to-walk when you aren't steering yourself
        if (inputMag > 0.1) live.target = null;
        else if (live.target) {
          const target = live.target;
          const use = target.use ? list.find((i) => i.key === target.use) : undefined;
          const dx = target.x - me.x;
          const dz = target.z - me.z;
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

        const mag = Math.min(1, Math.hypot(ix, iy));
        if (mag > 0.05) {
          const dx = Math.cos(live.yaw) * ix - Math.sin(live.yaw) * iy;
          const dz = -Math.sin(live.yaw) * ix - Math.cos(live.yaw) * iy;
          const len = Math.hypot(dx, dz) || 1;
          const step = SPEED * mag * dt;
          const th = placements.find((p) => p.id === 'treehouse');
          [me.x, me.z] = collide(ui.area, me.x + (dx / len) * step, me.z + (dz / len) * step, list, th);
          me.ry = Math.atan2(dx, dz);
          me.moving = true;
          // a walk cancels emotes
          if (live.myEmote && live.myEmote.kind !== 'hearts') live.myEmote = null;
        } else {
          me.moving = false;
        }
        me.y = groundY(ui.area, placements);
        me.tilt = 0;
        me.pose = live.myEmote && live.myEmote.until > t && live.myEmote.kind === 'hug' ? 'hug' : 'stand';
      }

      // What can you use right now?
      if (t - lastNear.current > 0.2) {
        lastNear.current = t;
        let near: string | null = null;
        if (!ui.seat) {
          let best = 0;
          for (const it of list) {
            if (!it.action) continue;
            const g = reachGap(it, me.x, me.z);
            if (g <= best) [best, near] = [g, it.key];
          }
        }
        const p = live.partner;
        const canHug = Boolean(p && !ui.seat && !p.seat && p.area === ui.area && Math.hypot(p.x - me.x, p.z - me.z) < 2.6);
        if (near !== ui.nearby || canHug !== ui.canHug) useWorldUI.setState({ nearby: near, canHug });
      }

      // Camera follows behind you
      const seatIt = ui.seat ? list.find((i) => i.key === ui.seat!.key) : undefined;
      const head = new THREE.Vector3(me.x, me.y + (ui.seat ? 0.75 : 1.3), me.z);
      const indoor = ui.area === 'home';
      if (seatIt?.action === 'stargaze') {
        const fx = Math.sin(me.ry);
        const fz = Math.cos(me.ry);
        camPos.current.set(me.x - fx * 1.4, me.y + 1.9, me.z - fz * 1.4);
        camera.position.lerp(camPos.current, 1 - Math.exp(-dt * 4));
        camera.lookAt(me.x + fx * 8, me.y + 9, me.z + fz * 8);
      } else {
        const riding = seatIt?.action === 'ride';
        const dist = (riding ? 13 : indoor ? 6.5 : ui.area === 'treehouse' ? 6.5 : 7.5) * live.zoom;
        const pitch = indoor ? Math.max(0.75, live.pitch) : riding ? Math.max(0.3, live.pitch) : live.pitch;
        camPos.current.set(
          head.x + Math.sin(live.yaw) * Math.cos(pitch) * dist,
          head.y + Math.sin(pitch) * dist,
          head.z + Math.cos(live.yaw) * Math.cos(pitch) * dist
        );
        // keep the camera above the ground and inside the sky
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
      const seated = Boolean(p.seat);
      // Seated partners are placed exactly (swing/boat/balloon move on the shared clock)
      if (seated) {
        const it = interactables(p.area, placements).find((i) => i.key === p.seat!.key);
        if (it) Object.assign(s, seatPose(it, p.seat!.idx, t, live.balloonAlt), { moving: false });
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
      live.send('pose', {
        x: me.x, y: me.y, z: me.z, ry: me.ry, tilt: me.tilt, pose: me.pose, moving: me.moving,
        area: ui.area, seat: ui.seat, look: ui.look, ride: live.ride?.start ?? null,
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
      maxDistance={45}
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

/** Drawn at each phone's own speed; heavy bits are memoised so walking stays smooth. */
export const WorldScene: React.FC<WorldSceneProps> = ({ placements, total, level, phase, season, weather, myName, partnerName, helpers, onMove }) => {
  const center = useRef(new THREE.Vector3());
  const mode = useWorldUI((s) => s.mode);
  const seat = useWorldUI((s) => s.seat);
  const selected = useWorldUI((s) => s.selected);
  const look = useWorldUI((s) => s.look);
  const partnerPose = useWorldUI((s) => s.partner);
  const editing = mode === 'edit';
  const stargazing = seat?.key === 'telescope';
  const shownPhase: Phase = stargazing ? 'night' : phase;
  const night = shownPhase === 'night';
  const outList = useMemo(() => interactables('out', placements), [placements]);
  const tree = placements.find((p) => p.id === 'tree')!;
  const hasCottage = placements.some((p) => p.id === 'cottage');

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
    const d = Math.hypot(x, z);
    const max = ISLAND_RADIUS - 2;
    if (d > max) [x, z] = [(x / d) * max, (z / d) * max];
    onMove(editDrag.id, x, z, false);
  };

  const use = (id: string, e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 8) return; // that was a camera drag
    e.stopPropagation();
    const it = outList.find((i) => i.key === id);
    if (it?.action && useWorldUI.getState().area === 'out') activate(it, helpers);
  };

  const walkTo = (e: ThreeEvent<MouseEvent>) => {
    if (editing || e.delta > 8 || useWorldUI.getState().seat || useWorldUI.getState().area !== 'out') return;
    live.target = { x: e.point.x, z: e.point.z };
  };

  return (
    <Canvas
      shadows
      dpr={[1, 1.75]}
      camera={{ fov: 55, near: 0.1, far: 700, position: [6, 6, 14] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerMissed={() => editing && !editDrag.active && useWorldUI.setState({ selected: null })}
    >
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
      <BorderTrees season={season} />
      <Flowers total={total} season={season} placements={placements} />
      <group onClick={(e) => use('tree', e)}>
        <LoveTree level={level} season={season} place={tree} />
      </group>
      {placements
        .filter((p) => p.id !== 'tree')
        .map((p) => (
          <PlacedBuild key={p.id} p={p} night={night} busy={busy(p.id)} selected={editing && selected === p.id} editing={editing} onPick={pick} onUse={use} />
        ))}
      {hasCottage && <HomeInterior night={night} />}

      <Avatar
        frame={() => live.me}
        emote={() => live.myEmote}
        color={look.outfit}
        hair={look.hair}
        short={look.short}
        name={myName}
      />
      {partnerPose && (
        <Avatar
          frame={() => live.partnerShown}
          emote={() => live.partnerEmote}
          color={partnerPose.look.outfit}
          hair={partnerPose.look.hair}
          short={partnerPose.look.short}
          name={partnerName}
        />
      )}
      <Controller placements={placements} helpers={helpers} center={center} />
    </Canvas>
  );
};
