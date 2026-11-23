import React from 'react';
import { formatDate } from '../utils/formatUtils';

const JournalList = ({ t, i18n, loading, filteredJournals, paginatedJournals, totalPages, currentPage, setCurrentPage, searchQuery, todayStr, onEdit, onDelete }) => {
  if (loading) {
    return <div className="skeleton" style={{ height: '200px', width: '100%' }}></div>;
  }

  if (filteredJournals.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        {searchQuery ? t('journal.no_results', 'Arama kriterlerine uygun jurnal kaydı bulunamadı.') : t('empty.journal', 'Henüz günlük jurnal kaydı bulunmuyor.')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.1rem' }}>
      {paginatedJournals.map(j => (
        <div key={j.id} className="glass-card" style={{ padding: '1rem 1.25rem', gap: '0.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>{formatDate(j.journal_date, i18n.language)}</strong>
              {j.weather_desc && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  {j.weather_icon && <img src={`http://openweathermap.org/img/wn/${j.weather_icon}.png`} alt="Icon" style={{ width: '20px', height: '20px' }} />}
                  {j.weather_temp} °C, {j.weather_desc}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', background: 'var(--accent-bg)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px', marginRight: '0.5rem', fontWeight: '500' }}>
                 {j.worker_count} {t('journal.worker_count_badge', 'Çalışan')}
              </span>
              {j.journal_date === todayStr && (
                <button
                  className="btn"
                  onClick={() => onEdit(j)}
                  style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.05)' }}
                  title={t('dashboard.edit', 'Düzenle')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </button>
              )}
              <button
                className="btn btn-danger"
                onClick={() => onDelete(j.id)}
                style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title={t('common.delete', 'Sil')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  <line x1="10" y1="11" x2="10" y2="17" />
                  <line x1="14" y1="11" x2="14" y2="17" />
                </svg>
              </button>
            </div>
          </div>
          <p style={{ fontSize: '0.95rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>{j.notes}</p>
        </div>
      ))}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          position: 'sticky',
          bottom: 0,
          background: 'var(--option-bg, #0f172a)',
          borderTop: '1px solid var(--glass-border)',
          zIndex: 10,
          padding: '1rem',
          marginTop: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(10px)',
          borderRadius: '0 0 12px 12px'
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
            {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages} {t('global.recordsCount', { count: filteredJournals.length })}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              className="btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              style={{
                padding: '0.4rem 1rem',
                fontSize: '0.85rem',
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
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages}
            </span>
            <button
              className="btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              style={{
                padding: '0.4rem 1rem',
                fontSize: '0.85rem',
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
              {t('common.next', 'Sonraki')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalList;
