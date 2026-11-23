import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  Loader2,
  Plus,
  RefreshCw,
  Send,
  Server,
  Terminal,
  Trash2,
  Webhook,
} from 'lucide-react';
import Switch from '../ui/Switch';

const EVENT_KEYS = {
  'record.created': 'integrations.event_created',
  'record.updated': 'integrations.event_updated',
  'record.deleted': 'integrations.event_deleted',
  'backup.completed': 'integrations.event_backup',
  'update.available': 'integrations.event_update',
};

function toast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
}

async function copy(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function CodeBlock({ label, value, display, t }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (await copy(value)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      toast(t('integrations.copy_failed', 'Could not copy to the clipboard.'), 'error');
    }
  };

  return (
    <div className="integration-code">
      <div className="integration-code-head">
        <span>{label}</span>
        <button type="button" className="btn integration-copy" onClick={onCopy}>
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? t('integrations.copied', 'Copied') : t('integrations.copy', 'Copy')}
        </button>
      </div>
      <pre>{display || value}</pre>
    </div>
  );
}

export default function IntegrationsPanel() {
  const { t } = useTranslation();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [hooks, setHooks] = useState([]);
  const [form, setForm] = useState({ name: '', url: '', secret: '', events: ['record.created'] });
  const [formError, setFormError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const [status, list] = await Promise.all([
        window.api.integrations.status(),
        window.api.integrations.webhooks.list(),
      ]);
      setState(status);
      setHooks(list?.items || []);
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const mcpConfig = useMemo(() => {
    const command = state?.commands?.mcp;
    if (!command) return '';
    return JSON.stringify(
      {
        mcpServers: {
          tecton: {
            command: command.command,
            args: command.args,
            env: command.env,
          },
        },
      },
      null,
      2
    );
  }, [state]);

  const toggleEnabled = async (next) => {
    setBusy('toggle');
    try {
      const result = await window.api.integrations.setEnabled(next);
      if (result?.success === false) {
        toast(t('integrations.start_failed', 'The local API could not start. Check the system logs.'), 'error');
      } else {
        toast(next ? t('integrations.enabled_toast', 'Local integrations are on.') : t('integrations.disabled_toast', 'Local integrations are off.'));
      }
      await refresh();
    } catch {
      toast(t('integrations.start_failed', 'The local API could not start. Check the system logs.'), 'error');
    } finally {
      setBusy('');
    }
  };

  const toggleEvent = (event) => {
    setForm((previous) => ({
      ...previous,
      events: previous.events.includes(event)
        ? previous.events.filter((item) => item !== event)
        : [...previous.events, event],
    }));
  };

  const addHook = async (browserEvent) => {
    browserEvent.preventDefault();
    setFormError('');
    if (!form.url.trim()) {
      setFormError(t('integrations.url_required', 'Enter a destination URL.'));
      return;
    }
    if (!form.events.length) {
      setFormError(t('integrations.events_required', 'Select at least one event.'));
      return;
    }
    setBusy('add');
    try {
      const result = await window.api.integrations.webhooks.save(form);
      if (!result?.success) {
        setFormError(t('integrations.save_failed', 'The webhook could not be saved. Check the address and events.'));
        return;
      }
      setForm({ name: '', url: '', secret: '', events: ['record.created'] });
      toast(t('integrations.hook_saved', 'Webhook saved.'));
      await refresh();
    } catch {
      setFormError(t('integrations.save_failed', 'The webhook could not be saved.'));
    } finally {
      setBusy('');
    }
  };

  const removeHook = async (id) => {
    setBusy(`remove:${id}`);
    try {
      await window.api.integrations.webhooks.remove(id);
      toast(t('integrations.hook_removed', 'Webhook removed.'));
      await refresh();
    } finally {
      setBusy('');
    }
  };

  const testHook = async (id) => {
    setBusy(`test:${id}`);
    try {
      const result = await window.api.integrations.webhooks.test(id);
      toast(
        result?.success
          ? t('integrations.test_ok', 'Test delivered successfully.')
          : t('integrations.test_failed', 'The endpoint did not accept the test delivery.'),
        result?.success ? 'success' : 'error'
      );
      await refresh();
    } finally {
      setBusy('');
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  const running = !!state?.api?.running;
  const cli = state?.commands?.cli;
  const mcpWindows = state?.commands?.mcp?.windows;

  return (
    <div className="integration-panel">
      <section className="glass-card integration-card">
        <div className="integration-head">
          <span className={`integration-icon ${running ? 'on' : 'off'}`}>
            <Server size={18} />
          </span>
          <div className="integration-head-text">
            <h3 className="card-title">{t('integrations.local_api', 'Local API')}</h3>
            <p className="integration-sub">
              {t(
                'integrations.local_api_desc',
                'MCP, the command line and webhooks share one loopback address. Nothing is exposed to the network.'
              )}
            </p>
          </div>
          <span className={`pill ${running ? 'pill-success' : ''}`}>
            {running ? t('integrations.running', 'Running') : t('integrations.stopped', 'Stopped')}
          </span>
        </div>

        <div className="integration-toggle">
          <div>
            <strong>{t('integrations.enable', 'Enable local integrations')}</strong>
            <p>{t('integrations.enable_desc', 'Turn off to revoke every MCP client and CLI session immediately.')}</p>
          </div>
          <Switch
            checked={state?.enabled !== false}
            onChange={toggleEnabled}
            disabled={busy === 'toggle'}
            label={t('integrations.enable', 'Enable local integrations')}
          />
        </div>

        {state?.api?.url && (
          <div className="integration-meta">
            <div>
              <span className="cloud-meta-label">{t('integrations.address', 'Address')}</span>
              <strong>{state.api.url}</strong>
            </div>
            <div>
              <span className="cloud-meta-label">{t('integrations.token', 'Access token')}</span>
              <span className="integration-token">
                <code>{showToken ? state.api.token : '••••••••••••••••'}</code>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={showToken ? t('integrations.hide_token', 'Hide token') : t('integrations.show_token', 'Show token')}
                  onClick={() => setShowToken((value) => !value)}
                >
                  {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={t('integrations.copy_token', 'Copy token')}
                  onClick={async () => {
                    if (await copy(state.api.token)) toast(t('integrations.copied', 'Copied'));
                  }}
                >
                  <Copy size={14} />
                </button>
              </span>
            </div>
          </div>
        )}

        <div className="integration-actions">
          <button type="button" className="btn btn-secondary" onClick={refresh} disabled={busy === 'refresh'}>
            {busy === 'refresh' ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
            {t('integrations.refresh', 'Refresh')}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => window.api.integrations.openConfigFolder()}
          >
            <FolderOpen size={15} />
            {t('integrations.open_config', 'Open configuration folder')}
          </button>
        </div>
      </section>

      <section className="glass-card integration-card">
        <div className="integration-head">
          <span className="integration-icon"><Terminal size={18} /></span>
          <div className="integration-head-text">
            <h3 className="card-title">{t('integrations.cli', 'Command line')}</h3>
            <p className="integration-sub">
              {t('integrations.cli_desc', 'Read status, sites, personnel, cash and the local manual from PowerShell or Terminal.')}
            </p>
          </div>
        </div>

        <CodeBlock
          t={t}
          label={t('integrations.example', 'Example')}
          value={cli ? `${cli.windows} status` : ''}
          display="tecton status"
        />
        <div className="integration-command-list">
          {['projects', 'workers', 'summary', 'docs backup', 'ask "How does cloud sync work?"'].map((command) => (
            <button
              key={command}
              type="button"
              className="integration-command"
              onClick={async () => {
                if (await copy(`${cli?.windows || 'tecton'} ${command}`)) {
                  toast(t('integrations.copied', 'Copied'));
                }
              }}
            >
              <code>tecton {command}</code>
              <Copy size={12} />
            </button>
          ))}
        </div>
      </section>

      <section className="glass-card integration-card">
        <div className="integration-head">
          <span className="integration-icon"><Webhook size={18} /></span>
          <div className="integration-head-text">
            <h3 className="card-title">{t('integrations.mcp', 'MCP server')}</h3>
            <p className="integration-sub">
              {t('integrations.mcp_desc', 'Paste this block into Claude Desktop, Cursor, Windsurf or Cline to give the assistant read access to Tecton.')}
            </p>
          </div>
        </div>

        <CodeBlock t={t} label="claude_desktop_config.json" value={mcpConfig} />
        <div className="integration-hint">
          <Send size={14} />
          <span>{t('integrations.mcp_hint', 'The server speaks MCP over stdio and only reads data through the local API.')}</span>
        </div>
        {mcpWindows && (
          <CodeBlock t={t} label={t('integrations.manual_test', 'Manual test')} value={`echo {"jsonrpc":"2.0","id":1,"method":"initialize"} | ${mcpWindows}`} />
        )}
      </section>

      <section className="glass-card integration-card">
        <div className="integration-head">
          <span className="integration-icon"><Webhook size={18} /></span>
          <div className="integration-head-text">
            <h3 className="card-title">{t('integrations.webhooks', 'Webhooks')}</h3>
            <p className="integration-sub">
              {t('integrations.webhooks_desc', 'Send signed events to a URL you control. Every delivery includes an HMAC-SHA256 signature.')}
            </p>
          </div>
        </div>

        {hooks.length === 0 ? (
          <p className="cloud-hint">{t('integrations.no_hooks', 'No webhook yet. Add one below to receive events.')}</p>
        ) : (
          <div className="integration-hook-list">
            {hooks.map((hook) => (
              <div key={hook.id} className="integration-hook">
                <div className="integration-hook-main">
                  <strong>{hook.name || hook.url}</strong>
                  <span className="integration-hook-url">{hook.url}</span>
                  <div className="integration-hook-events">
                    {hook.events.map((event) => (
                      <span key={event} className="integration-chip">
                        {t(EVENT_KEYS[event] || event, event)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="integration-hook-side">
                  <span className={`pill ${hook.lastStatus === 'ok' ? 'pill-success' : hook.lastStatus ? 'pill-danger' : ''}`}>
                    {hook.lastStatus === 'ok'
                      ? t('integrations.last_ok', 'Last delivery ok')
                      : hook.lastStatus
                        ? t('integrations.last_failed', 'Last delivery failed')
                        : t('integrations.never_sent', 'Not sent yet')}
                  </span>
                  <button
                    type="button"
                    className="btn"
                    onClick={() => testHook(hook.id)}
                    disabled={busy === `test:${hook.id}`}
                  >
                    {busy === `test:${hook.id}` ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                    {t('integrations.send_test', 'Send test')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary danger-text"
                    onClick={() => removeHook(hook.id)}
                    disabled={busy === `remove:${hook.id}`}
                  >
                    <Trash2 size={14} />
                    {t('common.delete', 'Delete')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <form className="integration-form" onSubmit={addHook}>
          <div className="integration-form-grid">
            <label className="form-group">
              <span className="form-label">{t('integrations.hook_name', 'Name')}</span>
              <input
                className="form-input"
                value={form.name}
                onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))}
                placeholder={t('integrations.hook_name', 'Name')}
                maxLength={80}
              />
            </label>
            <label className="form-group">
              <span className="form-label">{t('integrations.hook_url', 'Destination URL')}</span>
              <input
                className="form-input"
                value={form.url}
                onChange={(event) => setForm((previous) => ({ ...previous, url: event.target.value }))}
                placeholder="https://example.com/tecton"
                inputMode="url"
              />
            </label>
            <label className="form-group">
              <span className="form-label">{t('integrations.hook_secret', 'Signing secret')}</span>
              <input
                className="form-input"
                value={form.secret}
                onChange={(event) => setForm((previous) => ({ ...previous, secret: event.target.value }))}
                placeholder={t('integrations.hook_secret', 'Signing secret')}
                type="password"
                autoComplete="new-password"
              />
            </label>
          </div>

          <fieldset className="integration-events">
            <legend className="form-label">{t('integrations.hook_events', 'Events')}</legend>
            {Object.entries(EVENT_KEYS).map(([event, key]) => (
              <label key={event} className="integration-check">
                <input
                  type="checkbox"
                  checked={form.events.includes(event)}
                  onChange={() => toggleEvent(event)}
                />
                <span>{t(key, event)}</span>
              </label>
            ))}
          </fieldset>

          {formError && <p className="cloud-hint error-text">{formError}</p>}

          <button type="submit" className="btn btn-primary" disabled={busy === 'add'}>
            {busy === 'add' ? <Loader2 size={15} className="spin" /> : <Plus size={15} />}
            {t('integrations.add_hook', 'Add webhook')}
          </button>
        </form>
      </section>
    </div>
  );
}
