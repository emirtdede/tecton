import { Component } from 'react';
import i18n from '../../i18n';
import { logError } from '../../utils/logger';

/**
 * Catches render-time errors in the component subtree and shows a recoverable
 * fallback instead of leaving the user with a blank window.
 *
 * React unmounts the whole tree when an error escapes render, so before this
 * existed a single bad record (for example a malformed date reaching a
 * formatter) killed the entire app with no way back except a restart.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const where = this.props.name || 'root';
    logError(`ErrorBoundary(${where})${info?.componentStack ? `: ${info.componentStack}` : ''}`, error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const t = i18n.t.bind(i18n);

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          padding: '3rem 1.5rem',
          minHeight: '280px',
          height: '100%',
          textAlign: 'center',
          color: 'var(--text-main, #e2e8f0)'
        }}
      >
        <div style={{ color: 'var(--danger, var(--danger))', display: 'flex', justifyContent: 'center' }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></div>
        <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
          {t('common.error_boundary_title', 'Bu bölüm yüklenemedi')}
        </h2>
        <p style={{ margin: 0, maxWidth: '46ch', fontSize: '0.9rem', opacity: 0.75 }}>
          {t('common.error_boundary_desc', 'Beklenmeyen bir hata oluştu. Sayfayı yeniden deneyebilir veya uygulamayı yeniden yükleyebilirsiniz. Verileriniz korunmuştur.')}
        </p>
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-primary" onClick={this.handleReset}>
            {t('common.error_boundary_retry', 'Tekrar Dene')}
          </button>
          <button type="button" className="btn" onClick={this.handleReload}>
            {t('common.error_boundary_reload', 'Yeniden Yükle')}
          </button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
