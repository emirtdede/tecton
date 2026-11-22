const path = require('path');
const os = require('os');
const fs = require('fs');

// Electron is resolved defensively so this module can be unit-tested without the
// binary (Vitest runs the services in a plain Node environment).
let app = null;
try {
  ({ app } = require('electron'));
} catch (err) {
  app = null;
}

const IS_DEV = process.env.NODE_ENV === 'development';

/**
 * Absolute path to the media root.
 *
 * This used to be duplicated in `ipcHandlers.js` (`resolveMediaDir`) and
 * `lanServer.js` (`getMediaBaseDir`); three copies of the same dev/prod pair
 * drift apart the moment one is edited. Single source of truth now.
 */
function getMediaBaseDir() {
  if (app && typeof app.getPath === 'function') {
    return IS_DEV
      ? path.join(__dirname, '../../../media')
      : path.join(app.getPath('userData'), 'media');
  }
  return path.join(os.tmpdir(), 'tecton-tests', 'media');
}

/** Sanitizes an identifier that becomes part of a filesystem path. */
function safePathSegment(value, fallback = 'default') {
  if (value === null || value === undefined) return fallback;
  const cleaned = String(value).replace(/[^A-Za-z0-9_-]/g, '');
  return cleaned || fallback;
}

/**
 * Resolves a DB-stored relative path (e.g. `project_12/1699_42.webp`) against
 * the media root, returning `null` when it would escape that root.
 */
function resolveMediaPath(relativePath, baseDir = getMediaBaseDir()) {
  if (!relativePath || typeof relativePath !== 'string') return null;
  const root = path.resolve(baseDir);
  const candidate = path.resolve(root, relativePath);
  const rel = path.relative(root, candidate);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return candidate;
}

/**
 * Deletes one photo file referenced by a DB row. Failures are logged, never
 * thrown: cleanup must not abort the surrounding hard-delete loop.
 */
function removeMediaFile(relativePath, baseDir = getMediaBaseDir()) {
  try {
    const filePath = resolveMediaPath(relativePath, baseDir);
    if (!filePath) return false;
    if (!fs.existsSync(filePath)) return false;
    fs.unlinkSync(filePath);
    return true;
  } catch (err) {
    return false;
  }
}

/**
 * Deletes the whole `project_<id>` media folder. Called when a project row is
 * hard-deleted, so its photos do not outlive the record forever.
 */
function removeMediaProjectDir(projectId, baseDir = getMediaBaseDir()) {
  try {
    const dir = path.join(path.resolve(baseDir), `project_${safePathSegment(projectId)}`);
    const rel = path.relative(path.resolve(baseDir), dir);
    if (rel.startsWith('..') || path.isAbsolute(rel)) return false;
    if (!fs.existsSync(dir)) return false;
    fs.rmSync(dir, { recursive: true, force: true });
    return true;
  } catch (err) {
    return false;
  }
}

module.exports = {
  getMediaBaseDir,
  safePathSegment,
  resolveMediaPath,
  removeMediaFile,
  removeMediaProjectDir
};
