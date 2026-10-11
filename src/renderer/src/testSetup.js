import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// NOTE: No @testing-library/react import here — it breaks the shared setup
// transform under plain vite. RTL auto-cleanup works via globals:true (afterEach).
// Component tests run with `// @vitest-environment jsdom` docblock.

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  if (typeof window.HTMLElement !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
    window.HTMLElement.prototype.scrollIntoView = () => {};
  }

  if (typeof window.Element !== 'undefined' && !window.Element.prototype.scrollTo) {
    window.Element.prototype.scrollTo = () => {};
  }
  if (typeof window.Element !== 'undefined' && !window.Element.prototype.scrollIntoView) {
    window.Element.prototype.scrollIntoView = () => {};
  }

  if (typeof window.ResizeObserver === 'undefined') {
    window.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
}
