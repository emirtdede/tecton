#!/usr/bin/env node
/**
 * server.js
 *
 * Model Context Protocol (MCP) server for Tecton, spoken over stdio. It exposes
 * a small, read-only set of tools to any MCP client (Claude Desktop, Cursor,
 * Windsurf, Cline, Antigravity) by forwarding to the local Tecton API.
 *
 * Transport: newline-delimited JSON-RPC 2.0, with optional LSP-style
 * `Content-Length` framing for clients that require it.
 *
 * Security: the server never opens the database itself. It uses the token in
 * `integrations.json`, so disabling local integrations in Tecton immediately
 * revokes every MCP client. No token is ever included in tool output.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_INFO = { name: 'tecton-mcp', version: '1.0.0', publisher: 'Emir Tarik Dede' };

function configCandidates() {
  const appData = process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming');
  return [
    process.env.TECTON_CONFIG,
    path.join(appData, 'tecton', 'integrations.json'),
    path.join(appData, 'Tecton', 'integrations.json'),
    path.join(process.cwd(), '.tecton-dev-data', 'integrations.json'),
    path.join(__dirname, '..', '..', '.tecton-dev-data', 'integrations.json'),
  ].filter(Boolean);
}

function resolveConnection() {
  if (process.env.TECTON_API_URL && process.env.TECTON_API_TOKEN) {
    return { url: process.env.TECTON_API_URL, token: process.env.TECTON_API_TOKEN };
  }
  for (const candidate of configCandidates()) {
    try {
      const raw = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (raw && raw.url && raw.token) return { url: raw.url, token: raw.token };
    } catch {
      // Continue with the next candidate.
    }
  }
  return null;
}

async function request(route, options = {}) {
  const connection = resolveConnection();
  if (!connection) {
    return {
      ok: false,
      text: 'Tecton is not running or local integrations are disabled. Open Tecton, then check Settings > Integrations.',
    };
  }
  try {
    const response = await fetch(`${connection.url}${route}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${connection.token}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, text: `Tecton API error: ${payload.error || response.status}` };
    }
    return { ok: true, data: payload };
  } catch (error) {
    return { ok: false, text: `Tecton API unreachable: ${error?.message || 'network error'}` };
  }
}

const TOOLS = [
  {
    name: 'tecton_status',
    description: 'Tecton version, API version and record counts. Use this first to confirm the app is reachable.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'tecton_list_projects',
    description: 'List construction sites (projects) with id, name, location and status.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'tecton_list_workers',
    description: 'List personnel with id, name, phone, daily wage, status and project id.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'integer', description: 'Only workers assigned to this project.' },
        limit: { type: 'integer', minimum: 1, maximum: 500, description: 'Maximum rows, default 100.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'tecton_cash_summary',
    description: 'Income, expense and net balance for all projects or one project.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'integer', description: 'Optional project id.' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'tecton_recent_cash',
    description: 'Most recent cash movements, newest first.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'integer' },
        limit: { type: 'integer', minimum: 1, maximum: 500 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'tecton_search_docs',
    description: 'Search the built-in Tecton manual offline. Returns the best matching sections.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to search for.' },
        locale: { type: 'string', description: 'Preferred answer language, for example tr or en.' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'tecton_ask',
    description: 'Ask the local Tecton assistant. Answers are grounded in the built-in manual and never leave the machine.',
    inputSchema: {
      type: 'object',
      properties: {
        question: { type: 'string' },
        locale: { type: 'string' },
      },
      required: ['question'],
      additionalProperties: false,
    },
  },
];

function textResult(text, isError = false) {
  return { content: [{ type: 'text', text }], isError };
}

function jsonText(data) {
  return JSON.stringify(data, null, 2);
}

async function callTool(name, args) {
  switch (name) {
    case 'tecton_status': {
      const result = await request('/api/v1/status');
      return result.ok ? textResult(jsonText(result.data)) : textResult(result.text, true);
    }
    case 'tecton_list_projects': {
      const result = await request('/api/v1/projects');
      return result.ok ? textResult(jsonText(result.data.items)) : textResult(result.text, true);
    }
    case 'tecton_list_workers': {
      const query = new URLSearchParams();
      if (Number.isInteger(args.projectId)) query.set('projectId', String(args.projectId));
      if (Number.isInteger(args.limit)) query.set('limit', String(args.limit));
      const suffix = query.toString() ? `?${query.toString()}` : '';
      const result = await request(`/api/v1/workers${suffix}`);
      return result.ok ? textResult(jsonText(result.data.items)) : textResult(result.text, true);
    }
    case 'tecton_cash_summary': {
      const suffix = Number.isInteger(args.projectId) ? `?projectId=${args.projectId}` : '';
      const result = await request(`/api/v1/summary${suffix}`);
      return result.ok ? textResult(jsonText(result.data)) : textResult(result.text, true);
    }
    case 'tecton_recent_cash': {
      const query = new URLSearchParams();
      if (Number.isInteger(args.projectId)) query.set('projectId', String(args.projectId));
      if (Number.isInteger(args.limit)) query.set('limit', String(args.limit));
      const suffix = query.toString() ? `?${query.toString()}` : '';
      const result = await request(`/api/v1/cash${suffix}`);
      return result.ok ? textResult(jsonText(result.data.items)) : textResult(result.text, true);
    }
    case 'tecton_search_docs': {
      const query = new URLSearchParams({ q: String(args.query || '') });
      if (args.locale) query.set('locale', String(args.locale));
      const result = await request(`/api/v1/docs/search?${query.toString()}`);
      if (!result.ok) return textResult(result.text, true);
      const lines = (result.data.results || []).map(
        (item) => `[${item.id}] ${item.title}\n${item.body}`
      );
      return textResult(lines.length ? lines.join('\n\n') : 'No matching section.');
    }
    case 'tecton_ask': {
      const result = await request('/api/v1/ai/ask', {
        method: 'POST',
        body: { question: String(args.question || ''), locale: args.locale },
      });
      if (!result.ok) return textResult(result.text, true);
      const sources = (result.data.citations || []).map((item) => item.title).join(', ');
      return textResult(`${result.data.answer}${sources ? `\n\nSources: ${sources}` : ''}`);
    }
    default:
      return textResult(`Unknown tool: ${name}`, true);
  }
}

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function dispatch(message) {
  const { id, method, params } = message;
  const isNotification = id === undefined;

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
      },
    };
  }
  if (method === 'notifications/initialized' || isNotification) return null;
  if (method === 'ping') return { jsonrpc: '2.0', id, result: {} };
  if (method === 'tools/list') return { jsonrpc: '2.0', id, result: { tools: TOOLS } };
  if (method === 'tools/call') {
    const name = params?.name;
    const args = params?.arguments || {};
    try {
      const result = await callTool(name, args);
      return { jsonrpc: '2.0', id, result };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id,
        result: textResult(`Tool failed: ${error?.message || 'unknown error'}`, true),
      };
    }
  }
  return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Method not found: ${method}` },
  };
}

/* ---------------------------------------------------------------------------
 * Framing
 *
 * MCP over stdio is normally newline-delimited, but a few clients prepend
 * `Content-Length`. The reader below accepts both without a mode switch.
 * ------------------------------------------------------------------------- */

let buffer = '';

function handleChunk(chunk) {
  buffer += chunk;
  for (;;) {
    const trimmedStart = buffer.replace(/^\s+/, '');
    if (trimmedStart !== buffer) buffer = trimmedStart;

    if (/^Content-Length:/i.test(buffer)) {
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) return;
      const match = buffer.match(/^Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const start = headerEnd + 4;
      if (buffer.length < start + length) return;
      const body = buffer.slice(start, start + length);
      buffer = buffer.slice(start + length);
      consume(body);
      continue;
    }

    const newline = buffer.indexOf('\n');
    if (newline === -1) return;
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line) consume(line);
  }
}

function consume(raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    return;
  }
  Promise.resolve(dispatch(message))
    .then((response) => {
      if (response) send(response);
    })
    .catch((error) => {
      if (message && message.id !== undefined) {
        send({
          jsonrpc: '2.0',
          id: message.id,
          error: { code: -32603, message: error?.message || 'Internal error' },
        });
      }
    });
}

process.stdin.setEncoding('utf8');
process.stdin.on('data', handleChunk);
process.stdin.on('end', () => process.exit(0));
process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));
