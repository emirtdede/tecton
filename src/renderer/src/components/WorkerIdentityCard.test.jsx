// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import WorkerIdentityCard from './WorkerIdentityCard';

const t = (k, f) => f || k;
const i18n = { language: 'tr' };
const worker = { id: 1, full_name: 'Ahmet Yilmaz', tc_no: '10000000146', phone: '5551112233', daily_wage: 1000, tags: '["usta"]' };

describe('WorkerIdentityCard', () => {
  it('renders name, balance and tags', () => {
    render(
      <WorkerIdentityCard t={t} i18n={i18n} worker={worker} projectName="S1" groupName="G1" balance={2500} onBack={() => {}} onHelp={() => {}} onOpenIsg={() => {}} />
    );
    expect(screen.getByText('Ahmet Yilmaz')).toBeInTheDocument();
    expect(screen.getByText('🏷️ usta')).toBeInTheDocument();
    expect(screen.getByText('🏗️ S1')).toBeInTheDocument();
  });

  it('back button calls onBack', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(
      <WorkerIdentityCard t={t} i18n={i18n} worker={worker} projectName="" groupName="" balance={0} onBack={onBack} onHelp={() => {}} onOpenIsg={() => {}} />
    );
    await user.click(screen.getByRole('button'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('ISG undefined badge opens form with empty dates', async () => {
    const user = userEvent.setup();
    const onOpenIsg = vi.fn();
    render(
      <WorkerIdentityCard t={t} i18n={i18n} worker={{ ...worker, isg_bitis_tarihi: null }} projectName="" groupName="" balance={0} onBack={() => {}} onHelp={() => {}} onOpenIsg={onOpenIsg} />
    );
    await user.click(screen.getByText(/İSG Tanımsız/));
    expect(onOpenIsg).toHaveBeenCalledWith('', '');
  });

  it('expired ISG badge shows expired text', () => {
    render(
      <WorkerIdentityCard t={t} i18n={i18n} worker={{ ...worker, isg_bitis_tarihi: '2020-01-01' }} projectName="" groupName="" balance={0} onBack={() => {}} onHelp={() => {}} onOpenIsg={() => {}} />
    );
    expect(screen.getByText(/İSG Süresi Doldu/)).toBeInTheDocument();
  });
});
