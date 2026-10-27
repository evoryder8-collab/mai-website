// Japanese/English switch. Both languages live in the HTML (data-l="ja" / data-l="en");
// CSS hides the one that doesn't match <html lang>. The inline script in index.html
// picks the starting language before first paint.

const META = {
  ja: {
    title: 'Mai｜タイ伝統マッサージ セラピスト｜Memories Spa つくば',
    description:
      '世界大会3位・特別賞（Massage Championship World Tour 2025）。タイ政府認定セラピスト Mai による、ユーファイとヌアット・ティップパヤー。つくばの女性専用サロン Memories Spa にて。',
  },
  en: {
    title: 'Mai — Thai Massage Therapist · Memories Spa, Tsukuba',
    description:
      '3rd Place & Special Award, Massage Championship World Tour 2025. Thai government–certified therapist Mai offers Yu-fai herbal heat therapy and Nuat Thippaya cloth massage at Memories Spa, a women-only salon in Tsukuba.',
  },
};

export function getLang() {
  return document.documentElement.lang === 'en' ? 'en' : 'ja';
}

export function setLang(lang, { persist = true } = {}) {
  const root = document.documentElement;
  root.lang = lang;
  document.title = META[lang].title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', META[lang].description);
  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.setLang === lang));
  });
  if (persist) {
    try {
      localStorage.setItem('mai-lang', lang);
    } catch {}
  }
  document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
}

export function initLang() {
  setLang(getLang(), { persist: false });
  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.dataset.setLang !== getLang()) setLang(btn.dataset.setLang);
    });
  });
}
