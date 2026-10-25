import React, { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Heart, Mat, WOOD, WOOD_DARK, WOOD_LIGHT, STONE } from './common';
import { DRESS_ORIGIN, HOME_ORIGIN, HOME_SPOTS } from '../worldData';

const Box: React.FC<{ s: [number, number, number]; p?: [number, number, number]; c: string; glow?: string | false; r?: [number, number, number] }> = ({ s, p, c, glow, r }) => (
  <mesh position={p} rotation={r} castShadow receiveShadow>
    <boxGeometry args={s} />
    <Mat c={c} glow={glow} />
  </mesh>
);

/** Put a piece of furniture where its spot in HOME_SPOTS says. */
const At: React.FC<{ id: keyof typeof HOME_SPOTS; children: React.ReactNode }> = ({ id, children }) => {
  const d = HOME_SPOTS[id];
  return (
    <group position={[d.x, 0, d.z]} rotation={[0, d.rot, 0]}>
      {children}
    </group>
  );
};

/** Our cosy home inside the cottage — a dollhouse you look into from above. */
export const HomeInterior: React.FC<{ night: boolean }> = ({ night }) => {
  const fire = useRef<THREE.PointLight>(null);
  const flames = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (fire.current) fire.current.intensity = 6 + Math.sin(t * 9) * 1.2 + Math.sin(t * 23) * 0.6;
    flames.current?.children.forEach((c, i) => {
      c.scale.y = 1 + Math.sin(t * 8 + i * 2) * 0.25;
    });
  });
  return (
    <group position={HOME_ORIGIN}>
      {/* walls: drawn from the inside only, so the near walls vanish and you can see in */}
      <mesh position={[0, 1.6, 0]}>
        <boxGeometry args={[10, 3.2, 8]} />
        <meshStandardMaterial color="#FCE7F3" side={THREE.BackSide} roughness={0.9} />
      </mesh>
      {/* wooden floor */}
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[-4.5 + i, 0.01, 0]} receiveShadow>
          <boxGeometry args={[0.98, 0.02, 8]} />
          <Mat c={i % 2 ? WOOD_LIGHT : '#E3B98A'} />
        </mesh>
      ))}
      {/* rug */}
      <mesh position={[-1.2, 0.03, 0.4]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[1.8, 32]} />
        <Mat c="#F9A8D4" />
      </mesh>
      <mesh position={[-1.2, 0.035, 0.4]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.4, 1.55, 32]} />
        <Mat c="#FFFFFF" />
      </mesh>

      {/* back-wall window with the sky behind */}
      <group position={[0, 1.8, -3.97]}>
        <Box s={[1.8, 1.2, 0.04]} c={night ? '#312E81' : '#BAE6FD'} glow={night ? '#4338CA' : '#7DD3FC'} />
        <Box s={[1.9, 0.08, 0.1]} p={[0, 0, 0.03]} c="#FFFFFF" />
        <Box s={[0.08, 1.3, 0.1]} p={[0, 0, 0.03]} c="#FFFFFF" />
        <Box s={[0.5, 1.4, 0.06]} p={[-1.15, 0, 0.05]} c="#FDA4AF" />
        <Box s={[0.5, 1.4, 0.06]} p={[1.15, 0, 0.05]} c="#FDA4AF" />
      </group>
      {/* photo frames over the sofa */}
      {[-3.3, -2.6, -1.9].map((x, i) => (
        <group key={x} position={[x, 2.1 + (i === 1 ? 0.15 : 0), -3.96]}>
          <Box s={[0.5, 0.6, 0.05]} c={WOOD_DARK} />
          <Box s={[0.4, 0.5, 0.02]} p={[0, 0, 0.03]} c={['#FBCFE8', '#DDD6FE', '#FDE68A'][i]} />
          <Heart c="#F43F5E" position={[0, 0, 0.06]} scale={0.12} />
        </group>
      ))}

      <At id="sofa">
        <Box s={[1.9, 0.45, 0.85]} p={[0, 0.22, 0]} c="#F472B6" />
        <Box s={[1.9, 0.6, 0.25]} p={[0, 0.6, -0.33]} c="#EC4899" />
        <Box s={[0.22, 0.6, 0.85]} p={[-0.95, 0.4, 0]} c="#EC4899" />
        <Box s={[0.22, 0.6, 0.85]} p={[0.95, 0.4, 0]} c="#EC4899" />
        <Heart c="#FFFFFF" position={[-0.55, 0.62, -0.15]} scale={0.22} />
      </At>

      <At id="bed">
        <Box s={[1.9, 0.35, 2.6]} p={[0, 0.2, 0]} c={WOOD} />
        <Box s={[1.8, 0.2, 2.5]} p={[0, 0.45, 0]} c="#FFFFFF" />
        <Box s={[1.85, 0.08, 1.6]} p={[0, 0.58, 0.45]} c="#C4B5FD" />
        <Box s={[1.9, 1.1, 0.12]} p={[0, 0.75, -1.3]} c={WOOD_DARK} />
        {[-0.42, 0.42].map((x) => (
          <Box key={x} s={[0.7, 0.16, 0.38]} p={[x, 0.64, -0.95]} c="#FCE7F3" />
        ))}
        <Heart c="#F43F5E" position={[0, 1.05, -1.22]} scale={0.25} />
        {/* bedside lamp */}
        <Box s={[0.45, 0.5, 0.4]} p={[1.25, 0.25, -1]} c={WOOD_LIGHT} />
        <mesh position={[1.25, 0.82, -1]}>
          <coneGeometry args={[0.2, 0.28, 10, 1, true]} />
          <meshStandardMaterial color="#FEF3C7" emissive="#FCD34D" emissiveIntensity={night ? 1.5 : 0.4} side={THREE.DoubleSide} />
        </mesh>
      </At>

      {/* fireplace on the left wall */}
      <group position={[-4.75, 0, 0.8]} rotation={[0, Math.PI / 2, 0]}>
        <Box s={[1.8, 1.4, 0.5]} p={[0, 0.7, 0]} c={STONE} />
        <Box s={[1.1, 0.8, 0.52]} p={[0, 0.45, 0.01]} c="#292524" />
        <Box s={[2, 0.12, 0.6]} p={[0, 1.45, 0.05]} c={WOOD_DARK} />
        <group ref={flames} position={[0, 0.15, 0.1]}>
          {[-0.2, 0, 0.2].map((x, i) => (
            <mesh key={x} position={[x, 0.2, 0]}>
              <coneGeometry args={[0.13, 0.45 - Math.abs(x), 6]} />
              <meshStandardMaterial color={i === 1 ? '#FDE047' : '#FB923C'} emissive={i === 1 ? '#FACC15' : '#F97316'} emissiveIntensity={2} />
            </mesh>
          ))}
        </group>
        <pointLight ref={fire} position={[0, 0.6, 0.8]} color="#FB923C" distance={7} />
        <Heart c="#FB7185" position={[0, 1.7, 0.05]} scale={0.2} />
      </group>

      <At id="table">
        <mesh position={[0, 0.72, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.6, 0.06, 20]} />
          <Mat c="#FFFFFF" />
        </mesh>
        <Box s={[0.1, 0.72, 0.1]} p={[0, 0.36, 0]} c={WOOD_DARK} />
        {[-0.85, 0.85].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <Box s={[0.42, 0.06, 0.42]} p={[0, 0.45, 0]} c={WOOD} />
            <Box s={[0.06, 0.5, 0.42]} p={[x > 0 ? 0.2 : -0.2, 0.72, 0]} c={WOOD} />
            {[[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].map(([lx, lz], i) => (
              <Box key={i} s={[0.04, 0.45, 0.04]} p={[lx, 0.22, lz]} c={WOOD_DARK} />
            ))}
          </group>
        ))}
        {/* candles and two plates */}
        {[-0.1, 0.1].map((z) => (
          <group key={z} position={[0, 0.85, z]}>
            <mesh>
              <cylinderGeometry args={[0.03, 0.03, 0.18, 8]} />
              <Mat c="#FFFBEB" />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <sphereGeometry args={[0.03, 6, 6]} />
              <meshStandardMaterial color="#FDE047" emissive="#FACC15" emissiveIntensity={2.5} />
            </mesh>
          </group>
        ))}
        {[-0.38, 0.38].map((x) => (
          <mesh key={x} position={[x, 0.76, 0]}>
            <cylinderGeometry args={[0.16, 0.12, 0.03, 16]} />
            <Mat c="#FBCFE8" />
          </mesh>
        ))}
        <pointLight position={[0, 1.2, 0]} color="#FDE68A" intensity={2} distance={3.5} />
      </At>

      <At id="shelf">
        <Box s={[1.4, 2, 0.4]} p={[0, 1, 0]} c={WOOD} />
        {[0.45, 1, 1.55].map((y, row) => (
          <group key={y}>
            <Box s={[1.3, 0.04, 0.38]} p={[0, y - 0.25, 0.02]} c={WOOD_DARK} />
            {Array.from({ length: 6 }, (_, i) => (
              <Box key={i} s={[0.12, 0.34, 0.26]} p={[-0.5 + i * 0.2, y - 0.06, 0.05]} c={['#F87171', '#60A5FA', '#FBBF24', '#A78BFA', '#34D399', '#F472B6'][(i + row * 2) % 6]} />
            ))}
          </group>
        ))}
      </At>

      <At id="kitchen">
        <Box s={[2.4, 0.9, 0.65]} p={[0, 0.45, 0]} c="#FFFFFF" />
        <Box s={[2.5, 0.06, 0.72]} p={[0, 0.92, 0]} c="#E7E5E4" />
        {[-0.6, 0.6].map((x) => (
          <Box key={x} s={[0.5, 0.5, 0.02]} p={[x, 0.45, 0.33]} c="#FBCFE8" />
        ))}
        <mesh position={[0.5, 1.05, 0]}>
          <cylinderGeometry args={[0.16, 0.14, 0.2, 12]} />
          <Mat c="#F43F5E" />
        </mesh>
        <Box s={[2.2, 0.55, 0.35]} p={[0, 2, -0.15]} c="#FCE7F3" />
      </At>

      {/* plant in the corner */}
      <group position={[4.3, 0, -3.4]}>
        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.25, 0.2, 0.5, 10]} />
          <Mat c="#FDBA74" />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.3) * 0.15, 0.75 + i * 0.12, Math.sin(i * 1.3) * 0.15]}>
            <icosahedronGeometry args={[0.25, 0]} />
            <Mat c="#22C55E" />
          </mesh>
        ))}
      </group>

      {/* door back outside */}
      <group position={[0, 0, 3.97]}>
        {/* one-sided, so it disappears when the camera is outside the front wall */}
        <mesh position={[0, 1, -0.01]} rotation={[0, Math.PI, 0]}>
          <planeGeometry args={[1, 2]} />
          <Mat c="#BE185D" />
        </mesh>
        <mesh position={[0, 0.02, -0.6]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.2, 0.7]} />
          <Mat c="#FDA4AF" />
        </mesh>
      </group>

      {/* warm ceiling light */}
      <pointLight position={[0, 2.9, 0]} color="#FFE4C4" intensity={night ? 10 : 6} distance={14} />
      <mesh position={[0, 3.05, 0]}>
        <sphereGeometry args={[0.18, 12, 8]} />
        <meshStandardMaterial color="#FEF3C7" emissive="#FDE68A" emissiveIntensity={2} />
      </mesh>
    </group>
  );
};

/** The dressing room: two podiums under spotlights, a big mirror and racks of clothes. */
export const DressingRoom: React.FC = () => {
  const racks = ['#F472B6', '#60A5FA', '#FBBF24', '#A78BFA', '#34D399', '#FB7185', '#FFFFFF', '#1E3A8A'];
  return (
    <group position={DRESS_ORIGIN}>
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[9, 3.6, 7]} />
        <meshStandardMaterial color="#FDF2F8" side={THREE.BackSide} roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow>
        <planeGeometry args={[9, 7]} />
        <Mat c="#FBCFE8" />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0.3]}>
        <circleGeometry args={[2.4, 40]} />
        <Mat c="#FFFFFF" />
      </mesh>
      {/* podiums, one each */}
      {[-0.9, 0.9].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 0.1, 0]} receiveShadow castShadow>
            <cylinderGeometry args={[0.65, 0.7, 0.2, 28]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.205, 0]}>
            <torusGeometry args={[0.66, 0.025, 6, 32]} />
            <meshStandardMaterial color="#F472B6" emissive="#F472B6" emissiveIntensity={0.8} />
          </mesh>
          <spotLight position={[0, 3.4, 1.2]} angle={0.45} penumbra={0.7} intensity={18} distance={7} color="#FFF1F2" />
        </group>
      ))}
      {/* the big mirror */}
      <group position={[0, 1.7, -3.45]}>
        <Box s={[3.4, 2.6, 0.1]} c="#FDE68A" />
        <mesh position={[0, 0, 0.06]}>
          <planeGeometry args={[3.1, 2.3]} />
          <meshStandardMaterial color="#DBEAFE" emissive="#BFDBFE" emissiveIntensity={0.35} roughness={0.15} />
        </mesh>
        {Array.from({ length: 14 }, (_, i) => {
          const a = (i / 14) * Math.PI * 2;
          return (
            <mesh key={i} position={[Math.cos(a) * 1.75, Math.sin(a) * 1.35, 0.08]}>
              <sphereGeometry args={[0.06, 8, 6]} />
              <meshStandardMaterial color="#FEF9C3" emissive="#FDE047" emissiveIntensity={1.6} />
            </mesh>
          );
        })}
      </group>
      {/* clothes racks on both sides */}
      {[-3.6, 3.6].map((x, side) => (
        <group key={x} position={[x, 0, -0.5]} rotation={[0, side ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <Box s={[3, 0.05, 0.05]} p={[0, 1.8, 0]} c="#D6D3D1" />
          {[-1.45, 1.45].map((px) => (
            <Box key={px} s={[0.05, 1.8, 0.05]} p={[px, 0.9, 0]} c="#D6D3D1" />
          ))}
          {racks.map((c, i) => (
            <group key={i} position={[-1.2 + i * 0.34, 1.35, 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[0.1, 0.2, 0.75, 10]} />
                <Mat c={side ? racks[(i + 3) % racks.length] : c} />
              </mesh>
            </group>
          ))}
        </group>
      ))}
      {/* shoe shelf and a plant */}
      <group position={[3.2, 0, 2.6]}>
        <Box s={[1.4, 0.9, 0.5]} p={[0, 0.45, 0]} c={WOOD_LIGHT} />
        {[0.25, 0.65].map((y) => [-0.45, 0, 0.45].map((x) => <Box key={`${x}${y}`} s={[0.25, 0.12, 0.3]} p={[x, y, 0.05]} c={['#F472B6', '#FFFFFF', '#1F2937'][Math.round(x * 2 + 1)]} />))}
      </group>
      <group position={[-3.6, 0, 2.6]}>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.3, 0.24, 0.6, 12]} />
          <Mat c="#FDBA74" />
        </mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[Math.cos(i * 1.6) * 0.18, 0.85 + i * 0.15, Math.sin(i * 1.6) * 0.18]}>
            <icosahedronGeometry args={[0.3, 0]} />
            <Mat c="#22C55E" />
          </mesh>
        ))}
      </group>
      <Heart c="#F43F5E" position={[0, 3.3, -3.4]} scale={0.35} glow />
      <pointLight position={[0, 3.2, 1]} color="#FFE4E6" intensity={8} distance={12} />
    </group>
  );
};
