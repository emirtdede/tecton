/**
 * aiService.js
 *
 * Local AI for Tecton. The runtime is Ollama, which is a normal Windows
 * application the user installs once; Tecton never bundles a 100 MB native
 * inference engine and therefore never breaks an installer build.
 *
 * Responsibilities:
 *   - detect a running Ollama instance (localhost only);
 *   - list, download, delete and activate/deactivate models;
 *   - answer questions using the local RAG corpus as grounding;
 *   - degrade to a clean extractive answer when no model is available.
 *
 * Nothing here talks to a remote service. Requests are hard-wired to a
 * loopback URL and a short timeout, so a missing runtime is a state, not an
 * error the UI has to explain in raw English.
 */

const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const { profile } = require('./systemProfile');
const rag = require('./rag');

const DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
const DETECT_TIMEOUT_MS = 1800;
const CHAT_TIMEOUT_MS = 90000;

/**
 * Catalogue shown before anything is installed. Sizes are approximate download
 * sizes published by the Ollama library and are used only for the UI label.
 */
const CATALOGUE = [
  { id: 'llama3.2:1b', sizeGb: 1.3, tier: 'light', params: '1B' },
  { id: 'llama3.2:3b', sizeGb: 2.0, tier: 'balanced', params: '3B' },
  { id: 'qwen2.5:3b', sizeGb: 1.9, tier: 'balanced', params: '3B' },
  { id: 'qwen2.5:7b', sizeGb: 4.7, tier: 'high', params: '7B' },
  { id: 'llama3.1:8b', sizeGb: 4.9, tier: 'high', params: '8B' },
];

let state = {
  baseUrl: DEFAULT_BASE_URL,
  stateDir: null,
  activeModel: null,
  runtime: null,
  runtimeCheckedAt: 0,
  pulling: null,
};

function configure({ stateDir, baseUrl } = {}) {
  if (stateDir) state.stateDir = stateDir;
  if (baseUrl) state.baseUrl = String(baseUrl).replace(/\/+$/, '');
}

function stateFile() {
  return state.stateDir ? path.join(state.stateDir, 'ai.json') : null;
}

async function readState() {
  const file = stateFile();
  if (!file) return;
  try {
    const raw = JSON.parse(await fsp.readFile(file, 'utf8'));
    if (raw && typeof raw.activeModel === 'string') state.activeModel = raw.activeModel;
  } catch {
    // A missing or unreadable file simply means "no model selected".
  }
}

async function writeState() {
  const file = stateFile();
  if (!file) return;
  const payload = JSON.stringify({ activeModel: state.activeModel }, null, 2);
  const temp = `${file}.tmp-${process.pid}`;
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(temp, payload, 'utf8');
  await fsp.rename(temp, file);
}

function endpoint(pathname) {
  return `${state.baseUrl}${pathname}`;
}

async function request(pathname, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeout || DETECT_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint(pathname), {
      ...options,
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

/** @returns {Promise<{available:boolean, version?:string, models?:string[]}>} */
async function detectRuntime({ force = false } = {}) {
  const now = Date.now();
  if (!force && state.runtime && now - state.runtimeCheckedAt < 15000) return state.runtime;
  try {
    const response = await request('/api/tags');
    if (!response.ok) throw new Error(String(response.status));
    const payload = await response.json();
    const models = Array.isArray(payload?.models)
      ? payload.models.map((model) => model.name).filter(Boolean)
      : [];
    state.runtime = { available: true, models };
  } catch {
    state.runtime = { available: false, models: [] };
  }
  state.runtimeCheckedAt = now;
  return state.runtime;
}

async function installedModels() {
  const runtime = await detectRuntime();
  return runtime.available ? runtime.models : [];
}

/**
 * Download a model. Progress is streamed through `onProgress` as
 * `{status, completed, total, percent}` and never throws for a network error;
 * the caller receives `{success:false, code}`.
 */
async function pullModel(modelId, onProgress) {
  if (!CATALOGUE.some((entry) => entry.id === modelId)) {
    return { success: false, code: 'unknown_model' };
  }
  if (state.pulling) return { success: false, code: 'busy' };

  const runtime = await detectRuntime({ force: true });
  if (!runtime.available) return { success: false, code: 'runtime_missing' };

  state.pulling = modelId;
  try {
    const response = await request('/api/pull', {
      method: 'POST',
      body: JSON.stringify({ name: modelId, stream: true }),
      timeout: 30 * 60 * 1000,
    });
    if (!response.ok || !response.body) {
      return { success: false, code: 'pull_failed' };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          if (event.error) return { success: false, code: 'pull_failed' };
          const total = Number(event.total) || 0;
          const completed = Number(event.completed) || 0;
          onProgress?.({
            modelId,
            status: event.status || 'downloading',
            completed,
            total,
            percent: total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0,
          });
        } catch {
          // A partial line is expected while streaming; ignore it.
        }
      }
    }
    state.runtimeCheckedAt = 0;
    await detectRuntime({ force: true });
    return { success: true };
  } catch (error) {
    return { success: false, code: error?.name === 'AbortError' ? 'timeout' : 'pull_failed' };
  } finally {
    state.pulling = null;
  }
}

async function deleteModel(modelId) {
  const runtime = await detectRuntime();
  if (!runtime.available) return { success: false, code: 'runtime_missing' };
  try {
    const response = await request('/api/delete', {
      method: 'DELETE',
      body: JSON.stringify({ name: modelId }),
    });
    if (!response.ok) return { success: false, code: 'delete_failed' };
    if (state.activeModel === modelId) {
      state.activeModel = null;
      await writeState();
    }
    state.runtimeCheckedAt = 0;
    await detectRuntime({ force: true });
    return { success: true };
  } catch {
    return { success: false, code: 'delete_failed' };
  }
}

async function activateModel(modelId) {
  const runtime = await detectRuntime();
  if (!runtime.available) return { success: false, code: 'runtime_missing' };
  if (!runtime.models.includes(modelId)) return { success: false, code: 'not_installed' };
  state.activeModel = modelId;
  await writeState();
  return { success: true };
}

/** Unload the model from RAM and clear the selection. */
async function deactivateModel() {
  const previous = state.activeModel;
  state.activeModel = null;
  await writeState();
  if (previous) {
    try {
      await request('/api/generate', {
        method: 'POST',
        body: JSON.stringify({ model: previous, keep_alive: 0, prompt: '' }),
        timeout: 5000,
      });
    } catch {
      // Unloading is best-effort; the selection is already cleared.
    }
  }
  return { success: true, previous };
}

async function status() {
  const [system, runtime] = await Promise.all([profile(), detectRuntime()]);
  const installed = runtime.available ? runtime.models : [];
  return {
    runtime: {
      available: runtime.available,
      baseUrl: state.baseUrl,
      // A model is usable only when the runtime is up and the model is present.
      ready: runtime.available && !!state.activeModel && installed.includes(state.activeModel),
    },
    activeModel: state.activeModel,
    system,
    rag: rag.stats(),
    models: CATALOGUE.map((entry) => ({
      ...entry,
      // Exactly one row is recommended: the tier's pinned model, not every
      // catalogue entry that happens to share the tier.
      recommended: entry.id === system.tier.model,
      installed: installed.includes(entry.id),
      active: state.activeModel === entry.id,
    })),
    extraInstalled: installed.filter((name) => !CATALOGUE.some((entry) => entry.id === name)),
    pulling: state.pulling,
  };
}

function buildPrompt(question, context) {
  return [
    'You are the Tecton assistant. Answer in the same language as the question.',
    'Use only the context below. If the context does not contain the answer, say so plainly.',
    'Cite the bracketed source numbers you used, for example [1]. Keep the answer under 150 words.',
    '',
    'Context:',
    context,
    '',
    `Question: ${question}`,
  ].join('\n');
}

/**
 * @param {string} question
 * @param {{locale?: string}} [options]
 */
async function ask(question, options = {}) {
  const text = String(question || '').trim();
  if (!text) return { success: false, code: 'empty_question' };

  const grounded = rag.contextForPrompt(text, { locale: options.locale, limit: 4 });

  if (grounded.citations.length === 0) {
    const fallback = rag.extractiveAnswer(text, { locale: options.locale });
    return { success: true, ...fallback, model: null, mode: 'knowledge' };
  }

  const runtime = await detectRuntime();
  const model = state.activeModel;
  if (!runtime.available || !model || !runtime.models.includes(model)) {
    const fallback = rag.extractiveAnswer(text, { locale: options.locale });
    return { success: true, ...fallback, model: null, mode: 'knowledge' };
  }

  try {
    const response = await request('/api/chat', {
      method: 'POST',
      timeout: CHAT_TIMEOUT_MS,
      body: JSON.stringify({
        model,
        stream: false,
        keep_alive: '5m',
        options: { temperature: 0.2, num_predict: 320 },
        messages: [
          { role: 'system', content: 'You answer strictly from the supplied Tecton context.' },
          { role: 'user', content: buildPrompt(text, grounded.text) },
        ],
      }),
    });
    if (!response.ok) throw new Error(String(response.status));
    const payload = await response.json();
    const answer = String(payload?.message?.content || '').trim();
    if (!answer) throw new Error('empty');
    return { success: true, answer, citations: grounded.citations, grounded: true, model, mode: 'model' };
  } catch {
    const fallback = rag.extractiveAnswer(text, { locale: options.locale });
    return { success: true, ...fallback, model: null, mode: 'knowledge', degraded: true };
  }
}

async function searchDocs(query, options = {}) {
  return { success: true, results: rag.search(query, options) };
}

/** Used by tests to reset module-level caches. */
function _reset() {
  state.runtime = null;
  state.runtimeCheckedAt = 0;
  state.activeModel = null;
  state.pulling = null;
}

module.exports = {
  CATALOGUE,
  configure,
  readState,
  status,
  detectRuntime,
  pullModel,
  deleteModel,
  activateModel,
  deactivateModel,
  ask,
  searchDocs,
  _reset,
};
