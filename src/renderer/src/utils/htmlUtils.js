/**
 * HTML escaping helpers for string templates.
 *
 * Several PDF/print exports build markup via `innerHTML` with user-controlled
 * values (company name, worker name, project name, free-text notes). Inside an
 * Electron renderer that is a genuine XSS surface, so every interpolated value
 * must be escaped first.
 */

const HTML_ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
};

/**
 * Escapes a value for safe interpolation into HTML text or a quoted attribute.
 * Null/undefined become an empty string.
 */
export const escapeHtml = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
};

export default escapeHtml;
