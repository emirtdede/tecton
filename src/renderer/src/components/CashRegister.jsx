import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { exportToExcel, exportToCSV, exportToJSON } from '../utils/exportUtils';
import TagInput from './ui/TagInput';
import ConfirmationModal from './ui/ConfirmationModal';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatCurrency, formatDate, getCurrencySymbol, formatCurrencySafe } from '../utils/formatUtils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import GuideDrawer from './ui/GuideDrawer';

const CashRegister = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  
  // Rapor State
  const todayStr = new Date().toISOString().split('T')[0];
  const [reportDate, setReportDate] = useState(todayStr);
  const [reportData, setReportData] = useState(null);

  const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  };

  const getLastDayOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
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
    if (val && filterEndDate && new Date(val) > new Date(filterEndDate)) {
      setFilterStartDate(filterEndDate);
      setFilterEndDate(val);
    } else {
      setFilterStartDate(val);
    }
  };
  const handleEndDateChange = (val) => {
    if (val && filterStartDate && new Date(filterStartDate) > new Date(val)) {
      setFilterEndDate(filterStartDate);
      setFilterStartDate(val);
    } else {
      setFilterEndDate(val);
    }
  };
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const cashListBodyRef = useRef(null);

  // Form State
  const [formData, setFormData] = useState({
    trans_date: new Date().toISOString().split('T')[0],
    type: 'Nakit Girişi', // 'Nakit Girişi' | 'Nakit Çıkışı'
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
    if (cashListBodyRef.current) {
      setTimeout(() => {
        cashListBodyRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, 50);
    }
  }, [currentPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStartDate, filterEndDate, filterType, filterProject]);

  const fetchCashData = async () => {
    if (window.api) {
      setLoading(true);
      const data = await window.api.db.read('cash_register');
      const settings = await window.api.db.read('app_settings');
      
      const cName = settings.find(s => s.setting_key === 'company_name')?.setting_value;
      const cLogo = settings.find(s => s.setting_key === 'company_logo')?.setting_value;
      if (cName) setCompanyName(cName);
      if (cLogo) setCompanyLogo(cLogo);
      
      let total = 0;
      data.forEach(t => {
        if (t.type === 'Nakit Girişi') total += t.amount;
        else if (t.type === 'Nakit Çıkışı') total -= t.amount;
      });
      
      setBalance(total);
      setTransactions(data);
      
      const parts = reportDate.split('-');
      fetchReportData(parseInt(parts[0]), parseInt(parts[1]), filterProject);
      
      setLoading(false);
    }
  };

  const fetchReportData = async (year, month, projectId) => {
    if (window.api) {
      const res = await window.api.finance.companyReport(year, month, projectId);
      if (res.success) {
        setReportData(res);
      }
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
      [name]: name === 'amount' ? Number(value) : value
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
      await window.api.db.create('cash_register', dataToSave);
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
        await window.api.db.delete('cash_register', id);
        fetchCashData();
      }
    });
  };

  if (loading) {
    return <div className="text-center"><div className="loading-spinner"></div></div>;
  }

  // Calculate project name
  const getProjectName = (projId) => {
    if (!projId) return t('cash.headquarters');
    const proj = projects.find(p => p.id === projId);
    return proj ? proj.name : t('cash.headquarters');
  };

  // Recalculate dynamic totals based on the selected project filter
  const projectFilteredTransactions = transactions.filter(t => {
    if (filterProject === 'merkez') {
      return !t.project_id;
    } else if (filterProject !== 'all') {
      return t.project_id === Number(filterProject);
    }
    return true;
  });

  let projTotalIn = 0;
  let projTotalOut = 0;
  projectFilteredTransactions.forEach(t => {
    if (t.type === 'Nakit Girişi') projTotalIn += t.amount;
    else if (t.type === 'Nakit Çıkışı') projTotalOut += t.amount;
  });
  const projNetBalance = projTotalIn - projTotalOut;

  // Filtered transactions for current listing (includes dates, search query and type filters)
  const filteredTransactions = transactions.filter(t => {
    let matchStart = true;
    let matchEnd = true;
    let matchType = true;
    let matchSearch = true;
    let matchProject = true;
    
    if (filterStartDate) matchStart = t.trans_date >= filterStartDate;
    if (filterEndDate) matchEnd = t.trans_date <= filterEndDate;
    if (filterType) matchType = t.type === filterType;
    if (searchQuery) matchSearch = t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (filterProject === 'merkez') {
      matchProject = !t.project_id;
    } else if (filterProject !== 'all') {
      matchProject = t.project_id === Number(filterProject);
    }
    
    return matchStart && matchEnd && matchType && matchSearch && matchProject;
  });

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
    const imgWidth = 190;
    const position = 15;

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      
      // Create a temporary container styled as a clean A4 sheet
      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px';
      container.style.background = '#ffffff';
      container.style.color = '#1e293b';
      container.style.fontFamily = "'Inter', 'Noto Sans', 'Arial', sans-serif";
      container.style.padding = '40px';
      
      container.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
          <div>
            ${companyLogo ? `<img src="${companyLogo}" style="max-width: 150px; max-height: 50px; margin-bottom: 10px; display: block;" />` : ''}
            <div style="font-size: 14px; font-weight: bold; color: #334155; font-family: inherit;">${companyName || ''}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: bold; color: #6389b9; margin-bottom: 8px; font-family: inherit;">${t('cash.reportTitle', 'Kasa Hareketleri Raporu').toUpperCase()}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;"><strong>${t('global.filter', 'Filtre')}:</strong> ${projFilterText}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;"><strong>${t('global.dateRange', 'Tarih Aralığı')}:</strong> ${filterStartDate || 'Tümü'} / ${filterEndDate || 'Tümü'}</div>
            <div style="font-size: 11px; color: #64748b; font-family: inherit;"><strong>${t('global.creationDate', 'Oluşturma Tarihi')}:</strong> ${reportDateStr}</div>
          </div>
        </div>
        
        <hr style="border: 0; border-top: 1px solid #cbd5e1; margin-bottom: 20px;" />
        
        <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px; margin-bottom: 25px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 13px; color: #64748b; font-weight: 500; font-family: inherit;">${t('cash.netBalance', 'Net Kasa Bakiyesi')}:</span>
          <span style="font-size: 18px; font-weight: bold; color: ${projNetBalance >= 0 ? '#16a34a' : '#dc2626'}; font-family: inherit;">
            ${formatCurrencySafe(projNetBalance, i18n.language)}
          </span>
        </div>
        
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #334155; font-family: inherit;">
          <thead>
            <tr style="background: #1e3a8a; color: #ffffff;">
              <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('cash.table.date', 'Tarih')}</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('cash.table.type', 'İşlem Türü')}</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #cbd5e1; font-family: inherit;">${t('cash.table.amount', 'Tutar')}</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('pdf_project_site', 'Project / Site')}</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('cash.table.desc', 'Açıklama')}</th>
            </tr>
          </thead>
          <tbody>
            ${chunk.length === 0 ? `
              <tr>
                <td colspan="5" style="padding: 20px; text-align: center; color: #64748b; font-family: inherit;">
                  ${t('cash.table.empty', 'Kasa işlemi bulunamadı.')}
                </td>
              </tr>
            ` : chunk.map(t_row => {
              const typeText = t_row.type === 'Nakit Girişi' 
                ? t('cash.income', 'Nakit Girişi') 
                : t('cash.expense', 'Nakit Çıkışı');
              return `
                <tr style="border-bottom: 1px solid #e2e8f0;">
                  <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${t_row.trans_date}</td>
                  <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${typeText}</td>
                  <td style="padding: 8px 10px; text-align: right; border: 1px solid #e2e8f0; font-weight: 500; font-family: inherit;">${formatCurrencySafe(t_row.amount, i18n.language)}</td>
                  <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${getProjectName(t_row.project_id)}</td>
                  <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${t_row.description || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;

      document.body.appendChild(container);
      
      // Wait for fonts to load
      await document.fonts.ready;
      
      const canvas = await html2canvas(container, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      document.body.removeChild(container);
      
      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const imgHeight = canvas.height * imgWidth / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);
      
      if (index < chunks.length - 1) {
        pdf.addPage();
      }
    }
    
    const trMap = { 'ç':'c', 'ğ':'g', 'ş':'s', 'ö':'o', 'ü':'u', 'ı':'i', 'Ç':'C', 'Ğ':'G', 'Ş':'S', 'Ö':'O', 'Ü':'U', 'İ':'I' };
    const toEn = (str) => {
      if (!str) return '';
      let s = String(str);
      s = s.replace(/[çğşöüıÇĞŞÖÜİ]/g, letter => trMap[letter]);
      s = s.replace(/₺/g, 'TL');
      return s;
    };

    pdf.save(`${toEn(companyName || 'Kasa')}_Raporu.pdf`);
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

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', position: 'relative', fontFamily: "'Inter', 'Noto Sans', 'Arial', sans-serif" }}>
      <header className="header" style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <h2 style={{ margin: 0 }}>{t('cash.title')}</h2>
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
      </header>

      <div className="profile-grid">
        {/* Left Column: Balance, Report & Form */}
        <div className="left-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Main Balance Row */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="glass-card balance-card" style={{ textAlign: 'center', padding: '1.5rem' }}>
              <h3 className="card-subtitle">{t('cash.net_balance')}</h3>
              <div style={{ 
                fontSize: '2.5rem', 
                fontWeight: '700', 
                marginTop: '0.25rem',
                color: projNetBalance >= 0 ? 'var(--success-text)' : 'var(--danger-text)',
                textShadow: projNetBalance >= 0 ? 'var(--success-shadow)' : 'var(--danger-shadow)'
              }}>
                {formatCurrency(projNetBalance, i18n.language)}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="glass-card" style={{ textAlign: 'center', padding: '1rem', background: 'var(--success-bg-light)', border: '1px solid var(--success-border)', boxShadow: 'var(--card-shadow)' }}>
                <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.total_in')}</h4>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success-text)', marginTop: '0.25rem' }}>
                  {formatCurrency(projTotalIn, i18n.language)}
                </div>
              </div>
              <div className="glass-card" style={{ textAlign: 'center', padding: '1rem', background: 'var(--danger-bg-light)', border: '1px solid var(--danger-border)', boxShadow: 'var(--card-shadow)' }}>
                <h4 style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.total_out')}</h4>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-text)', marginTop: '0.25rem' }}>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'var(--accent-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--accent-border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.wage_cost')}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--accent)' }}>{formatCurrency(reportData.summary.totalWageCost, i18n.language)}</div>
                </div>
                <div style={{ background: 'var(--success-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--success-border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.monthly_in')}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--success-text)' }}>{formatCurrency(reportData.summary.totalCashIn, i18n.language)}</div>
                </div>
                <div style={{ background: 'var(--danger-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--danger-border)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.monthly_out')}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--danger-text)' }}>{formatCurrency(reportData.summary.totalCashOut, i18n.language)}</div>
                </div>
                <div style={{ background: 'var(--glass-bg)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', boxShadow: 'var(--card-shadow)' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('cash.net_change')}</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: reportData.summary.netCashFlow >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
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
                  <option value="Nakit Girişi">{t('cash.table.income')} (+)</option>
                  <option value="Nakit Çıkışı">{t('cash.table.expense')} (-)</option>
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
                className={`btn ${formData.type === 'Nakit Girişi' ? 'btn-primary' : 'btn-danger'}`} 
                style={{ width: '100%' }}
              >
                {formData.type === 'Nakit Girişi' ? t('cash.add_in') : t('cash.add_out')}
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
                  <option value="Nakit Girişi">{t('cash.table.income')}</option>
                  <option value="Nakit Çıkışı">{t('cash.table.expense')}</option>
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
              >
                ✕
              </button>
            )}
          </div>
          
          {filteredTransactions.length === 0 ? (
            <p className="text-muted" style={{ marginTop: '2rem', textAlign: 'center' }}>
              {searchQuery ? 'Arama kriterlerine uygun kasa hareketi bulunamadı.' : (t('common.empty_data') || 'Gösterilecek veri bulunamadı.')}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {paginatedTransactions.map(tr => {
                const isIncome = tr.type === 'Nakit Girişi';
                return (
                  <div key={tr.id} style={{ 
                    background: isIncome ? 'var(--success-bg-light)' : 'var(--danger-bg-light)', 
                    border: `1px solid ${isIncome ? 'var(--success-border)' : 'var(--danger-border)'}`, 
                    padding: '1rem', 
                    borderRadius: '8px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center' 
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{formatDate(tr.trans_date, i18n.language)}</span>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.2rem 0.5rem', 
                          borderRadius: '4px', 
                          border: `1px solid var(${isIncome ? '--success-text' : '--danger-text'})`,
                          color: `var(${isIncome ? '--success-text' : '--danger-text'})`
                        }}>{isIncome ? t('cash.table.income') : t('cash.table.expense')}</span>
                      </div>
                      <div className="card-subtitle" style={{ fontSize: '0.9rem' }}>
                        {tr.description || '-'}
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '0.1rem 0.4rem', 
                          borderRadius: '4px', 
                          background: 'rgba(255, 255, 255, 0.05)',
                          color: 'var(--text-muted)'
                        }}>
                          📁 {getProjectName(tr.project_id)}
                        </span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: isIncome ? 'var(--success-text)' : 'var(--danger-text)', fontSize: '1.1rem' }}>
                        {isIncome ? '+' : '-'}{formatCurrency(tr.amount, i18n.language)}
                      </div>
                      <button 
                        onClick={() => handleDelete(tr.id)} 
                        style={{ background: 'transparent', border: 'none', color: 'var(--danger-text)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', marginTop: '0.25rem' }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--glass-border)' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                    {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages} ({filteredTransactions.length} {t('common.records', 'Kayıt')})
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <button 
                      type="button" 
                      disabled={currentPage === 1} 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                      style={{ 
                        padding: '0.4rem 1rem', 
                        fontSize: '0.9rem', 
                        fontWeight: '600', 
                        background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '8px', 
                        color: 'var(--text-main)',
                        cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                        opacity: currentPage === 1 ? 0.5 : 1,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                      onMouseLeave={(e) => { if (currentPage !== 1) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                    >
                      {t('common.prev', 'Önceki')}
                    </button>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages}
                    </span>
                    <button 
                      type="button" 
                      disabled={currentPage === totalPages} 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                      style={{ 
                        padding: '0.4rem 1rem', 
                        fontSize: '0.9rem', 
                        fontWeight: '600', 
                        background: 'rgba(255,255,255,0.03)', 
                        border: '1px solid var(--glass-border)', 
                        borderRadius: '8px', 
                        color: 'var(--text-main)',
                        cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                      onMouseLeave={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                    >
                      {t('common.next', 'Sonraki')}
                    </button>
                  </div>
                </div>
              )}
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
