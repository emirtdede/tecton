import React, { useState, useEffect } from 'react';
import WorkerProfile from './components/WorkerProfile';
import Settings from './components/Settings';
import CashRegister from './components/CashRegister';
import Spotlight from './components/ui/Spotlight';
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
import AppSidebar from './components/AppSidebar';
import AppDashboard from './components/AppDashboard';
import AppWelcomeModal from './components/AppWelcomeModal';

import { useTranslation } from 'react-i18next';
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
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [sidebarState, setSidebarState] = useState(() => {
    return localStorage.getItem('sidebar_state') || 'full';
  });
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    return parseInt(localStorage.getItem('sidebar_width') || '290', 10);
  });
  const [isResizing, setIsResizing] = useState(false);
  const hasInitializedView = React.useRef(false);

  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    const hideWelcome = localStorage.getItem('hide_welcome_modal');
    if (hideWelcome !== 'true') {
      setShowWelcomeModal(true);
    }
  }, []);

  const changeAppLanguage = async (newLang) => {
    i18n.changeLanguage(newLang);
    document.documentElement.lang = newLang;
    if (window.regionalSettings) window.regionalSettings.language = newLang;

    if (window.api && window.api.db) {
      try {
        const settingsData = await window.api.db.read('app_settings');
        const langSetting = settingsData.find(s => s.setting_key === 'language');
        if (langSetting) {
          await window.api.db.update('app_settings', langSetting.id, { setting_value: newLang });
        }
      } catch (err) {
        console.error('Failed to update language in DB:', err);
      }
    }
  };

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

        // On initial load, default to projects view if no projects exist
        if (!hasInitializedView.current) {
          hasInitializedView.current = true;
          if (!projectsData || projectsData.length === 0) {
            setView('projects');
          }
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

        // Fetch balances in one IPC round-trip (bulk), with per-worker fallback
        let newBalances = {};
        if (data.length > 0) {
          try {
            if (window.api.finance.getBalances) {
              const bulk = await window.api.finance.getBalances(data.map((w) => w.id));
              if (bulk && bulk.success && bulk.balances) {
                newBalances = bulk.balances;
              }
            }
          } catch (_) { /* fall through to per-worker */ }
          if (Object.keys(newBalances).length === 0) {
            for (const w of data) {
              const res = await window.api.finance.getBalance(w.id);
              if (res.success) newBalances[w.id] = res.balance;
            }
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const openProfile = (worker) => {
    setSelectedWorkerProfile(worker);
    setView('profile');
  };

  const closeProfile = () => {
    setSelectedWorkerProfile(null);
    setView('list');
  };

  const activeProjectObj = projects.find(p => p.id === activeProjectId);

  const getLayoutClass = () => {
    if (sidebarState === 'collapsed') return 'sidebar-collapsed';
    if (sidebarState === 'hidden') return 'sidebar-hidden';
    return '';
  };

  const currentSidebarWidth = sidebarState === 'full' ? sidebarWidth : (sidebarState === 'collapsed' ? 76 : 0);

  const closeWelcomeModal = () => {
    if (dontShowAgain) {
      localStorage.setItem('hide_welcome_modal', 'true');
    }
    setShowWelcomeModal(false);
  };

  return (
    <>
      <Titlebar />
      <ToastManager sidebarWidth={currentSidebarWidth} />

      <div
        className={`app-layout ${getLayoutClass()} ${isResizing ? 'is-resizing' : ''}`}
        style={{ '--sidebar-width': sidebarState === 'full' ? `${sidebarWidth}px` : undefined, marginTop: '32px' }}
      >
        <AppSidebar
          t={t}
          view={view}
          setView={setView}
          setSelectedWorkerProfile={setSelectedWorkerProfile}
          sidebarState={sidebarState}
          onSidebarStateChange={handleSidebarStateChange}
          onMouseDown={handleMouseDown}
          activeProjectObj={activeProjectObj}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
        />

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
            <AppDashboard
              t={t}
              i18n={i18n}
              workers={workers}
              balances={balances}
              workerGroups={workerGroups}
              projects={projects}
              activeProjectId={activeProjectId}
              activeProjectObj={activeProjectObj}
              loading={loading}
              onOpenProfile={openProfile}
              onDataChanged={fetchWorkers}
              onOpenBulk={() => setView('bulk_timesheet')}
            />
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

      <AppWelcomeModal
        t={t}
        i18n={i18n}
        show={showWelcomeModal}
        dontShowAgain={dontShowAgain}
        setDontShowAgain={setDontShowAgain}
        onClose={closeWelcomeModal}
        onLanguageChange={changeAppLanguage}
      />

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
