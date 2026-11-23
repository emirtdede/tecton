import React from 'react';
import { formatCurrency } from '../utils/formatUtils';

const SubcontractorAnomalies = ({ t, i18n, anomalySearch, setAnomalySearch, anomalyActiveTab, setAnomalyActiveTab, filteredNegativeBalance, filteredIsgExpired, filteredIsgApproaching, contractors }) => {
  return (
    <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Subcontractor Anomaly Panel */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           {t('subcontractor.anomalies', 'Taşeron Uyarıları')}
        </h3>

        {/* Search Input */}
        <div>
          <input
            type="text"
            className="form-input"
            placeholder={t('filters.search_anomalies', 'Uyarılarda ara...')}
            value={anomalySearch}
            onChange={e => setAnomalySearch(e.target.value)}
            style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', marginBottom: 0 }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setAnomalyActiveTab('all')}
            style={{
              background: 'transparent', border: 'none', color: anomalyActiveTab === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
              borderBottom: anomalyActiveTab === 'all' ? '2px solid var(--accent)' : 'none', fontSize: '0.75rem'
            }}
          >
            {t('filters.tab_all', 'Hepsi')} ({filteredNegativeBalance.length + filteredIsgExpired.length + filteredIsgApproaching.length})
          </button>
          <button
            onClick={() => setAnomalyActiveTab('balance')}
            style={{
              background: 'transparent', border: 'none', color: anomalyActiveTab === 'balance' ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
              borderBottom: anomalyActiveTab === 'balance' ? '2px solid #ef4444' : 'none', fontSize: '0.75rem'
            }}
          >
            {t('filters.tab_low_balance', 'Bakiye')} ({filteredNegativeBalance.length})
          </button>
          <button
            onClick={() => setAnomalyActiveTab('expired')}
            style={{
              background: 'transparent', border: 'none', color: anomalyActiveTab === 'expired' ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
              borderBottom: anomalyActiveTab === 'expired' ? '2px solid #ef4444' : 'none', fontSize: '0.75rem'
            }}
          >
            {t('filters.tab_expired_hse', 'İSG Dolan')} ({filteredIsgExpired.length})
          </button>
          <button
            onClick={() => setAnomalyActiveTab('approaching')}
            style={{
              background: 'transparent', border: 'none', color: anomalyActiveTab === 'approaching' ? 'var(--text-main)' : 'var(--text-muted)',
              cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
              borderBottom: anomalyActiveTab === 'approaching' ? '2px solid #f59e0b' : 'none', fontSize: '0.75rem'
            }}
          >
            {t('filters.tab_expiring_hse', 'İSG Yaklaşan')} ({filteredIsgApproaching.length})
          </button>
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
          {(filteredNegativeBalance.length === 0 && filteredIsgExpired.length === 0 && filteredIsgApproaching.length === 0) ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: '#34d399', background: 'rgba(52, 211, 153, 0.05)', borderRadius: '12px', border: '1px solid rgba(52, 211, 153, 0.15)', fontSize: '0.8rem' }}>
               {t('subcontractor.all_isg_valid', 'Tüm durumlar ve İSG belgeleri güncel.')}
            </div>
          ) : (
            <>
              {/* Financial Warnings */}
              {(anomalyActiveTab === 'all' || anomalyActiveTab === 'balance') && filteredNegativeBalance.length > 0 && (
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                  <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                     {t('anomalies.financial_warnings_title', 'Finansal Uyarılar')} ({filteredNegativeBalance.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {filteredNegativeBalance.map(c => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                        <span style={{ fontWeight: '500' }}>{c.name}</span>
                        <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{formatCurrency(c.balance, i18n.language)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ISG Expired */}
              {(anomalyActiveTab === 'all' || anomalyActiveTab === 'expired') && filteredIsgExpired.length > 0 && (
                <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                  <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                     {t('isg.badge_expired', 'İSG Süresi Dolanlar')} ({filteredIsgExpired.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                    {filteredIsgExpired.map(c => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                        <span style={{ fontWeight: '500' }}>{c.name}</span>
                        <span style={{ color: '#f87171' }}>{c.isg_expiry_date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ISG Approaching */}
              {(anomalyActiveTab === 'all' || anomalyActiveTab === 'approaching') && filteredIsgApproaching.length > 0 && (
                <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                  <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                     {t('isg.badge_approaching', 'İSG Süresi Yaklaşanlar')} ({filteredIsgApproaching.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                    {filteredIsgApproaching.map(c => (
                      <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                        <span style={{ fontWeight: '500' }}>{c.name}</span>
                        <span style={{ color: '#fbbf24' }}>{t('subcontractor.days_remaining', '{{count}} gün kaldı', { count: c.remainingDays })}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Subcontractor financial report summary */}
      <div className="glass-card">
        <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           {t('subcontractor.financial_summary', 'Taşeron Finans Özeti')}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('subcontractor.total_receivable', 'Toplam Taşeron Alacağı')}</span>
            <span style={{ color: '#34d399', fontWeight: 'bold' }}>
              {formatCurrency(contractors.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0), i18n.language)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('subcontractor.total_debt', 'Toplam Taşeron Borcu')}</span>
            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
              {formatCurrency(contractors.reduce((sum, c) => sum + (c.balance < 0 ? c.balance : 0), 0), i18n.language)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.15)', fontWeight: 'bold' }}>
            <span style={{ fontSize: '0.85rem' }}>{t('dashboard.net_balance', 'Genel Net Bakiye')}</span>
            <span style={{ color: contractors.reduce((sum, c) => sum + (c.balance || 0), 0) >= 0 ? '#34d399' : '#ef4444' }}>
              {formatCurrency(contractors.reduce((sum, c) => sum + (c.balance || 0), 0), i18n.language)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubcontractorAnomalies;
