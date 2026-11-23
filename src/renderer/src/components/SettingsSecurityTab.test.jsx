// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: (() => {
    // Stable identity: production i18next returns a memoised `t`, and effects
    // that list `t` in their dependency array would otherwise loop forever.
    const t = (k, f) => f || k;
    const i18n = { language: 'tr', changeLanguage: vi.fn() };
    return () => ({ t, i18n });
  })(),
}));

import SettingsSecurityTab from './SettingsSecurityTab';

describe('SettingsSecurityTab', () => {
  const backupDB = vi.fn();
  const setModalConfig = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'api', {
      value: { system: { backupDB, vacuumDB: vi.fn(), setCloudFolder: vi.fn(), openOldBackupsFolder: vi.fn() } },
      writable: true,
      configurable: true,
    });
  });

  const props = {
    t: (k, f) => f || k,
    appSettings: [],
    fetchData: vi.fn(),
    setModalConfig,
  };

  it('backup button triggers backupDB + success toast', async () => {
    const user = userEvent.setup();
    backupDB.mockResolvedValue({ success: true });
    const events = [];
    const listener = (e) => events.push(e.detail);
    window.addEventListener('show-toast', listener);
    render(<SettingsSecurityTab {...props} />);
    await user.click(screen.getByText(/Tüm Veritabanını Yedekle/));
    expect(backupDB).toHaveBeenCalledTimes(1);
    expect(events.some((d) => d.type === 'success')).toBe(true);
    window.removeEventListener('show-toast', listener);
  });

  it('vacuum button opens confirm modal', async () => {
    const user = userEvent.setup();
    render(<SettingsSecurityTab {...props} />);
    await user.click(screen.getByText(/Optimize Et/));
    expect(setModalConfig).toHaveBeenCalledWith(expect.objectContaining({ isOpen: true }));
  });

  it('backup failure surfaces error toast', async () => {
    const user = userEvent.setup();
    backupDB.mockResolvedValue({ success: false, message: 'disk dolu' });
    const events = [];
    const listener = (e) => events.push(e.detail);
    window.addEventListener('show-toast', listener);
    render(<SettingsSecurityTab {...props} />);
    await user.click(screen.getByText(/Tüm Veritabanını Yedekle/));
    expect(events.some((d) => d.type === 'error')).toBe(true);
    window.removeEventListener('show-toast', listener);
  });
});
