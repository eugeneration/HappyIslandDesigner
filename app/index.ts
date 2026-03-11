import { install } from './install';
import { zoom } from './paper-zoom';
import { drawer } from './drawer';
import './settings';
import './index.scss';
import { trackSessionStart, initAnalytics } from './analytics';

import browserUpdate from 'browser-update';
import i18next from 'i18next';
import en from './locales/en';

browserUpdate({required:{i:79,f:45,o:45,s:-2,c:60},insecure:true,api:2020.03});

const SUPPORTED_LANGS = ['en', 'zh-CN', 'zh-TW', 'es-ES', 'ja', 'ko', 'fr', 'de'];

function detectLanguage(): string {
  const browserLang = navigator.language;
  if (SUPPORTED_LANGS.includes(browserLang)) return browserLang;
  // Try base language (e.g. 'zh' → 'zh-CN', 'es' → 'es-ES')
  const base = browserLang.split('-')[0];
  return SUPPORTED_LANGS.find(l => l.startsWith(base)) || 'en';
}

const detectedLng = detectLanguage();

i18next.init({
  lng: detectedLng,
  fallbackLng: 'en',
  resources: { en: { translation: en } },
});

// Load non-English bundle if needed
if (detectedLng !== 'en') {
  import(/* webpackChunkName: "locale-[request]" */ `./locales/${detectedLng}`).then(mod => {
    i18next.addResourceBundle(detectedLng, 'translation', mod.default);
  });
}

/*eslint-disable */
(async () => {
  await install();
  drawer();
  zoom();

  const navEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
  const isRefresh = navEntry?.type === 'reload';
  const hasAutosave = !!(localStorage && localStorage.getItem('autosave'));
  const loadTimeMs = Math.round(performance.now());
  trackSessionStart(isRefresh, hasAutosave, i18next.language, loadTimeMs);
  initAnalytics();
  const skeleton = document.getElementById('loading-skeleton');
  if (skeleton) {
    const dots = skeleton.querySelector('.skeleton-dots') as HTMLElement;
    if (dots) {
      dots.style.animation = 'fadeout 0.25s ease forwards';
    }
    skeleton.classList.add('fade-out');
    skeleton.addEventListener('animationend', (e) => {
      if (e.target === skeleton) skeleton.remove();
    });
  }
  if (__DEV__) {
    const { initDevTools } = await import(/* webpackChunkName: "devTools" */ './ui/devTools');
    initDevTools();
  }
})();
/*eslint-enable */
