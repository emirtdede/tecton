import { useTranslation } from 'react-i18next';
import useModalA11y from '../../hooks/useModalA11y';

/**
 * Renders `**bold**` markers inside a translated string.
 * Moved here from MaterialManagement/QualityReports, its only two consumers.
 */
const renderDescription = (text) =>
  text.split('**').map((part, index) =>
    index % 2 === 1 ? (
      <strong key={`${index}-${part}`} style={{ fontWeight: 'bold' }}>{part}</strong>
    ) : (
      part
    )
  );

/**
 * "Upload a photo from your phone" modal: shows the LAN server URL as a QR code.
 *
 * Was copy-pasted into MaterialManagement and QualityReports (~35 lines each).
 * The copies had already drifted: one showed a translated "Bağlantı:" label,
 * the other a hard-coded, untranslated "URL: ".
 */
const MobileUploadModal = ({ isOpen, onClose, title, description, qrCode, url, linkLabel }) => {
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
        justifyContent: 'center',
        alignItems: 'center',
        backdropFilter: 'blur(16px)',
        backgroundColor: 'rgba(15, 23, 42, 0.75)'
      }}
      onClick={onClose}
    >
      <div
        ref={containerRef}
        {...dialogProps}
        className="glass-card"
        style={{
          maxWidth: '400px',
          width: '90%',
          padding: '2.5rem 2rem',
          textAlign: 'center',
          background: 'var(--spotlight-bg)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          borderRadius: '20px',
          outline: 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="card-title" style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>
           {title}
        </h3>
        <p className="card-subtitle" style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
          {renderDescription(description)}
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
          <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)', width: '212px', height: '212px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <img src={qrCode} alt={t('common.qr_code', 'QR kodu')} style={{ width: '180px', height: '180px', display: 'block', objectFit: 'contain' }} />
          </div>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all', padding: '0.5rem', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
          {linkLabel || t('common.qr_link', 'Bağlantı:')} <code style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{url}</code>
        </div>
        <button type="button" className="btn btn-danger" onClick={onClose} style={{ width: '100%', marginTop: '1.5rem', height: '42px', fontWeight: 'bold' }}>
          {t('common.cancel', 'İptal Et')}
        </button>
      </div>
    </div>
  );
};

export default MobileUploadModal;
