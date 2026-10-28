// Latte and Mugi. As their section comes into view they roll in from either side of the
// screen, like coins across a table, and settle upright with a little wobble; the moment
// they land, golden and blossom-pink paw prints burst out of their portraits with a few
// sparkles, arcing up and tumbling down under gravity, bouncing once on the floor and
// fading. Tapping a portrait (or hovering it) sends another burst, and while the section
// is on screen one of them now and then lets out a few more. The particles are drawn on
// one canvas over the section, only while there are some to draw.
import { gsap, ScrollTrigger } from './motion.js';

const PAW = new Path2D();
[[16, 21, 6.5, 5.5], [7.5, 13.5, 2.6, 3.4], [12.5, 8.5, 2.6, 3.4], [19.5, 8.5, 2.6, 3.4], [24.5, 13.5, 2.6, 3.4]].forEach(([x, y, rx, ry]) => {
  PAW.moveTo(x - 16 + rx, y - 16);
  PAW.ellipse(x - 16, y - 16, rx, ry, 0, 0, Math.PI * 2);
});
const STAR = new Path2D('M0 -1 Q0.12 -0.12 1 0 Q0.12 0.12 0 1 Q-0.12 0.12 -1 0 Q-0.12 -0.12 0 -1Z');
const PAW_COLOURS = ['#e9a21b', '#d98b12', '#f0b93a', '#ee9fa0', '#f2b0ac'];
const GRAVITY = 1150;

export function initDogs({ reduceMotion }) {
  const section = document.querySelector('.dogs');
  const dogs = section ? [...section.querySelectorAll('.dog')] : [];
  if (dogs.length !== 2 || reduceMotion) return;

  const canvas = document.createElement('canvas');
  canvas.className = 'dogs__sparks';
  canvas.setAttribute('aria-hidden', 'true');
  section.append(canvas);
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  const size = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(section.clientWidth * dpr);
    canvas.height = Math.round(section.clientHeight * dpr);
  };
  new ResizeObserver(size).observe(section);
  size();

  // Particles, in px within the section.
  const bits = [];
  let raf = 0;
  let last = 0;
  const burst = (dog, count = 16) => {
    const medal = dog.querySelector('.dog__medal');
    const s = section.getBoundingClientRect();
    const m = medal.getBoundingClientRect();
    const cx = m.left + m.width / 2 - s.left;
    const cy = m.top + m.height / 2 - s.top;
    const r = m.width / 2;
    for (let i = 0; i < count; i++) {
      const sparkle = i % 3 === 2;
      // Mostly up and out to the sides, as if shaken off the portrait.
      const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.7;
      const speed = (sparkle ? 260 : 420) + Math.random() * (sparkle ? 260 : 380);
      bits.push({
        sparkle,
        x: cx + Math.cos(a) * r * 0.82,
        y: cy + Math.sin(a) * r * 0.82,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed,
        rot: a + Math.PI / 2 + (Math.random() - 0.5) * 0.6,
        spin: (Math.random() - 0.5) * (sparkle ? 4 : 9),
        size: sparkle ? 5 + Math.random() * 6 : 18 + Math.random() * 16,
        colour: PAW_COLOURS[(Math.random() * PAW_COLOURS.length) | 0],
        age: -Math.random() * 0.12,
        life: sparkle ? 0.9 + Math.random() * 0.6 : 1.7 + Math.random() * 0.8,
        bounced: false,
      });
    }
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  };

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const floor = section.clientHeight - 24;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.age += dt;
      if (b.age >= b.life) {
        bits.splice(i, 1);
        continue;
      }
      if (b.age < 0) continue;
      // Gravity (sparkles drift, paws fall), air drag, spin, one soft bounce on the floor.
      b.vy += GRAVITY * (b.sparkle ? 0.28 : 1) * dt;
      const drag = Math.exp(-(b.sparkle ? 1.6 : 0.7) * dt);
      b.vx *= drag;
      b.vy *= drag;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.rot += b.spin * dt;
      if (!b.bounced && b.y > floor && b.vy > 0) {
        b.bounced = true;
        b.y = floor;
        b.vy *= -0.42;
        b.vx *= 0.75;
        b.spin *= 0.6;
      }
      const t = b.age / b.life;
      // Pop in with a little overshoot, fade out over the last part of the flight.
      const pop = Math.min(1, b.age / 0.14);
      const scale = (pop < 1 ? 1.25 * Math.sin((pop * Math.PI) / 2) : 1) * (b.sparkle ? 0.7 + 0.3 * Math.sin(b.age * 22) : 1);
      const alpha = Math.min(1, (1 - t) / 0.4);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.rot);
      ctx.scale(scale * b.size / (b.sparkle ? 1 : 32), scale * b.size / (b.sparkle ? 1 : 32));
      ctx.globalAlpha = alpha;
      ctx.shadowBlur = b.sparkle ? 12 : 10;
      ctx.shadowColor = b.sparkle ? 'rgba(255, 236, 190, 0.95)' : 'rgba(246, 213, 138, 0.75)';
      ctx.fillStyle = b.sparkle ? '#fff6dc' : b.colour;
      ctx.fill(b.sparkle ? STAR : PAW);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    raf = bits.length ? requestAnimationFrame(frame) : 0;
    if (!raf) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // They roll in from either side: the portrait turns as far as it travels, then settles
  // upright with a wobble, and the paws burst out as it lands.
  const tl = gsap.timeline({ paused: true });
  dogs.forEach((dog, i) => {
    const medal = dog.querySelector('.dog__medal');
    const side = i === 0 ? -1 : 1;
    const distance = () => {
      const r = dog.getBoundingClientRect();
      return side < 0 ? r.right + 40 : innerWidth - r.left + 40;
    };
    const turn = () => (side * distance() / (medal.offsetWidth / 2)) * (180 / Math.PI);
    const at = i * 0.22;
    tl.fromTo(dog, { x: () => side * distance() }, { x: 0, duration: 1.25, ease: 'power3.out', immediateRender: true }, at)
      .fromTo(medal, { rotation: () => turn() }, { rotation: 0, duration: 1.25, ease: 'power3.out', immediateRender: true }, at)
      .to(medal, { keyframes: { rotation: [-side * 7, side * 4, -side * 1.5, 0], scale: [1.06, 0.98, 1.01, 1] }, duration: 0.9, ease: 'sine.inOut' }, at + 1.05)
      .call(() => burst(dog, 22), null, at + 0.95);
  });
  gsap.set(dogs, { x: (i) => (i === 0 ? -1 : 1) * innerWidth });
  ScrollTrigger.create({
    trigger: section.querySelector('.dogs__pair'),
    start: 'top 82%',
    onEnter: () => tl.invalidate().restart(),
    onLeaveBack: () => tl.pause(0),
  });

  // More on a tap or a hover, and now and then on their own while the section is seen.
  dogs.forEach((dog) => {
    let ready = 0;
    const again = (count) => {
      const now = performance.now();
      if (now < ready || tl.isActive()) return;
      ready = now + 650;
      burst(dog, count);
      gsap.fromTo(dog.querySelector('.dog__medal'), { scale: 0.94 }, { scale: 1, duration: 0.8, ease: 'elastic.out(1.2, 0.4)' });
    };
    dog.querySelector('.dog__medal').addEventListener('pointerdown', () => again(16));
    dog.addEventListener('pointerenter', (e) => e.pointerType === 'mouse' && again(10));
  });
  let idle = null;
  new IntersectionObserver(([e]) => {
    clearInterval(idle);
    if (e.isIntersecting) idle = setInterval(() => !tl.isActive() && !document.hidden && burst(dogs[(Math.random() * 2) | 0], 6), 4200);
  }).observe(section);
}
