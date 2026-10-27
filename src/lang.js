// Japanese/English switch. Both languages live in the HTML (data-l="ja" / data-l="en");
// CSS hides the one that doesn't match <html lang>. The inline script in
// src/partials/head.html picks the starting language before first paint.

// Title and description per page (<body data-page>) and language.
const META = {
  home: {
    ja: {
      title: 'Mai｜タイ伝統マッサージ セラピスト｜Memories Spa つくば',
      description: 'タイ伝統マッサージの世界大会で3位・特別賞を受賞したタイ政府認定セラピスト Mai。ユーファイとヌアット・ティップパヤーを、つくばの女性専用サロン Memories Spa にて。',
    },
    en: {
      title: 'Mai — Thai Massage Therapist · Memories Spa, Tsukuba',
      description: 'Thai government–certified therapist Mai, 3rd place and Special Award at a world championship in Thai traditional massage. Yu-fai and Nuat Thippaya at Memories Spa, a women-only salon in Tsukuba.',
    },
  },
  award: {
    ja: {
      title: '受賞｜Mai タイ伝統マッサージ セラピスト',
      description: 'タイ伝統マッサージの世界大会で、卓越した技術と極上のタッチが認められ世界大会3位・特別賞を受賞。Massage Championship World Tour 2025 授賞式の映像とともに。',
    },
    en: {
      title: 'Award · Mai, Thai Massage Therapist',
      description: 'Mai’s technique and touch earned 3rd place and a Special Award at a world championship in Thai traditional massage. With film from the Massage Championship World Tour 2025 award ceremony.',
    },
  },
  about: {
    ja: {
      title: 'プロフィール｜Mai タイ伝統マッサージ セラピスト',
      description: 'タイ政府認定セラピスト Mai。つくばの女性専用サロン Memories Spa のセラピストチーフとして、ユーファイと極上の癒しの時間を担当しています。',
    },
    en: {
      title: 'About · Mai, Thai Massage Therapist',
      description: 'Thai government–certified therapist Mai is Therapist Chief at Memories Spa, a women-only salon in Tsukuba, where she leads Yu-fai and the most deeply relaxing treatments.',
    },
  },
  treatments: {
    ja: {
      title: '施術・コース｜Mai タイ伝統マッサージ セラピスト',
      description: 'タイ伝統のハーブ温熱療法「ユーファイ」と、布を使うマッサージ「ヌアット・ティップパヤー」。Mai が担当するタイ伝統ケアとコース・料金のご案内。',
    },
    en: {
      title: 'Treatments · Mai, Thai Massage Therapist',
      description: 'Yu-fai, Thailand’s traditional herbal heat therapy, and Nuat Thippaya, massage through a long cloth. Mai’s treatments, courses and prices.',
    },
  },
  visit: {
    ja: {
      title: 'アクセス｜Mai タイ伝統マッサージ セラピスト｜Memories Spa つくば',
      description: 'Memories Spa（茨城県つくば市柴崎68-17）へのアクセス、営業時間、お支払い、ご予約について。女性専用・完全予約制、小型犬同伴OK。',
    },
    en: {
      title: 'Visit · Mai at Memories Spa, Tsukuba',
      description: 'Directions, hours, payment and booking for Memories Spa, 68-17 Shibasaki, Tsukuba. Women only, by reservation, small dogs welcome.',
    },
  },
};
const pageMeta = () => META[document.body.dataset.page] ?? META.home;

export function getLang() {
  return document.documentElement.lang === 'en' ? 'en' : 'ja';
}

export function setLang(lang, { persist = true } = {}) {
  const root = document.documentElement;
  root.lang = lang;
  const meta = pageMeta()[lang];
  document.title = meta.title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', meta.description);
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
