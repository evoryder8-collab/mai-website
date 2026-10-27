// Award ceremony video.
// Ambient: muted loop of the ceremony only, playing while on screen.
// With sound: the full edit from the start, including the closing title card,
// then back to the ambient loop.

const LOOP_END = 9.0; // seconds; the closing title starts fading in at ~9.5 s

export function initVideo({ reduceMotion }) {
  const video = document.querySelector('[data-award-video]');
  const button = document.querySelector('[data-video-sound]');
  if (!video || !button) return;

  let mode = 'ambient';
  let inView = false;

  const play = () => video.play().catch(() => {});

  const toAmbient = () => {
    mode = 'ambient';
    video.muted = true;
    video.currentTime = 0;
    button.setAttribute('aria-pressed', 'false');
    if (inView && !reduceMotion) play();
    else video.pause();
  };

  const toFull = () => {
    mode = 'full';
    video.muted = false;
    video.currentTime = 0;
    button.setAttribute('aria-pressed', 'true');
    play();
  };

  button.addEventListener('click', () => (mode === 'ambient' ? toFull() : toAmbient()));

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

  new IntersectionObserver(
    ([entry]) => {
      inView = entry.isIntersecting;
      if (!inView) video.pause();
      else if (mode === 'full' || !reduceMotion) play();
    },
    { threshold: 0.3 },
  ).observe(video);
}
