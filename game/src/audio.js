// Synthesised sound: no audio assets, everything is WebAudio. An engine
// hum that follows the throttle, wind that follows the speed, and short
// stingers for rings, crates, landings and crashes. Starts on the first
// user gesture; M mutes.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      const AC = window.AudioContext ?? window.webkitAudioContext;
      ctx = new AC();
      // Engine: two detuned saws through a low pass, pitch follows throttle.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      const engineOsc2 = ctx.createOscillator();
      engineOsc2.type = 'sawtooth';
      engineOsc2.detune.value = 8;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      engineOsc2.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      engineOsc2.start();
      // Wind: looped noise through a band pass, gain follows airspeed.
      const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 900;
      windGain = ctx.createGain();
      windGain.gain.value = 0;
      noise.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(ctx.destination);
      noise.start();
      ctx.__engineOsc = engineOsc;
      ctx.__engineOsc2 = engineOsc2;
    } catch {
      ctx = null;
    }
  }

  /** Call every frame with the flight state; gains follow it. */
  function update(flight) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const throttle = flight.state.throttle;
    const speed = flight.state.speedKt;
    engineGain.gain.setTargetAtTime(0.05 + throttle * 0.06, t, 0.1);
    engineOsc.frequency.setTargetAtTime(52 + throttle * 58, t, 0.1);
    ctx.__engineOsc2.frequency.setTargetAtTime(52 + throttle * 58, t, 0.1);
    windGain.gain.setTargetAtTime(Math.min(0.12, (speed / 185) * 0.12), t, 0.15);
  }

  function blip(frequency, duration, type, volume) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type ?? 'sine';
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(volume ?? 0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + duration);
    } catch {
      // Sound is garnish; a failed blip never breaks the game.
    }
  }

  return {
    ensure,
    update,
    ring: () => {
      blip(660, 0.18, 'sine', 0.14);
      setTimeout(() => blip(990, 0.22, 'sine', 0.12), 90);
    },
    crate: () => blip(520, 0.15, 'triangle', 0.14),
    complete: () => {
      blip(523, 0.2, 'triangle', 0.14);
      setTimeout(() => blip(659, 0.2, 'triangle', 0.14), 140);
      setTimeout(() => blip(784, 0.35, 'triangle', 0.14), 280);
    },
    thud: () => blip(90, 0.3, 'sine', 0.2),
    crash: () => blip(55, 0.6, 'sawtooth', 0.2),
    toggleMute() {
      muted = !muted;
      if (ctx && engineGain) engineGain.gain.value = 0;
      if (ctx && windGain) windGain.gain.value = 0;
      return muted;
    },
  };
}
