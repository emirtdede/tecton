/**
 * Regional formatting settings.
 *
 * Previously these lived only on `window.regionalSettings`, i.e. implicit global
 * mutable state read by every formatter. That made formatting order-dependent and
 * untestable. The module now owns the state and mirrors it onto `window` for
 * backward compatibility with any external code still reading it.
 */
const defaultRegionalSettings = {
  currency: 'auto',
  dateFormat: 'auto',
  timeFormat: 'auto',
  language: 'tr'
};

let regionalSettings = { ...defaultRegionalSettings };

export const setRegionalSettings = (next = {}) => {
  regionalSettings = { ...regionalSettings, ...next };
  if (typeof window !== 'undefined') {
    window.regionalSettings = regionalSettings;
  }
  return regionalSettings;
};

/**
 * Single source of truth for locale/currency per language.
 * Previously duplicated inside formatCurrency and formatCurrencySafe, which
 * meant adding a language required editing both (and they drifted in shape).
 */
const LOCALE_CURRENCY_MAP = {
  tr: { locale: 'tr-TR', currency: 'TRY' },
  en: { locale: 'en-US', currency: 'USD' },
  zh: { locale: 'zh-CN', currency: 'CNY' },
  es: { locale: 'es-ES', currency: 'EUR' },
  fr: { locale: 'fr-FR', currency: 'EUR' },
  de: { locale: 'de-DE', currency: 'EUR' },
  it: { locale: 'it-IT', currency: 'EUR' },
  nl: { locale: 'nl-NL', currency: 'EUR' },
  pt: { locale: 'pt-PT', currency: 'EUR' },
  ru: { locale: 'ru-RU', currency: 'RUB' },
  ja: { locale: 'ja-JP', currency: 'JPY' },
  ko: { locale: 'ko-KR', currency: 'KRW' },
  ar: { locale: 'ar-SA', currency: 'SAR' },
  hi: { locale: 'hi-IN', currency: 'INR' },
  sv: { locale: 'sv-SE', currency: 'SEK' },
  no: { locale: 'nb-NO', currency: 'NOK' },
  da: { locale: 'da-DK', currency: 'DKK' },
  pl: { locale: 'pl-PL', currency: 'PLN' },
  cs: { locale: 'cs-CZ', currency: 'CZK' }
};

const DEFAULT_LOCALE_CURRENCY = { locale: 'tr-TR', currency: 'TRY' };

/**
 * Resolves the effective currency, letting an explicit regional override win
 * over the language default.
 */
const resolveCurrency = (lang) => {
  const config = LOCALE_CURRENCY_MAP[lang] || DEFAULT_LOCALE_CURRENCY;
  if (regionalSettings.currency && regionalSettings.currency !== 'auto') {
    return { locale: config.locale, currency: regionalSettings.currency };
  }
  return config;
};

/**
 * Formats a number as a currency string based on the selected language.
 * @param {number} amount - The numeric value to format.
 * @param {string} lang - The language key (e.g., 'tr', 'en').
 * @returns {string} The formatted currency string.
 */
export const formatCurrency = (amount, lang = 'tr') => {
  const { locale, currency: selectedCurrency } = resolveCurrency(lang);

  const num = Number(amount) || 0;

  let formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: selectedCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(num);

  formatted = formatted.replace(/\u202F/g, ' ').replace(/\u00A0/g, ' ');

  if (selectedCurrency === 'TRY') {
    formatted = formatted.replace('₺', '').trim() + ' ₺';
  }

  return formatted;
};

/**
 * Formats a date string (YYYY-MM-DD or ISO string) based on regional settings.
 * @param {string|Date} dateVal - The date value to format.
 * @param {string} lang - Fallback language key (e.g., 'tr').
 * @returns {string} The formatted date string.
 */
export const formatDate = (dateVal, lang = 'tr') => {
  if (!dateVal) return '-';
  
  // Safe check for YYYY-MM-DD strings to prevent timezone shifts
  let d;
  if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
    const parts = dateVal.split('-');
    d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  } else {
    d = new Date(dateVal);
  }
  
  if (isNaN(d.getTime())) return String(dateVal);

  let formatMode = 'auto';
  if (regionalSettings.dateFormat) {
    formatMode = regionalSettings.dateFormat;
  }

  if (formatMode === 'auto') {
    const locales = {
      tr: 'tr-TR', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
      zh: 'zh-CN', ru: 'ru-RU', ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA',
      hi: 'hi-IN', it: 'it-IT', nl: 'nl-NL', pt: 'pt-PT', sv: 'sv-SE',
      no: 'nb-NO', da: 'da-DK', pl: 'pl-PL', cs: 'cs-CZ'
    };
    const loc = locales[lang] || 'tr-TR';
    return d.toLocaleDateString(loc);
  }

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();

  if (formatMode === 'DD.MM.YYYY') {
    return `${day}.${month}.${year}`;
  } else if (formatMode === 'YYYY-MM-DD') {
    return `${year}-${month}-${day}`;
  } else if (formatMode === 'MM/DD/YYYY') {
    return `${month}/${day}/${year}`;
  } else if (formatMode === 'DD/MM/YYYY') {
    return `${day}/${month}/${year}`;
  } else if (formatMode === 'DD-MM-YYYY') {
    return `${day}-${month}-${year}`;
  } else if (formatMode === 'YYYY/MM/DD') {
    return `${year}/${month}/${day}`;
  } else if (formatMode === 'YYYY.MM.DD') {
    return `${year}.${month}.${day}`;
  }

  return d.toLocaleDateString('tr-TR');
};

/**
 * Formats a time or date-time string to time based on regional settings.
 * @param {string|Date} dateTimeVal - The date-time value.
 * @param {string} lang - Fallback language.
 * @returns {string} Formatted time.
 */
export const formatTime = (dateTimeVal, lang = 'tr') => {
  if (!dateTimeVal) return '-';
  let d = new Date(dateTimeVal);
  if (isNaN(d.getTime())) {
    if (typeof dateTimeVal === 'string' && dateTimeVal.includes(':')) {
      const parts = dateTimeVal.split(':');
      const hours = parseInt(parts[0], 10);
      const minutes = parseInt(parts[1], 10);
      if (!isNaN(hours) && !isNaN(minutes)) {
        // `new Date('14:30')` is Invalid Date, and calling setHours() on an
        // invalid Date keeps it NaN - the user then saw the literal text
        // "Invalid Date" in the UI. A time-only value needs a real base date.
        d = new Date(1970, 0, 1, hours, minutes);
      } else {
        return dateTimeVal;
      }
    } else {
      return String(dateTimeVal);
    }
  }
  if (isNaN(d.getTime())) return String(dateTimeVal);

  let formatMode = 'auto';
  if (regionalSettings.timeFormat) {
    formatMode = regionalSettings.timeFormat;
  }

  if (formatMode === 'auto') {
    const locales = {
      tr: 'tr-TR', en: 'en-US', de: 'de-DE', fr: 'fr-FR', es: 'es-ES',
      zh: 'zh-CN', ru: 'ru-RU', ja: 'ja-JP', ko: 'ko-KR', ar: 'ar-SA',
      hi: 'hi-IN', it: 'it-IT', nl: 'nl-NL', pt: 'pt-PT', sv: 'sv-SE',
      no: 'nb-NO', da: 'da-DK', pl: 'pl-PL', cs: 'cs-CZ'
    };
    const loc = locales[lang] || 'tr-TR';
    return d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
  }

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');

  if (formatMode === '24h') {
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  } else if (formatMode === '12h') {
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  }

  return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
};

/**
 * Returns the active currency symbol based on system config or selected language.
 * @param {string} lang - Language code.
 * @returns {string} Currency symbol (e.g. '₺', '$', '€').
 */
export const getCurrencySymbol = (lang = 'tr') => {
  const { currency: selectedCurrency } = resolveCurrency(lang);

  const symbolMap = {
    TRY: '₺', USD: '$', EUR: '€', GBP: '£', CNY: '¥', JPY: '¥', KRW: '₩', RUB: '₽',
    SAR: 'SR', AED: 'د.إ', EGP: 'ج.م', INR: '₹', BRL: 'R$', SEK: 'kr', NOK: 'kr',
    DKK: 'kr', PLN: 'zł', CZK: 'Kč'
  };

  return symbolMap[selectedCurrency] || selectedCurrency;
};

/**
 * Formats a number securely for PDF outputs using pure numbers and explicit currency codes.
 * @param {number} amount - The amount to format.
 * @param {string} lang - The locale.
 * @returns {string} The formatted string e.g., "51.937,50 JPY"
 */
export const formatCurrencySafe = (amount, lang = 'tr') => {
  const { currency: selectedCurrency } = resolveCurrency(lang);

  if (amount === undefined || amount === null) return `0,00 ${selectedCurrency}`;
  
  const safeNumber = new Intl.NumberFormat('tr-TR', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  }).format(Number(amount) || 0);
  
  return `${safeNumber} ${selectedCurrency}`;
};

/**
 * Formats a Date as a local 'YYYY-MM-DD' string.
 *
 * `new Date(y, m, d).toISOString()` converts local midnight to UTC: in any
 * timezone east of UTC (e.g. UTC+3 Türkiye) `2026-11-01T00:00+03:00` becomes
 * `2026-10-31T21:00Z`, so `.split('T')[0]` returns `2026-10-31` - the previous
 * day. Every month-start/month-end default was one day early because of this.
 * Reading the local components directly is correct in every timezone.
 *
 * @param {Date} [date] defaults to now
 * @returns {string} e.g. '2026-11-21'
 */
export const toLocalDateString = (date = new Date()) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/** Today in the user's local timezone as 'YYYY-MM-DD'. */
export const localToday = () => toLocalDateString(new Date());

/**
 * Parses a 'YYYY-MM-DD' string as **local** midnight.
 *
 * `new Date('2026-11-01')` is UTC midnight, so `.getDate()` returns 31 in any
 * timezone west of UTC. Building the Date from parts keeps the calendar day the
 * user typed. Returns `null` when the string is not a plain ISO date.
 *
 * @param {string} value
 * @returns {Date|null}
 */
export const parseLocalDate = (value) => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  // Reject rollover input such as 2026-02-31.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
};

/**
 * Parses a 'YYYY-MM' string as the **first day** of that month at local midnight.
 * Used by the month-year date picker, whose stored value has no day part.
 * Returns `null` when the string is not a valid 'YYYY-MM'.
 *
 * @param {string} value
 * @returns {Date|null}
 */
export const parseLocalMonth = (value) => {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
};

/**
 * Converts a string to lowercase with Turkish characters support (İ/i, I/ı).
 * @param {string} str - The string to convert.
 * @returns {string} The lowercase string.
 */
export const trLower = (str) => {
  if (!str) return '';
  return String(str).replace(/İ/g, 'i').replace(/I/g, 'ı').toLowerCase();
};



