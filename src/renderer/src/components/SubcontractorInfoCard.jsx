import React from 'react';
import { formatCurrency } from '../utils/formatUtils';
import { Lightbulb } from 'lucide-react';

const SubcontractorInfoCard = ({ t, i18n, subcontractor, projectName, totalHakedis, totalOdeme, netBalance, onBack, onHelp }) => {
  let parsedTags = [];
  try {
    if (subcontractor && subcontractor.tags) {
      const parsed = typeof subcontractor.tags === 'string' ? JSON.parse(subcontractor.tags) : subcontractor.tags;
      if (Array.isArray(parsed)) {
        parsedTags = parsed;
      }
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to parse tags", e);
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <button className="btn" style={{ marginBottom: 0, padding: '0.5rem 1rem' }} onClick={onBack}>← {t('common.back', 'Geri')}</button>
        <span
          onClick={onHelp}
          style={{
            cursor: 'pointer',
            opacity: 'var(--guide-icon-opacity, 0.4)', filter: 'var(--guide-icon-filter, none)',
            transition: 'opacity 0.25s ease-in-out',
            fontSize: '1.6rem',
            userSelect: 'none',
            padding: '0.25rem'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity-hover, 1)'}
          onMouseLeave={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity, 0.4)'}
          title={t('common.page_guide', 'Sayfa Kılavuzu')}
        >
          <Lightbulb size={18} aria-hidden="true" />
        </span>
      </div>

      {/* Sol Kolon - Bilgi ve Formlar */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '1rem', gap: '0.75rem', width: '350px', height: 'calc(100vh - 150px)', boxSizing: 'border-box' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', fontWeight: 'bold', margin: '0 auto', color: '#fff' }}>
            {subcontractor.name.charAt(0)}
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', marginTop: '0.5rem' }}>{subcontractor.name}</h2>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{subcontractor.service_type}</div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', margin: '0.25rem 0 0.5rem 0' }}>
            {projectName && (
              <span style={{ fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                 {projectName}
              </span>
            )}
            {(() => {
              const expiryDate = subcontractor.isg_expiry_date;
              if (!expiryDate) {
                return (
                  <span style={{ fontSize: '0.8rem', background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                     {t('isg.badge_undefined', 'İSG Tanımsız')}
                  </span>
                );
              }
              const today = new Date(); today.setHours(0, 0, 0, 0);
              const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
              const diffDays = Math.ceil((expiry - today) / (1000 * 3600 * 24));
              let badgeBg, badgeColor, badgeText, badgeIcon;
              if (diffDays < 0) {
                badgeBg = 'rgba(239, 68, 68, 0.2)'; badgeColor = '#f87171'; badgeIcon = ''; badgeText = t('isg.badge_expired', 'İSG Süresi Doldu');
              } else if (diffDays <= 30) {
                badgeBg = 'rgba(245, 158, 11, 0.2)'; badgeColor = '#fbbf24'; badgeIcon = ''; badgeText = t('isg.badge_approaching', 'İSG Yaklaşıyor') + ` (${diffDays} ${t('isg.days', 'gün')})`;
              } else {
                badgeBg = 'rgba(16, 185, 129, 0.2)'; badgeColor = '#34d399'; badgeIcon = ''; badgeText = t('isg.badge_valid', 'İSG Geçerli');
              }
              return (
                <span style={{ fontSize: '0.8rem', background: badgeBg, color: badgeColor, padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                  {badgeIcon} {badgeText}
                </span>
              );
            })()}
            {parsedTags.map((tag, idx) => (
              <span key={idx} style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                 {tag}
              </span>
            ))}
          </div>

          {/* Ozet Kartlari */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', marginTop: '2.5rem' }}>
            <div style={{ background: 'var(--success-bg-light)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--success-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.total_earned', 'Toplam Hakediş')}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success-text)', marginTop: '0.25rem' }}>{formatCurrency(totalHakedis, i18n.language)}</div>
            </div>
            <div style={{ background: 'var(--danger-bg-light)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--danger-border)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.total_paid', 'Yapılan Ödemeler')}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-text)', marginTop: '0.25rem' }}>{formatCurrency(totalOdeme, i18n.language)}</div>
            </div>
            <div style={{ background: 'var(--glass-bg)', padding: '1.5rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', boxShadow: 'var(--card-shadow)' }}>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('subcontractor_profile.remaining_balance', 'Kalan Bakiye (Net Cari)')}</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: netBalance >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                {formatCurrency(netBalance, i18n.language)}
              </div>
            </div>
          </div>

        </div>
    </>
  );
};

export default SubcontractorInfoCard;
