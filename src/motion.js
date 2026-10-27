// Smooth scrolling (Lenis) and scroll choreography (GSAP + ScrollTrigger).
// With prefers-reduced-motion, only the header behaviour and anchor links are set up.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger };

export function initMotion({ reduceMotion }) {
  let lenis = null;

  if (!reduceMotion) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  initAnchors(lenis);
  initHeader(lenis);

  if (!reduceMotion) {
    intro();
    reveals();
    parallax();
    sash(lenis);
    fireGlow();
    document.addEventListener('langchange', () => ScrollTrigger.refresh());
    document.fonts?.ready.then(() => ScrollTrigger.refresh());

    // Deep links (#award etc.): land on the section and reveal it now, not after window load.
    const target = location.hash.length > 1 && document.querySelector(location.hash);
    if (target) {
      const header = document.querySelector('[data-header]');
      lenis.scrollTo(target, { immediate: true, force: true, offset: -(header?.offsetHeight ?? 0) + 1 });
    }
    ScrollTrigger.refresh();
  }

  document.documentElement.classList.add('ready');
  return { lenis };
}

function initAnchors(lenis) {
  const header = document.querySelector('[data-header]');
  document.querySelectorAll('a[href^="#"]:not(.skip-link)').forEach((link) => {
    link.addEventListener('click', (e) => {
      const hash = link.getAttribute('href');
      const target = hash === '#top' ? 0 : document.querySelector(hash);
      if (target == null) return;
      e.preventDefault();
      const offset = target === 0 ? 0 : -(header?.offsetHeight ?? 0) + 1;
      if (lenis) lenis.scrollTo(target, { offset, duration: 1.5, force: true });
      else window.scrollTo({ top: target === 0 ? 0 : target.getBoundingClientRect().top + scrollY + offset });
    });
  });
}

function initHeader(lenis) {
  const header = document.querySelector('[data-header]');
  if (!header) return;
  let last = window.scrollY;
  const update = (y) => {
    header.classList.toggle('is-scrolled', y > 24);
    if (Math.abs(y - last) < 6 || header.classList.contains('menu-open')) return;
    header.classList.toggle('is-hidden', y > last && y > 480);
    last = y;
  };
  if (lenis) lenis.on('scroll', ({ scroll }) => update(scroll));
  else window.addEventListener('scroll', () => update(window.scrollY), { passive: true });
  update(window.scrollY);
}

function intro() {
  const name = document.querySelector('[data-intro-name]');
  const split = SplitText.create(name, { type: 'chars', charsClass: 'char' });

  gsap
    .timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 })
    .from('[data-intro-photo] .frame', { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.7, ease: 'expo.inOut' }, 0)
    .from('[data-intro-photo] img', { scale: 1.3, duration: 2.4 }, 0.15)
    .from(split.chars, { yPercent: 105, duration: 1.5, stagger: 0.09 }, 0.35)
    .from('[data-intro]', { y: 26, autoAlpha: 0, duration: 1.3, stagger: 0.08 }, 0.55)
    .from('[data-intro-photo] figcaption', { autoAlpha: 0, duration: 1 }, 1.2);
}

function reveals() {
  gsap.set('[data-reveal]', { y: 40, autoAlpha: 0 });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { y: 0, autoAlpha: 1, duration: 1.25, ease: 'expo.out', stagger: 0.09, overwrite: true }),
  });

  gsap.utils.toArray('[data-reveal-photo]').forEach((el) => {
    const frame = el.querySelector('.frame, .map') ?? el;
    const img = frame.querySelector('img');
    const tl = gsap
      .timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true } })
      .from(frame, { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.6, ease: 'expo.inOut' });
    if (img) tl.from(img, { scale: 1.25, duration: 2.2, ease: 'expo.out' }, 0.1);
  });

  const numeral = document.querySelector('[data-numeral]');
  if (numeral) {
    gsap.from(numeral, {
      yPercent: 30,
      autoAlpha: 0,
      duration: 1.8,
      ease: 'expo.out',
      scrollTrigger: { trigger: numeral, start: 'top 88%', once: true },
    });
  }
}

function parallax() {
  gsap.utils.toArray('.frame--parallax img').forEach((img) => {
    gsap.fromTo(
      img,
      { yPercent: -6 },
      { yPercent: 6, ease: 'none', scrollTrigger: { trigger: img.closest('.frame'), start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  });

  const band = document.querySelector('[data-band]');
  if (band) {
    gsap.fromTo(
      band,
      { yPercent: -8 },
      { yPercent: 8, ease: 'none', scrollTrigger: { trigger: band.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } },
    );
  }
}

// The saffron sash drifts on its own and speeds up (or reverses) with scrolling.
function sash(lenis) {
  const track = document.querySelector('.sash__track');
  if (!track) return;
  const loop = gsap.to(track, { xPercent: -50, duration: 42, ease: 'none', repeat: -1 });
  loop.totalTime(loop.duration() * 50); // room to play backwards
  if (!lenis) return;
  let dir = 1;
  lenis.on('scroll', ({ velocity, direction }) => {
    if (direction) dir = direction;
    const boost = Math.min(Math.abs(velocity) * 0.4, 7);
    gsap.to(loop, { timeScale: dir * (1 + boost), duration: 0.25, overwrite: true });
    gsap.to(loop, { timeScale: dir, duration: 1.4, delay: 0.25, ease: 'power2.out' });
  });
}

// "Staying by the fire": the glow leans toward the pointer.
function fireGlow() {
  const visual = document.querySelector('[data-fire] .treatment__visual');
  const glow = document.querySelector('[data-fire-glow]');
  if (!visual || !glow || !matchMedia('(hover: hover)').matches) return;
  const xTo = gsap.quickTo(glow, 'x', { duration: 1.4, ease: 'power3' });
  const yTo = gsap.quickTo(glow, 'y', { duration: 1.4, ease: 'power3' });
  visual.addEventListener('pointermove', (e) => {
    const r = visual.getBoundingClientRect();
    xTo((e.clientX - r.left - r.width / 2) * 0.4);
    yTo((e.clientY - r.top - r.height * 0.62) * 0.4);
  });
  visual.addEventListener('pointerleave', () => {
    xTo(0);
    yTo(0);
  });
}
