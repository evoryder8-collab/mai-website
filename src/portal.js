// The welcome portal, on the first page of a visit: first "Sound on?", then the language,
// with the device's language suggested and picked automatically after 5 seconds
// (Japanese when the device's language isn't one of the eight). Modelled on the
// Lume Wellness and matthewhua.ch portals. The header's language button reopens the
// language step on its own, without the countdown.
import { deviceLang, getLang, LANGS, langInfo, setLang, storedLang, t } from './lang.js';
import { gsap } from './motion.js';
import { sound } from './sound.js';
import cn from 'flag-icons/flags/1x1/cn.svg?raw';
import de from 'flag-icons/flags/1x1/de.svg?raw';
import fr from 'flag-icons/flags/1x1/fr.svg?raw';
import gb from 'flag-icons/flags/1x1/gb.svg?raw';
import it from 'flag-icons/flags/1x1/it.svg?raw';
import jp from 'flag-icons/flags/1x1/jp.svg?raw';
import kr from 'flag-icons/flags/1x1/kr.svg?raw';
import th from 'flag-icons/flags/1x1/th.svg?raw';

const FLAGS = { jp, gb, cn, kr, th, fr, de, it };
const COUNTDOWN = 5000;

// The portal speaks before any dictionary is loaded, so its few lines live here.
const COPY = {
  ja: { role: 'タイ伝統マッサージ セラピスト', soundTitle: 'サウンドをオンにしますか？', soundCopy: '穏やかな音とともに、Mai の世界へ。右上のボタンでいつでもオフにできます。', yes: 'はい', recommended: 'おすすめ', no: '音なしで見る', choose: '言語を選択してください', auto: '日本語で始まります… {s}', paused: '自動選択を一時停止しました', pause: '一時停止', resume: '再開', device: 'お使いの端末の言語', close: '閉じる' },
  en: { role: 'Thai Massage Therapist', soundTitle: 'Experience it with sound?', soundCopy: 'Gentle sound draws you into Mai’s world. Turn it off any time with the button at the top right.', yes: 'Yes', recommended: 'Recommended', no: 'Continue without sound', choose: 'Choose your language', auto: 'Continuing in English in {s}', paused: 'Automatic selection paused', pause: 'Pause', resume: 'Resume', device: 'Your device’s language', close: 'Close' },
  zh: { role: '泰式传统按摩理疗师', soundTitle: '要开启声音吗？', soundCopy: '在柔和的声音中，走进 Mai 的世界。可随时用右上角的按钮关闭。', yes: '是', recommended: '推荐', no: '不开声音继续', choose: '请选择语言', auto: '{s} 秒后以简体中文继续', paused: '已暂停自动选择', pause: '暂停', resume: '继续', device: '您设备的语言', close: '关闭' },
  ko: { role: '태국 전통 마사지 테라피스트', soundTitle: '소리를 켜시겠어요?', soundCopy: '은은한 소리와 함께 Mai의 세계로 들어가 보세요. 오른쪽 위 버튼으로 언제든지 끌 수 있어요.', yes: '네', recommended: '추천', no: '소리 없이 보기', choose: '언어를 선택해 주세요', auto: '{s}초 후 한국어로 계속합니다', paused: '자동 선택이 일시 정지되었습니다', pause: '일시 정지', resume: '계속', device: '기기 언어', close: '닫기' },
  th: { role: 'นักบำบัดนวดแผนไทย', soundTitle: 'เปิดเสียงไหม?', soundCopy: 'เสียงที่นุ่มนวลจะพาคุณเข้าสู่โลกของ Mai ปิดได้ทุกเมื่อด้วยปุ่มมุมขวาบน', yes: 'ใช่', recommended: 'แนะนำ', no: 'ดูต่อโดยไม่เปิดเสียง', choose: 'เลือกภาษา', auto: 'จะใช้ภาษาไทยใน {s} วินาที', paused: 'หยุดการเลือกอัตโนมัติชั่วคราว', pause: 'หยุดชั่วคราว', resume: 'ทำต่อ', device: 'ภาษาของอุปกรณ์คุณ', close: 'ปิด' },
  fr: { role: 'Thérapeute en massage thaï', soundTitle: 'Avec le son ?', soundCopy: 'Un son tout en douceur pour entrer dans l’univers de Mai. Coupez-le à tout moment avec le bouton en haut à droite.', yes: 'Oui', recommended: 'Recommandé', no: 'Continuer sans le son', choose: 'Choisissez votre langue', auto: 'Suite en français dans {s} s', paused: 'Sélection automatique en pause', pause: 'Pause', resume: 'Reprendre', device: 'Langue de votre appareil', close: 'Fermer' },
  de: { role: 'Thai-Massage-Therapeutin', soundTitle: 'Mit Ton erleben?', soundCopy: 'Sanfte Klänge führen Sie in Mais Welt. Mit der Taste oben rechts schalten Sie den Ton jederzeit aus.', yes: 'Ja', recommended: 'Empfohlen', no: 'Ohne Ton fortfahren', choose: 'Wählen Sie Ihre Sprache', auto: 'Weiter auf Deutsch in {s} s', paused: 'Automatische Auswahl pausiert', pause: 'Pausieren', resume: 'Fortsetzen', device: 'Sprache Ihres Geräts', close: 'Schließen' },
  it: { role: 'Terapista di massaggio thai', soundTitle: 'Con l’audio?', soundCopy: 'Suoni delicati per entrare nel mondo di Mai. Puoi disattivarli in qualsiasi momento con il pulsante in alto a destra.', yes: 'Sì', recommended: 'Consigliato', no: 'Continua senza audio', choose: 'Scegli la lingua', auto: 'Si continua in italiano tra {s} s', paused: 'Selezione automatica in pausa', pause: 'Pausa', resume: 'Riprendi', device: 'Lingua del tuo dispositivo', close: 'Chiudi' },
};

const ARROW = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
// Tells the film (src/film.js), inside the same tap, that the visitor chose sound or silence.
const soundGesture = () => document.dispatchEvent(new CustomEvent('mai:soundgesture', { detail: { on: sound.on } }));
const flag = (code) => FLAGS[langInfo(code).flag];

let resolveEntered;
/** Resolves once the visitor is through the portal (at once when there isn't one). */
export const entered = new Promise((r) => (resolveEntered = r));

export function initPortal({ lenis, reduceMotion, onEnter }) {
  const root = document.documentElement;
  let dialog = null;
  let mode = 'welcome';
  let countdown = null;

  const build = () => {
    dialog = document.createElement('dialog');
    dialog.className = 'portal';
    dialog.setAttribute('aria-labelledby', 'portal-title');
    dialog.innerHTML = `
      <div class="portal__atmos" aria-hidden="true"><span></span><span></span><span></span></div>
      <div class="portal__inner">
        <button class="portal__close" type="button" data-portal-close hidden><span class="choice__x" aria-hidden="true"></span><span class="visually-hidden" data-copy="close"></span></button>
        <div class="portal__brand">
          <span class="portal__mai brand__mark"><span class="brand__name">Mai</span><span class="brand__spark" aria-hidden="true">✦</span></span>
          <span class="portal__role" data-copy="role"></span>
        </div>
        <div class="portal__stage"></div>
        <p class="portal__foot">Memories Spa <i></i> Tsukuba, Japan</p>
      </div>`;
    document.body.append(dialog);
    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      if (mode === 'settings') close();
    });
    dialog.querySelector('[data-portal-close]').addEventListener('click', () => close());
    return dialog;
  };

  const copy = (code) => COPY[code] ?? COPY.ja;
  const fill = (el, code) => el.querySelectorAll('[data-copy]').forEach((n) => (n.textContent = copy(code)[n.dataset.copy]));

  const swap = (html, code) => {
    const stage = dialog.querySelector('.portal__stage');
    stage.innerHTML = html;
    stage.lang = langInfo(code).tag;
    fill(dialog, code);
    if (!reduceMotion) gsap.from(stage.children, { y: 24, autoAlpha: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out' });
    return stage;
  };

  const showSound = (code) => {
    const stage = swap(`
      <div class="portal__wave" aria-hidden="true">${'<i></i>'.repeat(9)}</div>
      <h2 class="portal__title" id="portal-title" data-copy="soundTitle"></h2>
      <p class="portal__copy" data-copy="soundCopy"></p>
      <button class="portal__yes btn btn--saffron" type="button" data-sound-choice="on"><span class="portal__yes-text"><span data-copy="yes"></span><small data-copy="recommended"></small></span>${ARROW}</button>
      <button class="portal__no" type="button" data-sound-choice="off" data-copy="no"></button>`, code);
    stage.querySelector('.portal__yes').focus({ preventScroll: true });
    stage.querySelectorAll('[data-sound-choice]').forEach((b) =>
      b.addEventListener('click', () => {
        // Within this tap, so the browser lets the audio start (and the film unlock).
        sound.set(b.dataset.soundChoice === 'on');
        soundGesture();
        if (sound.on) sound.chime();
        showLanguage(code);
      }),
    );
  };

  const showLanguage = (suggested) => {
    const current = getLang();
    const stage = swap(`
      <h2 class="portal__title" id="portal-title" data-copy="choose"></h2>
      <div class="portal__langs" role="group">
        ${LANGS.map(
          (l, i) => `
          <button class="lang-tile" type="button" data-pick="${l.code}" lang="${l.tag}" style="--i:${i}" ${mode === 'settings' && l.code === current ? 'aria-current="true"' : ''}>
            <span class="lang-tile__flag" aria-hidden="true">${flag(l.code)}</span>
            <span class="lang-tile__text"><strong>${l.name}</strong><small lang="en">${l.english}</small></span>
            <span class="lang-tile__count" aria-hidden="true"></span>
          </button>`,
        ).join('')}
      </div>
      <div class="portal__countdown" hidden>
        <p class="portal__status" role="status"></p>
        <button class="portal__pause" type="button"></button>
        <span class="portal__track" aria-hidden="true"><span></span></span>
      </div>`, mode === 'settings' ? current : suggested);
    const focusOn = stage.querySelector(`[data-pick="${mode === 'settings' ? current : suggested}"]`);
    focusOn?.focus({ preventScroll: true });
    stage.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('click', () => choose(b.dataset.pick)));
    if (mode === 'welcome') countdown = startCountdown(stage, suggested);
  };

  const startCountdown = (stage, code) => {
    const tile = stage.querySelector(`[data-pick="${code}"]`);
    const bar = stage.querySelector('.portal__countdown');
    const status = bar.querySelector('.portal__status');
    const toggle = bar.querySelector('.portal__pause');
    const track = bar.querySelector('.portal__track span');
    const words = copy(code);
    let remaining = COUNTDOWN;
    let paused = false;
    let previous = 0;
    let frame = 0;
    let lastSecond = 0;
    bar.hidden = false;
    bar.lang = langInfo(code).tag;
    tile.classList.add('is-suggested');
    tile.insertAdjacentHTML('beforeend', `<span class="lang-tile__badge">${words.device}</span>`);
    const render = () => {
      const s = Math.ceil(remaining / 1000);
      status.textContent = paused ? words.paused : words.auto.replace('{s}', s);
      toggle.textContent = paused ? words.resume : words.pause;
      toggle.setAttribute('aria-pressed', String(paused));
      tile.querySelector('.lang-tile__count').textContent = paused ? '' : s;
      stage.classList.toggle('is-paused', paused);
    };
    const tick = (time) => {
      if (!paused && !document.hidden && previous) remaining = Math.max(0, remaining - (time - previous));
      previous = time;
      tile.style.setProperty('--commit', `${360 * (1 - remaining / COUNTDOWN)}deg`);
      track.style.transform = `scaleX(${remaining / COUNTDOWN})`;
      const s = Math.ceil(remaining / 1000);
      if (s !== lastSecond) {
        lastSecond = s;
        render();
        if (!paused && s > 0) sound.tick();
      }
      if (remaining === 0) return choose(code);
      frame = requestAnimationFrame(tick);
    };
    const pause = () => {
      if (paused) return;
      paused = true;
      render();
    };
    toggle.addEventListener('click', () => {
      paused = !paused;
      previous = 0;
      render();
    });
    // Touching a language, or exploring with the keyboard, stops the clock.
    stage.querySelectorAll('[data-pick]').forEach((b) => b.addEventListener('pointerdown', pause));
    stage.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' || e.key.startsWith('Arrow')) pause();
    });
    render();
    frame = requestAnimationFrame(tick);
    return { stop: () => cancelAnimationFrame(frame) };
  };

  const choose = async (code) => {
    countdown?.stop();
    countdown = null;
    sound.chime();
    dialog.querySelectorAll('[data-pick]').forEach((b) => b.classList.toggle('is-chosen', b.dataset.pick === code));
    await setLang(code);
    close();
  };

  const close = () => {
    const welcome = mode === 'welcome';
    const finish = () => {
      dialog.close();
      dialog.remove();
      dialog = null;
      lenis?.start();
      document.body.style.overflow = '';
    };
    if (welcome) {
      try {
        sessionStorage.setItem('mai-entered', '1');
      } catch {}
      root.classList.remove('portal-pending');
      onEnter?.();
      resolveEntered();
      if (sound.on) sound.bowl({ freq: 220, gain: 0.07, pan: 0 });
    }
    if (reduceMotion) return finish();
    gsap.to(dialog.querySelector('.portal__inner'), { scale: 0.94, y: -20, autoAlpha: 0, filter: 'blur(10px)', duration: 0.7, ease: 'power2.in' });
    gsap.to(dialog, { autoAlpha: 0, duration: 1.1, delay: 0.35, ease: 'power2.inOut', onComplete: finish });
  };

  const open = (which) => {
    mode = which;
    if (!dialog) build();
    lenis?.stop();
    document.body.style.overflow = 'hidden';
    dialog.classList.toggle('is-settings', which === 'settings');
    dialog.querySelector('[data-portal-close]').hidden = which !== 'settings';
    if (!dialog.open) dialog.showModal();
    if (!reduceMotion) gsap.fromTo(dialog.querySelector('.portal__inner'), { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: 1.1, ease: 'expo.out' });
  };

  // Header: the language button reopens the language step; the speaker toggles sound.
  const trigger = document.querySelector('[data-lang-open]');
  const syncTrigger = () => {
    if (!trigger) return;
    const code = getLang();
    trigger.querySelector('[data-lang-flag]').innerHTML = flag(code);
    trigger.querySelector('[data-lang-code]').textContent = code.toUpperCase();
  };
  trigger?.addEventListener('click', () => {
    open('settings');
    showLanguage(getLang());
  });
  document.addEventListener('langchange', syncTrigger);
  syncTrigger();

  const speaker = document.querySelector('[data-sound-toggle]');
  const syncSpeaker = (on) => {
    if (!speaker) return;
    speaker.setAttribute('aria-pressed', String(on));
    const label = speaker.querySelector('[data-t]');
    label.dataset.t = on ? 'sound-off' : 'sound-on';
    label.textContent = t(label.dataset.t);
  };
  speaker?.addEventListener('click', () => {
    sound.set(!sound.on);
    soundGesture();
  });
  sound.onChange(syncSpeaker);
  document.addEventListener('langchange', () => syncSpeaker(sound.on));
  syncSpeaker(sound.on);

  if (!root.classList.contains('portal-pending')) {
    resolveEntered();
    return false;
  }
  const code = storedLang() ?? deviceLang();
  open('welcome');
  root.classList.remove('portal-pending');
  showSound(code);
  return true;
}
