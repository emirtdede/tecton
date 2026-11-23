// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: (() => {
    // Stable identity: production i18next returns a memoised `t`, and effects
    // that list `t` in their dependency array would otherwise loop forever.
    const t = (k, f) => f || k;
    const i18n = { language: 'tr', changeLanguage: vi.fn() };
    return () => ({ t, i18n });
  })(),
  initReactI18next: { type: '3rdParty', init: () => {} },
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
  window.localStorage.clear();
  window.localStorage.setItem('dashboard_view_mode', 'list');
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
    // The first-run experience is the onboarding wizard: leaving it (skip on
    // the first step) must persist the dismissal flag.
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getAllByRole('button', { name: /Skip|Atla/i })[0]);
    expect(window.localStorage.getItem('hide_welcome_modal')).toBe('true');
  });

  it('sidebar navigates to projects view', async () => {
    const user = userEvent.setup();
    apiFor();
    // Skip the first-run wizard so the sidebar is not covered by the modal.
    window.localStorage.setItem('hide_welcome_modal', 'true');
    const { container } = render(<App />);
    await screen.findByText('Ali Veli');
    const sidebar = container.querySelector('.sidebar');
    // The group heading repeats the same label key, so target the nav button.
    const projectsNav = within(sidebar)
      .getAllByRole('button')
      .find((btn) => /proje|project|şantiye/i.test(btn.textContent));
    await user.click(projectsNav);
    expect(await screen.findByRole('heading', { name: /Şantiyeler|Projeler/i })).toBeInTheDocument();
  });
});
