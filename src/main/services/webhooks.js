/**
 * webhooks.js
 *
 * Outbound webhook delivery for Tecton. A webhook is a URL plus a list of
 * events plus an optional shared secret. Delivery is signed with
 * HMAC-SHA256 over `<timestamp>.<body>` so the receiver can prove the payload
 * came from this installation.
 *
 * Safety rules:
 *   - only http/https, no redirects are followed;
 *   - private and link-local addresses are refused, except loopback, because
 *     local automation tools (n8n, Node-RED, Home Assistant) are a real use
 *     case and never leave the machine;
 *   - at most four deliveries run at once, each with a 10 s timeout;
 *   - failures are retried three times with backoff, then recorded.
 *
 * The store is a small JSON file written atomically. Webhooks are not part of
 * the synced database on purpose: a URL and its secret belong to one machine.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const https = require('https');
const dns = require('dns').promises;
const net = require('net');
const logger = require('../logger');

const EVENTS = [
  'record.created',
  'record.updated',
  'record.deleted',
  'backup.completed',
  'update.available',
  'test',
];

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [2000, 8000, 30000];
const REQUEST_TIMEOUT_MS = 10000;
const MAX_RESPONSE_BYTES = 32 * 1024;
const MAX_CONCURRENT = 4;

let store = {
  file: null,
  hooks: [],
  deliveries: [],
  active: 0,
  queue: [],
  timers: new Set(),
};

function configure({ stateDir }) {
  store.file = stateDir ? path.join(stateDir, 'webhooks.json') : null;
}

async function load() {
  if (!store.file) return [];
  try {
    const raw = JSON.parse(await fsp.readFile(store.file, 'utf8'));
    store.hooks = Array.isArray(raw?.hooks) ? raw.hooks.filter(isValidHook) : [];
    store.deliveries = Array.isArray(raw?.deliveries) ? raw.deliveries.slice(-50) : [];
  } catch {
    store.hooks = [];
    store.deliveries = [];
  }
  return store.hooks;
}

function isValidHook(hook) {
  return (
    hook &&
    typeof hook.id === 'string' &&
    typeof hook.url === 'string' &&
    /^https?:\/\//i.test(hook.url) &&
    Array.isArray(hook.events) &&
    hook.events.some((event) => EVENTS.includes(event))
  );
}

async function save() {
  if (!store.file) return;
  const payload = JSON.stringify({ hooks: store.hooks, deliveries: store.deliveries }, null, 2);
  const temp = `${store.file}.tmp-${process.pid}`;
  await fsp.mkdir(path.dirname(store.file), { recursive: true });
  await fsp.writeFile(temp, payload, 'utf8');
  await fsp.rename(temp, store.file);
}

function publicHook(hook) {
  return {
    id: hook.id,
    name: hook.name || '',
    url: hook.url,
    events: hook.events,
    enabled: hook.enabled !== false,
    hasSecret: !!hook.secret,
    lastStatus: hook.lastStatus || null,
    lastAttemptAt: hook.lastAttemptAt || null,
    createdAt: hook.createdAt || null,
  };
}

async function list() {
  return store.hooks.map(publicHook);
}

async function validateUrl(value, { allowLoopback = true } = {}) {
  let parsed;
  try {
    parsed = new URL(String(value));
  } catch {
    return { ok: false, code: 'invalid_url' };
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) return { ok: false, code: 'invalid_url' };
  if (parsed.username || parsed.password) return { ok: false, code: 'credentials_not_allowed' };

  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]') {
    return allowLoopback ? { ok: true, parsed } : { ok: false, code: 'private_address' };
  }

  if (net.isIP(host)) {
    return isPrivateIp(host) ? { ok: false, code: 'private_address' } : { ok: true, parsed };
  }

  try {
    const records = await dns.lookup(host, { all: true, verbatim: true });
    if (!records.length) return { ok: false, code: 'dns_failed' };
    if (records.some((record) => isPrivateIp(record.address))) {
      return { ok: false, code: 'private_address' };
    }
  } catch {
    return { ok: false, code: 'dns_failed' };
  }
  return { ok: true, parsed };
}

function isPrivateIp(address) {
  const value = String(address).replace(/^::ffff:/i, '');
  if (net.isIPv4(value)) {
    const [a, b] = value.split('.').map(Number);
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
    return false;
  }
  if (net.isIPv6(value)) {
    const lower = value.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
  }
  return false;
}

/**
 * Create or update a webhook. `id` identifies an existing hook; secrets are
 * write-only, so sending an empty secret on update keeps the stored one.
 */
async function upsert(input) {
  const check = await validateUrl(input?.url);
  if (!check.ok) return { success: false, code: check.code };

  const events = Array.isArray(input.events)
    ? input.events.filter((event) => EVENTS.includes(event) && event !== 'test')
    : [];
  if (!events.length) return { success: false, code: 'no_events' };

  const existing = input.id ? store.hooks.find((hook) => hook.id === input.id) : null;
  const hook = {
    id: existing?.id || `wh_${crypto.randomUUID()}`,
    name: String(input.name || '').trim().slice(0, 80),
    url: String(input.url),
    events,
    enabled: input.enabled !== false,
    secret: typeof input.secret === 'string' && input.secret
      ? input.secret
      : (existing?.secret || ''),
    lastStatus: existing?.lastStatus || null,
    lastAttemptAt: existing?.lastAttemptAt || null,
    createdAt: existing?.createdAt || new Date().toISOString(),
  };

  if (existing) store.hooks = store.hooks.map((item) => (item.id === hook.id ? hook : item));
  else store.hooks.push(hook);

  await save();
  return { success: true, hook: publicHook(hook) };
}

async function remove(id) {
  const before = store.hooks.length;
  store.hooks = store.hooks.filter((hook) => hook.id !== id);
  if (store.hooks.length === before) return { success: false, code: 'not_found' };
  await save();
  return { success: true };
}

function signature(secret, timestamp, body) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
}

function sendOnce(hook, body, headers) {
  return new Promise((resolve) => {
    const url = new URL(hook.url);
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.request(
      url,
      {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          'User-Agent': 'Tecton-Webhooks/1.0',
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (response) => {
        let received = 0;
        response.on('data', (chunk) => {
          received += chunk.length;
          if (received > MAX_RESPONSE_BYTES) response.destroy();
        });
        response.on('end', () => resolve({ status: response.statusCode || 0 }));
        response.on('error', () => resolve({ status: 0 }));
      }
    );
    request.on('timeout', () => request.destroy(new Error('timeout')));
    request.on('error', () => resolve({ status: 0 }));
    request.end(body);
  });
}

function isRetryable(status) {
  return status === 0 || status === 429 || (status >= 500 && status <= 599);
}

async function deliver(hook, payload, attempt = 1) {
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const headers = {
    'X-Tecton-Event': payload.event,
    'X-Tecton-Delivery': payload.id,
    'X-Tecton-Timestamp': timestamp,
  };
  if (hook.secret) {
    headers['X-Tecton-Signature'] = `sha256=${signature(hook.secret, timestamp, body)}`;
  }

  const result = await sendOnce(hook, body, headers);
  const ok = result.status >= 200 && result.status < 300;

  if (!ok && attempt < MAX_ATTEMPTS && isRetryable(result.status)) {
    const delay = RETRY_DELAYS_MS[attempt - 1] || 30000;
    await new Promise((resolve) => {
      const timer = setTimeout(() => {
        store.timers.delete(timer);
        resolve();
      }, delay);
      store.timers.add(timer);
    });
    return deliver(hook, payload, attempt + 1);
  }

  hook.lastStatus = ok ? 'ok' : `failed:${result.status}`;
  hook.lastAttemptAt = new Date().toISOString();
  store.deliveries.push({
    hookId: hook.id,
    event: payload.event,
    status: result.status,
    at: hook.lastAttemptAt,
    attempts: attempt,
  });
  store.deliveries = store.deliveries.slice(-50);
  await save().catch(() => {});
  if (!ok) logger.warn(`[Webhooks] ${hook.id} delivery failed with status ${result.status}`);
  return ok;
}

function drainQueue() {
  while (store.active < MAX_CONCURRENT && store.queue.length) {
    const task = store.queue.shift();
    store.active += 1;
    Promise.resolve()
      .then(task)
      .catch((error) => logger.warn('[Webhooks] unexpected delivery error:', error?.message))
      .finally(() => {
        store.active -= 1;
        drainQueue();
      });
  }
}

/**
 * Fire an event. Never throws and never blocks the caller: record mutations
 * must not fail because a webhook endpoint is down.
 */
function emit(event, data = {}) {
  try {
    const targets = store.hooks.filter(
      (hook) => hook.enabled !== false && hook.events.includes(event)
    );
    if (!targets.length) return 0;

    const payload = {
      id: `evt_${crypto.randomUUID()}`,
      event,
      occurredAt: new Date().toISOString(),
      app: 'Tecton',
      version: '1.0.0',
      data,
    };

    for (const hook of targets) {
      store.queue.push(() => deliver(hook, payload));
    }
    drainQueue();
    return targets.length;
  } catch (error) {
    logger.warn('[Webhooks] emit failed:', error?.message);
    return 0;
  }
}

async function test(id) {
  const hook = store.hooks.find((item) => item.id === id);
  if (!hook) return { success: false, code: 'not_found' };
  const payload = {
    id: `evt_${crypto.randomUUID()}`,
    event: 'test',
    occurredAt: new Date().toISOString(),
    app: 'Tecton',
    version: '1.0.0',
    data: { message: 'Tecton webhook test delivery' },
  };
  const ok = await deliver(hook, payload);
  return { success: ok, status: hook.lastStatus };
}

async function close() {
  for (const timer of store.timers) clearTimeout(timer);
  store.timers.clear();
  store.queue = [];
}

module.exports = {
  EVENTS,
  configure,
  load,
  list,
  upsert,
  remove,
  emit,
  test,
  close,
  validateUrl,
  signature,
  _store: store,
};
