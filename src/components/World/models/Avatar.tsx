import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HEART, Mat } from './common';
import type { WorldPose } from '../worldData';
import type { EmoteKind } from '../worldState';

const HIP = 0.72;
const SKIN = '#F2C7A5';

export interface AvatarFrame extends WorldPose {
  moving: boolean;
}

interface AvatarProps {
  /** Read every frame, so moving never re-renders React */
  frame: () => AvatarFrame;
  emote: () => { kind: EmoteKind; until: number } | null;
  color: string;
  hair: string;
  name: string;
  /** Short hair (no ponytail) */
  short?: boolean;
  visible?: boolean;
}

/** A little white name pill that always faces the camera. */
const NameTag: React.FC<{ name: string }> = ({ name }) => {
  const texture = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d')!;
    g.font = '600 30px system-ui, sans-serif';
    const w = Math.min(244, g.measureText(name).width + 36);
    g.fillStyle = 'rgba(255,255,255,0.88)';
    g.beginPath();
    g.roundRect((256 - w) / 2, 8, w, 48, 24);
    g.fill();
    g.fillStyle = '#44403C';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(name, 128, 33, 220);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }, [name]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <sprite position={[0, 2.05, 0]} scale={[1, 0.25, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
};

const approach = (from: number, to: number, k: number) => from + (to - from) * k;

/** A little round-headed person built from simple shapes. */
export const Avatar: React.FC<AvatarProps> = ({ frame, emote, color, hair, name, short, visible = true }) => {
  const root = useRef<THREE.Group>(null);
  const pivot = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);
  const legL = useRef<THREE.Group>(null);
  const legR = useRef<THREE.Group>(null);
  const kneeL = useRef<THREE.Group>(null);
  const kneeR = useRef<THREE.Group>(null);
  const armL = useRef<THREE.Group>(null);
  const armR = useRef<THREE.Group>(null);
  const head = useRef<THREE.Group>(null);
  const hearts = useRef<THREE.Group>(null);
  const walk = useRef(0);

  useFrame((state, delta) => {
    const f = frame();
    const r = root.current;
    if (!r) return;
    const k = Math.min(1, delta * 10);
    r.position.set(f.x, f.y, f.z);
    // turn the short way round
    let d = f.ry - r.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    r.rotation.y += d * Math.min(1, delta * 12);

    const now = Date.now() / 1000;
    const e = emote();
    const emoting = e && e.until > now ? e.kind : null;
    const pose = f.moving ? 'walk' : f.pose;
    const seated = pose === 'sit' || pose === 'sitLow' || pose === 'lie';

    if (f.moving) walk.current += delta * 9;
    const swing = f.moving ? Math.sin(walk.current) * 0.7 : 0;

    // targets
    let legX = swing;
    let kneeX = f.moving ? Math.max(0, -Math.sin(walk.current)) * 0.6 : 0;
    let armLX = -swing * 0.8;
    let armRX = swing * 0.8;
    let armLZ = 0.08;
    let armRZ = -0.08;
    let pivotX = f.tilt;
    let bodyY = 0;
    if (pose === 'sit') {
      legX = -Math.PI / 2;
      kneeX = Math.PI / 2 + Math.sin(now * 2) * 0.06;
      armLX = -0.5;
      armRX = -0.5;
      bodyY = -HIP;
    } else if (pose === 'sitLow') {
      legX = -Math.PI / 2 + 0.1;
      kneeX = 0.15;
      armLX = 0.4;
      armRX = 0.4;
      armLZ = 0.35;
      armRZ = -0.35;
      bodyY = -HIP;
    } else if (pose === 'lie') {
      legX = 0;
      kneeX = 0.05;
      armLX = 0;
      armRX = 0;
      armLZ = 0.25;
      armRZ = -0.25;
      pivotX = -Math.PI / 2;
      bodyY = -HIP;
    }
    if (emoting === 'wave' && !f.moving) {
      armRZ = -2.6 + Math.sin(now * 12) * 0.35;
      armRX = 0;
    } else if (emoting === 'hug' && !seated) {
      armLX = -1.35;
      armRX = -1.35;
      armLZ = -0.35;
      armRZ = 0.35;
    }

    legL.current!.rotation.x = approach(legL.current!.rotation.x, legX, k);
    legR.current!.rotation.x = approach(legR.current!.rotation.x, seated ? legX : -legX, k);
    kneeL.current!.rotation.x = approach(kneeL.current!.rotation.x, kneeX, k);
    kneeR.current!.rotation.x = approach(kneeR.current!.rotation.x, seated ? kneeX : f.moving ? Math.max(0, Math.sin(walk.current)) * 0.6 : 0, k);
    armL.current!.rotation.x = approach(armL.current!.rotation.x, armLX, k);
    armR.current!.rotation.x = approach(armR.current!.rotation.x, armRX, k);
    armL.current!.rotation.z = approach(armL.current!.rotation.z, armLZ, k);
    armR.current!.rotation.z = approach(armR.current!.rotation.z, armRZ, k);
    pivot.current!.rotation.x = approach(pivot.current!.rotation.x, pivotX, k);
    body.current!.position.y = approach(body.current!.position.y, bodyY, k) + (f.moving ? Math.abs(Math.sin(walk.current)) * 0.05 : 0);
    head.current!.rotation.y = emoting === 'hearts' ? Math.sin(now * 3) * 0.25 : 0;

    // floating hearts while sending love (or hugging)
    const h = hearts.current!;
    h.visible = emoting === 'hearts' || emoting === 'hug';
    if (h.visible) {
      h.children.forEach((c, i) => {
        const p = (now * 0.6 + i / h.children.length) % 1;
        c.position.set(Math.sin(i * 2.4 + now) * 0.35, 1.7 + p * 1.3, Math.cos(i * 1.7) * 0.2);
        c.scale.setScalar(0.16 * Math.sin(p * Math.PI));
        c.rotation.y = now * 2 + i;
      });
    }
  });

  const leg = (ref: React.RefObject<THREE.Group | null>, knee: React.RefObject<THREE.Group | null>, x: number) => (
    <group ref={ref} position={[x, HIP, 0]}>
      <mesh position={[0, -0.18, 0]} castShadow>
        <capsuleGeometry args={[0.075, 0.22, 4, 8]} />
        <Mat c="#3F3D56" flat={false} />
      </mesh>
      <group ref={knee} position={[0, -0.36, 0]}>
        <mesh position={[0, -0.16, 0]} castShadow>
          <capsuleGeometry args={[0.065, 0.2, 4, 8]} />
          <Mat c={SKIN} flat={false} />
        </mesh>
        <mesh position={[0, -0.33, 0.05]} castShadow>
          <boxGeometry args={[0.13, 0.08, 0.22]} />
          <Mat c="#FFFFFF" />
        </mesh>
      </group>
    </group>
  );

  const arm = (ref: React.RefObject<THREE.Group | null>, x: number) => (
    <group ref={ref} position={[x, 1.2, 0]}>
      <mesh position={[0, -0.22, 0]} castShadow>
        <capsuleGeometry args={[0.06, 0.32, 4, 8]} />
        <Mat c={color} flat={false} />
      </mesh>
      <mesh position={[0, -0.45, 0]} castShadow>
        <sphereGeometry args={[0.065, 10, 8]} />
        <Mat c={SKIN} flat={false} />
      </mesh>
    </group>
  );

  return (
    <group ref={root} visible={visible}>
      <group ref={pivot}>
        <group ref={body}>
          {leg(legL, kneeL, -0.1)}
          {leg(legR, kneeR, 0.1)}
          {/* body */}
          <mesh position={[0, 0.98, 0]} castShadow>
            <capsuleGeometry args={[0.2, 0.26, 6, 12]} />
            <Mat c={color} flat={false} rough={0.7} />
          </mesh>
          <mesh position={[0, 0.82, 0]} castShadow>
            <cylinderGeometry args={[0.21, 0.24, 0.16, 12]} />
            <Mat c="#3F3D56" flat={false} />
          </mesh>
          {arm(armL, -0.27)}
          {arm(armR, 0.27)}
          {/* head */}
          <group ref={head} position={[0, 1.5, 0]}>
            <mesh castShadow>
              <sphereGeometry args={[0.24, 20, 16]} />
              <Mat c={SKIN} flat={false} rough={0.6} />
            </mesh>
            {/* hair cap */}
            <mesh position={[0, 0.03, -0.02]} rotation={[-0.25, 0, 0]} castShadow>
              <sphereGeometry args={[0.255, 20, 12, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
              <Mat c={hair} flat={false} rough={0.5} />
            </mesh>
            {!short && (
              <mesh position={[0, -0.05, -0.24]} castShadow>
                <sphereGeometry args={[0.12, 12, 10]} />
                <Mat c={hair} flat={false} rough={0.5} />
              </mesh>
            )}
            {[-0.085, 0.085].map((x) => (
              <mesh key={x} position={[x, -0.01, 0.215]}>
                <sphereGeometry args={[0.032, 8, 8]} />
                <meshStandardMaterial color="#1F1A2E" roughness={0.2} />
              </mesh>
            ))}
            {[-0.14, 0.14].map((x) => (
              <mesh key={x} position={[x, -0.08, 0.19]}>
                <sphereGeometry args={[0.04, 8, 6]} />
                <meshStandardMaterial color="#FB7185" transparent opacity={0.45} />
              </mesh>
            ))}
            <mesh position={[0, -0.1, 0.225]} rotation={[0, 0, Math.PI]}>
              <torusGeometry args={[0.035, 0.01, 6, 10, Math.PI]} />
              <meshStandardMaterial color="#9F1239" />
            </mesh>
          </group>
        </group>
      </group>
      <group ref={hearts}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh key={i} geometry={HEART}>
            <Mat c={i % 2 ? '#FB7185' : '#F43F5E'} flat={false} glow="#F43F5E" glowStrength={0.4} />
          </mesh>
        ))}
      </group>
      <NameTag name={name} />
    </group>
  );
};
