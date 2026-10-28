import { initButtons } from './buttons.js';
import { initDirections } from './directions.js';
import { initLang, getLang } from './lang.js';
import { initLiquid } from './liquid.js';
import { initNav } from './nav.js';
import { initMotion, ScrollTrigger } from './motion.js';
import { entered, initPortal } from './portal.js';
import { initSash } from './sash.js';
import { initSound } from './sound.js';
import { initVideo } from './video.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const welcoming = document.documentElement.classList.contains('portal-pending');

initLiquid({ reduceMotion });
initLang();
const { lenis, playIntro } = initMotion({ reduceMotion, deferIntro: welcoming });
initNav({ lenis });
initSound();
initPortal({ lenis, reduceMotion, onEnter: playIntro });
initSash({ lenis, reduceMotion });
initVideo({ reduceMotion });
initButtons({ reduceMotion });
initDirections({ lenis, reduceMotion });

const whenIdle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));

// three.js cloth: loaded once the browser is idle after first render.
const hero = document.querySelector('.hero');
const canvas = hero?.querySelector('.hero__cloth');
if (canvas) {
  whenIdle(() =>
    import('./cloth.js')
      .then(({ initCloth }) => {
        const cloth = initCloth(canvas, { reduceMotion, onReady: () => hero.classList.add('has-cloth') });
        if (!cloth) return hero.classList.add('no-webgl');
        if (!reduceMotion) {
          ScrollTrigger.create({
            trigger: hero,
            start: 'top top',
            end: 'bottom top',
            onUpdate: (self) => cloth.setPull(self.progress),
          });
        }
      })
      .catch(() => hero.classList.add('no-webgl')),
  );
}

// MapLibre (Visit page): loaded when the map comes near; it flies in once the portal has gone.
const mapEl = document.querySelector('[data-map]');
if (mapEl) {
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      io.disconnect();
      import('./map.js')
        .then(({ initMap }) => initMap(mapEl, { lang: getLang(), reduceMotion, entered }))
        .catch(() => mapEl.classList.add('is-fallback'));
    },
    { rootMargin: '800px 0px' },
  );
  io.observe(mapEl);
}
