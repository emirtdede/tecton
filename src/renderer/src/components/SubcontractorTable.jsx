import React from 'react';
import { formatCurrency } from '../utils/formatUtils';

const SubcontractorTable = ({ t, i18n, loading, searchQuery, setSearchQuery, filterServiceType, setFilterServiceType, filterStatus, setFilterStatus, uniqueServiceTypes, filteredContractors, paginatedContractors, totalPages, currentPage, setCurrentPage, onViewProfile, onOpenDrawer, onDelete }) => {
  return (
    <div style={{ gridColumn: 'span 9', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Search and filter bar */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center', padding: '1rem' }}>
        <div style={{ position: 'relative', flex: 2, display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder={t('filters.search_subcontractors', 'Taşeron adı, hizmet, yevmiye, bakiye veya durum ara...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingRight: '2.5rem', marginBottom: 0 }}
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

        <select
          className="form-input"
          value={filterServiceType}
          onChange={e => setFilterServiceType(e.target.value)}
          style={{ flex: 1, marginBottom: 0 }}
        >
          <option value="">{t('subcontractor.all_services', 'Tüm Hizmet Alanları')}</option>
          {uniqueServiceTypes.map(st => (
            <option key={st} value={st}>{st}</option>
          ))}
        </select>

        <select
          className="form-input"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ flex: 1, marginBottom: 0 }}
        >
          <option value="">{t('filters.all_status', 'Tüm Durumlar')}</option>
          <option value="active">{t('filters.active', 'Aktif')}</option>
          <option value="passive">{t('filters.passive', 'Pasif')}</option>
        </select>
      </div>

      {/* Subcontractors content */}
      {loading ? (
        <div className="skeleton" style={{ height: '300px', width: '100%' }}></div>
      ) : filteredContractors.length === 0 ? (
        <div className="glass-card text-center" style={{ padding: '4rem 2rem' }}>
          <h2 className="card-title" style={{ margin: 0 }}>
            {searchQuery || filterServiceType || filterStatus ? t('subcontractor.no_results', 'Arama kriterlerine uygun taşeron kaydı bulunamadı.') : t('empty.subcontractor', 'Bu şantiye için henüz taşeron kaydedilmemiş.')}
          </h2>
        </div>
      ) : (
        <div className="fin-table-container">
          <table className="fin-table">
            <thead>
              <tr>
                <th>{t('subcontractor.table_name', 'Taşeron / Firma')}</th>
                <th>{t('subcontractor.service', 'Hizmet Alanı')}</th>
                <th>{t('common.phone', 'Telefon')}</th>
                <th style={{ textAlign: 'right' }}>{t('subcontractor.table_wage', 'Günlük Bedel')}</th>
                <th style={{ textAlign: 'right' }}>{t('dashboard.net_balance', 'Net Bakiye')}</th>
                <th>{t('subcontractor.table_status', 'Durum')}</th>
                <th style={{ textAlign: 'right' }}>{t('subcontractor.table_action', 'İşlem')}</th>
              </tr>
            </thead>
            <tbody>
              {paginatedContractors.map(c => {
                const bal = c.balance || 0;
                const isPositive = bal >= 0;
                return (
                  <tr key={c.id}>
                    <td
                      style={{ fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
                      onClick={() => onViewProfile && onViewProfile(c)}
                    >
                      {c.name}
                    </td>
                    <td>{c.service_type}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>{c.phone || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {formatCurrency(c.daily_wage, i18n.language)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: isPositive ? '#34d399' : '#ef4444' }}>
                      {formatCurrency(bal, i18n.language)}
                    </td>
                    <td>
                      <span style={{
                        fontSize: '0.8rem',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        background: c.status === 'passive' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                        color: c.status === 'passive' ? 'var(--danger)' : 'var(--success)'
                      }}>
                        {c.status === 'passive' ? t('filters.passive', 'PASİF') : t('filters.active', 'AKTİF')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        {onViewProfile && (
                          <button
                            className="btn btn-primary"
                            onClick={() => onViewProfile(c)}
                            style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title={t('common.details', 'Detay')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        )}
                        <button
                          className="btn"
                          onClick={() => onOpenDrawer(c)}
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
                          onClick={() => onDelete(c.id)}
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
                );
              })}
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
              borderRadius: '0 0 12px 12px'
            }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('common.pagination_info', 'Sayfa {{page}} / {{total}} ({{records}} Kayıt)', { page: currentPage, total: totalPages, records: filteredContractors.length })}
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
      )}
    </div>
  );
};

export default SubcontractorTable;
