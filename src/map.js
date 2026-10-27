// Map of Memories Spa, built like the AusMC venue map: MapLibre GL JS 6.12 (WebGL) with
// OpenFreeMap tiles (free, no API key), recoloured to the site's palette, with 3D
// buildings. It opens on the globe over Japan, flies down to the salon in 3D when it
// comes into view, then slowly orbits until the visitor touches it.
import { AttributionControl, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';
import { t } from './lang.js';
import { gsap, ScrollTrigger } from './motion.js';

// MapLibre 6 looks for its worker next to its own file, which Vite moves; point it at Vite's build instead.
setWorkerUrl(workerUrl);

const SPA = [140.107254, 36.11377]; // 茨城県つくば市柴崎68 (GSI geocoder)
const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const phone = () => innerWidth < 720;
// The journey starts with the whole globe floating in the panel, Japan in front.
const JAPAN = () => ({ center: [138.4, 34], zoom: phone() ? 0.8 : 1.5, pitch: 0, bearing: 0 });
const ARRIVAL = () => ({ center: SPA, zoom: phone() ? 16.1 : 16.6, pitch: 64, bearing: -28 });

const LOCALE_JA = {
  'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl キーを押しながらスクロールで拡大・縮小',
  'CooperativeGesturesHandler.MacHelpText': '⌘ キーを押しながらスクロールで拡大・縮小',
  'CooperativeGesturesHandler.MobileHelpText': '2本の指で地図を動かします',
  'NavigationControl.ZoomIn': '拡大',
  'NavigationControl.ZoomOut': '縮小',
  'NavigationControl.ResetBearing': '北を上にする',
};

const C = {
  land: '#efe6d6',
  landuse: '#ebe1d1',
  green: '#e1dcc3',
  water: '#cdd3c6',
  road: '#fbf7ef',
  major: '#f3d18c',
  casing: '#dccdb5',
  rail: '#c9b9a0',
  boundary: '#c8b79a',
  text: '#5b4637',
  halo: '#f3ece0',
};

/** Recolour the OpenFreeMap positron style into Saffron & Linen, and add 3D buildings. */
function restyle(style) {
  style.layers = style.layers.filter((l) => l.id !== 'building');
  for (const l of style.layers) {
    const p = (l.paint ??= {});
    const { id, type } = l;
    if (type === 'background') p['background-color'] = C.land;
    else if (type === 'fill') {
      // Deeper sea from orbit, so the globe reads; paler at street level.
      if (/water/.test(id)) p['fill-color'] = ['interpolate', ['linear'], ['zoom'], 2, '#b7c3b2', 8, C.water];
      else if (/park|wood|grass|forest|landcover|green/.test(id)) p['fill-color'] = C.green;
      else p['fill-color'] = C.landuse;
    } else if (type === 'line') {
      if (/water|river|stream|canal/.test(id)) p['line-color'] = C.water;
      else if (/boundary|admin/.test(id)) p['line-color'] = C.boundary;
      else if (/rail|transit/.test(id)) p['line-color'] = C.rail;
      else if (/casing/.test(id)) p['line-color'] = C.casing;
      else if (/motorway|trunk|primary|major/.test(id)) p['line-color'] = C.major;
      else p['line-color'] = C.road;
    } else if (type === 'symbol' && l.layout?.['text-field']) {
      p['text-color'] = C.text;
      p['text-halo-color'] = C.halo;
      p['text-halo-width'] = 1.2;
    }
    // From space the Earth is bare: labels and borders appear on the way down.
    if (type === 'symbol') p['text-opacity'] = p['icon-opacity'] = BY_ZOOM_IN;
    if (/boundary/.test(id)) p['line-opacity'] = BY_ZOOM_IN;
  }
  // 3D buildings. Tsukuba is low-rise, so heights are lifted a little (and given a
  // floor) to read as shapes; sand at street level warming to saffron as they rise,
  // each with a pale roof cap, and a soft contact shadow where they meet the ground.
  const raw = ['coalesce', ['get', 'render_height'], 0];
  const top = ['*', ['max', raw, 4], 1.5];
  const base = ['*', ['coalesce', ['get', 'render_min_height'], 0], 1.5];
  const grow = (h) => ['interpolate', ['linear'], ['zoom'], 13, 0, 14.6, h];
  const solid = ['!=', ['get', 'hide_3d'], true];
  const labels = style.layers.findIndex((l) => l.type === 'symbol');
  style.layers.splice(
    labels,
    0,
    // The real Earth (NASA Blue Marble) seen from orbit, fading into the drawn map as we descend.
    {
      id: 'mai-earth',
      type: 'raster',
      source: 'blue-marble',
      paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 5.5, 1, 8.5, 0], 'raster-fade-duration': 250 },
    },
    {
      id: 'mai-halo',
      type: 'fill',
      source: 'mai-halo',
      paint: { 'fill-color': '#e9a21b', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 11, 0, 14, 0.075] },
    },
    {
      id: 'mai-building-shadow',
      type: 'line',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14.5,
      paint: { 'line-color': '#8e4f25', 'line-opacity': 0.22, 'line-width': 5, 'line-blur': 4 },
    },
    {
      id: 'mai-buildings',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 13,
      filter: solid,
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], raw, 0, '#eadcc4', 10, '#e8cd98', 25, '#e3b25a', 60, '#c98a2a'],
        'fill-extrusion-height': grow(top),
        'fill-extrusion-base': grow(base),
        'fill-extrusion-vertical-gradient': true,
      },
    },
    {
      id: 'mai-building-roofs',
      type: 'fill-extrusion',
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 15,
      filter: solid,
      paint: {
        'fill-extrusion-color': '#fbf4e6',
        'fill-extrusion-base': grow(top),
        'fill-extrusion-height': grow(['+', top, 0.7]),
        'fill-extrusion-vertical-gradient': false,
      },
    },
  );
  style.sources['blue-marble'] = {
    type: 'raster',
    tiles: ['https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_ShadedRelief_Bathymetry/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg'],
    tileSize: 256,
    maxzoom: 8,
    attribution: 'Blue Marble: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA EOSDIS GIBS</a>',
  };
  // A warm glow on the ground around the salon: stacked translucent rings.
  style.sources['mai-halo'] = {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [30, 60, 95, 135, 180, 240].map((r) => circle(SPA, r)) },
  };
  // Low, warm sunlight for the building faces; a blue atmosphere around the globe that
  // becomes a saffron sky at the horizon by street level; the globe for the journey in.
  style.light = { anchor: 'map', color: '#fff1d6', intensity: 0.5, position: [1.3, 205, 42] };
  style.sky = {
    'sky-color': ['interpolate', ['linear'], ['zoom'], 5, '#3a6fd8', 9, '#efbf62'],
    'horizon-color': ['interpolate', ['linear'], ['zoom'], 5, '#bfe0ff', 9, '#faf3e6'],
    'fog-color': '#f3ece0',
    'sky-horizon-blend': 0.75,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': 0.7,
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.8, 5, 0.6, 8, 0],
  };
  style.projection = { type: 'globe' };
}

const BY_ZOOM_IN = ['interpolate', ['linear'], ['zoom'], 5, 0, 6.5, 1];

/** Deep space behind the globe: a starfield with a soft Milky Way band, drawn once per size. */
function paintSpace(canvas) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const g = canvas.getContext('2d');
  g.scale(dpr, dpr);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const gauss = () => (rand() + rand() + rand() - 1.5) / 1.5;

  const bg = g.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.45, Math.hypot(w, h) * 0.6);
  bg.addColorStop(0, '#0c1433');
  bg.addColorStop(0.55, '#060a1d');
  bg.addColorStop(1, '#020309');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);

  // The galactic band: soft overlapping clouds along a tilted line.
  g.save();
  g.translate(w / 2, h / 2);
  g.rotate(-0.6);
  g.globalCompositeOperation = 'lighter';
  const tints = ['143,166,255', '201,166,255', '255,217,160', '120,200,255'];
  for (let i = 0; i < 90; i++) {
    const x = (rand() - 0.5) * Math.hypot(w, h) * 1.1;
    const y = gauss() * h * 0.12;
    const r = 30 + rand() * 110;
    const cloud = g.createRadialGradient(x, y, 0, x, y, r);
    cloud.addColorStop(0, `rgba(${tints[i % tints.length]},${0.035 + rand() * 0.05})`);
    cloud.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = cloud;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // Dense dust of faint stars inside the band.
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(255,255,255,${0.15 + rand() * 0.45})`;
    g.fillRect((rand() - 0.5) * Math.hypot(w, h) * 1.1, gauss() * h * 0.1, 0.6, 0.6);
  }
  g.restore();

  // Stars everywhere: most faint, a few bright with a glow, tinted blue-white to gold.
  const colours = ['255,255,255', '210,225,255', '255,236,200', '180,200,255'];
  for (let i = 0; i < (w * h) / 220; i++) {
    const x = rand() * w;
    const y = rand() * h;
    const m = rand() ** 6;
    const r = 0.35 + m * 1.6;
    const c = colours[Math.floor(rand() * colours.length)];
    g.fillStyle = `rgba(${c},${0.35 + m * 0.65})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    if (m > 0.35) {
      const glow = g.createRadialGradient(x, y, 0, x, y, r * 7);
      glow.addColorStop(0, `rgba(${c},0.35)`);
      glow.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = glow;
      g.fillRect(x - r * 7, y - r * 7, r * 14, r * 14);
    }
  }
}

/** A circle of radius r metres around [lng, lat], as a GeoJSON polygon. */
function circle([lng, lat], r) {
  const dLat = r / 111320;
  const dLng = r / (111320 * Math.cos((lat * Math.PI) / 180));
  const ring = Array.from({ length: 65 }, (_, i) => {
    const a = (i / 64) * Math.PI * 2;
    return [lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)];
  });
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

// Place names in the visitor's language where OpenMapTiles has them, then English, then local.
const nameField = (lang) =>
  lang === 'ja'
    ? ['coalesce', ['get', 'name:ja'], ['get', 'name']]
    : ['coalesce', ['get', `name:${lang}`], ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];

const isNameLabel = (field) => field && JSON.stringify(field).includes('name');

export async function initMap(container, { lang, reduceMotion, entered = Promise.resolve() }) {
  let style;
  try {
    style = await fetch(STYLE).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  } catch {
    container.classList.add('is-fallback');
    return null;
  }
  restyle(style);
  for (const l of style.layers) if (l.type === 'symbol' && isNameLabel(l.layout?.['text-field'])) l.layout['text-field'] = nameField(lang);

  // Space shows wherever the globe doesn't cover the panel.
  const space = document.createElement('canvas');
  space.className = 'map-space';
  space.setAttribute('aria-hidden', 'true');
  container.prepend(space);
  new ResizeObserver(() => paintSpace(space)).observe(space);

  const map = new MapLibreMap({
    container,
    style,
    ...(reduceMotion ? ARRIVAL() : JAPAN()),
    maxPitch: 75,
    attributionControl: false,
    cooperativeGestures: true,
    fadeDuration: 250,
    localIdeographFontFamily: "'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif",
    locale: lang === 'ja' ? LOCALE_JA : {},
  });
  if (import.meta.env.DEV) window.__maiMap = map;
  map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
  map.addControl(new NavigationControl({ visualizePitch: true }), 'top-right');

  // Tapping the pin offers directions straight away.
  const pin = document.createElement('button');
  pin.type = 'button';
  pin.className = 'map-pin';
  pin.innerHTML = '<span class="map-pin__label">Memories Spa</span><span class="map-pin__dot"></span>';
  pin.addEventListener('click', (e) => {
    e.stopPropagation();
    document.dispatchEvent(new CustomEvent('mai:directions'));
  });
  new Marker({ element: pin, anchor: 'center' }).setLngLat(SPA).addTo(map);

  // The orbit re-renders the 3D city every frame, so it only runs while the map is seen.
  let orbit = null;
  let onScreen = true;
  let flight = 0;
  const stopOrbit = () => {
    orbit?.kill();
    orbit = null;
  };
  const startOrbit = () => {
    if (reduceMotion) return;
    stopOrbit();
    const o = { b: map.getBearing() };
    orbit = gsap.to(o, { b: o.b + 360, duration: 240, ease: 'none', repeat: -1, paused: !onScreen, onUpdate: () => map.setBearing(o.b) });
  };
  new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (orbit) onScreen ? orbit.resume() : orbit.pause();
  }, { rootMargin: '60px 0px' }).observe(container);
  ['mousedown', 'touchstart', 'wheel', 'dragstart'].forEach((ev) => map.on(ev, stopOrbit));

  const flyIn = (first) => {
    stopOrbit();
    // Only the latest flight may start the orbit: an interrupted flight also fires
    // "moveend", and the orbit would otherwise cancel the new flight.
    const token = ++flight;
    map.flyTo({ ...ARRIVAL(), duration: first ? 8000 : 6000, curve: first ? 1.7 : 1.5, essential: true });
    document.dispatchEvent(new CustomEvent('mai:fly'));
    map.once('moveend', () => {
      if (token !== flight) return;
      document.dispatchEvent(new CustomEvent('mai:arrive'));
      startOrbit();
    });
  };

  // "Fly in again": back out to Japan and travel down once more.
  const replay = document.createElement('button');
  replay.type = 'button';
  replay.className = 'map-replay';
  replay.innerHTML = `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg><span data-t="fly-in-again">${t('fly-in-again')}</span>`;
  replay.addEventListener('click', () => {
    map.jumpTo(JAPAN());
    flyIn(false);
  });

  map.once('load', () => {
    container.classList.add('is-ready');
    container.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    if (reduceMotion) return;
    container.append(replay);
    // Once the welcome portal has gone: a moment on the globe in space, then the journey down.
    entered.then(() =>
      ScrollTrigger.create({ trigger: container, start: 'top 70%', once: true, onEnter: () => gsap.delayedCall(1.4, () => flyIn(true)) }),
    );
  });

  document.addEventListener('langchange', (e) => {
    if (!map.isStyleLoaded()) return;
    for (const { id, type } of map.getStyle().layers) {
      if (type === 'symbol' && isNameLabel(map.getLayoutProperty(id, 'text-field'))) map.setLayoutProperty(id, 'text-field', nameField(e.detail.lang));
    }
  });

  return map;
}
