import React, { useState, useEffect, lazy, Suspense } from 'react';
import WorkerDrawer from './components/WorkerDrawer';
import AnomalyPanel from './components/AnomalyPanel';
import GroupReportPanel from './components/GroupReportPanel';
import ConfirmationModal from './components/ui/ConfirmationModal';
import ErrorBoundary from './components/ui/ErrorBoundary';
import Spotlight from './components/ui/Spotlight';
import GuideDrawer from './components/ui/GuideDrawer';
import ToastManager from './components/ui/ToastManager';
import Titlebar from './components/ui/Titlebar';
import NoProjectNotice from './components/ui/NoProjectNotice';
// Brand marks live in a single place (`tecton_assets/`) so the window icon, the
// splash screen, the packaged installer and the UI can never drift apart.
// `npm run brand` regenerates the PNG/ICO derivatives from these SVGs.
import TectonDark from '../../../tecton_assets/tecton-tray-dark.svg';
import TectonLight from '../../../tecton_assets/tecton-tray-light.svg';
// New ERP Modules - route-level code splitting so a view's (and its heavy
// dependencies') code only loads when the user opens it.
const WorkerProfile = lazy(() => import('./components/WorkerProfile'));
const Settings = lazy(() => import('./components/Settings'));
const CashRegister = lazy(() => import('./components/CashRegister'));
const ProjectManagement = lazy(() => import('./components/ProjectManagement'));
const ProductionManagement = lazy(() => import('./components/ProductionManagement'));
const MaterialManagement = lazy(() => import('./components/MaterialManagement'));
const DailyJournal = lazy(() => import('./components/DailyJournal'));
const QualityReports = lazy(() => import('./components/QualityReports'));
const SubcontractorLedger = lazy(() => import('./components/SubcontractorLedger'));
const SubcontractorProfile = lazy(() => import('./components/SubcontractorProfile'));
const MediaGallery = lazy(() => import('./components/MediaGallery'));
const BulkTimesheet = lazy(() => import('./components/BulkTimesheet'));
const AboutHelp = lazy(() => import('./components/AboutHelp'));
const Documentation = lazy(() => import('./components/Documentation'));
const LegalNotice = lazy(() => import('./components/LegalNotice'));

import { exportToExcel, exportToCSV, exportToJSON, generateExcelTemplate } from './utils/exportUtils';
import { readWorkersFromExcel } from './utils/importUtils';
import { useTranslation } from 'react-i18next';
import { ensureLocale, applyDocumentLanguage } from './i18n';
import { applyAppearance } from './theme/appearance';
import OnboardingWizard from './components/onboarding/OnboardingWizard';
import { formatCurrency, setRegionalSettings } from './utils/formatUtils';
import { parseTags } from './utils/tagUtils';
import { logError } from './utils/logger';
import './index.css';
import apiWrite, { apiMessage } from './utils/apiWrite';
import PageGuideIcon from './components/ui/PageGuideIcon';
import {
  Building2,
  Users,
  HardHat,
  Wallet,
  Settings as SettingsIcon,
  FolderKanban,
  UserRound,
  Handshake,
  ClipboardList,
  Ruler,
  Package,
  BookOpen,
  ShieldCheck,
  Scale,
  Images,
  CircleDollarSign,
  CircleHelp,
  SlidersHorizontal,
  Landmark,
  ShieldEllipsis,
  ScrollText,
  Trash2,
  Plug,
  Brain,
  Github,
  Heart,
  ChevronRight,
  ChevronLeft,
  Pencil,
  X,
} from 'lucide-react';


// ---------------------------------------------------------------------------
// Navigation. Pages are grouped for the sidebar captions, but every page is a
// sibling link: the shell is one flat list, exactly like the reference design.
// Keeping the structure as data means a page cannot exist without an entry.
// ---------------------------------------------------------------------------
const NAV_GROUPS = [
  {
    id: 'sites',
    icon: Building2,
    labelKey: 'nav.projects',
    items: [{ view: 'projects', icon: FolderKanban, labelKey: 'nav.projects' }],
  },
  {
    id: 'people',
    icon: Users,
    labelKey: 'nav.personnel',
    items: [
      { view: 'list', icon: UserRound, labelKey: 'nav.personnel' },
      { view: 'subcontractor', icon: Handshake, labelKey: 'nav.subcontractors' },
      { view: 'bulk_timesheet', icon: ClipboardList, labelKey: 'bulk_timesheet.nav_title' },
    ],
  },
  {
    id: 'operations',
    icon: HardHat,
    labelKey: 'nav.production',
    items: [
      { view: 'production', icon: Ruler, labelKey: 'nav.production' },
      { view: 'materials', icon: Package, labelKey: 'nav.materials' },
      { view: 'journal', icon: BookOpen, labelKey: 'nav.journal' },
      { view: 'quality', icon: ShieldCheck, labelKey: 'nav.quality' },
      { view: 'media', icon: Images, labelKey: 'nav.media' },
    ],
  },
  {
    id: 'finance',
    icon: Wallet,
    labelKey: 'nav.cash',
    items: [{ view: 'kasa', icon: CircleDollarSign, labelKey: 'nav.cash' }],
  },
  {
    id: 'system',
    icon: SettingsIcon,
    labelKey: 'nav.settings',
    items: [
      { view: 'hakkinda', icon: CircleHelp, labelKey: 'nav.help' },
      { view: 'docs', icon: BookOpen, labelKey: 'nav.docs' },
      { view: 'legal', icon: Scale, labelKey: 'nav.legal' },
      { view: 'settings_genel', icon: SlidersHorizontal, labelKey: 'nav.settings_genel' },
      { view: 'settings_finance', icon: Landmark, labelKey: 'nav.settings_finance' },
      { view: 'settings_security', icon: ShieldEllipsis, labelKey: 'nav.settings_security' },
      { view: 'settings_integrations', icon: Plug, labelKey: 'nav.settings_integrations' },
      { view: 'settings_ai', icon: Brain, labelKey: 'nav.settings_ai' },
      { view: 'settings_logs', icon: ScrollText, labelKey: 'nav.settings_logs' },
      { view: 'settings_recycle', icon: Trash2, labelKey: 'sidebar_recycle_btn' },
    ],
  },
];

// The grouping above is presentation only: every page is a sibling in the
// sidebar, so there is no second navigation level that can drift out of sync.

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
    const parsed = parseInt(localStorage.getItem('sidebar_width') || '248', 10);
    // A corrupted localStorage value used to produce NaN, which then became an
    // invalid CSS width on every launch. Values above 340 px were saved by the
    // old rail-plus-panel layout, which was much wider than this flat sidebar.
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 340 ? Math.max(232, parsed) : 248;
  });
  const [isResizing, setIsResizing] = useState(false);
  const hasInitializedView = React.useRef(false);

  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // First run is decided by the database, so a restored or cloud-synced profile
  // does not show the wizard again, and a fresh install always shows it. The
  // localStorage flag remains as a cache for the very first paint.
  useEffect(() => {
    let cancelled = false;

    const decide = async () => {
      let completed = localStorage.getItem('hide_welcome_modal') === 'true';
      try {
        const rows = await window.api?.db?.read?.('app_settings');
        const row = Array.isArray(rows) ? rows.find((entry) => entry.setting_key === 'onboarding_completed') : null;
        if (row) completed = row.setting_value === 'true';
      } catch (error) {
        logError('Failed to read the onboarding state:', error);
      }
      if (cancelled) return;
      if (completed) localStorage.setItem('hide_welcome_modal', 'true');
      else localStorage.removeItem('hide_welcome_modal');
      setShowWelcomeModal(!completed);
    };

    decide();
    return () => {
      cancelled = true;
    };
  }, []);

  // Jump List / command-line deep link, e.g. `--route=settings_security`.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve(window.api?.platform?.launchRoute?.())
      .then((route) => {
        if (cancelled || !route) return;
        if (typeof route === 'string' && route.startsWith('settings_')) setView(route);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Pages that need an active site raise this instead of duplicating the
  // sidebar logic; the shell owns navigation.
  useEffect(() => {
    const handleNavigate = (event) => {
      const next = event?.detail?.view;
      if (typeof next === 'string' && next) setView(next);
    };
    document.addEventListener('tecton:navigate', handleNavigate);
    return () => document.removeEventListener('tecton:navigate', handleNavigate);
  }, []);

  const changeAppLanguage = async (newLang) => {
    // Locale dictionaries are separate chunks now, so load before switching.
    newLang = await ensureLocale(newLang);
    i18n.changeLanguage(newLang);
    applyDocumentLanguage(newLang);
    setRegionalSettings({ language: newLang });

    if (window.api && window.api.db) {
      try {
        const settingsData = await window.api.db.read('app_settings');
        const langSetting = settingsData.find(s => s.setting_key === 'language');
        if (langSetting) {
          await apiWrite(window.api.db.update('app_settings', langSetting.id, { setting_value: newLang }));
        }
      } catch (err) {
        logError('Failed to update language in DB:', err);
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
      const newWidth = Math.max(232, Math.min(420, e.clientX));
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
  // Tracks the 15s "undo import" timer so it can be replaced/cleared instead of
  // surviving unmounts or stacking up on repeated imports.
  const undoTimerRef = React.useRef(null);

  useEffect(() => () => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
  }, []);

  // Guards against out-of-order async results when the active project changes
  // mid-fetch: a slow response for the previous project must not overwrite the
  // freshly selected one.
  const workersRequestIdRef = React.useRef(0);
  const activeProjectIdRef = React.useRef(activeProjectId);
  useEffect(() => { activeProjectIdRef.current = activeProjectId; }, [activeProjectId]);

  const fetchWorkers = async () => {
    const requestId = ++workersRequestIdRef.current;
    try {
      if (window.api && window.api.db) {
        // Four independent reads: one wait instead of four serial round-trips.
        const [data, groupsData, settingsData, projectsData] = await Promise.all([
          window.api.db.read('workers'),
          window.api.db.read('worker_groups'),
          window.api.db.read('app_settings'),
          window.api.db.read('projects')
        ]);

        // A newer fetch (e.g. after a project switch) already took over.
        if (requestId !== workersRequestIdRef.current) return;

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
          
          setRegionalSettings({
            currency: sMap['custom_currency'] || 'auto',
            dateFormat: sMap['custom_date_format'] || 'auto',
            timeFormat: sMap['custom_time_format'] || 'auto',
            language: sMap['language'] || 'tr'
          });
          // Appearance is applied as one unit: surface, palette, icon, zoom and
          // accessibility flags. Writing only `data-theme` here would lose the
          // user's accent and zoom on every restart.
          applyAppearance({
            mode: sMap['theme'] || 'dark',
            themeId: sMap['theme_id'] || 'obsidian',
            customColor: sMap['custom_theme_color'] || 'var(--accent)',
            appIcon: sMap['app_icon'] || 'auto',
            iconColor: sMap['app_icon_color'] || 'var(--accent)',
            zoom: sMap['ui_zoom'] || 1,
            highContrast: sMap['a11y_high_contrast'] === 'true',
            enhancedFocus: sMap['a11y_enhanced_focus'] === 'true',
            readableSpacing: sMap['a11y_readable_spacing'] === 'true',
            reduceMotion: sMap['a11y_reduce_motion'] === 'true',
          });

          if (sMap['language']) {
            const restoredLang = await ensureLocale(sMap['language']);
            i18n.changeLanguage(restoredLang);
            applyDocumentLanguage(restoredLang);
          } else {
            // First run (no stored choice): the installer's picker wins, then the
            // Windows display language, then the browser locale. Anything Tecton
            // does not ship falls back to English.
            let requested = '';
            try {
              const info = await window.api?.platform?.info?.();
              requested = info?.installerLanguage || info?.systemLocale || '';
            } catch (e) {
              logError('Failed to read the system language:', e);
            }
            const defaultLang = await ensureLocale(requested || navigator.language || 'en');
            i18n.changeLanguage(defaultLang);
            applyDocumentLanguage(defaultLang);
            await apiWrite(window.api.db.create('app_settings', { setting_key: 'language', setting_value: defaultLang, description: 'Uygulama Dili' }));
          }
        }

        // One batched IPC call + two grouped SQL queries instead of the previous
        // N+1 (`finance.getBalance` per worker), which dominated first paint.
        let newBalances = {};
        if (data.length > 0) {
          const bulkRes = window.api.finance?.getBalances
            ? await window.api.finance.getBalances(data.map(w => w.id))
            : null;

          if (bulkRes && bulkRes.success) {
            newBalances = bulkRes.balances || {};
          } else {
            // Fallback for an older preload bundle (app not restarted after update).
            const balanceResults = await Promise.all(
              data.map(w =>
                window.api.finance.getBalance(w.id)
                  .then(res => (res && res.success ? [w.id, res.balance] : null))
                  .catch(() => null)
              )
            );
            for (const entry of balanceResults) {
              if (entry) newBalances[entry[0]] = entry[1];
            }
          }
        }

        // Balance fetches are the slowest part: re-check before applying.
        if (requestId !== workersRequestIdRef.current) return;

        setBalances(newBalances);
      }
    } catch (error) {
      logError('Error fetching workers:', error);
    } finally {
      // Only the latest request may clear the loading flag.
      if (requestId === workersRequestIdRef.current) {
        setLoading(false);
        if (window.api?.window?.appReady) {
          Promise.resolve(window.api.window.appReady()).catch(logError);
        }
      }
    }
  };

  // Workers only need refetching when the active project changes; mutations call
  // fetchWorkers() explicitly. Previously this also ran on every `view` change,
  // causing a full workers + balances reload on each navigation.
  useEffect(() => {
    fetchWorkers();
  }, [activeProjectId]);

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
        await apiWrite(window.api.db.update('workers', id, dataToSave));
      } else {
        await apiWrite(window.api.db.create('workers', dataToSave));
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
          await apiWrite(window.api.db.delete('workers', id));
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

  // Filter workers by search query AND active project.
  // Memoized: this ran on every App re-render (sidebar resize, modal toggles,
  // balance updates...), not just when the filters or worker list changed.
  const filteredWorkers = React.useMemo(() => {
    const query = filterText.toLowerCase();
    return workers.filter(w => {
      const matchProject = activeProjectId ? w.project_id == activeProjectId : true;
      const matchText = w.full_name.toLowerCase().includes(query) ||
                        (w.tc_no && w.tc_no.includes(filterText)) ||
                        (w.phone && w.phone.includes(filterText));
      const matchGroup = filterGroup ? w.group_id == filterGroup : true;
      return matchProject && matchText && matchGroup;
    });
  }, [workers, activeProjectId, filterText, filterGroup]);

  // Workers grouped by their group name, for the grouped dashboard view.
  // Previously recomputed inside the JSX IIFE on every render.
  const groupedWorkers = React.useMemo(() => {
    const grouped = filteredWorkers.reduce((acc, w) => {
      const g = workerGroups.find(group => group.id === w.group_id);
      const gName = g ? g.name : t('group_report.no_group', 'Grupsuz');
      if (!acc[gName]) acc[gName] = [];
      acc[gName].push(w);
      return acc;
    }, {});
    const sortedNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b, i18n.language || 'tr'));
    return { grouped, sortedNames };
  }, [filteredWorkers, workerGroups, i18n.language, t]);

  const handleExport = (format) => {
    const lang = i18n.language;
    const isTr = lang === 'tr';
    // Headers used to be `isTr ? 'Türkçe' : 'English'`, so the other 17
    // supported locales silently got English column names.
    const dataToExport = filteredWorkers.map(w => ({
      [t('export.full_name', 'Ad Soyad')]: w.full_name,
      [t('export.tc_no', 'TC Kimlik No')]: w.tc_no || '-',
      [t('common.phone', 'Telefon')]: w.phone || '-',
      [t('export.daily_wage', 'Günlük Yevmiye')]: w.daily_wage,
      [t('export.group', 'Grup')]: workerGroups.find(g => g.id === w.group_id)?.name || '-',
      [t('export.project', 'Şantiye')]: projects.find(p => p.id == w.project_id)?.name || '-',
      [t('export.status', 'Durum')]:
        w.status === 'active'
          ? t('export.active', 'Aktif')
          : w.status === 'passive'
            ? t('export.passive', 'Pasif')
            : w.status || '-',
      [t('export.tags', 'Etiketler')]: parseTags(w.tags).join(', ') || '-',
      [t('export.net_balance', 'Net Bakiye')]: balances[w.id] || 0,
      [t('export.start_date', 'İşe Başlama')]: w.start_date,
      [t('export.isg_start', 'İSG Başlangıç')]: w.isg_start_date || '-',
      [t('export.isg_end', 'İSG Bitiş')]: w.isg_bitis_tarihi || '-'
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
          await apiWrite(window.api.system.createSnapshot(), { silent: true });
        }

        // Get a mutable local copy of current worker groups and workers
        let localGroups = [...workerGroups];
        let currentWorkersList = [...workers];
        // Rows the DB rejected must be reported: a silent failure here looks
        // like a complete import while part of the workbook never landed.
        let importFailures = 0;

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
              } else {
                importFailures++;
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

            const updateRes = await apiWrite(
              window.api.db.update('workers', existingWorker.id, updateData),
              { silent: true }
            );
            if (updateRes && updateRes.success === false) importFailures++;

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
            } else {
              importFailures++;
            }
          }
        }
        fetchWorkers();
        if (importFailures > 0) {
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: {
              message: t('common.import_partial', '{{count}} kayıt içe aktarılamadı.').replace('{{count}}', importFailures),
              type: 'warning'
            }
          }));
        }
        setUndoAvailable(true);
        e.target.value = ''; // reset (empty string, not null - keeps the input controlled)
        if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
        undoTimerRef.current = setTimeout(() => setUndoAvailable(false), 15000);
      }
    } catch (err) {
      logError('Worker import failed:', err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('common.error_occurred', 'Hata:') + ' ' + t('common.import_failed', 'İçe aktarma başarısız oldu. Lütfen dosya biçimini kontrol edin.'), type: 'error' } }));
      e.target.value = '';
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
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('dashboard.undo_error', 'Geri alma başarısız oldu:') + ' ' + apiMessage(res), type: 'error' } }));
      }
    }
  };

  const activeProjectObj = projects.find(p => p.id === activeProjectId);

  const getLayoutClass = () => {
    if (sidebarState === 'collapsed') return 'sidebar-collapsed';
    if (sidebarState === 'hidden') return 'sidebar-hidden';
    return '';
  };

  const currentSidebarWidth = sidebarState === 'full' ? sidebarWidth : (sidebarState === 'collapsed' ? 68 : 0);

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
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 8 12 12 7 16"></polyline><polyline points="13 8 18 12 13 16"></polyline></svg>
        </button>
      )}

      <div
        className={`app-layout ${getLayoutClass()} ${isResizing ? 'is-resizing' : ''}`}
        style={{ '--sidebar-width': sidebarState === 'full' ? `${sidebarWidth}px` : undefined }}
      >
        {/* One flat sidebar: brand row, workspace, grouped navigation, footer. */}
        <aside className="sidebar">
          {sidebarState === 'full' && (
            <div
              className={`sidebar-resizer ${isResizing ? 'is-resizing' : ''}`}
              onMouseDown={handleMouseDown}
            />
          )}

          <div className="sidebar-brand">
            <div className="sidebar-brand-identity">
              {sidebarState === 'collapsed' ? (
                <button
                  type="button"
                  className="sidebar-brand-mark"
                  onClick={() => handleSidebarStateChange('full')}
                  title={t('nav.expand', 'Expand')}
                  aria-label={t('nav.expand', 'Expand')}
                  style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <img src={TectonDark} alt="Tecton" className="logo-dark" style={{ width: '22px', height: '22px' }} />
                  <img src={TectonLight} alt="Tecton" className="logo-light" style={{ width: '22px', height: '22px' }} />
                </button>
              ) : (
                <span className="sidebar-brand-mark" aria-hidden="true">
                  <img src={TectonDark} alt="" className="logo-dark" style={{ width: '22px', height: '22px' }} />
                  <img src={TectonLight} alt="" className="logo-light" style={{ width: '22px', height: '22px' }} />
                </span>
              )}
              <span className="brand-text">{t('app.name', 'Tecton')}</span>
            </div>
            <div className="sidebar-brand-actions">
              <button
                type="button"
                className="pp-sidebar-icon-btn"
                onClick={() => handleSidebarStateChange(sidebarState === 'collapsed' ? 'full' : 'collapsed')}
                title={sidebarState === 'collapsed' ? t('nav.expand', 'Expand') : t('nav.collapse', 'Collapse')}
                aria-label={sidebarState === 'collapsed' ? t('nav.expand', 'Expand') : t('nav.collapse', 'Collapse')}
              >
                {sidebarState === 'collapsed' ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
              </button>
              {sidebarState !== 'collapsed' && (
                <button
                  type="button"
                  className="pp-sidebar-icon-btn"
                  onClick={() => handleSidebarStateChange('hidden')}
                  title={t('nav.hide', 'Hide')}
                  aria-label={t('nav.hide', 'Hide')}
                >
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {activeProjectObj ? (
            <div className="sidebar-project" title={activeProjectObj.name}>
              <Building2 size={14} aria-hidden="true" />
              <span>{activeProjectObj.name}</span>
            </div>
          ) : (
            <div className="sidebar-project is-empty">
              <Building2 size={14} aria-hidden="true" />
              <span>{t('nav.no_project_selected', 'No site selected')}</span>
            </div>
          )}

          <nav aria-label={t('nav.main_menu', 'Main menu')}>
            {NAV_GROUPS.map((group) => (
              <div className="nav-group" key={group.id}>
                <span className="nav-group-title">{t(group.labelKey)}</span>
                {group.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = view === item.view
                    || (item.view === 'list' && (view === 'profile' || view === 'list'))
                    || (item.view === 'subcontractor' && (view === 'subcontractor' || view === 'subcontractor_profile'));
                  return (
                    <button
                      key={item.view}
                      type="button"
                      className={`nav-btn ${isActive ? 'is-active' : ''}`}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={() => {
                        setView(item.view);
                        if (item.view === 'list') setSelectedWorkerProfile(null);
                      }}
                    >
                      <ItemIcon size={19} strokeWidth={1.9} />
                      <span className="nav-label">{t(item.labelKey)}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sidebar-footer">
            <div className="sidebar-links">
              <a
                href="https://github.com/emirtdede/tecton"
                target="_blank"
                rel="noreferrer"
                className="sidebar-link-btn"
                title={t('sidebar_github', 'GitHub')}
              >
                <Github size={14} />
                <span>{t('sidebar_github', 'GitHub')}</span>
              </a>
              <a
                href="https://github.com/sponsors/emirtdede"
                target="_blank"
                rel="noreferrer"
                className="sidebar-link-btn"
                title={t('sidebar_sponsor', 'Sponsor')}
              >
                <Heart size={14} />
                <span>{t('sidebar_sponsor', 'Sponsor')}</span>
              </a>
            </div>
          </div>
        </aside>

        {/* Right Dynamic Page View */}
        <main className="main-content">
          <div className="page-x">
          {/* Each view gets its own boundary keyed by `view`, so a crash inside
              one screen is contained and resets automatically when navigating. */}
          <ErrorBoundary key={view} name={`view:${view}`}>
          <Suspense fallback={<div style={{ padding: '2rem', opacity: 0.7 }}>{t('common.loading', 'Yükleniyor...')}</div>}>
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
          ) : view === 'docs' ? (
            <Documentation />
          ) : view === 'legal' ? (
            <LegalNotice />
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
              {activeProjectId && (
                <header className="header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <h1 style={{ margin: 0 }}>{t('dashboard.title')}</h1>
                    <PageGuideIcon onClick={() => setDashboardHelpOpen(true)} fontSize="1.4rem" />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls" 
                      style={{ display: 'none' }} 
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                    />
                    <button className="btn btn-bulk-timesheet" onClick={() => setView('bulk_timesheet')}>
                      {t('dashboard.bulk_timesheet', 'Çoklu Puantaj')}
                    </button>
                    <button className="btn" onClick={() => fileInputRef.current.click()}>
                      {t('dashboard.import_excel')}
                    </button>
                    <button className="btn" onClick={() => generateExcelTemplate(t, i18n.language)}>
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
                <NoProjectNotice titleKey="nav.personnel" titleFallback="Personnel management" />
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
                          ><X size={14} aria-hidden="true" />
                            
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
                        background: 'var(--surface-subtle)', 
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
                            background: viewMode === 'list' ? 'var(--accent-soft)' : 'transparent',
                            border: 'none',
                            color: viewMode === 'list' ? 'var(--text-primary)' : 'var(--text-muted)',
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
                            background: viewMode === 'grid' ? 'var(--accent-soft)' : 'transparent',
                            border: 'none',
                            color: viewMode === 'grid' ? 'var(--text-primary)' : 'var(--text-muted)',
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
                          <h2 className="card-title" style={{ margin: 0 }}>{t('dashboard.no_search_results', 'Arama kriterlerine uygun personel kaydı bulunamadı.')}</h2>
                        ) : (
                          <>
                            <h2 className="card-title">{t('dashboard.empty_state')}</h2>
                            <p className="card-subtitle" style={{ marginTop: '1rem' }}>{t('dashboard.empty_state_sub')}</p>
                          </>
                        )}
                      </div>
                                        ) : (() => {
                      const { grouped, sortedNames } = groupedWorkers;
                      return (
                        <div className="workers-grouped-container" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                          {sortedNames.map((groupName) => (
                            <div key={groupName}>
                              <div className="group-heading">
                                <h3>{groupName}</h3>
                                <span className="pill">
                                  {grouped[groupName].length} {t('group_report.person_count')}
                                </span>
                              </div>
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
                                              style={{ fontWeight: '600', cursor: 'pointer', color: 'var(--text-primary)' }}
                                              onClick={() => openProfile(worker)}
                                            >
                                              {worker.full_name}
                                            </td>
                                            <td>{worker.phone || t('dashboard.phone_not_found')}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                                              {formatCurrency(bal, i18n.language)}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                              <div className="row-actions" onClick={e => e.stopPropagation()}>
                                                <button
                                                  type="button"
                                                  className="icon-btn"
                                                  onClick={() => handleOpenDrawer(worker)}
                                                  title={t('dashboard.edit', 'Düzenle')}
                                                >
                                                  <Pencil size={14} aria-hidden="true" />
                                                </button>
                                                <button
                                                  type="button"
                                                  className="icon-btn is-danger"
                                                  onClick={() => handleDeleteWorker(worker.id)}
                                                  title={t('common.delete', 'Sil')}
                                                >
                                                  <Trash2 size={14} aria-hidden="true" />
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
                                      <div
                                        key={worker.id}
                                        className="glass-card"
                                        role="link"
                                        tabIndex={0}
                                        onClick={() => openProfile(worker)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            openProfile(worker);
                                          }
                                        }}
                                        style={{ cursor: 'pointer', position: 'relative' }}
                                      >
                                        <div className="card-header">
                                          <div>
                                            <h3 className="card-title">{worker.full_name}</h3>
                                            <p className="card-subtitle">{worker.phone || t('dashboard.phone_not_found')}</p>
                                          </div>
                                          <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontWeight: 'bold', color: isPositive ? 'var(--success)' : 'var(--danger)', fontSize: '1.2rem' }}>
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
                  <div className="bento-widgets" style={{ gridColumn: 'span 4', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <AnomalyPanel workers={filteredWorkers} balances={balances} viewMode={viewMode} />
                    <GroupReportPanel activeProjectId={activeProjectId} viewMode={viewMode} />
                  </div>
                </div>
              )}
            </div>
          )}
          </Suspense>
          </ErrorBoundary>
          </div>
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
          background: 'var(--surface)', color: 'var(--text-primary)', padding: '1rem 1.5rem',
          borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          display: 'flex', alignItems: 'center', gap: '1rem',
          border: '1px solid var(--accent)', zIndex: 9999,
          animation: 'fadeIn 0.3s ease-out'
        }}>
          <div>
            <strong>{t('dashboard.import_done', 'Toplu aktarım tamamlandı!')}</strong>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{t('dashboard.import_undo_hint', 'Bir hata yaptıysanız işlemi hemen geri alabilirsiniz.')}</div>
          </div>
          <button onClick={handleUndoImport} style={{
            background: 'var(--danger)', color: 'white', border: 'none', padding: '0.5rem 1rem',
            borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
          }}>
            {t('dashboard.undo_button', 'Geri Al (Undo)')}
          </button>
        </div>
      )}

      <OnboardingWizard open={showWelcomeModal} onClose={() => setShowWelcomeModal(false)} />

      {isShuttingDown && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'var(--canvas)',
          display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
          zIndex: 999999, color: 'var(--text-primary)', fontFamily: 'inherit'
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
