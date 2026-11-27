// Island Wings — every tuning number and colour in one place.
// The world is metres: x east, z south, y up. Heading 0 is north (-z),
// 90 is east (+x). Speeds are knots; the flight model converts to m/s.
export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Sea level; the island rises out of it. */
export const SEA_LEVEL = 0;

export const PLANE = {
  /** Knots at full throttle, level flight. */
  maxSpeedKt: 185,
  /** Knots below which the wing stops lifting and the nose drops. */
  stallSpeedKt: 55,
  /** Knots: the sweet spot for a landing approach. */
  approachSpeedKt: 78,
  /** How fast the bank answers the stick, degrees per second. */
  rollRate: 95,
  /** How fast the pitch answers the stick, degrees per second. */
  pitchRate: 55,
  /** Steepest bank the stick asks for, degrees. */
  maxBank: 58,
  /** Steepest climb/descent the stick asks for, degrees. */
  maxPitch: 24,
  /** Fuel percent burned per second at full throttle. */
  fuelBurn: 0.32,
  /** Knots of wind from the north on the landing mission (crosswind). */
  crosswindKt: 14,
};

export const RUNWAY = {
  /** Centre of the runway, metres. */
  x: 0,
  z: 300,
  /** Length and width, metres. Runway 09 runs east-west. */
  length: 760,
  width: 34,
  /** Ground height under the runway, metres. */
  height: 9,
  /** Heading of runway 09, degrees. */
  heading: 90,
};

export const RINGS = {
  count: 8,
  /** Ring radius, metres. */
  radius: 30,
  /** Pass within this of the centre to count, metres. */
  passRadius: 26,
};

export const SUPPLY = {
  zones: 3,
  /** Drop-zone radius, metres. */
  zoneRadius: 42,
  /** Seconds on the clock for the supply run. */
  timeLimit: 150,
};

export const MISSIONS = [
  { id: 'rings', name: 'RING RUN', goal: 'Fly through all 8 rings in order', blurb: '8 rings, in order' },
  { id: 'landing', name: 'CROSSWIND LANDING', goal: 'Land on runway 09 inside the touchdown zone', blurb: 'Land in the zone' },
  { id: 'supply', name: 'SUPPLY DROP', goal: 'Drop 3 crates on the marked zones before the clock runs out', blurb: '3 crates, beat the clock' },
];

export const PALETTE = {
  skyTop: '#2f6fb4',
  skyMid: '#7fb2dd',
  skyHorizon: '#f6d9a0',
  sun: '#fff3c4',
  seaDeep: '#1d5f8a',
  seaShallow: '#3f9db8',
  seaGlitter: '#ffe9a8',
  sand: '#e8d29a',
  grass: '#5da24a',
  forest: '#2f7a3d',
  rock: '#8a7f72',
  runway: '#3a3f46',
  runwayMark: '#f4f6f0',
  townRoof: '#c65b4e',
  townWall: '#f2e6cf',
  cloud: '#ffffff',
  panel: '#1c2129',
  panelFace: '#f4efe2',
  gaugeNeedle: '#d8443a',
  hudText: '#ffffff',
  hudAmber: '#ffb02e',
  hudRed: '#ff5347',
  hudGreen: '#7ddc6a',
  aircraftBody: '#e8542f',
  aircraftWing: '#f2f0e8',
  aircraftTrim: '#1f4e79',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'island-wings.best';
