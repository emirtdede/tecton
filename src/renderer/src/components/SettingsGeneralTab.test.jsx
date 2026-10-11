// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, f) => f || k, i18n: { language: 'tr', changeLanguage: vi.fn() } }),
}));

import SettingsGeneralTab from './SettingsGeneralTab';

const settings = [
  { id: 1, setting_key: 'theme', setting_value: 'dark' },
  { id: 2, setting_key: 'language', setting_value: 'tr' },
  { id: 3, setting_key: 'company_name', setting_value: '' },
];

describe('SettingsGeneralTab', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'api', {
      value: { db: { update: vi.fn().mockResolvedValue({ success: true }) }, system: { changeDesktopIcon: vi.fn() } },
      writable: true,
      configurable: true,
    });
  });

  const props = {
    t: (k, f) => f || k,
    appSettings: settings,
    tempCompanyName: '',
    setTempCompanyName: () => {},
    tempCompanyLogo: '',
    handleSettingChange: () => {},
    handleSettingBlur: () => {},
    handleDesktopIconChange: () => {},
    handleLogoUpload: () => {},
    handleRemoveLogo: () => {},
    handleSaveCompanyInfo: () => {},
  };

  it('renders theme and language selects', () => {
    render(<SettingsGeneralTab {...props} />);
    expect(screen.getByText('Görünüm ve Dil')).toBeInTheDocument();
    const selects = screen.getAllByRole('combobox');
    expect(selects[0]).toHaveValue('dark');
    expect(selects[1]).toHaveValue('tr');
  });

  it('save company button calls handler', async () => {
    const user = userEvent.setup();
    const handleSaveCompanyInfo = vi.fn();
    render(<SettingsGeneralTab {...props} handleSaveCompanyInfo={handleSaveCompanyInfo} />);
    await user.click(screen.getByText('Kaydet'));
    expect(handleSaveCompanyInfo).toHaveBeenCalledTimes(1);
  });

  it('desktop icon buttons call handler with theme', async () => {
    const user = userEvent.setup();
    const handleDesktopIconChange = vi.fn();
    render(<SettingsGeneralTab {...props} handleDesktopIconChange={handleDesktopIconChange} />);
    await user.click(screen.getByText('Koyu İkon'));
    expect(handleDesktopIconChange).toHaveBeenCalledWith('dark');
  });
});
