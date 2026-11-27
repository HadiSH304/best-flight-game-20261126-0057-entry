// The screenshot scenes behind ?shot=cover|rings|landing|supply.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot (bank toward the target
// heading, pitch toward the target altitude, throttle to hold 110 kt), so
// the frame is what a short flight really looks like and the same seed
// always gives the same frame.
import { STEP, RUNWAY } from './config.js';

const SAMPLE = STEP;

/** Heading (deg) from the aircraft to a target point. */
function headingTo(from, target) {
  const dx = target.x - from.x;
  const dz = target.z - from.z;
  return (Math.atan2(dx, -dz) * 180) / Math.PI;
}

function angleDelta(from, to) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/**
 * Steer toward `target` at `targetAlt` metres: bank into the heading error,
 * pitch to the altitude error, throttle to hold 110 kt.
 */
function autopilot(flight, target, targetAlt) {
  const f = flight.state;
  const wantHeading = headingTo(f, target);
  const err = angleDelta(f.heading, wantHeading);
  // The bank is capped: a gentle, readable turn beats a snap roll, and a
  // capped bank keeps the camera (and the screenshot) level.
  const roll = Math.max(-0.75, Math.min(0.75, err / 35));
  const altErr = targetAlt - f.y;
  const pitch = Math.max(-1, Math.min(1, altErr / 90));
  const speedErr = 110 - f.speedKt;
  const throttle = Math.max(-1, Math.min(1, speedErr / 25));
  return { roll, pitch, throttle, brake: false };
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * world is { flight, missions, camera, terrain }.
 */
export function stageShot(name, world) {
  const { flight, missions, camera, terrain } = world;
  const f = flight.state;

  if (name === 'landing') {
    // Short final on runway 09: 900 m out, 150 m up, cockpit view, the
    // runway dead ahead with the crosswind readout on the HUD.
    missions.start(1);
    flight.reset({ x: -1250, y: 165, z: 300, heading: 90, speedKt: 92, throttle: 0.55 });
    camera.setView('cockpit');
    const threshold = { x: -RUNWAY.length / 2 + 60, y: RUNWAY.height, z: RUNWAY.z };
    // Fly the glide slope down to ~380 m short of the threshold, where the
    // runway fills the windscreen: the shot is an approach, not a crash.
    for (let i = 0; i < 22 / SAMPLE; i += 1) {
      const glideAlt = RUNWAY.height + Math.max(14, (threshold.x - f.x) * 0.085);
      const stick = autopilot(flight, threshold, glideAlt);
      const events = flight.step(SAMPLE, stick);
      missions.step(SAMPLE, flight, events);
      if (f.onGround || f.crashed) break;
      if (threshold.x - f.x < 220 && f.y < 45) break;
    }
    return { screen: 'play' };
  }

  if (name === 'supply') {
    // Over drop zone A with a crate just released, fuel low enough that
    // the LOW FUEL warning shows: a decision moment, not a menu. The
    // spawn is close to the zone so the crate, the zone and the town are
    // all in frame at once.
    missions.start(2);
    flight.reset({ x: 100, y: 380, z: 100, heading: 135, speedKt: 115, throttle: 0.75, fuel: 17 });
    const zone = terrain.zones[0];
    for (let i = 0; i < 7 / SAMPLE; i += 1) {
      const stick = autopilot(flight, { x: zone.x, y: 60, z: zone.z }, 340);
      const events = flight.step(SAMPLE, stick);
      missions.step(SAMPLE, flight, events);
      // Drop late: the crate is just released, still beside the aircraft
      // and visible under the tail with its parachute open.
      if (i === Math.floor(6.2 / SAMPLE)) missions.dropCrate(flight);
      if (f.crashed) break;
    }
    return { screen: 'play' };
  }

  // Ring run scenes: cover is early in the course with the runway visible
  // below; rings is mid-course, past the first ring, with the next ring
  // large ahead. The ring scenes run until the next ring is close (about
  // 450 m), not for a fixed time, so the ring is always large in frame
  // and the turn into it is gentle.
  missions.start(0);
  const seconds = name === 'rings' ? 60 : 14;
  flight.reset({ x: 0, y: 420, z: -1900, heading: 150, speedKt: 110, throttle: 0.72 });
  camera.setView('chase');
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    const ring = missions.nextRing();
    const target = ring ?? { x: 0, y: 200, z: 0 };
    const stick = autopilot(flight, target, (ring ? ring.y : 200) - 10);
    const events = flight.step(SAMPLE, stick);
    missions.step(SAMPLE, flight, events);
    if (f.crashed) break;
    if (name === 'rings' && ring && missions.state.ringsPassed >= 1) {
      const d = Math.hypot(f.x - ring.x, f.y - ring.y, f.z - ring.z);
      if (d < 450) break;
    }
  }
  return { screen: 'play' };
}
