// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MaterialTable from './MaterialTable';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const rows = [
  { id: 1, receipt_date: '2026-10-01', receipt_number: 'IRS-1', supplier: 'Akcansa', material_type: 'Beton', quantity: 10, unit: 'm³', photo_path: null },
];

describe('MaterialTable', () => {
  it('renders rows', () => {
    render(
      <MaterialTable t={t} i18n={i18n} loading={false} filteredRecords={rows} paginatedRecords={rows} totalPages={1} currentPage={1} setCurrentPage={() => {}} searchQuery="" onEdit={() => {}} onDelete={() => {}} onViewPhoto={() => {}} />
    );
    expect(screen.getByText('Akcansa')).toBeInTheDocument();
    expect(screen.getByText('IRS-1')).toBeInTheDocument();
  });

  it('edit and delete callbacks', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <MaterialTable t={t} i18n={i18n} loading={false} filteredRecords={rows} paginatedRecords={rows} totalPages={1} currentPage={1} setCurrentPage={() => {}} searchQuery="" onEdit={onEdit} onDelete={onDelete} onViewPhoto={() => {}} />
    );
    await user.click(screen.getByTitle(/Düzenle|Edit/i));
    expect(onEdit).toHaveBeenCalled();
    await user.click(screen.getByTitle(/Sil|Delete/i));
    expect(onDelete).toHaveBeenCalledWith(1);
  });

  it('photo button when photo_path present', async () => {
    const user = userEvent.setup();
    const onViewPhoto = vi.fn();
    const withPhoto = [{ ...rows[0], photo_path: 'project_1/x.webp' }];
    render(
      <MaterialTable t={t} i18n={i18n} loading={false} filteredRecords={withPhoto} paginatedRecords={withPhoto} totalPages={1} currentPage={1} setCurrentPage={() => {}} searchQuery="" onEdit={() => {}} onDelete={() => {}} onViewPhoto={onViewPhoto} />
    );
    await user.click(screen.getByTitle(/Görüntüle|View/i));
    expect(onViewPhoto).toHaveBeenCalledWith('project_1/x.webp');
  });
});
