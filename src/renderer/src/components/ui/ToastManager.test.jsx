// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import ToastManager from './ToastManager';

beforeEach(() => {
  vi.useFakeTimers();
});

import { afterEach as vAfterEach } from 'vitest';
vAfterEach(() => {
  vi.useRealTimers();
});

describe('ToastManager', () => {
  it('renders nothing initially', () => {
    const { container } = render(<ToastManager />);
    expect(container.firstChild).toBeNull();
  });

  it('shows toast on show-toast event with message', () => {
    render(<ToastManager />);
    act(() => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Kayıt ok', type: 'success' } }));
    });
    expect(screen.getByText('Kayıt ok')).toBeInTheDocument();
  });

  it('auto-dismisses after duration', () => {
    render(<ToastManager />);
    act(() => {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: 'Gecer', duration: 1000 } }));
    });
    expect(screen.getByText('Gecer')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.queryByText('Gecer')).not.toBeInTheDocument();
  });
});
