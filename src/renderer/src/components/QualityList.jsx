import React from 'react';
import { formatDate } from '../utils/formatUtils';

const QualityList = ({ t, i18n, loading, filteredReports, paginatedReports, totalPages, currentPage, setCurrentPage, searchQuery, onToggle, onEdit, onDelete, onViewPhoto }) => {
  if (loading) {
    return <div className="skeleton" style={{ height: '200px', width: '100%' }}></div>;
  }

  if (filteredReports.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        {searchQuery ? t('quality.no_results', 'Arama kriterlerine uygun tutanak kaydı bulunamadı.') : t('empty.quality', 'Bu şantiye için henüz kalite kontrol raporu bulunmuyor.')}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.1rem' }}>
      {paginatedReports.map(rep => (
        <div
          key={rep.id}
          className="glass-card"
          style={{
            padding: '0.5rem 0.85rem',
            borderLeft: rep.status === 'resolved' ? '4px solid var(--success)' : '4px solid var(--danger)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
            <div>
              <h3 className="card-title" style={{ fontSize: '1.05rem' }}>{rep.title}</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}> {formatDate(rep.report_date, i18n.language)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                onClick={() => onToggle(rep)}
                style={{
                  fontSize: '0.8rem',
                  fontWeight: '700',
                  cursor: 'pointer',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  background: rep.status === 'resolved' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                  color: rep.status === 'resolved' ? 'var(--success)' : 'var(--danger)',
                  border: rep.status === 'resolved' ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                {rep.status === 'resolved' ? ` ${t('filters.status_resolved', 'ÇÖZÜLDÜ')}` : ` ${t('quality.status_open', 'AÇIK (Sorun Çözülmedi)')}`}
              </span>
              {rep.photo_path && (
                <button
                  className="btn btn-primary"
                  onClick={() => onViewPhoto(rep.photo_path)}
                  style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title={t('quality.open_photo', 'Tutanak Görselini Aç')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                </button>
              )}
              <button
                className="btn"
                onClick={() => onEdit(rep)}
                style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.05)' }}
                title={t('dashboard.edit', 'Düzenle')}
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                className="btn btn-danger"
                onClick={() => onDelete(rep.id)}
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
          {rep.description && <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{rep.description}</p>}

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
          padding: '0.6rem 1rem',
          marginTop: '0.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backdropFilter: 'blur(10px)',
          borderRadius: '0 0 12px 12px'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>
            {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages} ({filteredReports.length} {t('common.records', 'Kayıt')})
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className="btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              {t('common.prev', 'Önceki')}
            </button>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages}
            </span>
            <button
              className="btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
            >
              {t('common.next', 'Sonraki')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default QualityList;
