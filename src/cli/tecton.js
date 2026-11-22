#!/usr/bin/env node
/**
 * tecton.js
 *
 * Command line client for a running Tecton instance. It talks to the same
 * loopback API the MCP server uses, so there is exactly one code path into the
 * database and one token to protect.
 *
 * Usage:
 *   tecton status
 *   tecton projects
 *   tecton workers [--project <id>] [--limit <n>]
 *   tecton cash [--project <id>] [--limit <n>]
 *   tecton summary [--project <id>]
 *   tecton docs <query>
 *   tecton ask <question>
 *   tecton webhooks
 *   tecton mcp
 *
 * Every command accepts --json for machine-readable output.
 */

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const filtered = args.filter((arg) => arg !== '--json');

function flag(name, fallback = null) {
  const index = filtered.indexOf(name);
  if (index === -1) return fallback;
  const value = filtered[index + 1];
  if (value === undefined || value.startsWith('--')) return fallback;
  return value;
}

function positional() {
  const skip = new Set();
  for (let i = 0; i < filtered.length; i += 1) {
    if (filtered[i].startsWith('--')) {
      skip.add(i);
      if (filtered[i + 1] && !filtered[i + 1].startsWith('--')) skip.add(i + 1);
    }
  }
  return filtered.filter((_, index) => !skip.has(index));
}

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

function readConfig() {
  for (const candidate of configCandidates()) {
    try {
      const raw = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      if (raw && raw.url && raw.token) return { ...raw, source: candidate };
    } catch {
      // Try the next candidate.
    }
  }
  return null;
}

function fail(message, code = 1) {
  if (jsonOutput) process.stdout.write(`${JSON.stringify({ success: false, error: message })}\n`);
  else process.stderr.write(`tecton: ${message}\n`);
  process.exit(code);
}

async function api(config, route, options = {}) {
  let response;
  try {
    response = await fetch(`${config.url}${route}`, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // A refused connection is the normal case when Tecton is closed. Node's
    // raw "fetch failed" says nothing to the person using the terminal.
    throw new Error(`Tecton is not reachable at ${config.url}. Start Tecton and try again.`);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

function print(value) {
  if (jsonOutput) {
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
    return;
  }
  if (Array.isArray(value)) {
    if (!value.length) {
      process.stdout.write('(empty)\n');
      return;
    }
    for (const row of value) {
      process.stdout.write(
        Object.entries(row)
          .map(([key, item]) => `${key}=${item === null || item === undefined ? '' : item}`)
          .join('  ') + '\n'
      );
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (item && typeof item === 'object') {
        process.stdout.write(`${key}:\n`);
        for (const [childKey, childValue] of Object.entries(item)) {
          process.stdout.write(`  ${childKey}=${childValue}\n`);
        }
      } else {
        process.stdout.write(`${key}=${item}\n`);
      }
    }
    return;
  }
  process.stdout.write(`${value}\n`);
}

function usage() {
  process.stdout.write(
    [
      'Tecton CLI',
      '',
      '  tecton status                 Connection and record counts',
      '  tecton projects               List construction sites',
      '  tecton workers [--project id] List personnel',
      '  tecton cash [--project id]    Recent cash movements',
      '  tecton summary [--project id] Income, expense and balance',
      '  tecton docs <query>           Search the local knowledge base',
      '  tecton ask <question>         Ask the local assistant (RAG)',
      '  tecton webhooks               List configured webhooks',
      '  tecton mcp                    Start the MCP server on stdio',
      '',
      'Options: --json  machine-readable output',
      '         --url <url> --token <token>  override the saved connection',
      '',
    ].join('\n')
  );
}

async function runMcp(config) {
  const script = path.join(__dirname, '..', 'mcp', 'server.js');
  if (!fs.existsSync(script)) fail('MCP server not found');
  const child = spawn(process.execPath, [script], {
    stdio: 'inherit',
    env: {
      ...process.env,
      TECTON_API_URL: config?.url || '',
      TECTON_API_TOKEN: config?.token || '',
    },
  });
  child.on('exit', (code) => process.exit(code ?? 0));
}

async function main() {
  const command = positional()[0];
  if (!command || command === 'help' || command === '--help' || command === '-h') {
    usage();
    return;
  }

  const config = flag('--url') && flag('--token')
    ? { url: flag('--url'), token: flag('--token') }
    : readConfig();

  if (command === 'mcp') {
    return runMcp(config);
  }

  if (!config) {
    fail(
      'Tecton is not reachable. Start Tecton once so it can create integrations.json, ' +
      'or pass --url and --token.'
    );
  }

  try {
    switch (command) {
      case 'status': {
        const status = await api(config, '/api/v1/status');
        if (jsonOutput) return print(status);
        process.stdout.write(`Tecton ${status.version} - API v${status.apiVersion}\n`);
        process.stdout.write(`Projects: ${status.counts.projects}  Workers: ${status.counts.workers}  Cash rows: ${status.counts.cash}\n`);
        return;
      }
      case 'projects': {
        const payload = await api(config, '/api/v1/projects');
        return print(jsonOutput ? payload.items : payload.items);
      }
      case 'workers': {
        const project = flag('--project');
        const limit = flag('--limit', '100');
        const query = new URLSearchParams({ limit });
        if (project) query.set('projectId', project);
        const payload = await api(config, `/api/v1/workers?${query.toString()}`);
        return print(payload.items);
      }
      case 'cash': {
        const project = flag('--project');
        const limit = flag('--limit', '50');
        const query = new URLSearchParams({ limit });
        if (project) query.set('projectId', project);
        const payload = await api(config, `/api/v1/cash?${query.toString()}`);
        return print(payload.items);
      }
      case 'summary': {
        const project = flag('--project');
        const query = project ? `?projectId=${encodeURIComponent(project)}` : '';
        const payload = await api(config, `/api/v1/summary${query}`);
        return print(payload);
      }
      case 'docs': {
        const query = positional().slice(1).join(' ').trim();
        if (!query) fail('docs requires a query');
        const payload = await api(config, `/api/v1/docs/search?q=${encodeURIComponent(query)}`);
        if (jsonOutput) return print(payload);
        for (const result of payload.results) {
          process.stdout.write(`\n[${result.id}] ${result.title}\n${result.body}\n`);
        }
        return;
      }
      case 'ask': {
        const question = positional().slice(1).join(' ').trim();
        if (!question) fail('ask requires a question');
        const payload = await api(config, '/api/v1/ai/ask', { method: 'POST', body: { question } });
        if (jsonOutput) return print(payload);
        process.stdout.write(`${payload.answer}\n`);
        if (payload.citations?.length) {
          process.stdout.write(`\nSources: ${payload.citations.map((item) => item.title).join(', ')}\n`);
        }
        return;
      }
      case 'webhooks': {
        const payload = await api(config, '/api/v1/webhooks');
        return print(payload.items);
      }
      default:
        usage();
        fail(`unknown command: ${command}`);
    }
  } catch (error) {
    fail(error.message);
  }
}

main().catch((error) => fail(error?.message || 'unexpected error'));
