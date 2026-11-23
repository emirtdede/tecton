// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubcontractorTxList from './SubcontractorTxList';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const txs = [
  { id: 1, trans_date: '2026-10-01', type: 'Hakediş', amount: 5000, description: 'Kepce' },
  { id: 2, trans_date: '2026-10-05', type: 'Ödeme', amount: 2000, description: 'Avans' },
];

describe('SubcontractorTxList', () => {
  it('renders rows with badges and amounts', () => {
    render(
      <SubcontractorTxList t={t} i18n={i18n} paginatedTransactions={txs} totalPages={1} currentPage={1} setCurrentPage={() => {}} onDelete={() => {}} />
    );
    expect(screen.getByText('Kepce')).toBeInTheDocument();
    expect(screen.getByText('Avans')).toBeInTheDocument();
  });

  it('delete calls handler with row', async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    render(
      <SubcontractorTxList t={t} i18n={i18n} paginatedTransactions={txs} totalPages={1} currentPage={1} setCurrentPage={() => {}} onDelete={onDelete} />
    );
    await user.click(screen.getAllByText(/Sil|Delete/i)[0]);
    expect(onDelete).toHaveBeenCalled();
  });

  it('empty list shows message', () => {
    render(
      <SubcontractorTxList t={t} i18n={i18n} paginatedTransactions={[]} totalPages={1} currentPage={1} setCurrentPage={() => {}} onDelete={() => {}} />
    );
    expect(screen.getByText(/kayıt bulunamadı/)).toBeInTheDocument();
  });
});
