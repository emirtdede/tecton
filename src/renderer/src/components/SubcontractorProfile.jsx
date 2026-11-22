import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import { escapeHtml } from '../utils/htmlUtils';
import { createPdfContainer, renderContainerToPdfPage } from '../utils/pdfRenderUtils';
import { exportToExcel, exportToCSV, exportToJSON } from '../utils/exportUtils';
import ConfirmationModal from './ui/ConfirmationModal';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatCurrency, formatDate, getCurrencySymbol, formatCurrencySafe, localToday } from '../utils/formatUtils';
import { logError } from '../utils/logger';
import GuideDrawer from './ui/GuideDrawer';
import apiWrite, { apiMessage } from '../utils/apiWrite';
import { LEDGER_PAYMENT, LEDGER_PROGRESS, isLedgerPayment, isLedgerProgress, normalizeLedgerType } from '../utils/ledgerTypes';

import { toAsciiFilename } from '../utils/pdfUtils';
import PageGuideIcon from './ui/PageGuideIcon';
import { clampRangeForStart, clampRangeForEnd } from '../utils/dateRangeUtils';
import Pagination from './ui/Pagination';
import pdfStyles from '../utils/pdfStyles';
import { parseTags } from '../utils/tagUtils';
const SubcontractorProfile = ({ subcontractor, onBack }) => {
  const { t, i18n } = useTranslation();
  const [projectName, setProjectName] = useState('');
  
  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('hakedis'); // 'hakedis' | 'odeme'
  
  // Date filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const handleStartDateChange = (val) => {
    const [start, end] = clampRangeForStart(val, filterEndDate);
    setFilterStartDate(start);
    setFilterEndDate(end);
  };

  const handleEndDateChange = (val) => {
    const [start, end] = clampRangeForEnd(val, filterStartDate);
    setFilterStartDate(start);
    setFilterEndDate(end);
  };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 4;
  
  const [reportFilterText, setReportFilterText] = useState('');
  const [reportFilterType, setReportFilterType] = useState('all'); // 'all' | 'progress' | 'payment'
  
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');

  const parsedTags = parseTags(subcontractor && subcontractor.tags);

  // Forms
  const [hakedisData, setHakedisData] = useState({
    trans_date: localToday(),
    amount: '',
    description: ''
  });
  const [hakedisTags, setHakedisTags] = useState([]);

  const [odemeData, setOdemeData] = useState({
    trans_date: localToday(),
    amount: '',
    description: ''
  });
  const [odemeTags, setOdemeTags] = useState([]);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [helpOpen, setHelpOpen] = useState(false);

  const historyRef = useRef(null);

  // Guards against stale responses overwriting newer data when the profile is
  // switched quickly or the component unmounts mid-fetch.
  const profileRequestIdRef = useRef(0);

  const fetchProfileData = async () => {
    if (window.api && subcontractor) {
      const requestId = ++profileRequestIdRef.current;

      try {
        const [settings, allProjects, rawTransactions] = await Promise.all([
          window.api.db.read('app_settings'),
          window.api.db.read('projects'),
          window.api.db.read('subcontractor_transactions', { subcontractor_id: subcontractor.id })
        ]);
        if (requestId !== profileRequestIdRef.current) return;

        const settingsRows = Array.isArray(settings) ? settings : [];
        const cName = settingsRows.find(s => s.setting_key === 'company_name')?.setting_value;
        const cLogo = settingsRows.find(s => s.setting_key === 'company_logo')?.setting_value;
        if (cName) setCompanyName(cName);
        if (cLogo) setCompanyLogo(cLogo);

        const matchedProj = (allProjects || []).find(p => p.id == subcontractor.project_id);
        setProjectName(matchedProj ? matchedProj.name : '');

        setTransactions(Array.isArray(rawTransactions) ? rawTransactions : []);
      } catch (err) {
        // Three sequential unguarded reads; one rejection blanked the profile
        // with an unhandled promise rejection.
        if (requestId !== profileRequestIdRef.current) return;
        logError('Subcontractor profile fetch failed:', err);
      }
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [subcontractor.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterStartDate, filterEndDate]);

  const handleHakedisChange = (e) => {
    const { name, value } = e.target;
    setHakedisData(prev => ({
      ...prev,
      [name]: name === 'amount'
        ? (value === '' ? '' : (Number.isNaN(Number(value)) ? prev.amount : Number(value)))
        : value
    }));
  };

  const handleOdemeChange = (e) => {
    const { name, value } = e.target;
    setOdemeData(prev => ({
      ...prev,
      [name]: name === 'amount'
        ? (value === '' ? '' : (Number.isNaN(Number(value)) ? prev.amount : Number(value)))
        : value
    }));
  };

  const handleSaveHakedis = async (e) => {
    e.preventDefault();
    if (window.api && hakedisData.amount > 0) {
      const dataToSave = {
        subcontractor_id: subcontractor.id,
        trans_date: hakedisData.trans_date,
        type: LEDGER_PROGRESS,
        amount: hakedisData.amount,
        description: hakedisData.description,
        project_id: subcontractor.project_id,
        tags: JSON.stringify(hakedisTags)
      };
      
      const res = await apiWrite(window.api.db.create('subcontractor_transactions', dataToSave));
      if (res && res.success === false) return;
      setHakedisData(prev => ({ ...prev, amount: '', description: '' }));
      setHakedisTags([]);
      fetchProfileData();
    }
  };

  const handleSaveOdeme = async (e) => {
    e.preventDefault();
    if (window.api && odemeData.amount > 0) {
      const cashDesc = t('subcontractor_profile.cash_desc', '[{{name}}] - Taşeron Ödemesi', { name: subcontractor.name });

      // Atomic call: the cash-out row and its subcontractor ledger entry are
      // written in one transaction, so a failure cannot leave money recorded in
      // the register without a matching ledger entry.
      const res = await window.api.finance.createSubcontractorTransaction({
        subcontractor_id: subcontractor.id,
        trans_date: odemeData.trans_date,
        type: LEDGER_PAYMENT,
        amount: odemeData.amount,
        description: odemeData.description || cashDesc,
        project_id: subcontractor.project_id,
        tags: JSON.stringify(odemeTags)
      });

      if (res && res.success === false) {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: apiMessage(res, t('common.error_occurred', 'Hata:')), type: 'error' }
        }));
        return;
      }

      setOdemeData(prev => ({ ...prev, amount: '', description: '' }));
      setOdemeTags([]);
      fetchProfileData();
    }
  };

  const handleDeleteTransaction = (tr) => {
    setConfirmModal({
      isOpen: true,
      title: t('subcontractor_profile.delete_title', 'İşlemi Sil'),
      message: t('subcontractor_profile.delete_msg', 'Bu işlemi silmek istediğinize emin misiniz? Eğer bu bir ödeme ise Kasa tablosundan da silinecektir.'),
      onConfirm: async () => {
        if (!window.api) return;
        // Single atomic call: the subcontractor row and its linked cash entry are
        // soft-deleted in one transaction, so a failure cannot leave an orphaned
        // cash record skewing the project balance.
        const res = await window.api.finance.deleteSubcontractorTransaction(tr.id);
        if (res && res.success === false) {
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: { message: apiMessage(res, t('common.error_occurred', 'Hata:')), type: 'error' }
          }));
          return;
        }
        fetchProfileData();
      }
    });
  };

  const handleWhatsAppSend = () => {
    if (!subcontractor || !subcontractor.phone) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('subcontractor_profile.whatsapp_no_phone', 'Taşeronun kayıtlı telefon numarası bulunamadı.'), type: 'warning' } }));
      return;
    }
    
    let cleanPhone = subcontractor.phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;
    else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);
    
    const formattedEarned = formatCurrency(reportDonemHakedis, i18n.language);
    const formattedPaid = formatCurrency(reportDonemOdeme, i18n.language);
    const formattedBalance = formatCurrency(reportYeniBakiye, i18n.language);
    
    const messageTemplate = t('subcontractor_profile.whatsapp_message_template', 
      'Sayın {{name}}, {{startDate}} - {{endDate}} tarihleri arasındaki hesap ekstreniz:\n\n- Toplam Hak Ediş: {{earned}}\n- Toplam Ödeme: {{paid}}\n- Kalan Bakiye: {{balance}}\n\nBilgilerinize sunarız.'
    );
    
    const message = messageTemplate
      .replace('{{name}}', subcontractor.name)
      .replace('{{startDate}}', filterStartDate || '')
      .replace('{{endDate}}', filterEndDate || '')
      .replace('{{earned}}', formattedEarned)
      .replace('{{paid}}', formattedPaid)
      .replace('{{balance}}', formattedBalance);
      
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleExport = (format) => {
    const exportData = reportTransactions.map(tr => ({
      [t('global.date', 'Tarih')]: formatDate(tr.trans_date, i18n.language),
      [t('global.actionType', 'İşlem Türü')]: isLedgerProgress(tr.type) ? t('subcontractor_profile.earned_badge', 'Hakediş') : t('subcontractor_profile.payment_badge', 'Ödeme'),
      [t('global.description', 'Açıklama')]: tr.description || '-',
      [t('global.amount', 'Tutar')]: formatCurrencySafe(tr.amount, i18n.language)
    }));

    exportData.push({
      [t('global.date', 'Tarih')]: '',
      [t('global.actionType', 'İşlem Türü')]: '',
      [t('global.description', 'Açıklama')]: t('subcontractor_profile.new_balance', 'Yeni Bakiye') + ':',
      [t('global.amount', 'Tutar')]: formatCurrencySafe(reportYeniBakiye, i18n.language)
    });

    const fileName = `${subcontractor.name.replace(/\s+/g, '_')}_Cari_Ekstre`;
    
    if (format === 'excel') exportToExcel(exportData, fileName);
    else if (format === 'csv') exportToCSV(exportData, fileName);
    else if (format === 'json') exportToJSON(exportData, fileName);
  };

  const generatePDF = async () => {
    const reportDateStr = new Date().toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US') + ' ' + new Date().toLocaleTimeString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

    // Group items into chunks of 15 items per page to prevent text/row cut-off
    const pdfItemsPerPage = 15;
    const chunks = [];
    const transactionsList = reportTransactions || [];
    for (let i = 0; i < transactionsList.length; i += pdfItemsPerPage) {
      chunks.push(transactionsList.slice(i, i + pdfItemsPerPage));
    }

    if (chunks.length === 0) chunks.push([]);

    const pdf = new jsPDF('p', 'mm', 'a4');

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      
      const container = createPdfContainer();
      
      const isFirstPage = index === 0;
      const isLastPage = index === chunks.length - 1;
      
      let headerHtml = `
        <div style="${pdfStyles.reportHeader}">
          <div>
            ${companyLogo && isFirstPage ? `<img src="${escapeHtml(companyLogo)}" style="${pdfStyles.companyLogo}" />` : ''}
            <div style="${pdfStyles.companyName}">${escapeHtml(companyName || '')}</div>
          </div>
          <div style="text-align: right;">
            <div style="${pdfStyles.reportTitle}">${t('subcontractor_profile.statementTitle', 'Taşeron Cari Ekstresi').toUpperCase()}</div>
            <div style="${pdfStyles.metaLine}"><strong>${t('global.filter', 'Filtre')}:</strong> ${escapeHtml(projectName ? projectName : t('global.unspecified', 'Belirtilmemiş'))}</div>
            <div style="${pdfStyles.metaLine}"><strong>${t('global.dateRange', 'Tarih Aralığı')}:</strong> ${escapeHtml(filterStartDate || 'Tümü')} / ${escapeHtml(filterEndDate || 'Tümü')}</div>
            <div style="${pdfStyles.metaLineTight}"><strong>${t('global.creationDate', 'Oluşturma Tarihi')}:</strong> ${escapeHtml(reportDateStr)}</div>
          </div>
        </div>
        <hr style="${pdfStyles.headerDivider}" />
      `;
      
      let subInfoHtml = `
        <div style="margin-bottom: 20px; font-family: inherit;">
          <div style="font-size: 14px; font-weight: bold; color: #1e293b; margin-bottom: 6px; font-family: inherit;">${escapeHtml(subcontractor.name)}</div>
          <div style="font-size: 11px; color: #64748b; display: flex; gap: 15px; flex-wrap: wrap; font-family: inherit;">
            <span><strong>${t('recycle.tableProject', 'Şantiye')}:</strong> ${escapeHtml(projectName ? projectName : t('global.unspecified', 'Belirtilmemiş'))}</span>
            <span><strong>${t('subcontractor_profile.service_type', 'Hizmet Türü')}:</strong> ${escapeHtml(subcontractor.service_type || '-')}</span>
            <span><strong>${t('worker.phone', 'Telefon')}:</strong> ${escapeHtml(subcontractor.phone || '-')}</span>
          </div>
        </div>
      `;

      let summaryCardsHtml = '';
      if (isFirstPage) {
        summaryCardsHtml = `
          <div style="display: flex; gap: 10px; margin-bottom: 25px; font-family: inherit;">
            <div style="${pdfStyles.summaryBox}">
              <div style="${pdfStyles.metaLine}">${t('subcontractor_profile.prev_balance', 'Devreden Bakiye')}</div>
              <div style="${pdfStyles.companyName}">${formatCurrencySafe(reportDevreden, i18n.language)}</div>
            </div>
            <div style="${pdfStyles.summaryBox}">
              <div style="${pdfStyles.metaLine}">${t('subcontractor_profile.period_earned', 'Dönem Hakedişi')}</div>
              <div style="font-size: 14px; font-weight: bold; color: #16a34a; font-family: inherit;">+${formatCurrencySafe(reportDonemHakedis, i18n.language)}</div>
            </div>
            <div style="${pdfStyles.summaryBox}">
              <div style="${pdfStyles.metaLine}">${t('subcontractor_profile.period_paid', 'Dönem Ödemesi')}</div>
              <div style="font-size: 14px; font-weight: bold; color: #dc2626; font-family: inherit;">-${formatCurrencySafe(reportDonemOdeme, i18n.language)}</div>
            </div>
            <div style="${pdfStyles.summaryBox}">
              <div style="${pdfStyles.metaLine}">${t('subcontractor_profile.new_balance', 'Yeni Bakiye')}</div>
              <div style="font-size: 14px; font-weight: bold; color: ${reportYeniBakiye >= 0 ? '#16a34a' : '#dc2626'}; font-family: inherit;">${formatCurrencySafe(reportYeniBakiye, i18n.language)}</div>
            </div>
          </div>
        `;
      }

      let tableRowsHtml = '';
      if (chunk.length === 0) {
        tableRowsHtml = `
          <tr>
            <td colspan="4" style="${pdfStyles.emptyCell}">
              ${t('subcontractor_profile.no_records', 'Bu tarih aralığında kayıt bulunamadı.')}
            </td>
          </tr>
        `;
      } else {
        tableRowsHtml = chunk.map(item => {
          const isHakedis = isLedgerProgress(item.type);
          const typeText = isHakedis 
            ? t('subcontractor_profile.earned_badge', 'Hakediş') 
            : t('subcontractor_profile.payment_badge', 'Ödeme');
          const amountSign = isHakedis ? '+' : '-';
          const amountColor = isHakedis ? '#16a34a' : '#dc2626';
          return `
            <tr style="${pdfStyles.tableRow}">
              <td style="${pdfStyles.tableCell}">${escapeHtml(formatDate(item.trans_date, i18n.language))}</td>
              <td style="${pdfStyles.tableCell}">${escapeHtml(typeText)}</td>
              <td style="${pdfStyles.tableCell}">${escapeHtml(item.description || '-')}</td>
              <td style="padding: 8px 10px; text-align: right; border: 1px solid #e2e8f0; font-weight: 500; color: ${amountColor}; font-family: inherit;">${amountSign}${formatCurrencySafe(item.amount, i18n.language)}</td>
            </tr>
          `;
        }).join('');
      }

      let tableHtml = `
        <table style="${pdfStyles.table}">
          <thead>
            <tr style="${pdfStyles.tableHeadRow}">
              <th style="${pdfStyles.tableHeadCell}">${t('global.date', 'Tarih')}</th>
              <th style="${pdfStyles.tableHeadCell}">${t('global.actionType', 'İşlem Türü')}</th>
              <th style="${pdfStyles.tableHeadCell}">${t('global.description', 'Açıklama')}</th>
              <th style="${pdfStyles.tableHeadCellRight}">${t('global.amount', 'Tutar')}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      `;

      let signatureHtml = '';
      if (isLastPage) {
        signatureHtml = `
          <div style="margin-top: 60px; display: flex; justify-content: space-between; font-family: inherit;">
            <div style="${pdfStyles.signatureCell}">
              <hr style="${pdfStyles.signatureLine}" />
              <div style="${pdfStyles.signatureLabel}">${t('pdf.signatureSubcontractor', 'Taşeron (Kaşe/İmza)')}</div>
            </div>
            <div style="${pdfStyles.signatureCell}">
              <hr style="${pdfStyles.signatureLine}" />
              <div style="${pdfStyles.signatureLabel}">${t('pdf.signatureCompany', 'Firma Yetkilisi (Kaşe/İmza)')}</div>
            </div>
          </div>
        `;
      }

      container.innerHTML = `
        ${headerHtml}
        ${subInfoHtml}
        ${summaryCardsHtml}
        ${tableHtml}
        ${signatureHtml}
      `;

      await renderContainerToPdfPage(pdf, container, {
        addPage: index < chunks.length - 1
      });
    }


    pdf.save(`${toAsciiFilename(subcontractor.name)}_Cari_Hesap_Ekstresi.pdf`);
  };

  // Hesaplamalar (Genel) - memoized so typing in filters / paginating does not
  // re-scan every transaction (this used to run on every render).
  const { totalHakedis, totalOdeme, netBalance } = useMemo(() => {
    let hakedis = 0;
    let odeme = 0;
    for (const t of transactions) {
      if (isLedgerProgress(t.type)) hakedis += t.amount;
      else if (isLedgerPayment(t.type)) odeme += t.amount;
    }
    return { totalHakedis: hakedis, totalOdeme: odeme, netBalance: hakedis - odeme };
  }, [transactions]);

  // Hesaplamalar (Rapor İçin)
  const { reportTransactions, reportDevreden, reportDonemHakedis, reportDonemOdeme, reportYeniBakiye } = useMemo(() => {
    let devreden = 0;
    let donemHakedis = 0;
    let donemOdeme = 0;

    const rows = transactions.filter(t => {
      // Devreden Bakiye
      if (filterStartDate && new Date(t.trans_date) < new Date(filterStartDate)) {
        if (isLedgerProgress(t.type)) devreden += t.amount;
        else if (isLedgerPayment(t.type)) devreden -= t.amount;
        return false;
      }

      // Bitiş tarihi sonrası
      if (filterEndDate && new Date(t.trans_date) > new Date(filterEndDate)) {
        return false;
      }

      // Dönem içi
      if (isLedgerProgress(t.type)) donemHakedis += t.amount;
      else if (isLedgerPayment(t.type)) donemOdeme += t.amount;

      return true;
    }).filter(t => {
      if (reportFilterType !== 'all' && normalizeLedgerType(t.type) !== reportFilterType) return false;
      if (reportFilterText) {
        const matchText = (t.description || '').toLowerCase().includes(reportFilterText.toLowerCase());
        if (!matchText) return false;
      }
      return true;
    }).sort((a, b) => new Date(b.trans_date) - new Date(a.trans_date));

    return {
      reportTransactions: rows,
      reportDevreden: devreden,
      reportDonemHakedis: donemHakedis,
      reportDonemOdeme: donemOdeme,
      reportYeniBakiye: devreden + donemHakedis - donemOdeme
    };
  }, [transactions, filterStartDate, filterEndDate, reportFilterType, reportFilterText]);

  const filteredTransactions = useMemo(
    () => transactions.filter(t => {
      const wanted = activeTab === 'hakedis' ? LEDGER_PROGRESS : LEDGER_PAYMENT;
      return normalizeLedgerType(t.type) === wanted &&
             (!filterStartDate || t.trans_date >= filterStartDate) &&
             (!filterEndDate || t.trans_date <= filterEndDate);
    }).sort((a, b) => new Date(b.trans_date) - new Date(a.trans_date)),
    [transactions, activeTab, filterStartDate, filterEndDate]
  );

  const itemsToPaginate = activeTab === 'rapor' ? reportTransactions : filteredTransactions;
  const totalPages = Math.ceil(itemsToPaginate.length / ITEMS_PER_PAGE) || 1;
  const paginatedTransactions = itemsToPaginate.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <div className="worker-profile" style={{ fontFamily: "'Inter', 'Noto Sans', 'Arial', sans-serif" }}>
      <div style={{ padding: '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <button className="btn" style={{ marginBottom: 0, padding: '0.5rem 1rem' }} onClick={onBack}>← {t('common.back', 'Geri')}</button>
          <PageGuideIcon onClick={() => setHelpOpen(true)} />
        </div>
        
        <div className="profile-grid" style={{ marginTop: '0.5rem', gridTemplateColumns: '350px 1fr' }}>
          {/* Sol Kolon - Bilgi ve Formlar */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '1rem', gap: '0.75rem', width: '350px', height: 'calc(100vh - 150px)', boxSizing: 'border-box' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', fontWeight: 'bold', margin: '0 auto', color: '#fff' }}>
              {subcontractor.name.charAt(0)}
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem', marginTop: '0.5rem' }}>{subcontractor.name}</h2>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem' }}>{subcontractor.service_type}</div>
            
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', margin: '0.25rem 0 0.5rem 0' }}>
              {projectName && (
                <span style={{ fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                   {projectName}
                </span>
              )}
              {(() => {
                const expiryDate = subcontractor.isg_expiry_date;
                if (!expiryDate) {
                  return (
                    <span style={{ fontSize: '0.8rem', background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                       {t('isg.badge_undefined', 'İSG Tanımsız')}
                    </span>
                  );
                }
                const today = new Date(); today.setHours(0, 0, 0, 0);
                const expiry = new Date(expiryDate); expiry.setHours(0, 0, 0, 0);
                const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
                let badgeBg, badgeColor, badgeText, badgeIcon;
                if (diffDays < 0) {
                  badgeBg = 'rgba(239, 68, 68, 0.2)'; badgeColor = '#f87171'; badgeIcon = ''; badgeText = t('isg.badge_expired', 'İSG Süresi Doldu');
                } else if (diffDays <= 30) {
                  badgeBg = 'rgba(245, 158, 11, 0.2)'; badgeColor = '#fbbf24'; badgeIcon = ''; badgeText = t('isg.badge_approaching', 'İSG Yaklaşıyor') + ` (${diffDays} ${t('isg.days', 'gün')})`;
                } else {
                  badgeBg = 'rgba(16, 185, 129, 0.2)'; badgeColor = '#34d399'; badgeIcon = ''; badgeText = t('isg.badge_valid', 'İSG Geçerli');
                }
                return (
                  <span style={{ fontSize: '0.8rem', background: badgeBg, color: badgeColor, padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                    {badgeIcon} {badgeText}
                  </span>
                );
              })()}
              {parsedTags.map((tag, idx) => (
                <span key={idx} style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                   {tag}
                </span>
              ))}
            </div>

            {/* Ozet Kartlari */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', width: '100%', marginTop: '2.5rem' }}>
              <div style={{ background: 'var(--success-bg-light)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--success-border)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.total_earned', 'Toplam Hakediş')}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--success-text)', marginTop: '0.25rem' }}>{formatCurrency(totalHakedis, i18n.language)}</div>
              </div>
              <div style={{ background: 'var(--danger-bg-light)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--danger-border)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.total_paid', 'Yapılan Ödemeler')}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--danger-text)', marginTop: '0.25rem' }}>{formatCurrency(totalOdeme, i18n.language)}</div>
              </div>
              <div style={{ background: 'var(--glass-bg)', padding: '1.5rem 1rem', borderRadius: '8px', border: '1px solid var(--glass-border)', boxShadow: 'var(--card-shadow)' }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>{t('subcontractor_profile.remaining_balance', 'Kalan Bakiye (Net Cari)')}</div>
                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: netBalance >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                  {formatCurrency(netBalance, i18n.language)}
                </div>
              </div>
            </div>

          </div>

          {/* Sag Kolon - Tabs ve Tablolar */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 150px)' }}>
            <div className="tabs" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.25rem' }}>
              <button 
                className={`tab-btn ${activeTab === 'hakedis' ? 'active' : ''}`} 
                onClick={() => setActiveTab('hakedis')}
                style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'hakedis' ? '2px solid var(--primary)' : '2px solid transparent', padding: '0.5rem 1rem', color: activeTab === 'hakedis' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'hakedis' ? 'bold' : 'normal', cursor: 'pointer' }}
              >
                {t('subcontractor_profile.tab_earned', 'Hakedişler')}
              </button>
              <button 
                className={`tab-btn ${activeTab === 'odeme' ? 'active' : ''}`} 
                onClick={() => setActiveTab('odeme')}
                style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'odeme' ? '2px solid var(--primary)' : '2px solid transparent', padding: '0.5rem 1rem', color: activeTab === 'odeme' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'odeme' ? 'bold' : 'normal', cursor: 'pointer' }}
              >
                {t('subcontractor_profile.tab_payments', 'Ödemeler / Avanslar')}
              </button>
              <button 
                className={`tab-btn ${activeTab === 'rapor' ? 'active' : ''}`} 
                onClick={() => setActiveTab('rapor')}
                style={{ background: 'transparent', border: 'none', borderBottom: activeTab === 'rapor' ? '2px solid var(--primary)' : '2px solid transparent', padding: '0.5rem 1rem', color: activeTab === 'rapor' ? 'var(--primary)' : 'var(--text-muted)', fontWeight: activeTab === 'rapor' ? 'bold' : 'normal', cursor: 'pointer' }}
              >
                {t('subcontractor_profile.tab_report', 'Rapor (Cari Ekstre)')}
              </button>
            </div>

            {/* Tarih Filtresi */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('common.start_date', 'Başlangıç Tarihi')}</label>
                <CustomDatePicker className="form-input" value={filterStartDate} onChange={e => handleStartDateChange(e.target.value)} />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('common.end_date', 'Bitiş Tarihi')}</label>
                <CustomDatePicker className="form-input" value={filterEndDate} onChange={e => handleEndDateChange(e.target.value)} />
              </div>
            </div>

            {/* Tab Icerigi */}
            {activeTab === 'rapor' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.prev_balance', 'Devreden Bakiye')}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{formatCurrencySafe(reportDevreden, i18n.language)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.period_earned', 'Dönem Hakedişi')}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--success-text)' }}>+{formatCurrencySafe(reportDonemHakedis, i18n.language)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.period_paid', 'Dönem Ödemesi')}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--danger-text)' }}>-{formatCurrencySafe(reportDonemOdeme, i18n.language)}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.new_balance', 'Yeni Bakiye')}</div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: reportYeniBakiye >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{formatCurrencySafe(reportYeniBakiye, i18n.language)}</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder={t('subcontractor_profile.search_placeholder', 'Kelime ara...')} 
                    value={reportFilterText} 
                    onChange={e => setReportFilterText(e.target.value)} 
                    style={{ flex: 2, minWidth: '200px' }} 
                  />
                  <select 
                    className="form-input" 
                    value={reportFilterType} 
                    onChange={e => setReportFilterType(e.target.value)} 
                    style={{ flex: 1, minWidth: '120px' }}
                  >
                    <option value="all">{t('subcontractor_profile.filter_all', 'Tümü')}</option>
                    <option value="progress">{t('subcontractor_profile.filter_earned', 'Hakediş')}</option>
                    <option value="payment">{t('subcontractor_profile.filter_paid', 'Ödeme')}</option>
                  </select>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <select 
                    className="btn form-input" 
                    style={{ flex: 1, background: '#1e3a8a', color: '#fff', border: 'none', cursor: 'pointer', padding: '0.5rem', fontWeight: 'bold' }} 
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'pdf') generatePDF();
                      else if (val) handleExport(val);
                      e.target.value = "";
                    }} 
                    value=""
                  >
                    <option value="" disabled> {t('worker_profile.filter.export', 'Dışa Aktar / Yazdır...')}</option>
                    <option value="pdf">PDF</option>
                    <option value="excel">Excel (.xlsx)</option>
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                  </select>
                  <button onClick={handleWhatsAppSend} className="btn" style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                     {t('subcontractor_profile.whatsapp_share', 'WhatsApp')}
                  </button>
                </div>
              </div>
            ) : activeTab === 'hakedis' ? (
              <>
                <form onSubmit={handleSaveHakedis} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{t('common.description', 'Açıklama / İş Detayı')}</label>
                    <input type="text" name="description" className="form-input" placeholder={t('subcontractor_profile.desc_earned_ph', 'Örn: 3 Gün Kepçe Çalışması')} value={hakedisData.description} onChange={handleHakedisChange} required />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                      <label className="form-label">{t('common.amount', 'Tutar')} ({getCurrencySymbol(i18n.language)})</label>
                      <input type="number" name="amount" className="form-input" min="1" step="0.01" value={hakedisData.amount} onChange={handleHakedisChange} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                      <label className="form-label">{t('common.date', 'Tarih')}</label>
                      <CustomDatePicker name="trans_date" className="form-input" value={hakedisData.trans_date} onChange={handleHakedisChange} required />
                    </div>
                    <button type="submit" className="btn btn-primary" style={{ height: '42px', flex: 1 }}>{t('subcontractor_profile.add_earned', 'Hakediş Ekle')}</button>
                  </div>
                </form>
              </>
            ) : (
              <>
                <form onSubmit={handleSaveOdeme} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">{t('common.description', 'Açıklama')}</label>
                    <input type="text" name="description" className="form-input" placeholder={t('subcontractor_profile.desc_payment_ph', 'Örn: Nakit Avans / Banka Transferi')} value={odemeData.description} onChange={handleOdemeChange} required />
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                      <label className="form-label">{t('common.amount', 'Tutar')} ({getCurrencySymbol(i18n.language)})</label>
                      <input type="number" name="amount" className="form-input" min="1" step="0.01" value={odemeData.amount} onChange={handleOdemeChange} required />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                      <label className="form-label">{t('common.date', 'Tarih')}</label>
                      <CustomDatePicker name="trans_date" className="form-input" value={odemeData.trans_date} onChange={handleOdemeChange} required />
                    </div>
                    <button type="submit" className="btn btn-danger" style={{ height: '42px', flex: 1 }}>{t('subcontractor_profile.add_payment', 'Ödeme Ekle')}</button>
                  </div>
                </form>
              </>
            )}

            {/* Liste */}
            <div ref={historyRef} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
              {paginatedTransactions.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  {t('subcontractor_profile.no_records', 'Bu tarih aralığında kayıt bulunamadı.')}
                </div>
              ) : (
                paginatedTransactions.map(tr => (
                  <div key={tr.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)',
                    padding: '1rem', borderRadius: '8px'
                  }}>
                    <div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{formatDate(tr.trans_date, i18n.language)}</span>
                        <span style={{
                          fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px',
                          background: isLedgerProgress(tr.type) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: isLedgerProgress(tr.type) ? 'var(--success-text)' : 'var(--danger-text)'
                        }}>
                          {isLedgerProgress(tr.type) ? t('subcontractor_profile.earned_badge', 'Hakediş') : t('subcontractor_profile.payment_badge', 'Ödeme')}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{tr.description}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: isLedgerProgress(tr.type) ? 'var(--success-text)' : 'var(--danger-text)' }}>
                        {isLedgerProgress(tr.type) ? '+' : '-'}{formatCurrency(tr.amount, i18n.language)}
                      </div>
                      <button 
                        onClick={() => handleDeleteTransaction(tr)} 
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', marginTop: '0.25rem' }}
                      >
                        {t('common.delete', 'Sil')}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination - shared component (ui/Pagination) */}
            <Pagination variant="bordered" currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />

          </div>
        </div>
      </div>
      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={() => {
          confirmModal.onConfirm();
          setConfirmModal({ ...confirmModal, isOpen: false });
        }}
        title={confirmModal.title}
        message={confirmModal.message}
      />
      <GuideDrawer 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title={t('guides.subcontractor_profile.title', 'Taşeron Detay & Ekstre Rehberi (5N1K)')} 
        desc="" 
        h1={t('guides.subcontractor_profile.q1.title', '1. NE? (Taşeron Detay/Ekstre Takibi Nedir?)')} 
        p1={t('guides.subcontractor_profile.q1.desc', 'Taşeronun yaptığı işlerin (hakediş) ve yapılan ödemelerin/avansların tarih ve not bazlı detaylı dökümüdür.')} 
        h2={t('guides.subcontractor_profile.q2.title', '2. NEREDE? (İşlemler Nerede Görünür ve Saklanır?)')} 
        p2={t('guides.subcontractor_profile.q2.desc', 'Cari hesap hareketleri yerel veritabanında saklanır. Yapılan ödemeler otomatik olarak Kasa Yönetimi sayfasına da entegre edilir.')} 
        h3={t('guides.subcontractor_profile.q3.title', '3. NE ZAMAN? (Hakediş ve Ödemeler Ne Zaman Eklenmelidir?)')} 
        p3={t('guides.subcontractor_profile.q3.desc', 'Sahada taşeron tarafından iş teslimi yapıldığında hakediş, ödeme yapıldığında ise ödeme/avans kaydı eşzamanlı girilmelidir.')} 
        h4={t('guides.subcontractor_profile.q4.title', '4. NASIL? (Dışa Aktarma ve WhatsApp Paylaşımı Nasıl Yapılır?)')} 
        p4={t('guides.subcontractor_profile.q4.desc', 'Sayfa üstündeki tarih aralığı filtrelerini kullanarak rapor oluşturabilir, tek tuşla PDF/Excel formatında indirebilir veya WhatsApp\'tan gönderebilirsiniz.')} 
        h5={t('guides.subcontractor_profile.q5.title', '5. NEDEN? (Neden Detaylı Cari Ekstre Tutulmalıdır?)')} 
        p5={t('guides.subcontractor_profile.q5.desc', 'Taşeronla aranızdaki hesap uyuşmazlıklarını ve mükerrer ödemeleri önlemek, firmanın net borç yükümlülüklerini hatasız raporlamak için tutulur.')} 
        h6={t('guides.subcontractor_profile.q6.title', '6. KİM? (Bu Profil Sayfasını Kimler Yönetebilir?)')} 
        p6={t('guides.subcontractor_profile.q6.desc', 'Yetkilendirilmiş şantiye şefleri, proje koordinatörleri ve muhasebe sorumluları hakediş/ödeme ekleyebilir veya silebilir.')} 
      />
    </div>
  );
};

export default SubcontractorProfile;
