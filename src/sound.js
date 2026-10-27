// Sound, all synthesised with Web Audio (no audio files): a warm ambient drone with
// singing-bowl tones now and then, and soft sounds for touches, flings, the map flight
// and the Yu-fai fire. Nothing plays until the visitor says yes (portal or header
// speaker); the choice is remembered. On later pages browsers only allow audio after a
// tap, so the ambience fades in on the first one.

const KEY = 'mai-sound';
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
let drone = null;
let bowlTimer = 0;
let fire = null;
let lastHover = 0;
const listeners = new Set();

function graph() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -12;
  master.connect(limiter).connect(ctx.destination);
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
    document.hidden ? ctx.suspend() : ctx.resume();
  });
  return ctx;
}

const now = () => ctx.currentTime;

function envelope(gain, peak, attack, decay, at = now()) {
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
}

function startDrone() {
  if (drone) return;
  const out = ctx.createGain();
  out.gain.value = 0;
  out.gain.linearRampToValueAtTime(0.055, now() + 4);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 800;
  filter.Q.value = 0.4;
  filter.connect(out).connect(ambientBus);
  out.connect(reverb);
  // Slow breathing on the brightness.
  const lfo = ctx.createOscillator();
  const depth = ctx.createGain();
  lfo.frequency.value = 0.06;
  depth.gain.value = 320;
  lfo.connect(depth).connect(filter.frequency);
  lfo.start();
  const voices = [110, 164.81, 220, 329.63].flatMap((f, i) =>
    [-3, 3].map((cents) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = cents;
      g.gain.value = [0.5, 0.28, 0.22, 0.08][i];
      o.connect(g).connect(filter);
      o.start();
      return o;
    }),
  );
  drone = { out, stop: () => [...voices, lfo].forEach((o) => o.stop(now() + 2.5)) };
  scheduleBowl(2.5);
}

function stopDrone() {
  if (!drone) return;
  drone.out.gain.cancelScheduledValues(now());
  drone.out.gain.setTargetAtTime(0, now(), 0.6);
  drone.stop();
  drone = null;
  clearTimeout(bowlTimer);
}

function scheduleBowl(delay) {
  clearTimeout(bowlTimer);
  bowlTimer = setTimeout(() => {
    if (!drone) return;
    bowl({ gain: 0.035 + Math.random() * 0.025 });
    scheduleBowl(9 + Math.random() * 7);
  }, delay * 1000);
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
        startDrone();
      });
    } else if (ctx) {
      master.gain.setTargetAtTime(0, now(), 0.25);
      stopDrone();
      sound.fire(false);
    }
    listeners.forEach((fn) => fn(enabled));
  },

  onChange(fn) {
    listeners.add(fn);
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

  /** The Yu-fai fire: crackles over a low warm rumble while it's on screen. */
  fire(on) {
    if (!on || !ready()) {
      if (fire) {
        clearTimeout(fire.timer);
        fire.gain.gain.setTargetAtTime(0, now(), 0.3);
        fire.src.stop(now() + 1.5);
        fire = null;
      }
      return;
    }
    if (fire) return;
    const src = noiseSource();
    const low = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    low.type = 'lowpass';
    low.frequency.value = 180;
    gain.gain.value = 0;
    gain.gain.setTargetAtTime(0.05, now(), 0.8);
    src.connect(low).connect(gain).connect(ambientBus);
    src.start();
    const crack = () => {
      if (!fire) return;
      const s = noiseSource();
      const hp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      hp.type = 'highpass';
      hp.frequency.value = 1200 + Math.random() * 2500;
      envelope(g, 0.02 + Math.random() * 0.05, 0.001, 0.01 + Math.random() * 0.04);
      s.connect(hp).connect(g).connect(sfxBus);
      s.start(now(), Math.random() * 1.5);
      s.stop(now() + 0.08);
      fire.timer = setTimeout(crack, 30 + Math.random() * (Math.random() < 0.2 ? 400 : 120));
    };
    fire = { src, gain, timer: 0 };
    crack();
  },

  /** Lower the ambience while the award film plays with its own sound. */
  duck(on) {
    if (!ctx) return;
    ambientBus.gain.setTargetAtTime(on ? 0.12 : 1, now(), 0.5);
  },
};

/** Restore an earlier "yes" (after the first tap on this page), and wire the site's events to sounds. */
export function initSound() {
  if (enabled && graph()) {
    const wake = () => {
      ctx.resume().then(() => {
        if (!enabled) return;
        master.gain.setTargetAtTime(1, now(), 0.6);
        startDrone();
      });
    };
    wake();
    ['pointerdown', 'keydown', 'touchend'].forEach((type) => addEventListener(type, wake, { once: true, capture: true }));
  }

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

  const fireEl = document.querySelector('[data-fire]');
  if (fireEl) new IntersectionObserver(([en]) => sound.fire(en.isIntersecting), { threshold: 0.35 }).observe(fireEl);
  sound.onChange((on) => {
    if (on && fireEl) {
      const r = fireEl.getBoundingClientRect();
      sound.fire(r.top < innerHeight && r.bottom > 0);
    }
  });
}
