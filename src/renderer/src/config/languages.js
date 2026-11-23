/**
 * Language catalogue.
 *
 * Two distinct lists live here on purpose:
 *
 *  - `UI_LOCALES` are the languages that ship a complete dictionary in
 *    `src/renderer/src/locales/`. They are the only ones a user can pick in the
 *    app, which is what guarantees "zero translation leaks": a language that is
 *    offered always renders 100% in that language.
 *  - `INSTALLER_LANGUAGES` is the 73-language catalogue the Windows installer
 *    offers before the app exists. NSIS localises its own wizard strings for all
 *    of them; the chosen code is persisted and, when a matching UI dictionary
 *    exists, the app starts in it, otherwise it falls back to English.
 *
 * Keep `UI_LOCALES` in sync with the files in `locales/`; `npm run i18n:check`
 * fails the build when they drift apart.
 */

export const DEFAULT_LANGUAGE = 'en';
export const FALLBACK_LANGUAGE = 'en';

/** Languages with a complete, shipped renderer dictionary. */
export const UI_LOCALES = [
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish' },
  { code: 'en', nativeName: 'English', englishName: 'English' },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German' },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish' },
  { code: 'fr', nativeName: 'Français', englishName: 'French' },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian' },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese' },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch' },
  { code: 'pl', nativeName: 'Polski', englishName: 'Polish' },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian' },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese' },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean' },
  { code: 'zh', nativeName: '简体中文', englishName: 'Chinese (Simplified)' },
  { code: 'sv', nativeName: 'Svenska', englishName: 'Swedish' },
  { code: 'no', nativeName: 'Norsk', englishName: 'Norwegian' },
  { code: 'da', nativeName: 'Dansk', englishName: 'Danish' },
  { code: 'cs', nativeName: 'Čeština', englishName: 'Czech' },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', rtl: true },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi' },
];

/**
 * The 73 languages the installer can present. `lcid` is the Windows locale id
 * NSIS uses to select its own translations; `ui` marks languages that also have
 * a complete in-app dictionary.
 */
export const INSTALLER_LANGUAGES = [
  { code: 'tr', nativeName: 'Türkçe', englishName: 'Turkish', lcid: 1055 },
  { code: 'en', nativeName: 'English', englishName: 'English', lcid: 1033 },
  { code: 'de', nativeName: 'Deutsch', englishName: 'German', lcid: 1031 },
  { code: 'es', nativeName: 'Español', englishName: 'Spanish', lcid: 3082 },
  { code: 'fr', nativeName: 'Français', englishName: 'French', lcid: 1036 },
  { code: 'it', nativeName: 'Italiano', englishName: 'Italian', lcid: 1040 },
  { code: 'pt', nativeName: 'Português', englishName: 'Portuguese', lcid: 2070 },
  { code: 'nl', nativeName: 'Nederlands', englishName: 'Dutch', lcid: 1043 },
  { code: 'pl', nativeName: 'Polski', englishName: 'Polish', lcid: 1045 },
  { code: 'ru', nativeName: 'Русский', englishName: 'Russian', lcid: 1049 },
  { code: 'ja', nativeName: '日本語', englishName: 'Japanese', lcid: 1041 },
  { code: 'ko', nativeName: '한국어', englishName: 'Korean', lcid: 1042 },
  { code: 'zh', nativeName: '简体中文', englishName: 'Chinese (Simplified)', lcid: 2052 },
  { code: 'zh-tw', nativeName: '繁體中文', englishName: 'Chinese (Traditional)', lcid: 1028 },
  { code: 'sv', nativeName: 'Svenska', englishName: 'Swedish', lcid: 1053 },
  { code: 'ar', nativeName: 'العربية', englishName: 'Arabic', lcid: 1025, rtl: true },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', lcid: 1081 },
  { code: 'id', nativeName: 'Bahasa Indonesia', englishName: 'Indonesian', lcid: 1057 },
  { code: 'vi', nativeName: 'Tiếng Việt', englishName: 'Vietnamese', lcid: 1066 },
  { code: 'uk', nativeName: 'Українська', englishName: 'Ukrainian', lcid: 1058 },
  { code: 'el', nativeName: 'Ελληνικά', englishName: 'Greek', lcid: 1032 },
  { code: 'cs', nativeName: 'Čeština', englishName: 'Czech', lcid: 1029 },
  { code: 'da', nativeName: 'Dansk', englishName: 'Danish', lcid: 1030 },
  { code: 'fi', nativeName: 'Suomi', englishName: 'Finnish', lcid: 1035 },
  { code: 'no', nativeName: 'Norsk', englishName: 'Norwegian', lcid: 1044 },
  { code: 'hu', nativeName: 'Magyar', englishName: 'Hungarian', lcid: 1038 },
  { code: 'ro', nativeName: 'Română', englishName: 'Romanian', lcid: 1048 },
  { code: 'th', nativeName: 'ไทย', englishName: 'Thai', lcid: 1054 },
  { code: 'ms', nativeName: 'Bahasa Melayu', englishName: 'Malay', lcid: 1086 },
  { code: 'fil', nativeName: 'Filipino', englishName: 'Filipino', lcid: 1124 },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', lcid: 1093 },
  { code: 'he', nativeName: 'עברית', englishName: 'Hebrew', lcid: 1037, rtl: true },
  { code: 'fa', nativeName: 'فارسی', englishName: 'Persian', lcid: 1065, rtl: true },
  { code: 'ur', nativeName: 'اردو', englishName: 'Urdu', lcid: 1056, rtl: true },
  { code: 'az', nativeName: 'Azərbaycan dili', englishName: 'Azerbaijani', lcid: 2092 },
  { code: 'kk', nativeName: 'Қазақ тілі', englishName: 'Kazakh', lcid: 1087 },
  { code: 'uz', nativeName: 'Oʻzbekcha', englishName: 'Uzbek', lcid: 2115 },
  { code: 'bg', nativeName: 'Български', englishName: 'Bulgarian', lcid: 1026 },
  { code: 'sk', nativeName: 'Slovenčina', englishName: 'Slovak', lcid: 1051 },
  { code: 'hr', nativeName: 'Hrvatski', englishName: 'Croatian', lcid: 1050 },
  { code: 'et', nativeName: 'Eesti', englishName: 'Estonian', lcid: 1061 },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', lcid: 1097 },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', lcid: 1098 },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', lcid: 1102 },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', lcid: 1099 },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati', lcid: 1095 },
  { code: 'ml', nativeName: 'മലയാളം', englishName: 'Malayalam', lcid: 1100 },
  { code: 'pa', nativeName: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', lcid: 1094 },
  { code: 'lt', nativeName: 'Lietuvių', englishName: 'Lithuanian', lcid: 1063 },
  { code: 'lv', nativeName: 'Latviešu', englishName: 'Latvian', lcid: 1062 },
  { code: 'sr', nativeName: 'Srpski', englishName: 'Serbian', lcid: 3098 },
  { code: 'sl', nativeName: 'Slovenščina', englishName: 'Slovenian', lcid: 1060 },
  { code: 'bs', nativeName: 'Bosanski', englishName: 'Bosnian', lcid: 8218 },
  { code: 'sq', nativeName: 'Shqip', englishName: 'Albanian', lcid: 1052 },
  { code: 'mk', nativeName: 'Македонски', englishName: 'Macedonian', lcid: 1071 },
  { code: 'is', nativeName: 'Íslenska', englishName: 'Icelandic', lcid: 1039 },
  { code: 'sw', nativeName: 'Kiswahili', englishName: 'Swahili', lcid: 1089 },
  { code: 'am', nativeName: 'አማርኛ', englishName: 'Amharic', lcid: 1118 },
  { code: 'ha', nativeName: 'Hausa', englishName: 'Hausa', lcid: 1128 },
  { code: 'yo', nativeName: 'Yorùbá', englishName: 'Yoruba', lcid: 1130 },
  { code: 'af', nativeName: 'Afrikaans', englishName: 'Afrikaans', lcid: 1078 },
  { code: 'ka', nativeName: 'ქართული', englishName: 'Georgian', lcid: 1079 },
  { code: 'hy', nativeName: 'Հայերեն', englishName: 'Armenian', lcid: 1067 },
  { code: 'ky', nativeName: 'Кыргызча', englishName: 'Kyrgyz', lcid: 1088 },
  { code: 'tk', nativeName: 'Türkmençe', englishName: 'Turkmen', lcid: 1090 },
  { code: 'mn', nativeName: 'Монгол', englishName: 'Mongolian', lcid: 1104 },
  { code: 'ca', nativeName: 'Català', englishName: 'Catalan', lcid: 1027 },
  { code: 'eu', nativeName: 'Euskara', englishName: 'Basque', lcid: 1069 },
  { code: 'gl', nativeName: 'Galego', englishName: 'Galician', lcid: 1110 },
  { code: 'ga', nativeName: 'Gaeilge', englishName: 'Irish', lcid: 2108 },
  { code: 'my', nativeName: 'မြန်မာ', englishName: 'Burmese', lcid: 1109 },
  { code: 'km', nativeName: 'ខ្មែរ', englishName: 'Khmer', lcid: 1107 },
  { code: 'si', nativeName: 'සිංහල', englishName: 'Sinhala', lcid: 1115 },
];

const UI_CODES = new Set(UI_LOCALES.map((locale) => locale.code));
const RTL_CODES = new Set(UI_LOCALES.filter((locale) => locale.rtl).map((locale) => locale.code));

/**
 * True when a shipped dictionary can render this code.
 *
 * Unlike `normalizeLanguage`, this does not silently substitute English: a
 * caller that asks about `yo` needs to know the interface would fall back.
 */
export function hasUiDictionary(code) {
  const raw = String(code || '').trim().toLowerCase().replace('_', '-');
  if (!raw) return false;
  if (raw === 'zh-tw' || raw === 'zh-hk' || raw === 'zh-hant') return true;
  return UI_CODES.has(raw.split('-')[0]);
}

/** Reduces `de-DE`, `DE` and `de_DE` to `de`; unknown input becomes `en`. */
export function normalizeLanguage(value) {
  const raw = String(value || '').trim().toLowerCase().replace('_', '-');
  if (!raw) return FALLBACK_LANGUAGE;
  if (raw === 'zh-tw' || raw === 'zh-hk' || raw === 'zh-hant') return 'zh';
  const base = raw.split('-')[0];
  return UI_CODES.has(base) ? base : FALLBACK_LANGUAGE;
}

/** The language code the app should actually activate for a requested code. */
export function resolveUiLanguage(value) {
  const raw = String(value || '').trim().toLowerCase().replace('_', '-');
  if (raw === 'zh-tw' || raw === 'zh-hk' || raw === 'zh-hant') return 'zh';
  const base = raw.split('-')[0];
  return UI_CODES.has(base) ? base : FALLBACK_LANGUAGE;
}

export function isRtl(value) {
  return RTL_CODES.has(normalizeLanguage(value));
}

export function getLocaleOption(code) {
  const normalized = normalizeLanguage(code);
  return UI_LOCALES.find((locale) => locale.code === normalized) || UI_LOCALES[1];
}
