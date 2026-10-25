/**
 * The shape of our island: a wobbly natural coastline, a winding road for cars and bikes,
 * and the railway nearer the sea. Everything is described by angle `a` around the centre,
 * with points at (r·cos a, −r·sin a) in world x/z.
 */

/** The big bays and headlands of the coast (smooth, so the railway can follow it) */
const coastBase = (a: number) => 50 + 5 * Math.sin(2 * a + 0.3) + 3 * Math.sin(3 * a + 0.5);
/** Distance from the centre to the shore at angle `a` (about 40–60 m) */
export const coastR = (a: number) => coastBase(a) + 1.6 * Math.sin(5 * a + 1.3) + 0.8 * Math.sin(7 * a + 2.1);
/** The road (about 24–30 m out) */
export const roadR = (a: number) => 27 + 2 * Math.sin(2 * a + 0.7) + Math.sin(3 * a + 2);
/** The railway follows the coast about 7 m in from the beach */
export const railR = (a: number) => coastBase(a) - 7;

export const ROAD_WIDTH = 2.8;
export const RAIL_WIDTH = 2.2;

export const angleOf = (x: number, z: number) => Math.atan2(-z, x);
export const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), -r * Math.sin(a)];

/** How far inside the shore a point is (negative = in the sea). */
export function inland(x: number, z: number): number {
  return coastR(angleOf(x, z)) - Math.hypot(x, z);
}

/** Which way is "outwards" at angle `a`, as a heading (ry) for things that face the sea. */
export const outwardHeading = (a: number) => Math.atan2(Math.cos(a), -Math.sin(a));

/** A closed path sampled evenly, so things can travel along it at a steady speed. */
export interface Loop {
  length: number;
  x: Float32Array;
  z: Float32Array;
  /** Distance along the loop at each sample */
  s: Float32Array;
  at: (dist: number) => { x: number; z: number; heading: number };
}

function makeLoop(r: (a: number) => number, n = 900): Loop {
  const x = new Float32Array(n + 1);
  const z = new Float32Array(n + 1);
  const s = new Float32Array(n + 1);
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    [x[i], z[i]] = polar(r(a), a);
    if (i) s[i] = s[i - 1] + Math.hypot(x[i] - x[i - 1], z[i] - z[i - 1]);
  }
  const length = s[n];
  const at = (dist: number) => {
    const d = ((dist % length) + length) % length;
    // binary search for the segment
    let lo = 0;
    let hi = n;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (s[mid] <= d) lo = mid;
      else hi = mid;
    }
    const f = (d - s[lo]) / (s[hi] - s[lo] || 1);
    const dx = x[hi] - x[lo];
    const dz = z[hi] - z[lo];
    return { x: x[lo] + dx * f, z: z[lo] + dz * f, heading: Math.atan2(dx, dz) };
  };
  return { length, x, z, s, at };
}

export const ROAD = makeLoop(roadR);
export const RAIL = makeLoop(railR);

/** Distance (roughly) from a point to a ring-like path. */
export const offPath = (r: (a: number) => number, x: number, z: number) => Math.abs(Math.hypot(x, z) - r(angleOf(x, z)));

/* ── Fixed places, chosen by angle so they fit the coastline ── */
const at = (r: number, a: number) => polar(r, a);

export const DOCK_ANGLE = 0.3;
const [dockX, dockZ] = at(coastR(DOCK_ANGLE) - 1.5, DOCK_ANGLE);
/** The jetty for the boat race: starts on the beach and runs 10 m out to sea */
export const DOCK = { x: dockX, z: dockZ, rot: outwardHeading(DOCK_ANGLE), length: 11 };

export const PADDOCK_ANGLE = 2.55;
const [padX, padZ] = at(33.5, PADDOCK_ANGLE);
export const PADDOCK = { x: padX, z: padZ, rot: outwardHeading(PADDOCK_ANGLE) };

export const STATION_ANGLE = -1.15;
const [stX, stZ] = at(railR(STATION_ANGLE) - 2.6, STATION_ANGLE);
export const STATION = { x: stX, z: stZ, rot: outwardHeading(STATION_ANGLE) };

export const PARKING_ANGLE = -1.9;
const [pkX, pkZ] = at(roadR(PARKING_ANGLE) + 3.8, PARKING_ANGLE);
export const PARKING = { x: pkX, z: pkZ, rot: outwardHeading(PARKING_ANGLE) + Math.PI };

export const LIGHTHOUSE_ANGLE = 1.95;
const [lhX, lhZ] = at(coastR(LIGHTHOUSE_ANGLE) - 2, LIGHTHOUSE_ANGLE);
export const LIGHTHOUSE = { x: lhX, z: lhZ };

/* ── Boat race: gates out at sea, round the whole island ── */
export const RACE_GATES = 10;
export interface Gate {
  x: number;
  z: number;
  /** Which way boats go through it */
  heading: number;
}
export const GATES: Gate[] = Array.from({ length: RACE_GATES }, (_, i) => {
  // round the island from just past the dock; gate 0 is also the finish line
  const a = DOCK_ANGLE + 0.25 + (i / RACE_GATES) * Math.PI * 2;
  const r = coastR(a) + 10;
  const [x, z] = polar(r, a);
  const a2 = a + 0.01;
  const [x2, z2] = polar(coastR(a2) + 10, a2);
  return { x, z, heading: Math.atan2(x2 - x, z2 - z) };
});
export const GATE_HALF_WIDTH = 4.5;

/** Where the boats start: just before gate 0, facing along the course */
export function raceStart(lane: 0 | 1): { x: number; z: number; ry: number } {
  const g = GATES[0];
  const back = 9;
  const side = (lane ? 1.6 : -1.6);
  const sx = Math.cos(g.heading);
  const sz = -Math.sin(g.heading);
  return { x: g.x - Math.sin(g.heading) * back + sx * side, z: g.z - Math.cos(g.heading) * back + sz * side, ry: g.heading };
}
