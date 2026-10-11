import React from 'react';
import { formatDate } from '../utils/formatUtils';

const ProductionTable = ({ t, i18n, loading, filteredRecords, paginatedRecords, totalPages, currentPage, setCurrentPage, searchQuery, onEdit, onDelete }) => {
  if (loading) {
    return <div className="skeleton" style={{ height: '200px', width: '100%' }}></div>;
  }

  if (filteredRecords.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        {searchQuery ? t('production.no_results', 'Arama kriterlerine uygun imalat kaydı bulunamadı.') : t('empty.production', 'Bu şantiye için henüz bir imalat kaydı girilmemiş.')}
      </div>
    );
  }

  return (
    <div className="fin-table-container" style={{ marginTop: '0.1rem' }}>
      <table className="fin-table">
        <thead>
          <tr>
            <th>{t('common.date', 'Tarih')}</th>
            <th>{t('production.item_name', 'İmalat Kalemi')}</th>
            <th style={{ textAlign: 'right' }}>{t('common.quantity', 'Miktar')}</th>
            <th>{t('common.unit', 'Birim')}</th>
            <th>{t('common.description', 'Açıklama')}</th>
            <th style={{ textAlign: 'right' }}>{t('subcontractor.table_action', 'İşlem')}</th>
          </tr>
        </thead>
        <tbody>
          {paginatedRecords.map(r => (
            <tr key={r.id}>
              <td>{formatDate(r.record_date, i18n.language)}</td>
              <td style={{ fontWeight: '600' }}>{r.item_name}</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--secondary)' }}>{r.quantity}</td>
              <td>{r.unit}</td>
              <td style={{ color: 'var(--text-muted)' }}>{r.notes || '-'}</td>
              <td style={{ textAlign: 'right' }}>
                <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                  <button
                    className="btn"
                    onClick={() => onEdit(r)}
                    style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={t('dashboard.edit', 'Düzenle')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => onDelete(r.id)}
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{
          position: 'sticky',
          bottom: 0,
          background: 'var(--option-bg, #0f172a)',
          borderTop: '1px solid var(--glass-border)',
          zIndex: 10,
          padding: '1rem 1.5rem',
          marginTop: '0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          backdropFilter: 'blur(10px)',
          borderRadius: '0 0 12px 12px'
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {t('common.pagination_info', 'Sayfa {{page}} / {{total}} ({{records}} Kayıt)', { page: currentPage, total: totalPages, records: filteredRecords.length })}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button
              className="btn"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              {t('common.prev', 'Önceki')}
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('common.page', 'Sayfa')} {currentPage} / {totalPages}
            </span>
            <button
              className="btn"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
            >
              {t('common.next', 'Sonraki')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductionTable;
