// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ErrorBoundary from '../ErrorBoundary';

function Boom() {
  throw new Error('kaboom');
}

describe('ErrorBoundary', () => {
  it('renders children when healthy', () => {
    render(
      <ErrorBoundary>
        <span>Saglikli icerik</span>
      </ErrorBoundary>
    );
    expect(screen.getByText('Saglikli icerik')).toBeInTheDocument();
  });

  it('shows fallback on child crash, reload button works', async () => {
    const user = userEvent.setup();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Beklenmeyen bir hata/)).toBeInTheDocument();
    const btn = screen.getByRole('button');
    await user.click(btn);
    errSpy.mockRestore();
  });

  it('fallback mentions data safety', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Verileriniz kaybolmaz/)).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
