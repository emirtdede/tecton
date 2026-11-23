import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Command,
  DatabaseBackup,
  LayoutGrid,
  Monitor,
  Moon,
  Search,
  Sun,
  X,
} from 'lucide-react';
import TectonDark from '../../../../../tecton_assets/tecton-tray-dark.svg';
import TectonLight from '../../../../../tecton_assets/tecton-tray-light.svg';
import { UI_LOCALES } from '../../config/languages';
import { THEMES, buildAccentVariables, contrastRatio, resolveAccent } from '../../config/themes';
import { applyAppearance, cacheAppearance } from '../../theme/appearance';
import { ensureLocale } from '../../i18n';
import i18n from '../../i18n';

const STEPS = ['language', 'theme', 'welcome', 'tour'];

function readMap(rows) {
  const map = {};
  for (const row of rows || []) map[row.setting_key] = row.setting_value;
  return map;
}

/**
 * First-run wizard. Four independent steps keep the introduction digestible:
 * language, appearance, a short welcome, then a guided tour of the navigation.
 *
 * The wizard writes straight to `app_settings` and re-applies the appearance
 * engine after every choice, so closing it midway still leaves a consistent
 * configuration behind.
 */
export default function OnboardingWizard({ open, onClose }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || settings) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const rows = await window.api.db.read('app_settings');
        if (!cancelled) setSettings(readMap(rows));
      } catch {
        if (!cancelled) setSettings({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, settings]);

  const effective = settings || {};
  const mode = effective.theme || 'dark';
  const themeId = effective.theme_id || 'obsidian';
  const customColor = effective.custom_theme_color || 'var(--accent)';
  const surface = useMemo(() => {
    if (mode !== 'system') return mode === 'light' ? 'light' : 'dark';
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'dark';
    }
  }, [mode]);
  const logo = surface === 'light' ? TectonDark : TectonLight;

  const languages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return UI_LOCALES;
    return UI_LOCALES.filter(
      (locale) =>
        locale.nativeName.toLowerCase().includes(needle) ||
        locale.englishName.toLowerCase().includes(needle) ||
        locale.code.includes(needle)
    );
  }, [query]);

  const persist = async (key, value) => {
    const next = { ...effective, [key]: value };
    setSettings(next);
    try {
      const rows = await window.api.db.read('app_settings');
      const row = (rows || []).find((item) => item.setting_key === key);
      if (row) {
        await window.api.db.update('app_settings', row.id, { setting_value: String(value) });
      } else {
        await window.api.db.create('app_settings', {
          setting_key: key,
          setting_value: String(value),
          description: 'First-run wizard',
        });
      }
    } catch {
      // A failed write must not trap the user inside the wizard; the value is
      // still applied for this session and can be changed in Settings.
    }
    return next;
  };

  const applyFromMap = (map) => {
    const applied = applyAppearance({
      mode: map.theme || 'dark',
      themeId: map.theme_id || 'obsidian',
      customColor: map.custom_theme_color || 'var(--accent)',
      appIcon: map.app_icon || 'auto',
      iconColor: map.app_icon_color || 'var(--accent)',
      zoom: map.ui_zoom || 1,
      highContrast: map.a11y_high_contrast === 'true',
      enhancedFocus: map.a11y_enhanced_focus === 'true',
      readableSpacing: map.a11y_readable_spacing === 'true',
      reduceMotion: map.a11y_reduce_motion === 'true',
    });
    cacheAppearance(applied.appearance);
  };

  const chooseMode = async (value) => {
    const next = await persist('theme', value);
    applyFromMap(next);
  };

  const chooseTheme = async (value) => {
    const next = await persist('theme_id', value);
    applyFromMap(next);
  };

  const chooseColor = async (value) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(value)) return;
    const next = await persist('custom_theme_color', value);
    applyFromMap(next);
  };

  const chooseLanguage = async (code) => {
    setBusy(true);
    const active = await ensureLocale(code);
    await i18n.changeLanguage(active);
    await persist('language', active);
    setBusy(false);
  };

  const finish = async () => {
    setBusy(true);
    try {
      await persist('onboarding_completed', 'true');
      localStorage.setItem('hide_welcome_modal', 'true');
    } finally {
      setBusy(false);
      onClose();
    }
  };

  if (!open) return null;

  const total = STEPS.length;
  const isFirst = step === 0;
  const isLast = step === total - 1;

  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card">
        <div className="onboarding-top">
          <div className="onboarding-brand">
            <img src={logo} alt="" width="30" height="30" />
            <span>Tecton</span>
          </div>
          <button type="button" className="onboarding-close" onClick={finish} aria-label={t('onboarding.skip', 'Skip')}>
            <X size={18} />
          </button>
        </div>

        <div className="onboarding-progress" aria-label={t('onboarding.step_of', { current: step + 1, total, defaultValue: 'Step {{current}} of {{total}}' })}>
          {STEPS.map((id, index) => (
            <span key={id} className={`onboarding-dot ${index <= step ? 'done' : ''}`} aria-hidden="true" />
          ))}
        </div>

        <div className="onboarding-body">
          {step === 0 && (
            <section>
              <h1 id="onboarding-title" className="onboarding-title">
                {t('onboarding.step_language', 'Choose your language')}
              </h1>
              <p className="onboarding-desc">
                {t('onboarding.language_desc', 'Tecton will use this language across the entire interface.')}
              </p>
              <div className="onboarding-search">
                <Search size={16} />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t('common.search', 'Search')}
                  aria-label={t('common.search', 'Search')}
                />
              </div>
              <div className="onboarding-language-grid" role="listbox" aria-label={t('onboarding.step_language', 'Choose your language')}>
                {languages.map((locale) => (
                  <button
                    key={locale.code}
                    type="button"
                    role="option"
                    aria-selected={i18n.language === locale.code}
                    className={`onboarding-language ${i18n.language === locale.code ? 'active' : ''}`}
                    onClick={() => chooseLanguage(locale.code)}
                  >
                    <span className="onboarding-language-native">{locale.nativeName}</span>
                    <span className="onboarding-language-meta">{locale.englishName}</span>
                    {i18n.language === locale.code && <Check size={15} />}
                  </button>
                ))}
              </div>
            </section>
          )}

          {step === 1 && (
            <section>
              <h1 id="onboarding-title" className="onboarding-title">
                {t('onboarding.step_theme', 'Make it yours')}
              </h1>
              <p className="onboarding-desc">
                {t('onboarding.theme_desc', 'Pick a surface and an accent colour. You can change this later in Settings.')}
              </p>
              <div className="onboarding-segmented" role="group">
                {[
                  { id: 'dark', icon: Moon, key: 'settings.theme_dark', fallback: 'Dark' },
                  { id: 'light', icon: Sun, key: 'settings.theme_light', fallback: 'Light' },
                  { id: 'system', icon: Monitor, key: 'settings.theme_system', fallback: 'System' },
                ].map(({ id, icon: Icon, key, fallback }) => (
                  <button
                    key={id}
                    type="button"
                    className={`onboarding-segment ${mode === id ? 'active' : ''}`}
                    aria-pressed={mode === id}
                    onClick={() => chooseMode(id)}
                  >
                    <Icon size={16} />
                    <span>{t(key, fallback)}</span>
                  </button>
                ))}
              </div>

              <div className="onboarding-theme-grid">
                {THEMES.map((theme) => {
                  const accent = resolveAccent({ themeId: theme.id, customColor, surface });
                  const onAccent =
                    contrastRatio(accent, '#ffffff') >= contrastRatio(accent, '#0b1120') ? '#ffffff' : '#0b1120';
                  const vars = buildAccentVariables(accent, surface);
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      className={`onboarding-theme ${themeId === theme.id ? 'active' : ''}`}
                      aria-pressed={themeId === theme.id}
                      style={{ '--swatch-accent': accent, '--swatch-on-accent': onAccent, '--swatch-bg': vars['--accent-bg'] }}
                      onClick={() => chooseTheme(theme.id)}
                      title={theme.name}
                    >
                      <span className="onboarding-theme-chip">
                        <img src={logo} alt="" width="20" height="20" />
                      </span>
                      <span>{theme.id === 'custom' ? t('settings.custom_color', 'Custom') : theme.name}</span>
                    </button>
                  );
                })}
              </div>

              {themeId === 'custom' && (
                <div className="onboarding-color">
                  <input
                    type="color"
                    value={customColor}
                    onChange={(event) => chooseColor(event.target.value)}
                    aria-label={t('settings.custom_color', 'Custom colour')}
                  />
                  <input
                    type="text"
                    className="form-input"
                    value={customColor}
                    spellCheck={false}
                    onChange={(event) => chooseColor(event.target.value.trim())}
                    aria-label={t('settings.custom_color', 'Custom colour')}
                  />
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="onboarding-center">
              <img src={logo} alt="Tecton" width="72" height="72" className="onboarding-hero-logo" />
              <h1 id="onboarding-title" className="onboarding-title">
                {t('onboarding.welcome_title', 'Welcome to Tecton')}
              </h1>
              <p className="onboarding-desc onboarding-desc-wide">
                {t(
                  'onboarding.welcome_desc',
                  'The construction site operating system that keeps people, payroll, materials and cash in one place.'
                )}
              </p>
              <div className="onboarding-highlights">
                <span><Check size={14} /> {t('welcome.infra_feature', 'Site operations')}</span>
                <span><Check size={14} /> {t('welcome.finance_feature', 'Finance')}</span>
                <span><Check size={14} /> {t('welcome.database_feature', 'Automatic backups')}</span>
              </div>
            </section>
          )}

          {step === 3 && (
            <section>
              <h1 id="onboarding-title" className="onboarding-title">
                {t('onboarding.step_tour', 'A quick tour')}
              </h1>
              <div className="onboarding-tour">
                <div className="onboarding-tour-item">
                  <span className="onboarding-tour-icon"><LayoutGrid size={20} /></span>
                  <div>
                    <strong>{t('onboarding.tour_nav_title', 'Two-level navigation')}</strong>
                    <p>{t('onboarding.tour_nav', 'The left rail groups every module: sites, people, operations, finance and system.')}</p>
                  </div>
                </div>
                <div className="onboarding-tour-item">
                  <span className="onboarding-tour-icon"><Command size={20} /></span>
                  <div>
                    <strong>{t('onboarding.tour_spotlight_title', 'Global search')}</strong>
                    <p>{t('onboarding.tour_spotlight', 'Press Ctrl + K anywhere to jump to any page.')}</p>
                  </div>
                </div>
                <div className="onboarding-tour-item">
                  <span className="onboarding-tour-icon"><DatabaseBackup size={20} /></span>
                  <div>
                    <strong>{t('onboarding.tour_backup_title', 'Automatic backup')}</strong>
                    <p>{t('onboarding.tour_backup', 'Your data is backed up automatically, locally and to your cloud folder.')}</p>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>

        <div className="onboarding-footer">
          <button type="button" className="btn btn-ghost" onClick={() => (isFirst ? finish() : setStep(step - 1))}>
            {isFirst ? t('onboarding.skip', 'Skip') : <><ArrowLeft size={15} /> {t('onboarding.back', 'Back')}</>}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => (isLast ? finish() : setStep(step + 1))}
          >
            {isLast ? t('onboarding.start', 'Start using Tecton') : <>{t('onboarding.next', 'Continue')} <ArrowRight size={15} /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
