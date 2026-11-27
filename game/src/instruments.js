// The cockpit instruments, drawn as flown instruments: a six-pack of round
// gauges with lit faces, luminous needles and a moving horizon. Each gauge
// is drawn from the flight state, so the panel always tells the truth.
import { PALETTE } from './config.js';

function gaugeFace(ctx, x, y, r, label) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.panelFace;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#2b2f36';
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, r - 4, 0, Math.PI * 2);
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#8a8f96';
  ctx.stroke();
  ctx.fillStyle = '#2b2f36';
  ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + r - 9);
  ctx.restore();
}

function needle(ctx, x, y, angle, length, color, width) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -length);
  ctx.lineWidth = width ?? 2;
  ctx.strokeStyle = color ?? PALETTE.gaugeNeedle;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#2b2f36';
  ctx.fill();
  ctx.restore();
}

function ticks(ctx, x, y, r, count, majorEvery, labelFn) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#2b2f36';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const major = i % majorEvery === 0;
    const r0 = r - (major ? 9 : 5);
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
    ctx.lineTo(Math.sin(a) * (r - 2), -Math.cos(a) * (r - 2));
    ctx.lineWidth = major ? 2 : 1;
    ctx.strokeStyle = '#2b2f36';
    ctx.stroke();
    if (labelFn && major) {
      ctx.fillText(labelFn(i), Math.sin(a) * (r - 18), -Math.cos(a) * (r - 18));
    }
  }
  ctx.restore();
}

/** Attitude indicator: a horizon that rolls with the bank and slides with the pitch. */
export function drawAttitudeIndicator(ctx, x, y, r, flight) {
  const f = flight.state;
  gaugeFace(ctx, x, y, r, 'ATT');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 4, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate((-f.bank * Math.PI) / 180);
  const pitchPx = (f.pitch / 24) * (r - 4);
  ctx.fillStyle = '#3f8fd2';
  ctx.fillRect(-r, -r - pitchPx, r * 2, r - pitchPx + 0);
  ctx.fillStyle = '#8a6b46';
  ctx.fillRect(-r, -pitchPx, r * 2, r + pitchPx);
  ctx.strokeStyle = '#f4f6f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, -pitchPx);
  ctx.lineTo(r, -pitchPx);
  ctx.stroke();
  ctx.restore();
  // Fixed wings: the aircraft symbol never moves, the horizon does.
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#f4f6f0';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r + 8, 0);
  ctx.lineTo(-6, 0);
  ctx.moveTo(6, 0);
  ctx.lineTo(r - 8, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, 3, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.gaugeNeedle;
  ctx.fill();
  ctx.restore();
}

/** Airspeed indicator, knots, 0–200. */
export function drawAirspeedIndicator(ctx, x, y, r, flight) {
  const f = flight.state;
  gaugeFace(ctx, x, y, r, 'AIRSPEED');
  ticks(ctx, x, y, r - 4, 20, 5, (i) => String(i * 10));
  needle(ctx, x, y, ((f.speedKt / 200) * 270 - 135) * (Math.PI / 180), r - 14);
}

/** Altimeter, feet, with a digital readout under the needle. */
export function drawAltimeter(ctx, x, y, r, flight) {
  const f = flight.state;
  gaugeFace(ctx, x, y, r, 'ALT');
  ticks(ctx, x, y, r - 4, 10, 1, (i) => String(i));
  const feet = Math.max(0, f.y * 3.28084);
  const angle = ((feet % 1000) / 1000) * Math.PI * 2 - Math.PI / 2;
  needle(ctx, x, y, angle, r - 14);
}

/** Heading indicator: a compass rose that turns under a fixed lubber line. */
export function drawHeadingIndicator(ctx, x, y, r, flight) {
  const f = flight.state;
  gaugeFace(ctx, x, y, r, 'HDG');
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r - 4, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(x, y);
  ctx.rotate((-f.heading * Math.PI) / 180);
  ctx.fillStyle = '#2b2f36';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const labels = ['N', 'E', 'S', 'W'];
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    const major = i % 3 === 0;
    ctx.beginPath();
    ctx.moveTo(Math.sin(a) * (r - 12), -Math.cos(a) * (r - 12));
    ctx.lineTo(Math.sin(a) * (r - 5), -Math.cos(a) * (r - 5));
    ctx.lineWidth = major ? 2 : 1;
    ctx.strokeStyle = '#2b2f36';
    ctx.stroke();
    if (major) ctx.fillText(labels[i / 3], Math.sin(a) * (r - 24), -Math.cos(a) * (r - 24));
  }
  ctx.restore();
  ctx.save();
  ctx.fillStyle = PALETTE.gaugeNeedle;
  ctx.beginPath();
  ctx.moveTo(x - 5, y - r + 6);
  ctx.lineTo(x + 5, y - r + 6);
  ctx.lineTo(x, y - r + 14);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Vertical speed, feet per minute, -2000..+2000. */
export function drawVerticalSpeed(ctx, x, y, r, flight) {
  const f = flight.state;
  gaugeFace(ctx, x, y, r, 'V/S');
  ticks(ctx, x, y, r - 4, 10, 5, (i) => (i === 0 ? '0' : i === 5 ? '2' : ''));
  const fpm = f.verticalSpeed * 196.85;
  const angle = Math.max(-135, Math.min(135, (fpm / 2000) * 135)) * (Math.PI / 180);
  needle(ctx, x, y, angle, r - 14);
}

/** Turn coordinator: wings that bank and a ball that slides with slip. */
export function drawTurnCoordinator(ctx, x, y, r, flight) {
  const f = flight.state;
  gaugeFace(ctx, x, y, r, 'TURN');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate((-f.bank * 0.6 * Math.PI) / 180);
  ctx.strokeStyle = '#2b2f36';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r + 12, 0);
  ctx.lineTo(-8, 0);
  ctx.moveTo(8, 0);
  ctx.lineTo(r - 12, 0);
  ctx.stroke();
  ctx.restore();
  const slip = Math.max(-1, Math.min(1, f.bank / 40));
  ctx.beginPath();
  ctx.arc(x + slip * (r - 16), y + r - 14, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#2b2f36';
  ctx.fill();
}

/** The whole six-pack, laid out in two rows of three on the panel. */
export function drawSixPack(ctx, panelX, panelY, panelW, flight) {
  const r = 42;
  const gapX = panelW / 3;
  const rowY = [panelY + 62, panelY + 158];
  const cx = [panelX + gapX / 2, panelX + gapX * 1.5, panelX + gapX * 2.5];
  drawAttitudeIndicator(ctx, cx[0], rowY[0], r, flight);
  drawAirspeedIndicator(ctx, cx[1], rowY[0], r, flight);
  drawAltimeter(ctx, cx[2], rowY[0], r, flight);
  drawTurnCoordinator(ctx, cx[0], rowY[1], r, flight);
  drawHeadingIndicator(ctx, cx[1], rowY[1], r, flight);
  drawVerticalSpeed(ctx, cx[2], rowY[1], r, flight);
}
