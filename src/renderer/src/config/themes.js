/**
 * Theme catalogue and colour maths.
 *
 * The app ships two surfaces (dark/light, defined in `index.css`) and a palette
 * of accent colours. Rather than duplicating every surface variable for every
 * palette, the accent is applied at runtime by writing a small set of CSS
 * variables derived from the chosen colour. That keeps `index.css` as the single
 * definition of layout and surface styling, and makes an arbitrary user colour
 * ("custom") behave exactly like a built-in theme.
 */

export const DEFAULT_MODE = 'dark';
export const DEFAULT_THEME_ID = 'obsidian';
export const DEFAULT_CUSTOM_COLOR = '#8b5cf6';

export const UI_MODES = ['dark', 'light', 'system'];

/** 14 built-in palettes, each with a light-surface and dark-surface accent. */
export const THEMES = [
  { id: 'obsidian', name: 'Obsidian', dark: '#a78bfa', light: '#7c3aed' },
  { id: 'slate', name: 'Slate', dark: '#94a3b8', light: '#475569' },
  { id: 'navy', name: 'Navy', dark: '#5b8def', light: '#1e3a8a' },
  { id: 'blue', name: 'Blue', dark: '#3b82f6', light: '#2563eb' },
  { id: 'cyan', name: 'Cyan', dark: '#22d3ee', light: '#0891b2' },
  { id: 'indigo', name: 'Indigo', dark: '#818cf8', light: '#4f46e5' },
  { id: 'purple', name: 'Purple', dark: '#c084fc', light: '#9333ea' },
  { id: 'pink', name: 'Pink', dark: '#f472b6', light: '#db2777' },
  { id: 'red', name: 'Red', dark: '#f87171', light: '#dc2626' },
  { id: 'orange', name: 'Orange', dark: '#fb923c', light: '#ea580c' },
  { id: 'yellow', name: 'Yellow', dark: '#facc15', light: '#ca8a04' },
  { id: 'emerald', name: 'Emerald', dark: '#34d399', light: '#059669' },
  { id: 'grass', name: 'Grass', dark: '#4ade80', light: '#16a34a' },
  { id: 'lime', name: 'Lime', dark: '#a3e635', light: '#65a30d' },
  { id: 'custom', name: 'Custom', dark: DEFAULT_CUSTOM_COLOR, light: DEFAULT_CUSTOM_COLOR },
];

export const THEME_IDS = THEMES.map((theme) => theme.id);
const THEME_BY_ID = new Map(THEMES.map((theme) => [theme.id, theme]));

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHex(value) {
  return HEX_RE.test(String(value || ''));
}

export function normalizeHex(value, fallback = DEFAULT_CUSTOM_COLOR) {
  if (!isValidHex(value)) return fallback;
  return String(value).toLowerCase();
}

export function isThemeId(value) {
  return THEME_BY_ID.has(String(value || ''));
}

export function isUiMode(value) {
  return UI_MODES.includes(String(value || ''));
}

/**
 * Resolves `system` to the surface the OS currently asks for. Pure so it can be
 * unit-tested; the caller supplies the media query result.
 */
export function resolveMode(mode, prefersDark = true) {
  const safe = isUiMode(mode) ? mode : DEFAULT_MODE;
  if (safe === 'system') return prefersDark ? 'dark' : 'light';
  return safe;
}

/**
 * The accent for a palette on a given surface. Custom colours ignore the
 * surface-specific table and are used verbatim, lightened slightly on dark
 * surfaces when they are too dark to read.
 */
export function resolveAccent({ themeId = DEFAULT_THEME_ID, customColor = DEFAULT_CUSTOM_COLOR, surface = 'dark' } = {}) {
  const theme = THEME_BY_ID.get(themeId) || THEME_BY_ID.get(DEFAULT_THEME_ID);
  if (theme.id === 'custom') {
    const hex = normalizeHex(customColor);
    if (surface === 'dark' && relativeLuminance(hex) < 0.18) return mix(hex, '#ffffff', 0.35);
    return hex;
  }
  return theme[surface === 'light' ? 'light' : 'dark'];
}

function channel(value) {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

export function hexToRgb(hex) {
  const value = normalizeHex(hex).slice(1);
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  };
}

export function rgbToHex({ r, g, b }) {
  const clamp = (n) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** WCAG relative luminance, 0 (black) .. 1 (white). */
export function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colours. */
export function contrastRatio(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Mixes `hex` towards `target` by `amount` (0..1). */
export function mix(hex, target, amount) {
  const a = hexToRgb(hex);
  const b = hexToRgb(target);
  const t = Math.max(0, Math.min(1, amount));
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
  });
}

function rgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Builds the CSS custom properties for an accent on a surface. `contrastRatio`
 * against the surface background decides whether accent labels use dark or
 * light text, so a yellow theme stays readable instead of turning into
 * white-on-yellow.
 */
export function buildAccentVariables(accent, surface = 'dark') {
  const base = normalizeHex(accent);
  const hover = surface === 'dark' ? mix(base, '#ffffff', 0.18) : mix(base, '#000000', 0.16);
  // `--accent-text` is the foreground used *on top of* the accent fill, so pick
  // whichever of white/near-black reads better against that exact colour.
  const onAccent =
    contrastRatio(base, '#ffffff') >= contrastRatio(base, '#0b1120') ? '#ffffff' : '#0b1120';
  return {
    '--accent': base,
    '--accent-hover': hover,
    '--accent-text': onAccent,
    '--accent-bg': rgba(base, surface === 'dark' ? 0.14 : 0.1),
    '--accent-bg-hover': rgba(base, surface === 'dark' ? 0.24 : 0.18),
    '--accent-border': rgba(base, surface === 'dark' ? 0.38 : 0.3),
    '--primary': base,
    '--primary-hover': hover,
    '--secondary': mix(base, surface === 'dark' ? '#38bdf8' : '#2563eb', 0.5),
    '--shadow-glow': `0 0 30px ${rgba(base, surface === 'dark' ? 0.22 : 0.18)}`,
    '--input-focus-border': base,
    '--input-focus-shadow': `0 0 0 3px ${rgba(base, 0.18)}`,
  };
}

/** Serializable description of the active appearance. */
export function describeAppearance({ mode, themeId, customColor, prefersDark = true }) {
  const surface = resolveMode(mode, prefersDark);
  const accent = resolveAccent({ themeId, customColor, surface });
  return { surface, accent, themeId: isThemeId(themeId) ? themeId : DEFAULT_THEME_ID };
}
