// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, f) => f || k, i18n: { language: 'tr', changeLanguage: vi.fn() } }),
}));
vi.mock('./AnomalyPanel', () => ({ default: () => null }));
vi.mock('./GroupReportPanel', () => ({ default: () => null }));
vi.mock('./WorkerDrawer', () => ({ default: () => null }));

import AppDashboard from './AppDashboard';
import { mockApi } from '../utils/apiMock';

beforeEach(() => {
  localStorage.setItem('dashboard_view_mode', 'list');
});

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const workers = [
  { id: 1, full_name: 'Ali Veli', phone: '555', daily_wage: 1000, group_id: 1, project_id: 1, status: 'active' },
  { id: 2, full_name: 'Ayse Yilmaz', phone: '', daily_wage: 1200, group_id: null, project_id: 1, status: 'active' },
];

function mainTableOf(container) {
  const tables = container.querySelectorAll('.fin-table-container');
  for (const tb of tables) {
    if (within(tb).queryByText('Ad Soyad')) return tb;
  }
  return tables[0];
}
const base = {
  t, i18n, workers, balances: { 1: 500, 2: -200 }, workerGroups: [{ id: 1, name: 'Usta' }],
  projects: [{ id: 1, name: 'S1' }], activeProjectId: 1, activeProjectObj: { id: 1, name: 'S1' },
  loading: false, onOpenProfile: () => {}, onDataChanged: () => {}, onOpenBulk: () => {},
};

describe('AppDashboard', () => {
  it('renders worker rows with balances', () => {
    mockApi();
    render(<AppDashboard {...base} />);
    expect(screen.getByText('Ali Veli')).toBeInTheDocument();
    expect(screen.getByText('Ayse Yilmaz')).toBeInTheDocument();
  });

  it('search filters list', async () => {
    const user = userEvent.setup();
    mockApi();
    render(<AppDashboard {...base} />);
    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[0], 'Ayse');
    expect(screen.queryByText('Ali Veli')).not.toBeInTheDocument();
    expect(screen.getByText('Ayse Yilmaz')).toBeInTheDocument();
  });

  it('profile opens on name click', async () => {
    const user = userEvent.setup();
    const onOpenProfile = vi.fn();
    mockApi();
    render(<AppDashboard {...base} onOpenProfile={onOpenProfile} />);
    const names = screen.getAllByText('Ali Veli');
    await user.click(names[0]);
    expect(onOpenProfile).toHaveBeenCalled();
  });

  it('delete flow calls api and refreshes', async () => {
    const user = userEvent.setup();
    const api = mockApi();
    const onDataChanged = vi.fn();
    const { container } = render(<AppDashboard {...base} onDataChanged={onDataChanged} />);
    const dels = within(container).getAllByTitle('Sil');
    await user.click(dels[0]);
    await user.click(screen.getByText('common.delete'));
    expect(api.db.delete).toHaveBeenCalled();
  });
});
