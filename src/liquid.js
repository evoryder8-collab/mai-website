// The living background: warm linen with slowly drifting light, a faint woven texture,
// and drops of liquid glass floating through it. The drops bend what's behind them
// (with a touch of chromatic edge), catch the light along their rims and merge when
// they meet. One drop follows the finger or cursor, scrolling stretches the drops and
// lifts them, every tap sends a ripple through the page, and with sound on the glass
// breathes with the ambience. Plain WebGL, one full-screen shader, rendered below
// screen resolution (it's soft by design) and paused when the tab is hidden.
import { sound } from './sound.js';

const VERT = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }`;

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uScroll;   // screen heights scrolled
uniform float uVel;      // scroll speed, screen heights per second
uniform vec3 uPointer;   // position (same space as p), presence 0..1
uniform float uLevel;    // ambient sound level 0..1
uniform vec4 uRipple[3]; // position, start time, strength

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 4; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}
float smin(float a, float b, float k) { float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0); return mix(b, a, h) - k * h * (1.0 - h); }
float wrapY(float y) { return mod(y + 1.25, 2.5) - 1.25; }
// A drop of liquid: a circle whose outline slowly wobbles, stretched by scroll speed.
float drop(vec2 p, vec2 c, float r, float stretch, float seed) {
  vec2 q = p - c;
  q.y /= stretch;
  float a = atan(q.y, q.x);
  float wob = 0.05 * sin(a * 3.0 + uTime * 0.6 + seed) + 0.03 * sin(a * 5.0 - uTime * 0.45 + seed * 2.0);
  return length(q) - r * (1.0 + wob);
}

// Five drifting drops, each rising with the scroll at its own pace, plus the pointer's.
float scene(vec2 p) {
  float t = uTime, s = uScroll;
  float aspect = uRes.x / uRes.y;
  float w = max(aspect * 0.5, 0.25);
  float u = mix(0.55, 1.0, clamp(aspect, 0.0, 1.0)) * 0.75;
  float st = 1.0 + min(abs(uVel) * 0.5, 0.7);
  float d = 10.0;
  d = smin(d, drop(p, vec2(w * (-0.62 + 0.10 * sin(t * 0.11)), wrapY(0.25 + 0.06 * cos(t * 0.13) + s * 0.32)), 0.19 * u, st, 0.0), 0.10);
  d = smin(d, drop(p, vec2(w * (0.55 + 0.12 * cos(t * 0.09 + 1.0)), wrapY(-0.18 + 0.07 * sin(t * 0.12 + 2.0) + s * 0.46)), 0.15 * u, st, 1.7), 0.10);
  d = smin(d, drop(p, vec2(w * (0.12 + 0.30 * sin(t * 0.07 + 4.0)), wrapY(0.85 + 0.05 * sin(t * 0.10) + s * 0.58)), 0.11 * u, st, 3.1), 0.10);
  d = smin(d, drop(p, vec2(w * (-0.25 + 0.25 * cos(t * 0.08 + 3.0)), wrapY(-0.80 + 0.06 * cos(t * 0.15) + s * 0.40)), 0.13 * u, st, 4.4), 0.10);
  d = smin(d, drop(p, vec2(w * (0.80 + 0.08 * sin(t * 0.14 + 5.0)), wrapY(0.55 + 0.08 * cos(t * 0.09 + 1.5) + s * 0.27)), 0.08 * u, st, 5.9), 0.08);
  d = smin(d, length(p - uPointer.xy) - 0.075 * u * uPointer.z, 0.14);
  return d;
}

// Linen with pools of warm light, a fine weave and faint silk lines (the lines are
// what the glass visibly bends).
vec3 linen(vec2 q, float n) {
  vec3 c = mix(vec3(0.953, 0.925, 0.878), vec3(0.922, 0.882, 0.818), smoothstep(0.35, 0.85, n) * 0.75);
  c = mix(c, vec3(0.975, 0.85, 0.58), smoothstep(0.55, 0.95, n) * 0.24);
  vec2 g = q * 430.0;
  c -= (sin(g.x) * 0.5 + 0.5) * (sin(g.y) * 0.5 + 0.5) * 0.010;
  c -= smoothstep(0.86, 1.0, sin((q.x * 0.8 + q.y) * 52.0 + n * 7.0) * 0.5 + 0.5) * 0.014;
  return c;
}

void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  float t = uTime;
  vec2 q = p - vec2(0.0, uScroll * 0.12);

  // Tap ripples: rings that travel outward and fade.
  vec2 rip = vec2(0.0);
  for (int i = 0; i < 3; i++) {
    vec4 r = uRipple[i];
    float age = t - r.z;
    if (age > 0.0 && age < 2.6) {
      vec2 dv = p - r.xy;
      float dist = length(dv), front = age * 0.42;
      float w = exp(-abs(dist - front) * 16.0) * exp(-age * 1.5) * r.w;
      rip += dv / (dist + 1e-4) * sin((dist - front) * 70.0) * w * 0.012;
    }
  }

  float tt = t * 0.035;
  vec2 wq = q * 1.1;
  float n = fbm(wq + vec2(fbm(wq * 0.7 + tt), fbm(wq * 0.7 - tt + 4.2)) * 1.1 + tt);

  vec2 sp = p + rip * 0.6;
  float d = scene(sp);
  float e = 0.0025;
  vec2 nrm = normalize(vec2(scene(sp + vec2(e, 0.0)) - d, scene(sp + vec2(0.0, e)) - d) + 1e-6);
  float inside = smoothstep(0.003, -0.003, d);
  float depth = clamp(-d / 0.07, 0.0, 1.0);

  // Refraction: like real glass the drop is clear, and shows itself by how it bends the
  // linen behind it; the thin rim bends most, with the colours parting slightly.
  vec2 off = -nrm * pow(1.0 - depth, 1.5) * 0.085 * inside + rip;
  vec3 col = vec3(linen(q + off, n).r, linen(q + off * 1.12, n).g, linen(q + off * 1.24, n).b);

  vec2 L = normalize(vec2(-0.55, 0.85));
  float lit = dot(nrm, L);
  float spec = pow(max(lit, 0.0), 14.0) * (1.0 - depth) * inside;
  float shade = pow(max(-lit, 0.0), 3.0) * pow(1.0 - depth, 2.0) * inside;
  float rim = smoothstep(0.0035, 0.0, abs(d));
  float glow = 1.0 + uLevel * 3.0;
  col += vec3(1.0, 0.99, 0.96) * (spec * 0.14 + rim * 0.045 + pow(1.0 - depth, 6.0) * inside * 0.02) * glow;
  col += vec3(0.95, 0.62, 0.12) * spec * 0.04 * glow;
  col -= vec3(0.10, 0.08, 0.05) * shade * 0.22;
  // A faint caustic: light gathered and thrown just past the shadowed edge.
  float caustic = smoothstep(0.035, 0.0, abs(scene(sp + vec2(0.018, -0.026)) + 0.004)) * (1.0 - inside);
  col += vec3(1.0, 0.86, 0.55) * caustic * 0.035 * glow;
  // A soft shadow where each drop sits on the linen.
  col -= smoothstep(0.05, 0.0, scene(sp - vec2(0.01, -0.016))) * (1.0 - inside) * 0.018;

  gl_FragColor = vec4(col, 1.0);
}`;

export function initLiquid({ reduceMotion }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'liquid-bg';
  canvas.setAttribute('aria-hidden', 'true');
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'low-power' });
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
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = Object.fromEntries(['uRes', 'uTime', 'uScroll', 'uVel', 'uPointer', 'uLevel', 'uRipple'].map((n) => [n, gl.getUniformLocation(prog, n)]));

  document.body.prepend(canvas);
  document.documentElement.classList.add('has-liquid');

  // Soft by design: render below screen resolution, less on phones.
  const coarse = matchMedia('(pointer: coarse)').matches;
  const scale = coarse ? 0.5 : 0.6;
  const resize = () => {
    canvas.width = Math.max(1, Math.round(innerWidth * scale));
    canvas.height = Math.max(1, Math.round(innerHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(U.uRes, canvas.width, canvas.height);
    if (reduceMotion) draw(20);
  };

  // Pointer and touches, in the shader's space (centred, y up, screen height = 1).
  const toP = (x, y) => [(x - innerWidth / 2) / innerHeight, (innerHeight / 2 - y) / innerHeight];
  const pointer = { x: 0, y: -2, tx: 0, ty: -2, on: 0, ton: 0 };
  const ripples = [0, 0, -99, 0, 0, 0, -99, 0, 0, 0, -99, 0];
  let next = 0;
  let clock = 0;
  addEventListener('pointermove', (e) => {
    [pointer.tx, pointer.ty] = toP(e.clientX, e.clientY);
    pointer.ton = 1;
  }, { passive: true });
  addEventListener('pointerdown', (e) => {
    const [x, y] = toP(e.clientX, e.clientY);
    ripples.splice(next * 4, 4, x, y, clock, e.pointerType === 'touch' ? 1 : 0.7);
    next = (next + 1) % 3;
    [pointer.tx, pointer.ty] = [x, y];
    if (pointer.on < 0.05) [pointer.x, pointer.y] = [x, y];
    pointer.ton = 1;
  }, { passive: true });
  document.documentElement.addEventListener('pointerleave', () => (pointer.ton = 0));
  addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') pointer.ton = 0;
  }, { passive: true });

  let scroll = scrollY;
  let vel = 0;
  let level = 0;

  function draw(time) {
    gl.uniform1f(U.uTime, time);
    gl.uniform1f(U.uScroll, scroll / innerHeight);
    gl.uniform1f(U.uVel, vel);
    gl.uniform3f(U.uPointer, pointer.x, pointer.y, pointer.on);
    gl.uniform1f(U.uLevel, level);
    gl.uniform4fv(U.uRipple, ripples);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  addEventListener('resize', resize);
  resize();
  if (reduceMotion) return;

  // Phones draw every other frame: the motion is slow, and it saves battery.
  let last = performance.now();
  let frame = 0;
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (document.hidden) return (last = now);
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    clock += dt;
    if (coarse && frame++ % 2) return;
    const y = scrollY;
    vel += ((y - scroll) / innerHeight / Math.max(dt, 0.001) - vel) * 0.12;
    scroll = y;
    const k = 1 - Math.exp(-dt * 5);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    pointer.on += (pointer.ton - pointer.on) * (1 - Math.exp(-dt * 2.5));
    level += ((sound.on ? sound.level() : 0) - level) * 0.15;
    draw(clock);
  };
  requestAnimationFrame(loop);
}
