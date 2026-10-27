// Hero cloth: a saffron silk sash, echoing the long cloth of Nuat Thippaya.
// Loaded lazily after the page is up. Returns null when WebGL isn't available.
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  PlaneGeometry,
  ShaderMaterial,
  Mesh,
  Color,
  Vector2,
  Vector3,
  DoubleSide,
  MathUtils,
} from 'three';

const W = 4.2;
const H = 14;

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uPointerStrength;
  uniform float uPull;
  uniform vec2 uSize;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;

  // 3D simplex noise (Ashima Arts, MIT)
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }

  vec3 displace(vec2 p) {
    float fromTop = (uSize.y * 0.5 - p.y) / uSize.y;   // 0 at the pinned top, 1 at the free end
    float hang = smoothstep(0.0, 0.3, fromTop);
    float t = uTime;

    float z = 0.0;
    z += sin(p.y * 0.85 - t * 0.75 + p.x * 0.55) * 0.3;
    z += sin(p.y * 2.0 - t * 1.25) * 0.07;
    z += snoise(vec3(p.x * 0.33, p.y * 0.2 - t * 0.11, t * 0.09)) * 0.6;
    z += snoise(vec3(p.x * 1.05, p.y * 0.75, t * 0.22)) * 0.08;
    z += sin(p.x * 2.3 + snoise(vec3(p.y * 0.3, t * 0.1, 0.0)) * 2.2) * 0.14 * fromTop;

    vec2 d = p - uPointer;
    z += exp(-dot(d, d) * 1.4) * uPointerStrength * 0.7;

    float sway = sin(t * 0.33 + p.y * 0.16) * 0.28 * fromTop * fromTop;
    float lift = uPull * fromTop * fromTop * 2.6;
    return vec3(sway + uPull * fromTop * 0.9 * sin(p.y * 0.45 + t * 0.9), 0.0, (z * hang) * (1.0 + uPull * 1.4) + lift);
  }

  void main() {
    vUv = uv;
    float e = 0.035;
    vec3 p0 = position + displace(position.xy);
    vec3 px = position + vec3(e, 0.0, 0.0) + displace(position.xy + vec2(e, 0.0));
    vec3 py = position + vec3(0.0, e, 0.0) + displace(position.xy + vec2(0.0, e));
    vec3 n = normalize(cross(px - p0, py - p0));
    vec4 mv = modelViewMatrix * vec4(p0, 1.0);
    vViewPos = -mv.xyz;
    vNormalV = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSaffron;
  uniform vec3 uDeep;
  uniform vec3 uLight;
  uniform vec3 uLinen;
  uniform vec3 uCinnamon;
  varying vec2 vUv;
  varying vec3 vNormalV;
  varying vec3 vViewPos;

  void main() {
    vec3 N = normalize(vNormalV);
    if (!gl_FrontFacing) N = -N;
    vec3 V = normalize(vViewPos);
    vec3 L = normalize(vec3(-0.45, 0.65, 0.9));
    float wrap = clamp(dot(N, L) * 0.5 + 0.5, 0.0, 1.0);

    // Saffron body, linen borders, thin cinnamon lines along the long edges.
    float edge = min(vUv.x, 1.0 - vUv.x);
    float border = 1.0 - smoothstep(0.072, 0.077, edge);
    float line1 = smoothstep(0.094, 0.098, edge) - smoothstep(0.106, 0.110, edge);
    float line2 = 1.0 - smoothstep(0.012, 0.016, edge);
    float line3 = smoothstep(0.036, 0.039, edge) - smoothstep(0.042, 0.045, edge);

    vec3 body = mix(uDeep, uSaffron, smoothstep(0.08, 0.8, wrap));
    body = mix(body, uLight, pow(wrap, 5.0) * 0.55);
    vec3 trim = mix(uLinen * 0.74, uLinen, smoothstep(0.1, 0.9, wrap));
    vec3 col = mix(body, trim, border);
    col = mix(col, uCinnamon, max(max(line1, line2), line3) * 0.85);

    // Woven texture.
    vec2 g = vUv * vec2(220.0, 730.0);
    col *= 1.0 + sin(g.x * 6.2831) * sin(g.y * 6.2831) * 0.035;

    // Silk sheen and soft shadow in the folds.
    vec3 Hh = normalize(L + V);
    float spec = pow(max(dot(N, Hh), 0.0), 36.0);
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), 3.0);
    col *= 0.7 + 0.3 * wrap;
    col += vec3(1.0, 0.88, 0.66) * (spec * 0.3 + fres * 0.1);

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export function initCloth(canvas, { reduceMotion = false, onReady } = {}) {
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  const uniforms = {
    uTime: { value: 0 },
    uPointer: { value: new Vector2(99, 99) },
    uPointerStrength: { value: 0 },
    uPull: { value: 0 },
    uSize: { value: new Vector2(W, H) },
    uSaffron: { value: new Color('#e9a21b') },
    uDeep: { value: new Color('#8f5206') },
    uLight: { value: new Color('#fcdc94') },
    uLinen: { value: new Color('#f6efe3') },
    uCinnamon: { value: new Color('#7e4320') },
  };

  const mesh = new Mesh(
    new PlaneGeometry(W, H, 96, 300),
    new ShaderMaterial({ uniforms, vertexShader, fragmentShader, side: DoubleSide }),
  );
  scene.add(mesh);

  let baseY = 0;
  const layout = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const visH = 2 * camera.position.z * Math.tan(MathUtils.degToRad(camera.fov / 2));
    const visW = visH * camera.aspect;
    if (camera.aspect >= 0.9) {
      // Behind the photo column, falling from the top right.
      mesh.scale.set(Math.min(1, visW / 11), 1, 1);
      mesh.rotation.set(-0.12, 0.18, -0.3);
      mesh.position.set(visW * 0.2, 0, 0);
      baseY = 0.4;
    } else {
      // Phones: a narrower sash down the right edge.
      mesh.scale.set(0.5, 1, 1);
      mesh.rotation.set(-0.1, 0.2, -0.16);
      mesh.position.set(visW * 0.42, 0, 0);
      baseY = 0.6;
    }
    mesh.position.y = baseY;
  };

  // Pointer, projected onto the cloth's plane.
  const target = new Vector2(99, 99);
  let pointerOn = 0;
  const hero = canvas.closest('.hero') ?? canvas.parentElement;
  const ndc = new Vector3();
  const onPointer = (e) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, 0.5).unproject(camera);
    const dir = ndc.sub(camera.position).normalize();
    const p = camera.position.clone().add(dir.multiplyScalar(-camera.position.z / dir.z));
    mesh.worldToLocal(p);
    target.set(p.x, p.y);
    pointerOn = 1;
  };
  hero.addEventListener('pointermove', onPointer);
  hero.addEventListener('pointerleave', () => (pointerOn = 0));

  let pull = 0;
  let running = false;
  let visible = true;
  let last = performance.now();
  let time = 6;

  const render = () => {
    mesh.position.y = baseY + pull * 2.2;
    uniforms.uPull.value = pull;
    renderer.render(scene, camera);
  };

  const tick = (now) => {
    if (!running) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    uniforms.uTime.value = time;
    uniforms.uPointer.value.lerp(target, 0.08);
    uniforms.uPointerStrength.value += (pointerOn - uniforms.uPointerStrength.value) * 0.05;
    render();
    requestAnimationFrame(tick);
  };

  const start = () => {
    if (running || reduceMotion || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  };
  const stop = () => (running = false);

  new ResizeObserver(() => {
    layout();
    if (!running) render();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }).observe(canvas);
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  layout();
  uniforms.uTime.value = time;
  render();
  onReady?.();
  start();

  return {
    setPull(value) {
      pull = value;
      if (!running) render();
    },
  };
}
