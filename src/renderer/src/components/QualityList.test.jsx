// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QualityList from './QualityList';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const reps = [
  { id: 1, title: 'Kalik hatasi', description: 'Aciklama', status: 'open', report_date: '2026-10-01', photo_path: null },
];

describe('QualityList', () => {
  it('renders cards with status toggle', () => {
    render(
      <QualityList t={t} i18n={i18n} loading={false} filteredReports={reps} paginatedReports={reps} totalPages={1} currentPage={1} setCurrentPage={() => {}} searchQuery="" onToggle={() => {}} onEdit={() => {}} onDelete={() => {}} onViewPhoto={() => {}} />
    );
    expect(screen.getByText('Kalik hatasi')).toBeInTheDocument();
  });

  it('toggle and delete callbacks', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const onDelete = vi.fn();
    render(
      <QualityList t={t} i18n={i18n} loading={false} filteredReports={reps} paginatedReports={reps} totalPages={1} currentPage={1} setCurrentPage={() => {}} searchQuery="" onToggle={onToggle} onEdit={() => {}} onDelete={onDelete} onViewPhoto={() => {}} />
    );
    const toggle = screen.getAllByText(/AÇIK|ÇÖZÜLDÜ/)[0];
    await user.click(toggle);
    expect(onToggle).toHaveBeenCalled();
    await user.click(screen.getByTitle(/Sil|Delete/i));
    expect(onDelete).toHaveBeenCalledWith(1);
  });
});
