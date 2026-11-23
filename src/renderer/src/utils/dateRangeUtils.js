/**
 * Date-range filter helpers.
 *
 * Every list/panel in the app has a start/end date filter, and each one used to
 * carry its own copy of these two handlers (11 files). Two behaviours exist:
 *
 *  1. "Ordered" - picking a start after the end *shifts the window*
 *     (start becomes the old end). The pair is always sorted, never invalid.
 *  2. "Pushed"  - picking a start after the end drags the end along to the same
 *     day (used where an empty window would hide the row just added).
 *
 * Both return `[start, end]` so a handler is three lines instead of ten.
 */

import { parseLocalDate } from './formatUtils';

/** 1. Ordered: choosing a start date later than the end moves the window. */
export function reorderRangeForStart(value, end) {
  if (value && end && new Date(value) > new Date(end)) return [end, value];
  return [value, end];
}

/** 1. Ordered: choosing an end date earlier than the start moves the window. */
export function reorderRangeForEnd(value, start) {
  if (value && start && new Date(start) > new Date(value)) return [value, start];
  return [start, value];
}

/** 2. Pushed: choosing a start later than the end drags the end to the start. */
export function clampRangeForStart(value, end) {
  const nextEnd = value && end && new Date(value) > new Date(end) ? value : end;
  return [value, nextEnd];
}

/** 2. Pushed: choosing an end earlier than the start drags the start to the end. */
export function clampRangeForEnd(value, start) {
  const nextStart = value && start && new Date(start) > new Date(value) ? value : start;
  return [nextStart, value];
}

/**
 * Whole days from today (local midnight) to `dateStr`'s calendar day.
 *
 * Returns `null` when the value is empty or cannot be parsed. A bare
 * `new Date(bad).getTime()` yields `NaN`, and **both** `NaN <= 0` and
 * `NaN > 0` are `false` - so a record with a corrupt date used to vanish
 * silently from every "expired" *and* "approaching" list. Callers must treat
 * `null` explicitly instead of relying on the comparison.
 *
 * Why the parts-based implementation: `new Date('2026-11-21')` is **UTC**
 * midnight. Calling `.setHours(0,0,0,0)` on it only zeroes the clock in the
 * *local* timezone, so west of UTC (America/New_York) it lands on the previous
 * local day while `today` stays correct - every value came back one day short
 * (`daysUntil(today)` was -1). Building both sides from local calendar parts
 * makes the difference a clean multiple of 24h in every timezone.
 */
export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const parsed = parseLocalDate(dateStr);
  if (!parsed) return null;
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()).getTime();
  return Math.round((target - start) / (1000 * 3600 * 24));
}
