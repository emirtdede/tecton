// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubcontractorInfoCard from './SubcontractorInfoCard';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const sub = { id: 1, name: 'Test Tasaron', service_type: 'Hafriyat', phone: '555', tags: '[]' };

describe('SubcontractorInfoCard', () => {
  it('renders name, service and totals', () => {
    render(
      <SubcontractorInfoCard t={t} i18n={i18n} subcontractor={sub} projectName="S1" totalHakedis={5000} totalOdeme={2000} netBalance={3000} onBack={() => {}} onHelp={() => {}} />
    );
    expect(screen.getByText('Test Tasaron')).toBeInTheDocument();
    expect(screen.getByText('Hafriyat')).toBeInTheDocument();
  });

  it('back button works', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <SubcontractorInfoCard t={t} i18n={i18n} subcontractor={sub} projectName="" totalHakedis={0} totalOdeme={0} netBalance={0} onBack={onBack} onHelp={() => {}} />
    );
    await user.click(screen.getByRole('button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('shows ISG undefined badge without expiry', () => {
    render(
      <SubcontractorInfoCard t={t} i18n={i18n} subcontractor={{ ...sub, isg_expiry_date: null }} projectName="" totalHakedis={0} totalOdeme={0} netBalance={0} onBack={() => {}} onHelp={() => {}} />
    );
    expect(screen.getByText(/İSG Tanımsız/)).toBeInTheDocument();
  });
});
