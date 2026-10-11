// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ProductionTable from './ProductionTable';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const rows = [
  { id: 1, record_date: '2026-10-01', item_name: 'Duvar', quantity: 100, unit: 'm²', notes: '' },
];

describe('ProductionTable', () => {
  it('renders rows', () => {
    render(
      <ProductionTable t={t} i18n={i18n} loading={false} filteredRecords={rows} paginatedRecords={rows} totalPages={1} currentPage={1} setCurrentPage={() => {}} searchQuery="" onEdit={() => {}} onDelete={() => {}} />
    );
    expect(screen.getByText('Duvar')).toBeInTheDocument();
  });

  it('edit and delete callbacks', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(
      <ProductionTable t={t} i18n={i18n} loading={false} filteredRecords={rows} paginatedRecords={rows} totalPages={1} currentPage={1} setCurrentPage={() => {}} searchQuery="" onEdit={onEdit} onDelete={onDelete} />
    );
    await user.click(screen.getByTitle(/Düzenle|Edit/i));
    expect(onEdit).toHaveBeenCalled();
    await user.click(screen.getByTitle(/Sil|Delete/i));
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
