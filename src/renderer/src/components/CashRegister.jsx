import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { exportToExcel, exportToCSV, exportToJSON } from '../utils/exportUtils';
import TagInput from './ui/TagInput';
import ConfirmationModal from './ui/ConfirmationModal';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatCurrency, formatDate, getCurrencySymbol, formatCurrencySafe, localToday, toLocalDateString } from '../utils/formatUtils';
import jsPDF from 'jspdf';
import { escapeHtml } from '../utils/htmlUtils';
import { createPdfContainer, renderContainerToPdfPage } from '../utils/pdfRenderUtils';
import GuideDrawer from './ui/GuideDrawer';
import apiWrite from '../utils/apiWrite';
import { Trash2, X } from 'lucide-react';
import { logError } from '../utils/logger';
import { CASH_IN, isCashIncome, isCashExpense, normalizeCashType } from '../utils/cashTypes';

import { toAsciiFilename } from '../utils/pdfUtils';
import PageGuideIcon from './ui/PageGuideIcon';
import { reorderRangeForStart, reorderRangeForEnd } from '../utils/dateRangeUtils';
import Pagination from './ui/Pagination';
import pdfStyles from '../utils/pdfStyles';
const CashRegister = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  
  // Rapor State
  const todayStr = localToday();
  const [reportDate, setReportDate] = useState(todayStr);
  const [reportData, setReportData] = useState(null);

  const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const getLastDayOfCurrentMonth = () => {
    const now = new Date();
    return toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  };

  // Project Filter state (initialized dynamically based on active workspace)
  const [filterProject, setFilterProject] = useState(() => {
    return activeProjectId ? String(activeProjectId) : 'all';
  });

  useEffect(() => {
    if (activeProjectId) {
      setFilterProject(String(activeProjectId));
    } else {
      setFilterProject('all');
    }
  }, [activeProjectId]);

  // Filters State
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const handleStartDateChange = (val) => {
    const [start, end] = reorderRangeForStart(val, filterEndDate);
    setFilterStartDate(start);
    setFilterEndDate(end);
  };
  const handleEndDateChange = (val) => {
    const [start, end] = reorderRangeForEnd(val, filterStartDate);
    setFilterStartDate(start);
    setFilterEndDate(end);
  };
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const cashListBodyRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    trans_date: localToday(),
    type: CASH_IN, // CASH_IN | CASH_OUT
    amount: '',
    description: '',
    project_id: activeProjectId ? String(activeProjectId) : ''
  });
  const [cashTags, setCashTags] = useState([]);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      project_id: activeProjectId ? String(activeProjectId) : ''
    }));
  }, [activeProjectId]);

  // Confirmation Modal State
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    if (!cashListBodyRef.current) return;
    // The ref can become null if the list unmounts before the timer fires, and
    // the timer must be cancelled on unmount to avoid touching a dead node.
    const timer = setTimeout(() => {
      cashListBodyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 50);
    return () => clearTimeout(timer);
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStartDate, filterEndDate, filterType, filterProject]);

  // Guards against stale responses overwriting newer data (rapid project/date changes).
  const cashRequestIdRef = useRef(0);
  const reportRequestIdRef = useRef(0);

  const fetchCashData = async () => {
    if (!window.api) return;
    const requestId = ++cashRequestIdRef.current;
    setLoading(true);
    try {
      const [data, settings] = await Promise.all([
        window.api.db.read('cash_register'),
        window.api.db.read('app_settings')
      ]);
      if (requestId !== cashRequestIdRef.current) return;

      const settingsRows = Array.isArray(settings) ? settings : [];
      const cName = settingsRows.find(s => s.setting_key === 'company_name')?.setting_value;
      const cLogo = settingsRows.find(s => s.setting_key === 'company_logo')?.setting_value;
      if (cName) setCompanyName(cName);
      if (cLogo) setCompanyLogo(cLogo);

      setTransactions(Array.isArray(data) ? data : []);
    } catch (error) {
      logError('Failed to load cash register data:', error);
      if (requestId === cashRequestIdRef.current) {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: t('common.error_occurred', 'Hata:'), type: 'error' }
        }));
      }
    } finally {
      // Only the latest request may clear the loading flag; otherwise a stale
      // response can hide the spinner while a newer one is still in flight.
      if (requestId === cashRequestIdRef.current) setLoading(false);
    }
  };

  const fetchReportData = async (year, month, projectId) => {
    if (!window.api) return;
    const requestId = ++reportRequestIdRef.current;
    try {
      const res = await window.api.finance.companyReport(year, month, projectId);
      if (requestId !== reportRequestIdRef.current) return;
      if (res && res.success) {
        setReportData(res);
      }
    } catch (error) {
      logError('Failed to load monthly cash summary:', error);
    }
  };

  useEffect(() => {
    fetchCashData();
  }, []);

  useEffect(() => {
    if (reportDate) {
      const parts = reportDate.split('-');
      if (parts.length >= 2) {
        fetchReportData(parseInt(parts[0]), parseInt(parts[1]), filterProject);
      }
    }
  }, [reportDate, filterProject]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      // Number('') is 0 and Number('abc') is NaN; neither may reach the form.
      [name]: name === 'amount'
        ? (value === '' ? '' : (Number.isNaN(Number(value)) ? prev.amount : Number(value)))
        : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (window.api && formData.amount > 0) {
      const dataToSave = { 
        trans_date: formData.trans_date,
        type: formData.type,
        amount: formData.amount,
        description: formData.description,
        project_id: formData.project_id ? Number(formData.project_id) : null,
        tags: JSON.stringify(cashTags) 
      };
      const res = await apiWrite(window.api.db.create('cash_register', dataToSave));
      // Clear the form only when the row was really written. Previously a
      // rejected insert still wiped the user's typed amount and description.
      if (res && res.success === false) return;
      setFormData(prev => ({ ...prev, amount: '', description: '' }));
      setCashTags([]);
      fetchCashData();
    }
  };

  const handleDelete = (id) => {
    setConfirmModalState({
      isOpen: true,
      title: t('cash.delete_title', 'Kasa İşlemini Sil'),
      message: t('cash.delete_confirm', 'Bu kasa işlemini silmek istediğinize emin misiniz? Bu işlem kasa bakiyesini kalıcı olarak etkileyecektir.'),
      onConfirm: async () => {
        await apiWrite(window.api.db.delete('cash_register', id));
        fetchCashData();
      }
    });
  };

  // Calculate project name
  const getProjectName = (projId) => {
    if (!projId) return t('cash.headquarters');
    const proj = projects.find(p => p.id === projId);
    return proj ? proj.name : t('cash.headquarters');
  };

  // Recalculate dynamic totals based on the selected project filter.
  // Memoized so unrelated state changes (pagination, modals, form typing) don't
  // re-scan the whole transaction list.
  const { projTotalIn, projTotalOut, projNetBalance } = useMemo(() => {
    const rows = transactions.filter(t => {
      if (filterProject === 'merkez') {
        return !t.project_id;
      } else if (filterProject !== 'all') {
        return t.project_id === Number(filterProject);
      }
      return true;
    });

    let totalIn = 0;
    let totalOut = 0;
    for (const t of rows) {
      if (isCashIncome(t.type)) totalIn += Number(t.amount) || 0;
      else if (isCashExpense(t.type)) totalOut += Number(t.amount) || 0;
    }
    return {
      projTotalIn: totalIn,
      projTotalOut: totalOut,
      projNetBalance: totalIn - totalOut
    };
  }, [transactions, filterProject]);

  // Filtered transactions for current listing (dates, search query, type, project)
  const filteredTransactions = useMemo(() => {
    const query = searchQuery ? searchQuery.toLowerCase() : '';
    return transactions.filter(t => {
      if (filterStartDate && !(t.trans_date >= filterStartDate)) return false;
      if (filterEndDate && !(t.trans_date <= filterEndDate)) return false;
      if (filterType && normalizeCashType(t.type) !== filterType) return false;
      if (query && !(t.description && t.description.toLowerCase().includes(query))) return false;

      if (filterProject === 'merkez') return !t.project_id;
      if (filterProject !== 'all') return t.project_id === Number(filterProject);
      return true;
    });
  }, [transactions, filterStartDate, filterEndDate, filterType, searchQuery, filterProject]);

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const generatePDF = async () => {
    const projFilterText = filterProject === 'all' 
      ? t('cash.allCompany') 
      : filterProject === 'merkez' 
        ? t('cash.headquarters') 
        : getProjectName(Number(filterProject));
    
    const reportDateStr = new Date().toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US') + ' ' + new Date().toLocaleTimeString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

    // Group items into chunks of 18 items per page to prevent text/row cut-off
    const pdfItemsPerPage = 18;
    const chunks = [];
    for (let i = 0; i < filteredTransactions.length; i += pdfItemsPerPage) {
      chunks.push(filteredTransactions.slice(i, i + pdfItemsPerPage));
    }

    if (chunks.length === 0) {
      chunks.push([]);
    }

    const pdf = new jsPDF('p', 'mm', 'a4');

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      
      const container = createPdfContainer();
      
      container.innerHTML = `
        <div style="${pdfStyles.reportHeader}">
          <div>
            ${companyLogo ? `<img src="${escapeHtml(companyLogo)}" style="${pdfStyles.companyLogo}" />` : ''}
            <div style="${pdfStyles.companyName}">${escapeHtml(companyName || '')}</div>
          </div>
          <div style="text-align: right;">
            <div style="${pdfStyles.reportTitle}">${t('cash.reportTitle', 'Kasa Hareketleri Raporu').toUpperCase()}</div>
            <div style="${pdfStyles.metaLine}"><strong>${t('global.filter', 'Filtre')}:</strong> ${escapeHtml(projFilterText)}</div>
            <div style="${pdfStyles.metaLine}"><strong>${t('global.dateRange', 'Tarih Aralığı')}:</strong> ${escapeHtml(filterStartDate || 'Tümü')} / ${escapeHtml(filterEndDate || 'Tümü')}</div>
            <div style="${pdfStyles.metaLineTight}"><strong>${t('global.creationDate', 'Oluşturma Tarihi')}:</strong> ${escapeHtml(reportDateStr)}</div>
          </div>
        </div>
        
        <hr style="${pdfStyles.headerDivider}" />
        
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px; margin-bottom: 25px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 13px; color: #64748b; font-weight: 500; font-family: inherit;">${t('cash.netBalance', 'Net Kasa Bakiyesi')}:</span>
          <span style="font-size: 18px; font-weight: bold; color: ${projNetBalance >= 0 ? '#16a34a' : 'var(--danger)'}; font-family: inherit;">
            ${formatCurrencySafe(projNetBalance, i18n.language)}
          </span>
        </div>
        
        <table style="${pdfStyles.table}">
          <thead>
            <tr style="${pdfStyles.tableHeadRow}">
              <th style="${pdfStyles.tableHeadCell}">${t('cash.table.date', 'Tarih')}</th>
              <th style="${pdfStyles.tableHeadCell}">${t('cash.table.type', 'İşlem Türü')}</th>
              <th style="${pdfStyles.tableHeadCellRight}">${t('cash.table.amount', 'Tutar')}</th>
              <th style="${pdfStyles.tableHeadCell}">${t('pdf_project_site', 'Project / Site')}</th>
              <th style="${pdfStyles.tableHeadCell}">${t('cash.table.desc', 'Açıklama')}</th>
            </tr>
          </thead>
          <tbody>
            ${chunk.length === 0 ? `
              <tr>
                <td colspan="5" style="${pdfStyles.emptyCell}">
                  ${t('cash.table.empty', 'Kasa işlemi bulunamadı.')}
                </td>
              </tr>
            ` : chunk.map(t_row => {
              const typeText = isCashIncome(t_row.type) 
                ? t('cash.income', 'Nakit Girişi') 
                : t('cash.expense', 'Nakit Çıkışı');
              return `
                <tr style="${pdfStyles.tableRow}">
                  <td style="${pdfStyles.tableCell}">${escapeHtml(t_row.trans_date)}</td>
                  <td style="${pdfStyles.tableCell}">${escapeHtml(typeText)}</td>
                  <td style="padding: 8px 10px; text-align: right; border: 1px solid #e2e8f0; font-weight: 500; font-family: inherit;">${formatCurrencySafe(t_row.amount, i18n.language)}</td>
                  <td style="${pdfStyles.tableCell}">${escapeHtml(getProjectName(t_row.project_id))}</td>
                  <td style="${pdfStyles.tableCell}">${escapeHtml(t_row.description || '-')}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      await renderContainerToPdfPage(pdf, container, {
        addPage: index < chunks.length - 1
      });
    }
    

    pdf.save(`${toAsciiFilename(companyName || 'Kasa')}_Raporu.pdf`);
  };

  const handleExport = (format) => {
    const dataToExport = filteredTransactions.map(t_row => ({
      [t('cash.table.date')]: t_row.trans_date,
      [t('cash.table.type')]: t_row.type,
      [t('cash.table.amount')]: t_row.amount,
      [t('pdf_project_site', 'Project / Site')]: getProjectName(t_row.project_id),
      [t('cash.table.desc')]: t_row.description || '-'
    }));

    if (format === 'excel') exportToExcel(dataToExport, t('cash.title'));
    if (format === 'csv') exportToCSV(dataToExport, t('cash.title'));
    if (format === 'json') exportToJSON(dataToExport, t('cash.title'));
    if (format === 'pdf') generatePDF();
  };

  // Kept after every hook so the hook order stays stable while the first load
  // resolves; returning earlier made React see a different hook sequence and
  // threw "change in the order of Hooks".
  if (loading) {
    return <div className="text-center" style={{ padding: '3rem' }}><div className="loading-spinner"></div></div>;
  }

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', fontFamily: 'inherit' }}>
      <header className="header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h1 style={{ margin: 0 }}>{t('cash.title')}</h1>
          <PageGuideIcon onClick={() => setHelpOpen(true)} fontSize="1.4rem" />
        </div>
      </header>

      <div className="profile-grid">
        {/* Left Column: Balance, Report & Form */}
        <div className="left-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Main Balance Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-card balance-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <h3 className="card-subtitle">{t('cash.net_balance')}</h3>
              <div style={{
                fontSize: '2.25rem',
                fontWeight: '700',
                letterSpacing: '-0.02em',
                marginTop: '0.25rem',
                color: 'var(--text-primary)'
              }}>
                {formatCurrency(projNetBalance, i18n.language)}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t('cash.total_in')}</h4>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', letterSpacing: '-0.01em', color: 'var(--success-text)', marginTop: '0.25rem' }}>
                  {formatCurrency(projTotalIn, i18n.language)}
                </div>
              </div>
              <div className="glass-card" style={{ textAlign: 'center', padding: '1rem' }}>
                <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{t('cash.total_out')}</h4>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', letterSpacing: '-0.01em', color: 'var(--danger-text)', marginTop: '0.25rem' }}>
                  {formatCurrency(projTotalOut, i18n.language)}
                </div>
              </div>
            </div>
          </div>

        {/* Company Monthly Summary */}
        <div className="glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 className="card-title">{t('cash.monthly_summary')}</h3>
            <div style={{ width: '12rem' }}>
              <CustomDatePicker
                className="form-input"
                value={reportDate}
                popperPlacement="bottom-end"
                onChange={(e) => {
                  if (e.target.value) {
                    setReportDate(e.target.value);
                  }
                }}
              />
            </div>
          </div>
            
            {reportData ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="stat-tile">
                  <div className="stat-tile-label">{t('cash.wage_cost')}</div>
                  <div className="stat-tile-value">{formatCurrency(reportData.summary.totalWageCost, i18n.language)}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-label">{t('cash.monthly_in')}</div>
                  <div className="stat-tile-value" style={{ color: 'var(--success-text)' }}>{formatCurrency(reportData.summary.totalCashIn, i18n.language)}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-label">{t('cash.monthly_out')}</div>
                  <div className="stat-tile-value" style={{ color: 'var(--danger-text)' }}>{formatCurrency(reportData.summary.totalCashOut, i18n.language)}</div>
                </div>
                <div className="stat-tile">
                  <div className="stat-tile-label">{t('cash.net_change')}</div>
                  <div className="stat-tile-value" style={{ color: reportData.summary.netCashFlow >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                    {reportData.summary.netCashFlow > 0 ? '+' : ''}{formatCurrency(reportData.summary.netCashFlow, i18n.language)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center"><div className="loading-spinner"></div></div>
            )}
          </div>

          <div className="glass-card">
            <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>{t('cash.new_transaction', 'Yeni Nakit İşlemi')}</h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('cash.table.date')}</label>
                <CustomDatePicker name="trans_date" className="form-input" value={formData.trans_date} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('cash.table.type')}</label>
                <select name="type" className="form-input" value={formData.type} onChange={handleChange} required>
                  <option value="income">{t('cash.table.income')} (+)</option>
                  <option value="expense">{t('cash.table.expense')} (-)</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('cash.relatedProject')}</label>
                <select name="project_id" className="form-input" value={formData.project_id} onChange={handleChange}>
                  <option value="">{t('cash.headquarters')}</option>
                  {activeProjectId && (
                    <option value={activeProjectId}>
                      {t('common.active_project', 'Aktif Şantiye')}: {projects.find(p => p.id === activeProjectId)?.name}
                    </option>
                  )}
                  {projects.filter(p => p.id !== activeProjectId).map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">{t('cash.table.amount')} ({getCurrencySymbol(i18n.language)})</label>
                <input type="number" name="amount" className="form-input" min="1" step="0.01" value={formData.amount} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('cash.table.desc')}</label>
                <input type="text" name="description" className="form-input" value={formData.description} onChange={handleChange} placeholder={t('cash.desc_ph')} required />
              </div>
              <div className="form-group">
                <label className="form-label">{t('cash.tags', 'Etiketler')}</label>
                <TagInput tags={cashTags} setTags={setCashTags} placeholder={t('cash.tags_ph')} />
              </div>
              <button 
                type="submit" 
                className={`btn ${isCashIncome(formData.type) ? 'btn-primary' : 'btn-danger'}`} 
                style={{ width: '100%' }}
              >
                {isCashIncome(formData.type) ? t('cash.add_in') : t('cash.add_out')}
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: History */}
        <div ref={cashListBodyRef} className="right-panel glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 className="card-title" style={{ marginBottom: 0 }}>{t('cash.cash_history')}</h3>
            <select className="btn" style={{ padding: '0.5rem' }} onChange={e => handleExport(e.target.value)} value="">
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
                <CustomDatePicker className="form-input" value={filterStartDate} onChange={e => handleStartDateChange(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('cash.end_date')}</label>
                <CustomDatePicker className="form-input" value={filterEndDate} onChange={e => handleEndDateChange(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('cash.trans_dir')}</label>
                <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="">{t('cash.all')}</option>
                  <option value="income">{t('cash.table.income')}</option>
                  <option value="expense">{t('cash.table.expense')}</option>
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
                aria-label={t('common.clear', 'Temizle')}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          
          {filteredTransactions.length === 0 ? (
            <p className="text-muted" style={{ marginTop: '2rem', textAlign: 'center' }}>
              {searchQuery ? t('cash.no_results', 'Arama kriterlerine uygun kasa hareketi bulunamadı.') : t('common.empty_data', 'Gösterilecek veri bulunamadı.')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {paginatedTransactions.map(tr => {
                const isIncome = isCashIncome(tr.type);
                return (
                  <div key={tr.id} className="cash-row">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{formatDate(tr.trans_date, i18n.language)}</span>
                        <span className={`pill ${isIncome ? 'pill-success' : 'pill-danger'}`}>
                          {isIncome ? t('cash.table.income') : t('cash.table.expense')}
                        </span>
                      </div>
                      <div className="card-subtitle" style={{ fontSize: '0.9rem' }}>
                        {tr.description || '-'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        <span className="pill">
                           {getProjectName(tr.project_id)}
                        </span>
                      </div>
                    </div>
                    <div className="row-actions">
                      <span style={{ fontWeight: '600', letterSpacing: '-0.01em', color: isIncome ? 'var(--success-text)' : 'var(--danger-text)', fontSize: '0.9375rem', marginInlineEnd: '0.25rem' }}>
                        {isIncome ? '+' : '-'}{formatCurrency(tr.amount, i18n.language)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDelete(tr.id)}
                        className="icon-btn is-danger"
                        title={t('common.delete', 'Sil')}
                        aria-label={t('common.delete', 'Sil')}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Pagination - shared component (ui/Pagination) */}
              <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalRecords={filteredTransactions.length} />
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.onConfirm}
        title={confirmModalState.title}
        message={confirmModalState.message}
      />

      <GuideDrawer 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title={t('guides.cash.title')} 
        desc="" 
        h1={t('guides.cash.q1.title')} 
        p1={t('guides.cash.q1.desc')} 
        h2={t('guides.cash.q2.title')} 
        p2={t('guides.cash.q2.desc')} 
        h3={t('guides.cash.q3.title')} 
        p3={t('guides.cash.q3.desc')} 
        h4={t('guides.cash.q4.title')} 
        p4={t('guides.cash.q4.desc')} 
        h5={t('guides.cash.q5.title')} 
        p5={t('guides.cash.q5.desc')} 
        h6={t('guides.cash.q6.title')} 
        p6={t('guides.cash.q6.desc')} 
      />
    </div>
  );
};

export default CashRegister;
