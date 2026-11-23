import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, DownloadCloud, Loader2, RefreshCw } from 'lucide-react';

/**
 * Settings/About > Updates.
 *
 * Shows the installed version and the live state pushed by the main updater.
 * The installer runs silently; the user is only asked to restart.
 */
export default function UpdateCard({ compact = false }) {
  const { t } = useTranslation();
  const [status, setStatus] = useState({ state: 'idle', version: null, percent: 0 });
  const [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.api?.platform?.info?.()
      .then((info) => {
        if (!cancelled && info) setVersion(info.version || '');
      })
      .catch(() => {});
    const unsubscribe = window.api?.update?.onStatus?.((next) => setStatus(next));
    window.api?.update?.status?.().then((current) => {
      if (!cancelled && current) setStatus(current);
    }).catch(() => {});
    return () => {
      cancelled = true;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  const check = async () => {
    setBusy(true);
    try {
      const result = await window.api.update.check();
      if (result && result.status) setStatus(result.status);
    } catch {
      setStatus({ state: 'error', message: 'update_failed' });
    } finally {
      setBusy(false);
    }
  };

  const install = () => {
    window.api?.update?.install?.();
  };

  const percent = status.percent || 0;
  const disabled = status.state === 'disabled' || status.state === 'unavailable';

  return (
    <div className={`glass-card update-card ${compact ? 'compact' : ''}`}>
      <div className="update-head">
        <div>
          <h3 className="card-title" style={{ marginBottom: '0.2rem' }}>{t('update.title', 'Updates')}</h3>
          <span className="update-version">
            {t('update.current_version', 'Current version')}: <strong>{version || '1.0.0'}</strong>
          </span>
        </div>
        {status.state === 'ready' ? (
          <button type="button" className="btn btn-primary" onClick={install}>
            <DownloadCloud size={15} /> {t('update.install', 'Restart and install')}
          </button>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={check} disabled={busy || disabled}>
            {busy || status.state === 'checking' ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
            {status.state === 'checking' ? t('update.checking', 'Checking...') : t('update.check', 'Check for updates')}
          </button>
        )}
      </div>

      <div className="update-state" aria-live="polite">
        {status.state === 'checking' && <span>{t('update.checking', 'Checking...')}</span>}
        {status.state === 'up-to-date' && (
          <span className="update-ok"><CheckCircle2 size={14} /> {t('update.up_to_date', 'You are up to date.')}</span>
        )}
        {status.state === 'available' && (
          <span>{t('update.available', { version: status.version || '', defaultValue: 'Version {{version}} is available.' })}</span>
        )}
        {status.state === 'downloading' && (
          <div className="update-progress-wrap">
            <span>{t('update.downloading', { percent, defaultValue: 'Downloading update ({{percent}}%)' })}</span>
            <div className="update-progress"><div style={{ width: `${percent}%` }} /></div>
          </div>
        )}
        {status.state === 'ready' && <span>{t('update.ready', 'Update ready. Restart to install.')}</span>}
        {status.state === 'error' && <span className="update-error">{t('update.error', 'Could not check for updates.')}</span>}
        {status.state === 'disabled' && <span className="update-muted">{t('update.store_managed', 'Updates are managed by the Microsoft Store.')}</span>}
        {status.state === 'unavailable' && <span className="update-muted">{t('update.dev_build', 'Update checks are available in the installed version.')}</span>}
        {status.state === 'idle' && <span className="update-muted">{t('update.auto', 'Updates are checked automatically.')}</span>}
      </div>
    </div>
  );
}
