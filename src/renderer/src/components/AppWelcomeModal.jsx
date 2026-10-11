import React from 'react';
import TectonDark from '../assets/tecton_dark.svg';
import TectonLight from '../assets/tecton_light.svg';

const AppWelcomeModal = ({ t, i18n, show, dontShowAgain, setDontShowAgain, onClose, onLanguageChange }) => {
  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(5, 7, 12, 0.7)',
      backdropFilter: 'blur(28px)',
      WebkitBackdropFilter: 'blur(28px)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 99999,
      animation: 'fadeIn 0.4s ease-out'
    }}>
      <style>{`
        :root[data-theme='light'] {
          --welcome-card-bg: #ffffff;
          --welcome-card-border: rgba(0,0,0,0.08);
          --welcome-text-title: #0f172a;
          --welcome-text-muted: #475569;
          --welcome-close-color: #64748b;
          --welcome-close-hover: #0f172a;
          --welcome-features-bg: rgba(139, 92, 246, 0.15);
          --welcome-features-border: rgba(139, 92, 246, 0.25);
        }
        :root[data-theme='dark'] {
          --welcome-card-bg: #0d111a;
          --welcome-card-border: rgba(255, 255, 255, 0.08);
          --welcome-text-title: #f8fafc;
          --welcome-text-muted: #94a3b8;
          --welcome-close-color: #94a3b8;
          --welcome-close-hover: #ffffff;
          --welcome-features-bg: rgba(139, 92, 246, 0.05);
          --welcome-features-border: rgba(139, 92, 246, 0.1);
        }
      `}</style>
      <div className="glass-card" style={{
        width: '540px',
        padding: '3.5rem 2.5rem 2.5rem 2.5rem',
        borderRadius: '24px',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(139, 92, 246, 0.12)',
        border: '1px solid var(--welcome-card-border)',
        background: 'var(--welcome-card-bg)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
      }}>
        {/* Language Selector in Top Left */}
        <div style={{ position: 'absolute', top: '1.25rem', left: '1.25rem' }}>
          <select
            value={i18n.language}
            onChange={(e) => onLanguageChange(e.target.value)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              color: 'var(--welcome-text-title)',
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.8rem',
              outline: 'none',
              fontFamily: 'Inter, sans-serif',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
            onMouseEnter={e => {
              e.target.style.background = 'rgba(255, 255, 255, 0.1)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            onMouseLeave={e => {
              e.target.style.background = 'rgba(255, 255, 255, 0.05)';
              e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            }}
          >
            <option value="tr" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Türkçe</option>
            <option value="en" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>English</option>
            <option value="de" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Deutsch</option>
            <option value="fr" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Français</option>
            <option value="es" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Español</option>
            <option value="it" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Italiano</option>
            <option value="pt" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Português</option>
            <option value="nl" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Nederlands</option>
            <option value="pl" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Polski</option>
            <option value="ru" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Русский</option>
            <option value="zh" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>简体中文</option>
            <option value="ja" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>日本語</option>
            <option value="ko" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>한국어</option>
            <option value="ar" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>العربية</option>
            <option value="hi" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>हिन्दी</option>
            <option value="sv" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Svenska</option>
            <option value="no" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Norsk</option>
            <option value="da" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Dansk</option>
            <option value="cs" style={{ background: 'var(--welcome-card-bg)', color: 'var(--welcome-text-title)' }}>Čeština</option>
          </select>
        </div>

        {/* Close Button in Top Right */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1.25rem',
            right: '1.25rem',
            background: 'transparent',
            border: 'none',
            color: 'var(--welcome-close-color)',
            cursor: 'pointer',
            padding: '0.4rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 0.2s',
            outline: 'none'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--welcome-close-hover)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--welcome-close-color)'}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {/* Direct Premium App Logo (Borderless) */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }}>
          <img src={TectonDark} alt="Tecton" className="logo-dark" style={{ width: '80px', height: '80px', filter: 'drop-shadow(0 0 16px rgba(139, 92, 246, 0.4))' }} />
          <img src={TectonLight} alt="Tecton" className="logo-light" style={{ width: '80px', height: '80px', filter: 'drop-shadow(0 0 16px rgba(139, 92, 246, 0.4))' }} />
        </div>

        {/* Welcome Content */}
        <h1 style={{
          fontSize: '2rem',
          fontWeight: '800',
          margin: '0 0 1rem 0',
          background: 'linear-gradient(135deg, var(--welcome-text-title) 30%, #a78bfa 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em',
          fontFamily: 'Outfit, Inter, sans-serif'
        }}>
          {t('welcome.modal_title')}
        </h1>

        <p style={{
          fontSize: '0.975rem',
          lineHeight: '1.6',
          color: 'var(--welcome-text-muted)',
          margin: '0 0 2rem 0',
          fontFamily: 'Inter, sans-serif'
        }}>
          {t('welcome.modal_desc')}
        </p>

        {/* Premium Badge Section / Features summary */}
        <div style={{
          background: 'var(--welcome-features-bg)',
          border: '1px solid var(--welcome-features-border)',
          borderRadius: '12px',
          padding: '0.85rem 1.25rem',
          fontSize: '0.825rem',
          color: '#a78bfa',
          fontWeight: '500',
          marginBottom: '2.5rem',
          lineHeight: '1.6',
          fontFamily: 'Inter, sans-serif',
          letterSpacing: '0.01em',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.4rem',
          width: '100%'
        }}>
          <div>🚀 {t('welcome.infra_feature')} | 📊 {t('welcome.finance_feature')}</div>
          <div>🔒 {t('welcome.database_feature')}</div>
        </div>

        {/* Footer Actions */}
        <div style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem'
        }}>
          <button
            onClick={onClose}
            style={{
              width: '100%',
              padding: '0.9rem',
              borderRadius: '12px',
              border: 'none',
              background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
              color: '#ffffff',
              fontSize: '1rem',
              fontWeight: '600',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(139, 92, 246, 0.3)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              fontFamily: 'Inter, sans-serif'
            }}
            onMouseEnter={e => {
              e.target.style.transform = 'translateY(-1px)';
              e.target.style.boxShadow = '0 6px 24px rgba(139, 92, 246, 0.4)';
            }}
            onMouseLeave={e => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = '0 4px 20px rgba(139, 92, 246, 0.3)';
            }}
          >
            {t('welcome.get_started')}
          </button>

          {/* Do not show again checkbox */}
          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            userSelect: 'none',
            fontSize: '0.85rem',
            color: 'var(--welcome-text-muted)',
            fontFamily: 'Inter, sans-serif'
          }}>
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              style={{
                cursor: 'pointer',
                accentColor: '#8b5cf6',
                width: '15px',
                height: '15px'
              }}
            />
            <span>{t('welcome.dont_show_again')}</span>
          </label>
        </div>
      </div>
    </div>
  );
};

export default AppWelcomeModal;
