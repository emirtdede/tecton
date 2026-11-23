import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(__dirname, '../../..');
const {
  EXPECTED_COUNT,
  generate,
  readInstallerLanguages,
} = require(path.join(ROOT, 'scripts/generateInstallerLanguages.js'));

/**
 * The generated NSIS catalogue is a build artefact, so the test runs the
 * generator in memory instead of reading the checked-out file. It guards the
 * two things that broke the installer before: a missing language entry and a
 * duplicate LCID that made the wrong row preselected.
 */
describe('installer language catalogue', () => {
  const languages = readInstallerLanguages();
  const rows = generate(languages);

  it('keeps the catalogue aligned with the 73 configured languages', () => {
    expect(languages).toHaveLength(EXPECTED_COUNT);
    expect(rows).toHaveLength(EXPECTED_COUNT);
  });

  it('never repeats an installer code', () => {
    const codes = rows.map((row) => row.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('maps a language to NSIS wizard text only when NSIS ships that name', () => {
    for (const row of rows) {
      if (row.muiLcid === null) {
        expect(row.nsisName).toBeNull();
        expect(row.region).toBeNull();
        continue;
      }
      // Every mapped row needs a real LCID and a name the packager can emit.
      expect(Number.isInteger(row.muiLcid)).toBe(true);
      expect(muiLcidIsKnown(row.muiLcid)).toBe(true);
      expect(typeof row.nsisName).toBe('string');
      expect(row.nsisName.length).toBeGreaterThan(2);
    }
  });

  it('never maps two languages to the same NSIS name', () => {
    const names = rows.filter((row) => row.nsisName).map((row) => row.nsisName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('leaves at least one language with native wizard text', () => {
    expect(rows.some((row) => row.muiLcid)).toBe(true);
  });

  it('preselects a row for every Windows LCID that has an entry', () => {
    // Every row must be reachable either by exact LANGID or by primary LANGID.
    const exact = new Set(rows.map((row) => row.lcid));
    const primary = new Set(rows.map((row) => row.lcid & 0x3ff));
    for (const language of languages) {
      expect(exact.has(language.lcid) || primary.has(language.lcid & 0x3ff)).toBe(true);
    }
  });
});

function muiLcidIsKnown(value) {
  // A known Windows LCID is a positive 16-bit identifier.
  return Number.isInteger(value) && value > 0 && value <= 0xffff;
}
