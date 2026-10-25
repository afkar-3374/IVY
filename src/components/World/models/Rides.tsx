import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Heart, Mat, STONE, WOOD, WOOD_DARK, WOOD_LIGHT } from './common';
import { live } from '../worldState';
import { FERRIS_CABINS, FERRIS_HUB, FERRIS_RADIUS, SEA_Y, TRAIN_CARS, ferrisCabin, now, trainAt } from '../worldData';
import { DOCK, GATES, GATE_HALF_WIDTH, RAIL, RAIL_WIDTH, ROAD, ROAD_WIDTH, type Loop } from '../terrain';

const Box: React.FC<{ s: [number, number, number]; p?: [number, number, number]; r?: [number, number, number]; c: string; glow?: string | false }> = ({ s, p, r, c, glow }) => (
  <mesh position={p} rotation={r} castShadow receiveShadow>
    <boxGeometry args={s} />
    <Mat c={c} glow={glow} />
  </mesh>
);

const Cyl: React.FC<{ a: [number, number, number, number?]; p?: [number, number, number]; r?: [number, number, number]; c: string; glow?: string | false }> = ({ a, p, r, c, glow }) => (
  <mesh position={p} rotation={r} castShadow receiveShadow>
    <cylinderGeometry args={[a[0], a[1], a[2], a[3] ?? 12]} />
    <Mat c={c} glow={glow} />
  </mesh>
);

/** A wheel standing up, rolling along +z (spin it with rotation.x). */
const Wheel: React.FC<{ r: number; w: number; p: [number, number, number]; spin: React.RefObject<number>; c?: string }> = ({ r, w, p, spin, c = '#1F2937' }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    if (ref.current) ref.current.rotation.x = spin.current;
  });
  return (
    <group position={p} ref={ref}>
      <Cyl a={[r, r, w, 16]} r={[0, 0, Math.PI / 2]} c={c} />
      <Cyl a={[r * 0.55, r * 0.55, w + 0.02, 8]} r={[0, 0, Math.PI / 2]} c="#E5E7EB" />
      <Box s={[w + 0.03, r * 1.4, 0.05]} c="#9CA3AF" />
    </group>
  );
};

/** Places a vehicle where `live.vehicles` says and rolls its wheels by the distance moved. */
function useVehicle(id: string, wheelR: number) {
  const group = useRef<THREE.Group>(null);
  const spin = useRef(0);
  const last = useRef<{ x: number; z: number } | null>(null);
  useFrame(() => {
    const v = live.vehicles[id];
    const g = group.current;
    if (!v || !g) return;
    g.position.set(v.x, 0, v.z);
    let d = v.ry - g.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    g.rotation.y += d * 0.5;
    if (last.current) {
      const moved = Math.hypot(v.x - last.current.x, v.z - last.current.z);
      // forwards or backwards?
      const fwd = (v.x - last.current.x) * Math.sin(v.ry) + (v.z - last.current.z) * Math.cos(v.ry) >= 0 ? 1 : -1;
      if (moved < 3) spin.current += (fwd * moved) / wheelR;
    }
    last.current = { x: v.x, z: v.z };
  });
  return { group, spin };
}

/** A pink convertible for two. Seats face +z; driver on the left. */
export const Car: React.FC<{ night: boolean; onClick?: (e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => void }> = ({ night, onClick }) => {
  const { group, spin } = useVehicle('car', 0.32);
  const body = '#F472B6';
  return (
    <group ref={group} onClick={onClick}>
      <Box s={[1.6, 0.42, 2.9]} p={[0, 0.5, 0]} c={body} />
      <Box s={[1.5, 0.2, 0.9]} p={[0, 0.78, 0.95]} r={[-0.08, 0, 0]} c={body} />
      <Box s={[1.5, 0.2, 0.6]} p={[0, 0.75, -1.1]} c={body} />
      {/* doors sit low so you can see us inside */}
      {[-0.78, 0.78].map((x) => (
        <Box key={x} s={[0.06, 0.24, 1.2]} p={[x, 0.82, -0.15]} c={body} />
      ))}
      <mesh position={[0, 1.05, 0.48]} rotation={[-0.45, 0, 0]}>
        <boxGeometry args={[1.4, 0.45, 0.04]} />
        <meshStandardMaterial color="#BAE6FD" transparent opacity={0.45} roughness={0.05} />
      </mesh>
      {[-0.36, 0.36].map((x) => (
        <group key={x} position={[x, 0, -0.2]}>
          <Box s={[0.5, 0.12, 0.5]} p={[0, 0.72, 0.05]} c="#FFF1F2" />
          <Box s={[0.5, 0.55, 0.12]} p={[0, 0.98, -0.22]} r={[-0.15, 0, 0]} c="#FFF1F2" />
        </group>
      ))}
      <mesh position={[-0.36, 0.98, 0.3]} rotation={[-0.9, 0, 0]}>
        <torusGeometry args={[0.15, 0.025, 6, 16]} />
        <Mat c="#1F2937" />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <Box key={x} s={[0.3, 0.14, 0.05]} p={[x, 0.55, 1.46]} c="#FEF9C3" glow={night ? '#FDE047' : '#FEF08A'} />
      ))}
      {[-0.55, 0.55].map((x) => (
        <Box key={x} s={[0.3, 0.12, 0.05]} p={[x, 0.55, -1.46]} c="#EF4444" glow="#EF4444" />
      ))}
      {[-0.81, 0.81].map((x) => (
        <Heart key={x} c="#FFFFFF" position={[x, 0.55, 0]} rotation={[0, Math.PI / 2, 0]} scale={0.18} />
      ))}
      {[[-0.8, 0.95], [0.8, 0.95], [-0.8, -0.95], [0.8, -0.95]].map(([x, z], i) => (
        <Wheel key={i} r={0.32} w={0.24} p={[x, 0.32, z]} spin={spin} />
      ))}
    </group>
  );
};

/** A tandem bike: front rider steers, back rider pedals along. */
export const Bike: React.FC<{ onClick?: (e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => void }> = ({ onClick }) => {
  const { group, spin } = useVehicle('bike', 0.36);
  const frame = '#38BDF8';
  return (
    <group ref={group} onClick={onClick}>
      <Wheel r={0.36} w={0.06} p={[0, 0.36, 0.95]} spin={spin} />
      <Wheel r={0.36} w={0.06} p={[0, 0.36, -0.95]} spin={spin} />
      {/* frame */}
      <Box s={[0.06, 0.06, 1.9]} p={[0, 0.62, 0]} c={frame} />
      <Box s={[0.06, 0.06, 1.7]} p={[0, 0.4, 0]} c={frame} />
      {[0.42, -0.42].map((z) => (
        <group key={z}>
          <Box s={[0.05, 0.4, 0.05]} p={[0, 0.6, z]} c={frame} />
          <Box s={[0.2, 0.06, 0.3]} p={[0, 0.82, z]} c="#1F2937" />
          <Cyl a={[0.07, 0.07, 0.02, 10]} p={[0, 0.38, z + 0.12]} r={[0, 0, Math.PI / 2]} c="#6B7280" />
        </group>
      ))}
      <Box s={[0.05, 0.6, 0.05]} p={[0, 0.7, 0.92]} r={[-0.25, 0, 0]} c={frame} />
      <Box s={[0.6, 0.04, 0.04]} p={[0, 1.02, 0.86]} c="#1F2937" />
      <Box s={[0.4, 0.04, 0.04]} p={[0, 0.96, 0.12]} c="#1F2937" />
      <Box s={[0.32, 0.2, 0.22]} p={[0, 0.9, 1.05]} c="#FBCFE8" />
      <Heart c="#F43F5E" position={[0, 0.92, 1.17]} scale={0.1} />
    </group>
  );
};

/** A flat ribbon following a loop, `half` metres either side of it. */
function ribbon(loop: Loop, offset: number, half: number, y: number, step = 2): THREE.BufferGeometry {
  const pos: number[] = [];
  const idx: number[] = [];
  const n = loop.x.length - 1;
  let k = 0;
  for (let i = 0; i <= n; i += step) {
    const j = Math.min(n, i + 1);
    const tx = loop.x[j] - loop.x[i === n ? n - 1 : i];
    const tz = loop.z[j] - loop.z[i === n ? n - 1 : i];
    const len = Math.hypot(tx, tz) || 1;
    // normal pointing right of travel
    const nx = tz / len;
    const nz = -tx / len;
    const cx = loop.x[i] + nx * offset;
    const cz = loop.z[i] + nz * offset;
    pos.push(cx - nx * half, y, cz - nz * half, cx + nx * half, y, cz + nz * half);
    if (k) idx.push(2 * k - 2, 2 * k - 1, 2 * k, 2 * k - 1, 2 * k + 1, 2 * k);
    k++;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // the winding decides which side faces up; make sure it's the top
  const nrm = g.getAttribute('normal');
  if (nrm.getY(0) < 0) {
    for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g;
}

/** Instanced little boxes laid along a loop every `every` metres. */
const AlongLoop: React.FC<{ loop: Loop; every: number; size: [number, number, number]; y: number; color: string; offset?: number }> = ({ loop, every, size, y, color, offset = 0 }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  const count = Math.floor(loop.length / every);
  useLayoutEffect(() => {
    const o = new THREE.Object3D();
    for (let i = 0; i < count; i++) {
      const p = loop.at(i * every);
      o.position.set(p.x + Math.cos(p.heading) * offset, y, p.z - Math.sin(p.heading) * offset);
      o.rotation.set(0, p.heading, 0);
      o.updateMatrix();
      ref.current!.setMatrixAt(i, o.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [loop, every, count, y, offset]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, count]} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </instancedMesh>
  );
};

/** The winding road for the car, bike and horse. */
export const Road: React.FC = () => {
  const surface = useMemo(() => ribbon(ROAD, 0, ROAD_WIDTH / 2, 0.025), []);
  const kerbs = useMemo(() => [ribbon(ROAD, -ROAD_WIDTH / 2 - 0.12, 0.13, 0.03), ribbon(ROAD, ROAD_WIDTH / 2 + 0.12, 0.13, 0.03)], []);
  return (
    <group>
      <mesh geometry={surface} receiveShadow>
        <meshStandardMaterial color="#8B8F98" roughness={0.95} />
      </mesh>
      {kerbs.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#F9A8D4" roughness={0.9} />
        </mesh>
      ))}
      <AlongLoop loop={ROAD} every={3.2} size={[0.12, 0.01, 1.4]} y={0.04} color="#FFFFFF" />
    </group>
  );
};

/** The railway: gravel bed, wooden sleepers and two steel rails. */
export const Railway: React.FC = () => {
  const bed = useMemo(() => ribbon(RAIL, 0, RAIL_WIDTH / 2, 0.02), []);
  const rails = useMemo(() => [ribbon(RAIL, -0.55, 0.05, 0.16), ribbon(RAIL, 0.55, 0.05, 0.16)], []);
  return (
    <group>
      <mesh geometry={bed} receiveShadow>
        <meshStandardMaterial color="#A8A29E" roughness={1} />
      </mesh>
      <AlongLoop loop={RAIL} every={0.9} size={[1.7, 0.1, 0.24]} y={0.07} color={WOOD_DARK} />
      {rails.map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial color="#6B7280" metalness={0.6} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
};

/** The little train: an engine and two open carriages, always going round. */
export const Train: React.FC<{ night: boolean }> = ({ night }) => {
  const cars = useRef<(THREE.Group | null)[]>([]);
  const smoke = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = now();
    cars.current.forEach((g, i) => {
      if (!g) return;
      const c = trainAt(t, i);
      g.position.set(c.x, 0, c.z);
      g.rotation.y = c.heading;
    });
    smoke.current?.children.forEach((c, i) => {
      const p = (t * 0.6 + i / 5) % 1;
      c.position.set(0, 2.1 + p * 1.4, 0.7 - p * 1.2);
      c.scale.setScalar(0.12 + p * 0.3);
    });
  });
  const wheels = (len: number) =>
    [-len / 2 + 0.35, len / 2 - 0.35].flatMap((z) =>
      [-0.6, 0.6].map((x) => <Cyl key={`${x}${z}`} a={[0.25, 0.25, 0.12, 12]} p={[x, 0.25, z]} r={[0, 0, Math.PI / 2]} c="#1F2937" />)
    );
  return (
    <group>
      {Array.from({ length: TRAIN_CARS }, (_, i) => (
        <group key={i} ref={(g) => (cars.current[i] = g)}>
          {i === 0 ? (
            <group>
              <Box s={[1.3, 0.3, 2.4]} p={[0, 0.5, 0]} c="#1F2937" />
              <Cyl a={[0.5, 0.5, 1.4, 14]} p={[0, 1.05, 0.4]} r={[Math.PI / 2, 0, 0]} c="#E11D48" />
              <Box s={[1.2, 1.2, 0.9]} p={[0, 1.2, -0.75]} c="#BE123C" />
              <Box s={[1.4, 0.12, 1.1]} p={[0, 1.86, -0.75]} c="#1F2937" />
              {[-0.61, 0.61].map((x) => (
                <Box key={x} s={[0.02, 0.4, 0.5]} p={[x, 1.4, -0.75]} c="#FEF3C7" glow={night ? '#FBBF24' : false} />
              ))}
              <Cyl a={[0.14, 0.2, 0.55, 10]} p={[0, 1.75, 0.8]} c="#1F2937" />
              <Box s={[0.4, 0.3, 0.05]} p={[0, 1.05, 1.12]} c="#FEF9C3" glow={night ? '#FDE047' : '#FEF08A'} />
              <Heart c="#FDE68A" position={[0.51, 1.05, 0.4]} rotation={[0, Math.PI / 2, 0]} scale={0.2} />
              <group ref={smoke}>
                {Array.from({ length: 5 }, (_, j) => (
                  <mesh key={j}>
                    <icosahedronGeometry args={[1, 0]} />
                    <meshStandardMaterial color="#F5F5F4" transparent opacity={0.75} flatShading />
                  </mesh>
                ))}
              </group>
              {wheels(2.4)}
            </group>
          ) : (
            <group>
              <Box s={[1.3, 0.3, 2.2]} p={[0, 0.45, 0]} c="#1F2937" />
              <Box s={[1.3, 0.5, 2.2]} p={[0, 0.85, 0]} c={i % 2 ? '#60A5FA' : '#FBBF24'} />
              <Box s={[1.2, 0.12, 0.5]} p={[0, 0.62, 0]} c={WOOD_LIGHT} />
              <Box s={[1.2, 0.45, 0.1]} p={[0, 0.88, -0.25]} c={WOOD_LIGHT} />
              {[-0.6, 0.6].flatMap((x) => [-1.0, 1.0].map((z) => <Cyl key={`${x}${z}`} a={[0.03, 0.03, 0.9, 6]} p={[x, 1.5, z]} c="#FFFFFF" />))}
              <Box s={[1.45, 0.08, 2.35]} p={[0, 1.95, 0]} c="#F9A8D4" />
              {wheels(2.2)}
            </group>
          )}
        </group>
      ))}
    </group>
  );
};

/** Where you get on the train. */
export const Station: React.FC = () => (
  <group>
    <Box s={[5, 0.3, 1.8]} p={[0, 0.15, 0]} c={STONE} />
    <Box s={[5, 0.06, 0.15]} p={[0, 0.31, 0.83]} c="#FDE047" />
    {[-2.2, 2.2].map((x) => (
      <Cyl key={x} a={[0.07, 0.07, 2.3, 8]} p={[x, 1.45, -0.5]} c="#FFFFFF" />
    ))}
    <Box s={[5.4, 0.12, 2]} p={[0, 2.62, -0.1]} r={[0.08, 0, 0]} c="#F472B6" />
    <Box s={[1.6, 0.08, 0.45]} p={[0, 0.72, -0.55]} c={WOOD} />
    <Box s={[1.6, 0.45, 0.07]} p={[0, 0.95, -0.76]} c={WOOD} />
    <Box s={[1.4, 0.45, 0.06]} p={[0, 2.25, 0.85]} c="#FFFFFF" />
    <Heart c="#F43F5E" position={[0, 2.25, 0.9]} scale={0.2} />
    <Cyl a={[0.22, 0.22, 0.06, 18]} p={[1.7, 2.1, 0.85]} r={[Math.PI / 2, 0, 0]} c="#FFFFFF" />
  </group>
);

/** The Ferris wheel. You ride in cabin 0 (the pink one). */
export const Ferris: React.FC<{ night: boolean }> = ({ night }) => {
  const wheel = useRef<THREE.Group>(null);
  const cabins = useRef<(THREE.Group | null)[]>([]);
  useFrame(() => {
    const t = now();
    if (wheel.current) wheel.current.rotation.z = t * 0.1;
    cabins.current.forEach((g, i) => {
      if (!g) return;
      const c = ferrisCabin(t, i);
      g.position.set(c.x, c.y, 0);
    });
  });
  const colours = ['#F472B6', '#60A5FA', '#FBBF24', '#34D399', '#A78BFA', '#FB923C', '#F87171', '#22D3EE'];
  return (
    <group>
      {/* stand */}
      {[-0.7, 0.7].map((z) => (
        <group key={z} position={[0, 0, z]}>
          <Cyl a={[0.12, 0.16, 9, 8]} p={[-1.7, 4.2, 0]} r={[0, 0, -0.2]} c="#E5E7EB" />
          <Cyl a={[0.12, 0.16, 9, 8]} p={[1.7, 4.2, 0]} r={[0, 0, 0.2]} c="#E5E7EB" />
        </group>
      ))}
      <Cyl a={[0.25, 0.25, 1.7, 12]} p={[0, FERRIS_HUB, 0]} r={[Math.PI / 2, 0, 0]} c="#9CA3AF" />
      <Box s={[4.4, 0.25, 2.2]} p={[0, 0.12, 0]} c={STONE} />
      <group ref={wheel} position={[0, FERRIS_HUB, 0]}>
        {[-0.45, 0.45].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <torusGeometry args={[FERRIS_RADIUS, 0.08, 6, 48]} />
            <meshStandardMaterial color="#F9A8D4" emissive={night ? '#F472B6' : '#000000'} emissiveIntensity={night ? 0.8 : 0} />
          </mesh>
        ))}
        {Array.from({ length: FERRIS_CABINS }, (_, i) => (
          <group key={i} rotation={[0, 0, (i / FERRIS_CABINS) * Math.PI * 2]}>
            <Box s={[FERRIS_RADIUS, 0.06, 0.06]} p={[FERRIS_RADIUS / 2, 0, 0.45]} c="#FFFFFF" />
            <Box s={[FERRIS_RADIUS, 0.06, 0.06]} p={[FERRIS_RADIUS / 2, 0, -0.45]} c="#FFFFFF" />
          </group>
        ))}
        {night &&
          Array.from({ length: 24 }, (_, i) => {
            const a = (i / 24) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * FERRIS_RADIUS, Math.sin(a) * FERRIS_RADIUS, 0.5]}>
                <sphereGeometry args={[0.07, 6, 4]} />
                <meshStandardMaterial color="#FEF9C3" emissive="#FDE047" emissiveIntensity={2} />
              </mesh>
            );
          })}
      </group>
      {Array.from({ length: FERRIS_CABINS }, (_, i) => (
        <group key={i} ref={(g) => (cabins.current[i] = g)}>
          <Cyl a={[0.02, 0.02, 0.4, 4]} p={[0, 1.45, 0]} c="#9CA3AF" />
          {[[-0.58, -0.4], [0.58, -0.4], [-0.58, 0.4], [0.58, 0.4]].map(([x, z], j) => (
            <Cyl key={j} a={[0.025, 0.025, 1.6, 4]} p={[x, 0.2, z]} c="#FFFFFF" />
          ))}
          <Box s={[1.25, 0.08, 0.9]} p={[0, -0.6, 0]} c={colours[i]} />
          <Box s={[1.1, 0.06, 0.36]} p={[0, -0.18, -0.22]} c="#FFF1F2" />
          <Box s={[1.1, 0.4, 0.06]} p={[0, -0.4, -0.22]} c={WOOD_LIGHT} />
          <Box s={[1.25, 0.4, 0.06]} p={[0, -0.4, -0.42]} c={colours[i]} />
          <Box s={[1.25, 0.25, 0.06]} p={[0, -0.47, 0.42]} c={colours[i]} />
          <mesh position={[0, 1.2, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
            <coneGeometry args={[0.95, 0.45, 4]} />
            <Mat c={colours[i]} />
          </mesh>
          {i === 0 && <Heart c="#FFFFFF" position={[0, -0.47, 0.46]} scale={0.15} />}
        </group>
      ))}
    </group>
  );
};

/** The boutique where the dressing room is. Door faces +z. */
export const Boutique: React.FC<{ night: boolean }> = ({ night }) => (
  <group>
    <Box s={[4.2, 3, 3.2]} p={[0, 1.5, 0]} c="#FDF2F8" />
    <Box s={[4.4, 0.25, 3.4]} p={[0, 3.1, 0]} c="#F472B6" />
    {/* striped awning */}
    {Array.from({ length: 8 }, (_, i) => (
      <Box key={i} s={[0.52, 0.06, 1]} p={[-1.82 + i * 0.52, 2.55, 1.95]} r={[0.35, 0, 0]} c={i % 2 ? '#FFFFFF' : '#F472B6'} />
    ))}
    {/* shop window with outfits */}
    <Box s={[1.5, 1.4, 0.05]} p={[-1.1, 1.3, 1.61]} c="#E0F2FE" glow={night ? '#FDE68A' : false} />
    {[-1.45, -0.75].map((x, i) => (
      <group key={x} position={[x, 0.7, 1.4]}>
        <Cyl a={[0.04, 0.04, 0.5, 6]} p={[0, 0.25, 0]} c="#D6D3D1" />
        <Cyl a={[0.12, 0.3, 0.55, 12]} p={[0, 0.65, 0]} c={i ? '#A78BFA' : '#FB7185'} />
        <mesh position={[0, 1.02, 0]}>
          <sphereGeometry args={[0.11, 10, 8]} />
          <Mat c="#F5F5F4" flat={false} />
        </mesh>
      </group>
    ))}
    <Box s={[0.9, 1.7, 0.06]} p={[0.9, 0.85, 1.61]} c="#BE185D" />
    <mesh position={[1.2, 0.9, 1.66]}>
      <sphereGeometry args={[0.05, 8, 6]} />
      <Mat c="#FCD34D" />
    </mesh>
    <Box s={[2.4, 0.5, 0.08]} p={[0, 3.55, 1.5]} c="#FFFFFF" />
    <Heart c="#F43F5E" position={[-0.7, 3.55, 1.56]} scale={0.22} />
    <Heart c="#F472B6" position={[0, 3.55, 1.56]} scale={0.22} />
    <Heart c="#F43F5E" position={[0.7, 3.55, 1.56]} scale={0.22} />
    {night && <pointLight position={[0, 2, 2.4]} color="#FBCFE8" intensity={5} distance={7} />}
  </group>
);

/** Painted parking spots for the car and bike. */
export const Parking: React.FC = () => (
  <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]} receiveShadow>
      <planeGeometry args={[7, 3.6]} />
      <meshStandardMaterial color="#D6D3D1" roughness={1} />
    </mesh>
    {[-3.4, -0.2, 3.4].map((x) => (
      <mesh key={x} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.02, 0]}>
        <planeGeometry args={[0.1, 3.2]} />
        <meshBasicMaterial color="#FFFFFF" />
      </mesh>
    ))}
    <Cyl a={[0.05, 0.05, 2, 6]} p={[3.6, 1, -1.6]} c={WOOD_DARK} />
    <Box s={[0.7, 0.7, 0.06]} p={[3.6, 2.1, -1.6]} c="#3B82F6" />
  </group>
);

/** A horse for two: saddle, mane and tail; legs gallop when it moves. */
export const Horse: React.FC<{ onClick?: (e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => void }> = ({ onClick }) => {
  const { group, spin } = useVehicle('horse', 0.25);
  const legs = useRef<(THREE.Group | null)[]>([]);
  const neck = useRef<THREE.Group>(null);
  const tail = useRef<THREE.Group>(null);
  const last = useRef(0);
  const speed = useRef(0);
  useFrame((_, dt) => {
    // how fast the legs move comes from how far the horse went
    const moved = spin.current - last.current;
    last.current = spin.current;
    speed.current += (Math.min(3, Math.abs(moved) / Math.max(dt, 1e-3) / 30) - speed.current) * Math.min(1, dt * 6);
    const t = now();
    const g = speed.current;
    legs.current.forEach((l, i) => {
      if (!l) return;
      const phase = t * (4 + g * 6) + (i % 2 ? Math.PI : 0) + (i > 1 ? 0.6 : 0);
      l.rotation.x = Math.sin(phase) * Math.min(0.75, g * 0.5);
    });
    if (neck.current) neck.current.rotation.x = -0.5 + Math.sin(t * (1 + g * 4)) * (0.05 + g * 0.05);
    if (tail.current) tail.current.rotation.x = 0.5 + Math.sin(t * 3) * 0.15;
  });
  const coat = '#8B5A2B';
  return (
    <group ref={group} onClick={onClick}>
      <mesh position={[0, 1.05, 0]} scale={[0.5, 0.55, 1.15]} castShadow>
        <sphereGeometry args={[0.6, 16, 12]} />
        <Mat c={coat} flat={false} />
      </mesh>
      {/* legs: front pair at +z */}
      {[[-0.2, 0.45], [0.2, 0.45], [-0.2, -0.45], [0.2, -0.45]].map(([x, z], i) => (
        <group key={i} position={[x, 0.95, z]} ref={(g) => (legs.current[i] = g)}>
          <Cyl a={[0.07, 0.06, 0.85, 8]} p={[0, -0.45, 0]} c={coat} />
          <Cyl a={[0.075, 0.08, 0.1, 8]} p={[0, -0.9, 0]} c="#292524" />
        </group>
      ))}
      <group ref={neck} position={[0, 1.3, 0.55]}>
        <Cyl a={[0.15, 0.2, 0.75, 10]} p={[0, 0.3, 0.05]} c={coat} />
        <mesh position={[0, 0.7, 0.18]} rotation={[0.9, 0, 0]} scale={[0.6, 0.6, 1]} castShadow>
          <capsuleGeometry args={[0.15, 0.3, 4, 10]} />
          <Mat c={coat} flat={false} />
        </mesh>
        {[-0.08, 0.08].map((x) => (
          <mesh key={x} position={[x, 0.85, 0.02]} castShadow>
            <coneGeometry args={[0.04, 0.12, 4]} />
            <Mat c={coat} />
          </mesh>
        ))}
        {[-0.1, 0.1].map((x) => (
          <mesh key={x} position={[x, 0.72, 0.22]}>
            <sphereGeometry args={[0.025, 6, 6]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        ))}
        <Box s={[0.05, 0.6, 0.12]} p={[0, 0.45, -0.12]} r={[0.2, 0, 0]} c="#3F2A1D" />
      </group>
      <group ref={tail} position={[0, 1.15, -0.65]}>
        <Cyl a={[0.06, 0.02, 0.6, 6]} p={[0, -0.28, 0]} c="#3F2A1D" />
      </group>
      {/* saddle for two */}
      <Box s={[0.56, 0.08, 0.95]} p={[0, 1.38, -0.12]} c="#DC2626" />
      <Box s={[0.6, 0.04, 1.0]} p={[0, 1.33, -0.12]} c="#FDE68A" />
      <Heart c="#FFFFFF" position={[0.3, 1.25, -0.12]} rotation={[0, Math.PI / 2, 0]} scale={0.12} />
    </group>
  );
};

/** A speedboat that floats on the sea. */
export const SpeedBoat: React.FC<{ id: string; color: string; onClick?: (e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => void }> = ({ id, color, onClick }) => {
  const { group } = useVehicle(id, 1);
  const hull = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = now();
    if (group.current) group.current.position.y = SEA_Y + Math.sin(t * 2.4 + group.current.position.x) * 0.06;
    if (hull.current) hull.current.rotation.z = Math.sin(t * 1.7) * 0.03;
  });
  return (
    <group ref={group} onClick={onClick}>
      <group ref={hull}>
        <Box s={[1.3, 0.45, 2.6]} p={[0, 0.15, -0.2]} c="#FFFFFF" />
        <mesh position={[0, 0.15, 1.35]} rotation={[Math.PI / 2, 0, 0]} scale={[1, 1, 0.55]} castShadow>
          <coneGeometry args={[0.65, 1.1, 4]} />
          <Mat c="#FFFFFF" />
        </mesh>
        <Box s={[1.32, 0.12, 2.62]} p={[0, 0.3, -0.2]} c={color} />
        <Box s={[0.9, 0.12, 0.5]} p={[0, 0.45, -0.4]} c="#F5F5F4" />
        <Box s={[0.6, 0.4, 0.1]} p={[0, 0.65, -0.62]} r={[-0.2, 0, 0]} c="#F5F5F4" />
        <mesh position={[0, 0.72, 0.25]} rotation={[-0.6, 0, 0]}>
          <boxGeometry args={[1, 0.35, 0.03]} />
          <meshStandardMaterial color="#BAE6FD" transparent opacity={0.5} />
        </mesh>
        <Cyl a={[0.12, 0.15, 0.4, 8]} p={[0, 0.25, -1.55]} c="#1F2937" />
        <Heart c={color} position={[0.66, 0.15, 0.3]} rotation={[0, Math.PI / 2, 0]} scale={0.18} />
      </group>
    </group>
  );
};

/** The wooden jetty where the boats wait and races start. */
export const Dock: React.FC = () => (
  <group position={[DOCK.x, 0, DOCK.z]} rotation={[0, DOCK.rot, 0]}>
    {Array.from({ length: Math.ceil(DOCK.length / 0.5) }, (_, i) => (
      <Box key={i} s={[2.2, 0.08, 0.45]} p={[0, 0.08, -1.5 + i * 0.5]} c={i % 2 ? WOOD : WOOD_LIGHT} />
    ))}
    {Array.from({ length: 6 }, (_, i) => -1.5 + i * ((DOCK.length + 1) / 5)).flatMap((z) =>
      [-1.05, 1.05].map((x) => <Cyl key={`${x}${z}`} a={[0.1, 0.1, 1.6, 8]} p={[x, -0.5, z]} c={WOOD_DARK} />)
    )}
    {/* start flag */}
    <Cyl a={[0.04, 0.04, 2.6, 6]} p={[1, 1.3, DOCK.length - 1.5]} c="#E5E7EB" />
    {Array.from({ length: 4 }, (_, i) => (
      <Box key={i} s={[0.02, 0.25, 0.25]} p={[1, 2.45 - (i % 2) * 0.25, DOCK.length - 1.62 + Math.floor(i / 2) * 0.25 - 0.12]} c={i === 1 || i === 2 ? '#111827' : '#FFFFFF'} />
    ))}
  </group>
);

/** Floating gates round the island; the next one glows during a race. */
export const RaceGates: React.FC<{ next: number | null }> = ({ next }) => {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => {
    const t = now();
    ref.current?.children.forEach((g, i) => (g.position.y = SEA_Y + Math.sin(t * 1.8 + i) * 0.08));
  });
  return (
    <group ref={ref}>
      {GATES.map((g, i) => {
        const glow = next === i;
        const sx = Math.cos(g.heading) * GATE_HALF_WIDTH;
        const sz = -Math.sin(g.heading) * GATE_HALF_WIDTH;
        return (
          <group key={i} position={[g.x, SEA_Y, g.z]}>
            {[-1, 1].map((d) => (
              <group key={d} position={[sx * d, 0, sz * d]}>
                <Cyl a={[0.35, 0.45, 0.8, 10]} p={[0, 0.3, 0]} c={i === 0 ? '#111827' : d < 0 ? '#EF4444' : '#FFFFFF'} glow={glow ? '#22C55E' : false} />
                <Cyl a={[0.05, 0.05, 1.4, 6]} p={[0, 1.3, 0]} c="#E5E7EB" />
                <Box s={[0.05, 0.35, 0.5]} p={[0, 1.85, 0]} c={glow ? '#22C55E' : i === 0 ? '#FFFFFF' : '#F472B6'} glow={glow ? '#22C55E' : false} />
              </group>
            ))}
          </group>
        );
      })}
    </group>
  );
};

/** Fenced paddock where the horse waits. */
export const Paddock: React.FC = () => (
  <group>
    {Array.from({ length: 20 }, (_, i) => {
      // a 7×5 rectangle of posts with a gap (the gate) at the front
      const side = Math.floor(i / 5);
      const u = (i % 5) / 5;
      const pts: [number, number][] = [
        [-3.5 + u * 7, -2.5],
        [3.5, -2.5 + u * 5],
        [3.5 - u * 7, 2.5],
        [-3.5, 2.5 - u * 5],
      ];
      const [x, z] = pts[side];
      if (side === 2 && (u === 0.4 || u === 0.6)) return null;
      return <Cyl key={i} a={[0.06, 0.07, 1.1, 6]} p={[x, 0.55, z]} c={WOOD} />;
    })}
    {[0.45, 0.85].flatMap((y) => [
      <Box key={`a${y}`} s={[7, 0.06, 0.06]} p={[0, y, -2.5]} c={WOOD_LIGHT} />,
      <Box key={`b${y}`} s={[0.06, 0.06, 5]} p={[3.5, y, 0]} c={WOOD_LIGHT} />,
      <Box key={`c${y}`} s={[0.06, 0.06, 5]} p={[-3.5, y, 0]} c={WOOD_LIGHT} />,
      <Box key={`d${y}`} s={[2.6, 0.06, 0.06]} p={[-2.2, y, 2.5]} c={WOOD_LIGHT} />,
      <Box key={`e${y}`} s={[2.6, 0.06, 0.06]} p={[2.2, y, 2.5]} c={WOOD_LIGHT} />,
    ])}
    <Box s={[1.2, 0.5, 0.6]} p={[-2.6, 0.25, -1.9]} c={WOOD_DARK} />
    <mesh position={[-2.6, 0.52, -1.9]}>
      <boxGeometry args={[1.1, 0.04, 0.5]} />
      <meshStandardMaterial color="#38BDF8" />
    </mesh>
    <mesh position={[2.6, 0.35, -1.8]}>
      <cylinderGeometry args={[0.5, 0.55, 0.7, 10]} />
      <Mat c="#EAB308" />
    </mesh>
  </group>
);

/** A lighthouse on the shore with a turning light at night. */
export const Lighthouse: React.FC<{ night: boolean }> = ({ night }) => {
  const beam = useRef<THREE.Group>(null);
  useFrame(() => {
    if (beam.current) beam.current.rotation.y = now() * 0.9;
  });
  return (
    <group>
      {Array.from({ length: 5 }, (_, i) => (
        <Cyl key={i} a={[1.15 - (i + 1) * 0.1, 1.15 - i * 0.1, 1.6, 14]} p={[0, 0.8 + i * 1.6, 0]} c={i % 2 ? '#FFFFFF' : '#EF4444'} />
      ))}
      <Cyl a={[0.8, 0.8, 0.15, 14]} p={[0, 8.1, 0]} c="#374151" />
      <mesh position={[0, 8.7, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 1, 12]} />
        <meshStandardMaterial color="#FEF9C3" emissive="#FDE047" emissiveIntensity={night ? 2.5 : 0.4} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 9.45, 0]} castShadow>
        <coneGeometry args={[0.75, 0.6, 12]} />
        <Mat c="#EF4444" />
      </mesh>
      <Box s={[0.5, 0.9, 0.05]} p={[0, 0.45, 1.06]} c={WOOD_DARK} />
      {night && (
        <group ref={beam} position={[0, 8.7, 0]}>
          <mesh position={[0, 0, 7]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[1.6, 14, 16, 1, true]} />
            <meshBasicMaterial color="#FEF9C3" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
        </group>
      )}
    </group>
  );
};
