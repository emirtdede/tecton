/**
 * Shared helpers for generated PDF file names.
 *
 * Every PDF export used to copy-paste its own `trMap` + `toEn` block, which
 * drifted between files and produced unsafe file names (characters such as
 * `/`, `:`, `*` were never stripped). One implementation here is the single
 * source of truth.
 */

// Turkish letters that do not exist in ASCII. Written with escapes so the file
// stays readable regardless of the editor's encoding.
const TR_ASCII_MAP = {
  '\u00e7': 'c', '\u011f': 'g', '\u015f': 's', '\u00f6': 'o',
  '\u00fc': 'u', '\u0131': 'i', '\u00c7': 'C', '\u011e': 'G',
  '\u015e': 'S', '\u00d6': 'O', '\u00dc': 'U', '\u0130': 'I',
  '\u20ba': 'TL'
};

const TR_ASCII_RE = new RegExp('[' + Object.keys(TR_ASCII_MAP).join('') + ']', 'g');

// Characters that are illegal in Windows file names, plus control chars.
const ILLEGAL_RE = /[\\/:*?"<>|\u0000-\u001f]/g;

/**
 * Transliterates Turkish characters to ASCII without touching anything else.
 *
 * Use this for text that is *rendered into the PDF* (names, currency strings):
 * the PDF core fonts cannot encode Turkish glyphs, but the value must otherwise
 * stay intact (spaces, punctuation, digits).
 *
 * @param {string} str
 * @returns {string}
 */
export function toAsciiText(str) {
  if (!str) return '';
  return String(str).replace(TR_ASCII_RE, (letter) => TR_ASCII_MAP[letter]);
}

/**
 * Converts a user-facing title into a safe, ASCII-only file name fragment.
 *
 * @param {string} str
 * @returns {string}
 */
export function toAsciiFilename(str) {
  if (!str) return '';
  return toAsciiText(str)
    .replace(ILLEGAL_RE, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export default toAsciiFilename;
