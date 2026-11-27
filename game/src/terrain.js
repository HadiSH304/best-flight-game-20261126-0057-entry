// Pulau Kencana: one island, one style. The terrain is a height function
// plus the placed features the missions use: the runway, the ring course,
// the supply drop zones, the town, the lighthouse and the clouds.
// Nothing here draws anything; render.js asks for heights and features.
import { RUNWAY, RINGS, SUPPLY } from './config.js';
import { createRandom, noise2 } from './random.js';

/** Island radius, metres. */
const ISLAND_RADIUS = 2300;
/** The flat apron the runway sits on. */
const APRON = { x0: -560, x1: 560, z0: 60, z1: 560 };

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Ground height in metres at (x, z). Sea level is 0; the island rises to
 * about 190 m on its ridge. The runway apron is flattened to the runway
 * height so landings read on flat ground.
 */
export function groundHeight(x, z) {
  const r = Math.hypot(x, z - 150);
  const falloff = 1 - smoothstep(ISLAND_RADIUS * 0.55, ISLAND_RADIUS, r);
  if (falloff <= 0) return -6;
  let h = falloff * 95;
  h += 28 * noise2(x * 0.0016 + 7, z * 0.0016 - 3);
  h += 14 * noise2(x * 0.004 + 21, z * 0.004 + 11);
  // A ridge along the island's far north spine, kept low so the centre
  // of the island stays green and the runway stays visible over it.
  const ridge = Math.exp(-((z + 1150) * (z + 1150)) / (2 * 420 * 420));
  h += 24 * ridge * falloff;
  // A flat coastal valley along the runway's east-west axis, so the
  // landing approach flies over level ground instead of a hillside. The
  // floor is flat near the centreline and rises to the hills at the
  // valley's edges, so a touchdown anywhere in the valley is survivable.
  const dz = Math.abs(z - RUNWAY.z);
  if (dz < 260 && x > -1900 && x < 1900) {
    const cap = 8 + 40 * smoothstep(0, 1, (dz - 140) / 120);
    const tx = smoothstep(0, 1, Math.min(x + 1900, 1900 - x) / 200);
    h = Math.min(h, cap) * tx + h * (1 - tx);
  }
  // Flatten the runway apron into the island.
  if (x > APRON.x0 && x < APRON.x1 && z > APRON.z0 && z < APRON.z1) {
    const edge = Math.min(x - APRON.x0, APRON.x1 - x, z - APRON.z0, APRON.z1 - z) / 90;
    const blend = smoothstep(0, 1, edge);
    h = RUNWAY.height * (1 - blend) + h * blend;
    h = Math.max(h, RUNWAY.height);
  }
  return h;
}

/** True when (x, z) is on the runway strip. */
export function onRunway(x, z) {
  return Math.abs(x - RUNWAY.x) <= RUNWAY.length / 2 && Math.abs(z - RUNWAY.z) <= RUNWAY.width / 2;
}

/**
 * True when (x, z) is on the runway or its shoulders: the landing check
 * allows a few metres either side, so a landing a metre off the painted
 * edge still counts as a landing, not a crash.
 */
export function onAirfield(x, z) {
  return Math.abs(x - RUNWAY.x) <= RUNWAY.length / 2 + 10 && Math.abs(z - RUNWAY.z) <= RUNWAY.width / 2 + 4;
}

/** True when (x, z) is inside the touchdown zone (first third, runway 09). */
export function inTouchdownZone(x, z) {
  return onRunway(x, z) && x > -RUNWAY.length / 2 + 40 && x < -RUNWAY.length / 2 + 260;
}

/**
 * Build the island's fixed features from a seed: the 8-ring slalom course,
 * the 3 supply drop zones, the town, the lighthouse and the clouds.
 * Ring headings face along the course so a pilot flies through them, not
 * across them.
 */
export function createTerrain(seed) {
  const random = createRandom(seed);

  const rings = [];
  const course = [
    { x: -900, z: -700, y: 260 },
    { x: -300, z: -1150, y: 300 },
    { x: 500, z: -900, y: 240 },
    { x: 1100, z: -250, y: 200 },
    { x: 900, z: 700, y: 180 },
    { x: 150, z: 1150, y: 220 },
    { x: -700, z: 950, y: 260 },
    { x: -1150, z: 150, y: 300 },
  ];
  for (let i = 0; i < RINGS.count; i += 1) {
    const at = course[i];
    const next = course[(i + 1) % course.length];
    const facing = Math.atan2(next.x - at.x, -(next.z - at.z));
    rings.push({ x: at.x, y: at.y, z: at.z, facing, passed: false });
  }

  const zones = [
    { x: 620, z: 620, label: 'ZONE A' },
    { x: -520, z: 900, label: 'ZONE B' },
    { x: 240, z: -420, label: 'ZONE C' },
  ];

  // The town: a dozen houses in two streets beside the runway's east end.
  const town = [];
  for (let i = 0; i < 14; i += 1) {
    const col = i % 7;
    const row = Math.floor(i / 7);
    town.push({
      x: 480 + col * 46 + random() * 14,
      z: 620 + row * 52 + random() * 12,
      w: 26 + random() * 10,
      d: 22 + random() * 8,
      h: 14 + random() * 12,
      hue: random(),
    });
  }

  const lighthouse = { x: -1560, z: 1180 };

  // Palm clusters along the south beach.
  const palms = [];
  for (let i = 0; i < 26; i += 1) {
    const a = random() * Math.PI * 2;
    const r = 1750 + random() * 320;
    palms.push({ x: Math.cos(a) * r, z: 150 + Math.sin(a) * r * 0.9 });
  }

  // Clouds drift slowly; their base positions are fixed by the seed.
  const clouds = [];
  for (let i = 0; i < 16; i += 1) {
    clouds.push({
      x: (random() - 0.5) * 7000,
      y: 480 + random() * 260,
      z: (random() - 0.5) * 7000,
      s: 90 + random() * 160,
    });
  }

  return { rings, zones, town, lighthouse, palms, clouds, zoneRadius: SUPPLY.zoneRadius };
}
