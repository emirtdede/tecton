import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from '../utils/formatUtils';
import { daysUntil } from '../utils/dateRangeUtils';

const AnomalyPanel = ({ workers, balances, viewMode }) => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'balance' | 'expired' | 'approaching'
  const [searchName, setSearchName] = useState('');

  // All derived lists are memoized: previously every keystroke in the search box
  // (and every unrelated parent re-render) re-ran the full filter/map/sort chain
  // over the entire worker list.
  const { allNegativeBalanceWorkers, allIsgExpiredWorkers, allIsgApproachingWorkers } = useMemo(() => {
    const negative = workers.filter(w => {
      const bal = balances[w.id];
      return bal !== undefined && bal < 0;
    });

    // ISG expiry: approaching = next 15 days, expired = today or earlier.
    // `daysUntil` returns null for an unparseable date, so a corrupt record is
    // no longer silently dropped from both lists (NaN compares false to both
    // `<= 0` and `> 0`).
    const isgMapped = workers
      .map(w => ({ w, remainingDays: daysUntil(w.isg_bitis_tarihi) }))
      .filter(x => x.remainingDays !== null)
      .map(x => ({ ...x.w, remainingDays: x.remainingDays }));

    return {
      allNegativeBalanceWorkers: negative,
      allIsgExpiredWorkers: isgMapped.filter(w => w.remainingDays <= 0),
      allIsgApproachingWorkers: isgMapped
        .filter(w => w.remainingDays > 0 && w.remainingDays <= 15)
        .sort((a, b) => a.remainingDays - b.remainingDays)
    };
  }, [workers, balances]);

  // Filter lists by worker name search query
  const { negativeBalanceWorkers, isgExpiredWorkers, isgApproachingWorkers } = useMemo(() => {
    const query = searchName.toLowerCase();
    const filterByName = (w) => w.full_name.toLowerCase().includes(query);
    return {
      negativeBalanceWorkers: allNegativeBalanceWorkers.filter(filterByName),
      isgExpiredWorkers: allIsgExpiredWorkers.filter(filterByName),
      isgApproachingWorkers: allIsgApproachingWorkers.filter(filterByName)
    };
  }, [allNegativeBalanceWorkers, allIsgExpiredWorkers, allIsgApproachingWorkers, searchName]);

  if (allNegativeBalanceWorkers.length === 0 && allIsgExpiredWorkers.length === 0 && allIsgApproachingWorkers.length === 0) {
    return (
      <div style={{
        background: 'var(--success-bg-light)',
        border: '1px solid var(--success-border)',
        borderRadius: '12px',
        padding: '1.25rem 1.5rem',
        marginBottom: '1.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', color: 'var(--day-amber, var(--warning))' }}><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg></span>
          <div>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '600', color: 'var(--success)' }}>
              {t('anomaly.noAnomalies', 'Sistem Anomalisi Bulunmuyor')}
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t('anomaly.allUpToDate', 'Tüm finansal bakiyeler ve İSG belgeleri günceldir.')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const displayedBalance = negativeBalanceWorkers;
  const displayedExpired = isgExpiredWorkers;
  const displayedApproaching = isgApproachingWorkers;

  const isEmpty = 
    (activeTab === 'all' && negativeBalanceWorkers.length === 0 && isgExpiredWorkers.length === 0 && isgApproachingWorkers.length === 0) ||
    (activeTab === 'balance' && negativeBalanceWorkers.length === 0) ||
    (activeTab === 'expired' && isgExpiredWorkers.length === 0) ||
    (activeTab === 'approaching' && isgApproachingWorkers.length === 0);

  return (
    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }} className="anomaly-panel-container glass-card">
      {/* Search Input */}
      <div>
        <input 
          type="text" 
          className="form-input" 
          placeholder={t('filters.search_anomalies', 'Anomalilerde ara (İsim)...')} 
          value={searchName} 
          onChange={e => setSearchName(e.target.value)} 
          style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem' }}
        />
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('all')}
          style={{
            background: 'transparent', border: 'none', color: activeTab === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
            cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
            borderBottom: activeTab === 'all' ? '2px solid var(--accent)' : 'none', fontSize: '0.8rem'
          }}
        >
          {t('filters.tab_all', 'Hepsi')} ({negativeBalanceWorkers.length + isgExpiredWorkers.length + isgApproachingWorkers.length})
        </button>
        <button
          onClick={() => setActiveTab('balance')}
          style={{
            background: 'transparent', border: 'none', color: activeTab === 'balance' ? 'var(--text-main)' : 'var(--text-muted)',
            cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
            borderBottom: activeTab === 'balance' ? '2px solid var(--danger)' : 'none', fontSize: '0.8rem'
          }}
        >
          {t('filters.tab_low_balance', 'Düşük Bakiye')} ({negativeBalanceWorkers.length})
        </button>
        <button
          onClick={() => setActiveTab('expired')}
          style={{
            background: 'transparent', border: 'none', color: activeTab === 'expired' ? 'var(--text-main)' : 'var(--text-muted)',
            cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
            borderBottom: activeTab === 'expired' ? '2px solid var(--danger)' : 'none', fontSize: '0.8rem'
          }}
        >
          {t('filters.tab_expired_hse', 'İSG Dolanlar')} ({isgExpiredWorkers.length})
        </button>
        <button
          onClick={() => setActiveTab('approaching')}
          style={{
            background: 'transparent', border: 'none', color: activeTab === 'approaching' ? 'var(--text-main)' : 'var(--text-muted)',
            cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
            borderBottom: activeTab === 'approaching' ? '2px solid var(--warning)' : 'none', fontSize: '0.8rem'
          }}
        >
          {t('filters.tab_expiring_hse', 'İSG Yaklaşanlar')} ({isgApproachingWorkers.length})
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '4px' }}>
        {isEmpty ? (
          <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {searchName ? t('anomalies.search_no_results', 'Arama kriterlerine uygun sonuç bulunamadı.') : t('anomalies.no_results', 'Sonuç bulunamadı.')}
          </div>
        ) : (
          <>
            {/* Negatif Bakiye Uyarıları */}
            {(activeTab === 'all' || activeTab === 'balance') && negativeBalanceWorkers.length > 0 && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--text-muted)' }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg></span>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: 'var(--danger)' }}>
                    {t('anomalies.financial_warnings_title', 'Finansal Uyarılar')} ({negativeBalanceWorkers.length})
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: viewMode === 'list' ? 'column' : 'row', flexWrap: viewMode === 'list' ? 'nowrap' : 'wrap', gap: '0.5rem' }}>
                  {displayedBalance.map(w => (
                    <div 
                      key={w.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: viewMode === 'list' ? 'space-between' : 'flex-start',
                        gap: '0.5rem',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        background: 'var(--danger-bg)',
                        border: '1px solid var(--danger-border)',
                        fontSize: '0.8rem',
                        width: viewMode === 'list' ? '100%' : 'auto'
                      }}
                    >
                      <span style={{ fontWeight: '600', color: 'var(--danger)' }}>{w.full_name}</span>
                      <span style={{ fontWeight: '700', color: 'var(--danger)' }}>
                        {formatCurrency(balances[w.id], i18n.language)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* İSG Süresi Dolanlar */}
            {(activeTab === 'all' || activeTab === 'expired') && isgExpiredWorkers.length > 0 && (
              <div style={{
                background: 'var(--danger-bg)',
                border: '1px solid var(--danger-border)',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--danger)' }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: 'var(--danger)' }}>
                    {t('anomalies.hse_expired_title', 'İSG Süresi Dolanlar')} ({isgExpiredWorkers.length})
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: viewMode === 'list' ? 'column' : 'row', flexWrap: viewMode === 'list' ? 'nowrap' : 'wrap', gap: '0.5rem' }}>
                  {displayedExpired.map(w => (
                    <div 
                      key={w.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: viewMode === 'list' ? 'space-between' : 'flex-start',
                        gap: '0.5rem',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        background: 'var(--danger-bg)',
                        border: '1px solid var(--danger-border)',
                        fontSize: '0.8rem',
                        width: viewMode === 'list' ? '100%' : 'auto'
                      }}
                    >
                      <span style={{ fontWeight: '600', color: 'var(--danger)' }}>{w.full_name}</span>
                      <span style={{ fontWeight: '700', color: 'var(--danger)', fontSize: '0.85rem' }}>
                        {t('anomalies.hse_expired_badge', 'SÜRESİ DOLDU!')} ({w.isg_bitis_tarihi})
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* İSG Süresi Yaklaşanlar */}
            {(activeTab === 'all' || activeTab === 'approaching') && isgApproachingWorkers.length > 0 && (
              <div style={{
                background: 'var(--warning-soft)',
                border: '1px solid var(--warning-border)',
                borderRadius: '12px',
                padding: '1.25rem 1.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', color: 'var(--danger)' }}><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg></span>
                  <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: 'var(--warning)' }}>
                    {t('anomalies.hse_expiring_title', 'İSG Süresi Yaklaşanlar')} ({isgApproachingWorkers.length})
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: viewMode === 'list' ? 'column' : 'row', flexWrap: viewMode === 'list' ? 'nowrap' : 'wrap', gap: '0.5rem' }}>
                  {displayedApproaching.map(w => (
                    <div 
                      key={w.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: viewMode === 'list' ? 'space-between' : 'flex-start',
                        gap: '0.5rem',
                        padding: '0.4rem 0.8rem',
                        borderRadius: '8px',
                        background: 'var(--warning-soft)',
                        border: '1px solid var(--warning-border)',
                        fontSize: '0.8rem',
                        width: viewMode === 'list' ? '100%' : 'auto'
                      }}
                    >
                      <span style={{ fontWeight: '600', color: 'var(--warning)' }}>{w.full_name}</span>
                      <span style={{ fontWeight: '700', color: 'var(--warning)', fontSize: '0.85rem' }}>
                        {w.remainingDays} {t('anomalies.days_left', 'gün kaldı')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AnomalyPanel;
