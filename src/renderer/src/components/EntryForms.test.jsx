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

import CashForm from './CashForm';
import MaterialForm from './MaterialForm';
import QualityForm from './QualityForm';
import ProjectForm from './ProjectForm';
import ProductionForm from './ProductionForm';
import { mockApi } from '../utils/apiMock';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const noop = () => {};

describe('entry form submits', () => {
  it('CashForm submit creates cash record', async () => {
    const user = userEvent.setup();
    const api = mockApi();
    const onSubmit = vi.fn(async (e) => {
      e.preventDefault();
      await api.db.create('cash_register', { amount: 100 });
    });
    render(
      <CashForm t={t} i18n={i18n} formData={{ trans_date: '2026-10-01', type: 'Nakit Girişi', amount: 100, description: 'Test', project_id: '' }} onChange={noop} onSubmit={onSubmit} cashTags={[]} setCashTags={noop} projects={[]} activeProjectId={1} />
    );
    await user.click(screen.getByRole('button', { name: /Kaydet|Add/i }));
    expect(onSubmit).toHaveBeenCalled();
    expect(api.db.create).toHaveBeenCalled();
  });

  it('MaterialForm submit handler fires with valid data', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e) => e.preventDefault());
    const setFormData = vi.fn();
    render(
      <MaterialForm t={t} formData={{ supplier: 'S', material_type: 'M', quantity: 5, unit: 'm³', receipt_number: '', receipt_date: '2026-10-01', photo_path: '', notes: '' }} setFormData={setFormData} photoPreview="" setPhotoPreview={noop} setLightboxImage={noop} editingId={null} setEditingId={noop} onSubmit={onSubmit} onSelectLocalPhoto={noop} onLocalFileChange={noop} onOpenQr={noop} />
    );
    await user.click(screen.getByRole('button', { name: /Kaydet|Save/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('QualityForm submit handler fires', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <QualityForm t={t} formData={{ title: 'T', description: '', status: 'open', photo_path: '', report_date: '2026-10-01' }} setFormData={noop} photoPreview="" editingId={null} setEditingId={noop} todayStr="2026-10-01" onSubmit={onSubmit} onSelectLocalPhoto={noop} onLocalFileChange={noop} onOpenQr={noop} setLightboxImage={noop} />
    );
    await user.click(screen.getByRole('button', { name: /Ekle|Add/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('ProjectForm submit handler fires', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <ProjectForm t={t} formData={{ name: 'P', location: '' }} setFormData={noop} onSubmit={onSubmit} />
    );
    await user.click(screen.getByRole('button', { name: /Ekle|Add/i }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it('ProductionForm submit handler fires', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn((e) => e.preventDefault());
    render(
      <ProductionForm t={t} formData={{ item_name: 'I', quantity: 3, unit: 'm²', record_date: '2026-10-01', notes: '' }} setFormData={noop} editingId={null} setEditingId={noop} onSubmit={onSubmit} />
    );
    await user.click(screen.getByRole('button', { name: /Kaydet|Save/i }));
    expect(onSubmit).toHaveBeenCalled();
  });
});
