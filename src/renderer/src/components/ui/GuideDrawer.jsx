import { useTranslation } from 'react-i18next';
import useModalA11y from '../../hooks/useModalA11y';

const GuideDrawer = ({ 
  isOpen, 
  onClose, 
  title, 
  desc, 
  h1, 
  p1, 
  h2, 
  p2, 
  h3, 
  p3,
  h4,
  p4,
  h5,
  p5,
  h6,
  p6
}) => {
  const { t } = useTranslation();
  const { dialogProps, containerRef } = useModalA11y({ isOpen, onClose, label: title });

  if (!isOpen) return null;

  return (
    <div 
      className="drawer-overlay" 
      style={{ 
        position: 'fixed', 
        top: 0, left: 0, right: 0, bottom: 0, 
        zIndex: 9999, 
        display: 'flex', 
        justifyContent: 'flex-end',
        backdropFilter: 'blur(8px)',
        backgroundColor: 'rgba(15, 23, 42, 0.6)'
      }}
      onClick={onClose}
    >
      <div 
        ref={containerRef}
        {...dialogProps}
        className="glass-card" 
        style={{ 
          width: '100%', 
          maxWidth: '480px', 
          height: '100%', 
          borderRadius: '20px 0 0 20px', 
          padding: '2.5rem 1.5rem', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '1.5rem',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          background: 'var(--option-bg, #0f172a)',
          borderLeft: '1px solid var(--glass-border)',
          animation: 'slideIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) forwards',
          outline: 'none'
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem', gap: '0.5rem' }}>
          <h3 className="card-title" style={{ 
            fontSize: '1.05rem', 
            marginBottom: 0, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.5rem', 
            flex: 1
          }} title={` ${title}`}>
            <span style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--accent)' }} aria-hidden="true"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 7v14"/><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/></svg></span>
            <span>{title}</span>
          </h3>
          <button 
            className="btn btn-close"
            aria-label={t('common.close', 'Kapat')}
            title={t('common.close', 'Kapat')}
            onClick={onClose}
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              fontSize: '1rem',
              cursor: 'pointer'
            }}
          >
            
          </button>
        </div>
        <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1.25rem', paddingRight: '4px' }}>
          {desc && (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
              {desc}
            </p>
          )}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {h1 && (
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.4rem', marginTop: 0 }}>
                  {h1}
                </h4>
                {p1 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    {p1}
                  </p>
                )}
              </div>
            )}
            
            {h2 && (
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.4rem', marginTop: 0 }}>
                  {h2}
                </h4>
                {p2 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    {p2}
                  </p>
                )}
              </div>
            )}
            
            {h3 && (
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.4rem', marginTop: 0 }}>
                  {h3}
                </h4>
                {p3 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    {p3}
                  </p>
                )}
              </div>
            )}
            
            {h4 && (
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.4rem', marginTop: 0 }}>
                  {h4}
                </h4>
                {p4 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    {p4}
                  </p>
                )}
              </div>
            )}

            {h5 && (
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.4rem', marginTop: 0 }}>
                  {h5}
                </h4>
                {p5 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    {p5}
                  </p>
                )}
              </div>
            )}
            
            {h6 && (
              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: '600', color: 'var(--text-main)', marginBottom: '0.4rem', marginTop: 0 }}>
                  {h6}
                </h4>
                {p6 && (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>
                    {p6}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GuideDrawer;
