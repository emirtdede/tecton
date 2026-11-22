import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  UI_LOCALES,
  isRtl,
  resolveUiLanguage,
} from './config/languages';

// Turkish is the default language and English is the fallback, so both ship in
// the main bundle. The other 17 locales are ~1.2 MB of JSON combined and used to
// be imported eagerly too: every user downloaded all 19 dictionaries on launch
// even though they read exactly one. They are now loaded on demand by
// `ensureLocale()` and added to i18next at switch time.
import translationTR from './locales/tr.json';
import translationEN from './locales/en.json';

// The map is explicit because Vite needs statically analysable dynamic imports.
// `npm run i18n:check` fails if this map and `UI_LOCALES` drift apart.
const lazyLocales = {
  ar: () => import('./locales/ar.json'),
  cs: () => import('./locales/cs.json'),
  da: () => import('./locales/da.json'),
  de: () => import('./locales/de.json'),
  es: () => import('./locales/es.json'),
  fr: () => import('./locales/fr.json'),
  hi: () => import('./locales/hi.json'),
  it: () => import('./locales/it.json'),
  ja: () => import('./locales/ja.json'),
  ko: () => import('./locales/ko.json'),
  nl: () => import('./locales/nl.json'),
  no: () => import('./locales/no.json'),
  pl: () => import('./locales/pl.json'),
  pt: () => import('./locales/pt.json'),
  ru: () => import('./locales/ru.json'),
  sv: () => import('./locales/sv.json'),
  zh: () => import('./locales/zh.json'),
};

i18n.use(initReactI18next).init({
  resources: {
    tr: { translation: translationTR },
    en: { translation: translationEN },
  },
  lng: DEFAULT_LANGUAGE,
  fallbackLng: FALLBACK_LANGUAGE,
  supportedLngs: UI_LOCALES.map((locale) => locale.code),
  interpolation: {
    escapeValue: false,
  },
});

/**
 * Mirrors the active language onto the document so the browser (and CSS) know
 * whether the interface is right-to-left.
 */
export function applyDocumentLanguage(lang) {
  const code = resolveUiLanguage(lang);
  if (typeof document === 'undefined') return code;
  document.documentElement.setAttribute('lang', code);
  document.documentElement.setAttribute('dir', isRtl(code) ? 'rtl' : 'ltr');
  return code;
}

/**
 * Ensures a locale's dictionary is loaded before it is activated.
 *
 * `i18n.changeLanguage('de')` on its own would switch to a bundle that does not
 * exist yet, so the UI would fall back to English until reload. This loads and
 * registers the dictionary first, and returns the language code that is actually
 * usable (falling back to English for an unknown locale or a failed chunk load).
 *
 * @param {string} lang language code, e.g. "de" or "de-DE"
 * @returns {Promise<string>} the language code that is now active-ready
 */
export async function ensureLocale(lang) {
  const code = resolveUiLanguage(lang);
  if (!code) return FALLBACK_LANGUAGE;

  if (!i18n.hasResourceBundle(code, 'translation')) {
    const loader = lazyLocales[code];
    if (loader) {
      try {
        const mod = await loader();
        const bundle = mod && mod.default ? mod.default : mod;
        // deep=true, overwrite=true: register the full nested dictionary.
        i18n.addResourceBundle(code, 'translation', bundle, true, true);
      } catch {
        // A failed dynamic chunk (offline, corrupted cache) must not break
        // language switching: English is always bundled.
        applyDocumentLanguage(FALLBACK_LANGUAGE);
        return FALLBACK_LANGUAGE;
      }
    }
  }

  applyDocumentLanguage(code);
  return code;
}

applyDocumentLanguage(DEFAULT_LANGUAGE);

export default i18n;
