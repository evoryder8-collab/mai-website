// The saffron sash: a seamless loop you can grab and fling.
// Same model as the Lume Wellness award ribbon. The text is rendered twice and the
// track moves by an offset wrapped to one pass, so the seam never shows. Dragging
// moves it 1:1; on release it keeps the swipe speed, then eases back to cruising
// speed. Page scrolling gives it a push too.

const CRUISE_SECONDS = 42; // one pass at rest
const SETTLE = 0.72; // seconds: time constant of the return to cruising speed
const MAX_FLING = 1400; // px/s
const HOLD_MS = 90; // a finger that rested this long before release lets go without a fling

export function initSash({ lenis, reduceMotion }) {
  const sash = document.querySelector('.sash');
  const track = sash?.querySelector('.sash__track');
  const pass = track?.querySelector('.sash__set');
  if (!pass || reduceMotion) return;

  let period = pass.getBoundingClientRect().width;
  let offset = 0;
  let speed = period / CRUISE_SECONDS;
  let pointer;
  let prevX = 0;
  let prevTime = 0;
  let dragSpeed = 0;
  let frame = 0;
  let last = 0;
  let visible = false;

  sash.dataset.ribbon = '';

  const paint = () => {
    if (period) offset = ((offset % period) + period) % period;
    track.style.transform = `translate3d(${-offset}px,0,0)`;
  };

  const tick = (now) => {
    frame = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000 || 0.016, 0.05);
    last = now;
    if (pointer === undefined) {
      // Exponential damping keeps the release speed and glides back to cruising,
      // even after a fling the other way.
      const cruise = period / CRUISE_SECONDS;
      speed = cruise + (speed - cruise) * Math.exp(-dt / SETTLE);
      offset += speed * dt;
      paint();
    }
    frame = requestAnimationFrame(tick);
  };

  const start = () => {
    if (frame || !visible || document.hidden) return;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  };

  sash.addEventListener('pointerdown', (e) => {
    if (!e.isPrimary || e.button !== 0) return;
    pointer = e.pointerId;
    prevX = e.clientX;
    prevTime = performance.now();
    dragSpeed = 0;
    speed = 0;
    sash.classList.add('is-grabbed');
    try {
      sash.setPointerCapture(pointer);
    } catch {}
  });

  sash.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointer) return;
    const now = performance.now();
    const delta = prevX - e.clientX;
    const dt = Math.max(8, now - prevTime) / 1000;
    offset += delta;
    dragSpeed = dragSpeed * 0.3 + Math.max(-MAX_FLING, Math.min(MAX_FLING, delta / dt)) * 0.7;
    prevX = e.clientX;
    prevTime = now;
    paint();
  });

  const release = (e) => {
    if (e.pointerId !== pointer) return;
    speed = performance.now() - prevTime > HOLD_MS ? 0 : dragSpeed;
    if (Math.abs(speed) > 300) document.dispatchEvent(new CustomEvent('mai:fling', { detail: { speed } }));
    pointer = undefined;
    sash.classList.remove('is-grabbed');
    if (sash.hasPointerCapture(e.pointerId)) sash.releasePointerCapture(e.pointerId);
  };
  sash.addEventListener('pointerup', release);
  sash.addEventListener('pointercancel', release);
  sash.addEventListener('lostpointercapture', release);
  window.addEventListener('pointerup', release);
  window.addEventListener('blur', () => {
    if (pointer !== undefined && sash.hasPointerCapture(pointer)) sash.releasePointerCapture(pointer);
    pointer = undefined;
    speed = 0;
    sash.classList.remove('is-grabbed');
  });
  sash.addEventListener('dragstart', (e) => e.preventDefault());

  // Sideways trackpad swipes move it directly.
  sash.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      offset += e.deltaX;
      speed = 0;
      paint();
    },
    { passive: false },
  );

  // Scrolling the page pushes it along in the scroll direction; the damping brings it back.
  lenis?.on('scroll', ({ velocity }) => {
    if (pointer !== undefined) return;
    const push = Math.sign(velocity) * Math.min(Math.abs(velocity) * 24, 600);
    if (Math.abs(push) > Math.abs(speed)) speed = push;
  });

  new ResizeObserver(() => {
    const next = pass.getBoundingClientRect().width;
    if (period && next) offset *= next / period;
    period = next;
    paint();
  }).observe(pass);

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    start();
  }).observe(sash);
  document.addEventListener('visibilitychange', start);

  paint();
}
