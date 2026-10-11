import React from 'react';
import { formatDate } from '../utils/formatUtils';

const MediaViews = ({ t, i18n, loading, viewMode, paginatedItems, totalItems, totalPages, validCurrentPage, setCurrentPage, onSelectImage }) => {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
        {[1, 2, 3, 4].map(n => <div key={n} className="skeleton" style={{ height: '180px', borderRadius: '12px' }}></div>)}
      </div>
    );
  }

  if (paginatedItems.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)', border: '1px dashed var(--glass-border)', borderRadius: '12px' }}>
        {t('empty.media', 'Arama kriterlerine uygun medya kaydı bulunamadı.')}
      </div>
    );
  }

  if (viewMode !== 'list') {
    return (
      <>
        {/* Gallery/Grid View */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1.5rem' }}>
          {paginatedItems.map(item => (
            <div
              key={item.id}
              className="glass-card"
              style={{
                padding: '0.5rem',
                overflow: 'hidden',
                cursor: item.base64 ? 'pointer' : 'default',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onClick={() => item.base64 && onSelectImage(item.base64)}
            >
              {item.base64 ? (
                <img
                  src={item.base64}
                  alt={item.title}
                  style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '8px' }}
                />
              ) : (
                <div style={{
                  width: '100%',
                  height: '140px',
                  borderRadius: '8px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '2rem',
                  border: '1px dashed rgba(255, 255, 255, 0.08)'
                }}>
                  📄
                  <span style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: 'var(--text-muted)' }}>{t('media.no_image', 'Görsel Yok')}</span>
                </div>
              )}
              <div style={{ padding: '0.5rem 0.25rem 0.25rem 0.25rem' }}>
                <span style={{
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  color: item.type === 'report' ? 'var(--danger)' : 'var(--success)',
                  background: item.type === 'report' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}>
                  {item.typeLabel}
                </span>
                <h4 style={{ fontSize: '0.85rem', margin: '0.5rem 0 0.25rem 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }}>
                  {item.title}
                </h4>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>📅 {formatDate(item.date, i18n.language)}</span>
              </div>
            </div>
          ))}
        </div>
        <MediaPagination t={t} totalItems={totalItems} totalPages={totalPages} validCurrentPage={validCurrentPage} setCurrentPage={setCurrentPage} />
      </>
    );
  }

  return (
    <>
      {/* List View (Table layout) */}
      <div className="fin-table-container" style={{ marginTop: '0.1rem' }}>
        <table className="fin-table">
          <thead>
            <tr>
              <th style={{ width: '80px' }}>{t('common.photo', 'Görsel')}</th>
              <th>{t('common.title', 'Başlık')}</th>
              <th>{t('media.item_type', 'İçerik Türü')}</th>
              <th>{t('common.date', 'Tarih')}</th>
              <th style={{ width: '80px', textAlign: 'right' }}>{t('subcontractor.table_action', 'İşlem')}</th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map(item => (
              <tr key={item.id}>
                <td>
                  {item.base64 ? (
                    <img
                      src={item.base64}
                      alt={item.title}
                      style={{ width: '45px', height: '45px', objectFit: 'cover', borderRadius: '6px', cursor: 'pointer', border: '1px solid var(--glass-border)' }}
                      onClick={() => onSelectImage(item.base64)}
                    />
                  ) : (
                    <div style={{
                      width: '45px',
                      height: '45px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                      fontSize: '1.2rem',
                      border: '1px dashed rgba(255, 255, 255, 0.08)'
                    }}>
                      📄
                    </div>
                  )}
                </td>
                <td style={{ fontWeight: '500' }}>
                  {item.title}
                </td>
                <td>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    color: item.type === 'report' ? 'var(--danger)' : 'var(--success)',
                    background: item.type === 'report' ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)',
                    padding: '3px 8px',
                    borderRadius: '4px',
                    textTransform: 'uppercase'
                  }}>
                    {item.typeLabel}
                  </span>
                </td>
                <td>
                  📅 {formatDate(item.date, i18n.language)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {item.base64 ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      style={{ width: '28px', height: '28px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 'auto' }}
                      onClick={() => onSelectImage(item.base64)}
                      title={t('common.view', 'Görüntüle')}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                  ) : (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MediaPagination t={t} totalItems={totalItems} totalPages={totalPages} validCurrentPage={validCurrentPage} setCurrentPage={setCurrentPage} />
    </>
  );
};

function MediaPagination({ t, totalItems, totalPages, validCurrentPage, setCurrentPage }) {
  if (totalItems <= 0) return null;
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '0.5rem',
      paddingTop: '0.75rem',
      borderTop: '1px solid var(--glass-border)'
    }}>
      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {t('common.page', 'Sayfa')} {validCurrentPage} / {totalPages} ({totalItems} {t('common.records', 'Kayıt')})
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={validCurrentPage === 1}
          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          style={{ padding: '6px 14px', fontSize: '0.85rem', cursor: validCurrentPage === 1 ? 'not-allowed' : 'pointer' }}
        >
          {t('common.prev', 'Önceki')}
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          {t('common.page', 'Sayfa')} {validCurrentPage} / {totalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={validCurrentPage === totalPages}
          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
          style={{ padding: '6px 14px', fontSize: '0.85rem', cursor: validCurrentPage === totalPages ? 'not-allowed' : 'pointer' }}
        >
          {t('common.next_short', 'Sonraki')}
        </button>
      </div>
    </div>
  );
}

export default MediaViews;
