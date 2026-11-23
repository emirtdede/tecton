// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkWorkerGrid from './BulkWorkerGrid';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const workers = [
  { id: 1, full_name: 'Ali', daily_wage: 1000, group_id: null },
  { id: 2, full_name: 'Veli', daily_wage: 1200, group_id: null },
];

describe('BulkWorkerGrid', () => {
  it('renders workers and selected count', () => {
    render(
      <BulkWorkerGrid t={t} i18n={i18n} loading={false} filteredWorkers={workers} selectedIds={new Set([1])} existingTimesheets={[]} workerGroups={[]} searchQuery="" onToggle={() => {}} />
    );
    expect(screen.getByText('Ali')).toBeInTheDocument();
    expect(screen.getByText('Veli')).toBeInTheDocument();
  });

  it('toggle on card click, blocked when timesheet exists', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    render(
      <BulkWorkerGrid t={t} i18n={i18n} loading={false} filteredWorkers={workers} selectedIds={new Set()} existingTimesheets={[{ worker_id: 2 }]} workerGroups={[]} searchQuery="" onToggle={onToggle} />
    );
    await user.click(screen.getByText('Ali'));
    expect(onToggle).toHaveBeenCalledWith(1);
  });

  it('shows entered badge for existing timesheet', () => {
    render(
      <BulkWorkerGrid t={t} i18n={i18n} loading={false} filteredWorkers={workers} selectedIds={new Set()} existingTimesheets={[{ worker_id: 2 }]} workerGroups={[]} searchQuery="" onToggle={() => {}} />
    );
    expect(screen.getByText(/Girildi/)).toBeInTheDocument();
  });
});
