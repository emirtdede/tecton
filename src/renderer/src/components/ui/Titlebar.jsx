import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import '../../index.css';

/**
 * Frameless window chrome.
 *
 * There is no drawn title bar: a transparent drag strip covers the top edge and
 * three controls float over it at the inline-end corner. Keeping the controls
 * here (not in the sidebar header) means they stay at the same screen position
 * whether the sidebar is full, collapsed or hidden.
 */
const Titlebar = () => {
  const { t } = useTranslation();
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (typeof window !== 'undefined' && window.api?.window?.isMaximized) {
      Promise.resolve(window.api.window.isMaximized())
        .then((value) => {
          if (!cancelled) setMaximized(Boolean(value));
        })
        .catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMinimize = () => {
    if (window.api?.window?.minimize) {
      Promise.resolve(window.api.window.minimize()).catch(() => {});
    }
  };

  const handleMaximize = () => {
    if (window.api?.window?.maximize) {
      Promise.resolve(window.api.window.maximize())
        .then((result) => {
          if (result && typeof result.maximized === 'boolean') setMaximized(result.maximized);
          else setMaximized((value) => !value);
        })
        .catch(() => {});
    }
  };

  const handleClose = () => {
    if (window.api?.window?.close) {
      Promise.resolve(window.api.window.close()).catch(() => {});
    }
  };

  return (
    <>
      <div className="pp-drag-strip" aria-hidden="true" />
      <div className="pp-window-controls" role="group" aria-label={t('window.controls', 'Window controls')}>
        <button
          type="button"
          className="pp-win-btn"
          onClick={handleMinimize}
          title={t('window.minimize', 'Minimize')}
          aria-label={t('window.minimize', 'Minimize')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 5h8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          className="pp-win-btn"
          onClick={handleMaximize}
          data-maximized={maximized ? 'true' : 'false'}
          title={maximized ? t('window.restore', 'Restore') : t('window.maximize', 'Maximize')}
          aria-label={maximized ? t('window.restore', 'Restore') : t('window.maximize', 'Maximize')}
        >
          <svg className="pp-icon-max" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <rect x="1" y="1" width="8" height="8" rx="1" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
          <svg className="pp-icon-restore" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M3 3h6v6H3z" fill="none" stroke="currentColor" strokeWidth="1" />
            <path d="M3 3V1h6v6H7" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.7" />
          </svg>
        </button>
        <button
          type="button"
          className="pp-win-btn pp-win-close"
          onClick={handleClose}
          title={t('window.close', 'Close')}
          aria-label={t('window.close', 'Close')}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 1l8 8M9 1l-8 8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </>
  );
};

export default Titlebar;
