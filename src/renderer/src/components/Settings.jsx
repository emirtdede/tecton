import { useState, useEffect, useRef, useMemo } from 'react';
import SystemLogs from './SystemLogs';
import ConfirmationModal from './ui/ConfirmationModal';
import CustomDatePicker from './ui/CustomDatePicker';
import GuideDrawer from './ui/GuideDrawer';
import { useTranslation } from 'react-i18next';
import { ensureLocale } from '../i18n';
import { GripVertical, Edit2, Check, X, Trash2, RotateCcw, Save, ShieldAlert, Download, FolderOpen, DatabaseZap, Lightbulb } from 'lucide-react';
// Single source of truth: the brand marks live in `tecton_assets/` (shared with
// the window icon, splash screen and installer) - see `npm run brand`.
import { setRegionalSettings } from '../utils/formatUtils';
import { logError } from '../utils/logger';
import apiWrite, { apiMessage } from '../utils/apiWrite';
import PageGuideIcon from './ui/PageGuideIcon';
import { reorderRangeForStart, reorderRangeForEnd } from '../utils/dateRangeUtils';
import Pagination from './ui/Pagination';
import Switch from './ui/Switch';
import AppearancePanel from './settings/AppearancePanel';
import CloudSyncCard from './settings/CloudSyncCard';
import IntegrationsPanel from './settings/IntegrationsPanel';
import AiPanel from './settings/AiPanel';
import { applyAppearance, cacheAppearance } from '../theme/appearance';

/**
 * Payroll inputs that live in the Finance tab. Only the values the calculation
 * engine actually reads are listed here: the tab used to render every row of
 * `app_settings` as a free-text box, which exposed internal keys such as
 * `cloud_last_sync` next to user-facing options.
 */
const FINANCE_PARAMETERS = [
  {
    key: 'standard_daily_hours',
    step: '0.5',
    min: '1',
    max: '24',
    labelKey: 'settings.keys.standard_daily_hours',
    labelFallback: 'Standard daily working hours',
    hintKey: 'settings.standard_daily_hours_hint',
    hintFallback: 'Used to turn a daily wage into an hourly rate.',
  },
  {
    key: 'overtime_multiplier',
    step: '0.1',
    min: '1',
    max: '5',
    labelKey: 'settings.keys.overtime_multiplier',
    labelFallback: 'Overtime rate multiplier',
    hintKey: 'settings.overtime_multiplier_hint',
    hintFallback: 'Hourly pay for overtime, as a multiple of the normal rate.',
  },
];

/** Window lifecycle switches. They map onto the flags the tray menu uses. */
const WINDOW_TOGGLES = [
  { key: 'autostart', labelKey: 'settings.start_with_windows', fallback: 'Launch Tecton when Windows starts' },
  { key: 'start_minimized', labelKey: 'settings.start_minimized', fallback: 'Start hidden in the system tray' },
  { key: 'close_to_tray', labelKey: 'settings.close_to_tray', fallback: 'Keep running in the tray when the window is closed' },
];

const Settings = ({ activeTab = 'genel' }) => {
  const { t, i18n } = useTranslation();
  const [appSettings, setAppSettings] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [workerGroups, setWorkerGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tempCompanyName, setTempCompanyName] = useState('');
  const [tempCompanyLogo, setTempCompanyLogo] = useState('');

  // Form State for new items
  const [newWorkType, setNewWorkType] = useState({ name: '', multiplier: 1.0 });
  const [newGroup, setNewGroup] = useState({ name: '' });

  // Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'danger', onConfirm: () => {} });

  // Inline editing states
  const [editingWorkTypeId, setEditingWorkTypeId] = useState(null);
  const [editingWorkTypeVal, setEditingWorkTypeVal] = useState({ name: '', multiplier: 1.0 });

  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editingGroupVal, setEditingGroupVal] = useState({ name: '' });

  // Drag and drop states
  const [draggedWorkTypeIdx, setDraggedWorkTypeIdx] = useState(null);
  const [dragOverWorkTypeIdx, setDragOverWorkTypeIdx] = useState(null);
  const [draggedGroupIdx, setDraggedGroupIdx] = useState(null);
  const [dragOverGroupIdx, setDragOverGroupIdx] = useState(null);

  // Recycle Bin states
  const [deletedItems, setDeletedItems] = useState([]);
  const [recycleSearch, setRecycleSearch] = useState('');
  const [recycleFilterType, setRecycleFilterType] = useState('');
  const [recycleFilterProject, setRecycleFilterProject] = useState('');
  const [allProjects, setAllProjects] = useState([]);
  const [recycleStartDate, setRecycleStartDate] = useState('');
  const [recycleEndDate, setRecycleEndDate] = useState('');
  const [restoredKeys, setRestoredKeys] = useState([]);
  const [recycleRestoreStatus, setRecycleRestoreStatus] = useState('all');
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [recycleCurrentPage, setRecycleCurrentPage] = useState(1);
  const recycleContainerRef = useRef(null);

  // Guards against stale responses overwriting newer data (rapid tab switches /
  // repeated recycle-bin refreshes).
  const deletedRequestIdRef = useRef(0);
  const dataRequestIdRef = useRef(0);

  const fetchDeleted = async () => {
    const requestId = ++deletedRequestIdRef.current;
    if (window.api && window.api.db && window.api.db.readDeleted) {
      const items = await window.api.db.readDeleted();
      if (requestId !== deletedRequestIdRef.current) return;
      setDeletedItems(items || []);
    }
    if (window.api && window.api.db && window.api.db.readAllProjects) {
      const projs = await window.api.db.readAllProjects();
      if (requestId !== deletedRequestIdRef.current) return;
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
              message: t('recycle.restore_error', 'Geri yükleme hatası:') + ' ' + apiMessage(res),
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
    const [start, end] = reorderRangeForStart(e.target.value, recycleEndDate);
    setRecycleStartDate(start);
    setRecycleEndDate(end);
  };

  const handleEndDateChange = (e) => {
    const [start, end] = reorderRangeForEnd(e.target.value, recycleStartDate);
    setRecycleStartDate(start);
    setRecycleEndDate(end);
  };

  useEffect(() => {
    if (activeTab === 'recycle') {
      setRestoredKeys([]);
      setRecycleSearch('');
      setRecycleFilterType('');
      setRecycleFilterProject('');
      setRecycleStartDate('');
      setRecycleEndDate('');
      setRecycleRestoreStatus('all');
      setIsGuideOpen(false);
      setRecycleCurrentPage(1);
      fetchDeleted();
    }
  }, [activeTab]);

  useEffect(() => {
    if (recycleContainerRef.current) {
      recycleContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [recycleCurrentPage]);

  useEffect(() => {
    setRecycleCurrentPage(1);
  }, [recycleSearch, recycleFilterType, recycleFilterProject, recycleStartDate, recycleEndDate, recycleRestoreStatus]);

  const fetchData = async () => {
    if (!window.api) return;
    const requestId = ++dataRequestIdRef.current;
    setLoading(true);
    try {
      // Independent reads: issuing them together removes two serial round-trips.
      const [settingsData, typesData, groupsData] = await Promise.all([
        window.api.db.read('app_settings'),
        window.api.db.read('work_types'),
        window.api.db.read('worker_groups')
      ]);

      // Drop stale results if a newer fetch already started.
      if (requestId !== dataRequestIdRef.current) return;

      const safeSettings = Array.isArray(settingsData) ? settingsData : [];
      setAppSettings(safeSettings);

      const nameSetting = safeSettings.find(s => s.setting_key === 'company_name');
      const logoSetting = safeSettings.find(s => s.setting_key === 'company_logo');
      if (nameSetting) setTempCompanyName(nameSetting.setting_value || '');
      if (logoSetting) setTempCompanyLogo(logoSetting.setting_value || '');

      setWorkTypes(Array.isArray(typesData) ? typesData : []);
      setWorkerGroups(Array.isArray(groupsData) ? groupsData : []);
    } catch (err) {
      // Previously an IPC rejection escaped as an unhandled rejection and left
      // the settings screen on a permanent skeleton.
      if (requestId !== dataRequestIdRef.current) return;
      logError('Settings data fetch failed:', err);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('settings.load_error', 'Ayarlar yüklenemedi.'), type: 'error' }
      }));
    } finally {
      if (requestId === dataRequestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // The surface the appearance preview should render against. `system` follows
  // the OS at the moment the panel renders; the engine re-applies on OS flips.
  const appearanceSurface = useMemo(() => {
    const mode = appSettings.find((s) => s.setting_key === 'theme')?.setting_value || 'dark';
    if (mode === 'system') {
      try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      } catch {
        return 'dark';
      }
    }
    return mode === 'light' ? 'light' : 'dark';
  }, [appSettings]);

  /**
   * Applies the current appearance rows to the document, optionally with one
   * value overridden (the click that triggered the change).
   */
  const applyCurrentAppearance = (overrides = {}) => {
    const read = (key, fallback) => {
      if (Object.prototype.hasOwnProperty.call(overrides, key)) return overrides[key];
      const row = appSettings.find((s) => s.setting_key === key);
      return row && row.setting_value !== undefined ? row.setting_value : fallback;
    };
    const next = {
      mode: read('theme', 'dark'),
      themeId: read('theme_id', 'obsidian'),
      customColor: read('custom_theme_color', 'var(--accent)'),
      appIcon: read('app_icon', 'auto'),
      iconColor: read('app_icon_color', 'var(--accent)'),
      zoom: read('ui_zoom', 1),
      highContrast: read('a11y_high_contrast', 'false') === 'true',
      enhancedFocus: read('a11y_enhanced_focus', 'false') === 'true',
      readableSpacing: read('a11y_readable_spacing', 'false') === 'true',
      reduceMotion: read('a11y_reduce_motion', 'false') === 'true',
    };
    const applied = applyAppearance(next);
    cacheAppearance(applied.appearance);
    // Keep the tray, taskbar and shortcut icon in step with the surface.
    window.api?.platform?.applyIcon?.(applied.surface)?.catch?.(() => {});
    return applied;
  };

  // Update App Settings
  const handleSettingChange = async (id, key, value) => {
    if (key === 'standard_daily_hours') {
      // Local state update allows intermediate states (e.g. empty, "-", "0")
      setAppSettings(prev => prev.map(s => s.id === id ? { ...s, setting_value: value } : s));
      
      const numVal = Number(value);
      if (!isNaN(numVal) && numVal > 0) {
        if (window.api) {
          await apiWrite(window.api.db.update('app_settings', id, { setting_value: value }));
        }
      }
      return;
    }

    if (window.api) {
      // Optimistic update: the UI reflects the new value immediately.
      // If the write is rejected the previous value is restored, otherwise the
      // screen would keep showing a setting that was never persisted.
      const previous = appSettings.find(s => s.id === id)?.setting_value;
      setAppSettings(prev => prev.map(s => s.id === id ? { ...s, setting_value: value } : s));
      const res = await apiWrite(window.api.db.update('app_settings', id, { setting_value: value }));
      if (res && res.success === false) {
        if (previous !== undefined) {
          setAppSettings(prev => prev.map(s => s.id === id ? { ...s, setting_value: previous } : s));
        }
        return;
      }

      if (key === 'theme' || key === 'theme_id' || key === 'custom_theme_color' || key === 'app_icon' || key === 'app_icon_color' || key === 'ui_zoom' || key.startsWith('a11y_')) {
        applyCurrentAppearance({ [key]: value });
      }
      if (key === 'language') {
        // Lazy chunk: load the dictionary before activating it.
        i18n.changeLanguage(await ensureLocale(value));
        setRegionalSettings({ language: value });
      }
      if (key === 'custom_currency') {
        setRegionalSettings({ currency: value });
      }
      if (key === 'custom_date_format') {
        setRegionalSettings({ dateFormat: value });
      }
      if (key === 'custom_time_format') {
        setRegionalSettings({ timeFormat: value });
      }
    }
  };

  const handleSettingBlur = async (id, key, value) => {
    if (key === 'standard_daily_hours') {
      const numVal = Number(value);
      if (isNaN(numVal) || numVal <= 0) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.hours_zero_error', 'Çalışma saati 0 veya daha küçük olamaz.'), type: 'error' } }));
        
        if (window.api) {
          const settingsData = await window.api.db.read('app_settings');
          const dbSetting = settingsData.find(s => s.id === id);
          const fallbackValue = dbSetting && Number(dbSetting.setting_value) > 0 ? dbSetting.setting_value : "8";
          setAppSettings(prev => prev.map(s => s.id === id ? { ...s, setting_value: fallbackValue } : s));
        }
      }
    }
  };

  const handleLogoUpload = async (id, file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onerror = () => {
      logError('Company logo read failed:', reader.error);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('settings.logo_read_error', 'Logo dosyası okunamadı.'), type: 'error' }
      }));
    };
    reader.onload = async (e) => {
      const base64Img = e.target.result;

      const img = new Image();
      // Handlers must be attached before `src`: a cached data URL can fire
      // `load` synchronously and the resize would never run.
      img.onerror = () => {
        logError('Company logo decode failed.');
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: t('settings.logo_decode_error', 'Logo görseli açılamadı. Lütfen geçerli bir PNG/JPG dosyası seçin.'), type: 'error' }
        }));
      };
      img.onload = async () => {
        // A zero-width image (corrupt file, unsupported SVG) made scaleSize
        // Infinity and canvas.height NaN, which then threw from toDataURL.
        if (!img.width || !img.height) {
          logError('Company logo has zero dimensions; skipping resize.');
          return;
        }
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = Math.max(1, Math.round(img.height * scaleSize));

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          logError('Company logo canvas context unavailable.');
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const resizedBase64 = canvas.toDataURL('image/png');
        setTempCompanyLogo(resizedBase64);
      };
      img.src = base64Img;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async (id) => {
    setTempCompanyLogo('');
  };

  const handleSaveCompanyInfo = async () => {
    if (window.api) {
      const nameSetting = appSettings.find(s => s.setting_key === 'company_name');
      const logoSetting = appSettings.find(s => s.setting_key === 'company_logo');
      
      if (nameSetting) {
        const res = await apiWrite(window.api.db.update('app_settings', nameSetting.id, { setting_value: tempCompanyName }));
        if (res && res.success === false) return;
      }
      if (logoSetting) {
        const res = await apiWrite(window.api.db.update('app_settings', logoSetting.id, { setting_value: tempCompanyLogo }));
        if (res && res.success === false) return;
      }

      setAppSettings(prev => prev.map(s => {
        if (s.setting_key === 'company_name') return { ...s, setting_value: tempCompanyName };
        if (s.setting_key === 'company_logo') return { ...s, setting_value: tempCompanyLogo };
        return s;
      }));

      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { 
          message: t('settings.company_info_saved', 'Şirket bilgileri başarıyla kaydedildi.'), 
          type: 'success' 
        } 
      }));
    }
  };

  // Add new Work Type
  const handleAddWorkType = async (e) => {
    e.preventDefault();
    if (window.api && newWorkType.name) {
      await apiWrite(window.api.db.create('work_types', newWorkType));
      setNewWorkType({ name: '', multiplier: 1.0 });
      fetchData();
    }
  };

  // Delete Work Type
  const handleDeleteWorkType = async (id) => {
    setModalConfig({
      isOpen: true,
      title: t('settings.delete_work_type_title', 'Çalışma Tipini Sil'),
      message: t('settings.delete_work_type_msg', 'Bu çalışma tipini silmek istediğinize emin misiniz? Eski puantajlardaki hesaplamalar veritabanına kaydedildiği için geçmiş verileriniz bozulmayacaktır.'),
      type: 'danger',
      onConfirm: async () => {
        await apiWrite(window.api.db.delete('work_types', id));
        fetchData();
      }
    });
  };

  // Add new Worker Group
  const handleAddGroup = async (e) => {
    e.preventDefault();
    if (window.api && newGroup.name) {
      await apiWrite(window.api.db.create('worker_groups', newGroup));
      setNewGroup({ name: '' });
      fetchData();
    }
  };

  // Delete Worker Group
  const handleDeleteGroup = async (id) => {
    setModalConfig({
      isOpen: true,
      title: t('settings.delete_group_title', 'İşçi Grubunu Sil'),
      message: t('settings.delete_group_msg', 'Bu grubu silmek istediğinize emin misiniz? Gruptaki işçilerin grup atamaları kaldırılacaktır (İşçiler silinmez).'),
      type: 'danger',
      onConfirm: async () => {
        await apiWrite(window.api.db.delete('worker_groups', id));
        fetchData();
      }
    });
  };

  // Reordering & Sorting helpers
  const saveCustomOrder = async (key, orderArray) => {
    if (window.api) {
      const orderString = JSON.stringify(orderArray);
      const existing = appSettings.find(s => s.setting_key === key);
      if (existing) {
        await handleSettingChange(existing.id, key, orderString);
      } else {
        // Routed through apiWrite like the update branch above: a raw call here
        // meant a rejected INSERT (constraint, locked DB) silently dropped the
        // drag-and-drop reordering the user had just performed.
        const res = await apiWrite(window.api.db.create('app_settings', {
          setting_key: key,
          setting_value: orderString,
          description: t('settings.sort_order_description', 'Sıralama Düzeni')
        }));
        if (res && res.success !== false) {
          fetchData();
        }
      }
    }
  };

  const getSortedItems = (items, orderKey) => {
    const orderSetting = appSettings.find(s => s.setting_key === orderKey);
    if (!orderSetting || !orderSetting.setting_value) return items;
    try {
      const orderIds = JSON.parse(orderSetting.setting_value);
      return [...items].sort((a, b) => {
        const indexA = orderIds.indexOf(a.id);
        const indexB = orderIds.indexOf(b.id);
        if (indexA === -1 && indexB === -1) return 0;
        if (indexA === -1) return 1;
        if (indexB === -1) return -1;
        return indexA - indexB;
      });
    } catch (e) {
      return items;
    }
  };

  const handleMoveItem = async (items, index, direction, orderKey) => {
    const newItems = [...items];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    
    const temp = newItems[index];
    newItems[index] = newItems[targetIndex];
    newItems[targetIndex] = temp;
    
    const newOrderIds = newItems.map(item => item.id);
    await saveCustomOrder(orderKey, newOrderIds);
  };

  // Edit Handlers for Work Types
  const startEditWorkType = (wt) => {
    setEditingWorkTypeId(wt.id);
    setEditingWorkTypeVal({ name: wt.name, multiplier: wt.multiplier });
  };

  const handleSaveWorkTypeEdit = async (id) => {
    if (window.api && editingWorkTypeVal.name) {
      await apiWrite(window.api.db.update('work_types', id, editingWorkTypeVal));
      setEditingWorkTypeId(null);
      fetchData();
    }
  };

  const handleCancelWorkTypeEdit = () => {
    setEditingWorkTypeId(null);
  };

  // Edit Handlers for Groups
  const startEditGroup = (grp) => {
    setEditingGroupId(grp.id);
    setEditingGroupVal({ name: grp.name });
  };

  const handleSaveGroupEdit = async (id) => {
    if (window.api && editingGroupVal.name) {
      await apiWrite(window.api.db.update('worker_groups', id, editingGroupVal));
      setEditingGroupId(null);
      fetchData();
    }
  };

  const handleCancelGroupEdit = () => {
    setEditingGroupId(null);
  };

  const sortedWorkTypes = useMemo(
    () => getSortedItems(workTypes, 'work_types_order'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workTypes, appSettings]
  );
  const sortedWorkerGroups = useMemo(
    () => getSortedItems(workerGroups, 'worker_groups_order'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [workerGroups, appSettings]
  );

  // Recycle-bin list: filter + paginate moved out of the render IIFE and memoized.
  const filteredDeletedItems = useMemo(() => {
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
    const q = recycleSearch ? recycleSearch.toLowerCase() : '';
    const start = recycleStartDate ? new Date(recycleStartDate) : null;
    if (start) start.setHours(0, 0, 0, 0);
    const end = recycleEndDate ? new Date(recycleEndDate) : null;
    if (end) end.setHours(23, 59, 59, 999);

    return deletedItems.filter(item => {
      const typeLabel = typeTranslationMap[item.table] || item.table;
      const formattedDate = item.deleted_at ? new Date(item.deleted_at).toLocaleString() : '';
      const itemKey = `${item.table}_${item.id}`;
      const isRestored = item.is_deleted === 0 || restoredKeys.includes(itemKey);

      if (recycleRestoreStatus === 'only_deleted' && isRestored) return false;
      if (recycleRestoreStatus === 'only_restored' && !isRestored) return false;
      if (recycleFilterType && item.table !== recycleFilterType) return false;
      if (recycleFilterProject && String(item.project_id) !== String(recycleFilterProject)) return false;
      if (start && new Date(item.deleted_at) < start) return false;
      if (end && new Date(item.deleted_at) > end) return false;

      if (q) {
        const matchType = typeLabel.toLowerCase().includes(q);
        const matchTitle = (item.title || '').toLowerCase().includes(q);
        const matchDate = formattedDate.toLowerCase().includes(q);
        const matchProject = (item.project_name || '').toLowerCase().includes(q);
        return matchType || matchTitle || matchDate || matchProject;
      }
      return true;
    });
  }, [
    deletedItems, restoredKeys, recycleRestoreStatus, recycleFilterType,
    recycleFilterProject, recycleStartDate, recycleEndDate, recycleSearch, t
  ]);

  const handleBackup = async () => {
    if (window.api) {
      const res = await window.api.system.backupDB();
      if (res.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.backup_success', 'Yedekleme başarıyla tamamlandı!'), type: 'success' } }));
      } else if (res.messageKey !== 'errors.operation_cancelled') {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.backup_error', 'Yedekleme Hatası:') + ' ' + apiMessage(res), type: 'error' } }));
      }
    }
  };

  const handleVacuum = async () => {
    setModalConfig({
      isOpen: true,
      title: t('settings.vacuum_db', 'Sistemi Optimize Et'),
      message: t('settings.vacuum_desc', 'Veritabanı vakumlanarak silinmiş kayıtların kapladığı boşluklar geri kazanılacaktır. Bu işlem sistem hızınızı artırır.'),
      type: 'primary',
      onConfirm: async () => {
        if (window.api && window.api.system.vacuumDB) {
          const res = await window.api.system.vacuumDB();
          if (res.success) window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.optimize_success', 'Veritabanı başarıyla optimize edildi.'), type: 'success' } }));
          else window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.optimize_error', 'Optimizasyon Hatası:') + ' ' + apiMessage(res), type: 'error' } }));
        }
      }
    });
  };

  const handleCloudSyncFolder = async () => {
    if (window.api && window.api.system.setCloudFolder) {
      const res = await window.api.system.setCloudFolder();
      if (res.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.cloud_folder_success', 'Sessiz bulut yedekleme klasörü başarıyla ayarlandı:') + '\n' + res.folderPath, type: 'success' } }));
        fetchData();
      } else if (res.messageKey !== 'errors.operation_cancelled') {
        // The user closing the OS folder picker is not an error (same rule as
        // handleBackup); anything else must be surfaced instead of swallowed.
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.cloud_folder_error', 'Klasör ayarlanamadı:') + ' ' + apiMessage(res), type: 'error' } }));
      }
    }
  };

  const handleDesktopIconChange = async (theme) => {
    if (window.api && window.api.system.changeDesktopIcon) {
      const res = await window.api.system.changeDesktopIcon({ theme });
      if (res.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.icon_change_success', 'Masaüstü kısayol ikonu başarıyla değiştirildi. (Değişikliğin yansıması birkaç saniye sürebilir)'), type: 'success' } }));
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.icon_change_error', 'İkon değiştirme hatası: ') + apiMessage(res), type: 'error' } }));
      }
    }
  };

  const handleOpenOldBackups = async () => {
    if (window.api && window.api.system.openOldBackupsFolder) {
      await apiWrite(window.api.system.openOldBackupsFolder());
    }
  };

  if (loading) {
    return <div className="text-center"><div className="loading-spinner"></div></div>;
  }

  return (
    <div className="settings-page">
      <header className="page-head">
        <h1 className="page-head-title">
          {activeTab === 'genel' ? t('nav.settings_genel', 'Genel Ayarlar') :
           activeTab === 'finance' ? t('nav.settings_finance', 'Finans & Operasyon') :
           activeTab === 'security' ? t('nav.settings_security', 'Güvenlik ve Yedekleme') :
           activeTab === 'integrations' ? t('nav.settings_integrations', 'Entegrasyonlar') :
           activeTab === 'ai' ? t('nav.settings_ai', 'Yapay Zeka') :
           activeTab === 'recycle' ? t('recycle.title', 'Geri Dönüşüm & Çöp Kutusu') :
           t('nav.settings_logs', 'Sistem Kayıtları')}
        </h1>
        {activeTab === 'finance' && (
          <PageGuideIcon onClick={() => setIsGuideOpen(true)} />
        )}
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {activeTab === 'genel' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <AppearancePanel
              settings={appSettings}
              onChange={handleSettingChange}
              surface={appearanceSurface}
            />

            {/* Pencere ve Başlatma */}
            <div className="glass-card">
              <h3 className="card-title" style={{ marginBottom: '0.5rem' }}>
                {t('settings.window_startup', 'Window and startup')}
              </h3>
              <div className="toggle-list">
                {WINDOW_TOGGLES.map(({ key, labelKey, fallback }) => {
                  const setting = appSettings.find(s => s.setting_key === key);
                  if (!setting) return null;
                  const label = t(labelKey, fallback);
                  const enabled = setting.setting_value === 'true';
                  return (
                    <label key={key} className="toggle-row">
                      <span>{label}</span>
                      <Switch
                        checked={enabled}
                        label={label}
                        onChange={async (event) => {
                          const next = event.target.checked;
                          // Starting with Windows is a registry entry, not only a
                          // database flag, so the main process has to apply it.
                          if (key === 'autostart' && window.api?.platform?.setStartWithWindows) {
                            setAppSettings(prev => prev.map(s => s.id === setting.id ? { ...s, setting_value: next ? 'true' : 'false' } : s));
                            const res = await apiWrite(window.api.platform.setStartWithWindows(next));
                            if (res && res.success === false) {
                              setAppSettings(prev => prev.map(s => s.id === setting.id ? { ...s, setting_value: next ? 'false' : 'true' } : s));
                            }
                            return;
                          }
                          handleSettingChange(setting.id, key, next ? 'true' : 'false');
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>


            {/* Bölgesel Format Ayarları */}
            <div className="glass-card">
              <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>{t('settings.regionalFormatSettings', 'Bölgesel Format Ayarları')}</h3>
              
              {appSettings.some(s => s.setting_key === 'custom_currency') ? (
                <>
                  {/* Para Birimi */}
                  {appSettings.map(setting => {
                    if (setting.setting_key === 'custom_currency') {
                      return (
                        <div key={setting.id} className="form-group" style={{ marginBottom: '1rem' }}>
                          <label className="form-label">{t('settings.currencySelection', 'Para Birimi Seçimi')}</label>
                          <select 
                            className="form-input" 
                            value={setting.setting_value}
                            onChange={(e) => handleSettingChange(setting.id, setting.setting_key, e.target.value)}
                          >
                            <option value="auto">{t('settings.autoByLanguage', 'Otomatik (Dile Göre)')}</option>
                            <option value="TRY">TRY (₺)</option>
                            <option value="USD">USD ($)</option>
                            <option value="EUR">EUR (€)</option>
                            <option value="GBP">GBP (£)</option>
                            <option value="CNY">CNY (¥)</option>
                            <option value="JPY">JPY (¥)</option>
                            <option value="KRW">KRW (₩)</option>
                            <option value="RUB">RUB (₽)</option>
                            <option value="SAR">SAR (SR)</option>
                            <option value="AED">AED (د.إ)</option>
                            <option value="EGP">EGP (ج.م)</option>
                            <option value="INR">INR (₹)</option>
                            <option value="BRL">BRL (R$)</option>
                            <option value="SEK">SEK (kr)</option>
                            <option value="NOK">NOK (kr)</option>
                            <option value="DKK">DKK (kr)</option>
                            <option value="PLN">PLN (zł)</option>
                            <option value="CZK">CZK (Kč)</option>
                          </select>
                        </div>
                      );
                    }
                    return null;
                  })}

                  {/* Tarih Formatı */}
                  {appSettings.map(setting => {
                    if (setting.setting_key === 'custom_date_format') {
                      return (
                        <div key={setting.id} className="form-group" style={{ marginBottom: '1rem' }}>
                          <label className="form-label">{t('settings.dateFormatSelection', 'Tarih Formatı Seçimi')}</label>
                          <select 
                            className="form-input" 
                            value={setting.setting_value}
                            onChange={(e) => handleSettingChange(setting.id, setting.setting_key, e.target.value)}
                          >
                            <option value="auto">{t('settings.autoByLanguage', 'Otomatik (Dile Göre)')}</option>
                            <option value="DD.MM.YYYY">DD.MM.YYYY (01.01.2000)</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD (2000-01-01)</option>
                            <option value="MM/DD/YYYY">MM/DD/YYYY (01/01/2000)</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY (01/01/2000)</option>
                            <option value="DD-MM-YYYY">DD-MM-YYYY (01-01-2000)</option>
                            <option value="YYYY/MM/DD">YYYY/MM/DD (2000/01/01)</option>
                            <option value="YYYY.MM.DD">YYYY.MM.DD (2000.01.01)</option>
                          </select>
                        </div>
                      );
                    }
                    return null;
                  })}

                  {/* Saat Formatı */}
                  {appSettings.map(setting => {
                    if (setting.setting_key === 'custom_time_format') {
                      return (
                        <div key={setting.id} className="form-group">
                          <label className="form-label">{t('settings.timeFormatSelection', 'Saat Formatı Seçimi')}</label>
                          <select 
                            className="form-input" 
                            value={setting.setting_value}
                            onChange={(e) => handleSettingChange(setting.id, setting.setting_key, e.target.value)}
                          >
                            <option value="auto">{t('settings.autoByLanguage', 'Otomatik (Dile Göre)')}</option>
                            <option value="24h">{t('settings.time24h', '24 Saat (18:30)')}</option>
                            <option value="12h">{t('settings.time12h', '12 Saat AM/PM (06:30 PM)')}</option>
                          </select>
                        </div>
                      );
                    }
                    return null;
                  })}
                </>
              ) : (
                <div className="skeleton" style={{ height: '150px', borderRadius: '12px' }}></div>
              )}
            </div>

            {/* Şirket Kimliği ve PDF Anteti */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <h3 className="card-title" style={{ margin: 0 }}>{t('settings.company_info', 'Şirket Kimliği & PDF Anteti')}</h3>
              
              {appSettings.map(setting => {
                if (setting.setting_key === 'company_name') {
                  return (
                    <div key={setting.id} className="form-group" style={{ margin: 0 }}>
                      <label className="form-label">{t('settings.company_name', 'Şirket / Kurum Adı')}</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder={t('settings.company_name_placeholder', 'Örn: ABC İnşaat A.Ş.')}
                        value={tempCompanyName}
                        onChange={(e) => setTempCompanyName(e.target.value)}
                      />
                    </div>
                  );
                }
                if (setting.setting_key === 'company_logo') {
                  return (
                    <div key={setting.id} className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: 0 }}>
                      <label className="form-label">{t('settings.company_logo', 'Şirket Logosu')}</label>
                      {tempCompanyLogo && (
                        <div style={{ position: 'relative', display: 'inline-block', alignSelf: 'flex-start' }}>
                          <img 
                            src={tempCompanyLogo} 
                            alt={t('common.company_logo', 'Şirket logosu')} 
                            style={{ maxWidth: '150px', maxHeight: '100px', objectFit: 'contain', background: 'var(--surface-subtle)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }} 
                          />
                          <button 
                            type="button"
                            className="btn btn-danger"
                            style={{ position: 'absolute', top: '-10px', right: '-10px', width: '24px', height: '24px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            onClick={() => handleRemoveLogo(setting.id)}
                          ><X size={14} aria-hidden="true" />
                            
                          </button>
                        </div>
                      )}
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <label 
                          htmlFor={`logo-upload-input-${setting.id}`}
                          className="btn"
                          style={{ cursor: 'pointer', margin: 0 }}
                        >
                           {t('settings.file_select_button')}
                        </label>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {tempCompanyLogo ? t('settings.logo_uploaded', 'Logo yüklendi') : t('settings.file_not_selected')}
                        </span>
                        <input 
                          id={`logo-upload-input-${setting.id}`}
                          type="file" 
                          accept="image/png, image/jpeg" 
                          style={{ display: 'none' }}
                          onChange={(e) => handleLogoUpload(setting.id, e.target.files[0])}
                        />
                      </div>
                    </div>
                  );
                }
                return null;
              })}

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={handleSaveCompanyInfo}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem' }}
                >
                  <Save size={16} /> {t('settings.company_info_save_btn', 'Kaydet')}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'finance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Standart Çalışma Parametreleri */}
            <div className="glass-card">
              <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>{t('settings.parameters')}</h3>
              <div className="form-grid-2">
                {FINANCE_PARAMETERS.map(({ key, step, min, max, labelKey, labelFallback, hintKey, hintFallback }) => {
                  const setting = appSettings.find(s => s.setting_key === key);
                  if (!setting) return null;
                  return (
                    <div key={key} className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor={`finance-${key}`}>
                        {t(labelKey, labelFallback)}
                      </label>
                      <input
                        id={`finance-${key}`}
                        type="number"
                        inputMode="decimal"
                        className="form-input"
                        step={step}
                        min={min}
                        max={max}
                        value={setting.setting_value}
                        onChange={(e) => handleSettingChange(setting.id, key, e.target.value)}
                        onBlur={(e) => handleSettingBlur(setting.id, key, e.target.value)}
                      />
                      <p className="form-hint">{t(hintKey, hintFallback)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Çalışma Tipleri */}
            <div className="glass-card">
              <h3 className="card-title" style={{ marginBottom: '1rem' }}>{t('settings.work_types_title', 'Çalışma Tipleri & Çarpanlar')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {sortedWorkTypes.map((wt, idx) => {
                  const isEditing = editingWorkTypeId === wt.id;
                  return (
                    <div 
                      key={wt.id} 
                      draggable={!isEditing}
                      onDragStart={(e) => {
                        setDraggedWorkTypeIdx(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverWorkTypeIdx !== idx) {
                          setDragOverWorkTypeIdx(idx);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverWorkTypeIdx === idx) {
                          setDragOverWorkTypeIdx(null);
                        }
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        if (draggedWorkTypeIdx === null || draggedWorkTypeIdx === idx) {
                          setDraggedWorkTypeIdx(null);
                          setDragOverWorkTypeIdx(null);
                          return;
                        }
                        const reordered = [...sortedWorkTypes];
                        const item = reordered[draggedWorkTypeIdx];
                        reordered.splice(draggedWorkTypeIdx, 1);
                        reordered.splice(idx, 0, item);
                        const newOrderIds = reordered.map(x => x.id);
                        await saveCustomOrder('work_types_order', newOrderIds);
                        setDraggedWorkTypeIdx(null);
                        setDragOverWorkTypeIdx(null);
                      }}
                      onDragEnd={() => {
                        setDraggedWorkTypeIdx(null);
                        setDragOverWorkTypeIdx(null);
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: draggedWorkTypeIdx === idx 
                          ? 'rgba(99, 102, 241, 0.08)' 
                          : 'var(--surface-subtle)',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        border: draggedWorkTypeIdx === idx
                          ? '1px dashed var(--primary, #6366f1)'
                          : dragOverWorkTypeIdx === idx
                            ? '1px solid var(--primary, #6366f1)'
                            : '1px solid var(--glass-border)',
                        gap: '1rem',
                        cursor: isEditing ? 'default' : 'grab',
                        opacity: draggedWorkTypeIdx === idx ? 0.5 : 1,
                        transform: draggedWorkTypeIdx !== null && dragOverWorkTypeIdx === idx && draggedWorkTypeIdx !== idx
                          ? `scale(1.01) ${draggedWorkTypeIdx < idx ? 'translateY(2px)' : 'translateY(-2px)'}`
                          : 'scale(1) translateY(0)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '1rem', flex: 1, alignItems: 'center' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ flex: 2, padding: '0.4rem 0.75rem' }} 
                            value={editingWorkTypeVal.name} 
                            onChange={e => setEditingWorkTypeVal(prev => ({ ...prev, name: e.target.value }))}
                          />
                          <input 
                            type="number" 
                            step="0.1" 
                            className="form-input" 
                            style={{ flex: 1, padding: '0.4rem 0.75rem' }} 
                            value={editingWorkTypeVal.multiplier} 
                            onChange={e => {
                              const raw = e.target.value;
                              // Empty/partial input yields '' (kept controlled);
                              // anything non-numeric becomes NaN and would be
                              // written to the DB as an invalid multiplier.
                              setEditingWorkTypeVal(prev => ({
                                ...prev,
                                multiplier: raw === '' ? '' : (Number.isNaN(Number(raw)) ? prev.multiplier : Number(raw))
                              }));
                            }}
                          />
                          <button onClick={() => handleSaveWorkTypeEdit(wt.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelWorkTypeEdit}
                            className="btn"
                            aria-label={t('common.cancel', 'İptal')}
                            title={t('common.cancel', 'İptal')}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                            <GripVertical size={16} style={{ color: 'var(--text-muted)', opacity: 0.6, cursor: 'grab', flexShrink: 0 }} />
                            <div>
                              <strong>{wt.name}</strong>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('settings.multiplier_label', 'Çarpan: x{{value}}', { value: wt.multiplier })}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button 
                              type="button"
                              onClick={() => startEditWorkType(wt)} 
                              className="btn" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDeleteWorkType(wt.id)} 
                              className="btn btn-danger" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
              
              <form onSubmit={handleAddWorkType} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
                <div style={{ flex: 2 }}>
                  <label className="form-label">{t('settings.type_name_label', 'Çalışma Tipi Adı')}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newWorkType.name}
                    onChange={e => setNewWorkType(prev => ({...prev, name: e.target.value}))}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label className="form-label">{t('multiplier', 'Çarpan')}</label>
                  <input 
                    type="number" 
                    step="0.1"
                    className="form-input" 
                    value={newWorkType.multiplier}
                    onChange={e => {
                      const raw = e.target.value;
                      setNewWorkType(prev => ({
                        ...prev,
                        multiplier: raw === '' ? '' : (Number.isNaN(Number(raw)) ? prev.multiplier : Number(raw))
                      }));
                    }}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }}>{t('settings.add', 'Ekle')}</button>
              </form>
            </div>

            {/* Gruplar */}
            <div className="glass-card">
              <h3 className="card-title" style={{ marginBottom: '1rem' }}>{t('settings.groups_title', 'İşçi Grupları')}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
                {sortedWorkerGroups.map((grp, idx) => {
                  const isEditing = editingGroupId === grp.id;
                  return (
                    <div 
                      key={grp.id} 
                      draggable={!isEditing}
                      onDragStart={(e) => {
                        setDraggedGroupIdx(idx);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverGroupIdx !== idx) {
                          setDragOverGroupIdx(idx);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverGroupIdx === idx) {
                          setDragOverGroupIdx(null);
                        }
                      }}
                      onDrop={async (e) => {
                        e.preventDefault();
                        if (draggedGroupIdx === null || draggedGroupIdx === idx) {
                          setDraggedGroupIdx(null);
                          setDragOverGroupIdx(null);
                          return;
                        }
                        const reordered = [...sortedWorkerGroups];
                        const item = reordered[draggedGroupIdx];
                        reordered.splice(draggedGroupIdx, 1);
                        reordered.splice(idx, 0, item);
                        const newOrderIds = reordered.map(x => x.id);
                        await saveCustomOrder('worker_groups_order', newOrderIds);
                        setDraggedGroupIdx(null);
                        setDragOverGroupIdx(null);
                      }}
                      onDragEnd={() => {
                        setDraggedGroupIdx(null);
                        setDragOverGroupIdx(null);
                      }}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: draggedGroupIdx === idx 
                          ? 'rgba(99, 102, 241, 0.08)' 
                          : 'var(--surface-subtle)',
                        padding: '0.75rem 1rem',
                        borderRadius: '8px',
                        border: draggedGroupIdx === idx
                          ? '1px dashed var(--primary, #6366f1)'
                          : dragOverGroupIdx === idx
                            ? '1px solid var(--primary, #6366f1)'
                            : '1px solid var(--glass-border)',
                        gap: '1rem',
                        cursor: isEditing ? 'default' : 'grab',
                        opacity: draggedGroupIdx === idx ? 0.5 : 1,
                        transform: draggedGroupIdx !== null && dragOverGroupIdx === idx && draggedGroupIdx !== idx
                          ? `scale(1.01) ${draggedGroupIdx < idx ? 'translateY(2px)' : 'translateY(-2px)'}`
                          : 'scale(1) translateY(0)',
                        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: 'flex', gap: '1rem', flex: 1, alignItems: 'center' }}>
                          <input 
                            type="text" 
                            className="form-input" 
                            style={{ flex: 1, padding: '0.4rem 0.75rem' }} 
                            value={editingGroupVal.name} 
                            onChange={e => setEditingGroupVal(prev => ({ ...prev, name: e.target.value }))}
                          />
                          <button onClick={() => handleSaveGroupEdit(grp.id)} className="btn btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>
                            <Check size={14} />
                          </button>
                          <button
                            onClick={handleCancelGroupEdit}
                            className="btn"
                            aria-label={t('common.cancel', 'İptal')}
                            title={t('common.cancel', 'İptal')}
                            style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                            <GripVertical size={16} style={{ color: 'var(--text-muted)', opacity: 0.6, cursor: 'grab', flexShrink: 0 }} />
                            <strong>{grp.name}</strong>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <button 
                              type="button"
                              onClick={() => startEditGroup(grp)} 
                              className="btn" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            >
                              <Edit2 size={14} />
                            </button>
                            <button 
                              type="button"
                              onClick={() => handleDeleteGroup(grp.id)} 
                              className="btn btn-danger" 
                              style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>

              <form onSubmit={handleAddGroup} style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
                <div style={{ flex: 1 }}>
                  <label className="form-label">{t('settings.group_name_label', 'Grup Adı')}</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={newGroup.name}
                    onChange={e => setNewGroup(prev => ({...prev, name: e.target.value}))}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.25rem' }}>{t('settings.add', 'Ekle')}</button>
              </form>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <CloudSyncCard />

            {/* Destructive data operations - kept visually separate from the
                cloud card because every action here replaces or exports the
                whole database. */}
            <div className="glass-card danger-card">
              <div className="danger-card-head">
                <span className="danger-card-icon"><ShieldAlert size={18} /></span>
                <div>
                  <h3 className="card-title">{t('settings.critical_system_actions', 'Critical system actions')}</h3>
                  <p className="danger-card-sub">
                    {t('settings.critical_system_actions_desc', 'These actions work on the entire database. A copy is kept automatically before anything is replaced.')}
                  </p>
                </div>
              </div>

              <div className="danger-list">
                <div className="danger-row">
                  <div className="danger-row-text">
                    <strong>{t('settings.backup_db', 'Back up the whole database')}</strong>
                    <span>{t('settings.backup_db_desc', 'Exports every record into a single .sqlite file you can keep for a computer replacement.')}</span>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleBackup}>
                    <Download size={15} /> {t('settings.backup_db_action', 'Back up')}
                  </button>
                </div>

                <div className="danger-row">
                  <div className="danger-row-text">
                    <strong>{t('settings.open_old_backups', 'Open the automatic backups folder')}</strong>
                    <span>{t('settings.old_backups_desc', 'Safety copies Tecton takes before every restore are kept here.')}</span>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={handleOpenOldBackups}>
                    <FolderOpen size={15} /> {t('settings.open_folder_action', 'Open folder')}
                  </button>
                </div>
              </div>

              <div className="danger-restore">
                <span className="form-label">{t('settings.restore_db_label', 'Restore from a backup')}</span>
                <div
                  className="danger-dropzone"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file && (file.name.endsWith('.sqlite') || file.name.endsWith('.db'))) {
                      setModalConfig({
                        isOpen: true,
                        title: t('settings.restore_confirm_title', 'Confirm restore'),
                        message: t('settings.restore_confirm', 'Restoring replaces every current record. Continue?'),
                        type: 'danger',
                        onConfirm: async () => {
                          const res = await window.api.system.restoreDBFile({ filePath: file.path });
                          if (res && !res.success) {
                            if (res.message === 'RESTORE_CORRUPTED') {
                              window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.restore_corrupted_error', 'The file is damaged, so the previous database was kept.'), type: 'error' } }));
                            } else {
                              window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.restore_error', 'Restore failed:') + ' ' + apiMessage(res), type: 'error' } }));
                            }
                          }
                        }
                      });
                    } else {
                      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.restore_invalid_file', 'Drop a valid SQLite file (.sqlite or .db).'), type: 'warning' } }));
                    }
                  }}
                >
                  <DatabaseZap size={22} className="danger-dropzone-icon" />
                  <strong>{t('settings.restore_db_title', 'Drop a database file here')}</strong>
                  <span>{t('settings.restore_db_desc', 'Tecton checks the file, restarts and keeps the old database if the file is damaged.')}</span>
                </div>
              </div>
            </div>

            {/* Otomasyon ve Bakım */}
            <div className="glass-card">
              <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>{t('settings.system_maintenance', 'Sistem Bakımı')}</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <button className="btn" onClick={handleVacuum} style={{ width: '100%', marginBottom: '0.5rem' }}>
                     {t('settings.vacuum_db', 'Veritabanını Optimize Et (Vacuum)')}
                  </button>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {t('settings.vacuum_db_desc', 'Boşaltılan veya silinen kayıtların oluşturduğu veritabanı boşluklarını temizler, disk alanını geri kazanır ve sorgu hızlarını artırır.')}
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {activeTab === 'integrations' && <IntegrationsPanel />}

        {activeTab === 'ai' && <AiPanel />}

        {activeTab === 'logs' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SystemLogs />
          </div>
        )}

        {activeTab === 'recycle' && (
          <div ref={recycleContainerRef} className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className="card-toolbar">
              <p className="card-subtitle" style={{ margin: 0 }}>
                {t('recycle_page_desc', 'Silinen kayıtları buradan inceleyip orijinal yerlerine geri yükleyebilirsiniz.')}
              </p>
              <div className="card-toolbar-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setIsGuideOpen(true)}
                  title={t('guides.recycle.title', 'Geri Dönüşüm Kutusu Rehberi (5N1K)')}
                >
                  <Lightbulb size={14} aria-hidden="true" />
                  {t('common.page_guide', 'Page guide')}
                </button>
              </div>
            </div>

            {/* Filters & Search Bar */}
            <div style={{ 
              background: 'var(--surface-subtle)', 
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
                  ><X size={14} aria-hidden="true" />
                    
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
                    <table className="fin-table">
                      <thead>
                        <tr>
                          <th>{t('recycle_th_type', 'Record Type')}</th>
                          <th>{t('recycle_th_project', 'Project / Site')}</th>
                          <th>{t('recycle_th_content', 'Content / Title')}</th>
                          <th>{t('recycle_th_date', 'Deleted At')}</th>
                          <th style={{ textAlign: 'right' }}>{t('recycle_th_action', 'Action')}</th>
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
                            <tr key={`${item.table}_${item.id}_${idx}`}>
                              <td>
                                <span className="pill">{typeLabel}</span>
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                                {item.project_name || '-'}
                              </td>
                              <td style={{ fontWeight: 500 }}>
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
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                                {item.deleted_at ? new Date(item.deleted_at).toLocaleString() : '-'}
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
                                  {isRestored ? (
                                    <span className="pill pill-success">
                                      <Check size={12} aria-hidden="true" />
                                      {t('global.restored', 'Geri Yüklendi')}
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      className="btn"
                                      onClick={() => handleRestore(item.table, item.id)}
                                    >
                                      <RotateCcw size={14} aria-hidden="true" />
                                      {t('global.restore', 'Geri Yükle')}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination - shared component (ui/Pagination) */}
                  <Pagination currentPage={recycleCurrentPage} totalPages={totalPages} onPageChange={setRecycleCurrentPage} totalRecords={filteredDeletedItems.length} />
                </div>
              );
            })()}

            
          </div>
        )}

      </div>

      <GuideDrawer 
        isOpen={isGuideOpen && activeTab === 'recycle'} 
        onClose={() => setIsGuideOpen(false)} 
        title={t('guides.recycle.title', 'Geri Dönüşüm Kutusu Rehberi (5N1K)')} 
        desc="" 
        h1={t('guides.recycle.q1.title')} 
        p1={t('guides.recycle.q1.desc')} 
        h2={t('guides.recycle.q2.title')} 
        p2={t('guides.recycle.q2.desc')} 
        h3={t('guides.recycle.q3.title')} 
        p3={t('guides.recycle.q3.desc')} 
        h4={t('guides.recycle.q4.title')} 
        p4={t('guides.recycle.q4.desc')} 
        h5={t('guides.recycle.q5.title')} 
        p5={t('guides.recycle.q5.desc')} 
        h6={t('guides.recycle.q6.title')} 
        p6={t('guides.recycle.q6.desc')} 
      />

      <GuideDrawer 
        isOpen={isGuideOpen && activeTab === 'finance'} 
        onClose={() => setIsGuideOpen(false)} 
        title={t('settings.finance_guide.title')} 
        desc=""
        h1={t('settings.finance_guide.section1.title')} 
        p1={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>{t('settings.finance_guide.section1.p1_title')}</strong> {t('settings.finance_guide.section1.p1_desc')}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>{t('settings.finance_guide.section1.p2_title')}</strong> {t('settings.finance_guide.section1.p2_desc')}</div>
          </div>
        }
        h2={t('settings.finance_guide.section2.title')} 
        p2={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>{t('settings.finance_guide.section2.p1_title')}</strong> {t('settings.finance_guide.section2.p1_desc')}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>{t('settings.finance_guide.section2.p2_title')}</strong> {t('settings.finance_guide.section2.p2_desc')}</div>
          </div>
        }
        h3={t('settings.finance_guide.section3.title')} 
        p3={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>{t('settings.finance_guide.section3.p1_title')}</strong> {t('settings.finance_guide.section3.p1_desc')}</div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: 'var(--primary)' }}>{t('settings.finance_guide.section3.f_total')}</p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <li>{t('settings.finance_guide.section3.f_base')}</li>
                <li>{t('settings.finance_guide.section3.f_hourly')}</li>
                <li>{t('settings.finance_guide.section3.f_overtime')}</li>
              </ul>
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', fontStyle: 'italic', opacity: 0.8 }}>
                {t('settings.finance_guide.section3.example')}
              </p>
            </div>
          </div>
        }
        h4={t('settings.finance_guide.section4.title')} 
        p4={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div><strong style={{ color: 'var(--text-primary)' }}>{t('settings.finance_guide.section4.p1_title')}</strong> {t('settings.finance_guide.section4.p1_desc')}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>{t('settings.finance_guide.section4.p2_title')}</strong> {t('settings.finance_guide.section4.p2_desc')}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>{t('settings.finance_guide.section4.p3_title')}</strong> {t('settings.finance_guide.section4.p3_desc')}</div>
            <div><strong style={{ color: 'var(--text-primary)' }}>{t('settings.finance_guide.section4.p4_title')}</strong> {t('settings.finance_guide.section4.p4_desc')}</div>
          </div>
        }
      />

      <ConfirmationModal 
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={() => {
          modalConfig.onConfirm();
          setModalConfig({ ...modalConfig, isOpen: false });
        }}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />
    </div>
  );
};

export default Settings;
