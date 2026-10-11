import React from 'react';
import { formatCurrency, formatDate } from '../utils/formatUtils';

const SubcontractorTxList = ({ t, i18n, paginatedTransactions, totalPages, currentPage, setCurrentPage, onDelete }) => {
  return (
    <>
      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
        {paginatedTransactions.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
            {t('subcontractor_profile.no_records', 'Bu tarih aralığında kayıt bulunamadı.')}
          </div>
        ) : (
          paginatedTransactions.map(tr => (
            <div key={tr.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
              padding: '1rem', borderRadius: '8px'
            }}>
              <div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 'bold' }}>{formatDate(tr.trans_date, i18n.language)}</span>
                  <span style={{
                    fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
                    background: tr.type === 'Hakediş' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: tr.type === 'Hakediş' ? 'var(--success-text)' : 'var(--danger-text)'
                  }}>
                    {tr.type === 'Hakediş' ? t('subcontractor_profile.earned_badge', 'Hakediş') : t('subcontractor_profile.payment_badge', 'Ödeme')}
                  </span>
                </div>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{tr.description}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: tr.type === 'Hakediş' ? 'var(--success-text)' : 'var(--danger-text)' }}>
                  {tr.type === 'Hakediş' ? '+' : '-'}{formatCurrency(tr.amount, i18n.language)}
                </div>
                <button
                  onClick={() => onDelete(tr)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', marginTop: '0.25rem' }}
                >
                  {t('common.delete', 'Sil')}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.5rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--glass-border)' }}>
          <button type="button" className="btn" disabled={currentPage === 1} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}>{t('common.prev', 'Önceki')}</button>
          <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>{t('common.page_info', 'Sayfa')} {currentPage} / {totalPages}</span>
          <button type="button" className="btn" disabled={currentPage === totalPages} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}>{t('common.next', 'Sonraki')}</button>
        </div>
      )}
    </>
  );
};

export default SubcontractorTxList;
