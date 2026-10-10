// Map layout shared by the renderer and the battle simulation.
// The Town Hall sits at the origin; four winding roads lead in from portals.

const rot = ([x, z], k) => {
  for (let i = 0; i < k; i++) [x, z] = [-z, x];
  return [x, z];
};

// The north road; the other three are 90° rotations of it.
const BASE_LANE = [[-8, -36], [-8, -16], [0, -16], [0, -3.2]];

// Lane order matches the order in which roads open up as waves progress.
export const LANES = [0, 1, 2, 3].map((k) => BASE_LANE.map((p) => rot(p, k)));

export const PATH_WIDTH = 3;
export const WALL_HALF = 20;

// Hero pads. The first two guard the first road.
const SLOT_BASE = [[-4, -4], [4, -4], [-4, -11], [4, 4], [11, -4], [-4, 4], [4, 11], [-11, 4]];
export const SLOT_POS = SLOT_BASE;

// Building lots defined for one quadrant, rotated into all four.
const quad = (p) => [0, 1, 2, 3].map((k) => rot(p, k));
export const LOTS = {
  house: [...quad([8.5, -8.5]), ...quad([14, -13])],
  farm: quad([7, -13.5]),
  market: quad([12.5, -17.2]),
  cannon: quad([4.6, -18.2]),
  tower: quad([17.6, -13.6]),
};
export const LUMBER_POS = [-27, -27];

export function laneLength(lane) {
  let len = 0;
  for (let i = 1; i < lane.length; i++) {
    len += Math.hypot(lane[i][0] - lane[i - 1][0], lane[i][1] - lane[i - 1][1]);
  }
  return len;
}
export const LANE_LENGTHS = LANES.map(laneLength);

// Position and heading at distance d along a lane.
export function lanePoint(laneIdx, d, out = { x: 0, z: 0, dir: 0 }) {
  const lane = LANES[laneIdx];
  for (let i = 1; i < lane.length; i++) {
    const [ax, az] = lane[i - 1], [bx, bz] = lane[i];
    const seg = Math.hypot(bx - ax, bz - az);
    if (d <= seg || i === lane.length - 1) {
      const t = Math.min(1, Math.max(0, d / seg));
      out.x = ax + (bx - ax) * t;
      out.z = az + (bz - az) * t;
      out.dir = Math.atan2(bx - ax, bz - az);
      return out;
    }
    d -= seg;
  }
  return out;
}

// Distance from a point to the nearest road centre line.
export function distToPaths(x, z) {
  let best = Infinity;
  for (const lane of LANES) {
    for (let i = 1; i < lane.length; i++) {
      const [ax, az] = lane[i - 1], [bx, bz] = lane[i];
      const dx = bx - ax, dz = bz - az;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
    }
  }
  return best;
}

// Deterministic random numbers so the scenery is the same every visit.
export function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
