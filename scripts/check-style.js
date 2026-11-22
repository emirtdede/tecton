#!/usr/bin/env node
/**
 * check-style.js
 *
 * Project-wide typography gate. Two rules, both non-negotiable:
 *
 *   1. No em dashes (U+2014) or en dashes (U+2013). Use a plain hyphen "-"
 *      instead. Em dashes are an AI-writing tell and break the mono-spaced
 *      alignment used by the tables in the docs.
 *   2. No emoji. Every icon in the UI is a Lucide SVG component; a literal
 *      emoji renders as a colour glyph that ignores the accent colour, the
 *      Windows contrast themes and the font stack, so it is treated as a leak.
 *
 * `--fix` rewrites dashes to "-" and strips emoji from text files. It never
 * touches binaries or generated output.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'release',
  'out',
  '.tecton-dev-data',
  '.cache',
  'coverage',
]);
const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.ts',
  '.tsx',
  '.json',
  '.css',
  '.scss',
  '.html',
  '.md',
  '.nsh',
  '.yml',
  '.yaml',
  '.txt',
  '.svg',
]);

// U+2013 / U+2014 plus the "horizontal bar" and "minus sign" lookalikes.
const DASHES = /[\u2013\u2014\u2015\u2212]/g;

// UTF-8 text that was read as Windows-1252 and saved again. The three classic
// signatures: the replacement character, and the "â€" / "â‚" prefixes produced
// by a mangled em dash, quote or lira sign. This is a real defect, not a style
// choice: it makes a Turkish lira amount render as "â‚º" in the UI.
const MOJIBAKE = /\uFFFD|\u00E2\u20AC|\u00E2\u201A/g;

// Emoji presentation ranges plus variation selectors, zero width joiner and
// regional indicators. Deliberately excludes the typographic symbols that the
// UI legitimately uses (arrows, check marks, bullets, currency).
const EMOJI_RANGES = [
  [0x1f000, 0x1faff],
  [0x1f1e6, 0x1f1ff],
  [0x2600, 0x27bf],
  [0x2b00, 0x2bff],
  [0xfe0f, 0xfe0f],
  [0x200d, 0x200d],
];
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;

function isEmojiCodePoint(code) {
  return EMOJI_RANGES.some(([min, max]) => code >= min && code <= max);
}

// An emoji can also be written as an escape, which the literal scan above
// cannot see: `\u{1F4A1}`, a surrogate pair `\uD83D\uDCA1`, or a numeric HTML
// entity `&#128161;`. Read every escape and test the code point it produces.
const ESCAPED_EMOJI =
  /\\u\{([0-9a-fA-F]{1,6})\}|\\u([0-9a-fA-F]{4})(?:\\u([0-9a-fA-F]{4}))?|&#x([0-9a-fA-F]{1,6});|&#([0-9]{1,7});/g;

function escapeCodePoints(match, braced, first, second, hexEntity, decEntity) {
  if (braced) return [parseInt(braced, 16)];
  if (first) {
    const high = parseInt(first, 16);
    if (second) {
      const low = parseInt(second, 16);
      return [((high - 0xd800) << 10) + (low - 0xdc00) + 0x10000];
    }
    return [high];
  }
  if (hexEntity) return [parseInt(hexEntity, 16)];
  if (decEntity) return [parseInt(decEntity, 10)];
  return [];
}

function findEscapedEmoji(text) {
  const hits = [];
  for (const match of text.matchAll(ESCAPED_EMOJI)) {
    const codePoints = escapeCodePoints(match[0], match[1], match[2], match[3], match[4], match[5]);
    if (codePoints.length && codePoints.every((code) => isEmojiCodePoint(code) || code > 0xffff)) {
      if (codePoints.some((code) => isEmojiCodePoint(code))) hits.push(match[0]);
    }
  }
  return hits;
}

function walk(dir, files = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), files);
    } else if (entry.isFile()) {
      if (TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        files.push(path.join(dir, entry.name));
      }
    }
  }
  return files;
}

function relative(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/');
}

function count(text, regex) {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function scanFile(file, { fix }) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }

  const dashes = count(text, DASHES);
  const literalEmoji = count(text, EMOJI);
  const escapes = findEscapedEmoji(text);
  const emoji = literalEmoji + escapes.length;
  const mojibake = count(text, MOJIBAKE);
  if (dashes === 0 && emoji === 0 && mojibake === 0) return null;

  if (fix) {
    // Mojibake is deliberately not auto-fixed: the repair depends on which
    // character was garbled, so guessing here would corrupt real text.
    let fixed = text.replace(DASHES, '-').replace(EMOJI, '');
    for (const escape of escapes) fixed = fixed.split(escape).join('');
    fs.writeFileSync(file, fixed, 'utf8');
    return { file: relative(file), dashes, emoji, mojibake, fixed: true };
  }
  return { file: relative(file), dashes, emoji, mojibake, fixed: false };
}

function main() {
  const fix = process.argv.includes('--fix');
  const findings = [];
  for (const file of walk(ROOT)) {
    // The style checker is excluded from scanning itself so that the emoji
    // ranges above do not count as a violation.
    if (file === __filename) continue;
    const result = scanFile(file, { fix });
    if (result) findings.push(result);
  }

  if (findings.length === 0) {
    console.log('[style] clean: no em dashes, no emoji and no mojibake.');
    return;
  }

  findings.sort((a, b) => b.dashes + b.emoji - (a.dashes + a.emoji));
  for (const item of findings) {
    const parts = [];
    if (item.dashes) parts.push(`${item.dashes} dash`);
    if (item.emoji) parts.push(`${item.emoji} emoji`);
    if (item.mojibake) parts.push(`${item.mojibake} mojibake`);
    console.log(`${item.fixed ? 'fixed' : 'found'}  ${parts.join(', ')}  ${item.file}`);
  }

  if (fix) {
    console.log(`\n[style] fixed ${findings.length} file(s).`);
    const mojibake = findings.filter((item) => item.mojibake);
    if (mojibake.length) {
      console.error('[style] mojibake needs a hand repair: ' + mojibake.map((item) => item.file).join(', '));
      process.exitCode = 1;
    }
    return;
  }

  const total = findings.reduce((sum, item) => sum + item.dashes + item.emoji + item.mojibake, 0);
  console.error(`\n[style] ${total} violation(s) in ${findings.length} file(s). Run "npm run style:fix".`);
  process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { DASHES, EMOJI, findEscapedEmoji, scanFile, walk };
