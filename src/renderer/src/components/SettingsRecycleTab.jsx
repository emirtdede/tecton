import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, RotateCcw, Lightbulb, X } from 'lucide-react';
import CustomDatePicker from './ui/CustomDatePicker';

const SettingsRecycleTab = ({ setModalConfig, setIsGuideOpen }) => {
  const { t } = useTranslation();
  // Recycle Bin states
  const [deletedItems, setDeletedItems] = useState([]);
  const [recycleSearch, setRecycleSearch] = useState('');
  const [recycleSearchField, setRecycleSearchField] = useState('all');
  const [recycleFilterType, setRecycleFilterType] = useState('');
  const [recycleFilterProject, setRecycleFilterProject] = useState('');
  const [allProjects, setAllProjects] = useState([]);
  const [recycleStartDate, setRecycleStartDate] = useState('');
  const [recycleEndDate, setRecycleEndDate] = useState('');
  const [restoredKeys, setRestoredKeys] = useState([]);
  const [recycleRestoreStatus, setRecycleRestoreStatus] = useState('all');
  const [recycleCurrentPage, setRecycleCurrentPage] = useState(1);
  const recycleContainerRef = useRef(null);
  void recycleSearchField;

  const fetchDeleted = async () => {
    if (window.api && window.api.db && window.api.db.readDeleted) {
      const items = await window.api.db.readDeleted();
      setDeletedItems(items || []);
    }
    if (window.api && window.api.db && window.api.db.readAllProjects) {
      const projs = await window.api.db.readAllProjects();
      setAllProjects(projs || []);
    }
  };

  const handleRestore = async (table, id) => {
    setModalConfig({
      isOpen: true,
      title: t('recycle.restore_confirm_title', 'Geri Yükleme Onayı'),
      message: t('recycle.restore_confirm_msg', 'Bu kaydı geri yüklemek istediğinize emin misiniz? Kayıt, silinmeden önceki asıl yerine eklenecektir.'),
      type: 'primary',
      confirmText: t('common.yes', 'Evet'),
      cancelText: t('common.no', 'Hayır'),
      onConfirm: async () => {
        if (window.api && window.api.db && window.api.db.restoreRecord) {
          const res = await window.api.db.restoreRecord(table, id);
          if (res.success) {
            setModalConfig({
              isOpen: true,
              title: t('recycle.successTitle', 'Başarılı'),
              message: t('recycle.restoreSuccess', 'Veri başarıyla eski yerine geri yüklendi.'),
              type: 'primary',
              confirmText: t('common.ok', 'Tamam'),
              cancelText: '',
              onConfirm: () => {}
            });
            setRestoredKeys(prev => [...prev, `${table}_${id}`]);
          } else {
            setModalConfig({
              isOpen: true,
              title: t('common.error', 'Hata'),
              message: t('recycle.restore_error', 'Geri yükleme hatası:') + ' ' + res.message,
              type: 'danger',
              confirmText: t('common.ok', 'Tamam'),
              cancelText: '',
              onConfirm: () => {}
            });
          }
        }
      }
    });
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    if (val && recycleEndDate && new Date(val) > new Date(recycleEndDate)) {
      setRecycleStartDate(recycleEndDate);
      setRecycleEndDate(val);
    } else {
      setRecycleStartDate(val);
    }
  };

  const handleEndDateChange = (e) => {
    const val = e.target.value;
    if (val && recycleStartDate && new Date(recycleStartDate) > new Date(val)) {
      setRecycleEndDate(recycleStartDate);
      setRecycleStartDate(val);
    } else {
      setRecycleEndDate(val);
    }
  };

  useEffect(() => {
    setRestoredKeys([]);
    setRecycleSearch('');
    setRecycleSearchField('all');
    setRecycleFilterType('');
    setRecycleFilterProject('');
    setRecycleStartDate('');
    setRecycleEndDate('');
    setRecycleRestoreStatus('all');
    setRecycleCurrentPage(1);
    fetchDeleted();
  }, []);

  useEffect(() => {
    if (recycleContainerRef.current) {
      recycleContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [recycleCurrentPage]);

  useEffect(() => {
    setRecycleCurrentPage(1);
  }, [recycleSearch, recycleFilterType, recycleFilterProject, recycleStartDate, recycleEndDate, recycleRestoreStatus]);

  return (
    <div ref={recycleContainerRef} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h3 className="card-title" style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
           {t('recycle_page_title', 'Geri Dönüşüm & Çöp Kutusu')}
        </div>
        <span
          onClick={() => setIsGuideOpen(true)}
          style={{
            cursor: 'pointer',
            opacity: 'var(--guide-icon-opacity, 0.4)', filter: 'var(--guide-icon-filter, none)',
            transition: 'opacity 0.25s ease-in-out',
            fontSize: '1.6rem',
            userSelect: 'none',
            padding: '0.25rem'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity-hover, 1)'}
          onMouseLeave={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity, 0.4)'}
          title={t('common.page_guide', 'Sayfa Kılavuzu')}
        >
          <Lightbulb size={18} aria-hidden="true" />
        </span>
      </h3>
      <p className="card-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {t('recycle_page_desc', 'Silinen kayıtları buradan inceleyip orijinal yerlerine geri yükleyebilirsiniz.')}
      </p>

      {/* Filters & Search Bar */}
      <div style={{
        background: 'rgba(255, 255, 255, 0.02)',
        border: '1px solid var(--glass-border)',
        borderRadius: '12px',
        padding: '1rem',
        display: 'flex',
        gap: '1rem',
        alignItems: 'flex-end',
        flexWrap: 'wrap'
      }}>
        {/* Text Search Input */}
        <div style={{ position: 'relative', flex: 2, minWidth: '200px', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder={t('global.searchPlaceholder', 'Ara...')}
            value={recycleSearch}
            onChange={e => setRecycleSearch(e.target.value)}
            style={{ paddingRight: '2.5rem', width: '100%', marginBottom: 0 }}
          />
          {recycleSearch && (
            <button
              type="button"
              onClick={() => setRecycleSearch('')}
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
              <X size={14} aria-hidden="true" />
            </button>
          )}
        </div>

        {/* Restore Status Filter */}
        <select
          className="form-input"
          value={recycleRestoreStatus}
          onChange={e => setRecycleRestoreStatus(e.target.value)}
          style={{ flex: 1, minWidth: '180px', marginBottom: 0 }}
        >
          <option value="all">{t('recycle.filterAllRecords', 'Tüm Kayıtlar')}</option>
          <option value="only_deleted">{t('recycle.onlyDeleted')}</option>
          <option value="only_restored">{t('recycle.onlyRestored')}</option>
        </select>

        {/* Record Type Filter */}
        <select
          className="form-input"
          value={recycleFilterType}
          onChange={e => setRecycleFilterType(e.target.value)}
          style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}
        >
          <option value="">{t('recycle.filterAllTypes', 'Tüm Kayıt Türleri')}</option>
          <option value="workers">{t('recycle.type.personnel')}</option>
          <option value="transactions">{t('recycle.type.cash')}</option>
          <option value="materials">{t('recycle.type.delivery')}</option>
          <option value="daily_journals">{t('recycle.type.journal')}</option>
          <option value="quality_reports">{t('recycle.type.quality')}</option>
          <option value="subcontractor_ledgers">{t('recycle.type.subcontractor')}</option>
          <option value="projects">{t('recycle.type.project')}</option>
        </select>

        {/* Project Filter */}
        <select
          className="form-input"
          value={recycleFilterProject}
          onChange={e => setRecycleFilterProject(e.target.value)}
          style={{ flex: 1, minWidth: '150px', marginBottom: 0 }}
        >
          <option value="">{t('recycle.filterAllProjects', 'Tüm Şantiyeler')}</option>
          {allProjects.map(proj => (
            <option key={proj.id} value={proj.id}>
              {proj.name} {proj.is_deleted ? `(${t('recycle.deletedProjectShort', 'Silindi')})` : ''}
            </option>
          ))}
        </select>

        {/* Start Date */}
        <div style={{ flex: 1.2, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {t('global.startDate', 'Başlangıç Tarihi')}
          </span>
          <CustomDatePicker
            className="form-input"
            value={recycleStartDate}
            onChange={handleStartDateChange}
            style={{ marginBottom: 0 }}
          />
        </div>

        {/* End Date */}
        <div style={{ flex: 1.2, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {t('global.endDate', 'Bitiş Tarihi')}
          </span>
          <CustomDatePicker
            className="form-input"
            value={recycleEndDate}
            onChange={handleEndDateChange}
            style={{ marginBottom: 0 }}
          />
        </div>
      </div>

      {(() => {
        const filteredDeletedItems = deletedItems.filter(item => {
          const typeTranslationMap = {
            workers: t('recycle.type.personnel', 'Personel Kaydı'),
            transactions: t('recycle.type.cash', 'Kasa Hareketi'),
            materials: t('recycle.type.delivery', 'İrsaliye / Malzeme'),
            daily_journals: t('recycle.type.journal', 'Günlük Jurnal'),
            quality_reports: t('recycle.type.quality', 'Kalite Kontrol Tutanağı'),
            subcontractor_ledgers: t('recycle.type.subcontractor', 'Taşeron Cari Kaydı'),
            projects: t('recycle.type.project', 'Şantiye Kaydı'),
            worker_leaves: t('recycle.type.worker_leaves', 'Personel İzni')
          };
          const typeLabel = typeTranslationMap[item.table] || item.table;
          const formattedDate = item.deleted_at ? new Date(item.deleted_at).toLocaleString() : '';
          const itemKey = `${item.table}_${item.id}`;
          const isRestored = item.is_deleted === 0 || restoredKeys.includes(itemKey);

          if (recycleRestoreStatus === 'only_deleted' && isRestored) {
            return false;
          }
          if (recycleRestoreStatus === 'only_restored' && !isRestored) {
            return false;
          }

          if (recycleFilterType && item.table !== recycleFilterType) {
            return false;
          }

          if (recycleFilterProject && String(item.project_id) !== String(recycleFilterProject)) {
            return false;
          }

          if (recycleStartDate) {
            const start = new Date(recycleStartDate);
            start.setHours(0, 0, 0, 0);
            if (new Date(item.deleted_at) < start) return false;
          }
          if (recycleEndDate) {
            const end = new Date(recycleEndDate);
            end.setHours(23, 59, 59, 999);
            if (new Date(item.deleted_at) > end) return false;
          }

          if (recycleSearch) {
            const q = recycleSearch.toLowerCase();
            const matchType = typeLabel.toLowerCase().includes(q);
            const matchTitle = (item.title || '').toLowerCase().includes(q);
            const matchDate = formattedDate.toLowerCase().includes(q);
            const matchProject = (item.project_name || '').toLowerCase().includes(q);
            return matchType || matchTitle || matchDate || matchProject;
          }

          return true;
        });

        if (filteredDeletedItems.length === 0) {
          return (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              {recycleSearch || recycleFilterType || recycleFilterProject || recycleStartDate || recycleEndDate || recycleRestoreStatus !== 'all'
                ? t('anomalies.search_no_results', 'Arama kriterlerine uygun sonuç bulunamadı.')
                : t('recycle.emptyState', 'Silinmiş herhangi bir kayıt bulunmuyor.')}
            </div>
          );
        }

        const itemsPerPage = 8;
        const totalPages = Math.ceil(filteredDeletedItems.length / itemsPerPage);
        const displayedItems = filteredDeletedItems.slice(
          (recycleCurrentPage - 1) * itemsPerPage,
          recycleCurrentPage * itemsPerPage
        );

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div key={recycleCurrentPage} className="recycle-animate-page" style={{ overflowX: 'auto' }}>
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)', textAlign: 'left' }}>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('recycle_th_type', 'Record Type')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('recycle_th_project', 'Project / Site')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('recycle_th_content', 'Content / Title')}</th>
                    <th style={{ padding: '0.75rem 1rem' }}>{t('recycle_th_date', 'Deleted At')}</th>
                    <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>{t('recycle_th_action', 'Action')}</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedItems.map((item, idx) => {
                    const typeTranslationMap = {
                      workers: t('recycle_type_worker', 'Personnel Record'),
                      transactions: t('recycle_type_cash', 'Cash Transaction'),
                      materials: t('recycle_type_material', 'Delivery Note / Material'),
                      daily_journals: t('recycle_type_journal', 'Daily Journal'),
                      quality_reports: t('recycle_type_quality', 'Quality Control Report'),
                      subcontractor_ledgers: t('recycle_type_subcontractor', 'Subcontractor Ledger'),
                      projects: t('recycle_type_project', 'Project Record'),
                      worker_leaves: t('recycle_type_worker_leaves', 'Personnel Leave')
                    };
                    const typeLabel = typeTranslationMap[item.table] || item.table;
                    const itemKey = `${item.table}_${item.id}`;
                    const isRestored = item.is_deleted === 0 || restoredKeys.includes(itemKey);

                    return (
                      <tr key={`${item.table}_${item.id}_${idx}`} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                        <td style={{ padding: '1rem' }}>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: '600',
                            background: 'rgba(255,255,255,0.06)',
                            padding: '2px 8px',
                            borderRadius: '4px'
                          }}>
                            {typeLabel}
                          </span>
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {item.project_name || '-'}
                        </td>
                        <td style={{ padding: '1rem', fontWeight: '500', color: '#fff' }}>
                          {(() => {
                            if (item.table === 'worker_leaves') {
                              const match = item.title.match(/^(.*?) İzni \((.*?) - (.*?)\)$/);
                              if (match) {
                                const translatedType = t(`leave_type.${match[1]}`, match[1]);
                                return t('recycle.leave_title', { type: translatedType, start: match[2], end: match[3] }, `${translatedType} İzni (${match[2]} - ${match[3]})`);
                              }
                            }
                            return item.title;
                          })()}
                        </td>
                        <td style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {item.deleted_at ? new Date(item.deleted_at).toLocaleString() : '-'}
                        </td>
                        <td style={{ padding: '1rem', textAlign: 'right' }}>
                          {isRestored ? (
                            <span
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.8rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(255, 255, 255, 0.03)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--glass-border)',
                                borderRadius: '6px',
                                fontWeight: '500'
                              }}
                            >
                              <Check size={13} style={{ color: 'var(--success)' }} />
                              {t('global.restored', 'Geri Yüklendi')}
                            </span>
                          ) : (
                            <button
                              className="btn btn-primary"
                              onClick={() => handleRestore(item.table, item.id)}
                              style={{
                                padding: '6px 14px',
                                fontSize: '0.8rem',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                background: 'rgba(16, 185, 129, 0.08)',
                                color: '#10b981',
                                border: '1px solid rgba(16, 185, 129, 0.2)',
                                borderRadius: '6px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#10b981';
                                e.currentTarget.style.color = '#fff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'rgba(16, 185, 129, 0.08)';
                                e.currentTarget.style.color = '#10b981';
                              }}
                            >
                              <RotateCcw size={13} />
                              {t('global.restore', 'Geri Yükle')}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '1rem 0.5rem 0.5rem 0.5rem',
                borderTop: '1px solid var(--glass-border)',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                  {t('common.page_info', 'Sayfa')} {recycleCurrentPage} / {totalPages} {t('global.recordsCount', { count: filteredDeletedItems.length })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button
                    className="btn"
                    disabled={recycleCurrentPage === 1}
                    onClick={() => setRecycleCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{
                      padding: '0.4rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      cursor: recycleCurrentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: recycleCurrentPage === 1 ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { if (recycleCurrentPage !== 1) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={(e) => { if (recycleCurrentPage !== 1) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  >
                    {t('common.prev', 'Önceki')}
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {t('common.page_info', 'Sayfa')} {recycleCurrentPage} / {totalPages}
                  </span>
                  <button
                    className="btn"
                    disabled={recycleCurrentPage === totalPages}
                    onClick={() => setRecycleCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    style={{
                      padding: '0.4rem 1rem',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      cursor: recycleCurrentPage === totalPages ? 'not-allowed' : 'pointer',
                      opacity: recycleCurrentPage === totalPages ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { if (recycleCurrentPage !== totalPages) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={(e) => { if (recycleCurrentPage !== totalPages) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  >
                    {t('common.next', 'Sonraki')}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

    </div>
  );
};

export default SettingsRecycleTab;
