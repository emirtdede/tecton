// Shared window.api mock for parent component smoke tests (test-only helper).
import { vi } from 'vitest';

export function mockApi(overrides = {}) {
  const db = {
    read: vi.fn(async () => []),
    create: vi.fn(async () => ({ success: true, id: 1 })),
    update: vi.fn(async () => ({ success: true })),
    delete: vi.fn(async () => ({ success: true })),
    createBulk: vi.fn(async () => ({ success: true })),
    readDeleted: vi.fn(async () => []),
    readAllProjects: vi.fn(async () => []),
    restoreRecord: vi.fn(async () => ({ success: true })),
    ...(overrides.db || {}),
  };
  const finance = {
    getBalance: vi.fn(async () => ({ success: true, balance: 0 })),
    getBalances: vi.fn(async () => ({ success: true, balances: {} })),
    calculateWage: vi.fn(async () => ({ success: true, wage: 1000 })),
    deleteTransaction: vi.fn(async () => ({ success: true })),
    createAdvance: vi.fn(async () => ({ success: true })),
    workerReport: vi.fn(async () => ({ success: true })),
    workerStatement: vi.fn(async () => ({ success: true, timesheets: [], transactions: [], summary: null })),
    companyReport: vi.fn(async () => ({ success: true, summary: { totalWageCost: 0, totalCashIn: 0, totalCashOut: 0, netCashFlow: 0 } })),
    groupStatement: vi.fn(async () => ({ success: true, groups: [] })),
    ...(overrides.finance || {}),
  };
  const system = {
    backupDB: vi.fn(async () => ({ success: true })),
    readLogs: vi.fn(async () => []),
    vacuumDB: vi.fn(async () => ({ success: true })),
    setCloudFolder: vi.fn(async () => ({ success: true })),
    getWeather: vi.fn(async () => ({ success: false, errorType: 'missing_key' })),
    startLANServer: vi.fn(async () => ({ success: true })),
    stopLANServer: vi.fn(async () => ({ success: true })),
    ...(overrides.system || {}),
  };
  const media = {
    readPhoto: vi.fn(async () => ({ success: false })),
    savePhotoBase64: vi.fn(async () => ({ success: false })),
    ...(overrides.media || {}),
  };
  const api = { db, finance, system, media, ...(overrides.extra || {}) };
  Object.defineProperty(window, 'api', { value: api, writable: true, configurable: true });
  return api;
}

export function mockI18n() {
  return { t: (k, f) => f || k, i18n: { language: 'tr', changeLanguage: vi.fn() } };
}
