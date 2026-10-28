// Sound: her background music ("Weightless Clouds 2", looping at 40% to start with, picking
// up on each page where the last one left off), recorded effects for touches, choices, the
// sash, the map flight and the bowl (CC0 recordings from Freesound, found through Openverse;
// credits in the README), and Latte's and Mugi's barks, all through one Web Audio mix.
// Nothing plays until the visitor says yes (portal or header speaker); the choice is
// remembered. On later pages browsers only allow audio after a tap, so the music fades in
// on the first one. iPhones let one thing play sound at a time: the award film pauses the
// music (and may suspend the mix), and once the film stops the music fades back in where
// it was.

import musicUrl from './assets/mai-music.mp3';
import bowlUrl from './assets/sfx-bowl.mp3';
import chimeUrl from './assets/sfx-chime.mp3';
import flightUrl from './assets/sfx-flight.mp3';
import hoverUrl from './assets/sfx-hover.mp3';
import swishUrl from './assets/sfx-swish.mp3';
import tapUrl from './assets/sfx-tap.mp3';
import tickUrl from './assets/sfx-tick.mp3';

const KEY = 'mai-sound';
const MUSIC_VOLUME = 0.4;
const MUSIC_AT = 'mai-music-at';
// Each effect and how loud it plays. The files share one peak level; these put them where the
// old synthesised sounds sat, under the music (about -26 LUFS): the bowl and chime a few dB
// below it, a tap about 10, the countdown tick and the hover ting quieter still.
const SFX = {
  tap: [tapUrl, 0.3],
  hover: [hoverUrl, 0.055],
  chime: [chimeUrl, 0.36],
  tick: [tickUrl, 0.06],
  bowl: [bowlUrl, 0.19],
  swish: [swishUrl, 0.35],
  flight: [flightUrl, 0.1],
};

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
let music = null;
let startingOver = false;
let ducked = false;
let lastHover = 0;
let analyser = null;
let meter = null;
const listeners = new Set();
const recordings = new Map();
const decoded = new Map();

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
      preloadEffects();
    })
    .catch(() => {});
}

const preloadEffects = () => Object.values(SFX).forEach(([url]) => sound.load(url));

function voice(buffer, { gain, pan = 0, rate = 1 }) {
  const src = ctx.createBufferSource();
  const g = ctx.createGain();
  const p = ctx.createStereoPanner();
  src.buffer = buffer;
  src.playbackRate.value = rate;
  g.gain.value = gain;
  p.pan.value = pan;
  src.connect(g).connect(p).connect(sfxBus);
  src.start();
}

// The effects are fetched as soon as sound is on. One that isn't ready yet (the portal's first
// chime) may still play if it arrives within half a second; later than that it's dropped,
// as a touch sound that comes late is worse than none.
function effect(name, { level = 1, pan = 0, rate = 1 } = {}) {
  if (!ready()) return;
  const [url, gain] = SFX[name];
  const play = (buffer) => voice(buffer, { gain: gain * level, pan, rate });
  if (decoded.has(url)) return play(decoded.get(url));
  const asked = performance.now();
  sound.load(url).then((buffer) => buffer && ready() && performance.now() - asked < 500 && play(buffer));
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
        preloadEffects();
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

  /** A soft wooden tap for touches. */
  tap() {
    effect('tap', { rate: 0.96 + Math.random() * 0.08 });
  },

  /** A faint glass ting when the pointer finds something (desktop). */
  hover() {
    if (performance.now() - lastHover < 90) return;
    lastHover = performance.now();
    effect('hover', { rate: 0.94 + Math.random() * 0.14, pan: (Math.random() - 0.5) * 0.5 });
  },

  /** A small bell: a choice made. */
  chime() {
    effect('chime');
  },

  /** Countdown tick. */
  tick() {
    effect('tick');
  },

  /** The singing bowl: her line in the portal, and the map arriving at the salon. */
  bowl() {
    effect('bowl');
  },

  /** Fetch and decode a recording once, ahead of time (only once sound is on). */
  load(url) {
    if (!enabled || !graph()) return Promise.resolve(null);
    if (!recordings.has(url)) {
      recordings.set(
        url,
        fetch(url)
          .then((r) => r.arrayBuffer())
          .then((b) => ctx.decodeAudioData(b))
          .then((buffer) => {
            decoded.set(url, buffer);
            return buffer;
          })
          .catch(() => null),
      );
    }
    return recordings.get(url);
  },

  /** Play a recording, placed a little left or right. */
  play(url, { gain = 0.55, pan = 0 } = {}) {
    if (!ready()) return;
    sound.load(url).then((buffer) => buffer && ready() && voice(buffer, { gain, pan }));
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
  // The sash: the harder it's flung, the louder and brighter it swishes, toward where it went.
  document.addEventListener('mai:fling', (e) => {
    const speed = Math.abs(e.detail.speed);
    effect('swish', { level: Math.min(1, speed / 1100), rate: 0.9 + Math.min(0.25, speed / 8000), pan: -Math.sign(e.detail.speed) * 0.3 });
  });
  document.addEventListener('mai:fly', () => effect('flight'));
  document.addEventListener('mai:arrive', () => sound.bowl());
  document.addEventListener('mai:chooser', () => sound.chime());
}
