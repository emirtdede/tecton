import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    try {
      if (window.api && window.api.system && window.api.system.readLogs) {
        // best-effort: renderer crash surfaced via toast channel
      }
      // eslint-disable-next-line no-console
      console.error('Renderer crash captured by ErrorBoundary:', error, info);
    } catch (_) { /* never throw from error path */ }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
          <h2>Beklenmeyen bir hata oluştu / An unexpected error occurred</h2>
          <p>Lütfen uygulamayı yeniden başlatın. Verileriniz kaybolmaz.</p>
          <button onClick={() => window.location.reload()}>Yeniden Başlat / Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
