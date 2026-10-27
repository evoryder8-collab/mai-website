// Buttons with some life: a ripple from wherever they're pressed (phones too), and on
// desktop a magnetic pull toward the pointer that springs back when it leaves.
// The press-in and the light sweep across saffron buttons are CSS (main.css).
import { gsap } from './motion.js';

export function initButtons({ reduceMotion }) {
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  document.addEventListener('pointerdown', (e) => {
    const btn = e.target.closest('.btn, .map-replay, .choice__option');
    if (!btn || reduceMotion) return;
    const r = btn.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.4;
    const ripple = document.createElement('span');
    ripple.className = 'ripple';
    ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`;
    btn.append(ripple);
    ripple.addEventListener('animationend', () => ripple.remove());
  });

  if (!fine || reduceMotion) return;
  document.querySelectorAll('.btn').forEach((btn) => {
    const x = gsap.quickTo(btn, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.45)' });
    const y = gsap.quickTo(btn, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.45)' });
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.28);
      y((e.clientY - (r.top + r.height / 2)) * 0.38);
    });
    btn.addEventListener('pointerleave', () => {
      x(0);
      y(0);
    });
  });
}
