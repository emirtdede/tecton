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

import Spotlight from './Spotlight';

const workers = [{ id: 1, full_name: 'Ahmet Yilmaz', phone: '555', daily_wage: 1000 }];

describe('Spotlight', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Spotlight isOpen={false} onClose={() => {}} onNavigate={() => {}} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows nav items by default and filters workers on query', async () => {
    const user = userEvent.setup();
    render(
      <Spotlight isOpen onClose={() => {}} onNavigate={() => {}} workers={workers} />
    );
    expect(screen.getByText('Personel Yönetimi')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/komuta/), 'ahmet');
    expect(screen.getByText('Ahmet Yilmaz')).toBeInTheDocument();
  });

  it('Enter selects worker and closes', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(
      <Spotlight isOpen onClose={onClose} onNavigate={onNavigate} workers={workers} />
    );
    await user.type(screen.getByPlaceholderText(/komuta/), 'ahmet');
    await user.keyboard('{Enter}');
    expect(onNavigate).toHaveBeenCalledWith('profile', workers[0]);
    expect(onClose).toHaveBeenCalled();
  });

  it('Escape closes without navigating', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    const onClose = vi.fn();
    render(<Spotlight isOpen onClose={onClose} onNavigate={onNavigate} />);
    await user.click(screen.getByPlaceholderText(/komuta/));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
