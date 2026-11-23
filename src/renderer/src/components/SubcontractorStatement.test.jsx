// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import SubcontractorStatement from './SubcontractorStatement';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const sub = { id: 1, name: 'Tasaron X', service_type: 'Hafriyat', phone: '555', project_id: 1 };
const txs = [
  { id: 1, trans_date: '2026-10-01', type: 'Hakediş', amount: 5000, description: 'Kepce' },
  { id: 2, trans_date: '2026-10-05', type: 'Ödeme', amount: 2000, description: 'Avans' },
];

describe('SubcontractorStatement', () => {
  it('computes balances from transactions', () => {
    render(
      <SubcontractorStatement t={t} i18n={i18n} subcontractor={sub} transactions={txs} filterStartDate="" filterEndDate="" companyName="" companyLogo="" projectName="S1" />
    );
    expect(screen.getByText(/5\.000|5000/)).toBeInTheDocument();
  });

  it('date filter excludes out-of-range from period', () => {
    render(
      <SubcontractorStatement t={t} i18n={i18n} subcontractor={sub} transactions={txs} filterStartDate="2026-10-03" filterEndDate="" companyName="" companyLogo="" projectName="S1" />
    );
    // Hakediş (10-01) moves to devreden; period shows only Ödeme
    expect(screen.getByText(/2\.000|2000/)).toBeInTheDocument();
  });
});
