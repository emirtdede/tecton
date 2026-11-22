import i18n from '../i18n';

/**
 * Wraps a renderer→main mutation so a `{ success: false }` reply can never be
 * silently treated as success.
 *
 * Every `window.api.db./finance./system.` handler returns
 * `{ success: false, message }` on a rejected write (validation, constraint,
 * bad id). Call sites used to `await` that promise and immediately clear the
 * form / refetch, so a failed INSERT looked identical to a successful one and
 * the user's typed data was discarded without any feedback.
 *
 * The wrapper keeps the exact same return value, so existing code that already
 * inspects `res.success` is unaffected; it only adds the missing notification.
 */

// A bulk loop can fail every row at once; without throttling the user gets a
// wall of identical toasts. Identical messages inside this window collapse.
const THROTTLE_MS = 1500;
const lastShown = new Map();

/**
 * Drop throttle entries that can no longer suppress anything.
 *
 * The map is module-scoped, so it lived for the whole session. Messages are not
 * a fixed set - they embed file names, worker names and row values ("Ahmet
 * Yılmaz için kayıt bulunamadı") - so every distinct failure added a permanent
 * entry and the map grew without bound. Anything older than the throttle window
 * is dead weight: it can never stop a toast, because the comparison above
 * already fails for it.
 */
const pruneThrottle = (now) => {
  for (const [key, shownAt] of lastShown) {
    if (now - shownAt >= THROTTLE_MS) lastShown.delete(key);
  }
};

/**
 * The main process cannot know the active locale (it is a renderer/i18next
 * concern) and every handler used to return a hardcoded Turkish sentence, so
 * 18 of the 19 supported languages saw Turkish errors. Handlers now also send
 * a stable `messageKey` (e.g. "errors.file_not_found"); translate it here and
 * fall back to the raw message when no key is supplied.
 */
const translate = (result) => {
  if (!result) return result;
  if (result.messageKey) {
    return { ...result, message: i18n.t(result.messageKey, result.message || '') };
  }
  return result;
};

/**
 * Resolves the user-facing message of an IPC reply in the active locale.
 *
 * Not every call site goes through `apiWrite` (read-only fetches and some
 * mutations show their own dialog/toast). Those sites used to concatenate
 * `res.message` directly, which is the main process's Turkish literal, so the
 * `messageKey` translation never ran. Use this helper there.
 *
 * @param {{ message?: string, messageKey?: string } | null | undefined} result
 * @param {string} [fallback] returned when the reply carries no message
 */
export const apiMessage = (result, fallback = '') => {
  if (!result) return fallback;
  if (result.messageKey) {
    return i18n.t(result.messageKey, result.message || fallback);
  }
  return result.message || fallback;
};

const notify = (message, type) => {
  if (typeof window === 'undefined' || !window.dispatchEvent) return;
  const now = Date.now();
  pruneThrottle(now);
  const prev = lastShown.get(message);
  if (prev && now - prev < THROTTLE_MS) return;
  lastShown.set(message, now);
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
};

export const apiWrite = async (promise, options = {}) => {
  const { successMessage = null, silent = false } = options;

  let result;
  try {
    result = await promise;
  } catch (error) {
    // IPC itself failed (main crashed / handler threw past its try block).
    if (!silent) {
      notify(i18n.t('common.error_occurred', 'Hata:') + ' ' + (error?.message || ''), 'error');
    }
    return { success: false, message: error?.message || 'IPC error' };
  }

  result = translate(result);

  if (result && result.success === false) {
    if (!silent) {
      notify(result.message || i18n.t('common.error_occurred', 'Hata:'), 'error');
    }
    return result;
  }

  if (successMessage) notify(successMessage, 'success');
  return result;
};

export default apiWrite;
