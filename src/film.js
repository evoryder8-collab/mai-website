// The award film, built the way Zoltán's site does it. A vertical glass card floats in 3D,
// tilted and leaning toward the pointer; as the visitor scrolls, the section's stage stays
// on screen and the card straightens and grows until it fills it (phones: edge to edge;
// desktop: full height, a dark theatre around it), and the film plays while it does.
// Browsers only grant real fullscreen to a tap, so the scroll does a full-screen takeover
// and a button offers the real thing. Sound follows the portal's choice: the "Yes" tap
// also unlocks the video for audible play on iPhones (a silent play-and-pause), and the
// ambience ducks under the film. Where sound is still refused it plays muted and the
// sound button pulses for a tap.
import { t } from './lang.js';
import { sound } from './sound.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
// Scroll progress through the section.
const GROW = [0.16, 0.42]; // floating card → full screen
const PLAY = [0.34, 0.97]; // the film plays inside this window
const COVER = [0.84, 1.0]; // the satin rises over the film, on to the next section

export function initFilm({ reduceMotion }) {
  const section = document.querySelector('.film');
  if (!section) return;
  const frame = section.querySelector('.film__frame');
  const video = section.querySelector('.film__video');
  const soundBtn = section.querySelector('.film__sound');
  const soundLabel = section.querySelector('.film__sound-label');
  const fullBtn = section.querySelector('.film__full');
  const replay = section.querySelector('.film__replay');
  const bar = section.querySelector('.film__bar i');
  const root = document.documentElement;

  let wantSound = sound.on;
  video.muted = true;
  let playing = false;
  let inWindow = false;
  let ended = false;

  // Start fetching the film once it's getting close.
  let loaded = false;
  const load = () => {
    if (loaded) return;
    loaded = true;
    video.preload = 'auto';
    video.load();
  };
  new IntersectionObserver(([e], io) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    load();
  }, { rootMargin: '1400px 0px' }).observe(section);

  // iPhones: the portal's sound tap unlocks this element for audible play later. Safari
  // lifts the restriction when play() is called inside a tap, so a muted play that is
  // stopped at once is enough, and nothing is heard.
  document.addEventListener('mai:soundgesture', (e) => {
    wantSound = e.detail.on;
    if (!e.detail.on) return;
    load();
    video.muted = true;
    video.play()?.catch(() => {});
    video.pause();
  });
  // Nothing plays outside the full-screen window, whatever asked it to (with reduced
  // motion there's no window: the visitor plays it with the controls).
  if (!reduceMotion) {
    video.addEventListener('play', () => {
      if (!inWindow) video.pause();
    });
  }
  sound.onChange((on) => {
    wantSound = on;
    if (playing) setMuted(!on);
  });

  const syncSoundUi = () => {
    const audible = !video.muted;
    soundBtn.setAttribute('aria-pressed', String(audible));
    soundBtn.classList.toggle('is-muted', !audible);
    soundLabel.dataset.t = audible ? 'film-sound-on' : 'tap-for-sound';
    soundLabel.innerHTML = t(soundLabel.dataset.t);
  };
  const setMuted = (m) => {
    video.muted = m;
    sound.duck(!m && playing);
    syncSoundUi();
  };
  document.addEventListener('langchange', syncSoundUi);

  // If the sound can't actually be played (footage is there, but the clock doesn't move),
  // carry on muted. Watched from the start: in that state play() may never settle.
  const watchSound = () => {
    let checks = 0;
    let from = video.currentTime;
    const watch = setInterval(() => {
      const ahead = [...Array(video.buffered.length).keys()].some((i) => video.buffered.start(i) <= video.currentTime && video.buffered.end(i) > video.currentTime + 1);
      if (!playing || video.muted || video.paused || ++checks > 6) return clearInterval(watch);
      if (ahead && video.currentTime - from < 0.25) {
        // A stalled start can leave the decoder stuck even once muted: reset it and go again.
        clearInterval(watch);
        const at = video.currentTime;
        setMuted(true);
        video.load();
        video.currentTime = at;
        video.play().catch(() => {});
      }
      from = video.currentTime;
    }, 1000);
  };

  const play = async () => {
    if (playing || ended) return;
    load();
    playing = true;
    video.muted = !wantSound;
    syncSoundUi();
    if (!video.muted) watchSound();
    try {
      await video.play();
    } catch {
      // No permission for sound: carry on silently and offer the tap.
      video.muted = true;
      try {
        await video.play();
      } catch {
        playing = false;
      }
    }
    sound.duck(!video.muted && playing);
    syncSoundUi();
  };
  const pause = () => {
    if (!playing) return;
    playing = false;
    video.pause();
    sound.duck(false);
  };

  soundBtn.addEventListener('click', () => {
    setMuted(!video.muted);
    if (!video.muted && video.paused && !ended) video.play().catch(() => {});
  });
  fullBtn.addEventListener('click', () => {
    if (video.webkitEnterFullscreen && !document.fullscreenEnabled) return video.webkitEnterFullscreen();
    const el = frame.querySelector('.film__bezel');
    (el.requestFullscreen?.() || el.webkitRequestFullscreen?.())?.catch?.(() => {});
  });
  replay.addEventListener('click', () => {
    ended = false;
    replay.hidden = true;
    video.currentTime = 0;
    playing = false;
    play();
  });
  video.addEventListener('ended', () => {
    ended = true;
    playing = false;
    sound.duck(false);
    replay.hidden = false;
  });
  // Two seconds into playback the satin rises a little at the bottom, with the hint on it:
  // keep scrolling to stop the film.
  const exitHint = section.querySelector('.film__exit');
  let hintOn = false;
  const syncExitHint = () => {
    hintOn = inWindow && !ended && !video.paused && video.currentTime >= 2;
    exitHint.classList.toggle('is-on', hintOn);
  };
  video.addEventListener('timeupdate', () => {
    if (video.duration) bar.style.transform = `scaleX(${(video.currentTime / video.duration).toFixed(4)})`;
    syncExitHint();
  });
  ['pause', 'ended'].forEach((ev) => video.addEventListener(ev, syncExitHint));
  // Tapping the playing film pauses it, and tapping again resumes.
  video.addEventListener('click', () => {
    if (!inWindow) return;
    if (video.paused) {
      playing = false;
      play();
    } else pause();
  });

  // Reduced motion: a still card that plays on tap, no scroll takeover.
  if (reduceMotion) {
    section.classList.add('is-static');
    video.controls = true;
    syncSoundUi();
    return;
  }

  // The scroll choreography.
  let vw = innerWidth;
  let vh = innerHeight;
  let rect = { w0: 0, h0: 0, x0: 0, y0: 0, W: 0, H: 0, portrait: false };
  let lastP = 0;
  const measure = () => {
    vw = innerWidth;
    vh = innerHeight;
    const phone = vw < 760;
    const h0 = phone ? Math.min(vh * 0.56, 560) : Math.min(vh * 0.74, 680);
    const portrait = vw / vh < 0.75;
    rect = {
      h0,
      w0: (h0 * 9) / 16,
      x0: phone ? 0 : Math.min(vw * 0.2, 300),
      y0: phone ? vh * 0.12 : 0,
      portrait,
      // Phones held upright: edge to edge; elsewhere: full height at 9:16.
      H: vh,
      W: portrait ? vw : (vh * 9) / 16,
    };
    update(lastP);
  };

  // The card leans toward the pointer; on phones it sways gently on its own.
  const touch = matchMedia('(pointer: coarse)').matches;
  let px = 0;
  let py = 0;
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    px = e.clientX / innerWidth - 0.5;
    py = e.clientY / innerHeight - 0.5;
  }, { passive: true });

  function update(p) {
    lastP = p;
    const k = ease(clamp((p - GROW[0]) / (GROW[1] - GROW[0])));
    const float = 1 - k;
    const now = performance.now() / 1000;
    const lx = touch ? Math.sin(now * 0.7) * 0.35 : px;
    const ly = touch ? Math.cos(now * 0.55) * 0.25 : py;
    const s = frame.style;
    s.setProperty('--w', `${lerp(rect.w0, rect.W, k).toFixed(1)}px`);
    s.setProperty('--h', `${lerp(rect.h0, rect.H, k).toFixed(1)}px`);
    s.setProperty('--x', `${lerp(rect.x0, 0, k).toFixed(1)}px`);
    s.setProperty('--y', `${lerp(rect.y0, 0, k).toFixed(1)}px`);
    s.setProperty('--ry', `${(float * (-16 + lx * 14)).toFixed(2)}deg`);
    s.setProperty('--rx', `${(float * (6 - ly * 8)).toFixed(2)}deg`);
    s.setProperty('--r', `${lerp(30, rect.portrait ? 0 : 18, k).toFixed(1)}px`);
    s.setProperty('--pad', `${lerp(10, 0, k).toFixed(1)}px`);
    section.style.setProperty('--k', k.toFixed(3));
    // Only while the film has the screen: once the satin has mostly covered it the header comes back.
    cover = ease(clamp((p - COVER[0]) / (COVER[1] - COVER[0])));
    const full = k > 0.98 && cover < 0.6;
    root.classList.toggle('film-full', full);
    section.classList.toggle('is-full', full);
    section.classList.toggle('is-covering', cover > 0.04);

    const nowIn = p >= PLAY[0] && p <= PLAY[1];
    if (nowIn !== inWindow) {
      inWindow = nowIn;
      if (nowIn) play();
      else pause();
    }
  }

  // While the section is on screen: keep the floating card alive, move the satin's liquid
  // edge, and raise the tide (a little for the hint, all the way as the section ends; it
  // follows the scroll closely there and rises gently for the hint).
  let cover = 0;
  let tide = 0;
  let onScreen = false;
  let raf = 0;
  const tick = (now) => {
    raf = 0;
    if (!onScreen) return;
    if (lastP < GROW[1]) update(lastP);
    const target = Math.max(hintOn ? (vw < 760 ? 112 : 96) : 0, cover * (vh + 60));
    tide += (target - tide) * (cover > 0 ? 0.35 : 0.06);
    section.style.setProperty('--tide', `${tide.toFixed(1)}px`);
    section.style.setProperty('--wx', `${((now / 1000) * 46) % 480}px`);
    raf = requestAnimationFrame(tick);
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !raf) raf = requestAnimationFrame(tick);
  }).observe(section);

  const onScroll = () => {
    const r = section.getBoundingClientRect();
    const total = r.height - vh;
    update(total > 0 ? clamp(-r.top / total) : 0);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', measure);
  measure();
  onScroll();
  syncSoundUi();
}
