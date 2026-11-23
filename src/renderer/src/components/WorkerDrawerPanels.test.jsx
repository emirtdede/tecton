// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

import WorkerDrawer from './WorkerDrawer';
import AnomalyPanel from './AnomalyPanel';
import GroupReportPanel from './GroupReportPanel';
import { mockApi } from '../utils/apiMock';

describe('WorkerDrawer', () => {
  it('renders nothing when closed', () => {
    mockApi();
    const { container } = render(
      <WorkerDrawer isOpen={false} onClose={() => {}} onSave={() => {}} worker={null} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows TC error on invalid TC submit, blocks save', async () => {
    const onSave = vi.fn();
    mockApi();
    const { container } = render(<WorkerDrawer isOpen onClose={() => {}} onSave={onSave} worker={null} />);
    fireEvent.change(container.querySelector('input[name="full_name"]'), { target: { value: 'Test Kisi', name: 'full_name' } });
    fireEvent.change(container.querySelector('input[name="tc_no"]'), { target: { value: '123', name: 'tc_no' } });
    fireEvent.submit(container.querySelector('form'));
    expect(screen.getByText(/Geçersiz TC/)).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('valid submit calls onSave with tags', async () => {
    const onSave = vi.fn();
    mockApi();
    const { container } = render(<WorkerDrawer isOpen onClose={() => {}} onSave={onSave} worker={null} />);
    fireEvent.change(container.querySelector('input[name="full_name"]'), { target: { value: 'Kayitli Kisi', name: 'full_name' } });
    fireEvent.change(container.querySelector('input[name="tc_no"]'), { target: { value: '10000000146', name: 'tc_no' } });
    fireEvent.submit(container.querySelector('form'));
    expect(onSave).toHaveBeenCalled();
  });
});

describe('AnomalyPanel and GroupReportPanel', () => {
  const workers = [
    { id: 1, full_name: 'Ali', daily_wage: 1000, isg_bitis_tarihi: '2020-01-01' },
    { id: 2, full_name: 'Veli', daily_wage: 1000, isg_bitis_tarihi: '2030-01-01' },
  ];

  it('AnomalyPanel flags expired ISG', () => {
    mockApi();
    render(<AnomalyPanel workers={workers} balances={{}} viewMode="list" />);
    expect(screen.getByText('Ali')).toBeInTheDocument();
  });

  it('GroupReportPanel renders with empty groups', () => {
    mockApi();
    const { container } = render(
      <GroupReportPanel activeProjectId={1} workers={workers} balances={{}} viewMode="list" />
    );
    expect(container.firstChild).toBeTruthy();
  });
});
