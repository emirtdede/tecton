import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  Check,
  Cloud,
  Copy,
  Keyboard,
  LifeBuoy,
  MousePointerClick,
} from 'lucide-react';

// Every topic reuses the fully translated `guides.*` dictionary, so the manual
// never drifts from the modules it documents.
const TOPICS = [
  'site',
  'personnel',
  'worker_profile',
  'bulk',
  'quantity',
  'delivery',
  'journal',
  'quality',
  'subcontractor',
  'subcontractor_profile',
  'media',
  'cash',
  'recycle',
  'logs',
];

export default function Documentation() {
  const { t } = useTranslation();
  const [active, setActive] = useState('site');
  const [copied, setCopied] = useState(false);

  const guide = useMemo(() => {
    const bundle = t(`guides.${active}`, { returnObjects: true });
    return bundle && typeof bundle === 'object' ? bundle : {};
  }, [t, active]);

  const questions = useMemo(() => {
    return [1, 2, 3, 4, 5, 6]
      .map((index) => ({
        title: guide[`q${index}`]?.title,
        desc: guide[`q${index}`]?.desc,
      }))
      .filter((entry) => entry.title && entry.desc);
  }, [guide]);

  const copyReport = async () => {
    try {
      const result = await window.api?.system?.infoReport?.();
      if (!result || !result.success) return;
      await navigator.clipboard.writeText(result.report);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      /* clipboard is best-effort */
    }
  };

  return (
    <div className="docs-view" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="glass-card docs-hero">
        <div>
          <h2 className="card-title" style={{ marginBottom: '0.35rem' }}>
            <BookOpen size={20} /> {t('docs.title', 'Documentation')}
          </h2>
          <p className="docs-subtitle">
            {t('docs.subtitle', 'A practical manual for every module, plus the shortcuts and backup rules that keep your data safe.')}
          </p>
        </div>
      </div>

      <div className="docs-layout">
        <nav className="glass-card docs-nav" aria-label={t('docs.select_topic', 'Topics')}>
          <span className="cloud-meta-label">{t('docs.select_topic', 'Topics')}</span>
          {TOPICS.map((topic) => (
            <button
              key={topic}
              type="button"
              className={`docs-nav-item ${active === topic ? 'active' : ''}`}
              onClick={() => setActive(topic)}
            >
              {t(`guides.${topic}.title`, topic)}
            </button>
          ))}
        </nav>

        <section className="docs-content">
          <div className="glass-card">
            <h3 className="card-title" style={{ marginBottom: '1rem' }}>
              {t(`guides.${active}.title`, active)}
            </h3>
            <div className="docs-qa">
              {questions.map((entry) => (
                <article key={entry.title} className="docs-qa-item">
                  <h4>{entry.title}</h4>
                  <p>{entry.desc}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="docs-grid">
            <div className="glass-card docs-card">
              <h3 className="card-title" style={{ marginBottom: '0.6rem' }}>
                <Keyboard size={17} /> {t('docs.hotkey_title', 'Keyboard shortcuts')}
              </h3>
              <div className="docs-shortcut">
                <MousePointerClick size={15} />
                <span>{t('docs.hotkey_spotlight', 'Search every page')}</span>
                <kbd>Ctrl</kbd><kbd>K</kbd>
              </div>
              <div className="docs-shortcut">
                <Keyboard size={15} />
                <span>{t('docs.hotkey_global', 'Open Tecton from anywhere')}</span>
                <kbd>Ctrl</kbd><kbd>Alt</kbd><kbd>N</kbd>
              </div>
              <p className="docs-muted">
                {t('docs.hotkey_desc', 'The global shortcut works even while Tecton is minimised to the tray.')}
              </p>
            </div>

            <div className="glass-card docs-card">
              <h3 className="card-title" style={{ marginBottom: '0.6rem' }}>
                <Cloud size={17} /> {t('docs.cloud_title', 'Backups')}
              </h3>
              <p className="docs-muted">
                {t('docs.cloud_desc', 'Tecton writes a daily snapshot to your cloud folder, keeps the previous file, and rotates 15 daily backups. The newest valid copy is used when a file is damaged.')}
              </p>
            </div>

            <div className="glass-card docs-card docs-card-wide">
              <h3 className="card-title" style={{ marginBottom: '0.6rem' }}>
                <LifeBuoy size={17} /> {t('docs.support_title', 'Support report')}
              </h3>
              <p className="docs-muted">
                {t('docs.support_desc', 'Copy a diagnostic summary (version, Windows build, database size, cloud status) to paste into a support request. No personal records are included.')}
              </p>
              <button type="button" className="btn btn-primary docs-copy" onClick={copyReport}>
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? t('docs.copied', 'Copied to clipboard') : t('docs.copy_report', 'Copy support report')}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
