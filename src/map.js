// Map of Memories Spa, restyled to the site's palette.
// Tiles: OpenFreeMap (free, no API key). Loaded only when the Visit section is near.
import { Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

// MapLibre 6 looks for its worker next to its own file, which Vite moves; point it at Vite's build instead.
setWorkerUrl(workerUrl);

const SPA = [140.107254, 36.11377]; // 茨城県つくば市柴崎68 (GSI geocoder)
const STYLE = 'https://tiles.openfreemap.org/styles/positron';

const LOCALE_JA = {
  'CooperativeGesturesHandler.WindowsHelpText': 'Ctrl キーを押しながらスクロールで拡大・縮小',
  'CooperativeGesturesHandler.MacHelpText': '⌘ キーを押しながらスクロールで拡大・縮小',
  'CooperativeGesturesHandler.MobileHelpText': '2本の指で地図を動かします',
  'NavigationControl.ZoomIn': '拡大',
  'NavigationControl.ZoomOut': '縮小',
};

const COLORS = {
  land: '#efe6d6',
  landuse: '#ebe1d1',
  green: '#e1dcc3',
  water: '#cdd3c6',
  building: '#e4d8c3',
  road: '#fbf7ef',
  major: '#f3d18c',
  casing: '#dccdb5',
  rail: '#c9b9a0',
  boundary: '#c8b79a',
  text: '#5b4637',
  halo: '#f3ece0',
};

function paint(map, id, prop, value) {
  try {
    map.setPaintProperty(id, prop, value);
  } catch {}
}

function restyle(map) {
  for (const { id, type } of map.getStyle().layers) {
    if (type === 'background') paint(map, id, 'background-color', COLORS.land);
    else if (type === 'fill') {
      if (/water/.test(id)) paint(map, id, 'fill-color', COLORS.water);
      else if (/park|wood|grass|forest|landcover|green/.test(id)) paint(map, id, 'fill-color', COLORS.green);
      else if (/building/.test(id)) paint(map, id, 'fill-color', COLORS.building);
      else paint(map, id, 'fill-color', COLORS.landuse);
    } else if (type === 'line') {
      if (/water|river|stream|canal/.test(id)) paint(map, id, 'line-color', COLORS.water);
      else if (/boundary|admin/.test(id)) paint(map, id, 'line-color', COLORS.boundary);
      else if (/rail|transit/.test(id)) paint(map, id, 'line-color', COLORS.rail);
      else if (/casing/.test(id)) paint(map, id, 'line-color', COLORS.casing);
      else if (/motorway|trunk|primary/.test(id)) paint(map, id, 'line-color', COLORS.major);
      else paint(map, id, 'line-color', COLORS.road);
    } else if (type === 'symbol') {
      paint(map, id, 'text-color', COLORS.text);
      paint(map, id, 'text-halo-color', COLORS.halo);
    }
  }
}

function relabel(map, lang) {
  const field =
    lang === 'ja'
      ? ['coalesce', ['get', 'name:ja'], ['get', 'name']]
      : ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], ['get', 'name']];
  for (const { id, type } of map.getStyle().layers) {
    if (type !== 'symbol') continue;
    const current = map.getLayoutProperty(id, 'text-field');
    if (current && JSON.stringify(current).includes('name')) map.setLayoutProperty(id, 'text-field', field);
  }
}

export function initMap(container, lang) {
  const map = new MapLibreMap({
    container,
    style: STYLE,
    center: SPA,
    zoom: 14.4,
    minZoom: 8,
    maxZoom: 18,
    attributionControl: { compact: true },
    cooperativeGestures: true,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    localIdeographFontFamily: "'Zen Kaku Gothic New', 'Hiragino Sans', sans-serif",
    locale: lang === 'ja' ? LOCALE_JA : {},
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new NavigationControl({ showCompass: false }), 'top-right');

  map.on('style.load', () => {
    restyle(map);
    relabel(map, document.documentElement.lang);
  });
  map.once('load', () => container.classList.add('is-ready'));

  const pin = document.createElement('div');
  pin.className = 'map-pin';
  pin.innerHTML = '<span class="map-pin__label">Memories Spa</span><span class="map-pin__dot"></span>';
  new Marker({ element: pin, anchor: 'center' }).setLngLat(SPA).addTo(map);

  document.addEventListener('langchange', (e) => {
    if (map.isStyleLoaded()) relabel(map, e.detail.lang);
  });

  return map;
}
