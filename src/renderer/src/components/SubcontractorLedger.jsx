import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { logError } from '../utils/logger';
import ConfirmationModal from './ui/ConfirmationModal';
import NoProjectNotice from './ui/NoProjectNotice';
import GuideDrawer from './ui/GuideDrawer';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatCurrency, getCurrencySymbol, trLower } from '../utils/formatUtils';
import { exportToExcel, exportToCSV, exportToJSON, generateSubcontractorTemplate } from '../utils/exportUtils';
import { readSubcontractorsFromExcel } from '../utils/importUtils';
import TagInput from './ui/TagInput';
import apiWrite from '../utils/apiWrite';
import PageGuideIcon from './ui/PageGuideIcon';
import { daysUntil } from '../utils/dateRangeUtils';
import Pagination from './ui/Pagination';
import useModalA11y from '../hooks/useModalA11y';
import { parsePositiveNumber } from '../utils/validation';
import { parseTags } from '../utils/tagUtils';
import { Download, Eye, Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { isLedgerPayment, isLedgerProgress } from '../utils/ledgerTypes';

const SubcontractorLedger = ({ activeProjectId, projects = [], onViewProfile }) => {
  const { t, i18n } = useTranslation();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const containerRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    service_type: '',
    phone: '',
    daily_wage: '',
    status: 'active',
    isg_start_date: '',
    isg_expiry_date: ''
  });
  const [tags, setTags] = useState([]);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const fileInputRef = useRef(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterServiceType, setFilterServiceType] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'active' | 'passive'
  const [anomalyActiveTab, setAnomalyActiveTab] = useState('all');
  const [anomalySearch, setAnomalySearch] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Guards against stale responses overwriting newer data after a project switch.
  const requestIdRef = useRef(0);

  const fetchContractors = async () => {
    if (!activeProjectId) {
      setContractors([]);
      setLoading(false);
      return;
    }
    if (window.api && window.api.db) {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        // Two independent reads: one wait instead of two serial round-trips.
        const [data, transactions] = await Promise.all([
          window.api.db.read('subcontractor_ledgers', { project_id: activeProjectId }),
          window.api.db.read('subcontractor_transactions', { project_id: activeProjectId })
        ]);

        // Drop stale responses caused by a quick project switch.
        if (requestId !== requestIdRef.current) return;

        const balancesMap = {};
        (transactions || []).forEach(t => {
          const subId = t.subcontractor_id;
          if (!balancesMap[subId]) balancesMap[subId] = 0;
          if (isLedgerProgress(t.type)) balancesMap[subId] += t.amount;
          else if (isLedgerPayment(t.type)) balancesMap[subId] -= t.amount;
        });

        const contractorsWithBalance = (data || []).map(c => ({
          ...c,
          balance: balancesMap[c.id] || 0
        }));

        setContractors(contractorsWithBalance);
      } catch (err) {
        // Unguarded reads left the ledger on a permanent spinner.
        if (requestId !== requestIdRef.current) return;
        logError('Subcontractor ledger fetch failed:', err);
        setContractors([]);
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: t('subcontractor.load_error', 'Taşeron kayıtları yüklenemedi.'), type: 'error' }
        }));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContractors();
  }, [activeProjectId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterServiceType, filterStatus]);

  const handleOpenDrawer = (c = null) => {
    if (c) {
      setEditingId(c.id);
      setFormData({
        name: c.name,
        service_type: c.service_type,
        phone: c.phone || '',
        daily_wage: c.daily_wage.toString(),
        status: c.status || 'active',
        isg_start_date: c.isg_start_date || '',
        isg_expiry_date: c.isg_expiry_date || ''
      });
      setTags(parseTags(c.tags));
    } else {
      setEditingId(null);
      setFormData({
        name: '',
        service_type: '',
        phone: '',
        daily_wage: '',
        status: 'active',
        isg_start_date: '',
        isg_expiry_date: ''
      });
      setTags([]);
    }
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingId(null);
    setTags([]);
  };

  // The add/edit drawer is a dialog: before this it had no role, no focus
  // trap and no Escape handling, so keyboard and screen-reader users could not
  // dismiss it and Tab walked into the page behind the overlay.
  const { dialogProps, containerRef: drawerRef } = useModalA11y({
    isOpen: isDrawerOpen,
    onClose: handleCloseDrawer,
    label: editingId ? t('subcontractor.edit_title', 'Taşeronu Düzenle') : t('subcontractor.new_title', 'Yeni Taşeron Ekle')
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeProjectId || !formData.name || !formData.service_type || !formData.daily_wage) return;
    // '-5' passes the truthiness check; daily_wage has no CHECK constraint, and a
    // negative wage silently reduces every ledger total that depends on it.
    const dailyWage = parsePositiveNumber(formData.daily_wage);
    if (dailyWage === null) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('common.invalid_positive_number', 'Lütfen sıfırdan büyük geçerli bir miktar girin.'), type: 'warning' }
      }));
      return;
    }

    if (window.api && window.api.db) {
      const payload = {
        project_id: activeProjectId,
        name: formData.name,
        service_type: formData.service_type,
        phone: formData.phone,
        daily_wage: dailyWage,
        status: formData.status,
        isg_start_date: formData.isg_start_date || null,
        isg_expiry_date: formData.isg_expiry_date || null,
        tags: JSON.stringify(tags)
      };

      const res = editingId
        ? await apiWrite(window.api.db.update('subcontractor_ledgers', editingId, payload))
        : await apiWrite(window.api.db.create('subcontractor_ledgers', payload));
      // Do not close the drawer and show "saved" when the write was rejected.
      if (res && res.success === false) return;

      handleCloseDrawer();
      fetchContractors();
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { 
          message: editingId ? t('subcontractor.update_success', 'Taşeron başarıyla güncellendi.') : t('subcontractor.add_success', 'Taşeron başarıyla eklendi.'), 
          type: 'success' 
        } 
      }));
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (window.api && window.api.db && confirmModal.id) {
      const res = await apiWrite(window.api.db.delete('subcontractor_ledgers', confirmModal.id));
      if (res && res.success === false) return;
      setConfirmModal({ isOpen: false, id: null });
      fetchContractors();
      window.dispatchEvent(new CustomEvent('show-toast', { 
        detail: { 
          message: t('subcontractor.delete_success', 'Taşeron kaydı başarıyla silindi.'), 
          type: 'success' 
        } 
      }));
    }
  };

  // Filter subcontractor list.
  // Memoized: this chain (search over every field + currency formatting per row)
  // previously ran on every render, including keystrokes in unrelated inputs.
  const filteredContractors = useMemo(() => {
    const q = trLower(searchQuery);
    const statusText = trLower(t('filters.passive', 'Pasif'));
    const statusTextActive = trLower(t('filters.active', 'Aktif'));

    return contractors.filter(c => {
      const tagsStr = c.tags ? trLower(c.tags) : '';

      const rowStatusText = c.status === 'passive' ? statusText : statusTextActive;
      const statusTextEn = c.status === 'passive' ? 'passive' : 'active';

      const wageStr = String(c.daily_wage);
      const wageCommaStr = wageStr.replace('.', ',');
      const formattedWage = formatCurrency(c.daily_wage, i18n.language);

      const balanceStr = String(c.balance || 0);
      const balanceCommaStr = balanceStr.replace('.', ',');
      const formattedBalance = formatCurrency(c.balance || 0, i18n.language);

      const matchesSearch = !searchQuery ||
                            trLower(c.name).includes(q) ||
                            trLower(c.service_type).includes(q) ||
                            tagsStr.includes(q) ||
                            (c.phone && c.phone.includes(searchQuery)) ||
                            rowStatusText.includes(q) ||
                            statusTextEn.includes(q) ||
                            wageStr.includes(q) ||
                            wageCommaStr.includes(q) ||
                            trLower(formattedWage).includes(q) ||
                            balanceStr.includes(q) ||
                            balanceCommaStr.includes(q) ||
                            trLower(formattedBalance).includes(q);
      const matchesService = !filterServiceType || c.service_type === filterServiceType;
      const matchesStatus = !filterStatus || c.status === filterStatus;
      return matchesSearch && matchesService && matchesStatus;
    });
  }, [contractors, searchQuery, filterServiceType, filterStatus, i18n.language, t]);

  const totalPages = Math.ceil(filteredContractors.length / itemsPerPage);
  const paginatedContractors = filteredContractors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Extract unique service types for dropdown
  const uniqueServiceTypes = useMemo(
    () => [...new Set(contractors.map(c => c.service_type))].sort(),
    [contractors]
  );

  // Group by service type
  const { groupedContractors, sortedServiceNames } = useMemo(() => {
    const grouped = filteredContractors.reduce((acc, c) => {
      const service = c.service_type || t('subcontractor.no_service', 'Diğer');
      if (!acc[service]) acc[service] = [];
      acc[service].push(c);
      return acc;
    }, {});
    return {
      groupedContractors: grouped,
      sortedServiceNames: Object.keys(grouped).sort((a, b) => a.localeCompare(b, i18n.language || 'tr'))
    };
  }, [filteredContractors, i18n.language, t]);

  // Calculate subcontractor anomalies
  const { negativeBalanceContractors, isgExpiredContractors, isgApproachingContractors } = useMemo(() => {
    const negative = contractors.filter(c => (c.balance || 0) < 0);

    // `daysUntil` returns null for a missing/unparseable date. Previously a
    // corrupt date produced NaN, and NaN compares false to both `<= 0` and
    // `> 0`, so the record silently disappeared from both lists.
    const isgMapped = contractors
      .map(c => ({ c, remainingDays: daysUntil(c.isg_expiry_date) }))
      .filter(x => x.remainingDays !== null)
      .map(x => ({ ...x.c, remainingDays: x.remainingDays }));

    return {
      negativeBalanceContractors: negative,
      isgExpiredContractors: isgMapped.filter(c => c.remainingDays <= 0),
      isgApproachingContractors: isgMapped
        .filter(c => c.remainingDays > 0 && c.remainingDays <= 15)
        .sort((a, b) => a.remainingDays - b.remainingDays)
    };
  }, [contractors]);

  const { filteredNegativeBalance, filteredIsgExpired, filteredIsgApproaching } = useMemo(() => {
    const q = trLower(anomalySearch);
    const filterAnomalyByName = (c) => trLower(c.name).includes(q);
    return {
      filteredNegativeBalance: negativeBalanceContractors.filter(filterAnomalyByName),
      filteredIsgExpired: isgExpiredContractors.filter(filterAnomalyByName),
      filteredIsgApproaching: isgApproachingContractors.filter(filterAnomalyByName)
    };
  }, [negativeBalanceContractors, isgExpiredContractors, isgApproachingContractors, anomalySearch]);

  if (!activeProjectId) {
    return <NoProjectNotice titleKey="nav.subcontractors" titleFallback="Subcontractor ledger" />;
  }

  return (
    <div ref={containerRef} className="subcontractor-page" style={{ animation: 'fadeIn 0.3s ease' }}>
      <header className="page-head">
        <div>
          <h1 className="page-head-title">{t('subcontractor.title', 'Taşeron ve Alt Yüklenici Carileri')}</h1>
        </div>
        <div className="card-toolbar-actions">
          <PageGuideIcon onClick={() => setHelpOpen(true)} />
          <input 
            type="file" 
            accept=".xlsx, .xls" 
            style={{ display: 'none' }} 
            ref={fileInputRef}
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              try {
                const result = await readSubcontractorsFromExcel(file, t, i18n.language);
                if (result.success) {
                  // Rows are independent (matching uses the snapshot taken
                  // before the import), so the writes run together instead of
                  // one IPC round-trip per row.
                  await Promise.all(result.data.map((sub) => {
                    const existing = contractors.find(c => trLower(c.name.trim()) === trLower(sub.name.trim()));
                    return existing
                      ? apiWrite(window.api.db.update('subcontractor_ledgers', existing.id, {
                        ...sub, project_id: activeProjectId
                      }))
                      : apiWrite(window.api.db.create('subcontractor_ledgers', {
                        ...sub, project_id: activeProjectId
                      }));
                  }));
                  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('subcontractor_import.import_success', '{{count}} taşeron kaydı başarıyla içe aktarıldı.').replace('{{count}}', result.data.length), type: 'success' } }));
                  fetchContractors();
                }
              } catch (err) {
                logError('Subcontractor import failed:', err);
                window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('common.error_occurred', 'Hata:') + ' ' + t('common.import_failed', 'İçe aktarma başarısız oldu. Lütfen dosya biçimini kontrol edin.'), type: 'error' } }));
              }
              e.target.value = '';
            }}
          />
          <button className="btn" onClick={() => fileInputRef.current.click()}>
            <Upload size={14} aria-hidden="true" />
            {t('subcontractor_import.import_btn', 'Excel\'den İçe Aktar')}
          </button>
          <button className="btn" onClick={() => generateSubcontractorTemplate(t, i18n.language)}>
            <Download size={14} aria-hidden="true" />
            {t('subcontractor_import.download_template', 'Excel Taslağını İndir')}
          </button>
          <select className="form-input" style={{ width: 'auto', marginBottom: 0 }} onChange={e => {
            const format = e.target.value;
            if (!format) return;
            const lang = i18n.language;
            const isTr = lang === 'tr';
            // `isTr ? ... : ...` only covered Turkish and English; the other
            // 17 locales got English headers regardless of the active language.
            const dataToExport = contractors.map(c => ({
              [t('export.subcontractor_name', 'Taşeron Adı')]: c.name,
              [t('export.service_type', 'Hizmet Alanı')]: c.service_type,
              [t('common.phone', 'Telefon')]: c.phone || '-',
              [t('export.daily_rate', 'Günlük Bedel')]: c.daily_wage,
              [t('export.status', 'Durum')]:
                c.status === 'active'
                  ? t('export.active', 'Aktif')
                  : t('export.passive', 'Pasif'),
              [t('export.isg_start', 'İSG Başlangıç')]: c.isg_start_date || '-',
              [t('export.isg_end', 'İSG Bitiş')]: c.isg_expiry_date || '-'
            }));
            const fName = isTr ? 'Taseron_Listesi' : 'Subcontractor_List';
            if (format === 'excel') exportToExcel(dataToExport, fName);
            if (format === 'csv') exportToCSV(dataToExport, fName);
            if (format === 'json') exportToJSON(dataToExport, fName);
            e.target.value = '';
          }} value="">
            <option value="" disabled>{t('subcontractor_import.export_btn', 'Dışa Aktar...')}</option>
            <option value="excel">Excel (.xlsx)</option>
            <option value="csv">CSV (.csv)</option>
            <option value="json">JSON (.json)</option>
          </select>
          <button className="btn btn-primary" onClick={() => handleOpenDrawer()}>
            {t('subcontractor.add_new', 'Yeni Taşeron Ekle')}
          </button>
        </div>
      </header>

      {/* Bento Grid layout */}
      <div className="bento-grid">
        {/* Left Column: Cards List grouped by service type (span 9) */}
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
                ><X size={14} aria-hidden="true" />
                  
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
                          style={{ fontWeight: '600', cursor: 'pointer', color: 'var(--text-primary)' }}
                          onClick={() => onViewProfile && onViewProfile(c)}
                        >
                          {c.name}
                        </td>
                        <td>{c.service_type}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>{c.phone || '-'}</td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--primary)' }}>
                          {formatCurrency(c.daily_wage, i18n.language)}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 'bold', color: isPositive ? 'var(--success)' : 'var(--danger)' }}>
                          {formatCurrency(bal, i18n.language)}
                        </td>
                        <td>
                          <span className={`pill ${c.status === 'passive' ? 'pill-danger' : 'pill-success'}`}>
                            {c.status === 'passive' ? t('filters.passive', 'PASİF') : t('filters.active', 'AKTİF')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="row-actions">
                            {onViewProfile && (
                              <button
                                type="button"
                                className="icon-btn"
                                onClick={() => onViewProfile(c)}
                                title={t('common.details', 'Detay')}
                              >
                                <Eye size={14} aria-hidden="true" />
                              </button>
                            )}
                            <button
                              type="button"
                              className="icon-btn"
                              onClick={() => handleOpenDrawer(c)}
                              title={t('dashboard.edit', 'Düzenle')}
                            >
                              <Pencil size={14} aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="icon-btn is-danger"
                              onClick={() => handleDelete(c.id)}
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

              {/* Pagination - shared component (ui/Pagination) */}
              <Pagination variant="sticky" currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalRecords={filteredContractors.length} />
            </div>
          )}
        </div>

        {/* Right Column: Widgets / Anomaly & Reports (span 3) */}
        <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Subcontractor Anomaly Panel */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               {t('subcontractor.anomalies', 'Taşeron Uyarıları')}
            </h3>

            {/* Search Input */}
            <div>
              <input 
                type="text" 
                className="form-input" 
                placeholder={t('filters.search_anomalies', 'Uyarılarda ara...')} 
                value={anomalySearch} 
                onChange={e => setAnomalySearch(e.target.value)} 
                style={{ padding: '0.45rem 0.85rem', fontSize: '0.85rem', marginBottom: 0 }}
              />
            </div>

            {/* Tabs */}
            <div className="segmented" role="tablist" aria-label={t('anomalies.title', 'Anomaliler')}>
              <button
                type="button"
                role="tab"
                aria-selected={anomalyActiveTab === 'all'}
                onClick={() => setAnomalyActiveTab('all')}
                className={`segmented-item ${anomalyActiveTab === 'all' ? 'active' : ''}`}
              >
                {t('filters.tab_all', 'Hepsi')} ({filteredNegativeBalance.length + filteredIsgExpired.length + filteredIsgApproaching.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={anomalyActiveTab === 'balance'}
                onClick={() => setAnomalyActiveTab('balance')}
                className={`segmented-item ${anomalyActiveTab === 'balance' ? 'active' : ''}`}
              >
                {t('filters.tab_low_balance', 'Bakiye')} ({filteredNegativeBalance.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={anomalyActiveTab === 'expired'}
                onClick={() => setAnomalyActiveTab('expired')}
                className={`segmented-item ${anomalyActiveTab === 'expired' ? 'active' : ''}`}
              >
                {t('filters.tab_expired_hse', 'İSG Dolan')} ({filteredIsgExpired.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={anomalyActiveTab === 'approaching'}
                onClick={() => setAnomalyActiveTab('approaching')}
                className={`segmented-item ${anomalyActiveTab === 'approaching' ? 'active' : ''}`}
              >
                {t('filters.tab_expiring_hse', 'İSG Yaklaşan')} ({filteredIsgApproaching.length})
              </button>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
              {(filteredNegativeBalance.length === 0 && filteredIsgExpired.length === 0 && filteredIsgApproaching.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--success-text)', background: 'var(--success-bg)', borderRadius: '0.5rem', border: '1px solid var(--success-border)', fontSize: '0.8rem' }}>
                   {t('subcontractor.all_isg_valid', 'Tüm durumlar ve İSG belgeleri güncel.')}
                </div>
              ) : (
                <>
                  {/* Financial Warnings */}
                  {(anomalyActiveTab === 'all' || anomalyActiveTab === 'balance') && filteredNegativeBalance.length > 0 && (
                    <div style={{ background: 'var(--danger-bg)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--danger-border)' }}>
                      <div style={{ color: 'var(--danger-text)', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                         {t('anomalies.financial_warnings_title', 'Finansal Uyarılar')} ({filteredNegativeBalance.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {filteredNegativeBalance.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                            <span style={{ fontWeight: '500' }}>{c.name}</span>
                            <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>{formatCurrency(c.balance, i18n.language)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ISG Expired */}
                  {(anomalyActiveTab === 'all' || anomalyActiveTab === 'expired') && filteredIsgExpired.length > 0 && (
                    <div style={{ background: 'var(--danger-bg)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--danger-border)' }}>
                      <div style={{ color: 'var(--danger-text)', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                         {t('isg.badge_expired', 'İSG Süresi Dolanlar')} ({filteredIsgExpired.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {filteredIsgExpired.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                            <span style={{ fontWeight: '500' }}>{c.name}</span>
                            <span style={{ color: 'var(--danger)' }}>{c.isg_expiry_date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ISG Approaching */}
                  {(anomalyActiveTab === 'all' || anomalyActiveTab === 'approaching') && filteredIsgApproaching.length > 0 && (
                    <div style={{ background: 'var(--warning-soft)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--warning-border)' }}>
                      <div style={{ color: 'var(--warning)', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                         {t('isg.badge_approaching', 'İSG Süresi Yaklaşanlar')} ({filteredIsgApproaching.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {filteredIsgApproaching.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                            <span style={{ fontWeight: '500' }}>{c.name}</span>
                            <span style={{ color: 'var(--warning)' }}>{t('subcontractor.days_remaining', '{{count}} gün kaldı', { count: c.remainingDays })}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Subcontractor financial report summary */}
          <div className="glass-card">
            <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               {t('subcontractor.financial_summary', 'Taşeron Finans Özeti')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('subcontractor.total_receivable', 'Toplam Taşeron Alacağı')}</span>
                <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>
                  {formatCurrency(contractors.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0), i18n.language)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('subcontractor.total_debt', 'Toplam Taşeron Borcu')}</span>
                <span style={{ color: 'var(--danger)', fontWeight: 'bold' }}>
                  {formatCurrency(contractors.reduce((sum, c) => sum + (c.balance < 0 ? c.balance : 0), 0), i18n.language)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--accent-soft)', borderRadius: '8px', border: '1px solid var(--accent-soft)', fontWeight: 'bold' }}>
                <span style={{ fontSize: '0.85rem' }}>{t('dashboard.net_balance', 'Genel Net Bakiye')}</span>
                <span style={{ color: contractors.reduce((sum, c) => sum + (c.balance || 0), 0) >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {formatCurrency(contractors.reduce((sum, c) => sum + (c.balance || 0), 0), i18n.language)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Guide Drawer */}
      <GuideDrawer 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title={t('guides.subcontractor.title', 'Taşeron Yönetim Rehberi (5N1K)')} 
        desc="" 
        h1={t('guides.subcontractor.q1.title', '1. NE? (Taşeron Carisi Nedir?)')} 
        p1={t('guides.subcontractor.q1.desc', 'Şantiyenizdeki alt yüklenicilerin (hafriyat, demir, katering vb.) isim, telefon ve yevmiye bedelleriyle finansal alacak/borç dengelerini izleyen cari takip sistemidir.')} 
        h2={t('guides.subcontractor.q2.title', '2. NEREDE? (Veriler Nerede Saklanır?)')} 
        p2={t('guides.subcontractor.q2.desc', 'Tüm taşeron kartları ve cari hesap hareketleri yerel veritabanında saklanır. Şantiye bazında izole edilerek filtrelenir.')} 
        h3={t('guides.subcontractor.q3.title', '3. NE ZAMAN? (Cari Hareketler Ne Zaman Girilir?)')} 
        p3={t('guides.subcontractor.q3.desc', 'Hakediş kazandıklarında veya ödeme/avans yapıldığında anında cari hareket olarak girilmelidir. İSG belgeleri de bitiş tarihlerine göre sürekli güncel tutulmalıdır.')} 
        h4={t('guides.subcontractor.q4.title', '4. NASIL? (Hakediş ve Ödemeler Nasıl Yönetilir?)')} 
        p4={t('guides.subcontractor.q4.desc', 'Taşeron kartının yanındaki detay butonuna basarak profiline girebilir; yeni hakediş ve ödeme ekleyerek net bakiyeyi otonom hesaplatabilirsiniz.')} 
        h5={t('guides.subcontractor.q5.title', '5. NEDEN? (Neden Taşeron Carisi Tutulmalıdır?)')} 
        p5={t('guides.subcontractor.q5.desc', 'Farklı taşeron ve makine kiralama hesaplarında el yazısı hatalarını önlemek, net borç/alacak durumunu anlık görmek ve İSG evrak sürelerini otonom takip etmek için tutulur.')} 
        h6={t('guides.subcontractor.q6.title', '6. KİM? (Taşeron Hesaplarını Kimler Yönetebilir?)')} 
        p6={t('guides.subcontractor.q6.desc', 'Şantiye şefleri, muhasebe sorumluları ve proje yöneticileri yeni taşeron tanımlayabilir, hakediş/ödeme girebilir ve hesap özetini WhatsApp üzerinden taşerona iletebilir.')} 
      />

      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title={t('subcontractor.delete_title', 'Taşeronu Sil')}
        message={t('subcontractor.delete_confirm', 'Bu taşeron kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')}
      />

      {/* Slide-out Drawer for Add / Edit Subcontractor (matches Personnel styling) */}
      {isDrawerOpen && (
        <div className="drawer-overlay" onClick={handleCloseDrawer}>
          <div
            ref={drawerRef}
            {...dialogProps}
            className="drawer-content"
            style={{ display: 'flex', flexDirection: 'column', padding: '2rem', outline: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <h2 className="drawer-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>
                {editingId ? t('subcontractor.edit_title', 'Taşeronu Düzenle') : t('subcontractor.new_title', 'Yeni Taşeron Ekle')}
              </h2>
              <button 
                type="button"
                className="btn btn-danger" 
                aria-label={t('common.close', 'Kapat')}
                title={t('common.close', 'Kapat')}
                onClick={handleCloseDrawer} 
                style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: 'none' }}
              ><X size={14} aria-hidden="true" />
                
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('subcontractor.name', 'Taşeron Adı / Ünvanı')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={t('subcontractor.name_ph', 'Örn: Öz Karadeniz Hafriyat')} 
                  value={formData.name}
                  onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('subcontractor.service', 'Hizmet Alanı')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={t('subcontractor.service_ph', 'Örn: Kepçe Kiralama / Hafriyat')} 
                  value={formData.service_type}
                  onChange={e => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('common.phone', 'Telefon')}</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder={t('worker_modal.phone_ph', '05XX XXX XX XX')} 
                  value={formData.phone}
                  onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  {t('subcontractor.wage', 'Yevmiye / Günlük Bedel (₺)').includes('(₺)')
                    ? t('subcontractor.wage', 'Yevmiye / Günlük Bedel (₺)').replace('(₺)', `(${getCurrencySymbol(i18n.language)})`)
                    : `${t('subcontractor.wage', 'Yevmiye / Günlük Bedel (₺)')} (${getCurrencySymbol(i18n.language)})`}
                </label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="0.00" 
                  min="0"
                  value={formData.daily_wage}
                  onChange={e => setFormData(prev => ({ ...prev, daily_wage: e.target.value }))}
                  required
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('worker_modal.status', 'Durum')}</label>
                <select 
                  className="form-input" 
                  value={formData.status} 
                  onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
                >
                  <option value="active">{t('filters.active', 'Aktif')}</option>
                  <option value="passive">{t('filters.passive', 'Pasif')}</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('worker_modal.tags', 'Etiketler')}</label>
                <TagInput tags={tags} setTags={setTags} placeholder={t('worker_modal.tags_ph', 'Etiket ekleyin...')} />
              </div>

              <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginTop: '0.25rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                   {t('isg.section_title', 'İSG (İş Sağlığı ve Güvenliği)')}
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                    <label className="form-label">{t('isg.start_date', 'İSG Başlangıç Tarihi')}</label>
                    <CustomDatePicker 
                      className="form-input" 
                      value={formData.isg_start_date} 
                      onChange={e => setFormData(prev => {
                        const val = e.target.value;
                        if (val && prev.isg_expiry_date && new Date(val) > new Date(prev.isg_expiry_date)) {
                          return { ...prev, isg_start_date: prev.isg_expiry_date, isg_expiry_date: val };
                        }
                        return { ...prev, isg_start_date: val };
                      })} 
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                    <label className="form-label">{t('isg.expiry_date', 'İSG Bitiş Tarihi')}</label>
                    <CustomDatePicker 
                      className="form-input" 
                      value={formData.isg_expiry_date} 
                      onChange={e => setFormData(prev => {
                        const val = e.target.value;
                        if (val && prev.isg_start_date && new Date(prev.isg_start_date) > new Date(val)) {
                          return { ...prev, isg_expiry_date: prev.isg_start_date, isg_start_date: val };
                        }
                        return { ...prev, isg_expiry_date: val };
                      })} 
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
                <button type="button" className="btn" onClick={handleCloseDrawer} style={{ flex: 1, fontWeight: 'bold' }}>{t('worker_modal.cancel', 'İptal')}</button>
                <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 'bold' }}>{t('worker_modal.save', 'Kaydet')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubcontractorLedger;
