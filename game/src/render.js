// The scene renderer: sky, sun and sea, then the island as flat-shaded
// terrain quads painted far to near, then the runway, town, rings and
// crates, then the aircraft (chase view) or the cockpit panel, then the HUD.
// One visual style throughout: warm late-afternoon light, low-poly island,
// gradient sky.
import { PALETTE, VIEW, RUNWAY } from './config.js';
import { groundHeight } from './terrain.js';
import { drawSixPack } from './instruments.js';
import {
  drawCompassTape,
  drawFlightData,
  drawEngineState,
  drawMissionPanel,
  drawWarnings,
  drawBanner,
  drawFlightPathMarker,
  drawTargetArrow,
} from './hud.js';

const CELL = 110;
const GRID_HALF = 2100;

function shade(base, light) {
  const r = parseInt(base.slice(1, 3), 16);
  const g = parseInt(base.slice(3, 5), 16);
  const b = parseInt(base.slice(5, 7), 16);
  const f = Math.max(0.55, Math.min(1.25, light));
  return `rgb(${Math.round(r * f)},${Math.round(g * f)},${Math.round(b * f)})`;
}

/** Terrain colour by height: sand, grass, forest, rock only on the peaks. */
function terrainColour(h, slope) {
  let base;
  if (h < 4) base = PALETTE.sand;
  else if (h < 80) base = PALETTE.grass;
  else if (h < 165) base = PALETTE.forest;
  else base = PALETTE.rock;
  return shade(base, 1.02 - slope * 0.35);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = VIEW.width * dpr;
  canvas.height = VIEW.height * dpr;
  ctx.scale(dpr, dpr);

  function drawSky(camera, flight) {
    const horizonY = camera.state.horizonY;
    const sky = ctx.createLinearGradient(0, 0, 0, Math.max(horizonY, 1));
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.65, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, Math.max(horizonY, 0));
    // The sun sits low in the west; its glitter streak runs across the sea.
    const sunScreen = camera.project(camera.state, camera.state.pos.x - 8000, camera.state.pos.y + 700, camera.state.pos.z - 1500);
    if (sunScreen && sunScreen.y > -100 && sunScreen.y < VIEW.height + 100) {
      const glow = ctx.createRadialGradient(sunScreen.x, sunScreen.y, 4, sunScreen.x, sunScreen.y, 150);
      glow.addColorStop(0, 'rgba(255,243,196,0.95)');
      glow.addColorStop(0.25, 'rgba(255,220,140,0.55)');
      glow.addColorStop(1, 'rgba(255,220,140,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(sunScreen.x - 160, sunScreen.y - 160, 320, 320);
      ctx.fillStyle = PALETTE.sun;
      ctx.beginPath();
      ctx.arc(sunScreen.x, sunScreen.y, 26, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sea below the horizon, with a sun-glitter band under the sun.
    if (horizonY < VIEW.height) {
      const sea = ctx.createLinearGradient(0, horizonY, 0, VIEW.height);
      sea.addColorStop(0, PALETTE.seaShallow);
      sea.addColorStop(1, PALETTE.seaDeep);
      ctx.fillStyle = sea;
      ctx.fillRect(0, horizonY, VIEW.width, VIEW.height - horizonY);
      if (sunScreen) {
        ctx.save();
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = PALETTE.seaGlitter;
        const gx = sunScreen.x;
        for (let i = 0; i < 14; i += 1) {
          const w = 40 + Math.random() * 90;
          const y = horizonY + 8 + ((i * 37) % Math.max(1, VIEW.height - horizonY - 16));
          ctx.fillRect(gx - w / 2 + (Math.random() - 0.5) * 40, y, w, 2);
        }
        ctx.restore();
      }
    }
  }

  function drawClouds(camera, terrain) {
    for (const cloud of terrain.clouds) {
      const p = camera.project(camera.state, cloud.x, cloud.y, cloud.z);
      if (!p) continue;
      const s = cloud.s * p.scale * 0.9;
      if (s < 4) continue;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = PALETTE.cloud;
      for (let i = -2; i <= 2; i += 1) {
        ctx.beginPath();
        ctx.ellipse(p.x + i * s * 0.55, p.y - Math.abs(i) * s * 0.08, s * 0.62, s * 0.34, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawTerrain(camera) {
    const cam = camera.state.pos;
    const quads = [];
    const x0 = Math.max(-GRID_HALF, Math.floor((cam.x - 2600) / CELL) * CELL);
    const x1 = Math.min(GRID_HALF, Math.ceil((cam.x + 2600) / CELL) * CELL);
    const z0 = Math.max(-GRID_HALF, Math.floor((cam.z - 2600) / CELL) * CELL);
    const z1 = Math.min(GRID_HALF, Math.ceil((cam.z + 2600) / CELL) * CELL);
    for (let x = x0; x < x1; x += CELL) {
      for (let z = z0; z < z1; z += CELL) {
        const h00 = groundHeight(x, z);
        const h10 = groundHeight(x + CELL, z);
        const h01 = groundHeight(x, z + CELL);
        const h11 = groundHeight(x + CELL, z + CELL);
        if (h00 <= 0 && h10 <= 0 && h01 <= 0 && h11 <= 0) continue;
        const cx = x + CELL / 2 - cam.x;
        const cz = z + CELL / 2 - cam.z;
        const dist = cx * cx + cz * cz;
        if (dist > 2600 * 2600) continue;
        quads.push({ x, z, h00, h10, h01, h11, dist });
      }
    }
    quads.sort((a, b) => b.dist - a.dist);
    for (const q of quads) {
      const p00 = camera.project(camera.state, q.x, Math.max(0.4, q.h00), q.z);
      const p10 = camera.project(camera.state, q.x + CELL, Math.max(0.4, q.h10), q.z);
      const p11 = camera.project(camera.state, q.x + CELL, Math.max(0.4, q.h11), q.z + CELL);
      const p01 = camera.project(camera.state, q.x, Math.max(0.4, q.h01), q.z + CELL);
      if (!p00 || !p10 || !p11 || !p01) continue;
      const avgH = (q.h00 + q.h10 + q.h01 + q.h11) / 4;
      const slope = Math.abs(q.h10 - q.h00) + Math.abs(q.h01 - q.h00);
      const colour = terrainColour(avgH, Math.min(1.4, slope / 26));
      ctx.fillStyle = colour;
      ctx.beginPath();
      ctx.moveTo(p00.x, p00.y);
      ctx.lineTo(p10.x, p10.y);
      ctx.lineTo(p11.x, p11.y);
      ctx.lineTo(p01.x, p01.y);
      ctx.closePath();
      ctx.fill();
      // Stroke with the same colour: without it the anti-aliased seams
      // between quads show the sea behind as dark grid lines.
      ctx.strokeStyle = colour;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawRunway(camera) {
    const y = RUNWAY.height + 0.6;
    const hw = RUNWAY.width / 2;
    const hl = RUNWAY.length / 2;
    const corners = [
      camera.project(camera.state, RUNWAY.x - hl, y, RUNWAY.z - hw),
      camera.project(camera.state, RUNWAY.x + hl, y, RUNWAY.z - hw),
      camera.project(camera.state, RUNWAY.x + hl, y, RUNWAY.z + hw),
      camera.project(camera.state, RUNWAY.x - hl, y, RUNWAY.z + hw),
    ];
    if (corners.some((p) => !p)) return;
    ctx.fillStyle = PALETTE.runway;
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    for (const p of corners.slice(1)) ctx.lineTo(p.x, p.y);
    ctx.closePath();
    ctx.fill();
    // Centreline dashes and edge lines.
    ctx.fillStyle = PALETTE.runwayMark;
    for (let d = -hl + 30; d < hl - 10; d += 60) {
      const a = camera.project(camera.state, RUNWAY.x + d, y + 0.2, RUNWAY.z - 1.2);
      const b = camera.project(camera.state, RUNWAY.x + d + 34, y + 0.2, RUNWAY.z + 1.2);
      if (!a || !b) continue;
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) + 2, Math.abs(b.y - a.y) + 2);
    }
    // Touchdown zone bars (the first third, runway 09).
    for (let i = 0; i < 3; i += 1) {
      const dx = -hl + 70 + i * 70;
      const a = camera.project(camera.state, RUNWAY.x + dx, y + 0.2, RUNWAY.z - 9);
      const b = camera.project(camera.state, RUNWAY.x + dx + 26, y + 0.2, RUNWAY.z + 9);
      if (!a || !b) continue;
      ctx.fillRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x) + 2, Math.abs(b.y - a.y) + 2);
    }
    // Runway numbers, drawn as projected text at each threshold.
    const n09 = camera.project(camera.state, RUNWAY.x - hl + 60, y + 0.3, RUNWAY.z);
    if (n09 && n09.depth < 1500) {
      ctx.save();
      ctx.fillStyle = PALETTE.runwayMark;
      ctx.font = `bold ${Math.max(10, 900 / n09.depth)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('09', n09.x, n09.y);
      ctx.restore();
    }
  }

  function drawTown(camera, terrain) {
    for (const house of terrain.town) {
      const ground = groundHeight(house.x, house.z);
      const base = camera.project(camera.state, house.x, ground, house.z);
      const top = camera.project(camera.state, house.x, ground + house.h, house.z);
      if (!base || !top) continue;
      const w = Math.max(2, house.w * base.scale);
      const h = Math.max(2, (top.y - base.y) * -1);
      ctx.fillStyle = PALETTE.townWall;
      ctx.fillRect(base.x - w / 2, base.y - h, w, h);
      ctx.fillStyle = house.hue > 0.5 ? PALETTE.townRoof : '#7a5a3c';
      ctx.beginPath();
      ctx.moveTo(base.x - w / 2 - 2, base.y - h);
      ctx.lineTo(base.x, base.y - h - w * 0.35);
      ctx.lineTo(base.x + w / 2 + 2, base.y - h);
      ctx.closePath();
      ctx.fill();
    }
    // The lighthouse on the south-west point, white and red bands.
    const lh = terrain.lighthouse;
    const ground = groundHeight(lh.x, lh.z);
    const base = camera.project(camera.state, lh.x, ground, lh.z);
    const top = camera.project(camera.state, lh.x, ground + 42, lh.z);
    if (base && top) {
      const w = Math.max(3, 10 * base.scale);
      const h = Math.max(4, (top.y - base.y) * -1);
      ctx.fillStyle = '#f4f6f0';
      ctx.fillRect(base.x - w / 2, base.y - h, w, h);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(base.x - w / 2, base.y - h * 0.62, w, h * 0.16);
      ctx.fillRect(base.x - w / 2, base.y - h * 0.3, w, h * 0.16);
      ctx.fillStyle = '#ffd76a';
      ctx.beginPath();
      ctx.arc(base.x, base.y - h - 4, Math.max(2, w * 0.6), 0, Math.PI * 2);
      ctx.fill();
    }
    // Palms: a trunk line and a crown of arcs.
    for (const palm of terrain.palms) {
      const ground = groundHeight(palm.x, palm.z);
      if (ground <= 1) continue;
      const base = camera.project(camera.state, palm.x, ground, palm.z);
      const top = camera.project(camera.state, palm.x, ground + 11, palm.z);
      if (!base || !top) continue;
      const h = Math.max(2, (top.y - base.y) * -1);
      ctx.strokeStyle = '#6b4a2f';
      ctx.lineWidth = Math.max(1, h * 0.08);
      ctx.beginPath();
      ctx.moveTo(base.x, base.y);
      ctx.lineTo(top.x, top.y);
      ctx.stroke();
      ctx.fillStyle = PALETTE.forest;
      ctx.beginPath();
      ctx.arc(top.x, top.y, Math.max(2, h * 0.32), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawRings(camera, terrain, missions) {
    for (let i = 0; i < terrain.rings.length; i += 1) {
      const ring = terrain.rings[i];
      // A ring right at the camera projects to a giant arc across the
      // screen; skip rings whose centre is closer than 120 m.
      const centre = camera.project(camera.state, ring.x, ring.y, ring.z);
      if (!centre || centre.depth < 120) continue;
      const next = missions.nextRing() === ring;
      const color = ring.passed ? '#7ddc6a' : next ? '#ffb02e' : '#eaf4ff';
      const pts = [];
      let visible = false;
      let clipped = false;
      for (let s = 0; s <= 28; s += 1) {
        const a = (s / 28) * Math.PI * 2;
        // Ring plane faces along its course direction: the circle lies in
        // the plane perpendicular to the course, spanned by the horizontal
        // perpendicular (cos facing, 0, sin facing) and the vertical.
        const nx = Math.cos(ring.facing);
        const nz = Math.sin(ring.facing);
        const px = ring.x + Math.cos(a) * 30 * nx;
        const py = ring.y + Math.sin(a) * 30;
        const pz = ring.z + Math.cos(a) * 30 * nz;
        const p = camera.project(camera.state, px, py, pz);
        if (!p || p.depth < 60) {
          // Part of the ring is behind the camera or too close: skip it
          // whole, or the polyline would join the visible points across
          // the screen.
          clipped = true;
          break;
        }
        visible = true;
        pts.push(p);
      }
      if (clipped || !visible || pts.length < 3) continue;
      ctx.save();
      ctx.strokeStyle = color;
      ctx.globalAlpha = next ? 0.95 : 0.75;
      ctx.lineWidth = next ? 7 : 5;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 14;
      ctx.stroke();
      ctx.restore();
      // The ring number, for the course order.
      const c = camera.project(camera.state, ring.x, ring.y + 42, ring.z);
      if (c && c.depth < 2200) {
        ctx.save();
        ctx.fillStyle = color;
        ctx.font = `bold ${Math.max(12, 1400 / c.depth)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), c.x, c.y);
        ctx.restore();
      }
    }
  }

  function drawZones(camera, terrain, missions) {
    if (missions.state.index !== 2) return;
    for (const zone of terrain.zones) {
      const ground = groundHeight(zone.x, zone.z);
      const pts = [];
      for (let s = 0; s <= 24; s += 1) {
        const a = (s / 24) * Math.PI * 2;
        const p = camera.project(camera.state, zone.x + Math.cos(a) * terrain.zoneRadius, ground + 1, zone.z + Math.sin(a) * terrain.zoneRadius);
        if (p) pts.push(p);
      }
      if (pts.length < 3) continue;
      ctx.save();
      ctx.fillStyle = 'rgba(255,176,46,0.25)';
      ctx.strokeStyle = PALETTE.hudAmber;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      const c = camera.project(camera.state, zone.x, ground + 6, zone.z);
      if (c) {
        ctx.save();
        ctx.fillStyle = PALETTE.hudAmber;
        ctx.font = `bold ${Math.max(12, 1200 / c.depth)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(zone.label, c.x, c.y);
        ctx.restore();
      }
    }
    // Falling crates: bright orange boxes under a white parachute, so the
    // drop reads at a glance. Crates too close to the camera are skipped:
    // they would project to a giant box across the frame.
    for (const crate of missions.state.crates) {
      if (crate.scored) continue;
      const p = camera.project(camera.state, crate.x, crate.y, crate.z);
      if (!p || p.depth < 4) continue;
      const s = Math.max(4, Math.min(64, 1100 / p.depth));
      ctx.save();
      ctx.fillStyle = '#e8542f';
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
      ctx.strokeStyle = '#1f4e79';
      ctx.lineWidth = 2;
      ctx.strokeRect(p.x - s / 2, p.y - s / 2, s, s);
      ctx.strokeStyle = '#f4f6f0';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y - s * 0.9, s * 1.1, Math.PI, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  /** The Pelican-9 from behind, banked with the roll, prop spinning. */
  function drawAircraft(flight, time) {
    const f = flight.state;
    const cx = VIEW.width / 2;
    const cy = VIEW.height * 0.60;
    const s = 1.15;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((-f.bank * Math.PI) / 180);
    ctx.scale(s, s);
    // Wings.
    ctx.fillStyle = PALETTE.aircraftWing;
    ctx.beginPath();
    ctx.moveTo(-150, -6);
    ctx.lineTo(150, -6);
    ctx.lineTo(138, 16);
    ctx.lineTo(-138, 16);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.aircraftTrim;
    ctx.fillRect(-150, -6, 300, 4);
    // Tailplane and fin.
    ctx.fillStyle = PALETTE.aircraftWing;
    ctx.beginPath();
    ctx.moveTo(-52, 62);
    ctx.lineTo(52, 62);
    ctx.lineTo(42, 76);
    ctx.lineTo(-42, 76);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.aircraftTrim;
    ctx.beginPath();
    ctx.moveTo(0, 52);
    ctx.lineTo(-10, 88);
    ctx.lineTo(10, 88);
    ctx.closePath();
    ctx.fill();
    // Fuselage, seen from behind and slightly above.
    const body = ctx.createLinearGradient(-26, 0, 26, 0);
    body.addColorStop(0, '#c7431f');
    body.addColorStop(0.5, PALETTE.aircraftBody);
    body.addColorStop(1, '#c7431f');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-24, -58);
    ctx.quadraticCurveTo(-30, 10, -16, 84);
    ctx.lineTo(16, 84);
    ctx.quadraticCurveTo(30, 10, 24, -58);
    ctx.quadraticCurveTo(0, -72, -24, -58);
    ctx.closePath();
    ctx.fill();
    // Canopy.
    ctx.fillStyle = '#bfe0ea';
    ctx.beginPath();
    ctx.ellipse(0, -34, 15, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.aircraftTrim;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Registration on the fuselage.
    ctx.fillStyle = '#f4f6f0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PK-WNG', 0, 34);
    // Spinning prop: a translucent disc ahead of the nose.
    const propA = 0.25 + 0.1 * Math.sin(time * 40);
    ctx.fillStyle = `rgba(220,225,230,${propA})`;
    ctx.beginPath();
    ctx.ellipse(0, -62, 46, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Navigation lights.
    ctx.fillStyle = '#ff5347';
    ctx.beginPath();
    ctx.arc(-150, 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7ddc6a';
    ctx.beginPath();
    ctx.arc(150, 4, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Cockpit view: canopy frame, nose and the lit six-pack panel. */
  function drawCockpit(flight) {
    const f = flight.state;
    // Nose cowling and prop disc at the bottom of the windscreen, just
    // above the panel: the aircraft's nose is always in view.
    ctx.save();
    ctx.fillStyle = '#c7431f';
    ctx.beginPath();
    ctx.moveTo(VIEW.width / 2 - 180, VIEW.height - 232);
    ctx.quadraticCurveTo(VIEW.width / 2 - 140, VIEW.height - 300, VIEW.width / 2, VIEW.height - 296);
    ctx.quadraticCurveTo(VIEW.width / 2 + 140, VIEW.height - 300, VIEW.width / 2 + 180, VIEW.height - 232);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(220,225,230,0.35)';
    ctx.beginPath();
    ctx.ellipse(VIEW.width / 2, VIEW.height - 298, 58, 11, 0, 0, Math.PI * 2);
    ctx.fill();
    // Canopy struts, slim so they frame the view instead of blocking it.
    ctx.strokeStyle = '#14181e';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(150, VIEW.height * 0.42);
    ctx.moveTo(VIEW.width, 0);
    ctx.lineTo(VIEW.width - 150, VIEW.height * 0.42);
    ctx.stroke();
    ctx.restore();
    // The instrument panel.
    const panelY = VIEW.height - 235;
    ctx.save();
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath();
    ctx.roundRect(0, panelY, VIEW.width, 235, 0);
    ctx.fill();
    ctx.fillStyle = '#2b313b';
    ctx.fillRect(0, panelY, VIEW.width, 6);
    drawSixPack(ctx, 60, panelY + 12, 760, flight);
    // Throttle quadrant, right of the six-pack.
    const tx = 900;
    const ty = panelY + 40;
    ctx.fillStyle = '#f4efe2';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('THROTTLE', tx, ty - 14);
    ctx.fillStyle = '#0e1116';
    ctx.fillRect(tx, ty, 26, 150);
    ctx.fillStyle = f.fuel <= 0 ? PALETTE.hudRed : '#f4efe2';
    const knobY = ty + 150 - f.throttle * 150;
    ctx.fillRect(tx - 8, knobY - 8, 42, 16);
    ctx.fillStyle = '#8a8f96';
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText('IDLE', tx + 36, ty + 146);
    ctx.fillText('FULL', tx + 36, ty + 6);
    // Warning lights.
    const lights = [
      { on: f.stalled, label: 'STALL', color: PALETTE.hudRed },
      { on: f.fuel > 0 && f.fuel < 20, label: 'FUEL', color: PALETTE.hudAmber },
      { on: f.damage > 60, label: 'DMG', color: PALETTE.hudRed },
    ];
    lights.forEach((light, i) => {
      const lx = tx + 120 + i * 64;
      ctx.fillStyle = light.on ? light.color : '#333a44';
      ctx.beginPath();
      ctx.arc(lx, ty + 20, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#bcd6ea';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(light.label, lx, ty + 46);
    });
    ctx.restore();
  }

  function draw(screen, world, time) {
    const { flight, missions, camera, terrain } = world;
    const f = flight.state;
    ctx.clearRect(0, 0, VIEW.width, VIEW.height);
    camera.update(flight, 1 / 60);
    drawSky(camera, flight);
    drawClouds(camera, terrain);
    drawTerrain(camera);
    drawRunway(camera);
    drawTown(camera, terrain);
    drawRings(camera, terrain, missions);
    drawZones(camera, terrain, missions);
    if (camera.state.view === 'cockpit') drawCockpit(flight);
    // On the title screen the backdrop is a scenic orbit with no aircraft
    // in it, so the plane never covers the mission buttons.
    else if (screen !== 'title') drawAircraft(flight, time);
    // HUD on top of everything. In the cockpit the panel already carries
    // altitude, speed, heading and throttle as lit instruments, so the big
    // HUD blocks stay out of the way; in chase view they are the readout.
    drawCompassTape(ctx, flight);
    drawMissionPanel(ctx, missions, flight);
    if (camera.state.view === 'chase') {
      drawFlightData(ctx, flight);
      drawEngineState(ctx, flight);
    }
    drawWarnings(ctx, flight, missions);
    drawFlightPathMarker(ctx);
    const target = missions.state.index === 0 ? missions.nextRing() : null;
    if (target) drawTargetArrow(ctx, camera, target, `RING ${missions.state.ringsPassed + 1}`);
    if (missions.state.index === 2) {
      const zone = terrain.zones[missions.state.cratesHit] ?? terrain.zones[0];
      if (zone) drawTargetArrow(ctx, camera, { x: zone.x, y: 60, z: zone.z }, zone.label);
    }
    const banner = missions.state.banner && time < missions.state.bannerUntil ? missions.state.banner : '';
    drawBanner(ctx, banner);
    if (screen === 'over') {
      ctx.fillStyle = 'rgba(10,16,24,0.72)';
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.crashed ? 'CRASHED' : 'SORTIE OVER', VIEW.width / 2, VIEW.height / 2 - 30);
      ctx.font = '20px system-ui, sans-serif';
      ctx.fillText(`Score ${Math.floor(missions.state.score)} — press R to fly again`, VIEW.width / 2, VIEW.height / 2 + 16);
    }
  }

  return { draw, ctx };
}
