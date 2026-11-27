// Keyboard and mouse. The keyboard flies the aircraft; the mouse flies it
// too (hold and drag to steer) and clicks every button on the screens.
// Keys: arrows pitch/bank, W/S throttle, Space drop/confirm, V view,
// P pause, R restart, M mute, 1/2/3 pick a mission.
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_VIEW = 4;
export const ACTION_DROP = 8;
export const ACTION_MUTE = 16;
export const ACTION_RESTART = 32;

const KEYMAP = {
  ArrowUp: 'pitchUp',
  ArrowDown: 'pitchDown',
  ArrowLeft: 'rollLeft',
  ArrowRight: 'rollRight',
  KeyW: 'throttleUp',
  KeyS: 'throttleDown',
  Space: 'drop',
  KeyV: 'view',
  KeyP: 'pause',
  KeyR: 'restart',
  KeyM: 'mute',
  Enter: 'confirm',
  Digit1: 'mission1',
  Digit2: 'mission2',
  Digit3: 'mission3',
};

export function createInput(canvas) {
  const held = new Set();
  const pressed = new Set();
  /** Clicks the game loop should act on, in canvas pixels. */
  const clicks = [];
  /** Drag steering: offset of the pointer from the canvas centre, -1..1. */
  const drag = { active: false, x: 0, y: 0 };

  function keyName(event) {
    return KEYMAP[event.code] ?? null;
  }

  window.addEventListener('keydown', (event) => {
    const name = keyName(event);
    if (!name) return;
    event.preventDefault();
    if (!event.repeat) pressed.add(name);
    held.add(name);
  });
  window.addEventListener('keyup', (event) => {
    const name = keyName(event);
    if (name) held.delete(name);
  });
  window.addEventListener('blur', () => {
    held.clear();
    drag.active = false;
  });

  function toCanvas(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * VIEW.width,
      y: ((event.clientY - rect.top) / rect.height) * VIEW.height,
    };
  }

  canvas.addEventListener('pointerdown', (event) => {
    const p = toCanvas(event);
    clicks.push(p);
    drag.active = true;
    drag.x = (p.x - VIEW.width / 2) / (VIEW.width / 2);
    drag.y = (p.y - VIEW.height / 2) / (VIEW.height / 2);
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!drag.active) return;
    const p = toCanvas(event);
    drag.x = Math.max(-1, Math.min(1, (p.x - VIEW.width / 2) / (VIEW.width / 2)));
    drag.y = Math.max(-1, Math.min(1, (p.y - VIEW.height / 2) / (VIEW.height / 2)));
  });
  canvas.addEventListener('pointerup', () => {
    drag.active = false;
    drag.x = 0;
    drag.y = 0;
  });

  /** The stick for this frame: roll/pitch -1..1, throttle change -1..1. */
  function stick() {
    let roll = 0;
    let pitch = 0;
    if (held.has('rollLeft')) roll -= 1;
    if (held.has('rollRight')) roll += 1;
    if (held.has('pitchUp')) pitch += 1;
    if (held.has('pitchDown')) pitch -= 1;
    if (drag.active) {
      roll += drag.x * 0.9;
      pitch -= drag.y * 0.9;
    }
    let throttle = 0;
    if (held.has('throttleUp')) throttle += 1;
    if (held.has('throttleDown')) throttle -= 1;
    return {
      roll: Math.max(-1, Math.min(1, roll)),
      pitch: Math.max(-1, Math.min(1, pitch)),
      throttle,
      brake: held.has('pitchDown') && false,
    };
  }

  function takeActions() {
    let actions = 0;
    if (pressed.has('confirm') || pressed.has('drop')) actions |= ACTION_CONFIRM;
    if (pressed.has('pause')) actions |= ACTION_PAUSE;
    if (pressed.has('view')) actions |= ACTION_VIEW;
    if (pressed.has('drop')) actions |= ACTION_DROP;
    if (pressed.has('mute')) actions |= ACTION_MUTE;
    if (pressed.has('restart')) actions |= ACTION_RESTART;
    pressed.clear();
    return actions;
  }

  function takeClicks() {
    return clicks.splice(0, clicks.length);
  }

  function missionPick() {
    if (pressed.has('mission1')) return 0;
    if (pressed.has('mission2')) return 1;
    if (pressed.has('mission3')) return 2;
    return -1;
  }

  return { stick, takeActions, takeClicks, missionPick, held };
}
