/**
 * Application icon catalogue.
 *
 * The icon the user picks here is the single source for the window icon, the
 * taskbar entry, the tray icon, the desktop shortcut and the installed Start
 * menu shortcut. The main process owns the actual `.ico` files; this module only
 * describes the choice so the renderer and the main process agree on ids.
 */

export const DEFAULT_APP_ICON = 'auto';

export const APP_ICONS = [
  {
    id: 'auto',
    labelKey: 'settings.icon_auto',
    label: 'Theme matched',
    descriptionKey: 'settings.icon_auto_desc',
    description: 'Follows the active accent colour.',
    accentDriven: true,
  },
  {
    id: 'dark',
    labelKey: 'settings.icon_dark',
    label: 'Dark',
    descriptionKey: 'settings.icon_dark_desc',
    description: 'Dark badge with a steel monogram.',
    accentDriven: false,
  },
  {
    id: 'light',
    labelKey: 'settings.icon_light',
    label: 'Light',
    descriptionKey: 'settings.icon_light_desc',
    description: 'Light badge for bright desktops.',
    accentDriven: false,
  },
  {
    id: 'contrast',
    labelKey: 'settings.icon_contrast',
    label: 'High contrast',
    descriptionKey: 'settings.icon_contrast_desc',
    description: 'Maximum legibility at 16 px.',
    accentDriven: false,
  },
  {
    id: 'custom',
    labelKey: 'settings.icon_custom',
    label: 'Custom colour',
    descriptionKey: 'settings.icon_custom_desc',
    description: 'Tinted with the colour you choose.',
    accentDriven: true,
  },
];

export const APP_ICON_IDS = APP_ICONS.map((icon) => icon.id);

export function isAppIconId(value) {
  return APP_ICON_IDS.includes(String(value || ''));
}

export function normalizeAppIcon(value) {
  return isAppIconId(value) ? String(value) : DEFAULT_APP_ICON;
}
