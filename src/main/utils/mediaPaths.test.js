import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  getMediaBaseDir,
  safePathSegment,
  resolveMediaPath,
  removeMediaFile,
  removeMediaProjectDir
} from './mediaPaths.js';

// Everything runs against a throwaway directory: the real media root is under
// Electron's userData and must never be touched by tests.
let tmpRoot;

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'tecton-media-'));
});

afterEach(() => {
  try {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
});

describe('safePathSegment', () => {
  it('strips traversal characters', () => {
    expect(safePathSegment('../etc/passwd')).toBe('etcpasswd');
    expect(safePathSegment('..\\..\\win')).toBe('win');
  });

  it('falls back when nothing usable remains', () => {
    expect(safePathSegment('')).toBe('default');
    expect(safePathSegment(null)).toBe('default');
    expect(safePathSegment('///')).toBe('default');
  });

  it('keeps plain ids intact', () => {
    expect(safePathSegment('12')).toBe('12');
    expect(safePathSegment('abc-1_2')).toBe('abc-1_2');
  });
});

describe('resolveMediaPath', () => {
  it('resolves a path inside the media root', () => {
    const p = resolveMediaPath('project_5/a.webp', tmpRoot);
    expect(p).toBe(path.join(tmpRoot, 'project_5', 'a.webp'));
  });

  it('rejects escape attempts', () => {
    expect(resolveMediaPath('../../secrets.txt', tmpRoot)).toBeNull();
    expect(resolveMediaPath('project_5/../../../x', tmpRoot)).toBeNull();
  });

  it('rejects absolute and empty input', () => {
    expect(resolveMediaPath('/etc/passwd', tmpRoot)).toBeNull();
    expect(resolveMediaPath('', tmpRoot)).toBeNull();
    expect(resolveMediaPath(null, tmpRoot)).toBeNull();
  });
});

describe('removeMediaFile', () => {
  it('deletes a file that lives under the media root', () => {
    const dir = path.join(tmpRoot, 'project_7');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'photo.webp');
    fs.writeFileSync(file, 'x');

    expect(removeMediaFile('project_7/photo.webp', tmpRoot)).toBe(true);
    expect(fs.existsSync(file)).toBe(false);
  });

  it('is a no-op for a missing file', () => {
    expect(removeMediaFile('project_7/nope.webp', tmpRoot)).toBe(false);
  });

  it('never deletes outside the media root', () => {
    const outside = path.join(os.tmpdir(), `tecton-outside-${Date.now()}.txt`);
    fs.writeFileSync(outside, 'x');
    try {
      expect(removeMediaFile(path.basename(outside), tmpRoot)).toBe(false);
      expect(fs.existsSync(outside)).toBe(true);
    } finally {
      fs.rmSync(outside, { force: true });
    }
  });
});

describe('removeMediaProjectDir', () => {
  it('removes the whole project folder recursively', () => {
    const dir = path.join(tmpRoot, 'project_9');
    fs.mkdirSync(path.join(dir, 'nested'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'a.webp'), 'a');
    fs.writeFileSync(path.join(dir, 'nested', 'b.webp'), 'b');

    expect(removeMediaProjectDir(9, tmpRoot)).toBe(true);
    expect(fs.existsSync(dir)).toBe(false);
  });

  it('is a no-op when the folder does not exist', () => {
    expect(removeMediaProjectDir(12345, tmpRoot)).toBe(false);
  });

  it('sanitizes the project id before touching the filesystem', () => {
    // `../` must not be able to point the delete at the parent directory.
    expect(removeMediaProjectDir('../..', tmpRoot)).toBe(false);
    expect(fs.existsSync(tmpRoot)).toBe(true);
  });
});

describe('getMediaBaseDir', () => {
  it('always returns an absolute path', () => {
    expect(path.isAbsolute(getMediaBaseDir())).toBe(true);
  });
});
