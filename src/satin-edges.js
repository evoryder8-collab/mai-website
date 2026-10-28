// Satin along the edges of Mai's photos. Each photo keeps its own shape; along its edges
// lies a ribbon of the same cream-and-gold satin as the background, like a rolled satin
// hem the photo is tucked into. Gathers run around it, its outer edge ripples, its folds
// catch the light, it unfurls with the photo's reveal, and scrolling moves it like cloth
// on a spring: it trails behind the motion, overshoots and settles. A finger or cursor
// nearby lifts it a little. One small canvas beside each photo, drawing only the strips
// along its edges, and only while it is on screen.

const PHOTOS = [
  // selector, edges with satin [left, right, bottom, top]
  ['.float-card__frame', [1, 1, 1, 1]],
  ['.about__photo .frame, .treatment__photo .frame', [1, 1, 1, 1]],
  ['.band__media', [0, 0, 1, 1]],
  ['.teaser__visual', [0, 0, 1, 0]],
];

const VERT = `
attribute vec2 a;      // CSS px within the canvas
uniform vec2 uCanvas;  // canvas size, CSS px
uniform vec2 uHalf;    // half the photo's size
uniform float uBleed;  // how far the canvas reaches past the photo
varying vec2 vP;       // CSS px from the photo's centre, y down
void main() {
  vP = a - uBleed - uHalf;
  vec2 c = a / uCanvas * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vP;
uniform vec2 uHalf;
uniform float uRadius;
uniform vec4 uEdges;    // left, right, bottom, top
uniform float uWidth;   // the ribbon's resting width, CSS px
uniform float uPerim;   // length of the outline
uniform vec2 uK;        // gathers, ripples: whole waves around the outline
uniform float uTime;
uniform float uTravel;  // how far the cloth has moved along with the scroll
uniform float uLag;     // spring: how far the cloth trails the scroll (signed)
uniform float uEnergy;  // spring: how stirred the cloth is
uniform vec3 uPointer;  // CSS px from the photo's centre, presence
uniform float uClip;    // px of the photo still hidden by its reveal, from the top

const float PI = 3.14159265;

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

// Where p sits along the photo's outline (arc length, clockwise from the top centre), the
// outward direction there, and how much satin that stretch of edge carries.
void outline(vec2 p, out float s, out vec2 n, out float e) {
  float r = uRadius;
  vec2 h = uHalf - r;
  float a = h.x;
  float b = h.y;
  float qd = 0.5 * PI * r;
  vec2 v = p - clamp(p, -h, h);
  if (v.x == 0.0 && v.y == 0.0) {
    vec2 g = h - abs(p);
    v = g.x < g.y ? vec2(sign(p.x), 0.0) : vec2(0.0, sign(p.y));
  }
  if (v.x == 0.0 && v.y < 0.0) { s = p.x; n = vec2(0.0, -1.0); e = uEdges.w; }
  else if (v.y == 0.0 && v.x > 0.0) { s = a + qd + p.y + b; n = vec2(1.0, 0.0); e = uEdges.y; }
  else if (v.x == 0.0 && v.y > 0.0) { s = 2.0 * a + 2.0 * qd + 2.0 * b - (p.x + a); n = vec2(0.0, 1.0); e = uEdges.z; }
  else if (v.y == 0.0 && v.x < 0.0) { s = 3.0 * a + 3.0 * qd + 3.0 * b - p.y; n = vec2(-1.0, 0.0); e = uEdges.x; }
  else {
    n = normalize(v);
    float f;
    if (v.x > 0.0 && v.y < 0.0) { f = atan(v.x, -v.y); s = a + r * f; e = mix(uEdges.w, uEdges.y, f / (0.5 * PI)); }
    else if (v.x > 0.0) { f = atan(v.y, v.x); s = a + qd + 2.0 * b + r * f; e = mix(uEdges.y, uEdges.z, f / (0.5 * PI)); }
    else if (v.y > 0.0) { f = atan(-v.x, v.y); s = 3.0 * a + 2.0 * qd + 2.0 * b + r * f; e = mix(uEdges.z, uEdges.x, f / (0.5 * PI)); }
    else { f = atan(-v.y, -v.x); s = 3.0 * a + 3.0 * qd + 4.0 * b + r * f; e = mix(uEdges.x, uEdges.w, f / (0.5 * PI)); }
  }
}

void main() {
  vec2 p = vP;
  vec2 q = abs(p) - (uHalf - uRadius);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;

  float s;
  vec2 n;
  float e;
  outline(p, s, n, e);
  if (e < 0.001) discard;

  // Slow, organic variation around the outline that joins up seamlessly where it began.
  float ang = s / uPerim * 2.0 * PI;
  float R = uPerim / (2.0 * PI) / 140.0;
  float t = uTime;
  float n1 = snoise(vec2(cos(ang), sin(ang)) * R + vec2(t * 0.11, uTravel * 0.08));

  // Gathers: folds of uneven spacing that travel around the photo as the page scrolls.
  float ph = s * uK.x + n1 * 1.8 + 0.9 * sin(s * uK.x * 0.37 + t * 0.3) - uTravel * 1.4 + t * 0.2;
  float fold = sin(ph);

  // The ribbon's width: breathing, ruffling where the folds open, trailing the scroll on a
  // spring, lifting toward the finger.
  float w = uWidth * (0.74 + 0.26 * n1 + 0.2 * sin(s * uK.y - uTravel * 1.1 + t * 0.7) * (0.5 + uEnergy));
  w *= 1.0 + 0.16 * fold * (0.7 + 0.5 * uEnergy);
  w += uWidth * uLag * n.y * 0.95;
  vec2 dp = p - uPointer.xy;
  w += uWidth * 0.7 * uPointer.z * exp(-dot(dp, dp) / 3600.0);
  w = max(w, uWidth * 0.3) * e;

  // Its inner edge follows the photo's own outline exactly, overlapping it by a hair.
  float d0 = -1.0;
  float cover = smoothstep(d0 - 0.6, d0 + 0.6, d) * (1.0 - smoothstep(w - 0.8, w + 0.6, d));
  float x = clamp((d - d0) / max(w - d0, 1.0), 0.0, 1.0);

  // The surface: a gentle roll across the ribbon, and the folds fanning open toward its
  // outer edge, so the light runs across it in long satin streaks.
  vec2 tng = vec2(-n.y, n.x);
  float fan = 0.3 + 0.7 * x;
  vec3 N = normalize(vec3(-n * cos(PI * x) * 0.4 + tng * cos(ph) * (0.55 + 0.45 * uEnergy) * fan, 1.0));
  vec3 L = normalize(vec3(-0.45, -0.7, 0.75));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float diff = clamp(dot(N, L), 0.0, 1.0);
  float nh = max(dot(N, H), 0.0);

  // The background's broad satin light drifting across it.
  vec2 c = (p + vec2(0.0, uTravel * 40.0)) / 360.0;
  float flow = 0.5 + 0.5 * sin((c.x * 1.2 + c.y * 0.8 + snoise(c * 0.9 + t * 0.04) * 1.5) * 2.4 + t * 0.35);
  // And the background's layered sheen, along each fold.
  float shine = 0.5 + 0.5 * sin(ph + 1.1 + flow * 1.4);

  vec3 shade = vec3(0.56, 0.43, 0.3);
  vec3 sand = vec3(0.87, 0.77, 0.62);
  vec3 linen = vec3(0.95, 0.9, 0.82);
  vec3 cream = vec3(1.0, 0.985, 0.955);
  vec3 gold = vec3(0.97, 0.72, 0.32);
  vec3 col = mix(sand, linen, smoothstep(0.2, 0.95, diff));
  col = mix(col, shade, pow(1.0 - diff, 1.8) * 0.62);
  col = mix(col, cream, pow(shine, 6.0) * (0.35 + 0.35 * flow) * fan);
  col = mix(col, cream, pow(nh, 10.0) * 0.45);
  col += gold * pow(shine, 24.0) * 0.16 * (0.5 + flow);
  col += vec3(1.0) * pow(shine, 70.0) * 0.1 * fan;

  // Shade: a soft line where the photo tucks under the satin, and a little on the page below.
  float under = smoothstep(-9.0, d0, d) * (1.0 - step(d0, d)) * 0.26;
  float drop = (1.0 - smoothstep(w, w + 14.0, d - 2.0)) * step(w, d) * 0.2;
  float shadow = (under + drop) * e;
  vec3 dark = vec3(0.16, 0.1, 0.06);

  // It unfurls with the photo's reveal, and once that is done lies along the top too.
  float shown = smoothstep(uClip - 2.0, uClip + 26.0, p.y + uHalf.y + 90.0 * (1.0 - smoothstep(0.0, 60.0, uClip)));
  cover *= shown;
  shadow *= shown;

  float alpha = cover + shadow * (1.0 - cover);
  vec3 rgb = col * cover + dark * shadow * (1.0 - cover);
  gl_FragColor = vec4(rgb, alpha);
}`;

// The scroll, shared by every photo: a damped spring the cloth follows, so it trails the
// motion, overshoots a little and settles.
const spring = { x: 0, v: 0, travel: 0, energy: 0, scroll: scrollY };
function step(dt) {
  const y = scrollY;
  const speed = (y - spring.scroll) / dt;
  spring.scroll = y;
  const target = Math.max(-1.2, Math.min(1.2, speed / 1800));
  spring.v += ((target - spring.x) * 70 - spring.v * 7.5) * dt;
  spring.x += spring.v * dt;
  spring.travel += speed * dt * 0.0025;
  const stir = Math.min(1.5, Math.abs(spring.x) + Math.abs(spring.v) * 0.06);
  spring.energy += (stir - spring.energy) * (1 - Math.exp(-dt * 6));
}

const live = new Set();
let raf = 0;
let last = 0;
let clock = 0;
let coarse = false;
function loop(now) {
  raf = 0;
  if (!live.size || document.hidden) return;
  raf = requestAnimationFrame(loop);
  if (coarse && now - last < 32) return;
  const dt = Math.min((now - last) / 1000 || 0.016, 0.1);
  last = now;
  clock += dt;
  step(dt);
  live.forEach((draw) => draw(now));
}
const wake = () => {
  if (!raf && live.size && !document.hidden) {
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
};

export function initSatinEdges({ reduceMotion }) {
  coarse = matchMedia('(pointer: coarse)').matches;
  document.addEventListener('visibilitychange', wake);
  for (const [selector, edges] of PHOTOS) {
    document.querySelectorAll(selector).forEach((el) => {
      // Built when it's about to be seen, so off-screen photos cost nothing.
      new IntersectionObserver(([e], io) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        mount(el, edges, { reduceMotion });
      }, { rootMargin: '300px 0px' }).observe(el);
    });
  }
}

function mount(el, edges, { reduceMotion }) {
  const parent = el.parentElement;
  if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

  const canvas = document.createElement('canvas');
  canvas.className = 'satin-edge';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
  if (!gl) return;
  const shader = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  };
  const vs = shader(gl.VERTEX_SHADER, VERT);
  const fs = shader(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(
    ['uCanvas', 'uHalf', 'uBleed', 'uRadius', 'uEdges', 'uWidth', 'uPerim', 'uK', 'uTime', 'uTravel', 'uLag', 'uEnergy', 'uPointer', 'uClip'].map((k) => [k, gl.getUniformLocation(prog, k)]),
  );
  gl.uniform4f(U.uEdges, ...edges);
  gl.clearColor(0, 0, 0, 0);

  // Same place in 3D as the photo (the hero's photo floats in front of its glass).
  const { translate } = getComputedStyle(el);
  if (translate && translate !== 'none') canvas.style.translate = translate;
  el.after(canvas);

  let W = 0;
  let H = 0;
  let width = 0;
  let verts = 0;
  const layout = () => {
    W = el.offsetWidth;
    H = el.offsetHeight;
    if (!W || !H) return;
    const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, W / 2, H / 2);
    width = Math.max(10, Math.min(22, Math.min(W, H) * 0.05));
    const bleed = Math.ceil(width * 3.2 + 14);
    const inner = Math.min(Math.ceil(10 + 0.3 * r), Math.floor(Math.min(W, H) / 2));
    const cw = W + 2 * bleed;
    const ch = H + 2 * bleed;
    Object.assign(canvas.style, {
      left: `${el.offsetLeft - bleed}px`,
      top: `${el.offsetTop - bleed}px`,
      width: `${cw}px`,
      height: `${ch}px`,
    });
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);

    // Only the strips along the edges that carry satin are drawn.
    const [l, rt, b, t] = edges;
    const T = bleed + inner;
    const rects = [];
    if (t) rects.push([0, 0, cw, T]);
    if (b) rects.push([0, ch - T, cw, ch]);
    const y0 = t ? T : 0;
    const y1 = b ? ch - T : ch;
    if (l) rects.push([0, y0, T, y1]);
    if (rt) rects.push([cw - T, y0, cw, y1]);
    const data = new Float32Array(rects.flatMap(([x0, ya, x1, yb]) => [x0, ya, x1, ya, x0, yb, x0, yb, x1, ya, x1, yb]));
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    verts = data.length / 2;

    const perim = 4 * (W / 2 - r) + 4 * (H / 2 - r) + 2 * Math.PI * r;
    const waves = (spacing) => (2 * Math.PI * Math.max(1, Math.round(perim / spacing))) / perim;
    gl.uniform2f(U.uCanvas, cw, ch);
    gl.uniform2f(U.uHalf, W / 2, H / 2);
    gl.uniform1f(U.uBleed, bleed);
    gl.uniform1f(U.uRadius, r);
    gl.uniform1f(U.uPerim, perim);
    gl.uniform2f(U.uK, waves(64), waves(150));
    draw(performance.now());
  };

  // The finger or cursor, in px from the photo's centre.
  const pointer = { x: 0, y: 0, on: 0, ton: 0 };
  const area = el.closest('section') ?? el;
  area.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    pointer.x = e.clientX - (r.left + r.width / 2);
    pointer.y = e.clientY - (r.top + r.height / 2);
    pointer.ton = 1;
  }, { passive: true });
  area.addEventListener('pointerleave', () => (pointer.ton = 0));

  // Follows the photo's own reveal (a wipe from the bottom, set inline by motion.js).
  const clipTop = () => {
    const m = /inset\(([\d.]+)%/.exec(el.style.clipPath);
    return m ? (parseFloat(m[1]) / 100) * H : 0;
  };

  const born = performance.now();
  function draw(now) {
    if (!verts) return;
    const grow = reduceMotion ? 1 : 1 - Math.pow(1 - Math.min(1, (now - born) / 1600), 3);
    pointer.on += (pointer.ton - pointer.on) * 0.08;
    gl.uniform1f(U.uWidth, width * grow);
    gl.uniform1f(U.uTime, reduceMotion ? 6 : clock);
    gl.uniform1f(U.uTravel, reduceMotion ? 0 : spring.travel);
    gl.uniform1f(U.uLag, reduceMotion ? 0 : spring.x);
    gl.uniform1f(U.uEnergy, reduceMotion ? 0 : spring.energy);
    gl.uniform3f(U.uPointer, pointer.x, pointer.y, reduceMotion ? 0 : pointer.on);
    gl.uniform1f(U.uClip, clipTop());
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, verts);
  }

  const ro = new ResizeObserver(layout);
  ro.observe(el);
  ro.observe(parent);
  layout();
  if (reduceMotion) {
    // Drawn once, then again only if the reveal is still under way.
    const settle = () => {
      draw(performance.now());
      if (clipTop() > 0) requestAnimationFrame(settle);
    };
    return settle();
  }

  // Drawn only while on screen.
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) live.add(draw);
    else live.delete(draw);
    wake();
  }, { rootMargin: '60px 0px' }).observe(el);
}
