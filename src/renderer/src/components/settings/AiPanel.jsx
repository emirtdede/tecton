import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Brain,
  CheckCircle2,
  Cpu,
  Download,
  ExternalLink,
  HardDriveDownload,
  Loader2,
  MemoryStick,
  Power,
  Search,
  Sparkles,
  Trash2,
} from 'lucide-react';

function toast(message, type = 'success') {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
}

const SUGGESTIONS = ['ai.suggest_1', 'ai.suggest_2', 'ai.suggest_3', 'ai.suggest_4'];

export default function AiPanel() {
  const { t, i18n } = useTranslation();
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [asking, setAsking] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const next = await window.api.ai.status();
      if (mounted.current) setState(next);
    } catch {
      if (mounted.current) setState(null);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const unsubscribe = window.api.ai.onDownloadProgress((event) => {
      if (!mounted.current) return;
      setProgress(event);
      if (event.status === 'success') {
        setProgress(null);
      }
    });
    return () => {
      mounted.current = false;
      unsubscribe?.();
    };
  }, [refresh]);

  useEffect(() => {
    if (progress?.status === 'success') {
      toast(t('ai.download_done', 'Model downloaded. Activate it to start answering.'));
      setProgress(null);
      refresh();
    }
  }, [progress, refresh, t]);

  const run = async (key, action, successKey) => {
    setBusy(key);
    try {
      const result = await action();
      if (result?.success === false) {
        toast(t('ai.action_failed', 'The action could not be completed. Check that the local runtime is running.'), 'error');
      } else if (successKey) {
        toast(t(successKey));
      }
      await refresh();
      return result;
    } catch {
      toast(t('ai.action_failed', 'The action could not be completed. Check that the local runtime is running.'), 'error');
      return null;
    } finally {
      setBusy('');
    }
  };

  const ask = async (value) => {
    const text = String(value ?? question).trim();
    if (!text) return;
    setAsking(true);
    setAnswer(null);
    try {
      const result = await window.api.ai.ask(text, i18n.language);
      setAnswer(result);
    } catch {
      setAnswer({ success: false, answer: t('ai.ask_failed', 'The assistant could not answer. Try again.') });
    } finally {
      setAsking(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  const system = state?.system;
  const runtimeReady = state?.runtime?.available;
  const tierModel = system?.tier?.model;
  const percent = progress?.percent || 0;

  return (
    <div className="ai-panel">
      <section className="glass-card ai-card">
        <div className="ai-head">
          <span className={`integration-icon ${runtimeReady ? 'on' : 'off'}`}>
            <Brain size={18} />
          </span>
          <div className="integration-head-text">
            <h3 className="card-title">{t('ai.title', 'Local assistant')}</h3>
            <p className="integration-sub">
              {t('ai.subtitle', 'Answers come from the built-in manual. With a local model the wording is natural; without one the matching passages are quoted directly.')}
            </p>
          </div>
          <span className={`cloud-badge ${state?.runtime?.ready ? 'on' : 'off'}`}>
            {state?.runtime?.ready
              ? t('ai.active', 'Active')
              : t('ai.passive', 'Passive')}
          </span>
        </div>

        {!runtimeReady && (
          <div className="ai-callout">
            <Sparkles size={16} />
            <div>
              <strong>{t('ai.runtime_missing', 'Ollama is not running')}</strong>
              <p>
                {t('ai.runtime_missing_desc', 'Document search already works without it. Install Ollama to let a local model write the answers instead of quoting passages.')}
              </p>
            </div>
            <button type="button" className="btn btn-secondary" onClick={() => window.api.ai.openRuntime()}>
              <ExternalLink size={14} />
              {t('ai.get_runtime', 'Open download page')}
            </button>
          </div>
        )}

        <div className="ai-system">
          <div className="ai-system-item">
            <MemoryStick size={15} />
            <span>{t('ai.memory', 'Memory')}</span>
            <strong>{system ? `${system.totalRamGb} GB` : '-'}</strong>
          </div>
          <div className="ai-system-item">
            <Cpu size={15} />
            <span>{t('ai.cpu', 'Processor')}</span>
            <strong>{system ? `${system.cores} ${t('ai.cores', 'cores')}` : '-'}</strong>
          </div>
          <div className="ai-system-item">
            <HardDriveDownload size={15} />
            <span>{t('ai.gpu', 'Graphics')}</span>
            <strong>{system?.gpu || t('ai.gpu_unknown', 'Not detected')}</strong>
          </div>
          <div className="ai-system-item">
            <Sparkles size={15} />
            <span>{t('ai.recommendation', 'Recommendation')}</span>
            <strong>{t(system?.tier?.labelKey || 'ai.tier_balanced', system?.tier?.id || 'balanced')}</strong>
          </div>
        </div>
        <p className="cloud-hint">{t(system?.tier?.noteKey || 'ai.tier_balanced_note')}</p>
      </section>

      <section className="glass-card ai-card">
        <div className="ai-head">
          <span className="integration-icon"><Power size={18} /></span>
          <div className="integration-head-text">
            <h3 className="card-title">{t('ai.models', 'Models')}</h3>
            <p className="integration-sub">
              {t('ai.models_desc', 'Download one model that fits this computer. You can delete it at any time; the assistant falls back to quoted answers.')}
            </p>
          </div>
        </div>

        {progress && (
          <div className="ai-progress">
            <div className="ai-progress-head">
              <span>{progress.modelId}</span>
              <span>{percent}%</span>
            </div>
            <div className="ai-progress-track">
              <div className="ai-progress-bar" style={{ width: `${percent}%` }} />
            </div>
            <span className="cloud-hint">{t('ai.downloading', 'Downloading the model. You can keep working.')}</span>
          </div>
        )}

        <div className="ai-model-list">
          {(state?.models || []).map((model) => (
            <div key={model.id} className={`ai-model ${model.recommended ? 'recommended' : ''}`}>
              <div className="ai-model-main">
                <div className="ai-model-title">
                  <strong>{model.id}</strong>
                  {model.recommended && <span className="integration-chip">{t('ai.recommended', 'Recommended')}</span>}
                  {model.active && (
                    <span className="integration-chip on">
                      <CheckCircle2 size={11} /> {t('ai.active', 'Active')}
                    </span>
                  )}
                </div>
                <span className="ai-model-meta">
                  {model.params} · {model.sizeGb} GB
                </span>
              </div>
              <div className="ai-model-actions">
                {!model.installed && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={!runtimeReady || !!progress || busy === `download:${model.id}`}
                    onClick={() =>
                      run(
                        `download:${model.id}`,
                        () => window.api.ai.download(model.id),
                        null,
                        'ai.error_download'
                      )
                    }
                  >
                    {busy === `download:${model.id}` || progress?.modelId === model.id
                      ? <Loader2 size={14} className="spin" />
                      : <Download size={14} />}
                    {t('ai.download', 'Download')}
                  </button>
                )}
                {model.installed && !model.active && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!runtimeReady || busy === `activate:${model.id}`}
                    onClick={() =>
                      run(
                        `activate:${model.id}`,
                        () => window.api.ai.activate(model.id),
                        'ai.activated_toast',
                        'ai.error_activate'
                      )
                    }
                  >
                    {busy === `activate:${model.id}` ? <Loader2 size={14} className="spin" /> : <Power size={14} />}
                    {t('ai.activate', 'Activate')}
                  </button>
                )}
                {model.installed && (
                  <button
                    type="button"
                    className="btn btn-secondary danger-text"
                    disabled={busy === `delete:${model.id}`}
                    onClick={() =>
                      run(
                        `delete:${model.id}`,
                        () => window.api.ai.remove(model.id),
                        'ai.deleted_toast',
                        'ai.error_delete'
                      )
                    }
                  >
                    {busy === `delete:${model.id}` ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                    {t('common.delete', 'Delete')}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {state?.activeModel && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => run('deactivate', () => window.api.ai.deactivate(), 'ai.deactivated_toast', 'ai.error_deactivate')}
            disabled={busy === 'deactivate'}
          >
            <Power size={14} />
            {t('ai.deactivate', 'Deactivate model')}
          </button>
        )}

        {state?.extraInstalled?.length > 0 && (
          <p className="cloud-hint">
            {t('ai.extra_installed', 'Also installed in Ollama')}: {state.extraInstalled.join(', ')}
          </p>
        )}
        <p className="cloud-hint">
          {t('ai.recommended_for', { model: tierModel, defaultValue: 'Recommended for this computer: {{model}}' })}
        </p>
      </section>

      <section className="glass-card ai-card">
        <div className="ai-head">
          <span className="integration-icon"><Search size={18} /></span>
          <div className="integration-head-text">
            <h3 className="card-title">{t('ai.ask_title', 'Ask the manual')}</h3>
            <p className="integration-sub">
              {t('ai.ask_desc', 'Searches {{count}} built-in sections. No question or record leaves this computer.', {
                count: state?.rag?.documents || 0,
              })}
            </p>
          </div>
        </div>

        <div className="ai-form">
          <input
            className="form-input"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                ask();
              }
            }}
            placeholder={t('ai.ask_placeholder', 'For example: how do I restore a deleted record?')}
            aria-label={t('ai.ask_title', 'Ask the manual')}
          />
          <button type="button" className="btn btn-primary" onClick={() => ask()} disabled={asking || !question.trim()}>
            {asking ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {t('ai.ask', 'Ask')}
          </button>
        </div>

        <div className="ai-suggestions">
          {SUGGESTIONS.map((key) => (
            <button
              key={key}
              type="button"
              className="integration-command"
              onClick={() => {
                setQuestion(t(key));
                ask(t(key));
              }}
            >
              {t(key)}
            </button>
          ))}
        </div>

        {answer && (
          <div className={`ai-answer ${answer.success === false ? 'error' : ''}`}>
            <div className="ai-answer-head">
              <span className={`cloud-badge ${answer.mode === 'model' ? 'on' : 'off'}`}>
                {answer.mode === 'model' ? t('ai.mode_model', 'Local model') : t('ai.mode_knowledge', 'Manual excerpt')}
              </span>
              {answer.citations?.length > 0 && (
                <span className="ai-citations">
                  {t('ai.sources', 'Sources')}: {answer.citations.map((item) => item.title).join(', ')}
                </span>
              )}
            </div>
            <p>{answer.answer}</p>
          </div>
        )}

        <p className="cloud-hint">
          {t('ai.index_stats', 'Index: {{documents}} sections, {{terms}} terms.', {
            documents: state?.rag?.documents || 0,
            terms: state?.rag?.terms || 0,
          })}
        </p>
      </section>
    </div>
  );
}
