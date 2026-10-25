import React, { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { HEART, Mat } from './common';
import type { WorldPose } from '../worldData';
import type { EmoteKind } from '../worldState';
import type { Look } from '../wardrobe';

const HIP = 0.72;

export interface AvatarFrame extends WorldPose {
  moving: boolean;
}

interface AvatarProps {
  /** Read every frame, so moving never re-renders React */
  frame: () => AvatarFrame;
  emote: () => { kind: EmoteKind; until: number } | null;
  look: Look;
  name: string;
  visible?: boolean;
}

const approach = (from: number, to: number, k: number) => from + (to - from) * k;
const shade = (c: string, k: number) => `#${new THREE.Color(c).multiplyScalar(k).getHexString()}`;

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
    <sprite position={[0, 2.12, 0]} scale={[1, 0.25, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
};

const Part: React.FC<{ p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number]; c: string; children: React.ReactNode; rough?: number }> = ({ p, r, s, c, children, rough = 0.7 }) => (
  <mesh position={p} rotation={r} scale={s} castShadow>
    {children}
    <Mat c={c} flat={false} rough={rough} />
  </mesh>
);

/** Hair on top of the head (head centre is 0,0,0, radius 0.24). */
const Hair: React.FC<{ style: string; c: string; hat: string }> = ({ style, c, hat }) => {
  const capped = hat === 'cap' || hat === 'beanie';
  const cap = (
    <Part p={[0, 0.03, -0.02]} r={[-0.25, 0, 0]} c={c} rough={0.5}>
      <sphereGeometry args={[0.255, 20, 12, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
    </Part>
  );
  switch (style) {
    case 'ponytail':
      return (
        <>
          {cap}
          <Part p={[0, 0.02, -0.25]} c={c} rough={0.5}><sphereGeometry args={[0.1, 12, 10]} /></Part>
          <Part p={[0, -0.14, -0.29]} s={[0.8, 1.6, 0.8]} c={c} rough={0.5}><sphereGeometry args={[0.09, 12, 10]} /></Part>
        </>
      );
    case 'long':
      return (
        <>
          {cap}
          <Part p={[0, -0.2, -0.1]} s={[1, 1, 0.55]} c={c} rough={0.5}><capsuleGeometry args={[0.24, 0.3, 4, 14]} /></Part>
        </>
      );
    case 'bob':
      return (
        <>
          {cap}
          <Part p={[0, -0.06, -0.03]} s={[1.12, 0.75, 1.05]} c={c} rough={0.5}><sphereGeometry args={[0.25, 18, 12, 0, Math.PI * 2, Math.PI / 3, Math.PI / 2.4]} /></Part>
        </>
      );
    case 'buns':
      return (
        <>
          {cap}
          {!capped && [-0.15, 0.15].map((x) => (
            <Part key={x} p={[x, 0.24, -0.04]} c={c} rough={0.5}><sphereGeometry args={[0.095, 12, 10]} /></Part>
          ))}
        </>
      );
    case 'curly':
      return (
        <>
          {cap}
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i / 14) * Math.PI * 2;
            return (
              <Part key={i} p={[Math.cos(a) * 0.22, 0.08 + Math.sin(i * 1.7) * 0.06, Math.sin(a) * 0.2 - 0.04]} c={c} rough={0.5}>
                <sphereGeometry args={[0.07, 8, 6]} />
              </Part>
            );
          })}
          {!capped && <Part p={[0, 0.22, -0.03]} c={c} rough={0.5}><sphereGeometry args={[0.12, 10, 8]} /></Part>}
        </>
      );
    case 'spiky':
      return (
        <>
          {cap}
          {!capped && Array.from({ length: 7 }, (_, i) => {
            const a = (i / 7) * Math.PI * 2;
            return (
              <Part key={i} p={[Math.cos(a) * 0.12, 0.24, Math.sin(a) * 0.12 - 0.03]} r={[Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5]} c={c} rough={0.5}>
                <coneGeometry args={[0.05, 0.14, 5]} />
              </Part>
            );
          })}
        </>
      );
    default:
      return cap;
  }
};

const Hat: React.FC<{ id: string; hair: string }> = ({ id, hair }) => {
  switch (id) {
    case 'cap':
      return (
        <group position={[0, 0.07, 0]}>
          <Part c="#EF4444"><sphereGeometry args={[0.262, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></Part>
          <Part p={[0, 0.0, 0.24]} r={[0.15, 0, 0]} c="#B91C1C"><boxGeometry args={[0.3, 0.025, 0.2]} /></Part>
        </group>
      );
    case 'beanie':
      return (
        <group position={[0, 0.06, 0]}>
          <Part s={[1, 1.15, 1]} c="#A78BFA"><sphereGeometry args={[0.262, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} /></Part>
          <Part p={[0, 0.0, 0]} c="#C4B5FD"><cylinderGeometry args={[0.266, 0.266, 0.07, 18]} /></Part>
          <Part p={[0, 0.32, 0]} c="#FFFFFF"><sphereGeometry args={[0.06, 10, 8]} /></Part>
        </group>
      );
    case 'bow':
      return (
        <group position={[0.15, 0.2, -0.05]} rotation={[0, 0, -0.4]}>
          {[-1, 1].map((d) => (
            <Part key={d} p={[d * 0.08, 0, 0]} r={[0, 0, (d * Math.PI) / 2]} c="#F43F5E"><coneGeometry args={[0.07, 0.15, 8]} /></Part>
          ))}
          <Part c="#BE123C"><sphereGeometry args={[0.035, 8, 6]} /></Part>
        </group>
      );
    case 'flowers':
      return (
        <group position={[0, 0.13, -0.02]} rotation={[-0.2, 0, 0]}>
          {Array.from({ length: 12 }, (_, i) => {
            const a = (i / 12) * Math.PI * 2;
            return (
              <Part key={i} p={[Math.cos(a) * 0.235, 0, Math.sin(a) * 0.235]} c={['#F472B6', '#FDE047', '#FFFFFF', '#A78BFA'][i % 4]}>
                <sphereGeometry args={[0.045, 8, 6]} />
              </Part>
            );
          })}
        </group>
      );
    case 'catears':
      return (
        <>
          {[-0.14, 0.14].map((x) => (
            <group key={x} position={[x, 0.22, -0.02]} rotation={[0, 0, x > 0 ? -0.3 : 0.3]}>
              <Part c={hair}><coneGeometry args={[0.07, 0.15, 4]} /></Part>
              <Part p={[0, -0.01, 0.02]} s={[0.55, 0.6, 0.4]} c="#FBCFE8"><coneGeometry args={[0.07, 0.15, 4]} /></Part>
            </group>
          ))}
        </>
      );
    case 'headphones':
      return (
        <>
          <Part p={[0, 0.04, 0]} r={[0, Math.PI / 2, 0]} c="#1F2937"><torusGeometry args={[0.27, 0.025, 6, 20, Math.PI]} /></Part>
          {[-0.26, 0.26].map((x) => (
            <Part key={x} p={[x, 0, 0]} r={[0, 0, Math.PI / 2]} c="#F472B6"><cylinderGeometry args={[0.08, 0.08, 0.06, 14]} /></Part>
          ))}
        </>
      );
    case 'crown':
      return (
        <group position={[0, 0.25, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.15, 0.14, 0.09, 10, 1, true]} />
            <meshStandardMaterial color="#FBBF24" metalness={0.6} roughness={0.3} side={THREE.DoubleSide} />
          </mesh>
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2;
            return (
              <group key={i} position={[Math.cos(a) * 0.145, 0.08, Math.sin(a) * 0.145]}>
                <mesh>
                  <coneGeometry args={[0.03, 0.08, 4]} />
                  <meshStandardMaterial color="#FBBF24" metalness={0.6} roughness={0.3} />
                </mesh>
                <mesh position={[0, -0.06, 0]}>
                  <sphereGeometry args={[0.018, 6, 6]} />
                  <meshStandardMaterial color={i % 2 ? '#F43F5E' : '#60A5FA'} />
                </mesh>
              </group>
            );
          })}
        </group>
      );
    default:
      return null;
  }
};

const Glasses: React.FC<{ id: string }> = ({ id }) => {
  if (id === 'none') return null;
  if (id === 'heart') {
    return (
      <>
        {[-0.09, 0.09].map((x) => (
          <mesh key={x} geometry={HEART} position={[x, 0, 0.23]} scale={0.085}>
            <meshStandardMaterial color="#F43F5E" transparent opacity={0.85} />
          </mesh>
        ))}
      </>
    );
  }
  if (id === 'sun') {
    return (
      <>
        {[-0.09, 0.09].map((x) => (
          <mesh key={x} position={[x, 0, 0.225]}>
            <boxGeometry args={[0.13, 0.08, 0.02]} />
            <meshStandardMaterial color="#111827" roughness={0.1} metalness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 0.02, 0.23]}>
          <boxGeometry args={[0.06, 0.015, 0.015]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      </>
    );
  }
  return (
    <>
      {[-0.09, 0.09].map((x) => (
        <mesh key={x} position={[x, 0, 0.225]}>
          <torusGeometry args={[0.055, 0.01, 6, 16]} />
          <meshStandardMaterial color="#78350F" />
        </mesh>
      ))}
      <mesh position={[0, 0.01, 0.23]}>
        <boxGeometry args={[0.05, 0.012, 0.012]} />
        <meshStandardMaterial color="#78350F" />
      </mesh>
    </>
  );
};

/** A little round-headed person built from simple shapes, dressed in their look. */
export const Avatar: React.FC<AvatarProps> = ({ frame, emote, look, name, visible = true }) => {
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
  const wings = useRef<THREE.Group>(null);
  const walk = useRef(0);
  const pedal = useRef(0);

  useFrame((_, delta) => {
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
    const seated = pose === 'sit' || pose === 'sitLow' || pose === 'lie' || pose === 'swing' || pose === 'pedal';

    if (f.moving) walk.current += delta * 9;
    const swing = f.moving ? Math.sin(walk.current) * 0.7 : 0;

    let legLX = swing;
    let legRX = -swing;
    let kneeLX = f.moving ? Math.max(0, -Math.sin(walk.current)) * 0.6 : 0;
    let kneeRX = f.moving ? Math.max(0, Math.sin(walk.current)) * 0.6 : 0;
    let armLX = -swing * 0.8;
    let armRX = swing * 0.8;
    let armLZ = 0.08;
    let armRZ = -0.08;
    let pivotX = f.tilt;
    let bodyY = 0;
    if (pose === 'sit' || pose === 'swing') {
      legLX = legRX = -Math.PI / 2;
      kneeLX = kneeRX = Math.PI / 2 + Math.sin(now * 2) * 0.06;
      armLX = armRX = -0.5;
      bodyY = -HIP;
      if (pose === 'swing') {
        // hands up on the ropes, legs kick with the swing
        armLX = armRX = -2.75;
        armLZ = -0.22;
        armRZ = 0.22;
        kneeLX = kneeRX = Math.PI / 2 - f.tilt * 1.2;
      }
    } else if (pose === 'pedal') {
      pedal.current += delta * 6;
      const p = pedal.current;
      legLX = -1.05 + Math.sin(p) * 0.35;
      legRX = -1.05 - Math.sin(p) * 0.35;
      kneeLX = 1.15 + Math.cos(p) * 0.35;
      kneeRX = 1.15 - Math.cos(p) * 0.35;
      armLX = armRX = -1.25;
      armLZ = -0.12;
      armRZ = 0.12;
      pivotX = 0.15;
      bodyY = -HIP;
    } else if (pose === 'sitLow') {
      legLX = legRX = -Math.PI / 2 + 0.1;
      kneeLX = kneeRX = 0.15;
      armLX = armRX = 0.4;
      armLZ = 0.35;
      armRZ = -0.35;
      bodyY = -HIP;
    } else if (pose === 'lie') {
      legLX = legRX = 0;
      kneeLX = kneeRX = 0.05;
      armLX = armRX = 0;
      armLZ = 0.25;
      armRZ = -0.25;
      pivotX = -Math.PI / 2;
      bodyY = -HIP;
    }
    if (emoting === 'wave' && pose !== 'swing' && pose !== 'pedal') {
      armRZ = -2.6 + Math.sin(now * 12) * 0.35;
      armRX = 0;
    } else if (emoting === 'hug' && !seated) {
      armLX = armRX = -1.35;
      armLZ = -0.35;
      armRZ = 0.35;
    }

    legL.current!.rotation.x = approach(legL.current!.rotation.x, legLX, k);
    legR.current!.rotation.x = approach(legR.current!.rotation.x, legRX, k);
    kneeL.current!.rotation.x = approach(kneeL.current!.rotation.x, kneeLX, k);
    kneeR.current!.rotation.x = approach(kneeR.current!.rotation.x, kneeRX, k);
    armL.current!.rotation.x = approach(armL.current!.rotation.x, armLX, k);
    armR.current!.rotation.x = approach(armR.current!.rotation.x, armRX, k);
    armL.current!.rotation.z = approach(armL.current!.rotation.z, armLZ, k);
    armR.current!.rotation.z = approach(armR.current!.rotation.z, armRZ, k);
    // the swing tilts us exactly with the seat, no lag
    pivot.current!.rotation.x = pose === 'swing' ? pivotX : approach(pivot.current!.rotation.x, pivotX, k);
    body.current!.position.y = approach(body.current!.position.y, bodyY, k) + (f.moving ? Math.abs(Math.sin(walk.current)) * 0.05 : 0);
    head.current!.rotation.y = emoting === 'hearts' ? Math.sin(now * 3) * 0.25 : 0;
    if (wings.current) wings.current.children.forEach((w, i) => (w.rotation.y = (i ? -1 : 1) * (0.5 + Math.sin(now * 3) * 0.25)));

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

  const skin = look.skin;
  const dress = look.top === 'dress';
  const legsCovered = !dress && (look.bottom === 'pants' || look.bottom === 'jeans');
  const thighCovered = legsCovered || (!dress && look.bottom === 'shorts');
  const bottomColor = look.bottom === 'jeans' && look.bottomColor === '#FFFFFF' ? '#3B6CB7' : look.bottomColor;
  const longSleeves = ['shirt', 'hoodie', 'sweater', 'jacket'].includes(look.top);
  const sleeveless = look.top === 'tank' || dress;

  const leg = (ref: React.RefObject<THREE.Group | null>, knee: React.RefObject<THREE.Group | null>, x: number) => (
    <group ref={ref} position={[x, HIP, 0]}>
      <Part p={[0, -0.18, 0]} c={thighCovered ? bottomColor : skin}><capsuleGeometry args={[0.078, 0.22, 4, 8]} /></Part>
      <group ref={knee} position={[0, -0.36, 0]}>
        <Part p={[0, -0.16, 0]} c={legsCovered ? bottomColor : skin}><capsuleGeometry args={[0.068, 0.2, 4, 8]} /></Part>
        {look.shoes === 'boots' && <Part p={[0, -0.24, 0.01]} c={look.shoesColor}><cylinderGeometry args={[0.085, 0.085, 0.2, 10]} /></Part>}
        <Part p={[0, -0.33, 0.05]} c={look.shoes === 'sandals' ? skin : look.shoesColor}><boxGeometry args={[0.13, 0.08, 0.22]} /></Part>
        <Part p={[0, -0.37, 0.05]} c={look.shoes === 'sandals' ? '#92400E' : '#F5F5F4'}><boxGeometry args={[0.14, 0.03, 0.23]} /></Part>
      </group>
    </group>
  );

  const arm = (ref: React.RefObject<THREE.Group | null>, x: number) => (
    <group ref={ref} position={[x, 1.2, 0]}>
      <Part p={[0, -0.22, 0]} c={longSleeves ? look.topColor : skin}><capsuleGeometry args={[0.06, 0.32, 4, 8]} /></Part>
      {!longSleeves && !sleeveless && <Part p={[0, -0.06, 0]} c={look.topColor}><cylinderGeometry args={[0.085, 0.08, 0.16, 10]} /></Part>}
      {look.top === 'sweater' && <Part p={[0, -0.38, 0]} c={shade(look.topColor, 0.85)}><cylinderGeometry args={[0.068, 0.068, 0.06, 10]} /></Part>}
      <Part p={[0, -0.45, 0]} c={skin}><sphereGeometry args={[0.065, 10, 8]} /></Part>
    </group>
  );

  return (
    <group ref={root} visible={visible}>
      <group ref={pivot}>
        <group ref={body}>
          {leg(legL, kneeL, -0.1)}
          {leg(legR, kneeR, 0.1)}
          {/* body */}
          <Part p={[0, 0.98, 0]} c={look.top === 'tank' ? look.topColor : look.topColor}><capsuleGeometry args={[0.2, 0.26, 6, 12]} /></Part>
          <Part p={[0, 0.82, 0]} c={dress ? look.topColor : bottomColor}><cylinderGeometry args={[0.21, 0.24, 0.16, 12]} /></Part>
          <Part p={[0, 1.33, 0]} c={skin}><cylinderGeometry args={[0.07, 0.08, 0.1, 10]} /></Part>
          {/* skirts and dresses */}
          {dress && <Part p={[0, 0.6, 0]} c={look.topColor}><cylinderGeometry args={[0.22, 0.4, 0.46, 16, 1, true]} /></Part>}
          {!dress && look.bottom === 'skirt' && <Part p={[0, 0.68, 0]} c={bottomColor}><cylinderGeometry args={[0.22, 0.34, 0.3, 16, 1, true]} /></Part>}
          {/* top details */}
          {look.top === 'shirt' && (
            <>
              <Part p={[0, 1.28, 0.02]} r={[Math.PI / 2 - 0.3, 0, 0]} c="#FFFFFF"><torusGeometry args={[0.1, 0.03, 6, 14]} /></Part>
              {[1.12, 1.02, 0.92].map((y) => (
                <Part key={y} p={[0, y, 0.205]} c="#FFFFFF"><sphereGeometry args={[0.018, 6, 6]} /></Part>
              ))}
            </>
          )}
          {look.top === 'hoodie' && (
            <>
              <Part p={[0, 1.3, -0.14]} s={[1, 0.8, 0.8]} c={shade(look.topColor, 0.9)}><sphereGeometry args={[0.17, 12, 10]} /></Part>
              <Part p={[0, 0.9, 0.19]} c={shade(look.topColor, 0.88)}><boxGeometry args={[0.24, 0.12, 0.04]} /></Part>
              {[-0.05, 0.05].map((x) => (
                <Part key={x} p={[x, 1.17, 0.2]} c="#FFFFFF"><cylinderGeometry args={[0.008, 0.008, 0.14, 4]} /></Part>
              ))}
            </>
          )}
          {look.top === 'sweater' && <Part p={[0, 0.78, 0]} c={shade(look.topColor, 0.85)}><cylinderGeometry args={[0.215, 0.215, 0.07, 14]} /></Part>}
          {look.top === 'jacket' && (
            <>
              <Part p={[0, 1.0, 0.19]} c="#FFFFFF"><boxGeometry args={[0.1, 0.4, 0.04]} /></Part>
              {[-0.09, 0.09].map((x) => (
                <Part key={x} p={[x, 1.15, 0.18]} r={[0, 0, x > 0 ? -0.3 : 0.3]} c={shade(look.topColor, 0.75)}><boxGeometry args={[0.06, 0.2, 0.04]} /></Part>
              ))}
            </>
          )}
          {dress && [-0.1, 0.1].map((x) => (
            <Part key={x} p={[x, 1.22, 0]} c={look.topColor}><boxGeometry args={[0.05, 0.08, 0.3]} /></Part>
          ))}
          {/* extras */}
          {look.extra === 'scarf' && (
            <>
              <Part p={[0, 1.29, 0]} r={[Math.PI / 2, 0, 0]} c="#EF4444"><torusGeometry args={[0.13, 0.05, 8, 16]} /></Part>
              <Part p={[0.08, 1.12, 0.17]} r={[0.1, 0, 0.1]} c="#EF4444"><boxGeometry args={[0.08, 0.26, 0.04]} /></Part>
            </>
          )}
          {look.extra === 'backpack' && (
            <>
              <Part p={[0, 1.0, -0.26]} c="#F59E0B"><boxGeometry args={[0.3, 0.36, 0.14]} /></Part>
              <Part p={[0, 0.92, -0.34]} c="#D97706"><boxGeometry args={[0.2, 0.14, 0.04]} /></Part>
            </>
          )}
          {look.extra === 'cape' && (
            <mesh position={[0, 0.85, -0.24]} rotation={[0.12, 0, 0]} castShadow>
              <planeGeometry args={[0.5, 0.95]} />
              <meshStandardMaterial color="#DC2626" side={THREE.DoubleSide} roughness={0.6} />
            </mesh>
          )}
          {look.extra === 'wings' && (
            <group ref={wings} position={[0, 1.1, -0.22]}>
              {[-1, 1].map((d) => (
                <group key={d}>
                  <mesh position={[d * 0.3, 0.05, -0.05]} scale={[0.32, 0.45, 0.05]}>
                    <sphereGeometry args={[1, 14, 10]} />
                    <meshStandardMaterial color="#FFFFFF" emissive="#FDF2F8" emissiveIntensity={0.3} roughness={0.4} />
                  </mesh>
                </group>
              ))}
            </group>
          )}
          {arm(armL, -0.27)}
          {arm(armR, 0.27)}
          {/* head */}
          <group ref={head} position={[0, 1.55, 0]}>
            <Part c={skin} rough={0.6}><sphereGeometry args={[0.24, 20, 16]} /></Part>
            <Hair style={look.hair} c={look.hairColor} hat={look.hat} />
            <Hat id={look.hat} hair={look.hairColor} />
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
            <Glasses id={look.glasses} />
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
