/**
 * integrationRuntime.js
 *
 * Glue between Electron and the integration layer:
 *   - starts/stops the local API according to a persisted setting;
 *   - registers every IPC channel used by the Integrations and AI pages;
 *   - forwards record mutations to webhooks without ever blocking the write.
 *
 * A dedicated module keeps `ipcHandlers.js` (already large) free of a second
 * concern and makes the whole integration layer testable without Electron.
 */

const path = require('path');
const { ipcMain, app, shell } = require('electron');
const logger = require('../logger');
const aiService = require('./ai/aiService');
const rag = require('./ai/rag');
const webhooks = require('./webhooks');
const localApi = require('./localApi');
const { getDB } = require('../database/db');

const SETTING_KEY = 'integrations_enabled';
let configured = false;
let enabled = true;

function stateDir() {
  return app.getPath('userData');
}

function version() {
  try {
    return app.getVersion();
  } catch {
    return '1.0.0';
  }
}

function configure() {
  if (configured) return;
  configured = true;
  aiService.configure({ stateDir: stateDir() });
  webhooks.configure({ stateDir: stateDir() });
  localApi.configure({
    database: getDB,
    ai: aiService,
    webhooks,
    stateDir: stateDir(),
    version: version(),
  });
}

async function readEnabled() {
  try {
    const db = await getDB();
    const row = await db.get('SELECT setting_value FROM app_settings WHERE setting_key = ?', [SETTING_KEY]);
    return row ? row.setting_value !== '0' : true;
  } catch {
    return true;
  }
}

async function persistEnabled(value) {
  try {
    const db = await getDB();
    const row = await db.get('SELECT id FROM app_settings WHERE setting_key = ?', [SETTING_KEY]);
    if (row) {
      await db.run('UPDATE app_settings SET setting_value = ? WHERE id = ?', [value ? '1' : '0', row.id]);
    } else {
      await db.run(
        'INSERT INTO app_settings (setting_key, setting_value, description) VALUES (?, ?, ?)',
        [SETTING_KEY, value ? '1' : '0', 'Local API, MCP, CLI and webhooks']
      );
    }
  } catch (error) {
    logger.warn('[Integrations] setting persist failed:', error?.message);
  }
}

async function init() {
  configure();
  enabled = await readEnabled();
  await aiService.readState();
  await webhooks.load();
  if (enabled) {
    const result = await localApi.start();
    if (!result.success) logger.warn('[Integrations] local API unavailable:', result.code);
  }
}

async function setEnabled(value) {
  if (enabled === value) return { success: true, enabled };
  enabled = value;
  await persistEnabled(value);
  if (value) {
    const result = await localApi.start();
    return { success: result.success, enabled, code: result.code };
  }
  await localApi.stop();
  return { success: true, enabled };
}

/** Fire-and-forget event used by the write handlers. */
function notify(table, action, id) {
  if (!enabled) return;
  const event = action === 'create'
    ? 'record.created'
    : action === 'delete'
      ? 'record.deleted'
      : 'record.updated';
  webhooks.emit(event, { table, id: id ?? null });
}

/** Sends an app-level event (backup, update) when integrations are on. */
function emitEvent(event, data) {
  if (!enabled) return;
  webhooks.emit(event, data || {});
}

// In a packaged build the scripts live outside app.asar (Node cannot read an
// asar archive), copied there by the `extraResources` entry. In development
// they are read straight from the repository.
function integrationScript(...segments) {
  const base = app.isPackaged
    ? path.join(process.resourcesPath, 'integrations')
    : path.join(app.getAppPath(), 'src');
  return path.join(base, ...segments);
}

// Tecton ships no separate Node runtime. Electron itself runs the scripts when
// ELECTRON_RUN_AS_NODE is set, which is the standard way to expose a CLI from
// an Electron app without doubling the installer size.
function nodeCommand(script) {
  return {
    command: process.execPath,
    args: [script],
    env: { ELECTRON_RUN_AS_NODE: '1' },
    windows: `set ELECTRON_RUN_AS_NODE=1 && "${process.execPath}" "${script}"`,
  };
}

function mcpCommand() {
  return nodeCommand(integrationScript('mcp', 'server.js'));
}

function cliCommand() {
  return nodeCommand(integrationScript('cli', 'tecton.js'));
}

function registerHandlers() {
  ipcMain.handle('integrations:status', async () => {
    const api = localApi.info();
    return {
      success: true,
      enabled,
      api: { running: api.running, port: api.port, url: api.url, token: api.token, configPath: api.configPath, error: api.error },
      events: webhooks.EVENTS,
      commands: { mcp: mcpCommand(), cli: cliCommand() },
    };
  });

  ipcMain.handle('integrations:set-enabled', async (_, { enabled: value } = {}) => {
    return setEnabled(!!value);
  });

  ipcMain.handle('integrations:copy-config', async () => {
    const api = localApi.info();
    return { success: true, url: api.url, token: api.token };
  });

  ipcMain.handle('integrations:webhooks:list', async () => {
    return { success: true, items: await webhooks.list() };
  });

  ipcMain.handle('integrations:webhooks:save', async (_, payload) => {
    return webhooks.upsert(payload || {});
  });

  ipcMain.handle('integrations:webhooks:delete', async (_, { id } = {}) => {
    return webhooks.remove(String(id || ''));
  });

  ipcMain.handle('integrations:webhooks:test', async (_, { id } = {}) => {
    return webhooks.test(String(id || ''));
  });

  ipcMain.handle('integrations:open-config-folder', async () => {
    const api = localApi.info();
    if (!api.configPath) return { success: false, code: 'not_configured' };
    const result = await shell.openPath(path.dirname(api.configPath));
    return result ? { success: false, code: 'open_failed' } : { success: true };
  });

  ipcMain.handle('ai:status', async () => {
    return { success: true, ...(await aiService.status()) };
  });

  ipcMain.handle('ai:download', async (event, { model } = {}) => {
    const sender = event.sender;
    const result = await aiService.pullModel(String(model || ''), (progress) => {
      if (!sender.isDestroyed()) sender.send('ai:download-progress', progress);
    });
    return result;
  });

  ipcMain.handle('ai:delete', async (_, { model } = {}) => {
    return aiService.deleteModel(String(model || ''));
  });

  ipcMain.handle('ai:activate', async (_, { model } = {}) => {
    return aiService.activateModel(String(model || ''));
  });

  ipcMain.handle('ai:deactivate', async () => {
    return aiService.deactivateModel();
  });

  ipcMain.handle('ai:ask', async (_, { question, locale } = {}) => {
    return aiService.ask(String(question || ''), { locale });
  });

  ipcMain.handle('ai:docs-search', async (_, { query, locale, limit } = {}) => {
    return { success: true, results: rag.search(String(query || ''), { locale, limit }) };
  });

  ipcMain.handle('ai:open-runtime', async () => {
    const result = await shell.openExternal('https://ollama.com/download/windows');
    return { success: !result };
  });
}

async function shutdown() {
  await webhooks.close();
  await localApi.stop();
}

module.exports = {
  init,
  configure,
  registerHandlers,
  setEnabled,
  notify,
  emitEvent,
  shutdown,
  mcpCommand,
  cliCommand,
};
