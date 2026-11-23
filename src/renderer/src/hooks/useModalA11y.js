import { useEffect, useRef } from 'react';

/**
 * Accessibility plumbing shared by every modal in the app.
 *
 * Before this hook, all modals were plain `<div>` overlays: screen readers saw
 * no dialog at all (no `role="dialog"`, no `aria-modal`), focus stayed on the
 * page behind the overlay, Tab walked into background controls, and Escape did
 * nothing. That made the app unusable with a keyboard alone and invisible to
 * assistive tech.
 *
 * Usage:
 *   const { dialogProps, containerRef } = useModalA11y({ isOpen, onClose, label });
 *   <div {...overlayProps}><div ref={containerRef} {...dialogProps}>…</div></div>
 *
 * @param {object}   opts
 * @param {boolean}  opts.isOpen        whether the modal is currently rendered
 * @param {Function} opts.onClose       called on Escape
 * @param {string}   [opts.label]       accessible name when no visible title is linked
 * @param {boolean}  [opts.closeOnEscape=true]
 * @returns {{ dialogProps: object, containerRef: import('react').MutableRefObject<HTMLElement|null> }}
 */
export default function useModalA11y({ isOpen, onClose, label, closeOnEscape = true }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    // Remember what was focused so it can be restored when the modal closes.
    const previouslyFocused = document.activeElement;

    // Move focus into the dialog. Prefer the first focusable control; fall back
    // to the container itself (which carries tabIndex={-1}).
    const container = containerRef.current;
    if (container) {
      const focusable = container.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      (focusable || container).focus();
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && closeOnEscape) {
        event.stopPropagation();
        if (onClose) onClose();
        return;
      }

      if (event.key !== 'Tab' || !container) return;

      // Focus trap: keep Tab/Shift+Tab cycling inside the dialog.
      const items = Array.from(
        container.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);

      if (items.length === 0) return;

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !container.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !container.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      // Restore focus only if the previously focused element is still mounted.
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen, onClose, closeOnEscape]);

  const dialogProps = {
    role: 'dialog',
    'aria-modal': 'true',
    tabIndex: -1,
    ...(label ? { 'aria-label': label } : {})
  };

  return { dialogProps, containerRef };
}
