import React from 'react';
import * as THREE from 'three';
import type { ThreeElements } from '@react-three/fiber';

/** Soft, slightly flat-shaded material used everywhere in the world. */
export const Mat: React.FC<{ c: string; glow?: string | false; glowStrength?: number; flat?: boolean; rough?: number; opacity?: number }> = ({
  c,
  glow,
  glowStrength = 1.4,
  flat = true,
  rough = 0.85,
  opacity,
}) => (
  <meshStandardMaterial
    color={c}
    flatShading={flat}
    roughness={rough}
    emissive={glow || '#000000'}
    emissiveIntensity={glow ? glowStrength : 0}
    transparent={opacity !== undefined}
    opacity={opacity ?? 1}
  />
);

function makeHeart(): THREE.ExtrudeGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0.25);
  s.bezierCurveTo(0, 0.25, -0.05, 0, -0.25, 0);
  s.bezierCurveTo(-0.55, 0, -0.55, 0.35, -0.55, 0.35);
  s.bezierCurveTo(-0.55, 0.55, -0.35, 0.77, 0, 0.95);
  s.bezierCurveTo(0.35, 0.77, 0.55, 0.55, 0.55, 0.35);
  s.bezierCurveTo(0.55, 0.35, 0.55, 0, 0.25, 0);
  s.bezierCurveTo(0.1, 0, 0, 0.25, 0, 0.25);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.22, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 2, curveSegments: 10 });
  g.center();
  g.rotateZ(Math.PI); // point down
  return g;
}

/** A small puffy heart about 1.2 units wide (scale it down). */
export const HEART = makeHeart();

export const Heart: React.FC<{ c?: string; glow?: boolean } & ThreeElements['mesh']> = ({ c = '#F43F5E', glow, ...props }) => (
  <mesh geometry={HEART} castShadow {...props}>
    <Mat c={c} flat={false} rough={0.4} glow={glow ? c : false} glowStrength={0.6} />
  </mesh>
);

/** Wooden plank colours */
export const WOOD = '#B07A4F';
export const WOOD_DARK = '#7A4E2D';
export const WOOD_LIGHT = '#D9A877';
export const STONE = '#C9C2BC';
