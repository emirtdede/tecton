// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import CashSummary from './CashSummary';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };

describe('CashSummary', () => {
  it('renders net balance and in/out totals', () => {
    render(
      <CashSummary t={t} i18n={i18n} projNetBalance={1500} projTotalIn={5000} projTotalOut={3500} reportDate="2026-10-01" setReportDate={() => {}} reportData={null} />
    );
    expect(screen.getByText(/1\.500|1500/)).toBeInTheDocument();
  });

  it('renders monthly report grid when data present', () => {
    const reportData = { summary: { totalWageCost: 10000, totalCashIn: 20000, totalCashOut: 5000, netCashFlow: 15000 } };
    render(
      <CashSummary t={t} i18n={i18n} projNetBalance={0} projTotalIn={0} projTotalOut={0} reportDate="2026-10-01" setReportDate={() => {}} reportData={reportData} />
    );
    expect(screen.getByText(/10\.000|10000/)).toBeInTheDocument();
  });
});
