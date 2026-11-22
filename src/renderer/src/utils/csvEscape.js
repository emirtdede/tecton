/**
 * CSV cell hardening shared by every export.
 *
 * Kept dependency-free (no `xlsx`, no i18n) so it can be unit-tested in a plain
 * Node environment.
 */

/** Excel/Sheets treats a cell starting with these characters as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** Genuine numbers (e.g. -1250.50 balance) must stay numbers, not text. */
const PLAIN_NUMBER = /^[+-]?\d+(?:[.,]\d+)?$/;

/**
 * Neutralises formula injection in one CSV cell.
 *
 * A value like `=HYPERLINK("http://evil","click")` stored as a worker name
 * executes when the exported file is opened. Prefixing a single quote pins the
 * cell to text; Excel hides the quote.
 *
 * @param {unknown} value
 * @returns {unknown}
 */
export const escapeCsvCell = (value) => {
  if (typeof value !== 'string') return value;
  if (!FORMULA_PREFIX.test(value)) return value;
  if (PLAIN_NUMBER.test(value)) return value;
  return `'${value}`;
};

/**
 * Applies {@link escapeCsvCell} to every string field of every row.
 * @param {Array<object>} rows
 * @returns {Array<object>}
 */
export const escapeCsvRows = (rows) =>
  rows.map((row) => {
    if (row === null || typeof row !== 'object') return row;
    const out = {};
    for (const [key, value] of Object.entries(row)) out[key] = escapeCsvCell(value);
    return out;
  });

/** A field must be quoted when it contains a delimiter, a quote or a newline. */
const NEEDS_QUOTING = /[",\n\r]/;

/**
 * Serialises one CSV field (RFC 4180 quoting).
 * @param {unknown} value
 * @returns {string}
 */
const toCsvField = (value) => {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return NEEDS_QUOTING.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/**
 * Serialises rows of objects into a CSV document.
 *
 * This lives here (rather than going through the `xlsx` package) so that CSV
 * export does not pull a spreadsheet library into the initial bundle: `xlsx`
 * was only ever used for `json_to_sheet` + `sheet_to_csv`, which this does
 * directly. The union of all keys is used as the header row, so a row with an
 * extra column is not silently dropped.
 *
 * @param {Array<object>} rows
 * @returns {string} CSV text (without BOM)
 */
export const rowsToCsv = (rows) => {
  if (!Array.isArray(rows) || rows.length === 0) return '';

  const safe = escapeCsvRows(rows);
  const headers = [];
  for (const row of safe) {
    if (row === null || typeof row !== 'object') continue;
    for (const key of Object.keys(row)) if (!headers.includes(key)) headers.push(key);
  }
  if (headers.length === 0) return '';

  const lines = [headers.map(toCsvField).join(',')];
  for (const row of safe) {
    const isObject = row !== null && typeof row === 'object';
    lines.push(headers.map((key) => toCsvField(isObject ? row[key] : row)).join(','));
  }
  return lines.join('\n');
};
