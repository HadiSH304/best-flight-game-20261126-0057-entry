// The camera and the 3D projection. One camera, two views: chase (behind
// and above the Pelican-9, smooth-following so it never fights the pilot)
// and cockpit (fixed to the airframe, looking down the nose).
// project() turns a world point into screen space; it returns null when
// the point is behind the camera.
import { VIEW } from './config.js';
import { headingVector } from './flight-model.js';

const FOV = (68 * Math.PI) / 180;

/** The bank the camera rolls with: full in the cockpit, a third in chase. */
function cameraRollBank(bankDeg, view) {
  return view === 'cockpit' ? bankDeg : bankDeg * 0.35;
}

export function createCamera() {
  const state = {
    view: 'chase',
    /** Smoothed chase position, so the camera glides instead of snapping. */
    cx: 0,
    cy: 0,
    cz: 0,
    /** Smoothed look direction. */
    lx: 0,
    ly: 0,
    lz: 0,
    ready: false,
    focal: (VIEW.height / 2) / Math.tan(FOV / 2),
    /** Basis vectors of the current frame, for project(). */
    right: { x: 1, y: 0, z: 0 },
    up: { x: 0, y: 1, z: 0 },
    forward: { x: 0, y: 0, z: -1 },
    pos: { x: 0, y: 0, z: 0 },
    /** Where the horizon sits on screen for this frame (pixels from top). */
    horizonY: VIEW.height / 2,
  };

  function setView(view) {
    state.view = view;
    state.ready = false;
  }

  function update(flight, dt) {
    const f = flight.state;
    const fwd = headingVector(f.heading);
    // Pitch tilts the forward vector down/up.
    const pitchR = (f.pitch * Math.PI) / 180;
    const fx = fwd.x * Math.cos(pitchR);
    const fy = Math.sin(pitchR);
    const fz = fwd.z * Math.cos(pitchR);

    let target;
    if (state.view === 'cockpit') {
      target = {
        px: f.x + fx * 1.2,
        py: f.y + 0.6,
        pz: f.z + fz * 1.2,
        lx: f.x + fx * 60,
        ly: f.y + fy * 60,
        lz: f.z + fz * 60,
      };
    } else {
      const back = 13;
      const up = 4.2;
      target = {
        px: f.x - fx * back,
        py: f.y + up,
        pz: f.z - fz * back,
        lx: f.x + fx * 40,
        ly: f.y + fy * 40 - 1,
        lz: f.z + fz * 40,
      };
    }

    if (!state.ready) {
      state.cx = target.px;
      state.cy = target.py;
      state.cz = target.pz;
      state.lx = target.lx;
      state.ly = target.ly;
      state.lz = target.lz;
      state.ready = true;
    } else {
      const k = state.view === 'cockpit' ? 1 : Math.min(1, dt * 7);
      state.cx += (target.px - state.cx) * k;
      state.cy += (target.py - state.cy) * k;
      state.cz += (target.pz - state.cz) * k;
      state.lx += (target.lx - state.lx) * k;
      state.ly += (target.ly - state.ly) * k;
      state.lz += (target.lz - state.lz) * k;
    }

    state.pos = { x: state.cx, y: state.cy, z: state.cz };
    let fdx = state.lx - state.cx;
    let fdy = state.ly - state.cy;
    let fdz = state.lz - state.cz;
    const len = Math.hypot(fdx, fdy, fdz) || 1;
    fdx /= len;
    fdy /= len;
    fdz /= len;
    // Roll the camera with the aircraft: in the cockpit the horizon tilts
    // with the bank, which is what a pilot sees; in chase view only a
    // third of the bank reaches the camera, so a steep turn never throws
    // the whole world sideways.
    const bankR = (cameraRollBank(f.bank, state.view) * Math.PI) / 180;
    // Start from world-up with the forward component removed:
    const wx = 0;
    const wy = 1;
    const wz = 0;
    const dot = wx * fdx + wy * fdy + wz * fdz;
    let rx = wx - dot * fdx;
    let ry = wy - dot * fdy;
    let rz = wz - dot * fdz;
    const rlen = Math.hypot(rx, ry, rz) || 1;
    rx /= rlen;
    ry /= rlen;
    rz /= rlen;
    // Rotate that up vector around forward by the bank angle.
    const cosB = Math.cos(bankR);
    const sinB = Math.sin(bankR);
    const up2x = rx * cosB + (fdy * rz - fdz * ry) * sinB;
    const up2y = ry * cosB + (fdz * rx - fdx * rz) * sinB;
    const up2z = rz * cosB + (fdx * ry - fdy * rx) * sinB;
    // right = forward x up
    const gx = fdy * up2z - fdz * up2y;
    const gy = fdz * up2x - fdx * up2z;
    const gz = fdx * up2y - fdy * up2x;

    state.forward = { x: fdx, y: fdy, z: fdz };
    state.up = { x: up2x, y: up2y, z: up2z };
    state.right = { x: gx, y: gy, z: gz };

    // Horizon: where a point at eye level, infinitely far ahead, lands.
    const horizon = project(state, state.cx + fdx * 1000, state.cy, state.cz + fdz * 1000);
    state.horizonY = horizon ? horizon.y : VIEW.height / 2;
  }

  /** Project a world point to screen pixels, or null when behind us. */
  function project(camera, x, y, z) {
    const dx = x - camera.pos.x;
    const dy = y - camera.pos.y;
    const dz = z - camera.pos.z;
    const cz = dx * camera.forward.x + dy * camera.forward.y + dz * camera.forward.z;
    if (cz < 2) return null;
    const cx = dx * camera.right.x + dy * camera.right.y + dz * camera.right.z;
    const cy = dx * camera.up.x + dy * camera.up.y + dz * camera.up.z;
    return {
      x: VIEW.width / 2 + (cx / cz) * camera.focal,
      y: VIEW.height / 2 - (cy / cz) * camera.focal,
      depth: cz,
      scale: camera.focal / cz,
    };
  }

  return { state, setView, update, project };
}
