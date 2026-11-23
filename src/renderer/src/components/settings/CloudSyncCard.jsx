import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircle2,
  Cloud,
  CloudOff,
  FolderOpen,
  Loader2,
  RefreshCw,
  RotateCcw,
  Unplug,
  UploadCloud,
} from 'lucide-react';
import Switch from '../ui/Switch';

function formatDate(value, language) {
  if (!value) return '';
  try {
    return new Intl.DateTimeFormat(language || 'en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

const PROVIDER_LABELS = {
  onedrive: 'OneDrive',
  googledrive: 'Google Drive',
  dropbox: 'Dropbox',
  icloud: 'iCloud Drive',
  nextcloud: 'Nextcloud',
  custom: 'Custom folder',
};

/**
 * Settings > Data and backups > Cloud sync.
 *
 * Serverless: the destination is a folder that an existing cloud client already
 * syncs. The card only ever shows friendly, localised messages; raw file-system
 * errors stay in the system logs.
 */
export default function CloudSyncCard() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [pendingConnect, setPendingConnect] = useState(false);

  const toast = (message, type) => {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
  };

  const refresh = useCallback(async () => {
    try {
      const next = await window.api.cloud.status();
      setState(next);
    } catch {
      setState({ connected: false, providers: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const run = async (name, action, successMessage) => {
    setBusy(name);
    try {
      const result = await action();
      if (result && result.ok === false && result.cancelled !== true) {
        toast(t('cloud.sync_failed', 'Cloud sync failed. Your local data is unaffected.'), 'error');
      } else if (successMessage && !result?.cancelled) {
        toast(successMessage, 'success');
      }
      await refresh();
      return result;
    } catch {
      toast(t('cloud.sync_failed', 'Cloud sync failed. Your local data is unaffected.'), 'error');
      return null;
    } finally {
      setBusy('');
    }
  };

  const connectProvider = async (providerId, folder) => {
    setPendingConnect(true);
    try {
      const result = await run(
        `connect:${providerId}`,
        () => window.api.cloud.connect({ provider: providerId, folder }),
        t('cloud.connect_success', 'Cloud sync connected.')
      );
      if (result && result.needsRestore) {
        const confirmed = window.confirm(
          t('cloud.restore_confirm', 'A cloud backup was found. Restore it now? Your current data will be replaced.')
        );
        if (confirmed) {
          await run('restore', () => window.api.cloud.restore(), t('cloud.restore_success', 'Backup restored.'));
        }
      }
    } finally {
      setPendingConnect(false);
    }
  };

  const chooseFolder = async () => {
    const picked = await window.api.cloud.chooseFolder();
    if (!picked || !picked.success) return;
    await connectProvider('custom', picked.folder);
  };

  if (loading) {
    return (
      <div className="glass-card">
        <div className="cloud-loading"><Loader2 size={18} className="spin" /></div>
      </div>
    );
  }

  const connected = Boolean(state && state.connected);
  const providers = (state && state.providers) || [];
  const detected = providers.filter((provider) => provider.detected);

  // The primary button connects the first folder an existing client already
  // syncs; when nothing is detected it falls back to the folder picker so the
  // card is never a dead end.
  const connectBest = () => (detected.length > 0 ? connectProvider(detected[0].id) : chooseFolder());

  return (
    <div className="glass-card cloud-card">
      <div className="cloud-head">
        <div className="cloud-head-main">
          <span className={`cloud-icon ${connected ? 'on' : 'off'}`}>
            {connected ? <Cloud size={20} /> : <CloudOff size={20} />}
          </span>
          <div>
            <h3 className="card-title" style={{ marginBottom: '0.15rem' }}>{t('cloud.title', 'Cloud backup')}</h3>
            <span className={`pill ${connected ? 'pill-success' : ''}`}>
              {connected
                ? <><CheckCircle2 size={12} /> {t('cloud.status_connected', 'Connected')}</>
                : t('cloud.status_disconnected', 'Not connected')}
            </span>
          </div>
        </div>
        <label className="toggle-row cloud-autosync">
          <span>{t('cloud.auto_sync', 'Automatic sync')}</span>
          <Switch
            checked={connected && Boolean(state && state.autoSync)}
            disabled={!connected || busy === 'auto'}
            label={t('cloud.auto_sync', 'Automatic sync')}
            onChange={(event) =>
              run(
                'auto',
                () => window.api.cloud.setAutoSync(event.target.checked).then(() => ({ ok: true })),
                null
              )
            }
          />
        </label>
      </div>

      <div className="cloud-meta">
        <div>
          <span className="cloud-meta-label">{t('cloud.provider', 'Provider')}</span>
          <strong>{PROVIDER_LABELS[state?.provider] || t('cloud.local_only', 'Local only')}</strong>
        </div>
        <div>
          <span className="cloud-meta-label">{t('cloud.last_sync', 'Last sync')}</span>
          <strong>
            {state?.lastSync
              ? formatDate(state.lastSync, i18n.language)
              : t('cloud.never_synced', 'Never synced')}
          </strong>
        </div>
        <div>
          <span className="cloud-meta-label">{t('cloud.backups', 'Backups')}</span>
          <strong>{state?.backupCount || 0}</strong>
        </div>
      </div>

      {state?.folder && (
        <p className="cloud-folder" title={state.folder}>
          <FolderOpen size={14} /> <span>{state.folder}</span>
        </p>
      )}

      {!connected && (
        <div className="cloud-providers">
          <span className="cloud-meta-label">{t('cloud.detected', 'Detected cloud folders')}</span>
          <div className="cloud-provider-list">
            {providers.length === 0 && <span className="cloud-empty">{t('cloud.not_detected', 'Not found')}</span>}
            {providers.map((provider) => (
              <button
                key={provider.id}
                type="button"
                className={`cloud-provider ${provider.detected ? 'detected' : ''}`}
                disabled={!provider.detected || pendingConnect}
                onClick={() => connectProvider(provider.id)}
                title={provider.path || ''}
              >
                <span>{PROVIDER_LABELS[provider.id] || provider.name}</span>
                <span className="cloud-provider-state">
                  {provider.detected ? t('cloud.detected', 'Detected') : t('cloud.not_detected', 'Not found')}
                </span>
              </button>
            ))}
            <button type="button" className="cloud-provider" onClick={chooseFolder} disabled={pendingConnect}>
              <span>{t('cloud.choose_folder', 'Choose folder')}</span>
              <span className="cloud-provider-state"><FolderOpen size={13} /></span>
            </button>
          </div>
          {detected.length === 0 && (
            <p className="cloud-hint">
              {t('cloud.safe_fallback', { path: state?.folder || '', defaultValue: 'No cloud folder found. Data is kept in {{path}}.' })}
            </p>
          )}
        </div>
      )}

      <div className="cloud-actions">
        {!connected ? (
          <button type="button" className="btn btn-primary" disabled={pendingConnect} onClick={connectBest}>
            {pendingConnect ? <Loader2 size={15} className="spin" /> : <UploadCloud size={15} />} {t('cloud.connect', 'Connect')}
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-primary" disabled={busy === 'sync'} onClick={() => run('sync', () => window.api.cloud.syncNow(), t('cloud.sync_success', 'Backup synced.'))}>
              {busy === 'sync' ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />} {t('cloud.sync_now', 'Sync now')}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy === 'restore'} onClick={() => {
              const confirmed = window.confirm(t('cloud.restore_confirm', 'Replace the current data with the cloud backup?'));
              if (confirmed) run('restore', () => window.api.cloud.restore(), t('cloud.restore_success', 'Backup restored.'));
            }}>
              {busy === 'restore' ? <Loader2 size={15} className="spin" /> : <RotateCcw size={15} />} {t('cloud.restore', 'Restore')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => run('open', () => window.api.cloud.openFolder(), null)}>
              <FolderOpen size={15} /> {t('cloud.open_folder', 'Open folder')}
            </button>
            <button type="button" className="btn btn-ghost" disabled={busy === 'disconnect'} onClick={() => run('disconnect', () => window.api.cloud.disconnect(), t('cloud.disconnect_success', 'Cloud sync disconnected.'))}>
              {busy === 'disconnect' ? <Loader2 size={15} className="spin" /> : <Unplug size={15} />} {t('cloud.disconnect', 'Disconnect')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
