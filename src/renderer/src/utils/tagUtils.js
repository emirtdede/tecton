/**
 * Tag (etiket) serialization helpers.
 *
 * Tags are stored as a JSON array string in SQLite, but the five call sites that
 * read them each re-implemented the parse slightly differently: two swallowed
 * invalid JSON and showed no tags, one split a legacy comma string, and
 * `WorkerDrawer` called `JSON.parse` directly (throwing - and losing tags - when
 * the column already held an array). One parser keeps every screen consistent.
 */

/**
 * @param {unknown} raw value read from the `tags` column (string | array | null)
 * @returns {string[]} always an array
 */
export const parseTags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(tag => typeof tag === 'string' && tag.trim() !== '');

  if (typeof raw !== 'string') return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.filter(tag => typeof tag === 'string' && tag.trim() !== '');
    }
    // Valid JSON but not a list (e.g. a plain number) - treat as no tags.
    return [];
  } catch {
    // Legacy rows stored tags as a comma-separated string.
    return trimmed.split(',').map(tag => tag.trim()).filter(Boolean);
  }
};
