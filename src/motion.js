// Smooth scrolling (Lenis) and scroll choreography (GSAP + ScrollTrigger).
// With prefers-reduced-motion, only the header behaviour and anchor links are set up.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger };

export function initMotion({ reduceMotion, deferIntro = false }) {
  let lenis = null;
  let introTimeline = null;

  if (!reduceMotion) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 0.95 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  initAnchors(lenis);
  initHeader(lenis);

  if (!reduceMotion) {
    // Behind the welcome portal the intro waits, and plays as the portal opens.
    introTimeline = intro();
    if (deferIntro) introTimeline.pause();
    floatCards();
    immersiveFilm();
    reveals();
    parallax();
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
  return { lenis, playIntro: () => introTimeline?.play() };
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
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.1 });
  const card = document.querySelector('[data-intro-photo]');
  if (card) {
    // The glass card swings up into place, then the photo wipes in on the glass.
    tl.from(card, { y: 110, rotationX: 26, transformPerspective: 1400, duration: 2.2, clearProps: 'transform' }, 0)
      .from(card.querySelector('.float-card__glass'), { autoAlpha: 0, duration: 1.4, ease: 'power2.out' }, 0.05)
      .from(card.querySelector('.frame'), { clipPath: 'inset(100% 0% 0% 0%)', duration: 1.7, ease: 'expo.inOut' }, 0.15)
      .from(card.querySelector('img'), { scale: 1.3, duration: 2.4 }, 0.3)
      .from(card.querySelector('figcaption'), { autoAlpha: 0, x: -36, duration: 1.3 }, 1.15);
  }
  const name = document.querySelector('[data-intro-name]');
  if (name) {
    const split = SplitText.create(name, { type: 'chars', charsClass: 'char' });
    tl.from(split.chars, { yPercent: 105, duration: 1.5, stagger: 0.09 }, 0.35);
    // Once the letters are up, "Mai" catches the same gold gleam as the logo.
    tl.add(() => {
      split.revert();
      name.classList.add('is-gleaming');
    }, '>');
  }
  tl.from('[data-intro]', { y: 26, autoAlpha: 0, duration: 1.3, stagger: 0.08 }, name ? 0.55 : 0.2);
  // Visit: the map panel rises in like the AusMC venue map.
  const panel = document.querySelector('[data-map-panel]');
  if (panel) tl.from(panel, { y: 80, scale: 0.94, autoAlpha: 0, duration: 1.6, clearProps: 'transform' }, 0.25);
  return tl;
}

// Phones: scrolling onto the award film, it grows from its card to fill the whole
// screen, holds while the ceremony plays, then lets go. (Browsers only allow true
// fullscreen from a tap; the film's own button does that.)
function immersiveFilm() {
  const figure = document.querySelector('[data-film]');
  const frame = figure?.querySelector('.video-frame');
  if (!frame) return;
  matchMedia('(max-width: 759px)').addEventListener('change', () => ScrollTrigger.refresh());
  const mm = gsap.matchMedia();
  mm.add('(max-width: 759px)', () => {
    let immersed = false;
    const announce = (on) => {
      if (on === immersed) return;
      immersed = on;
      figure.classList.toggle('is-immersed', on);
      document.dispatchEvent(new CustomEvent('mai:film', { detail: { immersive: on } }));
    };
    const tl = gsap.timeline({
      defaults: { ease: 'power2.inOut' },
      scrollTrigger: {
        trigger: figure,
        start: 'top top',
        end: '+=140%',
        pin: true,
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: (self) => announce(self.progress > 0.32 && self.progress < 0.97),
        onLeave: () => announce(false),
        onLeaveBack: () => announce(false),
      },
    });
    tl.to(frame, { width: () => innerWidth, height: () => innerHeight, borderRadius: 0, boxShadow: 'none', duration: 1 })
      .to(figure.querySelector('.film__backdrop'), { autoAlpha: 1, duration: 1 }, 0)
      .to(figure.querySelector('figcaption'), { autoAlpha: 0, y: -20, duration: 0.4 }, 0)
      .to({}, { duration: 1.6 })
      .to(frame, { scale: 0.92, borderRadius: 30, duration: 0.6 });
    return () => announce(false);
  });
}

// Glass photo cards hang in 3D: a slow float, and on desktop a tilt toward the pointer
// with a sheen and shadow that follow it (CSS reads --px/--py).
function floatCards() {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const REST_X = 4;
  const REST_Y = -9;
  gsap.utils.toArray('[data-tilt]').forEach((card) => {
    gsap.set(card, { rotationX: REST_X, rotationY: REST_Y, '--px': 0, '--py': 0 });
    gsap.to(card, { y: -12, duration: 3.6, ease: 'sine.inOut', yoyo: true, repeat: -1 });
    // Scrolling on, the card drifts back into space.
    const section = card.closest('section');
    if (section) {
      gsap.to(card, { z: -360, ease: 'none', scrollTrigger: { trigger: section, start: 'top top', end: 'bottom top', scrub: 0.6 } });
    }
    if (!fine) {
      gsap.to(card, { rotationY: REST_Y + 8, duration: 6.5, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      return;
    }
    const to = (prop) => gsap.quickTo(card, prop, { duration: 1.1, ease: 'power3' });
    const [rx, ry, px, py] = ['rotationX', 'rotationY', '--px', '--py'].map(to);
    const area = card.closest('section') ?? card;
    area.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const nx = gsap.utils.clamp(-1, 1, (e.clientX - (r.left + r.width / 2)) / r.width);
      const ny = gsap.utils.clamp(-1, 1, (e.clientY - (r.top + r.height / 2)) / r.height);
      rx(REST_X - ny * 9);
      ry(REST_Y + nx * 13);
      px(nx);
      py(ny);
    });
    area.addEventListener('pointerleave', () => {
      rx(REST_X);
      ry(REST_Y);
      px(0);
      py(0);
    });
  });
}

const LINE_REVEAL = '.h2[data-reveal], .band__line[data-reveal]';

function reveals() {
  gsap.set('[data-reveal]', { y: 40, autoAlpha: 0 });
  ScrollTrigger.batch(`[data-reveal]:not(${LINE_REVEAL})`, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { y: 0, autoAlpha: 1, duration: 1.25, ease: 'expo.out', stagger: 0.09, overwrite: true }),
  });

  // Headings rise line by line through masks. Split at the moment they appear (so in
  // whatever language is showing), and put back as plain text once they're up.
  gsap.utils.toArray(LINE_REVEAL).forEach((heading) => {
    ScrollTrigger.create({
      trigger: heading,
      start: 'top 90%',
      once: true,
      onEnter: () => {
        const split = SplitText.create(heading, { type: 'lines', mask: 'lines' });
        gsap.set(heading, { y: 0, autoAlpha: 1 });
        gsap.from(split.lines, { yPercent: 115, rotate: 2, transformOrigin: '0% 100%', duration: 1.35, stagger: 0.12, ease: 'expo.out', onComplete: () => split.revert() });
      },
    });
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
