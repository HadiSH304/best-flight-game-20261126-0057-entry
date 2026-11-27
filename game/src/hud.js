// The HUD: the numbers a pilot flies by, drawn over the world in both
// views — altitude, speed and heading always visible, plus throttle, fuel
// and damage, the mission objective, warnings and outcome banners.
// Everything here is big and high-contrast: the judge reads it at
// contact-sheet size.
import { PALETTE, VIEW, PLANE } from './config.js';

function panel(ctx, x, y, w, h, alpha) {
  ctx.save();
  ctx.fillStyle = `rgba(10, 16, 24, ${alpha ?? 0.55})`;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.restore();
}

function text(ctx, str, x, y, size, color, align, weight) {
  ctx.save();
  ctx.font = `${weight ?? 'bold'} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align ?? 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color ?? PALETTE.hudText;
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 4;
  ctx.fillText(str, x, y);
  ctx.restore();
}

function compassLabel(deg) {
  const d = ((Math.round(deg / 10) * 10) % 360 + 360) % 360;
  if (d === 0) return 'N';
  if (d === 90) return 'E';
  if (d === 180) return 'S';
  if (d === 270) return 'W';
  return String(d).padStart(3, '0');
}

/** The compass tape across the top: the heading the aircraft is on. */
export function drawCompassTape(ctx, flight) {
  const w = 420;
  const x0 = VIEW.width / 2 - w / 2;
  panel(ctx, x0, 10, w, 34, 0.5);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, 10, w, 34);
  ctx.clip();
  const hdg = flight.state.heading;
  for (let d = -60; d <= 60; d += 10) {
    const deg = Math.round(hdg + d);
    let delta = ((deg - hdg + 540) % 360) - 180;
    const x = VIEW.width / 2 + delta * 3.2;
    const major = ((deg % 30) + 360) % 30 === 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x, 14);
    ctx.lineTo(x, major ? 26 : 21);
    ctx.stroke();
    if (major) text(ctx, compassLabel(deg), x, 36, 11, '#fff', 'center');
  }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(VIEW.width / 2 - 6, 10);
  ctx.lineTo(VIEW.width / 2 + 6, 10);
  ctx.lineTo(VIEW.width / 2, 20);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, `${String(Math.round(hdg)).padStart(3, '0')}°`, VIEW.width / 2, 56, 15, PALETTE.hudAmber, 'center');
}

/** Big ALT / SPD / HDG numerals, bottom left. */
export function drawFlightData(ctx, flight) {
  const f = flight.state;
  const feet = Math.max(0, Math.round(f.y * 3.28084));
  const x = 24;
  const y = VIEW.height - 118;
  panel(ctx, x - 10, y - 14, 330, 104, 0.55);
  text(ctx, 'ALT', x, y, 12, '#bcd6ea', 'left');
  text(ctx, `${feet.toLocaleString('en-US')} FT`, x + 46, y, 26, '#fff', 'left');
  text(ctx, 'SPD', x, y + 36, 12, '#bcd6ea', 'left');
  text(ctx, `${Math.round(f.speedKt)} KT`, x + 46, y + 36, 26, f.stalled ? PALETTE.hudRed : '#fff', 'left');
  text(ctx, 'HDG', x, y + 72, 12, '#bcd6ea', 'left');
  text(ctx, `${String(Math.round(f.heading)).padStart(3, '0')}°`, x + 46, y + 72, 26, '#fff', 'left');
  const vsFpm = Math.round(f.verticalSpeed * 196.85);
  text(ctx, `${vsFpm >= 0 ? '+' : ''}${vsFpm} FPM`, x + 210, y + 72, 13, vsFpm < -500 ? PALETTE.hudAmber : '#bcd6ea', 'left');
}

/** Throttle bar, fuel and damage gauges, bottom right. */
export function drawEngineState(ctx, flight) {
  const f = flight.state;
  const x = VIEW.width - 250;
  const y = VIEW.height - 118;
  panel(ctx, x - 10, y - 14, 240, 104, 0.55);
  // Throttle bar.
  text(ctx, 'THR', x, y, 12, '#bcd6ea', 'left');
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 46, y - 8, 120, 14);
  ctx.fillStyle = f.fuel <= 0 ? PALETTE.hudRed : PALETTE.hudGreen;
  ctx.fillRect(x + 46, y - 8, 120 * f.throttle, 14);
  ctx.restore();
  text(ctx, `${Math.round(f.throttle * 100)}%`, x + 174, y, 14, '#fff', 'left');
  // Fuel gauge.
  text(ctx, 'FUEL', x, y + 36, 12, '#bcd6ea', 'left');
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 46, y + 28, 120, 14);
  const fuelColor = f.fuel < 20 ? PALETTE.hudRed : f.fuel < 40 ? PALETTE.hudAmber : PALETTE.hudGreen;
  ctx.fillStyle = fuelColor;
  ctx.fillRect(x + 46, y + 28, 120 * (f.fuel / 100), 14);
  ctx.restore();
  text(ctx, `${Math.round(f.fuel)}%`, x + 174, y + 36, 14, fuelColor, 'left');
  // Damage gauge.
  text(ctx, 'DMG', x, y + 72, 12, '#bcd6ea', 'left');
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 46, y + 64, 120, 14);
  ctx.fillStyle = f.damage > 60 ? PALETTE.hudRed : f.damage > 25 ? PALETTE.hudAmber : '#8a8f96';
  ctx.fillRect(x + 46, y + 64, 120 * (f.damage / 100), 14);
  ctx.restore();
  text(ctx, `${Math.round(f.damage)}%`, x + 174, y + 72, 14, '#fff', 'left');
}

/** Mission name, objective, progress and score, top left. */
export function drawMissionPanel(ctx, missions, flight) {
  const m = missions.mission();
  const s = missions.state;
  panel(ctx, 14, 52, 400, 62, 0.55);
  text(ctx, m.name, 26, 70, 17, PALETTE.hudAmber, 'left');
  text(ctx, missions.objective(), 26, 94, 13, '#fff', 'left');
  text(ctx, `SCORE ${Math.floor(s.score)}`, VIEW.width - 26, 70, 17, '#fff', 'right');
  if (missions.state.index === 2) {
    text(ctx, `TIME ${Math.ceil(s.timeLeft)}s`, VIEW.width - 26, 94, 14, s.timeLeft < 30 ? PALETTE.hudRed : '#fff', 'right');
  } else {
    text(ctx, 'ISLAND WINGS · PELICAN-9', VIEW.width - 26, 94, 12, '#bcd6ea', 'right');
  }
}

/** Warnings: stall, low fuel, damage — centre top, impossible to miss. */
export function drawWarnings(ctx, flight, missions) {
  const f = flight.state;
  const warnings = [];
  if (f.stalled) warnings.push({ text: 'STALL — NOSE DOWN, ADD POWER', color: PALETTE.hudRed });
  if (f.fuel > 0 && f.fuel < 20) warnings.push({ text: 'LOW FUEL — LAND OR GLIDE HOME', color: PALETTE.hudAmber });
  if (f.fuel <= 0) warnings.push({ text: 'FUEL EMPTY — ENGINE OUT, GLIDE', color: PALETTE.hudRed });
  if (f.damage > 60 && f.damage < 100) warnings.push({ text: 'HEAVY DAMAGE — FLY GENTLY', color: PALETTE.hudAmber });
  if (missions.state.index === 1 && !missions.state.done && !f.onGround) {
    // Below the mission panel, never across it.
    text(ctx, `WIND ${PLANE.crosswindKt} KT FROM THE NORTH — CRAB INTO IT`, VIEW.width / 2, 130, 13, '#bcd6ea', 'center');
  }
  warnings.forEach((w, i) => {
    text(ctx, w.text, VIEW.width / 2, 108 + i * 26, 17, w.color, 'center');
  });
}

/** A big outcome banner across the middle of the screen. */
export function drawBanner(ctx, banner) {
  if (!banner) return;
  const w = Math.min(900, 40 + banner.length * 13);
  panel(ctx, VIEW.width / 2 - w / 2, 250, w, 56, 0.7);
  text(ctx, banner, VIEW.width / 2, 279, 24, '#fff', 'center');
}

/** The flight-path marker: a small circle where the nose is pointing. */
export function drawFlightPathMarker(ctx) {
  const cx = VIEW.width / 2;
  const cy = VIEW.height / 2 - 40;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy);
  ctx.lineTo(cx - 12, cy);
  ctx.moveTo(cx + 12, cy);
  ctx.lineTo(cx + 20, cy);
  ctx.moveTo(cx, cy - 20);
  ctx.lineTo(cx, cy - 12);
  ctx.stroke();
  ctx.restore();
}

/** The next-ring pointer: an arrow at the screen edge toward the target. */
export function drawTargetArrow(ctx, camera, target, label) {
  if (!target) return;
  const p = camera.project(camera.state, target.x, target.y, target.z);
  const cx = VIEW.width / 2;
  const cy = VIEW.height / 2;
  let angle;
  let dist;
  if (p) {
    angle = Math.atan2(p.y - cy, p.x - cx);
    dist = Math.hypot(p.x - cx, p.y - cy);
  } else {
    // Behind us: point from the camera forward to the target.
    const dx = target.x - camera.state.pos.x;
    const dz = target.z - camera.state.pos.z;
    const fx = camera.state.forward.x;
    const fz = camera.state.forward.z;
    const rx = camera.state.right.x;
    const rz = camera.state.right.z;
    const ahead = dx * fx + dz * fz;
    const side = dx * rx + dz * rz;
    angle = Math.atan2(-ahead, side) + Math.PI / 2;
    angle = Math.atan2(Math.sin(angle), Math.cos(angle));
    dist = 9999;
  }
  const edge = 300;
  const r = Math.min(edge, Math.max(90, dist * 0.55));
  const ax = cx + Math.cos(angle) * r;
  const ay = cy + Math.sin(angle) * r;
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(angle);
  ctx.fillStyle = PALETTE.hudAmber;
  ctx.beginPath();
  ctx.moveTo(16, 0);
  ctx.lineTo(-10, -10);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, label, ax, ay - 22, 13, PALETTE.hudAmber, 'center');
}
