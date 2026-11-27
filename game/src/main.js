// Boot and the one loop: input is read every frame, the world advances in
// fixed 1/60 s steps, and the renderer paints what is there. The game moves
// between four screens: title, play, paused and game over.
//
// ?seed=N fixes the island. ?shot=cover|rings|landing|supply (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, MISSIONS, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import { createTerrain } from './terrain.js';
import { createFlight, EVENT_CRASH, EVENT_LANDED, EVENT_TOUCHDOWN } from './flight-model.js';
import { createMissions, MISSION_CRATE, MISSION_DONE, MISSION_FAILED, MISSION_RING } from './missions.js';
import { createCamera } from './camera.js';
import { createRenderer } from './render.js';
import { ACTION_CONFIRM, ACTION_DROP, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, ACTION_VIEW, createInput } from './input.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const terrain = createTerrain(seed);
const flight = createFlight();
const missions = createMissions(terrain);
const camera = createCamera();
const renderer = createRenderer(canvas);
const audio = createAudio();
const world = { flight, missions, camera, terrain };

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(scene.screen, world, flight.state.time + 0.5);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = 'title';
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let selectedMission = 0;
  let time = 0;

  function announce(message) {
    status.textContent = message;
  }

  function startGame(index) {
    const spawn = missions.start(index);
    flight.reset(spawn);
    camera.setView('chase');
    accumulator = 0;
    screen = 'play';
    announce(`Playing ${MISSIONS[index].name}. ${MISSIONS[index].goal}.`);
  }

  function endGame() {
    screen = 'over';
    if (Math.floor(missions.state.score) > best) {
      best = Math.floor(missions.state.score);
      saveBest(best);
    }
    announce(`Sortie over. Score ${Math.floor(missions.state.score)}. Best ${best}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_VIEW && screen === 'play') {
      camera.setView(camera.state.view === 'chase' ? 'cockpit' : 'chase');
    }
    if (actions & ACTION_RESTART && (screen === 'play' || screen === 'over')) {
      startGame(missions.state.index);
      return;
    }
    if (actions & ACTION_CONFIRM && (screen === 'title' || screen === 'over')) {
      audio.ensure();
      startGame(selectedMission);
    } else if (actions & ACTION_PAUSE && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === 'paused') {
      screen = 'play';
      announce('Playing.');
    }
    if (screen === 'play' && actions & ACTION_DROP) {
      if (missions.dropCrate(flight)) audio.crate();
    }
    const pick = input.missionPick();
    if (pick >= 0 && screen === 'title') selectedMission = pick;
  }

  function handleClicks() {
    for (const click of input.takeClicks()) {
      audio.ensure();
      if (screen === 'title') {
        // Mission buttons across the title screen.
        for (let i = 0; i < 3; i += 1) {
          const bx = VIEW.width / 2 - 330 + i * 230;
          if (click.x > bx && click.x < bx + 210 && click.y > 470 && click.y < 560) {
            startGame(i);
            return;
          }
        }
        startGame(selectedMission);
      } else if (screen === 'over') {
        startGame(missions.state.index);
      } else if (screen === 'play') {
        // The view toggle lives at the top-right of the mission panel.
        if (click.x > VIEW.width - 180 && click.x < VIEW.width - 14 && click.y > 52 && click.y < 114) {
          camera.setView(camera.state.view === 'chase' ? 'cockpit' : 'chase');
        }
      }
    }
  }

  function step() {
    if (screen === 'title') return;
    const stick = input.stick();
    const events = flight.step(STEP, stick);
    const missionEvents = missions.step(STEP, flight, events);
    if (events & EVENT_TOUCHDOWN) audio.thud();
    if (events & EVENT_CRASH) audio.crash();
    if (missionEvents & MISSION_RING) audio.ring();
    if (missionEvents & MISSION_CRATE) audio.crate();
    if (missionEvents & MISSION_DONE) audio.complete();
    if (missionEvents & MISSION_FAILED) audio.crash();
    if (flight.state.crashed || (flight.state.landed && missions.state.done)) endGame();
    else if (flight.state.landed && flight.state.speedKt < 5) endGame();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    handleActions();
    handleClicks();
    if (screen === 'play') {
      accumulator += dt;
      while (accumulator >= STEP) {
        step();
        accumulator -= STEP;
        if (screen !== 'play') break;
      }
    } else {
      accumulator = 0;
    }
    audio.update(flight);
    if (screen === 'title') drawTitle(time);
    else renderer.draw(screen === 'over' ? 'over' : 'play', world, time);
  }

  function drawTitle(t) {
    const ctx = renderer.ctx;
    // A live backdrop: the island from a slow orbit, so the title screen
    // already shows the game instead of a menu. The flight state is
    // borrowed for the orbit and restored right after the draw.
    const saved = { ...flight.state };
    flight.state.x = Math.cos(t * 0.05) * 1600;
    flight.state.y = 900;
    flight.state.z = 150 + Math.sin(t * 0.05) * 1600;
    flight.state.heading = (t * 3) % 360;
    flight.state.pitch = -12;
    flight.state.bank = 0;
    flight.state.speedKt = 110;
    flight.state.throttle = 0.6;
    flight.state.fuel = 100;
    flight.state.damage = 0;
    flight.state.verticalSpeed = 0;
    renderer.draw('play', world, t);
    Object.assign(flight.state, saved);
    ctx.fillStyle = 'rgba(8,14,22,0.55)';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('ISLAND WINGS', VIEW.width / 2, 150);
    ctx.font = '22px system-ui, sans-serif';
    ctx.fillStyle = '#ffd76a';
    ctx.fillText('Three sorties over Pulau Kencana — fly the Pelican-9', VIEW.width / 2, 196);
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillStyle = '#dfe9f2';
    ctx.fillText('Arrows fly · W/S throttle · Space drop crate · V cockpit view · Click a mission to fly', VIEW.width / 2, 232);
    for (let i = 0; i < 3; i += 1) {
      const bx = VIEW.width / 2 - 330 + i * 230;
      const selected = i === selectedMission;
      ctx.fillStyle = selected ? 'rgba(255,176,46,0.92)' : 'rgba(10,16,24,0.72)';
      ctx.beginPath();
      ctx.roundRect(bx, 470, 210, 90, 10);
      ctx.fill();
      ctx.fillStyle = selected ? '#1c2129' : '#ffb02e';
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(MISSIONS[i].name, bx + 105, 500);
      ctx.fillStyle = selected ? '#1c2129' : '#eef1f5';
      ctx.font = '13px system-ui, sans-serif';
      ctx.fillText(MISSIONS[i].goal, bx + 105, 528);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillText(`Press ${i + 1}`, bx + 105, 548);
    }
    ctx.fillStyle = '#bcd6ea';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`Best score ${best} · an original game — no commercial names, art or levels`, VIEW.width / 2, 610);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Island Wings. Pick a mission, then fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
