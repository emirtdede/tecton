// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, f) => f || k, i18n: { language: 'tr', changeLanguage: vi.fn() } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, f) => f || k, i18n: { language: 'tr', changeLanguage: vi.fn() } }),
}));

import CashRegister from './CashRegister';
import MaterialManagement from './MaterialManagement';
import QualityReports from './QualityReports';
import DailyJournal from './DailyJournal';
import ProjectManagement from './ProjectManagement';
import BulkTimesheet from './BulkTimesheet';
import SubcontractorLedger from './SubcontractorLedger';
import SubcontractorProfile from './SubcontractorProfile';
import { mockApi } from '../utils/apiMock';

describe('page smoke tests (mocked api)', () => {
  it('CashRegister renders balance header', async () => {
    mockApi();
    render(<CashRegister activeProjectId={1} projects={[{ id: 1, name: 'S1' }]} />);
    expect(await screen.findByText('Yeni Nakit İşlemi')).toBeInTheDocument();
  });

  it('MaterialManagement renders entry form', async () => {
    mockApi();
    render(<MaterialManagement activeProjectId={1} projects={[{ id: 1, name: 'S1' }]} />);
    expect(await screen.findByText(/İrsaliye ve Malzeme Girişi/)).toBeInTheDocument();
  });

  it('QualityReports renders list area', async () => {
    mockApi();
    render(<QualityReports activeProjectId={1} projects={[{ id: 1, name: 'S1' }]} />);
    expect(await screen.findByText(/Kalite Kontrol/)).toBeInTheDocument();
  });

  it('DailyJournal renders form', async () => {
    mockApi();
    render(<DailyJournal activeProjectId={1} projects={[{ id: 1, name: 'S1' }]} />);
    expect(await screen.findByText(/Günlük Jurnali/)).toBeInTheDocument();
  });

  it('ProjectManagement renders add form', async () => {
    mockApi();
    render(<ProjectManagement onSelectProject={() => {}} activeProjectId={1} />);
    expect(await screen.findByText(/Lokasyon\) Yönetimi/)).toBeInTheDocument();
  });

  it('BulkTimesheet renders grid', async () => {
    mockApi();
    render(<BulkTimesheet activeProjectId={1} projects={[{ id: 1, name: 'S1' }]} />);
    expect(await screen.findByText(/Çoklu Puantaj/)).toBeInTheDocument();
  });

  it('SubcontractorLedger renders table area', async () => {
    mockApi();
    render(<SubcontractorLedger activeProjectId={1} projects={[{ id: 1, name: 'S1' }]} />);
    expect(await screen.findByText(/Taşeron ve Alt Yüklenici/)).toBeInTheDocument();
  });

  it('SubcontractorProfile renders info card', async () => {
    mockApi();
    const sub = { id: 1, name: 'Tasaron', service_type: 'Hafriyat', phone: '', project_id: 1, tags: '[]' };
    render(<SubcontractorProfile subcontractor={sub} onBack={() => {}} />);
    expect(await screen.findByText('Tasaron')).toBeInTheDocument();
  });

  it('no-project guard shows select message', async () => {
    mockApi();
    const user = userEvent.setup();
    void user;
    render(<MaterialManagement activeProjectId={null} projects={[]} />);
    expect(await screen.findByText(/şantiye seçin/i)).toBeInTheDocument();
  });
});
