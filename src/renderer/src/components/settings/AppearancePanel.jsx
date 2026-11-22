import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Moon, Sun, RotateCcw } from 'lucide-react';
import TectonDark from '../../../../../tecton_assets/tecton-tray-dark.svg';
import TectonLight from '../../../../../tecton_assets/tecton-tray-light.svg';
import { THEMES, buildAccentVariables, contrastRatio, resolveAccent } from '../../config/themes';
import { APP_ICONS } from '../../config/icons';
import { UI_LOCALES } from '../../config/languages';
import { ZOOM_MAX, ZOOM_MIN, clampZoom } from '../../theme/appearance';
import Switch from '../ui/Switch';

const MODES = [
  { id: 'dark', icon: Moon, labelKey: 'settings.theme_dark', fallback: 'Dark' },
  { id: 'light', icon: Sun, labelKey: 'settings.theme_light', fallback: 'Light' },
  { id: 'system', icon: Monitor, labelKey: 'settings.theme_system', fallback: 'System' },
];

const A11Y_TOGGLES = [
  { key: 'a11y_high_contrast', labelKey: 'settings.a11y_high_contrast', fallback: 'High contrast' },
  { key: 'a11y_enhanced_focus', labelKey: 'settings.a11y_enhanced_focus', fallback: 'Enhanced focus outlines' },
  { key: 'a11y_readable_spacing', labelKey: 'settings.a11y_readable_spacing', fallback: 'Readable spacing' },
  { key: 'a11y_reduce_motion', labelKey: 'settings.a11y_reduce_motion', fallback: 'Reduce motion' },
];

const ICON_LABELS = {
  auto: ['settings.icon_auto', 'Theme matched'],
  dark: ['settings.icon_dark', 'Dark'],
  light: ['settings.icon_light', 'Light'],
  contrast: ['settings.icon_contrast', 'High contrast'],
  custom: ['settings.icon_custom', 'Custom colour'],
};

function settingValue(settings, key, fallback) {
  const row = settings.find((item) => item.setting_key === key);
  return row ? row.setting_value : fallback;
}

/**
 * Settings > Appearance.
 *
 * Every control writes through `onChange` (the optimistic DB writer in
 * Settings.jsx), so the screen never keeps a value that failed to persist.
 * Preview always mirrors the live document so what the user sees is what is
 * applied.
 */
export default function AppearancePanel({ settings, onChange, surface = 'dark' }) {
  const { t } = useTranslation();
  const mode = settingValue(settings, 'theme', 'dark');
  const themeId = settingValue(settings, 'theme_id', 'obsidian');
  const customColor = settingValue(settings, 'custom_theme_color', '#8b5cf6');
  const appIcon = settingValue(settings, 'app_icon', 'auto');
  const zoom = clampZoom(settingValue(settings, 'ui_zoom', 1));

  const activeMode = mode === 'system' ? surface : mode;
  const logo = activeMode === 'light' ? TectonDark : TectonLight;

  const swatches = useMemo(
    () =>
      THEMES.map((theme) => {
        const accent = resolveAccent({ themeId: theme.id, customColor, surface: activeMode });
        return { ...theme, accent, selected: theme.id === themeId };
      }),
    [customColor, themeId, activeMode]
  );

  const set = (key, value) => {
    const row = settings.find((item) => item.setting_key === key);
    if (!row) return;
    onChange(row.id, key, String(value));
  };

  return (
    <>
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>
          {t('settings.theme_language', 'Appearance and language')}
        </h3>

        {/* Surface mode */}
        <div className="form-group">
          <label className="form-label">{t('settings.theme', 'Theme')}</label>
          <div className="segmented" role="group" aria-label={t('settings.theme', 'Theme')}>
            {MODES.map(({ id, icon: Icon, labelKey, fallback }) => (
              <button
                key={id}
                type="button"
                className={`segmented-item ${mode === id ? 'active' : ''}`}
                aria-pressed={mode === id}
                onClick={() => set('theme', id)}
              >
                <Icon size={16} />
                <span>{t(labelKey, fallback)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Accent palettes */}
        <div className="form-group">
          <label className="form-label">{t('settings.palette', 'Accent colour')}</label>
          <div className="theme-grid">
            {swatches.map((theme) => {
              const vars = buildAccentVariables(theme.accent, activeMode);
              const onAccent =
                contrastRatio(theme.accent, '#ffffff') >= contrastRatio(theme.accent, '#0b1120')
                  ? '#ffffff'
                  : '#0b1120';
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`theme-swatch ${theme.selected ? 'active' : ''}`}
                  aria-pressed={theme.selected}
                  title={theme.name}
                  onClick={() => set('theme_id', theme.id)}
                  style={{ '--swatch-accent': theme.accent, '--swatch-on-accent': onAccent, '--swatch-bg': vars['--accent-bg'] }}
                >
                  <span className="theme-swatch-chip">
                    <img src={logo} alt="" width="22" height="22" />
                  </span>
                  <span className="theme-swatch-name">{theme.id === 'custom' ? t('settings.custom_color', 'Custom') : theme.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {themeId === 'custom' && (
          <div className="form-group">
            <label className="form-label" htmlFor="custom-theme-color">
              {t('settings.custom_color', 'Custom colour')}
            </label>
            <div className="color-field">
              <input
                id="custom-theme-color"
                type="color"
                value={customColor}
                onChange={(event) => set('custom_theme_color', event.target.value)}
                aria-label={t('settings.custom_color', 'Custom colour')}
              />
              <input
                className="form-input"
                type="text"
                value={customColor}
                spellCheck={false}
                onChange={(event) => {
                  const value = event.target.value.trim();
                  if (/^#[0-9a-fA-F]{6}$/.test(value)) set('custom_theme_color', value);
                }}
                aria-describedby="custom-theme-hint"
              />
            </div>
            <p id="custom-theme-hint" className="form-hint">
              {t('settings.custom_color_hint', 'Enter a hex colour, for example #8b5cf6.')}
            </p>
          </div>
        )}

        {/* Language */}
        <div className="form-group">
          <label className="form-label" htmlFor="language-select">
            {t('settings.language', 'Language')}
          </label>
          <select
            id="language-select"
            className="form-input"
            value={settingValue(settings, 'language', 'tr')}
            onChange={(event) => set('language', event.target.value)}
          >
            {UI_LOCALES.map((locale) => (
              <option key={locale.code} value={locale.code}>
                {locale.nativeName} ({locale.code.toUpperCase()})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Application icon */}
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>
          {t('settings.app_icon', 'Application icon')}
        </h3>
        <div className="icon-grid">
          {APP_ICONS.map((icon) => {
            const [labelKey, fallback] = ICON_LABELS[icon.id] || ['settings.app_icon', 'Application icon'];
            const selected = appIcon === icon.id;
            const tinted = icon.accentDriven;
            const src = icon.id === 'light' ? TectonDark : TectonLight;
            return (
              <button
                key={icon.id}
                type="button"
                className={`icon-option ${selected ? 'active' : ''}`}
                aria-pressed={selected}
                onClick={() => set('app_icon', icon.id)}
              >
                <span
                  className={`icon-option-preview ${tinted ? 'tinted' : ''}`}
                  style={tinted ? { '--icon-tint': themeId === 'custom' ? customColor : resolveAccent({ themeId, customColor, surface: activeMode }) } : undefined}
                >
                  <img src={src} alt="" width="40" height="40" />
                </span>
                <span className="icon-option-label">{t(labelKey, fallback)}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Accessibility */}
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>
          {t('settings.accessibility', 'Accessibility')}
        </h3>
        <div className="form-group">
          <label className="form-label" htmlFor="ui-zoom">
            {t('settings.zoom', 'Interface zoom')} - {Math.round(zoom * 100)}%
          </label>
          <div className="zoom-row">
            <input
              id="ui-zoom"
              type="range"
              min={ZOOM_MIN * 100}
              max={ZOOM_MAX * 100}
              step="5"
              value={Math.round(zoom * 100)}
              onChange={(event) => set('ui_zoom', Number(event.target.value) / 100)}
            />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set('ui_zoom', '1')}>
              <RotateCcw size={14} /> {t('settings.zoom_reset', 'Reset')}
            </button>
          </div>
        </div>
        <div className="toggle-list">
          {A11Y_TOGGLES.map(({ key, labelKey, fallback }) => {
            const checked = settingValue(settings, key, 'false') === 'true';
            return (
              <label key={key} className="toggle-row">
                <span>{t(labelKey, fallback)}</span>
                <Switch
                  checked={checked}
                  label={t(labelKey, fallback)}
                  onChange={(event) => set(key, event.target.checked ? 'true' : 'false')}
                />
              </label>
            );
          })}
        </div>
      </div>
    </>
  );
}
