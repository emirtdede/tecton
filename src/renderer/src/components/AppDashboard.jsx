import React, { useState } from 'react';
import WorkerDrawer from './WorkerDrawer';
import AnomalyPanel from './AnomalyPanel';
import GroupReportPanel from './GroupReportPanel';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';
import { exportToExcel, exportToCSV, exportToJSON, generateExcelTemplate } from '../utils/exportUtils';
import { formatCurrency } from '../utils/formatUtils';
import { useWorkerImport } from '../hooks/useWorkerImport';

const AppDashboard = ({ t, i18n, workers, balances, workerGroups, projects, activeProjectId, activeProjectObj, loading, onOpenProfile, onDataChanged, onOpenBulk }) => {
  // Filtre State
  const [filterText, setFilterText] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('dashboard_view_mode') || 'grid';
  });

  // Confirmation Modal State
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [dashboardHelpOpen, setDashboardHelpOpen] = useState(false);

  const { fileInputRef, undoAvailable, handleFileUpload, handleUndoImport } = useWorkerImport({
    t, workers, workerGroups, activeProjectId, onDataChanged
  });

  const handleOpenDrawer = (worker = null) => {
    setEditingWorker(worker);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingWorker(null);
  };

  const handleSaveWorker = async (id, workerData) => {
    if (window.api && window.api.db) {
      // Bind worker to the active project
      const dataToSave = { ...workerData, project_id: activeProjectId };
      if (id) {
        await window.api.db.update('workers', id, dataToSave);
      } else {
        await window.api.db.create('workers', dataToSave);
      }
      onDataChanged();
      handleCloseDrawer();
    }
  };

  const handleDeleteWorker = (id) => {
    setConfirmModalState({
      isOpen: true,
      title: t('dashboard.delete_worker_title', 'Personeli Sil'),
      message: t('dashboard.delete_worker_msg', 'Bu personeli silmek (çöp kutusuna taşımak) istediğinize emin misiniz? Sistemdeki verileri kalıcı olarak silinmez, ancak listelerden kaldırılır.'),
      onConfirm: async () => {
        if (window.api && window.api.db) {
          await window.api.db.delete('workers', id);
          onDataChanged();
        }
      }
    });
  };

  // Filter workers by search query AND active project
  const filteredWorkers = workers.filter(w => {
    const matchProject = activeProjectId ? w.project_id == activeProjectId : true;
    const matchText = w.full_name.toLowerCase().includes(filterText.toLowerCase()) ||
                      (w.tc_no && w.tc_no.includes(filterText)) ||
                      (w.phone && w.phone.includes(filterText));
    const matchGroup = filterGroup ? w.group_id == filterGroup : true;
    return matchProject && matchText && matchGroup;
  });

  const handleExport = (format) => {
    const lang = i18n.language;
    const isTr = lang === 'tr';
    const dataToExport = filteredWorkers.map(w => ({
      [isTr ? 'Ad Soyad' : 'Full Name']: w.full_name,
      [isTr ? 'TC Kimlik No' : 'TC Identity No']: w.tc_no || '-',
      [isTr ? 'Telefon' : 'Phone']: w.phone || '-',
      [isTr ? 'Günlük Yevmiye' : 'Daily Wage']: w.daily_wage,
      [isTr ? 'Bağlı Olduğu Grup' : 'Group']: workerGroups.find(g => g.id === w.group_id)?.name || '-',
      [isTr ? 'Şantiye' : 'Project']: projects.find(p => p.id == w.project_id)?.name || '-',
      [isTr ? 'Durum' : 'Status']: w.status === 'active' ? (isTr ? 'Aktif' : 'Active') : (w.status === 'passive' ? (isTr ? 'Pasif' : 'Passive') : w.status || '-'),
      [isTr ? 'Etiketler' : 'Tags']: (() => {
        try {
          const parsed = w.tags ? JSON.parse(w.tags) : [];
          return Array.isArray(parsed) ? parsed.join(', ') : '-';
        } catch (e) {
          return w.tags || '-';
        }
      })(),
      [isTr ? 'Net Bakiye' : 'Net Balance']: balances[w.id] || 0,
      [isTr ? 'İşe Başlama' : 'Start Date']: w.start_date,
      [isTr ? 'İSG Başlangıç' : 'ISG Start Date']: w.isg_start_date || '-',
      [isTr ? 'İSG Bitiş' : 'ISG End Date']: w.isg_bitis_tarihi || '-'
    }));

    const fName = isTr ? 'Personel_Listesi' : 'Personnel_List';
    if (format === 'excel') exportToExcel(dataToExport, fName);
    if (format === 'csv') exportToCSV(dataToExport, fName);
    if (format === 'json') exportToJSON(dataToExport, fName);
  };

  return (
    <div className="personnel-page" style={{ animation: 'fadeIn 0.3s ease' }}>
      {activeProjectId && (
        <header className="header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h1 style={{ margin: 0 }}>{t('dashboard.title')}</h1>
            <span
              onClick={() => setDashboardHelpOpen(true)}
              style={{
                cursor: 'pointer',
                opacity: 'var(--guide-icon-opacity, 0.4)', filter: 'var(--guide-icon-filter, none)',
                transition: 'opacity 0.25s ease-in-out',
                fontSize: '1.4rem',
                userSelect: 'none',
                padding: '0.25rem'
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity-hover, 1)'}
              onMouseLeave={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity, 0.4)'}
              title={t('common.page_guide', 'Sayfa Kılavuzu')}
            >
              💡
            </span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="file"
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button className="btn btn-bulk-timesheet" onClick={onOpenBulk}>
              {t('dashboard.bulk_timesheet', '📋 Çoklu Puantaj')}
            </button>
            <button className="btn" style={{ background: '#10B981', color: 'white', border: 'none' }} onClick={() => fileInputRef.current.click()}>
              {t('dashboard.import_excel')}
            </button>
            <button className="btn" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid #38bdf8' }} onClick={() => generateExcelTemplate(t, i18n.language)}>
              {t('about.download_template')}
            </button>
            <select className="btn" style={{ padding: '0.5rem' }} onChange={e => handleExport(e.target.value)} value="">
              <option value="" disabled>{t('dashboard.export')}</option>
              <option value="excel">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
              <option value="json">JSON (.json)</option>
            </select>
            <button className="btn btn-primary" onClick={() => handleOpenDrawer()}>
              {t('dashboard.new_worker')}
            </button>
          </div>
        </header>
      )}

      {!activeProjectId ? (
        <div className="glass-card text-center" style={{ padding: '3rem' }}>
          <h2>👥 {t('nav.personnel', 'Personel Yönetimi')}</h2>
          <p className="text-muted" style={{ marginTop: '1rem' }}>{t('common.select_project_msg', 'Lütfen sol menüden veya Şantiye Yönetimi sayfasından aktif bir şantiye seçin.')}</p>
        </div>
      ) : (
        <div className="bento-grid">
          {/* Left Column: Personnel List (span 8) */}
          <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'row', gap: '1rem', alignItems: 'center', padding: '1rem' }}>
              <div style={{ position: 'relative', flex: 2, display: 'flex', alignItems: 'center' }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('dashboard.search')}
                  value={filterText}
                  onChange={e => setFilterText(e.target.value)}
                  style={{ width: '100%', paddingRight: '2.5rem', marginBottom: 0 }}
                />
                {filterText && (
                  <button
                    type="button"
                    onClick={() => setFilterText('')}
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
                value={filterGroup}
                onChange={e => setFilterGroup(e.target.value)}
                style={{ flex: 1, marginBottom: 0 }}
              >
                <option value="">{t('dashboard.all_groups')}</option>
                {workerGroups.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>

              {/* View Mode Toggle Switcher */}
              <div style={{
                display: 'flex',
                gap: '0.25rem',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '4px',
                borderRadius: '10px',
                border: '1px solid var(--glass-border)',
                flexShrink: 0
              }}>
                <button
                  type="button"
                  onClick={() => { setViewMode('list'); localStorage.setItem('dashboard_view_mode', 'list'); }}
                  title={t('media.view_list', 'Liste Görünümü')}
                  style={{
                    background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
                    border: 'none',
                    color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="8" y1="6" x2="21" y2="6" />
                    <line x1="8" y1="12" x2="21" y2="12" />
                    <line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" />
                    <line x1="3" y1="12" x2="3.01" y2="12" />
                    <line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => { setViewMode('grid'); localStorage.setItem('dashboard_view_mode', 'grid'); }}
                  title={t('media.view_grid', 'Grid Görünümü')}
                  style={{
                    background: viewMode === 'grid' ? 'var(--primary)' : 'transparent',
                    border: 'none',
                    color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                    padding: '7px 10px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </button>
              </div>
            </div>

            {loading ? (
              <div className="skeleton" style={{ height: '300px', width: '100%' }}></div>
            ) : filteredWorkers.length === 0 ? (
              <div className="glass-card text-center" style={{ padding: '4rem 2rem' }}>
                {filterText || filterGroup ? (
                  <h2 className="card-title" style={{ margin: 0 }}>Arama kriterlerine uygun personel kaydı bulunamadı.</h2>
                ) : (
                  <>
                    <h2 className="card-title">{t('dashboard.empty_state')}</h2>
                    <p className="card-subtitle mt-4">{t('dashboard.empty_state_sub')}</p>
                  </>
                )}
              </div>
                                ) : (() => {
              const grouped = filteredWorkers.reduce((acc, w) => {
                const g = workerGroups.find(group => group.id === w.group_id);
                const gName = g ? g.name : t('group_report.no_group', 'Grupsuz');
                if (!acc[gName]) acc[gName] = [];
                acc[gName].push(w);
                return acc;
              }, {});
              const sortedNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, i18n.language || 'tr'));
              return (
                <div className="workers-grouped-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                  {sortedNames.map((groupName) => (
                    <div key={groupName}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', color: 'var(--text-main)', borderLeft: '4px solid var(--accent)', paddingLeft: '0.6rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>👥 {groupName}</span>
                        <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)', padding: '0.2rem 0.5rem', borderRadius: '10px' }}>
                          {grouped[groupName].length} {t('group_report.person_count')}
                        </span>
                      </h3>
                      {viewMode === 'list' ? (
                        <div className="fin-table-container">
                          <table className="fin-table">
                            <thead>
                              <tr>
                                <th style={{ width: '40%', textAlign: 'left' }}>{t('worker_modal.name', 'Ad Soyad')}</th>
                                <th style={{ width: '25%', textAlign: 'left' }}>{t('common.phone', 'Telefon')}</th>
                                <th style={{ width: '20%', textAlign: 'right' }}>{t('dashboard.net_balance', 'Net Bakiye')}</th>
                                <th style={{ width: '15%', textAlign: 'right' }}>{t('subcontractor.table_action', 'İşlem')}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {grouped[groupName].map((worker) => {
                                const bal = balances[worker.id] || 0;
                                const isPositive = bal >= 0;
                                return (
                                  <tr key={worker.id}>
                                    <td
                                      style={{ fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
                                      onClick={() => onOpenProfile(worker)}
                                    >
                                      {worker.full_name}
                                    </td>
                                    <td>{worker.phone || t('dashboard.phone_not_found')}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: isPositive ? '#34d399' : '#ef4444' }}>
                                      {formatCurrency(bal, i18n.language)}
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
                                        <button
                                          className="btn"
                                          onClick={() => handleOpenDrawer(worker)}
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
                                          onClick={() => handleDeleteWorker(worker.id)}
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
                        </div>
                      ) : (
                        <div className="workers-grid">
                          {grouped[groupName].map((worker) => {
                            const bal = balances[worker.id] || 0;
                            const isPositive = bal >= 0;
                            return (
                              <div key={worker.id} className="glass-card" onClick={() => onOpenProfile(worker)} style={{ cursor: 'pointer', position: 'relative' }}>
                                <div className="card-header">
                                  <div>
                                    <h3 className="card-title">{worker.full_name}</h3>
                                    <p className="card-subtitle">{worker.phone || t('dashboard.phone_not_found')}</p>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontWeight: 'bold', color: isPositive ? '#34d399' : '#ef4444', fontSize: '1.2rem' }}>
                                      {formatCurrency(bal, i18n.language)}
                                    </div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('dashboard.net_balance')}</div>
                                  </div>
                                </div>

                                <div className="card-actions" onClick={e => e.stopPropagation()}>
                                  <button
                                    className="btn"
                                    onClick={() => handleOpenDrawer(worker)}
                                    style={{ flex: 1 }}
                                  >
                                    {t('dashboard.edit')}
                                  </button>
                                  <button
                                    className="btn btn-danger"
                                    onClick={() => handleDeleteWorker(worker.id)}
                                    style={{ flex: 1 }}
                                  >
                                    {t('dashboard.delete')}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>

          {/* Right Column: Widgets / Anomaly & Reports (span 4) */}
          <div style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <AnomalyPanel workers={filteredWorkers} balances={balances} viewMode={viewMode} />
            <GroupReportPanel activeProjectId={activeProjectId} workers={workers} balances={balances} viewMode={viewMode} />
          </div>
        </div>
      )}

      <WorkerDrawer
        isOpen={isDrawerOpen}
        onClose={handleCloseDrawer}
        onSave={handleSaveWorker}
        worker={editingWorker}
      />

      <ConfirmationModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.onConfirm}
        title={confirmModalState.title}
        message={confirmModalState.message}
      />

      <GuideDrawer
        isOpen={dashboardHelpOpen}
        onClose={() => setDashboardHelpOpen(false)}
        title={t('guides.personnel.title', 'Personel Yönetim Rehberi (5N1K)')}
        desc=""
        h1={t('guides.personnel.q1.title', '1. NE? (Personel Yönetimi Nedir?)')}
        p1={t('guides.personnel.q1.desc', 'Şantiyenizde görev alan mavi yaka ve beyaz yaka çalışanların puantaj, avans, hakediş ve İSG evrak durumlarını izleyen takip sistemidir.')}
        h2={t('guides.personnel.q2.title', '2. NEREDE? (Personel Verileri Nerede Depolanır?)')}
        p2={t('guides.personnel.q2.desc', 'Tüm personel kartları, gruplar ve cari hareketler yerel veritabanında saklanır. Aktif çalışma şantiyenize göre filtrelenir.')}
        h3={t('guides.personnel.q3.title', '3. NE ZAMAN? (Personel Girişi ve Puantaj Ne Zaman Yapılır?)')}
        p3={t('guides.personnel.q3.desc', 'Yeni bir personel işe başladığında sisteme kaydedilir. Puantaj ve avans girişleri günlük veya haftalık periyotlarla aksatılmadan işlenmelidir.')}
        h4={t('guides.personnel.q4.title', '4. NASIL? (Personel Ekleme ve Excel Aktarımı Nasıl Yapılır?)')}
        p4={t('guides.personnel.q4.desc', 'Sağ üstteki \'Personel Ekle\' butonuyla kart açabilir; toplu veri girişi için şablon indirip Excel\'den tek tıkla yükleme yapabilirsiniz.')}
        h5={t('guides.personnel.q5.title', '5. NEDEN? (Neden Detaylı Personel Takibi Yapılmalıdır?)')}
        p5={t('guides.personnel.q5.desc', 'Maaş hesaplarında uyuşmazlıkları önlemek, İSG belgelerinin sürelerini kaçırmamak ve şantiyenin anlık personel maliyetini doğru hesaplamak için tutulur.')}
        h6={t('guides.personnel.q6.title', '6. KİM? (Personel Listesini Kimler Yönetebilir?)')}
        p6={t('guides.personnel.q6.desc', 'Proje yöneticileri, şantiye şefleri ve idari işler sorumluları personel ekleyebilir, gruplayabilir ve puantaj/avans hareketlerini yönetebilir.')}
      />

      {undoAvailable && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem',
          background: '#1e293b', color: 'white', padding: '1rem 1.5rem',
          borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '1rem',
          border: '1px solid #3b82f6', zIndex: 9999,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div>
            <strong>Toplu aktarım tamamlandı!</strong>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>Bir hata yaptıysanız işlemi hemen geri alabilirsiniz.</div>
          </div>
          <button onClick={handleUndoImport} style={{
            background: '#ef4444', color: 'white', border: 'none', padding: '0.5rem 1rem',
            borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
          }}>
            Geri Al (Undo)
          </button>
        </div>
      )}
    </div>
  );
};

export default AppDashboard;
