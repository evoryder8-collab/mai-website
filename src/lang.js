// Eight languages. Japanese is written into the HTML (it's the default, and what shows
// without JavaScript); every translatable element carries data-t="key", and the
// dictionary for the active language (src/i18n/<code>.json) replaces its contents.
// The inline script in src/partials/head.html sets <html lang> before first paint and
// hides the page (html.i18n-pending) until a non-Japanese dictionary has been applied.

export const LANGS = [
  { code: 'ja', tag: 'ja', name: '日本語', english: 'Japanese', flag: 'jp' },
  { code: 'en', tag: 'en', name: 'English', english: 'English', flag: 'gb' },
  { code: 'zh', tag: 'zh-Hans', name: '简体中文', english: 'Chinese', flag: 'cn' },
  { code: 'ko', tag: 'ko', name: '한국어', english: 'Korean', flag: 'kr' },
  { code: 'th', tag: 'th', name: 'ไทย', english: 'Thai', flag: 'th' },
  { code: 'fr', tag: 'fr', name: 'Français', english: 'French', flag: 'fr' },
  { code: 'de', tag: 'de', name: 'Deutsch', english: 'German', flag: 'de' },
  { code: 'it', tag: 'it', name: 'Italiano', english: 'Italian', flag: 'it' },
];
export const DEFAULT_LANG = 'ja';
const KEY = 'mai-lang';

// Scripts for which the site's own fonts have no glyphs.
const FONTS = {
  zh: 'family=Noto+Serif+SC:wght@500;600&family=Noto+Sans+SC:wght@400;500',
  ko: 'family=Noto+Serif+KR:wght@500;600&family=Noto+Sans+KR:wght@400;500',
  th: 'family=Noto+Serif+Thai:wght@400;500&family=Noto+Sans+Thai:wght@400;500',
};

const dictionaries = import.meta.glob('./i18n/*.json', { import: 'default' });
let dict = {};

export const langInfo = (code) => LANGS.find((l) => l.code === code);
const valid = (code) => !!langInfo(code);

export function getLang() {
  const tag = document.documentElement.lang;
  return LANGS.find((l) => l.tag === tag)?.code ?? DEFAULT_LANG;
}

export function storedLang() {
  try {
    const code = localStorage.getItem(KEY);
    return valid(code) ? code : null;
  } catch {
    return null;
  }
}

/** The browser's preferred language if Mai's site speaks it, otherwise Japanese. */
export function deviceLang() {
  for (const pref of navigator.languages ?? [navigator.language]) {
    const code = String(pref).toLowerCase().split(/[-_]/)[0];
    if (valid(code)) return code;
  }
  return DEFAULT_LANG;
}

/** Text for a key in the active language (for strings built in JavaScript). */
export const t = (key) => dict[key] ?? key;

/** Fill every [data-t] inside root from the active dictionary. */
export function translate(root = document) {
  root.querySelectorAll('[data-t]').forEach((el) => {
    const value = dict[el.dataset.t];
    if (value != null && el.innerHTML !== value) el.innerHTML = value;
  });
}

function loadFonts(code) {
  if (!FONTS[code] || document.querySelector(`link[data-font="${code}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${FONTS[code]}&display=swap`;
  link.dataset.font = code;
  document.head.append(link);
}

export async function setLang(code, { persist = true } = {}) {
  if (!valid(code)) code = DEFAULT_LANG;
  loadFonts(code);
  try {
    dict = await dictionaries[`./i18n/${code}.json`]();
  } catch {
    dict = {};
  }
  const root = document.documentElement;
  root.lang = langInfo(code).tag;
  translate();
  const page = document.body.dataset.page ?? 'home';
  if (dict[`meta-${page}-title`]) document.title = dict[`meta-${page}-title`];
  document.querySelector('meta[name="description"]')?.setAttribute('content', dict[`meta-${page}-desc`] ?? '');
  if (persist) {
    try {
      localStorage.setItem(KEY, code);
    } catch {}
  }
  root.classList.remove('i18n-pending');
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang: code } }));
}

export function initLang() {
  return setLang(getLang(), { persist: false });
}
