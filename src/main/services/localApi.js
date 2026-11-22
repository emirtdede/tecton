/**
 * localApi.js
 *
 * A deliberately small HTTP API on 127.0.0.1. It is the single access point
 * used by the MCP server, the CLI and any local automation (n8n, Node-RED,
 * PowerShell). Keeping one door means one token check, one set of queries and
 * no second way to reach the database.
 *
 * Design decisions:
 *   - bound to loopback, never to 0.0.0.0;
 *   - every request needs `Authorization: Bearer <token>`;
 *   - read-only by default. The few write endpoints are explicit and validate
 *     through the same allowlist as the UI (`crudService`);
 *   - the token and port live in `integrations.json` under userData, written
 *     with an atomic rename so a crash cannot leave a half file behind.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const logger = require('../logger');

const DEFAULT_PORT = 43117;
const PORT_TRIES = 12;
const MAX_BODY_BYTES = 256 * 1024;

let runtime = {
  server: null,
  port: null,
  token: null,
  configPath: null,
  startedAt: null,
  db: null,
  ai: null,
  webhooks: null,
  version: '1.0.0',
  error: null,
};

function configure(options = {}) {
  if (options.database) runtime.db = options.database;
  if (options.ai) runtime.ai = options.ai;
  if (options.webhooks) runtime.webhooks = options.webhooks;
  if (options.stateDir) runtime.configPath = path.join(options.stateDir, 'integrations.json');
  if (options.version) runtime.version = options.version;
}

function tokenMatches(header) {
  const value = String(header || '');
  const token = value.startsWith('Bearer ') ? value.slice(7) : '';
  if (!runtime.token || !token) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(runtime.token);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        request.destroy();
        reject(new Error('payload_too_large'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('invalid_json'));
      }
    });
    request.on('error', reject);
  });
}

function numberParam(value, fallback, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

async function handle(request, response) {
  if (!tokenMatches(request.headers.authorization)) {
    return json(response, 401, { error: 'unauthorized' });
  }
  const url = new URL(request.url, `http://127.0.0.1:${runtime.port}`);
  const route = url.pathname.replace(/\/+$/, '');

  if (!runtime.db) return json(response, 503, { error: 'database_unavailable' });
  const db = await runtime.db();
  if (!db) return json(response, 503, { error: 'database_unavailable' });

  if (request.method === 'GET' && route === '/api/v1/status') {
    const [projects, workers, cash] = await Promise.all([
      db.get('SELECT COUNT(*) AS count FROM projects WHERE is_deleted = 0'),
      db.get('SELECT COUNT(*) AS count FROM workers WHERE is_deleted = 0'),
      db.get('SELECT COUNT(*) AS count FROM cash_register WHERE is_deleted = 0'),
    ]);
    return json(response, 200, {
      app: 'Tecton',
      version: runtime.version,
      apiVersion: 1,
      startedAt: runtime.startedAt,
      counts: {
        projects: projects?.count || 0,
        workers: workers?.count || 0,
        cash: cash?.count || 0,
      },
      features: {
        mcp: true,
        webhooks: true,
        ai: true,
      },
    });
  }

  if (request.method === 'GET' && route === '/api/v1/projects') {
    const rows = await db.all(
      `SELECT id, name, location, status FROM projects
       WHERE is_deleted = 0 ORDER BY sort_order ASC, id ASC`
    );
    return json(response, 200, { items: rows });
  }

  if (request.method === 'GET' && route === '/api/v1/workers') {
    const limit = numberParam(url.searchParams.get('limit'), 100, 500);
    const projectId = url.searchParams.get('projectId');
    const params = [];
    let sql = `SELECT id, full_name, phone, daily_wage, status, project_id
               FROM workers WHERE is_deleted = 0`;
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(Number(projectId));
    }
    sql += ' ORDER BY full_name ASC LIMIT ?';
    params.push(limit);
    const rows = await db.all(sql, params);
    return json(response, 200, { items: rows, limit });
  }

  if (request.method === 'GET' && route === '/api/v1/cash') {
    const limit = numberParam(url.searchParams.get('limit'), 50, 500);
    const projectId = url.searchParams.get('projectId');
    const params = [];
    let sql = `SELECT id, trans_date, type, amount, description, project_id
               FROM cash_register WHERE is_deleted = 0`;
    if (projectId) {
      sql += ' AND project_id = ?';
      params.push(Number(projectId));
    }
    sql += ' ORDER BY trans_date DESC, id DESC LIMIT ?';
    params.push(limit);
    const rows = await db.all(sql, params);
    return json(response, 200, { items: rows, limit });
  }

  if (request.method === 'GET' && route === '/api/v1/summary') {
    const projectId = url.searchParams.get('projectId');
    const scope = projectId ? ' AND project_id = ?' : '';
    const params = projectId ? [Number(projectId)] : [];
    const [income, expense, workers, sites] = await Promise.all([
      db.get(`SELECT COALESCE(SUM(amount),0) AS total FROM cash_register WHERE is_deleted = 0 AND type = 'income'${scope}`, params),
      db.get(`SELECT COALESCE(SUM(amount),0) AS total FROM cash_register WHERE is_deleted = 0 AND type = 'expense'${scope}`, params),
      db.get(`SELECT COUNT(*) AS count FROM workers WHERE is_deleted = 0${scope}`, params),
      db.get('SELECT COUNT(*) AS count FROM projects WHERE is_deleted = 0'),
    ]);
    const totalIncome = Number(income?.total) || 0;
    const totalExpense = Number(expense?.total) || 0;
    return json(response, 200, {
      projectId: projectId ? Number(projectId) : null,
      currency: 'TRY',
      income: totalIncome,
      expense: totalExpense,
      balance: Math.round((totalIncome - totalExpense) * 100) / 100,
      workers: workers?.count || 0,
      projects: sites?.count || 0,
    });
  }

  if (request.method === 'GET' && route === '/api/v1/docs/search') {
    const query = String(url.searchParams.get('q') || '').trim();
    if (!query) return json(response, 400, { error: 'missing_query' });
    const locale = String(url.searchParams.get('locale') || 'en');
    const result = await runtime.ai.searchDocs(query, { locale, limit: 5 });
    return json(response, 200, result);
  }

  if (request.method === 'POST' && route === '/api/v1/ai/ask') {
    const body = await readBody(request);
    const question = String(body?.question || '').trim();
    if (!question) return json(response, 400, { error: 'missing_question' });
    const result = await runtime.ai.ask(question, { locale: body?.locale });
    return json(response, 200, result);
  }

  if (request.method === 'GET' && route === '/api/v1/webhooks') {
    return json(response, 200, { events: runtime.webhooks.EVENTS, items: await runtime.webhooks.list() });
  }

  if (request.method === 'POST' && route === '/api/v1/webhooks/test') {
    const body = await readBody(request);
    const result = await runtime.webhooks.test(String(body?.id || ''));
    return json(response, result.success ? 200 : 400, result);
  }

  return json(response, 404, { error: 'not_found' });
}

async function writeConfig() {
  if (!runtime.configPath) return;
  const payload = JSON.stringify(
    {
      app: 'Tecton',
      apiVersion: 1,
      port: runtime.port,
      token: runtime.token,
      url: `http://127.0.0.1:${runtime.port}`,
      pid: process.pid,
      startedAt: runtime.startedAt,
    },
    null,
    2
  );
  const temp = `${runtime.configPath}.tmp-${process.pid}`;
  await fsp.mkdir(path.dirname(runtime.configPath), { recursive: true });
  await fsp.writeFile(temp, payload, 'utf8');
  await fsp.rename(temp, runtime.configPath);
}

function listen(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((request, response) => {
      handle(request, response).catch((error) => {
        logger.warn('[LocalAPI] request failed:', error?.message);
        if (!response.headersSent) json(response, 500, { error: 'internal_error' });
        else response.end();
      });
    });
    server.on('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

async function start() {
  if (runtime.server) return { success: true, port: runtime.port };
  if (!runtime.configPath) return { success: false, code: 'not_configured' };

  runtime.token = crypto.randomBytes(32).toString('hex');
  runtime.startedAt = new Date().toISOString();

  for (let offset = 0; offset < PORT_TRIES; offset += 1) {
    const port = DEFAULT_PORT + offset;
    try {
      runtime.server = await listen(port);
      runtime.port = port;
      break;
    } catch (error) {
      if (error?.code !== 'EADDRINUSE') {
        runtime.error = error?.code || 'listen_failed';
        logger.warn('[LocalAPI] could not start:', error?.message);
        return { success: false, code: runtime.error };
      }
    }
  }

  if (!runtime.server) {
    runtime.error = 'no_free_port';
    return { success: false, code: 'no_free_port' };
  }

  try {
    await writeConfig();
  } catch (error) {
    logger.warn('[LocalAPI] config write failed:', error?.message);
  }

  logger.info(`[LocalAPI] listening on 127.0.0.1:${runtime.port}`);
  return { success: true, port: runtime.port, url: `http://127.0.0.1:${runtime.port}` };
}

async function stop() {
  if (!runtime.server) return;
  const server = runtime.server;
  runtime.server = null;
  await new Promise((resolve) => server.close(resolve));
}

function info() {
  return {
    running: !!runtime.server,
    port: runtime.port,
    url: runtime.port ? `http://127.0.0.1:${runtime.port}` : null,
    token: runtime.token,
    configPath: runtime.configPath,
    startedAt: runtime.startedAt,
    error: runtime.error,
  };
}

module.exports = { configure, start, stop, info, DEFAULT_PORT };
