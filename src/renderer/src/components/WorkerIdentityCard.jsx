import React from 'react';
import { formatCurrency } from '../utils/formatUtils';
import { Lightbulb } from 'lucide-react';

const WorkerIdentityCard = ({ t, i18n, worker, projectName, groupName, balance, onBack, onHelp, onOpenIsg }) => {
  const isPositive = balance >= 0;

  let parsedTags = [];
  if (worker.tags) {
    try {
      parsedTags = JSON.parse(worker.tags);
    } catch (e) {
      if (typeof worker.tags === 'string') {
        parsedTags = worker.tags.split(',').map(x => x.trim()).filter(Boolean);
      }
    }
  }
  if (!Array.isArray(parsedTags)) {
    parsedTags = [];
  }

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <button className="btn" style={{ marginBottom: 0, padding: '0.5rem 1rem' }} onClick={onBack}>← {t('worker_profile.back')}</button>
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

      <div className="profile-grid" style={{ marginTop: '0.5rem' }}>
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '1rem', gap: '0.75rem' }}>
          <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#fff' }}>
            {worker.full_name.charAt(0)}
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{worker.full_name}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', margin: '0.5rem 0 1rem 0' }}>
            {projectName && (
              <span style={{ fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                 {projectName}
              </span>
            )}
            {groupName && (
              <span style={{ fontSize: '0.8rem', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                 {groupName}
              </span>
            )}
            {parsedTags.map((tag, idx) => (
              <span key={idx} style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                 {tag}
              </span>
            ))}
            {(() => {
              const expiryDate = worker.isg_bitis_tarihi;
              if (!expiryDate) {
                return (
                  <span
                    onClick={() => onOpenIsg(worker.isg_start_date || '', '')}
                    style={{ fontSize: '0.8rem', background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500', cursor: 'pointer' }}
                    title={t('isg.update_btn', 'İSG Güncelle')}
                  >
                     {t('isg.badge_undefined', 'İSG Tanımsız')}
                  </span>
                );
              }
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const expiry = new Date(expiryDate);
              expiry.setHours(0, 0, 0, 0);
              const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
              let badgeBg, badgeColor, badgeText, badgeIcon;
              if (diffDays < 0) {
                badgeBg = 'rgba(239, 68, 68, 0.2)'; badgeColor = '#f87171'; badgeIcon = ''; badgeText = t('isg.badge_expired', 'İSG Süresi Doldu');
              } else if (diffDays <= 30) {
                badgeBg = 'rgba(245, 158, 11, 0.2)'; badgeColor = '#fbbf24'; badgeIcon = ''; badgeText = t('isg.badge_approaching', 'İSG Yaklaşıyor') + ` (${diffDays} ${t('isg.days', 'gün')})`;
              } else {
                badgeBg = 'rgba(16, 185, 129, 0.2)'; badgeColor = '#34d399'; badgeIcon = ''; badgeText = t('isg.badge_valid', 'İSG Geçerli');
              }
              return (
                <span
                  onClick={() => onOpenIsg(worker.isg_start_date || '', worker.isg_bitis_tarihi || '')}
                  style={{ fontSize: '0.8rem', background: badgeBg, color: badgeColor, padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500', cursor: 'pointer' }}
                  title={t('isg.update_btn', 'İSG Güncelle')}
                >
                  {badgeIcon} {badgeText}
                </span>
              );
            })()}
          </div>
          <p className="card-subtitle mb-4">{worker.tc_no ? `${t('worker.idLabel', 'ID')}: ${worker.tc_no}` : ''} | {worker.phone}</p>

          <h3 className="card-subtitle">{t('worker_profile.current_balance')}</h3>
          <div style={{
            fontSize: '3rem',
            fontWeight: '700',
            marginTop: '0.5rem',
            color: isPositive ? 'var(--success-text)' : 'var(--danger-text)',
            textShadow: isPositive ? 'var(--success-shadow)' : 'var(--danger-shadow)'
          }}>
            {formatCurrency(balance, i18n.language)}
          </div>
          <p className="card-subtitle mt-4">{t('worker_profile.daily_wage')}: {formatCurrency(worker.daily_wage, i18n.language)}</p>
        </div>
      </div>
    </>
  );
};

export default WorkerIdentityCard;
