const logger = require('../logger');

/**
 * Maps a caught error to a message that is safe to show to the end user.
 *
 * Raw `error.message` values from sqlite3 / fs leak internal details such as
 * SQL statements, table/column names and absolute paths. We log the full error
 * on the main process and return a generic, localized message to the renderer.
 *
 * Usage:
 *   return { success: false, message: toUserMessage(error, 'db_error') };
 */

const FRIENDLY = {
  tr: {
    db_error: 'Veritabanı işlemi sırasında bir hata oluştu.',
    file_error: 'Dosya işlemi sırasında bir hata oluştu.',
    network_error: 'Ağ bağlantısı sırasında bir hata oluştu.',
    invalid_input: 'Geçersiz rapor parametreleri. Lütfen tarih ve dönem seçimlerinizi kontrol edin.',
    generic: 'Beklenmeyen bir hata oluştu.',
    unknown_error: 'Bilinmeyen bir hata oluştu.'
  },
  en: {
    db_error: 'An error occurred during the database operation.',
    file_error: 'An error occurred during the file operation.',
    network_error: 'An error occurred during the network request.',
    invalid_input: 'Invalid report parameters. Please check the selected dates and period.',
    generic: 'An unexpected error occurred.',
    unknown_error: 'An unknown error occurred.'
  }
};

// Stable i18n keys. The main process cannot know the active locale (i18next
// lives in the renderer), so every reply carries a key the renderer translates.
// Without this, 18 of the 19 supported languages saw a Turkish sentence.
const KIND_TO_KEY = {
  db_error: 'errors.db_error',
  file_error: 'errors.file_error',
  network_error: 'errors.network_error',
  invalid_input: 'errors.invalid_input',
  generic: 'errors.generic',
  unknown_error: 'errors.unknown_error'
};

/**
 * @param {Error|unknown} error
 * @param {'db_error'|'file_error'|'network_error'|'invalid_input'|'generic'|'unknown_error'} kind
 * @param {string} lang  'tr' | 'en'
 */
function toUserMessage(error, kind = 'generic', lang = 'tr') {
  // Log the real error (with stack) on the main process for diagnostics.
  try {
    logger.error(`[${kind}]`, error);
  } catch {
    // Logger must never mask the original failure.
  }

  const dict = FRIENDLY[lang] || FRIENDLY.tr;
  return dict[kind] || dict.generic;
}

/**
 * Same as `toUserMessage`, but as a ready-to-spread IPC failure payload:
 * `{ message, messageKey }`.
 *
 * Spread it so the renderer's `apiWrite`/`apiMessage` can translate the reply:
 *   return { success: false, ...toUserError(error, 'db_error') };
 *
 * `message` stays the Turkish fallback for any renderer path that reads
 * `res.message` directly (and for an unknown key).
 */
function toUserError(error, kind = 'generic') {
  return {
    message: toUserMessage(error, kind),
    messageKey: KIND_TO_KEY[kind] || KIND_TO_KEY.generic
  };
}

/**
 * Builds an IPC failure payload **without** logging anything.
 *
 * Use this for expected, user-caused rejections (invalid form input, bad date
 * range) and for payloads created at module load. `toUserError` always writes an
 * error line with a stack trace, so calling it for a routine validation failure
 * filled the user's log file with fake errors, and calling it at import time
 * produced one bogus stack trace on every application start.
 */
function toUserErrorPayload(kind = 'generic', lang = 'tr') {
  const dict = FRIENDLY[lang] || FRIENDLY.tr;
  return {
    message: dict[kind] || dict.generic,
    messageKey: KIND_TO_KEY[kind] || KIND_TO_KEY.generic
  };
}

module.exports = { toUserMessage, toUserError, toUserErrorPayload, KIND_TO_KEY };
