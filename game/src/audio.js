// audio.js — every sound is synthesized live with WebAudio: an engine hum
// tied to the throttle, wind that rises with speed, a ring chime, a landing
// thud and a warning beep. No audio files, nothing to download.
export function createAudio() {
  return {
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    windSource: null,
    windGain: null,
    windFilter: null,
    muted: false,
    started: false,
  };
}

/** Must be called from a user gesture (key/click) — browsers block audio before that. */
export function startAudio(audio) {
  if (audio.started) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audio.ctx = new Ctx();
    audio.master = audio.ctx.createGain();
    audio.master.gain.value = 0.5;
    audio.master.connect(audio.ctx.destination);

    // Engine: two detuned sawtooths through a low-pass, pitch follows throttle.
    audio.engineOsc = audio.ctx.createOscillator();
    audio.engineOsc.type = 'sawtooth';
    audio.engineOsc.frequency.value = 55;
    audio.engineOsc2 = audio.ctx.createOscillator();
    audio.engineOsc2.type = 'square';
    audio.engineOsc2.frequency.value = 27;
    const engineFilter = audio.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    audio.engineGain = audio.ctx.createGain();
    audio.engineGain.gain.value = 0;
    audio.engineOsc.connect(engineFilter);
    audio.engineOsc2.connect(engineFilter);
    engineFilter.connect(audio.engineGain);
    audio.engineGain.connect(audio.master);
    audio.engineOsc.start();
    audio.engineOsc2.start();

    // Wind: looped white noise through a band-pass; louder and higher with speed.
    const len = audio.ctx.sampleRate * 2;
    const buffer = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    audio.windSource = audio.ctx.createBufferSource();
    audio.windSource.buffer = buffer;
    audio.windSource.loop = true;
    audio.windFilter = audio.ctx.createBiquadFilter();
    audio.windFilter.type = 'bandpass';
    audio.windFilter.frequency.value = 500;
    audio.windFilter.Q.value = 0.6;
    audio.windGain = audio.ctx.createGain();
    audio.windGain.gain.value = 0;
    audio.windSource.connect(audio.windFilter);
    audio.windFilter.connect(audio.windGain);
    audio.windGain.connect(audio.master);
    audio.windSource.start();

    audio.started = true;
  } catch (err) {
    // Audio is garnish: a failure here must never stop the game.
    audio.started = false;
  }
}

function beep(audio, freq, dur, type, vol, when = 0) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime + when;
  const osc = audio.ctx.createOscillator();
  const gain = audio.ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(vol, t + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(audio.master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** Per-frame: engine pitch from throttle, wind from airspeed. */
export function updateAudio(audio, throttle, speed, airborne) {
  if (!audio.ctx || audio.muted) return;
  const t = audio.ctx.currentTime;
  const targetEngine = airborne || throttle > 0.05 ? 0.05 + throttle * 0.11 : 0;
  audio.engineGain.gain.setTargetAtTime(targetEngine, t, 0.1);
  audio.engineOsc.frequency.setTargetAtTime(52 + throttle * 88, t, 0.1);
  audio.engineOsc2.frequency.setTargetAtTime(26 + throttle * 44, t, 0.1);
  const wind = Math.min(0.22, Math.max(0, (speed - 8)) * 0.0045);
  audio.windGain.gain.setTargetAtTime(wind, t, 0.15);
  audio.windFilter.frequency.setTargetAtTime(350 + speed * 22, t, 0.15);
}

export function playChime(audio) {
  if (!audio.ctx || audio.muted) return;
  beep(audio, 880, 0.28, 'sine', 0.32);
  beep(audio, 1318, 0.4, 'sine', 0.24, 0.08);
  beep(audio, 1760, 0.5, 'sine', 0.16, 0.16);
}

export function playThud(audio) {
  if (!audio.ctx || audio.muted) return;
  beep(audio, 70, 0.3, 'sine', 0.5);
  beep(audio, 140, 0.18, 'triangle', 0.25);
}

export function playWarning(audio) {
  if (!audio.ctx || audio.muted) return;
  beep(audio, 660, 0.12, 'square', 0.12);
  beep(audio, 660, 0.12, 'square', 0.12, 0.18);
}

export function playCrash(audio) {
  if (!audio.ctx || audio.muted) return;
  beep(audio, 55, 0.7, 'sawtooth', 0.4);
  beep(audio, 38, 0.9, 'sine', 0.45, 0.05);
}

export function playSuccess(audio) {
  if (!audio.ctx || audio.muted) return;
  const notes = [523, 659, 784, 1047];
  notes.forEach((n, i) => beep(audio, n, 0.35, 'triangle', 0.28, i * 0.12));
}

export function toggleMute(audio) {
  audio.muted = !audio.muted;
  if (audio.master) audio.master.gain.value = audio.muted ? 0 : 0.5;
  return audio.muted;
}
