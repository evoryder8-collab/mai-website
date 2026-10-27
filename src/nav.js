// Full-screen menu on small screens.
export function initNav({ lenis } = {}) {
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('site-nav');
  const header = document.querySelector('[data-header]');
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
    header.classList.toggle('menu-open', open);
    if (open) header.classList.remove('is-hidden');
    document.body.style.overflow = open ? 'hidden' : '';
    if (lenis) open ? lenis.stop() : lenis.start();
  };

  toggle.addEventListener('click', () => setOpen(toggle.getAttribute('aria-expanded') !== 'true'));
  // Capture phase: close (and restart scrolling) before the link's own scroll handler runs.
  nav.addEventListener(
    'click',
    (e) => {
      if (e.target.closest('a')) setOpen(false);
    },
    true,
  );
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
  matchMedia('(min-width: 900px)').addEventListener('change', (e) => {
    if (e.matches) setOpen(false);
  });
}
