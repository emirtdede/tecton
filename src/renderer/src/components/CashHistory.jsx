import React from 'react';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatCurrency, formatDate } from '../utils/formatUtils';

const CashHistory = ({ t, i18n, projects, filterProject, setFilterProject, filterStartDate, onStartDateChange, filterEndDate, onEndDateChange, filterType, setFilterType, searchQuery, setSearchQuery, filteredTransactions, paginatedTransactions, totalPages, currentPage, setCurrentPage, getProjectName, onDelete, onExport, listRef }) => {
  return (
    <div ref={listRef} className="right-panel glass-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 className="card-title" style={{ marginBottom: 0 }}>{t('cash.cash_history')}</h3>
        <select className="btn" style={{ padding: '0.5rem' }} onChange={e => onExport(e.target.value)} value="">
          <option value="" disabled>{t('group_report.export')}...</option>
          <option value="pdf">PDF (.pdf)</option>
          <option value="excel">Excel (.xlsx)</option>
          <option value="csv">CSV (.csv)</option>
          <option value="json">JSON (.json)</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('recycle.tableProject', 'Şantiye')}</label>
          <select className="form-input" value={filterProject} onChange={e => setFilterProject(e.target.value)}>
            <option value="all">{t('cash.allCompany')}</option>
            <option value="merkez">{t('cash.headquarters')}</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('cash.start_date')}</label>
            <CustomDatePicker className="form-input" value={filterStartDate} onChange={e => onStartDateChange(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('cash.end_date')}</label>
            <CustomDatePicker className="form-input" value={filterEndDate} onChange={e => onEndDateChange(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('cash.trans_dir')}</label>
            <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">{t('cash.all')}</option>
              <option value="Nakit Girişi">{t('cash.table.income')}</option>
              <option value="Nakit Çıkışı">{t('cash.table.expense')}</option>
            </select>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem', position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          className="form-input"
          placeholder={t('cash.search_placeholder', 'Açıklamalarda ara...')}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{ paddingRight: '2.5rem', width: '100%' }}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: '12px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1rem',
              padding: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}
            title={t('common.clear', 'Temizle')}
          >
            ✕
          </button>
        )}
      </div>

      {filteredTransactions.length === 0 ? (
        <p className="text-muted" style={{ marginTop: '2rem', textAlign: 'center' }}>
          {searchQuery ? 'Arama kriterlerine uygun kasa hareketi bulunamadı.' : (t('common.empty_data') || 'Gösterilecek veri bulunamadı.')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {paginatedTransactions.map(tr => {
            const isIncome = tr.type === 'Nakit Girişi';
            return (
              <div key={tr.id} style={{
                background: isIncome ? 'var(--success-bg-light)' : 'var(--danger-bg-light)',
                border: `1px solid ${isIncome ? 'var(--success-border)' : 'var(--danger-border)'}`,
                padding: '1rem',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{formatDate(tr.trans_date, i18n.language)}</span>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      border: `1px solid var(${isIncome ? '--success-text' : '--danger-text'})`,
                      color: `var(${isIncome ? '--success-text' : '--danger-text'})`
                    }}>{isIncome ? t('cash.table.income') : t('cash.table.expense')}</span>
                  </div>
                  <div className="card-subtitle" style={{ fontSize: '0.9rem' }}>
                    {tr.description || '-'}
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.1rem 0.4rem',
                      borderRadius: '4px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: 'var(--text-muted)'
                    }}>
                      📁 {getProjectName(tr.project_id)}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 'bold', color: isIncome ? 'var(--success-text)' : 'var(--danger-text)', fontSize: '1.1rem' }}>
                    {isIncome ? '+' : '-'}{formatCurrency(tr.amount, i18n.language)}
                  </div>
                  <button
                    onClick={() => onDelete(tr.id)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--danger-text)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', marginTop: '0.25rem' }}
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages} ({filteredTransactions.length} {t('common.records', 'Kayıt')})
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
                  {t('common.next', 'Sonraki')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CashHistory;
