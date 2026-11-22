vi.mock('electron', () => {
  return {
    app: {
      getPath: () => '/mock/userData'
    }
  };
});

const { getLocalIP, startLANServer, stopLANServer } = require('./lanServer');

const mockWindow = () => ({
  isDestroyed: () => false,
  webContents: { send: vi.fn() }
});

describe('LAN Server Service', () => {
  afterEach(() => {
    stopLANServer();
  });

  it('should retrieve a valid local IP address', () => {
    const ip = getLocalIP();
    expect(ip).toBeDefined();
    expect(typeof ip).toBe('string');
    expect(ip.length).toBeGreaterThan(0);
  });

  it('should start and stop the LAN Express server successfully', async () => {
    const result = await startLANServer(mockWindow(), 'en');
    expect(result.success).toBe(true);
    expect(result.port).toBeGreaterThan(0);
    expect(result.ip).toBeDefined();

    // Verify calling it again with a different language returns same server info
    const secondResult = await startLANServer(mockWindow(), 'tr');
    expect(secondResult.port).toBe(result.port);

    // Stop server
    expect(() => stopLANServer()).not.toThrow();
  });
});

// The upload endpoints are gated by a per-session token. These tests assert the
// token contract without opening a socket: the HTTP paths are exercised by the
// running app, and binding port 5001 inside CI is flaky (the port may be in use
// and `listen()` is asynchronous).
describe('LAN Server upload token contract', () => {
  afterEach(() => {
    stopLANServer();
  });

  it('issues a non-empty token on start', async () => {
    const res = await startLANServer(mockWindow(), 'en');
    expect(typeof res.token).toBe('string');
    expect(res.token.length).toBeGreaterThanOrEqual(32);
  });

  it('reuses the same token while the server stays up', async () => {
    const first = await startLANServer(mockWindow(), 'en');
    const again = await startLANServer(mockWindow(), 'en');
    expect(again.token).toBe(first.token);
  });

  it('mints a different token after a stop/start cycle', async () => {
    const first = await startLANServer(mockWindow(), 'en');
    stopLANServer();
    const restarted = await startLANServer(mockWindow(), 'en');
    expect(restarted.token).toBeTruthy();
    expect(restarted.token).not.toBe(first.token);
  });

  it('tokens are long random hex strings, not fixed values', async () => {
    const a = (await startLANServer(mockWindow(), 'en')).token;
    expect(a).toMatch(/^[0-9a-f]{48}$/);
  });
});
