// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, f) => f || k, i18n: { language: 'tr', changeLanguage: vi.fn() } }),
}));
vi.mock('./components/AnomalyPanel', () => ({ default: () => null }));
vi.mock('./components/GroupReportPanel', () => ({ default: () => null }));
vi.mock('./components/WorkerDrawer', () => ({ default: () => null }));

import App from './App';

function apiFor() {
  const db = {
    read: vi.fn(async (table) => {
      if (table === 'workers') return [{ id: 1, full_name: 'Ali Veli', phone: '', daily_wage: 1000, group_id: null, project_id: 1, status: 'active' }];
      if (table === 'worker_groups') return [];
      if (table === 'projects') return [{ id: 1, name: 'S1' }];
      if (table === 'app_settings') return [
        { id: 1, setting_key: 'theme', setting_value: 'dark' },
        { id: 2, setting_key: 'language', setting_value: 'tr' },
      ];
      return [];
    }),
    create: vi.fn(async () => ({ success: true, id: 9 })),
    update: vi.fn(async () => ({ success: true })),
    delete: vi.fn(async () => ({ success: true })),
  };
  const api = {
    db,
    finance: { getBalances: vi.fn(async () => ({ success: true, balances: { 1: 100 } })) },
    window: { appReady: vi.fn() },
    system: { onShutdownStarting: vi.fn(() => () => {}) },
  };
  Object.defineProperty(window, 'api', { value: api, writable: true, configurable: true });
  return api;
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('dashboard_view_mode', 'list');
});

describe('App router', () => {
  it('boots to dashboard with sidebar and workers', async () => {
    apiFor();
    const { container } = render(<App />);
    expect(await screen.findByText('Ali Veli')).toBeInTheDocument();
    expect(container.querySelector('.sidebar')).toBeTruthy();
  });

  it('welcome modal shows on first run, dismiss persists', async () => {
    const user = userEvent.setup();
    apiFor();
    render(<App />);
    await screen.findByText('Ali Veli');
    const checks = screen.getAllByRole('checkbox');
    await user.click(checks[0]);
    const btns = screen.getAllByRole('button');
    const start = btns.find((b) => /Başla|Get Started|welcome/i.test(b.textContent));
    if (start) await user.click(start);
    expect(localStorage.getItem('hide_welcome_modal')).toBe('true');
  });

  it('sidebar navigates to projects view', async () => {
    const user = userEvent.setup();
    apiFor();
    const { container } = render(<App />);
    await screen.findByText('Ali Veli');
    const sidebar = container.querySelector('.sidebar');
    const links = within(sidebar).getAllByText(/Şantiye|proje|Project/i);
    await user.click(links[0]);
    expect(await screen.findByText(/Şantiye \(Lokasyon\)|Lokasyon/)).toBeInTheDocument();
  });
});
