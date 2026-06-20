import React, { useState, useEffect } from 'react';
import WorkerDrawer from './components/WorkerDrawer';
import WorkerProfile from './components/WorkerProfile';
import Settings from './components/Settings';
import CashRegister from './components/CashRegister';
import AnomalyPanel from './components/AnomalyPanel';
import GroupReportPanel from './components/GroupReportPanel';
import ConfirmationModal from './components/ui/ConfirmationModal';
import Spotlight from './components/ui/Spotlight';
import GuideDrawer from './components/ui/GuideDrawer';
import ToastManager from './components/ui/ToastManager';
import Titlebar from './components/ui/Titlebar';
import TectonDark from './assets/tecton_dark.svg';
import TectonLight from './assets/tecton_light.svg';
// New ERP Modules
import ProjectManagement from './components/ProjectManagement';
import ProductionManagement from './components/ProductionManagement';
import MaterialManagement from './components/MaterialManagement';
import DailyJournal from './components/DailyJournal';
import QualityReports from './components/QualityReports';
import SubcontractorLedger from './components/SubcontractorLedger';
import SubcontractorProfile from './components/SubcontractorProfile';
import MediaGallery from './components/MediaGallery';
import BulkTimesheet from './components/BulkTimesheet';
import AboutHelp from './components/AboutHelp';

import { exportToExcel, exportToCSV, exportToJSON, generateExcelTemplate } from './utils/exportUtils';
import { readWorkersFromExcel } from './utils/importUtils';
import { useTranslation } from 'react-i18next';
import { formatCurrency } from './utils/formatUtils';
import './index.css';

function App() {
  const { t, i18n } = useTranslation();
  
  const langToLocaleMap = {
    en: 'en-US',
    tr: 'tr-TR',
    de: 'de-DE',
    fr: 'fr-FR',
    es: 'es-ES',
    zh: 'zh-CN',
    ru: 'ru-RU',
    ja: 'ja-JP',
    ko: 'ko-KR',
    it: 'it-IT',
    nl: 'nl-NL',
    pt: 'pt-PT',
    ar: 'ar-SA',
    hi: 'hi-IN',
    sv: 'sv-SE',
    no: 'nb-NO',
    da: 'da-DK',
    pl: 'pl-PL',
    cs: 'cs-CZ'
  };

  useEffect(() => {
    document.documentElement.lang = langToLocaleMap[i18n.language] || i18n.language;
  }, [i18n.language]);

  const [view, setView] = useState('list'); // 'list' | 'profile' | 'settings' | 'kasa' | 'projects' | 'production' | 'materials' | 'journal' | 'quality' | 'subcontractor' | 'subcontractor_profile' | 'media'
  const [isShuttingDown, setIsShuttingDown] = useState(false);
  const [selectedWorkerProfile, setSelectedWorkerProfile] = useState(null);
  const [selectedSubcontractorProfile, setSelectedSubcontractorProfile] = useState(null);

  const [workers, setWorkers] = useState([]);
  const [balances, setBalances] = useState({});
  const [workerGroups, setWorkerGroups] = useState([]);
  const [projects, setProjects] = useState([]);
  const [activeProjectId, setActiveProjectId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState(null);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dashboardHelpOpen, setDashboardHelpOpen] = useState(false);
  const [sidebarState, setSidebarState] = useState(() => {
    return localStorage.getItem('sidebar_state') || 'full';
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem('sidebar_width') || '290', 10);
  });
  const [isResizing, setIsResizing] = useState(false);

  const handleSidebarStateChange = (state) => {
    setSidebarState(state);
    localStorage.setItem('sidebar_state', state);
  };

  const handleMouseDown = (e) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e) => {
      const newWidth = Math.max(240, Math.min(480, e.clientX));
      setSidebarWidth(newWidth);
      localStorage.setItem('sidebar_width', newWidth.toString());
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

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

  // Excel Import Undo State
  const [undoAvailable, setUndoAvailable] = useState(false);
  const fileInputRef = React.useRef(null);

  const fetchWorkers = async () => {
    try {
      if (window.api && window.api.db) {
        const data = await window.api.db.read('workers');
        const groupsData = await window.api.db.read('worker_groups');
        const settingsData = await window.api.db.read('app_settings');
        const projectsData = await window.api.db.read('projects');
        
        setWorkers(data);
        setWorkerGroups(groupsData || []);
        setProjects(projectsData || []);
        
        // Auto select first project if none active
        if (projectsData && projectsData.length > 0 && !activeProjectId) {
          setActiveProjectId(projectsData[0].id);
        }
        
        // Apply global settings (theme & language)
        if (settingsData) {
          const sMap = {};
          settingsData.forEach(s => sMap[s.setting_key] = s.setting_value);
          
          window.regionalSettings = {
            currency: sMap['custom_currency'] || 'auto',
            dateFormat: sMap['custom_date_format'] || 'auto',
            timeFormat: sMap['custom_time_format'] || 'auto',
            language: sMap['language'] || 'tr'
          };

          if (sMap['theme']) {
            document.documentElement.setAttribute('data-theme', sMap['theme']);
          } else {
            const defaultTheme = 'dark';
            document.documentElement.setAttribute('data-theme', defaultTheme);
            await window.api.db.create('app_settings', { setting_key: 'theme', setting_value: defaultTheme, description: 'Uygulama Teması (dark/light)' });
          }

          if (sMap['language']) {
            i18n.changeLanguage(sMap['language']);
            document.documentElement.lang = sMap['language'];
          } else {
            let defaultLang = 'tr';
            try {
              const navLang = navigator.language.split('-')[0];
              const supportedLangs = ['tr', 'en', 'zh', 'es', 'fr', 'ar', 'hi', 'ru', 'pt', 'de', 'sv', 'no', 'da', 'pl', 'it', 'nl', 'cs', 'ja', 'ko'];
              if (supportedLangs.includes(navLang)) {
                defaultLang = navLang;
              }
            } catch (e) {
              console.error('Failed to get navigator language:', e);
            }
            i18n.changeLanguage(defaultLang);
            document.documentElement.lang = defaultLang;
            await window.api.db.create('app_settings', { setting_key: 'language', setting_value: defaultLang, description: 'Uygulama Dili' });
          }
        }

        // Fetch balances for each worker
        const newBalances = {};
        for (const w of data) {
          const res = await window.api.finance.getBalance(w.id);
          if (res.success) newBalances[w.id] = res.balance;
        }
        setBalances(newBalances);
      }
    } catch (error) {
      console.error('Error fetching workers:', error);
    } finally {
      setLoading(false);
      if (window.api?.window?.appReady) {
        window.api.window.appReady();
      }
    }
  };

  useEffect(() => {
    fetchWorkers();
  }, [view, activeProjectId]);

  useEffect(() => {
    if (view.startsWith('settings_')) {
      setIsSettingsOpen(true);
    }
  }, [view]);

  // Global Ctrl+K listener to toggle spotlight
  useEffect(() => {
    const handleGlobalKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Listen for system shutdown events
  useEffect(() => {
    if (window.api && window.api.system && window.api.system.onShutdownStarting) {
      const unsubscribe = window.api.system.onShutdownStarting(() => {
        setIsShuttingDown(true);
      });
      return () => unsubscribe();
    }
  }, []);

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
      fetchWorkers();
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
          fetchWorkers();
        }
      }
    });
  };

  const openProfile = (worker) => {
    setSelectedWorkerProfile(worker);
    setView('profile');
  };

  const closeProfile = () => {
    setSelectedWorkerProfile(null);
    setView('list');
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

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const result = await readWorkersFromExcel(file, t);
      if (result.success) {
        if (window.api && window.api.system.createSnapshot) {
          await window.api.system.createSnapshot();
        }

        // Get a mutable local copy of current worker groups and workers
        let localGroups = [...workerGroups];
        let currentWorkersList = [...workers];

        for (const worker of result.data) {
          const { group_name, ...cleanWorker } = worker;
          let resolvedGroupId = null;

          if (group_name) {
            const trimmedName = group_name.trim();
            const lowerName = trimmedName.toLowerCase();
            const matchedGroup = localGroups.find(
              (g) => g.name && g.name.trim().toLowerCase() === lowerName
            );

            if (matchedGroup) {
              resolvedGroupId = matchedGroup.id;
            } else {
              // Create new group in the database
              const createRes = await window.api.db.create('worker_groups', { name: trimmedName });
              if (createRes && createRes.success) {
                resolvedGroupId = createRes.id;
                localGroups.push({ id: createRes.id, name: trimmedName });
              }
            }
          }

          // Check if worker already exists using professional identity matching rules
          const incomingTc = cleanWorker.tc_no ? cleanWorker.tc_no.trim() : '';
          const incomingPhone = cleanWorker.phone ? cleanWorker.phone.replace(/\D/g, '') : '';
          const incomingName = cleanWorker.full_name.trim().toLowerCase();

          const existingWorker = currentWorkersList.find(w => {
            const existingTc = w.tc_no ? w.tc_no.trim() : '';
            const existingPhone = w.phone ? w.phone.replace(/\D/g, '') : '';
            const existingName = w.full_name.trim().toLowerCase();

            // 1. Match by TC No (must be non-empty)
            if (incomingTc && existingTc && incomingTc === existingTc) {
              return true;
            }
            // 2. Match by Phone (must be non-empty)
            if (incomingPhone && existingPhone && incomingPhone === existingPhone) {
              return true;
            }
            // 3. Match by Name if both TC and Phone match or are empty (meaning no conflict)
            if (incomingName === existingName) {
              const tcConflict = incomingTc && existingTc && incomingTc !== existingTc;
              const phoneConflict = incomingPhone && existingPhone && incomingPhone !== existingPhone;
              if (!tcConflict && !phoneConflict) {
                return true;
              }
            }
            return false;
          });

          if (existingWorker) {
            const updateData = {
              full_name: cleanWorker.full_name,
              tc_no: cleanWorker.tc_no || existingWorker.tc_no,
              phone: cleanWorker.phone || existingWorker.phone,
              daily_wage: cleanWorker.daily_wage || existingWorker.daily_wage,
              group_id: resolvedGroupId || existingWorker.group_id,
              start_date: cleanWorker.start_date || existingWorker.start_date,
              status: cleanWorker.status || existingWorker.status,
              tags: cleanWorker.tags, // Overwrite with Excel tags so edits/deletions take effect!
              project_id: activeProjectId, // Bind to active project
              isg_start_date: cleanWorker.isg_start_date || existingWorker.isg_start_date,
              isg_bitis_tarihi: cleanWorker.isg_bitis_tarihi || existingWorker.isg_bitis_tarihi
            };

            await window.api.db.update('workers', existingWorker.id, updateData);
            
            // Update local list to prevent duplicate matching within the same batch
            const idx = currentWorkersList.findIndex(w => w.id === existingWorker.id);
            if (idx !== -1) {
              currentWorkersList[idx] = { ...existingWorker, ...updateData };
            }
          } else {
            // Create new worker
            const createRes = await window.api.db.create('workers', {
              ...cleanWorker,
              group_id: resolvedGroupId,
              project_id: activeProjectId
            });

            if (createRes && createRes.success) {
              currentWorkersList.push({
                id: createRes.id,
                ...cleanWorker,
                group_id: resolvedGroupId,
                project_id: activeProjectId
              });
            }
          }
        }
        fetchWorkers();
        setUndoAvailable(true);
        e.target.value = null; // reset
        setTimeout(() => setUndoAvailable(false), 15000);
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('common.error_occurred', 'Hata:') + ' ' + err.message, type: 'error' } }));
      e.target.value = null;
    }
  };

  const handleUndoImport = async () => {
    if (window.api && window.api.system.restoreSnapshot) {
      const res = await window.api.system.restoreSnapshot();
      if (res.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('dashboard.undo_success', 'İşlem başarıyla geri alındı!'), type: 'success' } }));
        setUndoAvailable(false);
        fetchWorkers();
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('dashboard.undo_error', 'Geri alma başarısız oldu:') + ' ' + res.message, type: 'error' } }));
      }
    }
  };

  const activeProjectObj = projects.find(p => p.id === activeProjectId);

  const getLayoutClass = () => {
    if (sidebarState === 'collapsed') return 'sidebar-collapsed';
    if (sidebarState === 'hidden') return 'sidebar-hidden';
    return '';
  };

  const currentSidebarWidth = sidebarState === 'full' ? sidebarWidth : (sidebarState === 'collapsed' ? 76 : 0);

  return (
    <>
      <Titlebar />
      <ToastManager sidebarWidth={currentSidebarWidth} />
      {sidebarState === 'hidden' && (
        <button
          type="button"
          onClick={() => handleSidebarStateChange('full')}
          className="sidebar-restore-btn"
          title={t('nav.expand', 'Genişlet')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 8 12 12 7 16"></polyline><polyline points="13 8 18 12 13 16"></polyline></svg>
        </button>
      )}

      <div 
        className={`app-layout ${getLayoutClass()} ${isResizing ? 'is-resizing' : ''}`}
        style={{ '--sidebar-width': sidebarState === 'full' ? `${sidebarWidth}px` : undefined, marginTop: '32px' }}
      >
        {/* Left fixed Sidebar Navigation */}
        <aside className="sidebar">
          {sidebarState === 'full' && (
            <div 
              className={`sidebar-resizer ${isResizing ? 'is-resizing' : ''}`}
              onMouseDown={handleMouseDown}
            />
          )}
          <div className="sidebar-logo">
            {sidebarState === 'collapsed' ? (
              <button 
                type="button"
                className="sidebar-collapsed-logo-btn"
                onClick={() => handleSidebarStateChange('full')}
                title={t('nav.expand', 'Genişlet')}
              >
                <img src={TectonDark} alt="Tecton" className="logo-dark" style={{ width: '24px', height: '24px' }} />
                <img src={TectonLight} alt="Tecton" className="logo-light" style={{ width: '24px', height: '24px' }} />
                <span className="hover-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </span>
              </button>
            ) : (
              <>
                <div className="sidebar-logo-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <img src={TectonDark} alt="Tecton" className="logo-dark" style={{ height: '24px' }} />
                  <img src={TectonLight} alt="Tecton" className="logo-light" style={{ height: '24px' }} />
                  <span className="sidebar-text" style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }}>{t('app.name', 'Tecton')}</span>
                </div>
                <div className="sidebar-controls">
                  <button 
                    type="button" 
                    onClick={() => handleSidebarStateChange('collapsed')}
                    className="sidebar-control-btn"
                    title={t('nav.collapse', 'Daralt')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                  </button>
                  <button 
                    type="button" 
                    onClick={() => handleSidebarStateChange('hidden')}
                    className="sidebar-control-btn"
                    title={t('nav.hide', 'Gizle')}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  </button>
                </div>
              </>
            )}
          </div>
          
          {/* Active project badge */}
          {activeProjectObj ? (
            <div className="sidebar-active-project" style={{
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              borderRadius: '8px',
              padding: '0.65rem 0.85rem',
              margin: '0 1rem 1.5rem 1rem',
              fontSize: '0.8rem'
            }}>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>{t('nav.active_project', 'Aktif Şantiye')}</div>
              <strong style={{ color: '#fff', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>{activeProjectObj.name}</strong>
            </div>
          ) : (
            <div className="sidebar-active-project" style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '0 1rem 1.5rem 1rem', fontWeight: 'bold' }}>⚠️ {t('nav.no_project_selected', 'Şantiye Seçilmedi!')}</div>
          )}

          <nav className="sidebar-nav">
            <div className={`sidebar-link ${view === 'projects' ? 'active' : ''}`} onClick={() => setView('projects')}>
              <span className="sidebar-icon">🏗️</span>
              <span className="sidebar-text">{t('nav.projects', 'Şantiyeler (Lokasyon)')}</span>
            </div>
            <div className={`sidebar-link ${view === 'list' || view === 'profile' ? 'active' : ''}`} onClick={() => { setView('list'); setSelectedWorkerProfile(null); }}>
              <span className="sidebar-icon">👥</span>
              <span className="sidebar-text">{t('nav.personnel')}</span>
            </div>
            <div className={`sidebar-link ${view === 'subcontractor' || view === 'subcontractor_profile' ? 'active' : ''}`} onClick={() => setView('subcontractor')}>
              <span className="sidebar-icon">🚜</span>
              <span className="sidebar-text">{t('nav.subcontractors', 'Taşeron Carileri')}</span>
            </div>
            <div className={`sidebar-link ${view === 'bulk_timesheet' ? 'active' : ''}`} onClick={() => setView('bulk_timesheet')}>
              <span className="sidebar-icon">📋</span>
              <span className="sidebar-text">{t('bulk_timesheet.nav_title', 'Çoklu Puantaj')}</span>
            </div>
            <div className={`sidebar-link ${view === 'production' ? 'active' : ''}`} onClick={() => setView('production')}>
              <span className="sidebar-icon">📐</span>
              <span className="sidebar-text">{t('nav.production', 'İmalat ve Metraj')}</span>
            </div>
            <div className={`sidebar-link ${view === 'materials' ? 'active' : ''}`} onClick={() => setView('materials')}>
              <span className="sidebar-icon">📄</span>
              <span className="sidebar-text">{t('nav.materials', 'İrsaliye & Malzeme')}</span>
            </div>
            <div className={`sidebar-link ${view === 'journal' ? 'active' : ''}`} onClick={() => setView('journal')}>
              <span className="sidebar-icon">📓</span>
              <span className="sidebar-text">{t('nav.journal', 'Günlük Jurnal')}</span>
            </div>
            <div className={`sidebar-link ${view === 'quality' ? 'active' : ''}`} onClick={() => setView('quality')}>
              <span className="sidebar-icon">🛡️</span>
              <span className="sidebar-text">{t('nav.quality', 'Kalite Kontrol')}</span>
            </div>
            <div className={`sidebar-link ${view === 'media' ? 'active' : ''}`} onClick={() => setView('media')}>
              <span className="sidebar-icon">📷</span>
              <span className="sidebar-text">{t('nav.media', 'Medya Galerisi')}</span>
            </div>
            <div className={`sidebar-link ${view === 'kasa' ? 'active' : ''}`} onClick={() => setView('kasa')}>
              <span className="sidebar-icon">💵</span>
              <span className="sidebar-text">{t('nav.cash')}</span>
            </div>
            <div className={`sidebar-link ${view === 'hakkinda' ? 'active' : ''}`} onClick={() => setView('hakkinda')}>
              <span className="sidebar-icon">❓</span>
              <span className="sidebar-text">{t('nav.help', 'Hakkında & Yardım')}</span>
            </div>
            <div>
              <div 
                className={`sidebar-link ${view.startsWith('settings_') ? 'active' : ''}`} 
                onClick={() => setIsSettingsOpen(prev => !prev)}
              >
                <span className="sidebar-icon">⚙️</span>
                <span className="sidebar-text" style={{ flex: 1 }}>{t('nav.settings')}</span>
                <span className="sidebar-text" style={{ 
                  transform: isSettingsOpen ? 'rotate(180deg)' : 'rotate(0deg)', 
                  transition: 'transform 0.2s ease', 
                  fontSize: '0.7rem', 
                  opacity: 0.7 
                }}>▼</span>
              </div>
              
              <div className="sidebar-submenu" style={{
                maxHeight: isSettingsOpen ? '250px' : '0px',
                overflow: 'hidden',
                transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                paddingLeft: sidebarState === 'collapsed' ? '0' : '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                marginTop: isSettingsOpen ? '0.25rem' : '0'
              }}>
                <div 
                  className={`sidebar-link ${view === 'settings_genel' ? 'active' : ''}`} 
                  onClick={() => setView('settings_genel')}
                  style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
                >
                  <span className="sidebar-icon">⚙️</span>
                  <span className="sidebar-text">{t('nav.settings_genel', 'Genel Ayarlar')}</span>
                </div>
                <div 
                  className={`sidebar-link ${view === 'settings_finance' ? 'active' : ''}`} 
                  onClick={() => setView('settings_finance')}
                  style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
                >
                  <span className="sidebar-icon">💼</span>
                  <span className="sidebar-text">{t('nav.settings_finance', 'Finans & Operasyon')}</span>
                </div>
                <div 
                  className={`sidebar-link ${view === 'settings_security' ? 'active' : ''}`} 
                  onClick={() => setView('settings_security')}
                  style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
                >
                  <span className="sidebar-icon">🛡️</span>
                  <span className="sidebar-text">{t('nav.settings_security', 'Güvenlik & Yedek')}</span>
                </div>
                <div 
                  className={`sidebar-link ${view === 'settings_logs' ? 'active' : ''}`} 
                  onClick={() => setView('settings_logs')}
                  style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
                >
                  <span className="sidebar-icon">📋</span>
                  <span className="sidebar-text">{t('nav.settings_logs', 'Sistem Kayıtları')}</span>
                </div>
                <div 
                  className={`sidebar-link ${view === 'settings_recycle' ? 'active' : ''}`} 
                  onClick={() => setView('settings_recycle')}
                  style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
                >
                  <span className="sidebar-icon">🗑️</span>
                  <span className="sidebar-text">{t('sidebar_recycle_btn', 'Çöp Kutusu')}</span>
                </div>
              </div>
            </div>
          </nav>

          <div className="sidebar-footer" style={{ textAlign: 'center' }}>
            <div>{t('sidebar_spotlight', 'Spotlight: Ctrl + K')}</div>
          </div>
        </aside>

        {/* Right Dynamic Page View */}
        <main className="main-content">
          {view === 'profile' && selectedWorkerProfile ? (
            <WorkerProfile worker={selectedWorkerProfile} onBack={closeProfile} />
          ) : view === 'subcontractor_profile' && selectedSubcontractorProfile ? (
            <SubcontractorProfile subcontractor={selectedSubcontractorProfile} onBack={() => { setSelectedSubcontractorProfile(null); setView('subcontractor'); }} />
          ) : view.startsWith('settings_') ? (
            <Settings activeTab={view.split('_')[1]} />
          ) : view === 'settings' ? (
            <Settings activeTab="genel" />
          ) : view === 'hakkinda' ? (
            <AboutHelp />
          ) : view === 'kasa' ? (
            <CashRegister activeProjectId={activeProjectId} projects={projects} />
          ) : view === 'projects' ? (
            <ProjectManagement onSelectProject={(id) => setActiveProjectId(id)} activeProjectId={activeProjectId} />
          ) : view === 'production' ? (
            <ProductionManagement activeProjectId={activeProjectId} projects={projects} />
          ) : view === 'materials' ? (
            <MaterialManagement activeProjectId={activeProjectId} projects={projects} />
          ) : view === 'journal' ? (
            <DailyJournal activeProjectId={activeProjectId} projects={projects} />
          ) : view === 'quality' ? (
            <QualityReports activeProjectId={activeProjectId} projects={projects} />
          ) : view === 'subcontractor' ? (
            <SubcontractorLedger 
              activeProjectId={activeProjectId} 
              projects={projects} 
              onViewProfile={(subcontractor) => { 
                setSelectedSubcontractorProfile(subcontractor); 
                setView('subcontractor_profile'); 
              }} 
            />
          ) : view === 'media' ? (
            <MediaGallery activeProjectId={activeProjectId} projects={projects} />
          ) : view === 'bulk_timesheet' ? (
            <BulkTimesheet activeProjectId={activeProjectId} projects={projects} />
          ) : (
            // Bento Grid Dashboard Layout
            <div className="personnel-page" style={{ animation: 'fadeIn 0.3s ease' }}>
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
                  {activeProjectId && (
                    <>
                      <button className="btn btn-bulk-timesheet" onClick={() => setView('bulk_timesheet')}>
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
                    </>
                  )}
                </div>
              </header>

              {!activeProjectId ? (
                <div className="glass-card text-center" style={{ padding: '4rem 2rem' }}>
                  <h2>🏗️ {t('common.welcome_title', 'ŞantiyemOS Hoş Geldiniz')}</h2>
                  <p className="card-subtitle mt-4">{t('common.welcome_msg', 'Kayıt girişi yapabilmek veya personel yönetebilmek için lütfen sol menüden yeni bir Şantiye oluşturun veya aktif bir çalışma alanı seçin.')}</p>
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
                                              onClick={() => openProfile(worker)}
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
                                      <div key={worker.id} className="glass-card" onClick={() => openProfile(worker)} style={{ cursor: 'pointer', position: 'relative' }}>
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
            </div>
          )}
        </main>
      </div>

      {/* Spotlight command center overlay */}
      <Spotlight 
        isOpen={isSpotlightOpen} 
        onClose={() => setIsSpotlightOpen(false)} 
        onNavigate={(v, raw) => {
          setView(v);
          if (v === 'profile' && raw) {
            setSelectedWorkerProfile(raw);
          }
        }} 
        workers={workers}
        projects={projects}
      />

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

      {isShuttingDown && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--bg-gradient, linear-gradient(135deg, #090d16 0%, #11102b 100%))',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          zIndex: 999999, color: 'var(--text-main)', fontFamily: 'Inter, sans-serif'
        }}>
          <div className="shutdown-logo-wrapper">
            <img src={document.documentElement.getAttribute('data-theme') === 'light' ? TectonDark : TectonLight} alt="Tecton" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            <div className="shutdown-laser-line"></div>
          </div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.5rem', textAlign: 'center' }}>
            {t('app.shutdown_title', 'Sistem Güvenli Bir Şekilde Kapatılıyor')}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center' }}>
            {t('app.shutdown_desc', 'Veritabanı yedeğiniz alınıyor ve bütünlük kontrolü yapılıyor, lütfen bekleyin...')}
          </p>
        </div>
      )}
    </>
  );
}

export default App;
