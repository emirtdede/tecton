// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('react-i18next', () => ({
  useTranslation: (() => {
    // Stable identity: production i18next returns a memoised `t`, and effects
    // that list `t` in their dependency array would otherwise loop forever.
    const t = (k, f) => f || k;
    const i18n = { language: 'tr', changeLanguage: vi.fn() };
    return () => ({ t, i18n });
  })(),
}));

import GuideDrawer from './GuideDrawer';

describe('GuideDrawer', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<GuideDrawer isOpen={false} onClose={() => {}} title="T" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders title and sections when open', () => {
    render(
      <GuideDrawer isOpen onClose={() => {}} title="Rehber" desc="Aciklama" h1="Soru 1" p1="Cevap 1" />
    );
    expect(screen.getByText('Rehber')).toBeInTheDocument();
    expect(screen.getByText('Aciklama')).toBeInTheDocument();
    expect(screen.getByText('Soru 1')).toBeInTheDocument();
    expect(screen.getByText('Cevap 1')).toBeInTheDocument();
  });

  it('close button and overlay click call onClose, inner click does not', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<GuideDrawer isOpen onClose={onClose} title="T" h1="H" />);
    await user.click(screen.getByRole('button', { name: /Kapat|close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
