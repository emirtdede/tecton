// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k, f) => f || k, i18n: { language: 'tr', changeLanguage: vi.fn() } }),
}));

import ConfirmationModal from './ConfirmationModal';

describe('ConfirmationModal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <ConfirmationModal isOpen={false} onClose={() => {}} onConfirm={() => {}} title="T" message="M" />
    );
    expect(container.firstChild).toBeNull();
  });

  it('confirm calls onConfirm then onClose', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmationModal isOpen onClose={onClose} onConfirm={onConfirm} title="Sil?" message="Emin misin?" confirmText="Evet" cancelText="Hayır" />
    );
    expect(screen.getByText(/Sil\?/)).toBeInTheDocument();
    await user.click(screen.getByText('Evet'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('cancel calls only onClose, hides cancel when empty string', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(
      <ConfirmationModal isOpen onClose={onClose} onConfirm={onConfirm} title="T" message="M" confirmText="OK" cancelText="" />
    );
    expect(screen.queryByText('Hayır')).not.toBeInTheDocument();
    await user.click(screen.getByText('OK'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
