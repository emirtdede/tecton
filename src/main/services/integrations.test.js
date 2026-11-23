import { describe, it, expect } from 'vitest';

const rag = require('./ai/rag');
const webhooks = require('./webhooks');

describe('RAG knowledge base', () => {
  it('indexes the bundled manual', () => {
    const stats = rag.stats();
    expect(stats.documents).toBeGreaterThanOrEqual(15);
    expect(stats.terms).toBeGreaterThan(50);
  });

  it('finds cloud sync for a Turkish query without diacritics', () => {
    const results = rag.search('bulut esitleme nasil calisir', { locale: 'tr' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((item) => item.id)).toContain('cloud');
  });

  it('finds the backup section from English words', () => {
    const results = rag.search('where are backups stored', { locale: 'en', limit: 3 });
    expect(results[0].id).toBe('backup');
  });

  it('always returns a grounded answer when the corpus matches', () => {
    const answer = rag.extractiveAnswer('How does cloud sync work?', { locale: 'en' });
    expect(answer.answer.length).toBeGreaterThan(20);
    expect(answer.citations.length).toBeGreaterThan(0);
  });

  it('answers without inventing a citation for unknown topics', () => {
    const answer = rag.extractiveAnswer('quantum tunnelling in bananas', { locale: 'en' });
    expect(answer.citations).toEqual([]);
  });
});

describe('webhook URL validation', () => {
  it('accepts a public https endpoint', async () => {
    const result = await webhooks.validateUrl('https://example.com/tecton', { allowLoopback: false });
    expect(result.ok).toBe(true);
  });

  it('accepts loopback when the caller allows it', async () => {
    expect((await webhooks.validateUrl('http://127.0.0.1:9000/hook')).ok).toBe(true);
  });

  it('rejects loopback when the caller forbids it', async () => {
    const result = await webhooks.validateUrl('http://127.0.0.1:9000/hook', { allowLoopback: false });
    expect(result).toMatchObject({ ok: false, code: 'private_address' });
  });

  it('rejects private and link-local addresses', async () => {
    for (const url of [
      'http://10.0.0.5/hook',
      'http://192.168.1.10/hook',
      'http://172.20.4.4/hook',
      'http://169.254.169.254/latest/meta-data',
      'http://[fc00::1]/hook',
    ]) {
      const result = await webhooks.validateUrl(url, { allowLoopback: false });
      expect(result, url).toMatchObject({ ok: false, code: 'private_address' });
    }
  });

  it('rejects credentials, other protocols and malformed input', async () => {
    expect((await webhooks.validateUrl('ftp://example.com/hook')).code).toBe('invalid_url');
    expect((await webhooks.validateUrl('https://user:pass@example.com/hook')).code).toBe('credentials_not_allowed');
    expect((await webhooks.validateUrl('not a url')).code).toBe('invalid_url');
  });

  it('signs the timestamp and body together', () => {
    const digest = webhooks.signature('secret', '1700000000', '{"a":1}');
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(webhooks.signature('other', '1700000000', '{"a":1}')).not.toBe(digest);
  });
});
