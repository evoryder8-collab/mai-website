// "Get directions": a glass chooser offering Google Maps or Apple Maps, the same pattern
// as the AusMC and Lume Wellness sites. Any [data-directions] element opens it (links keep
// their href as a no-JS fallback), and so does the map pin (the "mai:directions" event).
import { APPLE as APPLE_LOGO, GOOGLE_MAPS as GOOGLE_MAPS_LOGO } from './brand-maps.js';
import { translate } from './lang.js';
import { gsap } from './motion.js';

const ADDRESS = '茨城県つくば市柴崎68-17';
const GOOGLE = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`Memories Spa ${ADDRESS}`)}`;
const APPLE = `https://maps.apple.com/?daddr=${encodeURIComponent(ADDRESS)}&q=${encodeURIComponent('Memories Spa')}`;

const ARROW = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8"/></svg>';

function build() {
  const dialog = document.createElement('dialog');
  dialog.className = 'choice';
  dialog.setAttribute('aria-labelledby', 'choice-title');
  dialog.innerHTML = `
    <div class="choice__panel">
      <button class="choice__close" type="button" data-close><span class="visually-hidden" data-t="close"></span><span class="choice__x" aria-hidden="true"></span></button>
      <p class="choice__eyebrow">Memories Spa <i></i> <span data-t="tsukuba"></span></p>
      <h2 class="choice__title" id="choice-title" data-t="which-maps-app"></h2>
      <p class="choice__addr" data-t="68-17-shibasaki-tsukuba-ibaraki"></p>
      <div class="choice__options">
        <a class="choice__option" href="${GOOGLE}" target="_blank" rel="noopener" data-option>
          <span class="choice__brand choice__brand--google" aria-hidden="true">${GOOGLE_MAPS_LOGO}</span>
          <strong>Google Maps</strong>${ARROW}
        </a>
        <a class="choice__option" href="${APPLE}" target="_blank" rel="noopener" data-option>
          <span class="choice__brand choice__brand--apple" aria-hidden="true">${APPLE_LOGO}</span>
          <strong data-t="apple-maps"></strong>${ARROW}
        </a>
      </div>
      <button class="choice__cancel" type="button" data-close data-t="cancel"></button>
    </div>`;
  translate(dialog);
  document.addEventListener('langchange', () => translate(dialog));
  document.body.append(dialog);
  return dialog;
}

export function initDirections({ lenis, reduceMotion }) {
  let dialog = null;
  let opener = null;

  const close = () => {
    if (!dialog?.open) return;
    if (reduceMotion) return dialog.close();
    gsap.to(dialog.querySelector('.choice__panel'), { y: 24, scale: 0.96, autoAlpha: 0, duration: 0.22, ease: 'power2.in', onComplete: () => dialog.close() });
  };

  const open = (trigger) => {
    if (!dialog) {
      dialog = build();
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog || e.target.closest('[data-close]')) close();
        else if (e.target.closest('[data-option]')) setTimeout(close, 250);
      });
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        close();
      });
      dialog.addEventListener('close', () => {
        lenis?.start();
        opener?.focus?.({ preventScroll: true });
      });
    }
    opener = trigger;
    lenis?.stop();
    dialog.showModal();
    document.dispatchEvent(new CustomEvent('mai:chooser'));
    if (reduceMotion) return;
    const panel = dialog.querySelector('.choice__panel');
    gsap.fromTo(panel, { y: 48, scale: 0.9, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.8, ease: 'back.out(1.5)' });
    gsap.fromTo(panel.querySelectorAll('.choice__option, .choice__cancel'), { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.6, stagger: 0.07, delay: 0.12, ease: 'back.out(1.6)' });
  };

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-directions]');
    if (!trigger) return;
    e.preventDefault();
    open(trigger);
  });
  document.addEventListener('mai:directions', () => open(null));
}
