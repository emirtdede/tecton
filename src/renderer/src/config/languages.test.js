import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  INSTALLER_LANGUAGES,
  UI_LOCALES,
  hasUiDictionary,
  isRtl,
  normalizeLanguage,
  resolveUiLanguage,
} from '../config/languages.js';

/**
 * The language contract the installer and the interface both depend on:
 * 73 installer languages, 19 interface dictionaries, and a resolution rule
 * that never leaves the app in a language it cannot render.
 */
describe('language configuration', () => {
  it('offers 73 installer languages', () => {
    expect(INSTALLER_LANGUAGES).toHaveLength(73);
  });

  it('gives every installer language a unique code and a numeric LCID', () => {
    const codes = new Set();
    for (const language of INSTALLER_LANGUAGES) {
      expect(language.code).toMatch(/^[a-z]{2,3}(-[a-z]{2})?$/);
      expect(codes.has(language.code)).toBe(false);
      codes.add(language.code);
      expect(Number.isInteger(language.lcid)).toBe(true);
      expect(language.nativeName.length).toBeGreaterThan(1);
    }
    expect(codes.size).toBe(73);
  });

  it('gives every interface locale a dictionary entry', () => {
    expect(UI_LOCALES).toHaveLength(19);
    for (const locale of UI_LOCALES) {
      expect(locale.code).toMatch(/^[a-z]{2,3}(-[a-z]{2})?$/);
      expect(locale.nativeName.length).toBeGreaterThan(1);
      expect(locale.englishName.length).toBeGreaterThan(1);
    }
  });

  it('keeps every interface language among the installer languages', () => {
    const installerCodes = new Set(INSTALLER_LANGUAGES.map((language) => language.code));
    for (const locale of UI_LOCALES) {
      const covered = installerCodes.has(locale.code) || (locale.code === 'zh' && installerCodes.has('zh'));
      expect(covered, `${locale.code} is missing from INSTALLER_LANGUAGES`).toBe(true);
    }
  });

  it('defaults to English rather than the developer machine language', () => {
    expect(DEFAULT_LANGUAGE).toBe('en');
    expect(FALLBACK_LANGUAGE).toBe('en');
  });

  it('resolves regional variants to their base language', () => {
    expect(resolveUiLanguage('de-DE')).toBe('de');
    expect(resolveUiLanguage('de_AT')).toBe('de');
    expect(resolveUiLanguage('PT-br')).toBe('pt');
    expect(resolveUiLanguage('zh-Hant')).toBe('zh');
    expect(resolveUiLanguage('zh-TW')).toBe('zh');
  });

  it('falls back to English for an unsupported or empty language', () => {
    expect(resolveUiLanguage('')).toBe('en');
    expect(resolveUiLanguage(null)).toBe('en');
    expect(resolveUiLanguage('xx')).toBe('en');
    expect(normalizeLanguage('kl-GL')).toBe('en');
  });

  it('marks only the right-to-left dictionaries as RTL', () => {
    expect(isRtl('ar')).toBe(true);
    expect(isRtl('ar-SA')).toBe(true);
    // Hebrew, Persian and Urdu have no shipped dictionary, so the interface
    // renders in English and therefore stays left to right.
    expect(isRtl('he')).toBe(false);
    expect(isRtl('fa')).toBe(false);
    expect(isRtl('ur')).toBe(false);
    expect(isRtl('en')).toBe(false);
    expect(isRtl('tr')).toBe(false);
  });

  it('reports which codes have a shipped dictionary', () => {
    for (const locale of UI_LOCALES) {
      expect(hasUiDictionary(locale.code)).toBe(true);
    }
    expect(hasUiDictionary('yo')).toBe(false);
    expect(hasUiDictionary('de-DE')).toBe(true);
  });
});
