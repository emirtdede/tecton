const os = require('os');
const path = require('path');
const fs = require('fs');

const testDir = path.join(os.tmpdir(), 'tecton-lan-test');
if (!fs.existsSync(testDir)) fs.mkdirSync(testDir, { recursive: true });
process.env.TECTON_USERDATA = testDir;

const { startLANServer, stopLANServer, getLocalIP } = require('./lanServer');

describe('lanServer HTTP', () => {
  let base = 'http://127.0.0.1:5001';
  let token = '';

  beforeEach(async () => {
    const r = await startLANServer(null, 'tr');
    base = `http://${r.ip}:${r.port}`;
    token = r.token || '';
  });

  afterEach(() => {
    stopLANServer();
  });

  it('GET / escapes projectName (XSS) and sends CSP', async () => {
    const res = await fetch(`${base}/?projectId=abc&projectName=<script>alert(1)</script>&token=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    const html = await res.text();
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('POST /upload accepts png and writes namespaced file', async () => {
    startLANServer(null, 'tr');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const fd = new FormData();
    fd.append('photo', new Blob([png], { type: 'image/png' }), 'x.png');
    const res = await fetch(`${base}/upload?projectId=abc&token=${token}`, { method: 'POST', body: fd });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.relativePath.startsWith('project_abc/')).toBe(true);
    // The extension follows the verified MIME type (png here), not the client
    // filename, so a spoofed name can never choose an executable extension.
    expect(data.relativePath.endsWith('.png')).toBe(true);
  });

  it('POST /upload rejects exe (INVALID_TYPE)', async () => {
    startLANServer(null, 'tr');
    const fd = new FormData();
    fd.append('photo', new Blob(['MZ...'], { type: 'application/octet-stream' }), 'evil.exe');
    const res = await fetch(`${base}/upload?projectId=abc&token=${token}`, { method: 'POST', body: fd });
    expect(res.status).not.toBe(200);
  });

  it('POST /upload pins traversal projectId to default', async () => {
    startLANServer(null, 'tr');
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const fd = new FormData();
    fd.append('photo', new Blob([png], { type: 'image/png' }), 'x.png');
    const res = await fetch(`${base}/upload?projectId=../../x&token=${token}`, { method: 'POST', body: fd });
    const data = await res.json();
    expect(data.relativePath.startsWith('project_default/')).toBe(true);
  });

  it('binds LAN IP, not 0.0.0.0', async () => {
    const r = await startLANServer(null, 'tr');
    expect(r.ip).not.toBe('0.0.0.0');
    expect(r.ip).toBe(getLocalIP());
  });
});
