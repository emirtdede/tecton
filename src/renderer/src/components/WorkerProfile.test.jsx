// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, f) => f || k, i18n: { language: 'tr', changeLanguage: vi.fn() } }),
}));
vi.mock('./AnomalyPanel', () => ({ default: () => null }));
vi.mock('./GroupReportPanel', () => ({ default: () => null }));
vi.mock('./WorkerDrawer', () => ({ default: () => null }));

import WorkerProfile from './WorkerProfile';
import { mockApi } from '../utils/apiMock';

const worker = { id: 1, full_name: 'Test Iscisi', phone: '555', daily_wage: 1000, project_id: 1, group_id: null, tags: '[]' };

describe('WorkerProfile (parent smoke)', () => {
  it('renders identity and tabs after fetch', async () => {
    mockApi();
    render(<WorkerProfile worker={worker} onBack={() => {}} />);
    expect(await screen.findByText('Test Iscisi')).toBeInTheDocument();
  });

  it('back button works', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    mockApi();
    render(<WorkerProfile worker={worker} onBack={onBack} />);
    await screen.findByText('Test Iscisi');
    const btns = screen.getAllByRole('button');
    await user.click(btns[0]);
    expect(onBack).toHaveBeenCalled();
  });
});
