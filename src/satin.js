// The background: cream satin flowing like liquid. The technique is the one from Zoltán's
// site: simplex noise warped twice through itself drives a band pattern whose phase it
// bends, so the folds flow rather than slide, and layered powers of the bands give a broad
// sheen, a tighter shine and a hairline gold glint. Here in Mai's linen, sand and gold.
// Taps push the cloth outward in warm rings, the finger or cursor gently pulls it,
// scrolling moves it along and stirs it with speed, and with sound on the sheen brightens
// with the ambience. Rendered at half resolution (it's all soft light) at ~30 fps, and
// paused when the tab is hidden.
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

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 p = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;

  // Taps: rings that push the cloth outward and leave a warm glow.
  vec2 disp = vec2(0.0);
  float glow = 0.0;
  for (int i = 0; i < 3; i++) {
    vec4 r = uRipple[i];
    float age = uTime - r.z;
    if (age > 0.0 && age < 3.2) {
      vec2 d = p - r.xy;
      float len = length(d) + 1e-4;
      float ring = len - age * 0.42;
      float w = exp(-ring * ring * 70.0) * exp(-age * 1.15) * r.w;
      disp += d / len * w * 0.07;
      glow += w;
    }
  }

  // The finger or cursor gently pulls the cloth toward it.
  vec2 q = p + disp;
  vec2 m = uPointer.xy;
  q += (m - q) * 0.05 * uPointer.z * exp(-dot(q - m, q - m) * 2.0);

  // Noise warped twice through itself, then the folds: bands whose phase it bends.
  float t = uTime * 0.035;
  float stir = 1.1 + min(abs(uVel), 1.0) * 0.5;
  vec2 w1 = vec2(snoise(q * 0.62 + vec2(t, -t * 0.6)), snoise(q * 0.62 + vec2(-t * 0.7, t) + 4.3));
  vec2 w2 = vec2(snoise(q * 0.95 + w1 * stir + vec2(1.7, 9.2) + t), snoise(q * 0.95 + w1 * stir + vec2(8.3, 2.8) - t));
  float n = snoise(q * 0.55 + w2 * 0.7 + vec2(0.0, uScroll * 0.12));
  float folds = 0.5 + 0.5 * sin((q.x * 1.2 + q.y * 0.8 + n * 1.5 + w1.x * 0.5) * 2.4 + t * 4.0);

  vec3 sand = vec3(0.855, 0.79, 0.695);
  vec3 linen = vec3(0.945, 0.915, 0.865);
  vec3 cream = vec3(1.0, 0.99, 0.965);
  vec3 gold = vec3(0.97, 0.72, 0.32);
  float lift = 1.0 + uLevel * 1.4;

  // Where the cloth turns toward the light, and the shade in the bottom of each fold.
  float body = smoothstep(-0.55, 0.95, n);
  vec3 col = mix(mix(sand, linen, 0.55), linen, body);
  col = mix(col, sand, pow(1.0 - folds, 3.0) * (0.45 + 0.35 * body));
  // The sheen: a broad glow, a tighter shine, and a hairline glint.
  col = mix(col, cream, pow(folds, 6.0) * (0.55 + 0.35 * body) * lift);
  col += gold * pow(folds, 24.0) * 0.10 * body * lift;
  col += vec3(1.0) * pow(folds, 70.0) * 0.07 * body * lift;
  col += gold * glow * 0.10;
  col += gold * exp(-dot(p - m, p - m) * 6.0) * 0.02 * uPointer.z;

  // A soft warm falloff toward the edges.
  vec2 v = uv - vec2(0.5, 0.55);
  col *= 1.0 - smoothstep(0.35, 1.1, length(v * vec2(1.1, 1.35))) * 0.07;
  // Dither, so the smooth gradients never band.
  col += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) / 255.0;
  gl_FragColor = vec4(col, 1.0);
}`;

export function initSatin({ reduceMotion }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'satin-bg';
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
  document.documentElement.classList.add('has-satin');

  // Satin is smooth: render below screen resolution, less on phones.
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

  // ~30 fps: the motion is slow, and it keeps the frosted glass on top cheap.
  let last = performance.now();
  const loop = (now) => {
    requestAnimationFrame(loop);
    if (document.hidden) return (last = now);
    if (now - last < 32) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    clock += dt;
    const y = scrollY;
    vel += ((y - scroll) / innerHeight / Math.max(dt, 0.001) - vel) * 0.12;
    scroll = y;
    const k = 1 - Math.exp(-dt * 4);
    pointer.x += (pointer.tx - pointer.x) * k;
    pointer.y += (pointer.ty - pointer.y) * k;
    pointer.on += (pointer.ton - pointer.on) * (1 - Math.exp(-dt * 2.5));
    level += ((sound.on ? sound.level() : 0) - level) * 0.15;
    draw(clock);
  };
  requestAnimationFrame(loop);
}
