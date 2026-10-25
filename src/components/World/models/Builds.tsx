import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Heart, Mat, STONE, WOOD, WOOD_DARK, WOOD_LIGHT } from './common';
import { live } from '../worldState';
import { boatAt, now, swingAngle, SWING_PIVOT, SWING_ROPE, TREEHOUSE_HEIGHT } from '../worldData';

export interface BuildProps {
  night: boolean;
  /** Someone is using it (the swing swings) */
  busy?: boolean;
}

const Box: React.FC<{ s: [number, number, number]; p?: [number, number, number]; r?: [number, number, number]; c: string; glow?: string | false }> = ({ s, p, r, c, glow }) => (
  <mesh position={p} rotation={r} castShadow receiveShadow>
    <boxGeometry args={s} />
    <Mat c={c} glow={glow} />
  </mesh>
);

const Cyl: React.FC<{ a: [number, number, number, number?]; p?: [number, number, number]; r?: [number, number, number]; c: string; glow?: string | false }> = ({ a, p, r, c, glow }) => (
  <mesh position={p} rotation={r} castShadow receiveShadow>
    <cylinderGeometry args={[a[0], a[1], a[2], a[3] ?? 10]} />
    <Mat c={c} glow={glow} />
  </mesh>
);

const Ball: React.FC<{ r: number; p?: [number, number, number]; s?: [number, number, number]; c: string; glow?: string | false; d?: number }> = ({ r, p, s, c, glow, d = 1 }) => (
  <mesh position={p} scale={s} castShadow>
    <icosahedronGeometry args={[r, d]} />
    <Mat c={c} glow={glow} />
  </mesh>
);

/** Spin a group every frame */
function useSpin(fn: (g: THREE.Group, t: number) => void) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => ref.current && fn(ref.current, now()));
  return ref;
}

const Mailbox: React.FC<BuildProps> = () => (
  <group>
    <Box s={[0.1, 1, 0.1]} p={[0, 0.5, 0]} c={WOOD} />
    <Box s={[0.42, 0.32, 0.55]} p={[0, 1.12, 0]} c="#F9A8D4" />
    <Cyl a={[0.21, 0.21, 0.55, 12]} p={[0, 1.28, 0]} r={[Math.PI / 2, 0, 0]} c="#F9A8D4" />
    <Box s={[0.04, 0.3, 0.06]} p={[0.24, 1.35, 0.1]} c="#E11D48" />
    <Heart c="#E11D48" position={[0, 1.15, 0.29]} scale={0.14} />
  </group>
);

const Bench: React.FC<BuildProps> = () => (
  <group>
    <Box s={[1.7, 0.08, 0.5]} p={[0, 0.45, 0]} c={WOOD} />
    <Box s={[1.7, 0.4, 0.07]} p={[0, 0.75, -0.25]} r={[-0.12, 0, 0]} c={WOOD} />
    {[-0.75, 0.75].flatMap((x) => [
      <Box key={`${x}a`} s={[0.08, 0.45, 0.08]} p={[x, 0.22, 0.18]} c={WOOD_DARK} />,
      <Box key={`${x}b`} s={[0.08, 0.9, 0.08]} p={[x, 0.45, -0.22]} c={WOOD_DARK} />,
    ])}
    {[-0.4, 0.4].map((x) => (
      <Box key={x} s={[0.6, 0.06, 0.42]} p={[x, 0.52, 0.02]} c="#FBCFE8" />
    ))}
  </group>
);

const Picnic: React.FC<BuildProps> = () => (
  <group>
    {Array.from({ length: 6 * 4 }, (_, i) => {
      const cx = i % 6;
      const cz = Math.floor(i / 6);
      return <Box key={i} s={[0.36, 0.02, 0.36]} p={[-0.9 + cx * 0.36, 0.01, -0.54 + cz * 0.36]} c={(cx + cz) % 2 ? '#FFFFFF' : '#F87171'} />;
    })}
    <Box s={[0.42, 0.28, 0.3]} p={[0, 0.16, -0.3]} c={WOOD_LIGHT} />
    <mesh position={[0, 0.3, -0.3]} castShadow>
      <torusGeometry args={[0.16, 0.02, 6, 16, Math.PI]} />
      <Mat c={WOOD_DARK} />
    </mesh>
    {[-0.25, 0.25].map((x) => (
      <Cyl key={x} a={[0.05, 0.03, 0.18, 8]} p={[x, 0.1, 0.25]} c="#FDE68A" />
    ))}
    <Ball r={0.07} p={[0.1, 0.07, 0.4]} c="#EF4444" />
  </group>
);

const Lanterns: React.FC<BuildProps> = ({ night }) => (
  <group>
    {Array.from({ length: 6 }, (_, i) => (
      <Cyl key={`s${i}`} a={[0.35, 0.38, 0.05, 8]} p={[0, 0.02, -2.5 + i]} c={STONE} />
    ))}
    {[-0.9, 0.9].flatMap((x) =>
      [-2, 0, 2].map((z) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <Cyl a={[0.04, 0.05, 1.1, 6]} p={[0, 0.55, 0]} c={WOOD_DARK} />
          <Box s={[0.26, 0.32, 0.26]} p={[0, 1.25, 0]} c="#FDBA74" glow={night ? '#FB923C' : false} />
          <mesh position={[0, 1.47, 0]} castShadow>
            <coneGeometry args={[0.22, 0.14, 4]} />
            <Mat c="#B91C1C" />
          </mesh>
        </group>
      ))
    )}
    {night && <pointLight position={[0, 1.6, 0]} color="#FDBA74" intensity={6} distance={7} />}
  </group>
);

const Mushrooms: React.FC<BuildProps> = ({ night }) => (
  <group>
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      const s = 0.7 + (i % 3) * 0.2;
      return (
        <group key={i} position={[Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1]} scale={s}>
          <Cyl a={[0.06, 0.08, 0.3, 6]} p={[0, 0.15, 0]} c="#FFF7ED" />
          <mesh position={[0, 0.3, 0]} castShadow>
            <sphereGeometry args={[0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <Mat c={i % 2 ? '#F43F5E' : '#C084FC'} glow={night ? (i % 2 ? '#FB7185' : '#A78BFA') : false} glowStrength={0.9} />
          </mesh>
          <Ball r={0.035} p={[0.08, 0.45, 0.05]} c="#FFFFFF" d={0} />
        </group>
      );
    })}
  </group>
);

const Bunny: React.FC<{ c: string; phase: number }> = ({ c, phase }) => {
  const ref = useSpin((g, t) => {
    const h = Math.max(0, Math.sin(t * 3 + phase));
    g.position.y = h * h * 0.18;
  });
  return (
    <group ref={ref}>
      <Ball r={0.22} p={[0, 0.22, 0]} s={[1, 0.9, 1.2]} c={c} />
      <Ball r={0.15} p={[0, 0.42, 0.2]} c={c} />
      {[-0.06, 0.06].map((x) => (
        <Ball key={x} r={0.05} p={[x, 0.62, 0.17]} s={[0.8, 2.6, 0.6]} c={c} />
      ))}
      <Ball r={0.07} p={[0, 0.25, -0.27]} c="#FFFFFF" />
      {[-0.06, 0.06].map((x) => (
        <Ball key={x} r={0.02} p={[x, 0.45, 0.34]} c="#1F1A2E" d={0} />
      ))}
    </group>
  );
};

const Bunnies: React.FC<BuildProps> = () => (
  <group>
    <group position={[-0.25, 0, 0]} rotation={[0, 0.4, 0]}>
      <Bunny c="#FFFFFF" phase={0} />
    </group>
    <group position={[0.25, 0, 0]} rotation={[0, -0.4, 0]}>
      <Bunny c="#E7D3C1" phase={1.3} />
    </group>
  </group>
);

const Pets: React.FC<BuildProps> = () => {
  const tail = useSpin((g, t) => (g.rotation.z = Math.sin(t * 8) * 0.6));
  const catTail = useSpin((g, t) => (g.rotation.x = -0.6 + Math.sin(t * 2) * 0.3));
  return (
    <group>
      {/* kitty */}
      <group position={[-0.35, 0, 0]} rotation={[0, 0.3, 0]}>
        <Ball r={0.22} p={[0, 0.22, 0]} s={[0.9, 0.9, 1.25]} c="#FDBA74" />
        <Ball r={0.17} p={[0, 0.45, 0.22]} c="#FDBA74" />
        {[-0.09, 0.09].map((x) => (
          <mesh key={x} position={[x, 0.62, 0.22]} castShadow>
            <coneGeometry args={[0.06, 0.12, 4]} />
            <Mat c="#FB923C" />
          </mesh>
        ))}
        <group ref={catTail} position={[0, 0.3, -0.25]}>
          <Cyl a={[0.03, 0.04, 0.4, 6]} p={[0, 0.2, 0]} c="#FB923C" />
        </group>
        {[-0.06, 0.06].map((x) => (
          <Ball key={x} r={0.022} p={[x, 0.48, 0.37]} c="#1F1A2E" d={0} />
        ))}
      </group>
      {/* puppy */}
      <group position={[0.4, 0, 0]} rotation={[0, -0.3, 0]}>
        <Ball r={0.25} p={[0, 0.26, 0]} s={[0.9, 0.9, 1.3]} c="#B45309" />
        <Ball r={0.19} p={[0, 0.52, 0.25]} c="#D97706" />
        <Ball r={0.08} p={[0, 0.47, 0.42]} c="#FDE68A" />
        {[-0.15, 0.15].map((x) => (
          <Ball key={x} r={0.07} p={[x, 0.5, 0.2]} s={[0.6, 1.6, 0.8]} c="#78350F" />
        ))}
        <group ref={tail} position={[0, 0.35, -0.3]}>
          <Cyl a={[0.03, 0.04, 0.25, 6]} p={[0, 0.12, 0]} c="#B45309" />
        </group>
        {[-0.07, 0.07].map((x) => (
          <Ball key={x} r={0.024} p={[x, 0.56, 0.42]} c="#1F1A2E" d={0} />
        ))}
      </group>
    </group>
  );
};

const Swing: React.FC<BuildProps> = ({ busy }) => {
  const seat = useSpin((g, t) => {
    g.rotation.x = busy ? swingAngle(t) : Math.sin(t * 1.2) * 0.04;
  });
  return (
    <group>
      {[-1.1, 1.1].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          {/* A-frame: feet apart on the ground, tops meeting at the crossbar */}
          <Cyl a={[0.06, 0.07, 2.7, 6]} p={[0, 1.3, 0.45]} r={[-0.33, 0, 0]} c={WOOD_DARK} />
          <Cyl a={[0.06, 0.07, 2.7, 6]} p={[0, 1.3, -0.45]} r={[0.33, 0, 0]} c={WOOD_DARK} />
        </group>
      ))}
      <Cyl a={[0.07, 0.07, 2.5, 8]} p={[0, SWING_PIVOT + 0.05, 0]} r={[0, 0, Math.PI / 2]} c={WOOD} />
      <group ref={seat} position={[0, SWING_PIVOT, 0]}>
        {[-0.65, 0.65].map((x) => (
          <Cyl key={x} a={[0.015, 0.015, SWING_ROPE, 4]} p={[x, -SWING_ROPE / 2, 0]} c="#E7E5E4" />
        ))}
        <Box s={[1.4, 0.07, 0.42]} p={[0, -SWING_ROPE, 0]} c={WOOD_LIGHT} />
        <Box s={[1.4, 0.32, 0.05]} p={[0, -SWING_ROPE + 0.2, -0.2]} c={WOOD_LIGHT} />
        {[-0.4, 0.4].map((x) => (
          <Heart key={x} c="#FB7185" position={[x, -SWING_ROPE + 0.2, -0.24]} scale={0.12} />
        ))}
      </group>
    </group>
  );
};

const Swan: React.FC = () => (
  <group>
    <Ball r={0.22} p={[0, 0.12, 0]} s={[0.9, 0.7, 1.3]} c="#FFFFFF" />
    <Cyl a={[0.04, 0.05, 0.38, 6]} p={[0, 0.35, 0.2]} r={[0.25, 0, 0]} c="#FFFFFF" />
    <Ball r={0.08} p={[0, 0.55, 0.26]} c="#FFFFFF" />
    <mesh position={[0, 0.54, 0.36]} rotation={[Math.PI / 2, 0, 0]}>
      <coneGeometry args={[0.03, 0.1, 6]} />
      <Mat c="#FB923C" />
    </mesh>
  </group>
);

export const Boat: React.FC = () => (
  <group>
    <mesh position={[0, 0.12, 0]} scale={[0.55, 0.3, 1.25]} castShadow>
      <sphereGeometry args={[0.6, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
      <meshStandardMaterial color="#F9A8D4" side={THREE.DoubleSide} flatShading />
    </mesh>
    <Box s={[0.6, 0.04, 0.2]} p={[0, 0.1, -0.42]} c={WOOD_LIGHT} />
    <Box s={[0.6, 0.04, 0.2]} p={[0, 0.1, 0.42]} c={WOOD_LIGHT} />
    <Box s={[0.04, 0.04, 1.2]} p={[0.36, 0.15, 0]} r={[0, 0.3, 0.3]} c={WOOD_DARK} />
  </group>
);

const Pond: React.FC<BuildProps> = () => {
  const swans = useSpin((g, t) => (g.rotation.y = -t * 0.18));
  const boat = useSpin((g, t) => {
    const b = boatAt(t);
    g.position.set(b.x, 0.02 + Math.sin(t * 2) * 0.02, b.z);
    g.rotation.y = b.heading;
  });
  return (
    <group>
      <mesh position={[0, 0.03, 0]} receiveShadow>
        <cylinderGeometry args={[3, 3, 0.06, 32]} />
        <meshStandardMaterial color="#7DD3FC" roughness={0.15} metalness={0.1} transparent opacity={0.9} />
      </mesh>
      {Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        return <Ball key={i} r={0.28 + (i % 3) * 0.05} p={[Math.cos(a) * 3.05, 0.08, Math.sin(a) * 3.05]} s={[1, 0.55, 1]} c={i % 2 ? STONE : '#B8B0A8'} d={0} />;
      })}
      {[[1.8, 1.2], [-1.6, -1.6], [0.6, -2.2], [-2.2, 1]].map(([x, z], i) => (
        <group key={i} position={[x, 0.07, z]}>
          <Cyl a={[0.28, 0.28, 0.02, 10]} c="#4ADE80" />
          {i % 2 === 0 && <Ball r={0.08} p={[0.05, 0.06, 0]} c="#F9A8D4" />}
        </group>
      ))}
      <group ref={swans}>
        <group position={[2.1, 0.02, 0]}>
          <Swan />
        </group>
        <group position={[2.1, 0.02, -0.55]} rotation={[0, 0.2, 0]}>
          <Swan />
        </group>
      </group>
      <group ref={boat}>
        <Boat />
      </group>
    </group>
  );
};

const Bridge: React.FC<BuildProps> = () => {
  const n = 18;
  const plank = (i: number) => {
    const u = i / (n - 1) - 0.5;
    const x = u * 7.6;
    const y = 0.62 * Math.cos(u * Math.PI) + 0.05;
    const slope = -0.62 * Math.PI * Math.sin(u * Math.PI) / 7.6;
    return { x, y, r: Math.atan(slope) };
  };
  return (
    <group>
      {Array.from({ length: n }, (_, i) => {
        const p = plank(i);
        return <Box key={i} s={[0.44, 0.07, 1.1]} p={[p.x, p.y, 0]} r={[0, 0, p.r]} c={i % 2 ? WOOD : WOOD_LIGHT} />;
      })}
      {[-0.52, 0.52].flatMap((z) =>
        Array.from({ length: 7 }, (_, i) => {
          const p = plank(Math.round((i / 6) * (n - 1)));
          return <Cyl key={`${z}${i}`} a={[0.035, 0.035, 0.5, 6]} p={[p.x, p.y + 0.27, z]} c={WOOD_DARK} />;
        })
      )}
      {[-0.52, 0.52].map((z) => (
        <mesh key={z} position={[0, 0.55, z]} scale={[1, 0.16, 1]}>
          <torusGeometry args={[3.8, 0.05, 4, 24, Math.PI]} />
          <Mat c={WOOD_DARK} />
        </mesh>
      ))}
    </group>
  );
};

const Arch: React.FC<BuildProps> = () => (
  <group>
    {[-1, 1].map((x) => (
      <Box key={x} s={[0.14, 2, 0.14]} p={[x, 1, 0]} c="#E7E5E4" />
    ))}
    <mesh position={[0, 2, 0]}>
      <torusGeometry args={[1, 0.07, 6, 18, Math.PI]} />
      <Mat c="#E7E5E4" />
    </mesh>
    {Array.from({ length: 22 }, (_, i) => {
      const a = (i / 21) * Math.PI;
      return <Ball key={i} r={0.13} p={[Math.cos(a) * 1, 2 + Math.sin(a) * 1, (i % 2 ? 0.08 : -0.08)]} c={i % 3 ? '#E11D48' : '#FB7185'} d={0} />;
    })}
    {[-1, 1].flatMap((x) =>
      [0.4, 0.9, 1.4].map((y) => <Ball key={`${x}${y}`} r={0.12} p={[x, y, 0.08]} c="#22C55E" d={0} />)
    )}
  </group>
);

const Fountain: React.FC<BuildProps> = () => {
  const drops = useSpin((g, t) => {
    g.children.forEach((c, i) => {
      const p = (t * 0.8 + i / g.children.length) % 1;
      const a = (i / g.children.length) * Math.PI * 2;
      c.position.set(Math.cos(a) * p * 0.9, 1.75 + p * 0.6 - p * p * 1.6, Math.sin(a) * p * 0.9);
    });
  });
  return (
    <group>
      <Cyl a={[1.35, 1.45, 0.45, 20]} p={[0, 0.22, 0]} c={STONE} />
      <mesh position={[0, 0.42, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.05, 20]} />
        <meshStandardMaterial color="#7DD3FC" roughness={0.1} transparent opacity={0.85} />
      </mesh>
      <Cyl a={[0.15, 0.22, 1.2, 10]} p={[0, 1, 0]} c={STONE} />
      <Cyl a={[0.6, 0.25, 0.25, 14]} p={[0, 1.6, 0]} c={STONE} />
      <mesh position={[0, 1.72, 0]}>
        <cylinderGeometry args={[0.52, 0.52, 0.04, 14]} />
        <meshStandardMaterial color="#7DD3FC" roughness={0.1} transparent opacity={0.85} />
      </mesh>
      <Heart c="#FB7185" position={[0, 2.05, 0]} scale={0.25} glow />
      <group ref={drops}>
        {Array.from({ length: 14 }, (_, i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.04, 6, 4]} />
            <meshStandardMaterial color="#BAE6FD" transparent opacity={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
};

const Hammock: React.FC<BuildProps> = () => {
  const sway = useSpin((g, t) => (g.rotation.x = Math.sin(t * 1.1) * 0.06));
  const n = 10;
  return (
    <group>
      {[-1.6, 1.6].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <Cyl a={[0.1, 0.14, 2.4, 7]} p={[0, 1.2, 0]} c={WOOD_DARK} />
          <Ball r={0.6} p={[0, 2.6, 0]} c="#4ADE80" />
          <Ball r={0.45} p={[0.3, 2.3, 0.2]} c="#22C55E" />
        </group>
      ))}
      <group ref={sway} position={[0, 1.3, 0]}>
        {Array.from({ length: n }, (_, i) => {
          const u = i / (n - 1) - 0.5;
          return <Box key={i} s={[0.34, 0.04, 0.95]} p={[u * 2.9, -0.55 + u * u * 1.8, 0]} r={[0, 0, Math.atan(u * 3.6) * 0.6]} c={i % 2 ? '#FDA4AF' : '#FBCFE8'} />;
        })}
      </group>
    </group>
  );
};

const Telescope: React.FC<BuildProps> = () => (
  <group>
    {[0, 2.1, 4.2].map((a) => (
      <Cyl key={a} a={[0.025, 0.03, 1.15, 5]} p={[Math.sin(a) * 0.22, 0.55, Math.cos(a) * 0.22]} r={[Math.cos(a) * -0.2, 0, Math.sin(a) * 0.2]} c={WOOD_DARK} />
    ))}
    <group position={[0, 1.15, 0]} rotation={[0.75, 0, 0]}>
      <Cyl a={[0.1, 0.08, 1.1, 12]} p={[0, 0, 0]} r={[Math.PI / 2, 0, 0]} c="#6366F1" />
      <Cyl a={[0.12, 0.12, 0.12, 12]} p={[0, 0, -0.55]} r={[Math.PI / 2, 0, 0]} c="#FCD34D" />
    </group>
  </group>
);

const TreeHouse: React.FC<BuildProps> = ({ night }) => {
  const H = TREEHOUSE_HEIGHT;
  return (
    <group>
      <Cyl a={[0.45, 0.7, H + 1.4, 9]} p={[0, (H + 1.4) / 2, 0]} c={WOOD_DARK} />
      <Cyl a={[1.95, 1.95, 0.16, 16]} p={[0, H - 0.08, 0]} c={WOOD} />
      {/* rail around the front */}
      {Array.from({ length: 11 }, (_, i) => {
        const a = -Math.PI * 0.05 + (i / 10) * Math.PI * 1.1;
        return <Cyl key={i} a={[0.03, 0.03, 0.5, 5]} p={[Math.cos(a) * 1.88, H + 0.25, Math.sin(a) * 1.88]} c={WOOD_LIGHT} />;
      })}
      {/* little hut */}
      <group position={[0, H, -0.85]}>
        <Box s={[1.7, 1.3, 1.2]} p={[0, 0.65, 0]} c="#FDE68A" />
        <mesh position={[0, 1.6, 0]} rotation={[0, Math.PI / 4, 0]} castShadow>
          <coneGeometry args={[1.35, 0.8, 4]} />
          <Mat c="#E11D48" />
        </mesh>
        <Box s={[0.5, 0.8, 0.04]} p={[0, 0.4, 0.61]} c={WOOD_DARK} />
        <Box s={[0.34, 0.34, 0.04]} p={[0.55, 0.85, 0.61]} c="#FEF3C7" glow={night ? '#FBBF24' : false} />
        <Heart c="#F43F5E" position={[0, 1.05, 0.63]} scale={0.18} />
        {night && <pointLight position={[0, 0.9, 0.9]} color="#FCD34D" intensity={4} distance={5} />}
      </group>
      {/* leaves above */}
      <Ball r={1.7} p={[0, H + 2.5, -0.4]} c="#4ADE80" />
      <Ball r={1.2} p={[1.1, H + 2.0, 0.3]} c="#22C55E" />
      <Ball r={1.1} p={[-1.2, H + 2.1, 0.1]} c="#16A34A" />
      {/* ladder */}
      {[-0.22, 0.22].map((x) => (
        <Box key={x} s={[0.06, H, 0.06]} p={[x, H / 2, 0.75]} c={WOOD_LIGHT} />
      ))}
      {Array.from({ length: 8 }, (_, i) => (
        <Box key={i} s={[0.44, 0.05, 0.06]} p={[0, 0.3 + i * 0.4, 0.75]} c={WOOD_LIGHT} />
      ))}
    </group>
  );
};

const Balloon: React.FC<BuildProps> = () => {
  const ref = useSpin((g, t) => {
    const alt = live.balloonAlt;
    g.position.y = alt + (alt > 0.1 ? 0 : Math.sin(t * 1.4) * 0.05 + 0.05);
  });
  return (
    <group>
      <Cyl a={[0.05, 0.07, 0.4, 6]} p={[0.9, 0.2, 0]} c={WOOD_DARK} />
      <group ref={ref}>
        <Box s={[1, 0.6, 1]} p={[0, 0.3, 0]} c={WOOD_LIGHT} />
        <Box s={[1.05, 0.08, 1.05]} p={[0, 0.6, 0]} c={WOOD_DARK} />
        {[[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].map(([x, z], i) => (
          <Cyl key={i} a={[0.012, 0.012, 1.8, 4]} p={[x * 1.2, 1.5, z * 1.2]} r={[z * 0.3, 0, -x * 0.3]} c="#78716C" />
        ))}
        {/* heart-shaped envelope */}
        <group position={[0, 3.6, 0]}>
          <mesh position={[-0.75, 0.55, 0]} castShadow>
            <sphereGeometry args={[1.15, 18, 14]} />
            <Mat c="#F43F5E" flat={false} rough={0.5} />
          </mesh>
          <mesh position={[0.75, 0.55, 0]} castShadow>
            <sphereGeometry args={[1.15, 18, 14]} />
            <Mat c="#FB7185" flat={false} rough={0.5} />
          </mesh>
          <mesh position={[0, -0.75, 0]} rotation={[Math.PI, 0, 0]} castShadow>
            <coneGeometry args={[1.6, 1.9, 18]} />
            <Mat c="#F43F5E" flat={false} rough={0.5} />
          </mesh>
        </group>
      </group>
    </group>
  );
};

const Windmill: React.FC<BuildProps> = () => {
  const blades = useSpin((g, t) => (g.rotation.z = t * 0.8));
  return (
    <group>
      <Cyl a={[0.8, 1.4, 5, 8]} p={[0, 2.5, 0]} c="#FEF3C7" />
      <mesh position={[0, 5.4, 0]} castShadow>
        <coneGeometry args={[1, 1, 8]} />
        <Mat c="#B91C1C" />
      </mesh>
      <Box s={[0.6, 0.9, 0.05]} p={[0, 0.45, 1.25]} r={[-0.1, 0, 0]} c={WOOD_DARK} />
      <group ref={blades} position={[0, 4.6, 1.05]}>
        {[0, 1, 2, 3].map((i) => (
          <group key={i} rotation={[0, 0, (i * Math.PI) / 2]}>
            <Box s={[0.12, 2.6, 0.05]} p={[0, 1.3, 0]} c={WOOD} />
            <Box s={[0.55, 2, 0.03]} p={[0.32, 1.5, 0]} c="#FFFFFF" />
          </group>
        ))}
        <Ball r={0.18} c={WOOD_DARK} />
      </group>
    </group>
  );
};

const Cottage: React.FC<BuildProps> = ({ night }) => {
  const smoke = useSpin((g, t) => {
    g.children.forEach((c, i) => {
      const p = (t * 0.25 + i / g.children.length) % 1;
      c.position.set(Math.sin(p * 6 + i) * 0.15, p * 1.6, 0);
      c.scale.setScalar(0.15 + p * 0.35);
    });
  });
  const win = night ? '#FBBF24' : false;
  return (
    <group>
      <Box s={[4, 2.4, 3.2]} p={[0, 1.2, 0]} c="#FFF1F2" />
      <Box s={[4.1, 0.25, 3.3]} p={[0, 0.12, 0]} c={STONE} />
      {/* gable roof */}
      <mesh position={[0, 3.375, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.95, 1.95, 4.4, 3, 1, false, Math.PI / 2]} />
        <Mat c="#E11D48" />
      </mesh>
      <Box s={[0.5, 1.4, 0.5]} p={[1.2, 4.5, -0.6]} c="#A8A29E" />
      <group ref={smoke} position={[1.2, 5.2, -0.6]}>
        {Array.from({ length: 5 }, (_, i) => (
          <mesh key={i}>
            <icosahedronGeometry args={[1, 0]} />
            <meshStandardMaterial color="#E7E5E4" transparent opacity={0.7} flatShading />
          </mesh>
        ))}
      </group>
      {/* door + windows */}
      <Box s={[0.85, 1.55, 0.08]} p={[0, 0.85, 1.62]} c="#BE185D" />
      <Ball r={0.05} p={[0.28, 0.85, 1.68]} c="#FCD34D" d={0} />
      <Heart c="#FDE68A" position={[0, 1.35, 1.68]} scale={0.16} />
      {[-1.3, 1.3].map((x) => (
        <group key={x} position={[x, 1.35, 1.61]}>
          <Box s={[0.75, 0.7, 0.06]} c="#FEF3C7" glow={win} />
          <Box s={[0.85, 0.1, 0.12]} p={[0, -0.42, 0.04]} c={WOOD} />
          {[-0.25, 0, 0.25].map((fx) => (
            <Ball key={fx} r={0.08} p={[fx, -0.33, 0.08]} c={fx === 0 ? '#FDE047' : '#F472B6'} d={0} />
          ))}
        </group>
      ))}
      <Box s={[0.75, 0.7, 0.06]} p={[2.01, 1.35, 0]} r={[0, Math.PI / 2, 0]} c="#FEF3C7" glow={win} />
      {/* path to the door */}
      {[2.1, 2.7, 3.3].map((z) => (
        <Cyl key={z} a={[0.3, 0.32, 0.04, 8]} p={[0, 0.02, z]} c={STONE} />
      ))}
      {night && <pointLight position={[0, 1.6, 2.6]} color="#FCD34D" intensity={5} distance={6} />}
    </group>
  );
};

const Gazebo: React.FC<BuildProps> = ({ night }) => {
  const posts = Array.from({ length: 6 }, (_, i) => (i / 6) * Math.PI * 2 + Math.PI / 6);
  return (
    <group>
      <Cyl a={[2, 2.1, 0.2, 6]} p={[0, 0.1, 0]} c={WOOD_LIGHT} />
      {posts.map((a, i) => (
        <Cyl key={i} a={[0.07, 0.07, 2.4, 6]} p={[Math.cos(a) * 1.85, 1.3, Math.sin(a) * 1.85]} c="#FFFFFF" />
      ))}
      <mesh position={[0, 2.95, 0]} castShadow>
        <coneGeometry args={[2.4, 1.3, 6]} />
        <Mat c="#F9A8D4" />
      </mesh>
      <Heart c="#F43F5E" position={[0, 3.75, 0]} scale={0.22} />
      {/* fairy lights along the roof edge */}
      {posts.flatMap((a, i) => {
        const b = posts[(i + 1) % 6];
        return Array.from({ length: 5 }, (_, j) => {
          const u = (j + 0.5) / 5;
          const x = (Math.cos(a) * (1 - u) + Math.cos(b) * u) * 2.05;
          const z = (Math.sin(a) * (1 - u) + Math.sin(b) * u) * 2.05;
          return (
            <mesh key={`${i}${j}`} position={[x, 2.28 - Math.sin(u * Math.PI) * 0.18, z]}>
              <sphereGeometry args={[0.05, 6, 4]} />
              <meshStandardMaterial color="#FEF9C3" emissive="#FDE047" emissiveIntensity={night ? 2.2 : 0.4} />
            </mesh>
          );
        });
      })}
      {/* bench inside */}
      <Box s={[1.5, 0.08, 0.45]} p={[0, 0.45, -1]} c={WOOD} />
      <Box s={[1.5, 0.45, 0.07]} p={[0, 0.72, -1.2]} c={WOOD} />
      {night && <pointLight position={[0, 2, 0]} color="#FEF08A" intensity={5} distance={7} />}
    </group>
  );
};

export const BUILD_MODELS: Record<string, React.FC<BuildProps>> = {
  mailbox: Mailbox,
  bench: Bench,
  picnic: Picnic,
  lanterns: Lanterns,
  mushrooms: Mushrooms,
  bunnies: Bunnies,
  pets: Pets,
  swing: Swing,
  pond: Pond,
  bridge: Bridge,
  arch: Arch,
  fountain: Fountain,
  hammock: Hammock,
  telescope: Telescope,
  treehouse: TreeHouse,
  balloon: Balloon,
  windmill: Windmill,
  cottage: Cottage,
  gazebo: Gazebo,
};
