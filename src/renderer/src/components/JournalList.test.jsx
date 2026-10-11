// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import JournalList from './JournalList';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const journals = [
  { id: 1, journal_date: '2026-10-05', notes: 'Beton dokuldu', weather_desc: 'Gunesli', weather_temp: 22, weather_icon: null, worker_count: 5 },
];

describe('JournalList', () => {
  it('renders journal notes', () => {
    render(
      <JournalList t={t} i18n={i18n} loading={false} filteredJournals={journals} paginatedJournals={journals} totalPages={1} currentPage={1} setCurrentPage={() => {}} searchQuery="" todayStr="2026-10-06" onEdit={() => {}} onDelete={() => {}} />
    );
    expect(screen.getByText('Beton dokuldu')).toBeInTheDocument();
  });

  it('edit button only for today journal', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(
      <JournalList t={t} i18n={i18n} loading={false} filteredJournals={journals} paginatedJournals={journals} totalPages={1} currentPage={1} setCurrentPage={() => {}} searchQuery="" todayStr="2026-10-05" onEdit={onEdit} onDelete={() => {}} />
    );
    await user.click(screen.getByTitle(/Düzenle|Edit/i));
    expect(onEdit).toHaveBeenCalled();
  });

  it('empty shows message', () => {
    render(
      <JournalList t={t} i18n={i18n} loading={false} filteredJournals={[]} paginatedJournals={[]} totalPages={1} currentPage={1} setCurrentPage={() => {}} searchQuery="" todayStr="2026-10-06" onEdit={() => {}} onDelete={() => {}} />
    );
    expect(screen.getByText(/jurnal kaydı bulunmuyor/)).toBeInTheDocument();
  });
});
