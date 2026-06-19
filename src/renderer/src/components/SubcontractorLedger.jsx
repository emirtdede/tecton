import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatCurrency, getCurrencySymbol, trLower } from '../utils/formatUtils';
import { exportToExcel, exportToCSV, exportToJSON, generateSubcontractorTemplate } from '../utils/exportUtils';
import { readSubcontractorsFromExcel } from '../utils/importUtils';
import TagInput from './ui/TagInput';

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

  const fetchContractors = async () => {
    if (!activeProjectId) return;
    if (window.api && window.api.db) {
      setLoading(true);
      // Read subcontractors
      const data = await window.api.db.read('subcontractor_ledgers', { project_id: activeProjectId });
      
      // Read subcontractor transactions to compute net balances
      const transactions = await window.api.db.read('subcontractor_transactions', { project_id: activeProjectId });
      
      const balancesMap = {};
      transactions.forEach(t => {
        const subId = t.subcontractor_id;
        if (!balancesMap[subId]) balancesMap[subId] = 0;
        if (t.type === 'Hakediş') balancesMap[subId] += t.amount;
        else if (t.type === 'Ödeme') balancesMap[subId] -= t.amount;
      });

      const contractorsWithBalance = data.map(c => ({
        ...c,
        balance: balancesMap[c.id] || 0
      }));

      setContractors(contractorsWithBalance);
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
      try {
        if (c.tags) {
          const parsed = typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags;
          setTags(Array.isArray(parsed) ? parsed : []);
        } else {
          setTags([]);
        }
      } catch (e) {
        setTags([]);
      }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeProjectId || !formData.name || !formData.service_type || !formData.daily_wage) return;

    if (window.api && window.api.db) {
      const payload = {
        project_id: activeProjectId,
        name: formData.name,
        service_type: formData.service_type,
        phone: formData.phone,
        daily_wage: Number(formData.daily_wage),
        status: formData.status,
        isg_start_date: formData.isg_start_date || null,
        isg_expiry_date: formData.isg_expiry_date || null,
        tags: JSON.stringify(tags)
      };

      if (editingId) {
        await window.api.db.update('subcontractor_ledgers', editingId, payload);
      } else {
        await window.api.db.create('subcontractor_ledgers', payload);
      }

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
      await window.api.db.delete('subcontractor_ledgers', confirmModal.id);
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

  // Filter subcontractor list
  const filteredContractors = contractors.filter(c => {
    const q = trLower(searchQuery);
    const tagsStr = c.tags ? trLower(c.tags) : '';
    
    const statusText = c.status === 'passive' 
      ? trLower(t('filters.passive', 'Pasif')) 
      : trLower(t('filters.active', 'Aktif'));
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
                          statusText.includes(q) ||
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

  const totalPages = Math.ceil(filteredContractors.length / itemsPerPage);
  const paginatedContractors = filteredContractors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Extract unique service types for dropdown
  const uniqueServiceTypes = [...new Set(contractors.map(c => c.service_type))].sort();

  // Group by service type
  const groupedContractors = filteredContractors.reduce((acc, c) => {
    const service = c.service_type || t('subcontractor.no_service', 'Diğer');
    if (!acc[service]) acc[service] = [];
    acc[service].push(c);
    return acc;
  }, {});

  const sortedServiceNames = Object.keys(groupedContractors).sort((a, b) => a.localeCompare(b, i18n.language || 'tr'));

  // Calculate subcontractor anomalies
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const negativeBalanceContractors = contractors.filter(c => {
    const bal = c.balance || 0;
    return bal < 0;
  });

  const isgMapped = contractors.filter(c => !!c.isg_expiry_date).map(c => {
    const endDate = new Date(c.isg_expiry_date);
    endDate.setHours(0, 0, 0, 0);
    const timeDiff = endDate.getTime() - today.getTime();
    const dayDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
    return { ...c, remainingDays: dayDiff };
  });

  const isgExpiredContractors = isgMapped.filter(c => c.remainingDays <= 0);
  const isgApproachingContractors = isgMapped
    .filter(c => c.remainingDays > 0 && c.remainingDays <= 15)
    .sort((a, b) => a.remainingDays - b.remainingDays);

  const filterAnomalyByName = (c) => trLower(c.name).includes(trLower(anomalySearch));

  const filteredNegativeBalance = negativeBalanceContractors.filter(filterAnomalyByName);
  const filteredIsgExpired = isgExpiredContractors.filter(filterAnomalyByName);
  const filteredIsgApproaching = isgApproachingContractors.filter(filterAnomalyByName);

  if (!activeProjectId) {
    return (
      <div className="glass-card text-center" style={{ padding: '3rem' }}>
        <h2>{t('nav.subcontractors', 'Taşeron Cari Takibi')}</h2>
        <p className="text-muted" style={{ marginTop: '1rem' }}>{t('common.select_project_msg', 'Lütfen sol menüden veya Şantiye Yönetimi sayfasından aktif bir şantiye seçin.')}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="subcontractor-page" style={{ animation: 'fadeIn 0.3s ease' }}>
      {/* Header section identical to Personnel page */}
      <header className="header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ margin: 0 }}>{t('subcontractor.title', '🚜 Taşeron ve Alt Yüklenici Carileri')}</h1>
          <span 
            onClick={() => setHelpOpen(true)}
            style={{ 
              cursor: 'pointer', 
              opacity: 0.4, 
              transition: 'opacity 0.25s ease-in-out', 
              fontSize: '1.4rem',
              userSelect: 'none',
              padding: '0.25rem'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
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
            onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              try {
                const result = await readSubcontractorsFromExcel(file, t, i18n.language);
                if (result.success) {
                  for (const sub of result.data) {
                    const existing = contractors.find(c => trLower(c.name.trim()) === trLower(sub.name.trim()));
                    if (existing) {
                      await window.api.db.update('subcontractor_ledgers', existing.id, {
                        ...sub, project_id: activeProjectId
                      });
                    } else {
                      await window.api.db.create('subcontractor_ledgers', {
                        ...sub, project_id: activeProjectId
                      });
                    }
                  }
                  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('subcontractor_import.import_success', '{{count}} taşeron kaydı başarıyla içe aktarıldı.').replace('{{count}}', result.data.length), type: 'success' } }));
                  fetchContractors();
                }
              } catch (err) {
                window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('common.error_occurred', 'Hata:') + ' ' + (err.message || JSON.stringify(err)), type: 'error' } }));
              }
              e.target.value = null;
            }}
          />
          <button className="btn" style={{ background: '#10B981', color: 'white', border: 'none' }} onClick={() => fileInputRef.current.click()}>
            {t('subcontractor_import.import_btn', 'Excel\'den İçe Aktar')}
          </button>
          <button className="btn" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid #38bdf8' }} onClick={() => generateSubcontractorTemplate(t, i18n.language)}>
            {t('subcontractor_import.download_template', 'Excel Taslağını İndir')}
          </button>
          <select className="btn" style={{ padding: '0.5rem' }} onChange={e => {
            const format = e.target.value;
            if (!format) return;
            const lang = i18n.language;
            const isTr = lang === 'tr';
            const dataToExport = contractors.map(c => ({
              [isTr ? 'Taşeron Adı' : 'Subcontractor Name']: c.name,
              [isTr ? 'Hizmet Alanı' : 'Service Type']: c.service_type,
              [isTr ? 'Telefon' : 'Phone']: c.phone || '-',
              [isTr ? 'Günlük Bedel' : 'Daily Rate']: c.daily_wage,
              [isTr ? 'Durum' : 'Status']: c.status === 'active' ? (isTr ? 'Aktif' : 'Active') : (isTr ? 'Pasif' : 'Passive'),
              [isTr ? 'İSG Başlangıç' : 'ISG Start Date']: c.isg_start_date || '-',
              [isTr ? 'İSG Bitiş' : 'ISG End Date']: c.isg_expiry_date || '-'
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
            {t('subcontractor.add_new', '+ Yeni Taşeron Ekle')}
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
                              onClick={() => handleOpenDrawer(c)}
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
                              onClick={() => handleDelete(c.id)}
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

        {/* Right Column: Widgets / Anomaly & Reports (span 3) */}
        <div style={{ gridColumn: 'span 3', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Subcontractor Anomaly Panel */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              🛡️ {t('subcontractor.anomalies', 'Taşeron Uyarıları')}
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
            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setAnomalyActiveTab('all')}
                style={{
                  background: 'transparent', border: 'none', color: anomalyActiveTab === 'all' ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
                  borderBottom: anomalyActiveTab === 'all' ? '2px solid var(--accent)' : 'none', fontSize: '0.75rem'
                }}
              >
                {t('filters.tab_all', 'Hepsi')} ({filteredNegativeBalance.length + filteredIsgExpired.length + filteredIsgApproaching.length})
              </button>
              <button
                onClick={() => setAnomalyActiveTab('balance')}
                style={{
                  background: 'transparent', border: 'none', color: anomalyActiveTab === 'balance' ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
                  borderBottom: anomalyActiveTab === 'balance' ? '2px solid #ef4444' : 'none', fontSize: '0.75rem'
                }}
              >
                {t('filters.tab_low_balance', 'Bakiye')} ({filteredNegativeBalance.length})
              </button>
              <button
                onClick={() => setAnomalyActiveTab('expired')}
                style={{
                  background: 'transparent', border: 'none', color: anomalyActiveTab === 'expired' ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
                  borderBottom: anomalyActiveTab === 'expired' ? '2px solid #ef4444' : 'none', fontSize: '0.75rem'
                }}
              >
                {t('filters.tab_expired_hse', 'İSG Dolan')} ({filteredIsgExpired.length})
              </button>
              <button
                onClick={() => setAnomalyActiveTab('approaching')}
                style={{
                  background: 'transparent', border: 'none', color: anomalyActiveTab === 'approaching' ? 'var(--text-main)' : 'var(--text-muted)',
                  cursor: 'pointer', fontWeight: '600', paddingBottom: '0.25rem',
                  borderBottom: anomalyActiveTab === 'approaching' ? '2px solid #f59e0b' : 'none', fontSize: '0.75rem'
                }}
              >
                {t('filters.tab_expiring_hse', 'İSG Yaklaşan')} ({filteredIsgApproaching.length})
              </button>
            </div>

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '4px' }}>
              {(filteredNegativeBalance.length === 0 && filteredIsgExpired.length === 0 && filteredIsgApproaching.length === 0) ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: '#34d399', background: 'rgba(52, 211, 153, 0.05)', borderRadius: '12px', border: '1px solid rgba(52, 211, 153, 0.15)', fontSize: '0.8rem' }}>
                  🟢 {t('subcontractor.all_isg_valid', 'Tüm durumlar ve İSG belgeleri güncel.')}
                </div>
              ) : (
                <>
                  {/* Financial Warnings */}
                  {(anomalyActiveTab === 'all' || anomalyActiveTab === 'balance') && filteredNegativeBalance.length > 0 && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                      <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                        ⚠️ {t('anomalies.financial_warnings_title', 'Finansal Uyarılar')} ({filteredNegativeBalance.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {filteredNegativeBalance.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                            <span style={{ fontWeight: '500' }}>{c.name}</span>
                            <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{formatCurrency(c.balance, i18n.language)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ISG Expired */}
                  {(anomalyActiveTab === 'all' || anomalyActiveTab === 'expired') && filteredIsgExpired.length > 0 && (
                    <div style={{ background: 'rgba(239, 68, 68, 0.05)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.15)' }}>
                      <div style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                        🔴 {t('isg.badge_expired', 'İSG Süresi Dolanlar')} ({filteredIsgExpired.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                        {filteredIsgExpired.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                            <span style={{ fontWeight: '500' }}>{c.name}</span>
                            <span style={{ color: '#f87171' }}>{c.isg_expiry_date}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ISG Approaching */}
                  {(anomalyActiveTab === 'all' || anomalyActiveTab === 'approaching') && filteredIsgApproaching.length > 0 && (
                    <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '0.75rem', borderRadius: '10px', border: '1px solid rgba(245, 158, 11, 0.15)' }}>
                      <div style={{ color: '#f59e0b', fontWeight: 'bold', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
                        🟡 {t('isg.badge_approaching', 'İSG Süresi Yaklaşanlar')} ({filteredIsgApproaching.length})
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                        {filteredIsgApproaching.map(c => (
                          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-main)' }}>
                            <span style={{ fontWeight: '500' }}>{c.name}</span>
                            <span style={{ color: '#fbbf24' }}>{t('subcontractor.days_remaining', '{{count}} gün kaldı', { count: c.remainingDays })}</span>
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
              📊 {t('subcontractor.financial_summary', 'Taşeron Finans Özeti')}
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('subcontractor.total_receivable', 'Toplam Taşeron Alacağı')}</span>
                <span style={{ color: '#34d399', fontWeight: 'bold' }}>
                  {formatCurrency(contractors.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0), i18n.language)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{t('subcontractor.total_debt', 'Toplam Taşeron Borcu')}</span>
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>
                  {formatCurrency(contractors.reduce((sum, c) => sum + (c.balance < 0 ? c.balance : 0), 0), i18n.language)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(139, 92, 246, 0.05)', borderRadius: '8px', border: '1px solid rgba(139, 92, 246, 0.15)', fontWeight: 'bold' }}>
                <span style={{ fontSize: '0.85rem' }}>{t('dashboard.net_balance', 'Genel Net Bakiye')}</span>
                <span style={{ color: contractors.reduce((sum, c) => sum + (c.balance || 0), 0) >= 0 ? '#34d399' : '#ef4444' }}>
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
          <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column', padding: '2rem' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
              <h2 className="drawer-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>
                {editingId ? t('subcontractor.edit_title', 'Taşeronu Düzenle') : t('subcontractor.new_title', 'Yeni Taşeron Ekle')}
              </h2>
              <button 
                type="button"
                className="btn btn-danger" 
                onClick={handleCloseDrawer} 
                style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: 'none' }}
              >
                ✕
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
                  🛡️ {t('isg.section_title', 'İSG (İş Sağlığı ve Güvenliği)')}
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
