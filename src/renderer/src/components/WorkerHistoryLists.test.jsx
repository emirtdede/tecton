// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
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

import WorkerHistoryLists from './WorkerHistoryLists';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const cReport = { devredenBakiye: 100, donemHakEdis: 0, donemAvans: 0, yeniBakiye: 100, islemler: [] };
const noop = () => {};
const base = {
  t, i18n, onBottomTabClick: noop, filterStartDate: '', filterEndDate: '',
  onStartDateChange: noop, onEndDateChange: noop, timesheets: [], transactions: [],
  workerLeaves: [], workTypes: [], cReport, pagePuantaj: 1, setPagePuantaj: noop,
  pageAvans: 1, setPageAvans: noop, pageRapor: 1, setPageRapor: noop,
  pageIzin: 1, setPageIzin: noop, onDeleteTimesheet: noop, onDeleteTransaction: noop, onDeleteLeave: noop,
};

describe('WorkerHistoryLists', () => {
  it('renders puantaj empty state', () => {
    render(<WorkerHistoryLists {...base} activeTab="puantaj" />);
    expect(screen.getByText('worker_profile.no_timesheet')).toBeInTheDocument();
  });

  it('renders timesheet rows with wage', () => {
    const timesheets = [{ id: 1, work_date: '2026-10-01', work_type_id: 1, applied_wage: 1000, applied_multiplier: 1, overtime_hours: 0, earned_amount: 1000, notes: '' }];
    render(<WorkerHistoryLists {...base} activeTab="puantaj" timesheets={timesheets} workTypes={[{ id: 1, name: 'Tam Gün' }]} />);
    expect(screen.getAllByText(/1\.000 ₺/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Tam Gün')).toBeInTheDocument();
  });

  it('delete button calls handler', async () => {
    const user = userEvent.setup();
    const onDeleteTimesheet = vi.fn();
    const timesheets = [{ id: 7, work_date: '2026-10-01', work_type_id: 1, applied_wage: 1000, applied_multiplier: 1, overtime_hours: 0, earned_amount: 1000, notes: '' }];
    render(<WorkerHistoryLists {...base} activeTab="puantaj" timesheets={timesheets} onDeleteTimesheet={onDeleteTimesheet} />);
    await user.click(screen.getByText(/Sil|Delete/i));
    expect(onDeleteTimesheet).toHaveBeenCalledWith(7);
  });

  it('bottom tabs switch view', async () => {
    const user = userEvent.setup();
    const onBottomTabClick = vi.fn();
    render(<WorkerHistoryLists {...base} activeTab="puantaj" onBottomTabClick={onBottomTabClick} />);
    const tabs = screen.getAllByRole('heading');
    await user.click(tabs[1]);
    expect(onBottomTabClick).toHaveBeenCalled();
  });
});
