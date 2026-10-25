import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Stars } from '@react-three/drei';
import { Heart, Mat, WOOD_DARK } from './common';
import { seeded, type Phase, type Season, type Weather } from '../../Garden/GardenScene';
import { FIXED_SPOTS, ISLAND_RADIUS, ROAD_RADIUS, ROAD_WIDTH, type Placement } from '../worldData';

const SKY: Record<Phase, { top: string; bottom: string; sun: string; sunI: number; amb: number; ground: string }> = {
  day: { top: '#6EC1F5', bottom: '#FFE4F1', sun: '#FFF4DC', sunI: 2.4, amb: 1.1, ground: '#C7F0D2' },
  sunset: { top: '#5B4BA8', bottom: '#FFB38A', sun: '#FFB27A', sunI: 1.6, amb: 0.8, ground: '#F5C6AA' },
  night: { top: '#090826', bottom: '#3A2766', sun: '#A5B4FC', sunI: 0.55, amb: 0.45, ground: '#2C2A55' },
};

export const GRASS: Record<Season, string> = { spring: '#8EDB8A', summer: '#79CC6A', autumn: '#BFC46A', winter: '#EEF4F8' };
const LEAVES: Record<Season, string[]> = {
  spring: ['#86EFAC', '#F9A8D4', '#4ADE80'],
  summer: ['#4ADE80', '#22C55E', '#16A34A'],
  autumn: ['#FB923C', '#F59E0B', '#DC2626'],
  winter: ['#E2E8F0', '#CBD5E1', '#86A89A'],
};

/** Gradient sky, sun or moon, and the lights that go with the time of day. */
export const SkyAndLight: React.FC<{ phase: Phase; weather: Weather; center: React.RefObject<THREE.Vector3> }> = ({ phase, weather, center }) => {
  const sky = SKY[phase];
  const dim = weather === 'clear' ? 1 : weather === 'cloudy' ? 0.75 : 0.55;
  const light = useRef<THREE.DirectionalLight>(null);
  const uniforms = useMemo(() => ({ top: { value: new THREE.Color() }, bottom: { value: new THREE.Color() } }), []);
  uniforms.top.value.set(weather === 'rain' && phase !== 'night' ? '#94A3B8' : sky.top);
  uniforms.bottom.value.set(sky.bottom);
  const sunDir = phase === 'sunset' ? [-30, 12, -40] : phase === 'night' ? [25, 40, -30] : [18, 45, 12];

  // The shadow box follows you around the island
  useFrame(() => {
    const l = light.current;
    const c = center.current;
    if (!l || !c) return;
    l.position.set(c.x + sunDir[0], c.y + sunDir[1], c.z + sunDir[2]);
    l.target.position.copy(c);
    l.target.updateMatrixWorld();
  });

  return (
    <>
      <mesh scale={300} renderOrder={-1}>
        <sphereGeometry args={[1, 24, 16]} />
        <shaderMaterial
          side={THREE.BackSide}
          depthWrite={false}
          fog={false}
          uniforms={uniforms}
          vertexShader={'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'}
          fragmentShader={'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, clamp(h*1.6+0.1,0.0,1.0)), 1.0); }'}
        />
      </mesh>
      <fog attach="fog" args={[sky.bottom, 45, 160]} />
      <hemisphereLight args={[sky.top, sky.ground, sky.amb * dim]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        ref={light}
        color={sky.sun}
        intensity={sky.sunI * dim}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-far={120}
        shadow-bias={-0.0006}
      />
      {/* sun / moon */}
      <mesh position={[sunDir[0] * 3, sunDir[1] * 3, sunDir[2] * 3]}>
        <sphereGeometry args={[phase === 'night' ? 5 : 7, 20, 16]} />
        <meshBasicMaterial color={phase === 'night' ? '#EEF2FF' : phase === 'sunset' ? '#FFB27A' : '#FFF7C2'} fog={false} />
      </mesh>
      {phase === 'night' && <Stars radius={150} depth={40} count={2500} factor={5} saturation={0.4} fade speed={0.6} />}
    </>
  );
};

/** The island, the beach, the sea and far-away hills. */
export const Island: React.FC<{ season: Season; onGround?: (e: import('@react-three/fiber').ThreeEvent<MouseEvent>) => void; onGroundMove?: (e: import('@react-three/fiber').ThreeEvent<PointerEvent>) => void }> = ({ season, onGround, onGroundMove }) => {
  const water = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (water.current) water.current.position.y = -0.55 + Math.sin(clock.elapsedTime * 0.8) * 0.04;
  });
  const hills = useMemo(
    () => Array.from({ length: 16 }, (_, i) => ({ a: (i / 16) * Math.PI * 2 + seeded(i) * 0.3, r: 85 + seeded(i + 40) * 30, h: 14 + seeded(i + 80) * 22 })),
    []
  );
  return (
    <group>
      <mesh position={[0, -0.75, 0]} receiveShadow onClick={onGround} onPointerMove={onGroundMove}>
        <cylinderGeometry args={[ISLAND_RADIUS + 1.5, ISLAND_RADIUS + 0.5, 1.5, 64]} />
        <Mat c={GRASS[season]} />
      </mesh>
      <mesh position={[0, -0.95, 0]} receiveShadow>
        <cylinderGeometry args={[ISLAND_RADIUS + 3.2, ISLAND_RADIUS + 3.6, 1, 64]} />
        <Mat c="#FDE7C3" />
      </mesh>
      <mesh ref={water} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[260, 48]} />
        <meshStandardMaterial color="#5BC0EB" roughness={0.2} metalness={0.15} />
      </mesh>
      {hills.map((h, i) => (
        <mesh key={i} position={[Math.cos(h.a) * h.r, h.h / 2 - 1, Math.sin(h.a) * h.r]}>
          <coneGeometry args={[h.h * 0.9, h.h, 6]} />
          <Mat c={season === 'winter' ? '#E2E8F0' : i % 2 ? '#7FB9A2' : '#9CCFB0'} />
        </mesh>
      ))}
    </group>
  );
};

/** Low-poly trees around the edge of the island. */
export const BorderTrees: React.FC<{ season: Season }> = ({ season }) => {
  const trees = useMemo(
    () =>
      Array.from({ length: 34 }, (_, i) => {
        const a = (i / 34) * Math.PI * 2 + seeded(i + 900) * 0.15;
        const r = ISLAND_RADIUS - 1 + seeded(i + 950) * 2;
        return { x: Math.cos(a) * r, z: Math.sin(a) * r, s: 0.8 + seeded(i + 990) * 0.7, kind: i % 3 };
      }),
    []
  );
  const leaves = LEAVES[season];
  return (
    <group>
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} scale={t.s}>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.14, 0.2, 1.4, 6]} />
            <Mat c={WOOD_DARK} />
          </mesh>
          {t.kind === 0 ? (
            <>
              <mesh position={[0, 2.1, 0]} castShadow>
                <coneGeometry args={[1.1, 2, 7]} />
                <Mat c={season === 'winter' ? '#5E8C78' : '#2F9E6B'} />
              </mesh>
              <mesh position={[0, 3, 0]} castShadow>
                <coneGeometry args={[0.8, 1.5, 7]} />
                <Mat c={season === 'winter' ? '#F1F5F9' : '#3BB273'} />
              </mesh>
            </>
          ) : (
            <mesh position={[0, 2.1, 0]} castShadow>
              <icosahedronGeometry args={[1.05, 0]} />
              <Mat c={leaves[i % leaves.length]} />
            </mesh>
          )}
        </group>
      ))}
    </group>
  );
};

const FLOWER_COLOURS = ['#F472B6', '#FB7185', '#FDE047', '#FFFFFF', '#C084FC', '#F87171', '#60A5FA'];

/** One flower per 6 love points (up to 700), never on top of a build. */
export const Flowers: React.FC<{ total: number; season: Season; placements: Placement[] }> = ({ total, season, placements }) => {
  const heads = useRef<THREE.InstancedMesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const grass = useRef<THREE.InstancedMesh>(null);
  const count = season === 'winter' ? Math.min(160, Math.floor(total / 12)) : Math.min(700, Math.floor(total / 6));

  const spots = useMemo(() => {
    const fixed = Object.values(FIXED_SPOTS).map((f) => ({ x: f.x, z: f.z, r: 3.6 }));
    const blocked = (x: number, z: number) =>
      Math.abs(Math.hypot(x, z) - ROAD_RADIUS) < ROAD_WIDTH / 2 + 0.5 ||
      fixed.some((f) => Math.hypot(x - f.x, z - f.z) < f.r) ||
      placements.some((p) => Math.hypot(x - p.x, z - p.z) < (p.id === 'tree' ? 2 : p.id === 'pond' || p.id === 'cottage' ? 3.6 : 1.6) * p.size);
    const out: { x: number; z: number; s: number }[] = [];
    for (let i = 0; out.length < count && i < count * 3; i++) {
      const a = seeded(i + 2000) * Math.PI * 2;
      const r = 2.5 + Math.sqrt(seeded(i + 3000)) * (ISLAND_RADIUS - 4);
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (!blocked(x, z)) out.push({ x, z, s: 0.7 + seeded(i + 4000) * 0.6 });
    }
    return out;
  }, [count, placements]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const c = new THREE.Color();
    spots.forEach((f, i) => {
      m.compose(new THREE.Vector3(f.x, 0.32 * f.s, f.z), q, new THREE.Vector3(f.s, f.s, f.s));
      heads.current!.setMatrixAt(i, m);
      c.set(FLOWER_COLOURS[i % FLOWER_COLOURS.length]);
      heads.current!.setColorAt(i, c);
      m.compose(new THREE.Vector3(f.x, 0.15 * f.s, f.z), q, new THREE.Vector3(f.s, f.s, f.s));
      stems.current!.setMatrixAt(i, m);
    });
    heads.current!.count = spots.length;
    stems.current!.count = spots.length;
    heads.current!.instanceMatrix.needsUpdate = true;
    stems.current!.instanceMatrix.needsUpdate = true;
    if (heads.current!.instanceColor) heads.current!.instanceColor.needsUpdate = true;
  }, [spots]);

  // Grass tufts everywhere
  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (let i = 0; i < 500; i++) {
      const a = seeded(i + 6000) * Math.PI * 2;
      const r = Math.sqrt(seeded(i + 7000)) * (ISLAND_RADIUS - 1);
      const s = 0.6 + seeded(i + 8000) * 0.8;
      q.setFromEuler(new THREE.Euler(0, seeded(i) * 6, 0));
      m.compose(new THREE.Vector3(Math.cos(a) * r, 0.1 * s, Math.sin(a) * r), q, new THREE.Vector3(s, s, s));
      grass.current!.setMatrixAt(i, m);
    }
    grass.current!.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <group>
      <instancedMesh ref={heads} args={[undefined, undefined, 700]} castShadow>
        <icosahedronGeometry args={[0.1, 0]} />
        <meshStandardMaterial flatShading roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={stems} args={[undefined, undefined, 700]}>
        <cylinderGeometry args={[0.012, 0.012, 0.3, 3]} />
        <meshStandardMaterial color="#3F9142" />
      </instancedMesh>
      <instancedMesh ref={grass} args={[undefined, undefined, 500]}>
        <coneGeometry args={[0.06, 0.22, 3]} />
        <meshStandardMaterial color={season === 'winter' ? '#B8D4C4' : '#4FAE52'} flatShading />
      </instancedMesh>
    </group>
  );
};

/** Our love tree in the middle: grows with the garden level and carries hearts. */
export const LoveTree: React.FC<{ level: number; season: Season; place: Placement }> = ({ level, season, place }) => {
  const hearts = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    hearts.current?.children.forEach((c, i) => {
      c.rotation.y = clock.elapsedTime * 0.8 + i;
      c.position.y = (c.userData.y as number) + Math.sin(clock.elapsedTime * 1.5 + i) * 0.06;
    });
  });
  const s = 0.55 + Math.min(level, 9) * 0.1;
  const leaves = season === 'winter' ? ['#F8FAFC', '#E2E8F0', '#F1F5F9'] : season === 'autumn' ? ['#FB923C', '#F472B6', '#F59E0B'] : ['#F9A8D4', '#F472B6', '#86EFAC'];
  const blobs: [number, number, number, number][] = [
    [0, 3.6, 0, 1.6], [1.2, 3.2, 0.3, 1.1], [-1.2, 3.3, -0.2, 1.15], [0.3, 3.4, 1.1, 1], [-0.3, 3.5, -1.1, 1.05], [0, 4.6, 0, 1],
  ];
  const heartCount = Math.min(14, 2 + level * 1.5);
  return (
    <group position={[place.x, 0, place.z]} scale={s}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.3, 0.55, 2.8, 8]} />
        <Mat c={WOOD_DARK} />
      </mesh>
      {[-0.6, 0.7].map((x, i) => (
        <mesh key={x} position={[x * 0.6, 2.4, 0]} rotation={[0, 0, x > 0 ? -0.7 : 0.7]} castShadow>
          <cylinderGeometry args={[0.1, 0.18, 1.3, 6]} />
          <Mat c={i ? '#6B4226' : WOOD_DARK} />
        </mesh>
      ))}
      {blobs.map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow>
          <icosahedronGeometry args={[r, 1]} />
          <Mat c={leaves[i % 3]} />
        </mesh>
      ))}
      <group ref={hearts}>
        {Array.from({ length: Math.floor(heartCount) }, (_, i) => {
          const a = i * 2.4;
          const y = 3 + seeded(i + 50) * 1.8;
          const r = 1.3 + seeded(i + 70) * 0.5;
          return <Heart key={i} c={i % 2 ? '#E11D48' : '#FB7185'} glow position={[Math.cos(a) * r, y, Math.sin(a) * r]} userData={{ y }} scale={0.2} />;
        })}
      </group>
    </group>
  );
};

/** Drifting clouds, and rain on rainy days. */
export const Clouds: React.FC<{ weather: Weather; phase: Phase; center: React.RefObject<THREE.Vector3> }> = ({ weather, phase, center }) => {
  const clouds = useRef<THREE.Group>(null);
  const rain = useRef<THREE.InstancedMesh>(null);
  const drops = useMemo(() => Array.from({ length: 400 }, (_, i) => ({ x: (seeded(i) - 0.5) * 30, z: (seeded(i + 1) - 0.5) * 30, y: seeded(i + 2) * 14, v: 14 + seeded(i + 3) * 6 })), []);
  const tmp = useMemo(() => new THREE.Object3D(), []);
  const cloudCount = weather === 'clear' ? 5 : 12;

  useFrame((_, delta) => {
    if (clouds.current) clouds.current.rotation.y += delta * 0.01;
    if (rain.current && center.current) {
      const c = center.current;
      drops.forEach((d, i) => {
        d.y -= d.v * delta;
        if (d.y < 0) d.y += 14;
        tmp.position.set(c.x + d.x, c.y + d.y, c.z + d.z);
        tmp.updateMatrix();
        rain.current!.setMatrixAt(i, tmp.matrix);
      });
      rain.current.instanceMatrix.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={clouds}>
        {Array.from({ length: cloudCount }, (_, i) => {
          const a = (i / cloudCount) * Math.PI * 2;
          const r = 40 + seeded(i + 30) * 45;
          return (
            <group key={i} position={[Math.cos(a) * r, 32 + seeded(i + 60) * 10, Math.sin(a) * r]} scale={2.2 + seeded(i) * 1.8}>
              {[[0, 0, 0, 1.4], [1.3, -0.2, 0.2, 1], [-1.3, -0.3, 0, 1.05], [0.5, 0.6, -0.3, 0.9]].map(([x, y, z, rr], j) => (
                <mesh key={j} position={[x, y, z]}>
                  <icosahedronGeometry args={[rr, 1]} />
                  <meshStandardMaterial color={weather === 'rain' ? '#CBD5E1' : phase === 'night' ? '#4C4A7A' : '#FFFFFF'} flatShading roughness={1} />
                </mesh>
              ))}
            </group>
          );
        })}
      </group>
      {weather === 'rain' && (
        <instancedMesh ref={rain} args={[undefined, undefined, drops.length]}>
          <boxGeometry args={[0.02, 0.35, 0.02]} />
          <meshBasicMaterial color="#BFDBFE" transparent opacity={0.6} />
        </instancedMesh>
      )}
    </>
  );
};
