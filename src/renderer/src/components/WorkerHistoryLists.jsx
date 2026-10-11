import React, { useRef } from 'react';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatCurrency, formatDate } from '../utils/formatUtils';

const WorkerHistoryLists = ({ t, i18n, activeTab, onBottomTabClick, filterStartDate, filterEndDate, onStartDateChange, onEndDateChange, timesheets, transactions, workerLeaves, workTypes, cReport, pagePuantaj, setPagePuantaj, pageAvans, setPageAvans, pageRapor, setPageRapor, pageIzin, setPageIzin, onDeleteTimesheet, onDeleteTransaction, onDeleteLeave }) => {
  const ITEMS_PER_PAGE = 7;
  const historyRef = useRef(null);
  const tabsRef = useRef(null);

  const renderPagination = (currentPage, totalItems, setPage) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    if (totalPages <= 1) return null;

    const handlePageChange = (newPage) => {
      setPage(newPage);
      setTimeout(() => {
        if (historyRef.current) {
          historyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    };

    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
        <button
          type="button"
          disabled={currentPage === 1}
          onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
          style={{
            padding: '0.4rem 1rem',
            fontSize: '0.9rem',
            fontWeight: '600',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            color: 'var(--text-main)',
            cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
            opacity: currentPage === 1 ? 0.5 : 1,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={(e) => { if (currentPage !== 1) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
        >
          {t('common.prev', 'Önceki')}
        </button>
        <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>{t('common.page', 'Sayfa')} {currentPage} / {totalPages}</span>
        <button
          type="button"
          disabled={currentPage === totalPages}
          onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
          style={{
            padding: '0.4rem 1rem',
            fontSize: '0.9rem',
            fontWeight: '600',
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            color: 'var(--text-main)',
            cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
            opacity: currentPage === totalPages ? 0.5 : 1,
            transition: 'all 0.2s'
          }}
          onMouseEnter={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
          onMouseLeave={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
        >
          {t('common.next_short', 'Sonraki')}
        </button>
      </div>
    );
  };

  const handleBottomTabClickLocal = (tab) => {
    onBottomTabClick(tab);
    if (tabsRef.current) {
      setTimeout(() => {
        tabsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  };

  return (
    <div ref={historyRef} className="right-panel glass-card" style={{ marginTop: '2rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
        <div style={{ flex: 1 }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('worker_profile.filter.start_date')}</label>
          <CustomDatePicker className="form-input" value={filterStartDate} onChange={e => onStartDateChange(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('worker_profile.filter.end_date')}</label>
          <CustomDatePicker className="form-input" value={filterEndDate} onChange={e => onEndDateChange(e.target.value)} />
        </div>
      </div>
      <div ref={tabsRef} style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '1.5rem', gap: '1rem', paddingBottom: '0.5rem' }}>
        <h3
          className="card-title"
          style={{ cursor: 'pointer', transition: 'color 0.3s ease', color: activeTab === 'puantaj' ? 'var(--text-main)' : 'var(--text-muted)' }}
          onClick={() => handleBottomTabClickLocal('puantaj')}
        >
          {t('worker_profile.timesheet_history')}
        </h3>
        <h3
          className="card-title"
          style={{ cursor: 'pointer', transition: 'color 0.3s ease', color: activeTab === 'avans' ? 'var(--text-main)' : 'var(--text-muted)' }}
          onClick={() => handleBottomTabClickLocal('avans')}
        >
          {t('worker_profile.advance_history')}
        </h3>
        <h3
          className="card-title"
          style={{ cursor: 'pointer', transition: 'color 0.3s ease', color: activeTab === 'rapor' ? 'var(--text-main)' : 'var(--text-muted)' }}
          onClick={() => handleBottomTabClickLocal('rapor')}
        >
          {t('worker_profile.monthly_report_view')}
        </h3>
        <h3
          className="card-title"
          style={{ cursor: 'pointer', transition: 'color 0.3s ease', color: activeTab === 'izinler' ? 'var(--text-main)' : 'var(--text-muted)' }}
          onClick={() => handleBottomTabClickLocal('izinler')}
        >
          {t('worker_profile.leave_history', 'İzin Geçmişi')}
        </h3>
      </div>

      <div key={activeTab} style={{ animation: 'fadeIn 0.3s ease-out' }}>
        {activeTab === 'puantaj' ? (
        timesheets.length === 0 ? (
          <p className="text-muted text-center" style={{ marginTop: '2rem' }}>{t('worker_profile.no_timesheet')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[...timesheets].reverse().slice((pagePuantaj - 1) * ITEMS_PER_PAGE, pagePuantaj * ITEMS_PER_PAGE).map(ts => {
              const rawName = workTypes.find(wt => wt.id == ts.work_type_id)?.name;
              const typeName = rawName ? t(rawName, rawName) : t('worker_profile.unknown');

              const wDate = new Date(ts.work_date);
              const overlap = workerLeaves.find(l => {
                const sDate = new Date(l.start_date);
                const eDate = new Date(l.end_date);
                return wDate >= sDate && wDate <= eDate;
              });
              let leaveBadge = null;
              if (overlap) {
                const lType = overlap.type === 'Ücretli' ? t('worker_profile.leave_types.paid', 'Ücretli İzin') : overlap.type === 'Ücretsiz' ? t('worker_profile.leave_types.unpaid', 'Ücretsiz İzin') : t('worker_profile.leave_types.medical', 'Raporlu');
                leaveBadge = <span style={{ marginLeft: '10px', fontSize: '0.7rem', color: '#d97706', border: '1px solid #d97706', padding: '2px 6px', borderRadius: '4px' }}>{lType}</span>;
              }

              return (
                <div key={ts.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{formatDate(ts.work_date, i18n.language)} <span className="wage-badge" style={{ marginLeft: '10px' }}>{typeName}</span>{leaveBadge}</div>
                    <div className="card-subtitle mt-4" style={{ marginTop: '0.5rem' }}>
                      {t('worker_profile.wage_history_label')}: {formatCurrency(ts.applied_wage, i18n.language)} (x{ts.applied_multiplier})
                      {ts.overtime_hours > 0 && ` | +${ts.overtime_hours} ${t('worker_profile.overtime_hours_suffix')}`}
                    </div>
                    {ts.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{t('worker_profile.note_label')}: {t(ts.notes, ts.notes)}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--success-text)', fontSize: '1.1rem' }}>+{formatCurrency(ts.earned_amount, i18n.language)}</div>
                    <button onClick={() => onDeleteTimesheet(ts.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.5rem' }}>{t('common.delete')}</button>
                  </div>
                </div>
              )
            })}
            {renderPagination(pagePuantaj, timesheets.length, setPagePuantaj)}
          </div>
        )
      ) : activeTab === 'avans' ? (
        transactions.length === 0 ? (
          <p className="text-muted text-center" style={{ marginTop: '2rem' }}>{t('worker_profile.no_advance')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {[...transactions].reverse().slice((pageAvans - 1) * ITEMS_PER_PAGE, pageAvans * ITEMS_PER_PAGE).map(tr => (
              <div key={tr.id} style={{ background: 'var(--danger-bg-light)', border: '1px solid var(--danger-border)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{formatDate(tr.trans_date, i18n.language)} <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--danger-text)', border: '1px solid var(--danger-text)', padding: '2px 6px', borderRadius: '4px' }}>{t('worker_profile.advance_out')}</span></div>
                  <div className="card-subtitle" style={{ marginTop: '0.5rem' }}>{tr.notes || '-'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--danger-text)', fontSize: '1.1rem' }}>-{formatCurrency(tr.amount, i18n.language)}</div>
                  <button onClick={() => onDeleteTransaction(tr.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.5rem', textDecoration: 'underline' }}>{t('worker_profile.delete_cancel')}</button>
                </div>
              </div>
            ))}
            {renderPagination(pageAvans, transactions.length, setPageAvans)}
          </div>
        )
      ) : null}
      {activeTab === 'rapor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
            <span style={{ fontWeight: '600' }}>{t('worker_profile.summary.carried_balance_report', 'Devreden Bakiye Raporu')}</span>
            <div style={{ fontWeight: 'bold', color: cReport.devredenBakiye >= 0 ? 'var(--success-text)' : 'var(--danger-text)', fontSize: '1.1rem' }}>
              {formatCurrency(cReport.devredenBakiye, i18n.language)}
            </div>
          </div>

          {cReport.islemler.length === 0 ? (
            <p className="text-muted text-center" style={{ marginTop: '2rem' }}>{t('worker_profile.no_period_data')}</p>
          ) : (
            <>
            {cReport.islemler.slice((pageRapor - 1) * ITEMS_PER_PAGE, pageRapor * ITEMS_PER_PAGE).map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--glass-border)', background: item.isIncome ? 'var(--success-bg-light)' : 'var(--danger-bg-light)' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>{formatDate(item.date, i18n.language)} <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: item.isIncome ? 'var(--success-text)' : 'var(--danger-text)', border: `1px solid var(${item.isIncome ? '--success-text' : '--danger-text'})`, padding: '2px 6px', borderRadius: '4px' }}>{item.isIncome ? t('worker_profile.filter.type_timesheet', 'Puantaj') : t('worker.advanceBadge', 'Avans')}</span></div>
                  <div className="card-subtitle" style={{ marginTop: '0.25rem' }}>{item.desc}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', color: item.isIncome ? 'var(--success-text)' : 'var(--danger-text)', fontSize: '1.1rem' }}>{item.isIncome ? '+' : '-'}{formatCurrency(item.amount, i18n.language)}</div>
                </div>
              </div>
            ))}
            {renderPagination(pageRapor, cReport.islemler.length, setPageRapor)}
            </>
          )}
        </div>
      )}
      {activeTab === 'izinler' && (() => {
        const fLeaves = workerLeaves.filter(l => l.start_date <= filterEndDate && l.end_date >= filterStartDate).sort((a,b) => new Date(b.start_date) - new Date(a.start_date));
        return fLeaves.length === 0 ? (
          <p className="text-muted text-center" style={{ marginTop: '2rem' }}>{t('worker_profile.no_leave', 'Henüz izin kaydı bulunmamaktadır.')}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {fLeaves.slice((pageIzin - 1) * ITEMS_PER_PAGE, pageIzin * ITEMS_PER_PAGE).map(l => (
              <div key={l.id} style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600' }}>
                    {formatDate(l.start_date, i18n.language)} - {formatDate(l.end_date, i18n.language)}
                    <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#d97706', border: '1px solid #d97706', padding: '2px 6px', borderRadius: '4px' }}>
                      {l.type === 'Ücretli' ? t('worker_profile.leave_types.paid', 'Ücretli İzin') : l.type === 'Ücretsiz' ? t('worker_profile.leave_types.unpaid', 'Ücretsiz İzin') : t('worker_profile.leave_types.medical', 'Raporlu')}
                    </span>
                  </div>
                  <div className="card-subtitle" style={{ marginTop: '0.5rem' }}>{l.description || '-'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <button onClick={() => onDeleteLeave(l.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>{t('common.delete')}</button>
                </div>
              </div>
            ))}
            {renderPagination(pageIzin, fLeaves.length, setPageIzin)}
          </div>
        );
      })()}
      </div>
    </div>
  );
};

export default WorkerHistoryLists;
