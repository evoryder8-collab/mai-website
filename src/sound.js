// Sound: her background music ("Weightless Clouds 2", looping at 40% to start with, picking
// up on each page where the last one left off), soft synthesised sounds for touches,
// flings and the map flight, and Latte's and Mugi's barks, all through one Web Audio mix.
// Nothing plays until the visitor says yes (portal or header speaker); the choice is
// remembered. On later pages browsers only allow audio after a tap, so the music fades in
// on the first one. iPhones let one thing play sound at a time: the award film pauses the
// music (and may suspend the mix), and once the film stops the music fades back in where
// it was.

import musicUrl from './assets/mai-music.mp3';

const KEY = 'mai-sound';
const MUSIC_VOLUME = 0.4;
const MUSIC_AT = 'mai-music-at';
const PENTATONIC = [220, 246.94, 277.18, 329.63, 369.99, 440];
const BOWL_PARTIALS = [
  [1, 1],
  [2.76, 0.5],
  [5.4, 0.25],
  [8.93, 0.12],
];

let enabled = (() => {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
})();
let ctx = null;
let master;
let ambientBus;
let sfxBus;
let reverb;
let noise;
let music = null;
let startingOver = false;
let ducked = false;
let lastHover = 0;
let analyser = null;
let meter = null;
const listeners = new Set();
const recordings = new Map();

function graph() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  // A roomier buffer than the default: nothing here needs split-second timing, and on a busy
  // phone a short buffer runs dry and crackles.
  ctx = new AC({ latencyHint: 'playback' });
  master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  master.connect(limiter).connect(ctx.destination);
  analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  meter = new Float32Array(analyser.fftSize);
  master.connect(analyser);
  ambientBus = ctx.createGain();
  sfxBus = ctx.createGain();
  ambientBus.connect(master);
  sfxBus.connect(master);
  // A soft room: decaying stereo noise as the impulse response.
  reverb = ctx.createConvolver();
  const len = ctx.sampleRate * 3.2;
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
  }
  reverb.buffer = ir;
  const wet = ctx.createGain();
  wet.gain.value = 0.55;
  reverb.connect(wet).connect(master);
  noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const n = noise.getChannelData(0);
  for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  document.addEventListener('visibilitychange', () => {
    if (!enabled) return;
    if (document.hidden) {
      ctx.suspend();
      music?.el.pause();
    } else {
      ctx.resume();
      wake();
    }
  });
  return ctx;
}

const now = () => ctx.currentTime;

function envelope(gain, peak, attack, decay, at = now()) {
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

// The music streams from an <audio> element into the mix, so the master fade, the film's
// ducking and the background's response to sound all apply to it.
function startMusic() {
  if (!music) {
    const el = new Audio(musicUrl);
    el.loop = true;
    el.preload = 'auto';
    // Carry on where the previous page left off.
    el.addEventListener('loadedmetadata', () => {
      try {
        const at = parseFloat(sessionStorage.getItem(MUSIC_AT));
        if (at > 0) el.currentTime = at % el.duration;
      } catch {}
    }, { once: true });
    const remember = () => {
      if (startingOver) return;
      try {
        sessionStorage.setItem(MUSIC_AT, String(el.currentTime));
      } catch {}
    };
    addEventListener('pagehide', remember);
    setInterval(() => !el.paused && remember(), 2000);
    const gain = ctx.createGain();
    gain.gain.value = 0;
    ctx.createMediaElementSource(el).connect(gain).connect(ambientBus);
    music = { el, gain };
  }
  music.gain.gain.cancelScheduledValues(now());
  // Stopped (by us, the tab or the phone): it comes back from silence, not at full level.
  if (music.el.paused) music.gain.gain.setValueAtTime(0, now());
  music.gain.gain.setTargetAtTime(MUSIC_VOLUME, now(), 1.2);
  music.el.play().catch(() => {});
}

function stopMusic() {
  if (!music) return;
  music.gain.gain.cancelScheduledValues(now());
  music.gain.gain.setTargetAtTime(0, now(), 0.4);
  const { el } = music;
  setTimeout(() => !enabled && el.pause(), 1600);
}

// Bring the sound back wherever it was stopped for us: a new page waiting for a tap, a
// hidden tab, or the film having had the speaker. Not while the film still has it.
function wake() {
  if (!enabled || ducked || !graph()) return;
  ctx
    .resume()
    .then(() => {
      if (!enabled || ducked) return;
      master.gain.setTargetAtTime(1, now(), 0.6);
      if (!music || music.el.paused) startMusic();
    })
    .catch(() => {});
}

function bowl({ freq = PENTATONIC[Math.floor(Math.random() * PENTATONIC.length)], gain = 0.06, pan = Math.random() - 0.5 } = {}) {
  if (!ready()) return;
  const p = ctx.createStereoPanner();
  p.pan.value = pan;
  p.connect(sfxBus);
  p.connect(reverb);
  BOWL_PARTIALS.forEach(([ratio, amp], i) => {
    [0, 1.3].forEach((beat) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq * ratio + beat;
      envelope(g, gain * amp * 0.5, 0.006, 7 - i * 1.4);
      o.connect(g).connect(p);
      o.start();
      o.stop(now() + 7.5);
    });
  });
}

function noiseSource() {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = true;
  return src;
}

const ready = () => enabled && ctx && ctx.state === 'running';

export const sound = {
  get on() {
    return enabled;
  },

  /** Turn sound on or off. Call from a tap so browsers allow it to start. */
  set(on) {
    enabled = on;
    try {
      localStorage.setItem(KEY, on ? 'on' : 'off');
    } catch {}
    if (on) {
      if (!graph()) return;
      ctx.resume().then(() => {
        master.gain.setTargetAtTime(1, now(), 0.4);
        startMusic();
      });
    } else if (ctx) {
      master.gain.setTargetAtTime(0, now(), 0.25);
      stopMusic();
    }
    listeners.forEach((fn) => fn(enabled));
  },

  onChange(fn) {
    listeners.add(fn);
  },

  /** How loud the soundscape is right now, roughly 0..1 (the background breathes with it). */
  level() {
    if (!ready() || !analyser) return 0;
    analyser.getFloatTimeDomainData(meter);
    let sum = 0;
    for (let i = 0; i < meter.length; i++) sum += meter[i] * meter[i];
    return Math.min(1, Math.sqrt(sum / meter.length) * 6);
  },

  /** Wooden "tok" for touches. */
  tap() {
    if (!ready()) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(620, now());
    o.frequency.exponentialRampToValueAtTime(300, now() + 0.08);
    envelope(g, 0.12, 0.004, 0.11);
    o.connect(g).connect(sfxBus);
    g.connect(reverb);
    o.start();
    o.stop(now() + 0.2);
  },

  /** A faint glass tink when the pointer finds something (desktop). */
  hover() {
    if (!ready() || performance.now() - lastHover < 90) return;
    lastHover = performance.now();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1760 + Math.random() * 220;
    envelope(g, 0.018, 0.003, 0.14);
    o.connect(g).connect(sfxBus);
    o.start();
    o.stop(now() + 0.2);
  },

  /** Two-note bell: a choice made. */
  chime() {
    if (!ready()) return;
    [1318.5, 1975.5].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      envelope(g, 0.045, 0.005, 1.4, now() + i * 0.09);
      o.connect(g).connect(sfxBus);
      g.connect(reverb);
      o.start(now() + i * 0.09);
      o.stop(now() + 1.8);
    });
  },

  /** Countdown tick. */
  tick() {
    if (!ready()) return;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 2100;
    envelope(g, 0.03, 0.002, 0.035);
    o.connect(g).connect(sfxBus);
    o.start();
    o.stop(now() + 0.08);
  },

  bowl,

  /** Fetch and decode a recording once, ahead of time (only once sound is on). */
  load(url) {
    if (!enabled || !graph()) return Promise.resolve(null);
    if (!recordings.has(url)) {
      recordings.set(url, fetch(url).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).catch(() => null));
    }
    return recordings.get(url);
  },

  /** Play a recording, placed a little left or right. */
  play(url, { gain = 0.55, pan = 0 } = {}) {
    if (!ready()) return;
    sound.load(url).then((buffer) => {
      if (!buffer || !ready()) return;
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      const p = ctx.createStereoPanner();
      src.buffer = buffer;
      g.gain.value = gain;
      p.pan.value = pan;
      src.connect(g).connect(p).connect(sfxBus);
      src.start();
    });
  },

  /** Air moving: filtered noise sweeping between two frequencies. */
  whoosh({ dur = 0.6, from = 400, to = 2200, gain = 0.08 } = {}) {
    if (!ready()) return;
    const src = noiseSource();
    const f = ctx.createBiquadFilter();
    const g = ctx.createGain();
    const p = ctx.createStereoPanner();
    f.type = 'bandpass';
    f.Q.value = 0.9;
    f.frequency.setValueAtTime(from, now());
    f.frequency.exponentialRampToValueAtTime(to, now() + dur);
    g.gain.setValueAtTime(0.0001, now());
    g.gain.exponentialRampToValueAtTime(gain, now() + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, now() + dur);
    p.pan.setValueAtTime(-0.4, now());
    p.pan.linearRampToValueAtTime(0.4, now() + dur);
    src.connect(f).connect(g).connect(p).connect(sfxBus);
    g.connect(reverb);
    src.start();
    src.stop(now() + dur + 0.1);
  },

  /** Back to how a visit begins: silent until the visitor says yes, the music from the top. */
  startOver() {
    startingOver = true;
    sound.set(false);
    try {
      sessionStorage.removeItem(MUSIC_AT);
    } catch {}
  },

  /** Lower the music while the award film plays with its own sound, and bring it back after. */
  duck(on) {
    if (on === ducked) return;
    ducked = on;
    if (!ctx) return;
    ambientBus.gain.setTargetAtTime(on ? 0.12 : 1, now(), on ? 0.5 : 0.9);
    if (!on) wake();
  },
};

/** Restore an earlier "yes" (after the first tap on this page), and wire the site's events to sounds. */
export function initSound() {
  wake();
  // Any tap or key brings back sound the browser has stopped (and lets a new page start it).
  const nudge = () => {
    if (enabled && !ducked && (!ctx || ctx.state !== 'running' || !music || music.el.paused)) wake();
  };
  ['pointerdown', 'keydown', 'touchend'].forEach((type) => addEventListener(type, nudge, { capture: true, passive: true }));

  const touchable = '.btn, .more, .teaser, .choice__option, .map-replay, .nav__list a, .lang-trigger, .sound-toggle, .poster-link, .map-pin';
  document.addEventListener('pointerdown', (e) => {
    if (e.target.closest(touchable)) sound.tap();
  });
  if (matchMedia('(hover: hover)').matches) {
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest(touchable);
      if (el && !el.contains(e.relatedTarget)) sound.hover();
    });
  }
  document.addEventListener('mai:fling', (e) => sound.whoosh({ dur: 0.5, from: 300, to: 1800, gain: Math.min(0.12, Math.abs(e.detail.speed) / 9000) }));
  document.addEventListener('mai:fly', () => sound.whoosh({ dur: 5.5, from: 120, to: 900, gain: 0.07 }));
  document.addEventListener('mai:arrive', () => sound.bowl({ freq: 220, gain: 0.08, pan: 0 }));
  document.addEventListener('mai:chooser', () => sound.chime());
}
