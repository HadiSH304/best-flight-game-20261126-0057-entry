// The three missions, each with a different goal, and the score.
// A mission owns its objective text, its progress and its completion;
// the flight model only reports what happened (touchdown, crash).
import { MISSIONS, RUNWAY, RINGS, SUPPLY } from './config.js';
import { EVENT_CRASH, EVENT_LANDED, KT_TO_MS } from './flight-model.js';
import { groundHeight, inTouchdownZone } from './terrain.js';

export const MISSION_RING = 1;
export const MISSION_LANDED = 2;
export const MISSION_CRATE = 4;
export const MISSION_DONE = 8;
export const MISSION_FAILED = 16;

function distance3(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

export function createMissions(terrain) {
  const state = {
    index: 0,
    score: 0,
    ringsPassed: 0,
    cratesDropped: 0,
    cratesHit: 0,
    timeLeft: 0,
    done: false,
    failed: false,
    banner: '',
    bannerUntil: 0,
    crates: [],
  };

  function spawnFor(index) {
    if (index === 0) return { x: 0, y: 420, z: -1900, heading: 150, speedKt: 110, throttle: 0.72 };
    if (index === 1) return { x: -1600, y: 210, z: 300, heading: 90, speedKt: 95, throttle: 0.6 };
    return { x: -700, y: 380, z: -900, heading: 55, speedKt: 115, throttle: 0.75 };
  }

  function start(index) {
    state.index = index;
    state.ringsPassed = 0;
    state.cratesDropped = 0;
    state.cratesHit = 0;
    state.timeLeft = index === 2 ? SUPPLY.timeLimit : 0;
    state.done = false;
    state.failed = false;
    state.banner = '';
    state.crates = [];
    for (const ring of terrain.rings) ring.passed = false;
    return spawnFor(index);
  }

  function showBanner(text, now, seconds) {
    state.banner = text;
    state.bannerUntil = now + seconds;
  }

  function mission() {
    return MISSIONS[state.index];
  }

  /** Objective line for the HUD, always naming the goal and the progress. */
  function objective() {
    if (state.index === 0) return `RING ${state.ringsPassed}/${RINGS.count} — next ring ${Math.max(0, state.ringsPassed + 1)}`;
    if (state.index === 1) return 'LAND ON RUNWAY 09 — inside the touchdown zone';
    return `SUPPLY DROP — crates ${state.cratesHit}/3 on target · ${Math.ceil(state.timeLeft)}s left`;
  }

  function nextRing() {
    return terrain.rings.find((ring) => !ring.passed) ?? null;
  }

  /** Drop a crate under the aircraft. It keeps the aircraft's forward
   * speed (with drag) and falls under gravity, so the pilot must lead the
   * zone: drop before it, not over it. */
  function dropCrate(flight) {
    if (state.index !== 2 || state.done || state.failed) return false;
    if (state.cratesDropped >= 3) return false;
    const fwd = { x: Math.sin((flight.state.heading * Math.PI) / 180), z: -Math.cos((flight.state.heading * Math.PI) / 180) };
    const speedMs = flight.state.speedKt * 0.514444;
    state.crates.push({
      x: flight.state.x,
      y: flight.state.y - 2,
      z: flight.state.z,
      vx: fwd.x * speedMs,
      vz: fwd.z * speedMs,
      vy: 0,
      scored: false,
    });
    state.cratesDropped += 1;
    return true;
  }

  /**
   * One fixed step of mission logic. Returns event flags for sound and
   * banners. `flight` is the flight model, `now` is flight time.
   */
  function step(dt, flight, flightEvents) {
    let events = 0;
    const f = flight.state;

    if (state.timeLeft > 0 && !state.done && !state.failed) {
      state.timeLeft -= dt;
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        state.failed = true;
        showBanner('OUT OF TIME — SUPPLY RUN FAILED', f.time, 4);
        events |= MISSION_FAILED;
      }
    }

    // Falling crates: gravity, forward speed bleeding off with drag, then
    // score against the zones where they land.
    for (const crate of state.crates) {
      if (crate.scored) continue;
      crate.vy += 9.81 * dt;
      crate.y -= crate.vy * dt;
      crate.vx *= 1 - 0.18 * dt;
      crate.vz *= 1 - 0.18 * dt;
      crate.x += crate.vx * dt;
      crate.z += crate.vz * dt;
      const ground = groundHeight(crate.x, crate.z);
      if (crate.y <= ground + 1) {
        crate.y = ground + 1;
        crate.scored = true;
        let hit = false;
        for (const zone of terrain.zones) {
          if (Math.hypot(crate.x - zone.x, crate.z - zone.z) <= terrain.zoneRadius) hit = true;
        }
        if (hit) {
          state.cratesHit += 1;
          state.score += 250;
          showBanner(`CRATE ON TARGET — ${state.cratesHit}/3`, f.time, 2.5);
          events |= MISSION_CRATE;
          if (state.cratesHit >= 3) {
            state.done = true;
            state.score += 500;
            showBanner('SUPPLY RUN COMPLETE — ALL CRATES DELIVERED', f.time, 4);
            events |= MISSION_DONE;
          }
        } else {
          showBanner('CRATE MISSED THE ZONE', f.time, 2);
        }
      }
    }

    // Ring run: pass through the next ring's disc to count it.
    if (state.index === 0 && !state.done) {
      const ring = nextRing();
      if (ring) {
        const d = distance3(f, ring);
        const along = (f.x - ring.x) * Math.sin(ring.facing) + (f.z - ring.z) * -Math.cos(ring.facing);
        if (d < RINGS.passRadius && Math.abs(along) < 14) {
          ring.passed = true;
          state.ringsPassed += 1;
          state.score += 150;
          showBanner(`RING ${state.ringsPassed}/${RINGS.count} — CLEAN PASS`, f.time, 2);
          events |= MISSION_RING;
          if (state.ringsPassed >= RINGS.count) {
            state.done = true;
            state.score += 600;
            showBanner('RING RUN COMPLETE — COURSE RECORD', f.time, 4);
            events |= MISSION_DONE;
          }
        }
      }
    }

    // Landing: a touchdown inside the zone completes the mission.
    if (flightEvents & EVENT_LANDED) {
      if (state.index === 1 && !state.done) {
        if (inTouchdownZone(f.x, f.z)) {
          state.done = true;
          state.score += 800;
          showBanner('LANDED IN THE ZONE — TEXTBOOK', f.time, 4);
          events |= MISSION_DONE;
        } else {
          showBanner('LANDED — BUT OUTSIDE THE ZONE', f.time, 3);
        }
      } else if (state.index !== 1) {
        showBanner('LANDED SAFELY', f.time, 3);
      }
    }
    if (flightEvents & EVENT_CRASH) {
      state.failed = true;
      showBanner('CRASHED — AIRCRAFT LOST', f.time, 4);
      events |= MISSION_FAILED;
    }

    // Flying rewards throttle and turn discipline: a smooth pass at speed
    // earns a small trickle; stalling earns nothing.
    if (!f.onGround && !f.crashed && f.speedKt > 70 && Math.abs(f.bank) < 45) {
      state.score += dt * 2;
    }
    return events;
  }

  return { state, start, mission, objective, nextRing, dropCrate, step, spawnFor };
}
