// audio.js — a synthesized soundscape, no audio files: a two-oscillator
// engine whose pitch follows the throttle, filtered wind that rises with
// airspeed, a two-note chime for each ring, a small major arpeggio for a
// landing made good, and a noise burst for one made badly. The context is
// created lazily on the pilot's first input, as browsers require a gesture.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    // Engine: a saw and a square an octave down through a lowpass, so the
    // note reads as a working radial, not a synthesizer lead.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise through a bandpass that opens with speed.
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 480;
    windFilter.Q.value = 0.6;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
    return true;
  }

  function tone(freq, at, dur, type, gainPeak) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const t0 = ctx.currentTime + at;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(gainPeak || 0.12, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  return {
    unlock() {
      ensure();
    },

    setMuted(m) {
      muted = m;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
    },

    // Called every frame with the aeroplane's state.
    update(throttle, speed, onGround, crashed) {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const rpm = crashed ? 0 : 26 + throttle * 62 + (onGround ? 0 : 6);
      engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
      engineOsc2.frequency.setTargetAtTime(rpm / 2, t, 0.08);
      const engineLevel = crashed ? 0 : 0.028 + throttle * 0.05;
      engineGain.gain.setTargetAtTime(engineLevel, t, 0.1);
      const windLevel = Math.min(0.16, (speed / 96) * 0.16) * (onGround ? 0.3 : 1);
      windGain.gain.setTargetAtTime(windLevel, t, 0.15);
      windFilter.frequency.setTargetAtTime(320 + speed * 9, t, 0.2);
    },

    ringChime() {
      tone(880, 0, 0.35, 'sine', 0.14);
      tone(1318, 0.09, 0.45, 'sine', 0.12);
    },

    landingJingle() {
      tone(523, 0, 0.3, 'triangle', 0.13);
      tone(659, 0.11, 0.3, 'triangle', 0.13);
      tone(784, 0.22, 0.5, 'triangle', 0.14);
    },

    warning() {
      tone(220, 0, 0.18, 'square', 0.06);
      tone(220, 0.24, 0.18, 'square', 0.06);
    },

    crashThud() {
      if (!ctx || muted) return;
      const len = ctx.sampleRate * 0.5;
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      const gain = ctx.createGain();
      gain.gain.value = 0.5;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      tone(55, 0, 0.6, 'sine', 0.3);
    },
  };
}
