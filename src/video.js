// Award ceremony video.
// Ambient: muted loop of the ceremony only, playing while on screen.
// With sound: the full edit from the start, including the closing title card,
// then back to the ambient loop. On phones the film fills the screen as you scroll onto
// it (motion.js); with sound on, that plays the full edit aloud, or, where the browser
// still wants a tap first, plays muted and offers "Tap for sound".
import { sound } from './sound.js';

const LOOP_END = 9.0; // seconds; the closing title starts fading in at ~9.5 s

export function initVideo({ reduceMotion }) {
  const video = document.querySelector('[data-award-video]');
  const button = document.querySelector('[data-video-sound]');
  if (!video || !button) return;
  const unmute = document.querySelector('[data-video-unmute]');
  const fullscreen = document.querySelector('[data-video-full]');

  let mode = 'ambient';
  let inView = false;

  const play = () => video.play().catch(() => {});
  const setDuck = () => sound.duck(mode === 'full' && !video.muted && !video.paused);

  const toAmbient = () => {
    mode = 'ambient';
    video.muted = true;
    video.currentTime = 0;
    button.setAttribute('aria-pressed', 'false');
    if (unmute) unmute.hidden = true;
    if (inView && !reduceMotion) play();
    else video.pause();
    setDuck();
  };

  // Full edit from the start with sound. Without a tap on this page some browsers refuse
  // audible playback: then it plays muted and the "Tap for sound" chip appears.
  const toFull = () => {
    mode = 'full';
    video.currentTime = 0;
    video.muted = false;
    button.setAttribute('aria-pressed', 'true');
    video.play().then(
      () => {
        if (unmute) unmute.hidden = true;
        setDuck();
      },
      () => {
        video.muted = true;
        button.setAttribute('aria-pressed', 'false');
        play();
        if (unmute) unmute.hidden = false;
      },
    );
  };

  button.addEventListener('click', () => (mode === 'ambient' || video.muted ? toFull() : toAmbient()));
  unmute?.addEventListener('click', toFull);

  // True fullscreen needs a tap: this button.
  fullscreen?.addEventListener('click', () => {
    toFull();
    if (video.requestFullscreen) video.requestFullscreen().catch(() => {});
    else video.webkitEnterFullscreen?.();
  });

  document.addEventListener('mai:film', (e) => {
    if (e.detail.immersive && sound.on) toFull();
    else if (!e.detail.immersive && mode === 'full') toAmbient();
  });
  sound.onChange((on) => {
    if (!on && mode === 'full') toAmbient();
  });

  // Frame-accurate loop point where supported, timeupdate elsewhere.
  const checkLoop = () => {
    if (mode === 'ambient' && video.currentTime >= LOOP_END) video.currentTime = 0;
  };
  if ('requestVideoFrameCallback' in HTMLVideoElement.prototype) {
    const onFrame = () => {
      checkLoop();
      video.requestVideoFrameCallback(onFrame);
    };
    video.requestVideoFrameCallback(onFrame);
  } else {
    video.addEventListener('timeupdate', checkLoop);
  }

  video.addEventListener('ended', () => (mode === 'full' ? toAmbient() : play()));
  ['play', 'pause', 'volumechange'].forEach((ev) => video.addEventListener(ev, setDuck));

  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (!inView) video.pause();
      else if (mode === 'full' || !reduceMotion) play();
    },
    { threshold: 0.3 },
  ).observe(video);
}
