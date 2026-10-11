vi.mock('electron', () => ({ safeStorage: { isEncryptionAvailable: () => false }, app: { getPath: () => '/mock' } }));

const { sanitizeProjectId, escapeHtml } = require('./lanServer');

describe('lanServer validation', () => {
  it('accepts normal project ids', () => {
    expect(sanitizeProjectId('abc-123_XY')).toBe('abc-123_XY');
  });

  it("falls back to 'default' on traversal", () => {
    expect(sanitizeProjectId('../../x')).toBe('default');
    expect(sanitizeProjectId('a/b')).toBe('default');
  });

  it("falls back to 'default' on empty/oversize", () => {
    expect(sanitizeProjectId('')).toBe('default');
    expect(sanitizeProjectId('x'.repeat(64))).toBe('default');
  });

  it('escapes XSS payloads', () => {
    const out = escapeHtml('<script>alert(1)</script>');
    expect(out).not.toContain('<script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('escapes quotes and ampersands', () => {
    expect(escapeHtml('a"b&c')).toBe('a&quot;b&amp;c');
  });

  it('handles null/undefined safely', () => {
    expect(escapeHtml(null)).toBe('');
    expect(sanitizeProjectId(null)).toBe('default');
  });
});
