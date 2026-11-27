// The flight model: throttle, banked turns, stall, fuel and damage.
// Everything is in the state object; step() advances one fixed step and
// returns bit flags for what happened, so missions and sound can react
// without the model knowing about screens.
import { PLANE, RUNWAY, STEP } from './config.js';
import { groundHeight, onAirfield, inTouchdownZone } from './terrain.js';

export const EVENT_TOUCHDOWN = 1;
export const EVENT_CRASH = 2;
export const EVENT_STALL = 4;
export const EVENT_FUEL_EMPTY = 8;
export const EVENT_LANDED = 16;

export const KT_TO_MS = 0.514444;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function angleDelta(from, to) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

/** Heading (deg) to a unit forward vector. 0 is north (-z), 90 is east (+x). */
export function headingVector(headingDeg) {
  const r = (headingDeg * Math.PI) / 180;
  return { x: Math.sin(r), y: 0, z: -Math.cos(r) };
}

/** Compass heading (deg) of a forward vector. */
export function vectorHeading(fx, fz) {
  return (Math.atan2(fx, -fz) * 180) / Math.PI;
}

export function createFlight() {
  const state = {
    x: 0,
    y: 420,
    z: -1900,
    heading: 150,
    pitch: 0,
    bank: 0,
    speedKt: 110,
    throttle: 0.72,
    fuel: 100,
    damage: 0,
    verticalSpeed: 0,
    onGround: false,
    crashed: false,
    landed: false,
    stalled: false,
    time: 0,
  };

  function reset(spawn) {
    state.x = spawn.x;
    state.y = spawn.y;
    state.z = spawn.z;
    state.heading = spawn.heading;
    state.pitch = 0;
    state.bank = 0;
    state.speedKt = spawn.speedKt ?? 110;
    state.throttle = spawn.throttle ?? 0.72;
    state.fuel = spawn.fuel ?? 100;
    state.damage = 0;
    state.verticalSpeed = 0;
    state.onGround = false;
    state.crashed = false;
    state.landed = false;
    state.stalled = false;
    state.time = 0;
  }

  /**
   * One fixed step. `stick` is { roll: -1..1, pitch: -1..1,
   * throttle: -1..1 (change), brake: bool }. Returns event flags.
   */
  function step(dt, stick) {
    if (state.crashed || state.landed) return 0;
    let events = 0;
    state.time += dt;

    // Throttle answers the stick at every speed; empty tanks answer nothing.
    if (state.fuel > 0) {
      state.throttle = clamp(state.throttle + stick.throttle * dt * 0.55, 0, 1);
    } else {
      state.throttle = Math.max(0, state.throttle - dt * 0.8);
      if (state.throttle === 0 && !state.fuelEmptyAnnounced) {
        state.fuelEmptyAnnounced = true;
        events |= EVENT_FUEL_EMPTY;
      }
    }
    state.fuel = Math.max(0, state.fuel - PLANE.fuelBurn * state.throttle * dt);

    // Speed chases the throttle's target; drag grows with the square of it.
    const speedMs = state.speedKt * KT_TO_MS;
    const targetMs = state.throttle * PLANE.maxSpeedKt * KT_TO_MS;
    const drag = 0.02 + 0.00012 * speedMs * speedMs;
    state.speedKt += ((targetMs - speedMs) / KT_TO_MS - drag * state.speedKt) * dt * 0.55;
    state.speedKt = clamp(state.speedKt, 0, PLANE.maxSpeedKt * 1.08);
    if (state.onGround && stick.brake) state.speedKt = Math.max(0, state.speedKt - 55 * dt);

    // Bank and pitch answer the stick; a stalled wing will not hold a bank.
    const stalled = state.speedKt < PLANE.stallSpeedKt && !state.onGround;
    if (stalled && !state.stalled) events |= EVENT_STALL;
    state.stalled = stalled;
    const bankTarget = stalled ? 0 : stick.roll * PLANE.maxBank;
    state.bank += clamp(bankTarget - state.bank, -PLANE.rollRate * dt, PLANE.rollRate * dt);
    const pitchTarget = stalled ? -9 : stick.pitch * PLANE.maxPitch;
    state.pitch += clamp(pitchTarget - state.pitch, -PLANE.pitchRate * dt, PLANE.pitchRate * dt);

    // A banked turn is a coordinated turn: heading rate grows with bank
    // and shrinks with speed, so tight turns cost speed discipline.
    const turnRate = (9.81 * Math.tan((state.bank * Math.PI) / 180)) / Math.max(20, speedMs);
    state.heading = (state.heading + (turnRate * 180) / Math.PI * dt + 360) % 360;

    // The pitch angle is the flight path angle: the vertical speed is the
    // speed along the flight path, so a -4 deg descent at 80 kt is about
    // -2.8 m/s — gentle enough to land on. Below stall speed the wing
    // stops lifting and the aircraft sinks.
    const climbMs = speedMs * Math.sin((state.pitch * Math.PI) / 180);
    const sinkMs = stalled ? (PLANE.stallSpeedKt - state.speedKt) * KT_TO_MS * 0.55 : 0;
    state.verticalSpeed = climbMs - sinkMs;

    const fwd = headingVector(state.heading);
    state.x += fwd.x * speedMs * dt;
    state.z += fwd.z * speedMs * dt;
    state.y += state.verticalSpeed * dt;

    // Wind pushes the aircraft sideways; on the landing mission it is a
    // crosswind from the north that the pilot must crab into: it drifts
    // the aircraft south, across runway 09.
    state.z += (PLANE.crosswindKt * KT_TO_MS * 0.28) * dt;

    // Ground contact: a gentle touchdown on the runway is a landing; a
    // gentle touchdown anywhere else is a rough landing — damage once,
    // then a roll-out the pilot can take off from again. Only a hard
    // impact, a steeply banked touchdown or an overspeed one is a crash.
    const ground = groundHeight(state.x, state.z);
    if (state.y <= ground + 1.4) {
      state.y = ground + 1.4;
      if (!state.onGround) {
        const vs = state.verticalSpeed;
        const aligned = Math.abs(angleDelta(state.heading, RUNWAY.heading)) < 22 || Math.abs(angleDelta(state.heading, RUNWAY.heading + 180)) < 22;
        if (onAirfield(state.x, state.z) && vs > -3.2 && Math.abs(state.bank) < 12 && aligned && state.speedKt > 45 && state.speedKt < 115) {
          state.onGround = true;
          state.landed = true;
          state.pitch = 0;
          state.bank = 0;
          state.verticalSpeed = 0;
          events |= EVENT_TOUCHDOWN | EVENT_LANDED;
        } else if (vs < -6 || Math.abs(state.bank) > 35 || state.speedKt > 130) {
          state.crashed = true;
          state.damage = 100;
          events |= EVENT_CRASH;
        } else {
          // A rough touchdown: damage once per landing event, then a
          // roll-out the pilot can take off from again. A porpoise —
          // touch, lift, touch again within a few seconds — is one
          // landing, not five, so damage has a short cooldown.
          if (state.time - (state.lastRoughTouchdown ?? -99) > 3) {
            state.damage = Math.min(100, state.damage + 22);
            state.lastRoughTouchdown = state.time;
          }
          state.onGround = true;
          state.pitch = 0;
          state.bank = 0;
          state.verticalSpeed = 0;
          events |= EVENT_TOUCHDOWN;
          if (state.damage >= 100) {
            state.crashed = true;
            events |= EVENT_CRASH;
          }
        }
      } else {
        state.verticalSpeed = 0;
        state.pitch = 0;
      }
      if (state.onGround) {
        // Rolling out: speed bleeds off, steering stays on the ground.
        state.speedKt = Math.max(0, state.speedKt - 9 * dt);
        state.y = ground + 1.4;
      }
    }

    // Take-off again: full throttle and a pull on the stick lift off, so a
    // landing outside the zone is a go-around, not a dead end. This runs
    // outside the ground-contact block on purpose: the moment the stick
    // pulls up, the aircraft is already climbing off the ground, and the
    // contact block no longer runs.
    if (state.onGround && state.throttle > 0.7 && stick.pitch > 0.2 && state.speedKt > 70) {
      state.onGround = false;
      state.landed = false;
      state.pitch = 5;
    }
    return events;
  }

  return { state, reset, step };
}

export { STEP };
