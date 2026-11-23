#!/usr/bin/env node
/**
 * check-i18n.js
 *
 * Dictionary gate. Fails (exit 1) when:
 *
 *   - a shipped locale is missing from `UI_LOCALES` or vice versa;
 *   - two dictionaries do not have the same flat key set as the reference (en);
 *   - a translation is an empty string;
 *   - a `{placeholder}` present in the reference is missing from a translation.
 *
 * Dictionaries are nested JSON; they are flattened to dot path keys before
 * comparison so `settings.title` and `projects.title` are distinct keys.
 *
 * A language is only listed in the in-app picker when it has a complete
 * dictionary, so passing this gate is what guarantees "no English leaks".
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'src', 'renderer', 'src', 'locales');
const REFERENCE = 'en';

function readLanguages() {
  const source = fs.readFileSync(path.join(ROOT, 'src', 'renderer', 'src', 'config', 'languages.js'), 'utf8');
  const block = source.match(/export const UI_LOCALES = \[([\s\S]*?)\];/);
  if (!block) throw new Error('UI_LOCALES not found in config/languages.js');
  return [...block[1].matchAll(/code:\s*'([^']+)'/g)].map((m) => m[1]);
}

/** Flattens `{ a: { b: 'x' } }` to `{ 'a.b': 'x' }`. Arrays are joined by index. */
function flatten(value, prefix = '', out = {}) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, child] of Object.entries(value)) {
      flatten(child, prefix ? `${prefix}.${key}` : key, out);
    }
    return out;
  }
  out[prefix] = value;
  return out;
}

function placeholders(value) {
  return [...String(value).matchAll(/\{([a-zA-Z0-9_]+)\}/g)].map((m) => m[1]).sort();
}

function check() {
  const errors = [];
  const languages = readLanguages();
  const files = fs
    .readdirSync(DIR)
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -5))
    .sort();

  const missingFiles = languages.filter((code) => !files.includes(code));
  const extraFiles = files.filter((code) => !languages.includes(code));
  if (missingFiles.length) errors.push(`missing dictionary file(s): ${missingFiles.join(', ')}`);
  if (extraFiles.length) errors.push(`dictionary without UI_LOCALES entry: ${extraFiles.join(', ')}`);

  const dictionaries = {};
  for (const code of languages) {
    const file = path.join(DIR, `${code}.json`);
    if (!fs.existsSync(file)) continue;
    const raw = fs.readFileSync(file, 'utf8');
    try {
      dictionaries[code] = flatten(JSON.parse(raw));
    } catch (err) {
      errors.push(`${code}.json: invalid JSON (${err.message})`);
    }
  }

  const reference = dictionaries[REFERENCE] || {};
  const referenceKeys = Object.keys(reference).sort();
  if (referenceKeys.length === 0) errors.push(`${REFERENCE}.json is empty`);

  for (const code of languages) {
    const dict = dictionaries[code];
    if (!dict) continue;
    const keys = Object.keys(dict);
    const missing = referenceKeys.filter((key) => !(key in dict));
    const extra = keys.filter((key) => !(key in reference));
    if (missing.length) errors.push(`${code}: ${missing.length} missing key(s), e.g. ${missing.slice(0, 6).join(', ')}`);
    if (extra.length) errors.push(`${code}: ${extra.length} unexpected key(s), e.g. ${extra.slice(0, 6).join(', ')}`);

    for (const key of referenceKeys) {
      if (!(key in dict)) continue;
      const value = dict[key];
      if (typeof value !== 'string' || value.trim() === '') {
        errors.push(`${code}.${key}: empty or non-string value`);
        continue;
      }
      const expected = placeholders(reference[key]);
      const actual = placeholders(value);
      if (expected.join(',') !== actual.join(',')) {
        errors.push(`${code}.${key}: placeholder mismatch (${actual.join(',') || 'none'} != ${expected.join(',') || 'none'})`);
      }
    }
  }

  // Identical-to-English values are reported, not failed: proper nouns such as
  // "Tecton", "OneDrive" and "CSV" are the same in every language. Printing the
  // list keeps a genuine missing translation visible during review.
  //
  // The spreadsheet column aliases stay English on purpose: `importUtils` matches
  // real Excel headers against them, and a translated header would stop the
  // template from importing.
  //
  // `COGNATES` are words that are genuinely spelled the same in the listed
  // languages ("System" in German, "Status" in Portuguese, the WhatsApp brand).
  // They are not leaks, so they are left out of the review list.
  const ALLOWED_IDENTICAL = new Set([
    'app.name',
    'about.col_name',
    'about.col_tc',
    'about.col_phone',
    'about.col_wage',
    'about.col_start_date',
    'about.col_group',
    'about.col_status',
    'about.col_tags',
    'subcontractor_profile.whatsapp_share',
    'nav.rail_system',
    'settings.theme_system',
    'sidebar_spotlight',
    'spotlight_badge_menu',
    'spotlight_badge_personnel',
    'logs.type_info',
    'logs.type_error',
    'common.details',
    'common.qr_link',
    'common.error',
    'common.error_occurred',
    'common.date',
    'common.description',
    'common.photo',
    'common.page_info',
    'worker_modal.status',
    'worker_profile.table.date',
    'worker_profile.table.desc',
    'worker_profile.table.type',
    'worker_profile.advance_form.date',
    'worker_profile.note_label',
    'about.fact_version',
    'about.fact_license',
    'about.link_docs',
    'subcontractor.table_status',
    'subcontractor.table_action',
    'global.filter',
    'global.date',
    'global.description',
    'filters.status',
    'filters.type',
    'export.status',
    'export.tags',
    'export.sheet_data',
    'nav.legal',
    'nav.docs',
    'docs.title',
    'cash.table.date',
    'cash.table.desc',
    'cash.table.type',
    'recycle_th_action',
    'logs.filter_table',
    'leave_type.Mazeret',
    'legal.license',
    'legal.contact_title',
    'legal.product',
    'legal.privacy_title',
    'cloud.provider',
    'settings.parameters',
    'update.title',
    // GitHub is a brand name and reads the same in every language.
    'sidebar_github',
    // "Webhook" is the accepted term (and its plural) in de, es, fr, pt, nl,
    // sv and no; translating it would make the feature harder to recognise.
    'integrations.webhooks',
    // German "Name", French "Sources", the CPU acronym and the Scandinavian
    // "Send test" are the native forms, not untranslated English.
    'integrations.hook_name',
    'integrations.send_test',
    'ai.sources',
    'ai.cpu',
  ]);

  const identical = [];
  for (const code of languages) {
    if (code === REFERENCE) continue;
    const dict = dictionaries[code] || {};
    const same = referenceKeys.filter((key) => {
      if (ALLOWED_IDENTICAL.has(key)) return false;
      const value = String(dict[key] || '');
      return value === reference[key] && /^[\x20-\x7E]*$/.test(value) && /[a-z]{4,}/i.test(value);
    });
    if (same.length) identical.push({ code, count: same.length, sample: same.slice(0, 3) });
  }

  return { errors, identical, languages: languages.length, keys: referenceKeys.length };
}

if (require.main === module) {
  const result = check();
  for (const item of result.identical) {
    console.log(`[i18n] ${item.code}: ${item.count} string(s) identical to English (review): ${item.sample.join(', ')}`);
  }
  if (result.errors.length) {
    for (const error of result.errors) console.error(`[i18n] ${error}`);
    console.error(`\n[i18n] FAILED: ${result.errors.length} problem(s).`);
    process.exit(1);
  }
  console.log(`[i18n] clean: ${result.languages} languages, ${result.keys} keys each.`);
}

module.exports = { check, flatten, readLanguages };
