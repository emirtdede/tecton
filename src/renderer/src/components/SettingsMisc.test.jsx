// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, f) => f || k, i18n: { language: 'tr', changeLanguage: vi.fn() } }),
}));

import SystemLogs from './SystemLogs';
import SettingsFinanceTab from './SettingsFinanceTab';
import SettingsRecycleTab from './SettingsRecycleTab';
import { mockApi } from '../utils/apiMock';

describe('SystemLogs', () => {
  it('renders log lines from api', async () => {
    mockApi({
      system: { readLogs: vi.fn(async () => ({ success: true, logs: ['[2026-10-01] [info] Test logu'] })) },
      db: { read: vi.fn(async () => []) },
    });
    render(<SystemLogs />);
    expect(await screen.findByText(/Test logu/)).toBeInTheDocument();
  });

  it('filter narrows visible lines', async () => {
    const user = userEvent.setup();
    mockApi({
      system: { readLogs: vi.fn(async () => ({ success: true, logs: ['[info] Alfa satiri', '[info] Beta satiri'] })) },
      db: { read: vi.fn(async () => []) },
    });
    render(<SystemLogs />);
    await screen.findByText(/Alfa satiri/);
    const input = screen.getByPlaceholderText(/Ara|ara|search/i);
    await user.type(input, 'Beta');
    expect(screen.queryByText(/Alfa satiri/)).not.toBeInTheDocument();
    expect(screen.getByText(/Beta satiri/)).toBeInTheDocument();
  });
});

describe('SettingsFinanceTab', () => {
  const props = {
    t: (k, f) => f || k, appSettings: [], workTypes: [], workerGroups: [],
    fetchData: vi.fn(), handleSettingChange: vi.fn(), handleSettingBlur: vi.fn(), setModalConfig: vi.fn(),
  };

  it('renders parameters and work type form', () => {
    mockApi();
    render(<SettingsFinanceTab {...props} />);
    expect(screen.getByText(/Parametre|parameter/i)).toBeInTheDocument();
  });

  it('add work type calls api and refreshes', async () => {
    const user = userEvent.setup();
    const api = mockApi();
    const fetchData = vi.fn();
    render(<SettingsFinanceTab {...props} fetchData={fetchData} />);
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'Gece Mesaisi');
    const mult = screen.getAllByRole('spinbutton');
    await user.clear(mult[0]);
    await user.type(mult[0], '2');
    const adds = screen.getAllByText('Ekle');
    await user.click(adds[0]);
    expect(api.db.create).toHaveBeenCalledWith('work_types', expect.objectContaining({ name: 'Gece Mesaisi' }));
  });
});

describe('SettingsRecycleTab', () => {
  it('loads deleted items', async () => {
    mockApi({
      db: {
        readDeleted: vi.fn(async () => [
          { id: 5, table: 'workers', table_name: 'workers', record_id: 1, title: 'Ali', deleted_at: '2026-10-01', is_deleted: 1, project_id: 1, project_name: 'S1' },
        ]),
        readAllProjects: vi.fn(async () => []),
      },
    });
    render(<SettingsRecycleTab setModalConfig={vi.fn()} setIsGuideOpen={vi.fn()} />);
    expect(await screen.findByText('Ali')).toBeInTheDocument();
  });
});
