/**
 * Runtime appearance engine.
 *
 * Applies the theme, accent colour, zoom level and accessibility preferences to
 * the document. The values are cached in `localStorage` so the very first paint
 * already uses the user's colours (no dark-to-light flash), while the database
 * row in `app_settings` remains the source of truth across machines and backups.
 */

import {
  DEFAULT_CUSTOM_COLOR,
  DEFAULT_MODE,
  DEFAULT_THEME_ID,
  buildAccentVariables,
  describeAppearance,
  isValidHex,
  isThemeId,
  isUiMode,
  normalizeHex,
  resolveMode,
} from '../config/themes';
import { DEFAULT_APP_ICON, normalizeAppIcon } from '../config/icons';

export const APPEARANCE_STORAGE_KEY = 'tecton.appearance';
export const ZOOM_MIN = 0.8;
export const ZOOM_MAX = 1.6;

export const DEFAULT_APPEARANCE = Object.freeze({
  mode: DEFAULT_MODE,
  themeId: DEFAULT_THEME_ID,
  customColor: DEFAULT_CUSTOM_COLOR,
  appIcon: DEFAULT_APP_ICON,
  iconColor: DEFAULT_CUSTOM_COLOR,
  zoom: 1,
  highContrast: false,
  enhancedFocus: false,
  readableSpacing: false,
  reduceMotion: false,
});

export function clampZoom(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(numeric * 100) / 100));
}

/** Coerces any persisted shape (DB strings, partial objects) into a safe one. */
export function normalizeAppearance(input = {}) {
  const record = input && typeof input === 'object' ? input : {};
  return {
    mode: isUiMode(record.mode) ? record.mode : DEFAULT_APPEARANCE.mode,
    themeId: isThemeId(record.themeId) ? record.themeId : DEFAULT_APPEARANCE.themeId,
    customColor: isValidHex(record.customColor)
      ? normalizeHex(record.customColor)
      : DEFAULT_APPEARANCE.customColor,
    appIcon: normalizeAppIcon(record.appIcon),
    iconColor: isValidHex(record.iconColor)
      ? normalizeHex(record.iconColor)
      : DEFAULT_APPEARANCE.iconColor,
    zoom: clampZoom(record.zoom ?? 1),
    highContrast: record.highContrast === true || record.highContrast === 'true',
    enhancedFocus: record.enhancedFocus === true || record.enhancedFocus === 'true',
    readableSpacing: record.readableSpacing === true || record.readableSpacing === 'true',
    reduceMotion: record.reduceMotion === true || record.reduceMotion === 'true',
  };
}

export function loadCachedAppearance() {
  try {
    const raw = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE };
    return normalizeAppearance(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function cacheAppearance(appearance) {
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, JSON.stringify(normalizeAppearance(appearance)));
  } catch {
    // Private mode / quota: the in-memory value still applies for this session.
  }
}

export function systemPrefersDark() {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

const STYLE_ELEMENT_ID = 'tecton-dynamic-theme';

function ensureStyleElement() {
  let style = document.getElementById(STYLE_ELEMENT_ID);
  if (!style) {
    style = document.createElement('style');
    style.id = STYLE_ELEMENT_ID;
    style.dataset.tecton = 'dynamic-theme';
    document.head.appendChild(style);
  }
  return style;
}

function readZoomBridge() {
  try {
    return window.api?.window?.setZoom;
  } catch {
    return undefined;
  }
}

/**
 * Writes the appearance to the DOM and returns the resolved description
 * (`surface`, `accent`, `themeId`) so callers can react to what was applied.
 */
export function applyAppearance(input, { prefersDark = systemPrefersDark() } = {}) {
  const appearance = normalizeAppearance(input);
  const root = document.documentElement;
  const { surface, accent, themeId } = describeAppearance({
    mode: appearance.mode,
    themeId: appearance.themeId,
    customColor: appearance.customColor,
    prefersDark,
  });

  root.setAttribute('data-theme', surface);
  root.setAttribute('data-theme-id', themeId);
  root.setAttribute('data-app-icon', appearance.appIcon);
  root.setAttribute('lang', appearance.language || root.getAttribute('lang') || 'tr');

  const variables = buildAccentVariables(accent, surface);
  const css = `:root {${Object.entries(variables)
    .map(([name, value]) => `${name}: ${value};`)
    .join('')}}`;
  ensureStyleElement().textContent = css;

  root.classList.toggle('a11y-high-contrast', appearance.highContrast);
  root.classList.toggle('a11y-enhanced-focus', appearance.enhancedFocus);
  root.classList.toggle('a11y-readable-spacing', appearance.readableSpacing);
  root.classList.toggle('a11y-reduce-motion', appearance.reduceMotion);

  const setZoom = readZoomBridge();
  if (setZoom) {
    setZoom(appearance.zoom).catch(() => {});
  } else {
    root.style.zoom = String(appearance.zoom);
  }

  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', surface === 'dark' ? '#090d16' : '#edf2fb');

  return { surface, accent, themeId, appearance };
}

/** Applies immediately from cache, then re-applies when the OS theme flips. */
let systemThemeWatched = false;

export function bootstrapAppearance() {
  const cached = loadCachedAppearance();
  applyAppearance(cached);

  // The listener lives for the whole renderer lifetime, so registering it twice
  // (a second bootstrap after a remount) would apply the appearance twice on
  // every OS theme flip. One watcher is enough.
  if (typeof window.matchMedia === 'function' && !systemThemeWatched) {
    systemThemeWatched = true;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const current = loadCachedAppearance();
      if (current.mode === 'system') applyAppearance(current);
    };
    if (typeof query.addEventListener === 'function') query.addEventListener('change', onChange);
    else if (typeof query.addListener === 'function') query.addListener(onChange);
  }

  return cached;
}

export { resolveMode };
