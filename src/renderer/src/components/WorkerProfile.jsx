import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import jsPDF from 'jspdf';
import { escapeHtml } from '../utils/htmlUtils';
import { createPdfContainer, renderContainerToPdfPage } from '../utils/pdfRenderUtils';
import { exportToExcel, exportToCSV, exportToJSON } from '../utils/exportUtils';
import TagInput from './ui/TagInput';
import ConfirmationModal from './ui/ConfirmationModal';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatCurrency, formatDate, getCurrencySymbol, formatCurrencySafe, localToday, toLocalDateString } from '../utils/formatUtils';
import GuideDrawer from './ui/GuideDrawer';
import apiWrite, { apiMessage } from '../utils/apiWrite';
import { WORKER_ADVANCE } from '../utils/transactionTypes';

import { toAsciiFilename } from '../utils/pdfUtils';
import PageGuideIcon from './ui/PageGuideIcon';
import { reorderRangeForStart, reorderRangeForEnd } from '../utils/dateRangeUtils';
import Pagination from './ui/Pagination';
import pdfStyles from '../utils/pdfStyles';
import { parseTags } from '../utils/tagUtils';
const WorkerProfile = ({ worker, onBack }) => {
  const { t, i18n } = useTranslation();
  const [balance, setBalance] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isgModalOpen, setIsgModalOpen] = useState(false);
  const [isgForm, setIsgForm] = useState({ isg_start_date: '', isg_bitis_tarihi: '' });
  const [projectName, setProjectName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [workTypes, setWorkTypes] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reportSummary, setReportSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('puantaj'); // 'puantaj' | 'avans' | 'rapor'
  
  // Dinamik Filtre State (Cari Hesap Ekstresi)
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const now = new Date();
    return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    const now = new Date();
    return toLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  });
  const handleStartDateChange = (val) => {
    const [start, end] = reorderRangeForStart(val, filterEndDate);
    setFilterStartDate(start);
    setFilterEndDate(end);
    setPagePuantaj(1); setPageAvans(1); setPageRapor(1); setPageIzin(1);
  };
  const handleEndDateChange = (val) => {
    const [start, end] = reorderRangeForEnd(val, filterStartDate);
    setFilterStartDate(start);
    setFilterEndDate(end);
    setPagePuantaj(1); setPageAvans(1); setPageRapor(1); setPageIzin(1);
  };
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('Tümü'); // 'Tümü' | 'Puantaj' | 'Avans'
  
  const [pagePuantaj, setPagePuantaj] = useState(1);
  const [pageAvans, setPageAvans] = useState(1);
  const [pageRapor, setPageRapor] = useState(1);
  const [pageIzin, setPageIzin] = useState(1);
  const ITEMS_PER_PAGE = 7;
  
  const historyRef = useRef(null);
  const tabsRef = useRef(null);

  const handleBottomTabClick = (tab) => {
    setActiveTab(tab);
    // Deferred so the target section is laid out first. Reading the ref inside
    // the callback (instead of capturing it) is null-safe if the drawer closes
    // before the timer fires.
    setTimeout(() => {
      tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  
  const renderPagination = (currentPage, totalItems, setPage) => {
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
    if (totalPages <= 1) return null;
    
    const handlePageChange = (newPage) => {
      setPage(newPage);
      setTimeout(() => {
        if (historyRef.current) {
          historyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    };
    
    return (
      <Pagination
        variant="bordered"
        align="center"
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    );
  };
  
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  
  // Form State for Puantaj
  const [formData, setFormData] = useState({
    work_date: localToday(),
    work_type_id: '',
    overtime_hours: 0,
    notes: ''
  });
  const [calculatedWage, setCalculatedWage] = useState(0);
  const [puantajTags, setPuantajTags] = useState([]);

  // Form State for Avans
  const [avansData, setAvansData] = useState({
    trans_date: localToday(),
    amount: '',
    notes: ''
  });
  const [avansTags, setAvansTags] = useState([]);

  // Form State for Leaves
  const [workerLeaves, setWorkerLeaves] = useState([]);
  const [leaveData, setLeaveData] = useState({
    start_date: localToday(),
    end_date: localToday(),
    type: 'Ücretli',
    description: ''
  });

  // Confirmation Modal State
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  // Guards against stale responses overwriting newer data when the date range or
  // worker changes rapidly (or when the component unmounts mid-fetch).
  const profileRequestIdRef = useRef(0);

  const fetchProfileData = async () => {
    if (!(window.api && worker)) return;
    const requestId = ++profileRequestIdRef.current;

    try {
      // All seven reads/calculations are independent of each other; issuing
      // them together turns seven serial IPC round-trips into one wait.
      const [balanceRes, wTypes, settings, allProjects, allGroups, stmtRes, leaves] = await Promise.all([
        window.api.finance.getBalance(worker.id).catch(() => ({ success: false })),
        window.api.db.read('work_types'),
        window.api.db.read('app_settings'),
        window.api.db.read('projects'),
        window.api.db.read('worker_groups'),
        window.api.finance.workerStatement({
          worker_id: worker.id,
          start_date: filterStartDate,
          end_date: filterEndDate
        }).catch(() => ({ success: false })),
        window.api.db.read('worker_leaves')
      ]);

      if (requestId !== profileRequestIdRef.current) return;

      if (balanceRes && balanceRes.success) setBalance(balanceRes.balance);

      const types = Array.isArray(wTypes) ? wTypes : [];
      setWorkTypes(types);

      // Select 'Tam Gün' or the one with multiplier 1.0 by default
      if (types.length > 0 && !formData.work_type_id) {
        const defaultType = types.find(wt => wt.name === 'Tam Gün') || types.find(wt => wt.multiplier === 1.0) || types[0];
        if (defaultType) {
          setFormData(prev => ({ ...prev, work_type_id: defaultType.id }));
        }
      }

      const settingsRows = Array.isArray(settings) ? settings : [];
      const cName = settingsRows.find(s => s.setting_key === 'company_name')?.setting_value;
      const cLogo = settingsRows.find(s => s.setting_key === 'company_logo')?.setting_value;
      if (cName) setCompanyName(cName);
      if (cLogo) setCompanyLogo(cLogo);

      const matchedProj = (allProjects || []).find(p => p.id == worker.project_id);
      const matchedGroup = (allGroups || []).find(g => g.id == worker.group_id);
      setProjectName(matchedProj ? matchedProj.name : '');
      setGroupName(matchedGroup ? matchedGroup.name : '');

      if (stmtRes && stmtRes.success) {
        setTimesheets(stmtRes.timesheets);
        setTransactions(stmtRes.transactions);
        // We will store the summary for the report tab
        setReportSummary(stmtRes.summary);
      }

      if (leaves) {
        setWorkerLeaves(leaves.filter(l => l.worker_id === worker.id && l.is_deleted !== 1));
      }
    } catch (err) {
      // Previously a rejection left the profile on a skeleton with no feedback.
      if (requestId !== profileRequestIdRef.current) return;
      logError('Worker profile fetch failed:', err);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('worker.profile_load_error', 'Personel bilgileri yüklenemedi.'), type: 'error' }
      }));
    }
  };

  useEffect(() => {
    fetchProfileData();
  }, [worker.id, filterStartDate, filterEndDate]);

  // Wage recalculation is async and fires on every work-type/overtime change;
  // without a guard an older reply could overwrite the newest amount.
  const wageRequestIdRef = useRef(0);

  // Live calculation of wage
  useEffect(() => {
    const calculateLive = async () => {
      if (formData.work_type_id && window.api) {
        const selectedType = workTypes.find(wt => wt.id == formData.work_type_id);
        if (selectedType) {
          const requestId = ++wageRequestIdRef.current;
          const res = await window.api.finance.calculateWage({
            daily_wage: worker.daily_wage,
            multiplier: selectedType.multiplier,
            overtime_hours: formData.overtime_hours
          });
          // Drop stale replies from a superseded change.
          if (requestId !== wageRequestIdRef.current) return;
          if (res.success) {
            setCalculatedWage(res.wage);
          }
        }
      }
    };
    calculateLive();
  }, [formData.work_type_id, formData.overtime_hours, workTypes]);

  const handlePuantajChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'overtime_hours'
        ? (value === '' ? '' : (Number.isNaN(Number(value)) ? prev.overtime_hours : Number(value)))
        : value
    }));
  };

  const handleAvansChange = (e) => {
    const { name, value } = e.target;
    setAvansData(prev => ({
      ...prev,
      [name]: name === 'amount'
        ? (value === '' ? '' : (Number.isNaN(Number(value)) ? prev.amount : Number(value)))
        : value
    }));
  };

  const handleSubmitTimesheet = async (e) => {
    e.preventDefault();
    const selectedType = workTypes.find(wt => wt.id == formData.work_type_id);

    // CustomDatePicker renders a <div>, so its `required` prop never triggers
    // native validation. Without these guards an empty or unparseable date
    // reached the DB and then silently broke every report that filters by
    // date (the row was neither before nor after any range).
    if (!formData.work_date || Number.isNaN(new Date(formData.work_date).getTime())) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('common.required_fields', 'Lütfen zorunlu alanları doldurun.'), type: 'error' }
      }));
      return;
    }
    if (!selectedType) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('common.required_fields', 'Lütfen zorunlu alanları doldurun.'), type: 'error' }
      }));
      return;
    }

    if (window.api) {
      const dataToSave = {
        worker_id: worker.id,
        work_date: formData.work_date,
        work_type_id: formData.work_type_id,
        applied_wage: worker.daily_wage,
        applied_multiplier: selectedType.multiplier,
        overtime_hours: formData.overtime_hours,
        earned_amount: calculatedWage,
        notes: formData.notes,
        tags: JSON.stringify(puantajTags),
        project_id: worker.project_id
      };

      const doSave = async () => {
        const res = await apiWrite(window.api.db.create('timesheets', dataToSave));
        if (res && res.success === false) return;
        setFormData(prev => ({ ...prev, overtime_hours: 0, notes: '' }));
        setPuantajTags([]);
        
        let needsFetch = true;
        setFilterEndDate(current => {
          if (dataToSave.work_date > current) { needsFetch = false; return dataToSave.work_date; }
          return current;
        });
        setFilterStartDate(current => {
          if (dataToSave.work_date < current) { needsFetch = false; return dataToSave.work_date; }
          return current;
        });
        
        if (needsFetch) {
          fetchProfileData(); 
        }
      };

      const wDate = new Date(formData.work_date);
      const overlap = workerLeaves.find(l => {
        const sDate = new Date(l.start_date);
        const eDate = new Date(l.end_date);
        return wDate >= sDate && wDate <= eDate;
      });

      if (overlap) {
        let typeText = overlap.type;
        if (overlap.type === 'Ücretli') typeText = t('worker_profile.leave_types.paid', 'Ücretli İzin');
        else if (overlap.type === 'Ücretsiz') typeText = t('worker_profile.leave_types.unpaid', 'Ücretsiz İzin');
        else if (overlap.type === 'Rapor') typeText = t('worker_profile.leave_types.medical', 'Raporlu');
        
        const typeReason = overlap.description ? `${typeText} / ${overlap.description}` : typeText;
        let warningMsg = t('worker_profile.overlap_warning.message', 'Bu personel {{startDate}} - {{endDate}} tarihleri arasında {{type}} nedeniyle izinlidir. Yine de bu tarihe puantaj girmek istediğinize emin misiniz?');
        warningMsg = warningMsg.replace('{{startDate}}', formatDate(overlap.start_date, i18n.language))
                               .replace('{{endDate}}', formatDate(overlap.end_date, i18n.language))
                               .replace('{{type}}', typeReason);

        setConfirmModalState({
          isOpen: true,
          title: t('worker_profile.overlap_warning.title', 'Puantaj - İzin Çakışması'),
          message: warningMsg,
          confirmText: t('common.yes', 'Evet'),
          onConfirm: async () => {
            setConfirmModalState(prev => ({ ...prev, isOpen: false }));
            await doSave();
          }
        });
      } else {
        await doSave();
      }
    }
  };

  const handleSubmitAvans = async (e) => {
    e.preventDefault();

    // Same CustomDatePicker caveat as the timesheet form: `required` is inert,
    // so an empty date would be stored as "" and vanish from period reports.
    if (!avansData.trans_date || Number.isNaN(new Date(avansData.trans_date).getTime())) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('common.required_fields', 'Lütfen zorunlu alanları doldurun.'), type: 'error' }
      }));
      return;
    }
    if (!(Number(avansData.amount) > 0)) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('common.required_fields', 'Lütfen zorunlu alanları doldurun.'), type: 'error' }
      }));
      return;
    }

    if (window.api) {
      const dataToSave = {
        worker_id: worker.id,
        trans_date: avansData.trans_date,
        trans_type: WORKER_ADVANCE,
        amount: avansData.amount,
        notes: avansData.notes,
        tags: JSON.stringify(avansTags),
        project_id: worker.project_id
      };
      
      const res = await window.api.finance.createAdvance(dataToSave);
      if (res.success) {
        setAvansData(prev => ({ ...prev, amount: '', notes: '' }));
        setAvansTags([]);
        
        let needsFetch = true;
        setFilterEndDate(current => {
          if (dataToSave.trans_date > current) { needsFetch = false; return dataToSave.trans_date; }
          return current;
        });
        setFilterStartDate(current => {
          if (dataToSave.trans_date < current) { needsFetch = false; return dataToSave.trans_date; }
          return current;
        });
        
        if (needsFetch) {
          fetchProfileData();
        }
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('common.error_occurred', 'Hata:') + ' ' + apiMessage(res), type: 'error' } }));
      }
    }
  };

  const handleDeleteTimesheet = (id) => {
    setConfirmModalState({
      isOpen: true,
      title: t('worker_profile.timesheet_delete_title', 'Puantajı Sil'),
      message: t('worker_profile.timesheet_delete_msg', 'Bu puantaj kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.'),
      confirmText: t('common.yes', 'Evet'),
      cancelText: t('common.no', 'Hayır'),
      onConfirm: async () => {
        await apiWrite(window.api.db.delete('timesheets', id));
        fetchProfileData();
      }
    });
  };

  const handleDeleteTransaction = (id) => {
    setConfirmModalState({
      isOpen: true,
      title: t('worker_profile.advance_delete_title', 'Avansı Sil'),
      message: t('worker_profile.advance_delete_msg', 'Bu avansı silmek istediğinize emin misiniz? Sistem bu tutarı Kasa\'dan da otomatik olarak iptal edecektir.'),
      confirmText: t('common.yes', 'Evet'),
      cancelText: t('common.no', 'Hayır'),
      onConfirm: async () => {
        await apiWrite(window.api.finance.deleteTransaction(id));
        fetchProfileData();
      }
    });
  };

  const handleLeaveChange = (e) => {
    const { name, value } = e.target;
    setLeaveData(prev => {
      const nextData = { ...prev, [name]: value };
      if (nextData.start_date && nextData.end_date && new Date(nextData.start_date) > new Date(nextData.end_date)) {
        const temp = nextData.start_date;
        nextData.start_date = nextData.end_date;
        nextData.end_date = temp;
      }
      return nextData;
    });
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    // CustomDatePicker renders a div, so the `required` prop on it never
    // triggers native validation - an empty date reached the DB. Validate the
    // same contract the main process enforces before sending.
    if (!leaveData.start_date || !leaveData.end_date) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('common.required_fields', 'Lütfen zorunlu alanları doldurun.'), type: 'error' }
      }));
      return;
    }
    if (new Date(leaveData.start_date) > new Date(leaveData.end_date)) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('worker_profile.leave_form.invalid_range', 'Başlangıç tarihi bitiş tarihinden sonra olamaz.'), type: 'error' }
      }));
      return;
    }
    if (window.api) {
      const dataToSave = {
        worker_id: worker.id,
        start_date: leaveData.start_date,
        end_date: leaveData.end_date,
        type: leaveData.type,
        description: leaveData.description,
        project_id: worker.project_id
      };
      const res = await apiWrite(window.api.db.create('worker_leaves', dataToSave));
      if (res && res.success === false) return;
      setLeaveData(prev => ({ ...prev, description: '' }));
      fetchProfileData();
    }
  };

  const handleDeleteLeave = (id) => {
    setConfirmModalState({
      isOpen: true,
      title: t('worker_profile.leave_form.delete_title', 'İzni Sil'),
      message: t('worker_profile.leave_form.delete_message', 'Bu izin kaydını silmek istediğinize emin misiniz?'),
      onConfirm: async () => {
        await apiWrite(window.api.db.delete('worker_leaves', id));
        fetchProfileData();
      }
    });
  };

  // Dinamik Bakiye Hesaplama (Frontend Filtreleri + Backend Özeti)
  // Memoized: this rebuilt and re-sorted the full movement list on every render
  // (typing in the advance form, opening the PDF modal, switching tabs...).
  const cReport = useMemo(() => {
    const donemIslemleri = [];

    timesheets.forEach(ts => {
      const wType = workTypes.find(wt => wt.id == ts.work_type_id)?.name || 'Puantaj';
      donemIslemleri.push({
        id: 'ts_' + ts.id,
        date: ts.work_date,
        type: 'Puantaj',
        desc: `${wType} (${ts.overtime_hours} saat mesai)`,
        amount: ts.earned_amount,
        isIncome: true
      });
    });

    transactions.forEach(tr => {
      donemIslemleri.push({
        id: 'tr_' + tr.id,
        date: tr.trans_date,
        type: 'Avans',
        desc: tr.notes || 'Avans Kesintisi',
        amount: tr.amount,
        isIncome: false
      });
    });

    const finalIslemler = donemIslemleri.filter(item => {
      let matchText = true;
      let matchType = true;
      if (filterText) matchText = item.desc.toLowerCase().includes(filterText.toLowerCase());
      if (filterType !== 'Tümü') matchType = item.type === filterType;
      return matchText && matchType;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Values from backend
    const devredenBakiye = reportSummary ? reportSummary.previous_balance : 0;
    const donemHakEdis = reportSummary ? reportSummary.periodEarned : 0;
    const donemAvans = reportSummary ? reportSummary.periodAdvance : 0;
    const yeniBakiye = reportSummary ? reportSummary.new_balance : 0;

    return { devredenBakiye, donemHakEdis, donemAvans, yeniBakiye, islemler: finalIslemler };
  }, [timesheets, workTypes, transactions, filterText, filterType, reportSummary]);

  // Leave list for the "izinler" tab (filtered + sorted by start date desc).
  const filteredLeaves = useMemo(
    () => workerLeaves
      .filter(l => l.start_date <= filterEndDate && l.end_date >= filterStartDate)
      .sort((a, b) => new Date(b.start_date) - new Date(a.start_date)),
    [workerLeaves, filterStartDate, filterEndDate]
  );

  const handleExport = (format) => {
    const dataToExport = [];
    dataToExport.push({
      [t('worker_profile.table.date')]: filterStartDate || '-',
      [t('worker_profile.table.type')]: t('worker_profile.summary.previous_balance'),
      [t('worker_profile.table.desc')]: t('export.carried_note', 'Önceki dönemlerden aktarılan net bakiye'),
      [t('worker_profile.table.amount')]: cReport.devredenBakiye
    });

    // Column names were hardcoded Turkish, so every locale exported a Turkish file.
    cReport.islemler.forEach(item => {
      dataToExport.push({
        [t('worker_profile.table.date')]: item.date,
        [t('worker_profile.table.type')]: item.type,
        [t('worker_profile.table.desc')]: item.desc,
        [t('export.amount_currency', 'Tutar (TL)')]: (item.isIncome ? '+' : '-') + item.amount
      });
    });

    const fName = `${worker.full_name}_Hesap_Ekstresi`;
    if (format === 'excel') exportToExcel(dataToExport, fName);
    if (format === 'csv') exportToCSV(dataToExport, fName);
    if (format === 'json') exportToJSON(dataToExport, fName);
  };

  const handleWhatsAppSend = () => {
    if (!worker || !worker.phone) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('worker_profile.whatsapp_no_phone', 'Personelin kayıtlı telefon numarası bulunamadı.'), type: 'warning' } }));
      return;
    }
    
    let cleanPhone = worker.phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = '90' + cleanPhone;
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      cleanPhone = '90' + cleanPhone.substring(1);
    }
    
    const formattedEarned = formatCurrency(cReport.donemHakEdis, i18n.language);
    const formattedAdvance = formatCurrency(cReport.donemAvans, i18n.language);
    const formattedBalance = formatCurrency(cReport.yeniBakiye, i18n.language);
    
    const messageTemplate = t('worker_profile.whatsapp_message_template', 
      'Sayın {{name}}, {{startDate}} - {{endDate}} tarihleri arasındaki hesap ekstreniz:\n\n- Toplam Hak Ediş: {{earned}}\n- Toplam Ödenen/Avans: {{advance}}\n- Kalan Bakiye: {{balance}}\n\nBilgilerinize sunarız.'
    );
    
    const message = messageTemplate
      .replace('{{name}}', worker.full_name)
      .replace('{{startDate}}', filterStartDate || '')
      .replace('{{endDate}}', filterEndDate || '')
      .replace('{{earned}}', formattedEarned)
      .replace('{{advance}}', formattedAdvance)
      .replace('{{balance}}', formattedBalance);
      
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const generatePDF = async () => {
    const reportDateStr = new Date().toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US') + ' ' + new Date().toLocaleTimeString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

    // Group items into chunks of 15 items per page to prevent text/row cut-off
    const pdfItemsPerPage = 15;
    const chunks = [];
    const transactionsList = cReport.islemler || [];
    for (let i = 0; i < transactionsList.length; i += pdfItemsPerPage) {
      chunks.push(transactionsList.slice(i, i + pdfItemsPerPage));
    }

    if (chunks.length === 0) {
      chunks.push([]);
    }

    const pdf = new jsPDF('p', 'mm', 'a4');

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];
      
      const container = createPdfContainer();
      
      const isFirstPage = index === 0;
      const isLastPage = index === chunks.length - 1;
      
      // Build top header HTML
      let headerHtml = `
        <div style="${pdfStyles.reportHeader}">
          <div>
            ${companyLogo && isFirstPage ? `<img src="${escapeHtml(companyLogo)}" style="${pdfStyles.companyLogo}" />` : ''}
            <div style="${pdfStyles.companyName}">${escapeHtml(companyName || '')}</div>
          </div>
          <div style="text-align: right;">
            <div style="${pdfStyles.reportTitle}">${t('worker.statementTitle', 'Cari Hesap Ekstresi').toUpperCase()}</div>
            <div style="${pdfStyles.metaLine}"><strong>${t('global.filter', 'Filtre')}:</strong> ${escapeHtml(projectName ? projectName : t('global.unspecified', 'Belirtilmemiş'))}</div>
            <div style="${pdfStyles.metaLine}"><strong>${t('global.dateRange', 'Tarih Aralığı')}:</strong> ${escapeHtml(filterStartDate || 'Tümü')} / ${escapeHtml(filterEndDate || 'Tümü')}</div>
            <div style="${pdfStyles.metaLineTight}"><strong>${t('global.creationDate', 'Oluşturma Tarihi')}:</strong> ${escapeHtml(reportDateStr)}</div>
          </div>
        </div>
        <hr style="${pdfStyles.headerDivider}" />
      `;
      
      // Build worker info header HTML
      let workerInfoHtml = `
        <div style="margin-bottom: 20px; font-family: inherit;">
          <div style="font-size: 14px; font-weight: bold; color: #1e293b; margin-bottom: 6px; font-family: inherit;">${escapeHtml(worker.full_name)}</div>
          <div style="font-size: 11px; color: #64748b; display: flex; gap: 15px; flex-wrap: wrap; font-family: inherit;">
            ${worker.tc_no ? `<span><strong>${t('worker.id_tc', 'ID/TC')}:</strong> ${escapeHtml(worker.tc_no)}</span>` : ''}
            <span><strong>${t('recycle.tableProject', 'Şantiye')}:</strong> ${escapeHtml(projectName ? projectName : t('global.unspecified', 'Belirtilmemiş'))}</span>
            <span><strong>${t('worker.group', 'Grup')}:</strong> ${escapeHtml(groupName ? groupName : t('global.unspecified', 'Belirtilmemiş'))}</span>
            <span><strong>${t('worker.phone', 'Telefon')}:</strong> ${escapeHtml(worker.phone || '-')}</span>
          </div>
        </div>
      `;

      // Build summary cards HTML (only on the first page)
      let summaryCardsHtml = '';
      if (isFirstPage) {
        summaryCardsHtml = `
          <div style="display: flex; gap: 10px; margin-bottom: 25px; font-family: inherit;">
            <div style="${pdfStyles.summaryBox}">
              <div style="${pdfStyles.metaLine}">${t('worker.forwardBalance', 'Devreden Bakiye')}</div>
              <div style="${pdfStyles.companyName}">${formatCurrencySafe(cReport.devredenBakiye, i18n.language)}</div>
            </div>
            <div style="${pdfStyles.summaryBox}">
              <div style="${pdfStyles.metaLine}">${t('worker.periodEarned', 'Dönem Hak Edişi')}</div>
              <div style="font-size: 14px; font-weight: bold; color: #16a34a; font-family: inherit;">+${formatCurrencySafe(cReport.donemHakEdis, i18n.language)}</div>
            </div>
            <div style="${pdfStyles.summaryBox}">
              <div style="${pdfStyles.metaLine}">${t('worker.periodAdvance', 'Dönem Avansı')}</div>
              <div style="font-size: 14px; font-weight: bold; color: #dc2626; font-family: inherit;">-${formatCurrencySafe(cReport.donemAvans, i18n.language)}</div>
            </div>
            <div style="${pdfStyles.summaryBox}">
              <div style="${pdfStyles.metaLine}">${t('worker.netBalance', 'Net Bakiye')}</div>
              <div style="font-size: 14px; font-weight: bold; color: ${cReport.yeniBakiye >= 0 ? '#16a34a' : '#dc2626'}; font-family: inherit;">${formatCurrencySafe(cReport.yeniBakiye, i18n.language)}</div>
            </div>
          </div>
        `;
      }

      // Build table rows HTML
      let tableRowsHtml = '';
      if (chunk.length === 0) {
        tableRowsHtml = `
          <tr>
            <td colspan="4" style="${pdfStyles.emptyCell}">
              ${t('worker_profile.no_period_data', 'Bu dönemde herhangi bir işlem bulunamadı.')}
            </td>
          </tr>
        `;
      } else {
        tableRowsHtml = chunk.map(item => {
            const typeText = item.isIncome 
              ? t('worker_profile.filter.type_timesheet', 'Puantaj') 
              : t('worker.advanceBadge', 'Avans');
          const amountSign = item.isIncome ? '+' : '-';
          const amountColor = item.isIncome ? '#16a34a' : '#dc2626';
          return `
            <tr style="${pdfStyles.tableRow}">
              <td style="${pdfStyles.tableCell}">${escapeHtml(formatDate(item.date, i18n.language))}</td>
              <td style="${pdfStyles.tableCell}">${escapeHtml(typeText)}</td>
              <td style="${pdfStyles.tableCell}">${escapeHtml(item.desc || '-')}</td>
              <td style="padding: 8px 10px; text-align: right; border: 1px solid #e2e8f0; font-weight: 500; color: ${amountColor}; font-family: inherit;">${amountSign}${formatCurrencySafe(item.amount, i18n.language)}</td>
            </tr>
          `;
        }).join('');
      }

      // Build table HTML
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

      // Build signature block HTML (only on the last page)
      let signatureHtml = '';
      if (isLastPage) {
        signatureHtml = `
          <div style="margin-top: 60px; display: flex; justify-content: space-between; font-family: inherit;">
            <div style="${pdfStyles.signatureCell}">
              <hr style="${pdfStyles.signatureLine}" />
              <div style="${pdfStyles.signatureLabel}">${t('pdf.signatureWorker', 'Personel (Ad/Soyad - İmza)')}</div>
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
        ${workerInfoHtml}
        ${summaryCardsHtml}
        ${tableHtml}
        ${signatureHtml}
      `;

      await renderContainerToPdfPage(pdf, container, {
        addPage: index < chunks.length - 1
      });
    }


    pdf.save(`${toAsciiFilename(worker.full_name)}_Hesap_Ekstresi.pdf`);
  };

  const isPositive = balance >= 0;

  const parsedTags = parseTags(worker.tags);

  return (
    <div className="worker-profile" style={{ fontFamily: "'Inter', 'Noto Sans', 'Arial', sans-serif" }}>
      <div style={{ padding: '0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <button className="btn" style={{ marginBottom: 0, padding: '0.5rem 1rem' }} onClick={onBack}>← {t('worker_profile.back')}</button>
          <PageGuideIcon onClick={() => setHelpOpen(true)} />
        </div>
        
        <div className="profile-grid" style={{ marginTop: '0.5rem' }}>
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '1rem', gap: '0.75rem' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '40px', background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem', color: '#fff' }}>
              {worker.full_name.charAt(0)}
            </div>
            <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{worker.full_name}</h2>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', margin: '0.5rem 0 1rem 0' }}>
              {projectName && (
                <span style={{ fontSize: '0.8rem', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                   {projectName}
                </span>
              )}
              {groupName && (
                <span style={{ fontSize: '0.8rem', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                   {groupName}
                </span>
              )}
              {parsedTags.map((tag, idx) => (
                <span key={idx} style={{ fontSize: '0.8rem', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500' }}>
                   {tag}
                </span>
              ))}
              {(() => {
                const expiryDate = worker.isg_bitis_tarihi;
                if (!expiryDate) {
                  return (
                    <span 
                      onClick={() => { setIsgForm({ isg_start_date: worker.isg_start_date || '', isg_bitis_tarihi: '' }); setIsgModalOpen(true); }}
                      style={{ fontSize: '0.8rem', background: 'rgba(148, 163, 184, 0.2)', color: '#94a3b8', padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500', cursor: 'pointer' }}
                      title={t('isg.update_btn', 'İSG Güncelle')}
                    >
                       {t('isg.badge_undefined', 'İSG Tanımsız')}
                    </span>
                  );
                }
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expiry = new Date(expiryDate);
                expiry.setHours(0, 0, 0, 0);
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
                  <span 
                    onClick={() => { setIsgForm({ isg_start_date: worker.isg_start_date || '', isg_bitis_tarihi: worker.isg_bitis_tarihi || '' }); setIsgModalOpen(true); }}
                    style={{ fontSize: '0.8rem', background: badgeBg, color: badgeColor, padding: '0.25rem 0.75rem', borderRadius: '12px', fontWeight: '500', cursor: 'pointer' }}
                    title={t('isg.update_btn', 'İSG Güncelle')}
                  >
                    {badgeIcon} {badgeText}
                  </span>
                );
              })()}
            </div>
            <p className="card-subtitle" style={{ marginBottom: '1rem' }}>{worker.tc_no ? `${t('worker.idLabel', 'ID')}: ${worker.tc_no}` : ''} | {worker.phone}</p>
            
            <h3 className="card-subtitle">{t('worker_profile.current_balance')}</h3>
            <div style={{ 
              fontSize: '3rem', 
              fontWeight: '700', 
              marginTop: '0.5rem',
              color: isPositive ? 'var(--success-text)' : 'var(--danger-text)',
              textShadow: isPositive ? 'var(--success-shadow)' : 'var(--danger-shadow)'
            }}>
              {formatCurrency(balance, i18n.language)}
            </div>
            <p className="card-subtitle" style={{ marginTop: '1rem' }}>{t('worker_profile.daily_wage')}: {formatCurrency(worker.daily_wage, i18n.language)}</p>
          </div>

          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)' }}>
              <div 
                style={{ flex: 1, padding: '1rem', textAlign: 'center', cursor: 'pointer', fontWeight: '500', background: activeTab === 'puantaj' ? 'rgba(139, 92, 246, 0.2)' : 'transparent' }}
                onClick={() => setActiveTab('puantaj')}
              >
                {t('worker_profile.timesheet')}
              </div>
              <div 
                style={{ flex: 1, padding: '1rem', textAlign: 'center', cursor: 'pointer', fontWeight: '500', background: activeTab === 'avans' ? 'rgba(239, 68, 68, 0.2)' : 'transparent' }}
                onClick={() => setActiveTab('avans')}
              >
                {t('worker_profile.advance')}
              </div>
              <div 
                style={{ flex: 1, padding: '1rem', textAlign: 'center', cursor: 'pointer', fontWeight: '500', background: activeTab === 'rapor' ? 'rgba(56, 189, 248, 0.2)' : 'transparent' }}
                onClick={() => setActiveTab('rapor')}
              >
                {t('worker_profile.report')}
              </div>
              <div 
                style={{ flex: 1, padding: '1rem', textAlign: 'center', cursor: 'pointer', fontWeight: '500', background: activeTab === 'izinler' ? 'rgba(245, 158, 11, 0.2)' : 'transparent' }}
                onClick={() => setActiveTab('izinler')}
              >
                {t('worker_profile.leaves', 'İzinler')}
              </div>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {activeTab === 'puantaj' ? (
                <form onSubmit={handleSubmitTimesheet}>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.timesheet_form.date')}</label>
                    <CustomDatePicker name="work_date" className="form-input" value={formData.work_date} onChange={handlePuantajChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.timesheet_form.type')}</label>
                    <select name="work_type_id" className="form-input" value={formData.work_type_id} onChange={handlePuantajChange} required>
                      {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name} (x{wt.multiplier})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.timesheet_form.overtime')}</label>
                    <input type="number" name="overtime_hours" className="form-input" min="0" step="0.5" value={formData.overtime_hours} onChange={handlePuantajChange} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.timesheet_form.notes')}</label>
                    <input type="text" name="notes" className="form-input" value={formData.notes} onChange={handlePuantajChange} placeholder={t('worker_profile.timesheet_form.notes_ph')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.timesheet_form.tags_label')}</label>
                    <TagInput tags={puantajTags} setTags={setPuantajTags} placeholder={t('worker_profile.timesheet_form.tags_ph')} />
                  </div>
                  <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
                    <span className="form-label" style={{ marginBottom: 0 }}>{t('worker_profile.calculated_earned')}</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>{formatCurrency(calculatedWage, i18n.language)}</div>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{t('worker_profile.timesheet_form.add_btn')}</button>
                </form>
              ) : activeTab === 'avans' ? (
                <form onSubmit={handleSubmitAvans}>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.advance_form.date')}</label>
                    <CustomDatePicker name="trans_date" className="form-input" value={avansData.trans_date} onChange={handleAvansChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.advance_form.amount')} ({getCurrencySymbol(i18n.language)})</label>
                    <input type="number" name="amount" className="form-input" min="1" step="0.01" value={avansData.amount} onChange={handleAvansChange} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.advance_form.notes')}</label>
                    <input type="text" name="notes" className="form-input" value={avansData.notes} onChange={handleAvansChange} placeholder={t('worker_profile.advance_form.notes_ph', 'Örn: Haftalık avans')} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.advance_form.tags_label')}</label>
                    <TagInput tags={avansTags} setTags={setAvansTags} placeholder={t('worker_profile.advance_form.tags_ph')} />
                  </div>
                  <div style={{ color: 'var(--danger-text)', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
                    {t('worker_profile.auto_deduct_notice')}
                  </div>
                  <button type="submit" className="btn btn-danger" style={{ width: '100%' }}>{t('worker_profile.advance_form.add_btn')}</button>
                </form>
              ) : activeTab === 'izinler' ? (
                <form onSubmit={handleSubmitLeave}>
                  <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">{t('worker_profile.leave_form.start_date', 'Başlangıç')}</label>
                      <CustomDatePicker name="start_date" className="form-input" value={leaveData.start_date} onChange={handleLeaveChange} required />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label">{t('worker_profile.leave_form.end_date', 'Bitiş')}</label>
                      <CustomDatePicker name="end_date" className="form-input" value={leaveData.end_date} onChange={handleLeaveChange} required />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.leave_form.type', 'İzin Türü')}</label>
                    <select name="type" className="form-input" value={leaveData.type} onChange={handleLeaveChange} required>
                      <option value="Ücretli">{t('worker_profile.leave_types.paid', 'Ücretli İzin')}</option>
                      <option value="Ücretsiz">{t('worker_profile.leave_types.unpaid', 'Ücretsiz İzin')}</option>
                      <option value="Rapor">{t('worker_profile.leave_types.medical', 'Raporlu')}</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">{t('worker_profile.leave_form.description', 'Açıklama / Sebep')}</label>
                    <input type="text" name="description" className="form-input" value={leaveData.description} onChange={handleLeaveChange} />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#f59e0b', color: '#fff', border: 'none' }}>
                    {t('worker_profile.leave_form.add_btn', 'İzin Ekle')}
                  </button>
                </form>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <h3 className="card-title" style={{ marginBottom: '1rem' }}>{t('worker_profile.account_statement')}</h3>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 2 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('worker_profile.filter.search')}</label>
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder={t('worker_profile.filter.search')} 
                          value={filterText} 
                          onChange={e => setFilterText(e.target.value)} 
                          style={{ width: '100%', paddingRight: '2.5rem' }}
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
                            
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('worker_profile.table.type', 'İşlem Türü')}</label>
                      <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="Tümü">{t('worker_profile.filter.type_all')}</option>
                        <option value="Puantaj">{t('worker_profile.filter.type_timesheet')}</option>
                        <option value="Avans">{t('worker_profile.filter.type_advance')}</option>
                      </select>
                    </div>
                  </div>
                  
                  <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="text-muted">{t('worker_profile.summary.previous_balance')}:</span>
                      <span style={{ fontWeight: 'bold' }}>{formatCurrency(cReport.devredenBakiye, i18n.language)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                      <span className="text-muted">{t('worker_profile.summary.period_earned')}:</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--success-text)' }}>+{formatCurrency(cReport.donemHakEdis, i18n.language)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                      <span className="text-muted">{t('worker_profile.summary.period_advance')}:</span>
                      <span style={{ fontWeight: 'bold', color: 'var(--danger-text)' }}>-{formatCurrency(cReport.donemAvans, i18n.language)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="text-muted">{t('worker_profile.summary.new_balance')}:</span>
                      <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: cReport.yeniBakiye >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                        {formatCurrency(cReport.yeniBakiye, i18n.language)}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                    <select className="btn" style={{ padding: '0.5rem', flex: 1, background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 'bold' }} onChange={e => {
                        const val = e.target.value;
                        if (val === 'pdf') generatePDF();
                        else if (val) handleExport(val);
                        e.target.value = "";
                      }} value="">
                      <option value="" disabled>{t('worker_profile.filter.export')}...</option>
                      <option value="pdf">PDF</option>
                      <option value="excel">Excel (.xlsx)</option>
                      <option value="csv">CSV</option>
                      <option value="json">JSON</option>
                    </select>
                    <button 
                      type="button" 
                      className="btn" 
                      style={{ padding: '0.5rem', flex: 1, background: '#25D366', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', border: 'none' }}
                      onClick={handleWhatsAppSend}
                    >
                       WhatsApp
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div ref={historyRef} className="right-panel glass-card" style={{ marginTop: '2rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('worker_profile.filter.start_date')}</label>
              <CustomDatePicker className="form-input" value={filterStartDate} onChange={e => handleStartDateChange(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('worker_profile.filter.end_date')}</label>
              <CustomDatePicker className="form-input" value={filterEndDate} onChange={e => handleEndDateChange(e.target.value)} />
            </div>
          </div>
          <div ref={tabsRef} style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', marginBottom: '1.5rem', gap: '1rem', paddingBottom: '0.5rem' }}>
            <h3 
              className="card-title" 
              style={{ cursor: 'pointer', transition: 'color 0.3s ease', color: activeTab === 'puantaj' ? 'var(--text-main)' : 'var(--text-muted)' }}
              onClick={() => handleBottomTabClick('puantaj')}
            >
              {t('worker_profile.timesheet_history')}
            </h3>
            <h3 
              className="card-title" 
              style={{ cursor: 'pointer', transition: 'color 0.3s ease', color: activeTab === 'avans' ? 'var(--text-main)' : 'var(--text-muted)' }}
              onClick={() => handleBottomTabClick('avans')}
            >
              {t('worker_profile.advance_history')}
            </h3>
            <h3 
              className="card-title" 
              style={{ cursor: 'pointer', transition: 'color 0.3s ease', color: activeTab === 'rapor' ? 'var(--text-main)' : 'var(--text-muted)' }}
              onClick={() => handleBottomTabClick('rapor')}
            >
              {t('worker_profile.monthly_report_view')}
            </h3>
            <h3 
              className="card-title" 
              style={{ cursor: 'pointer', transition: 'color 0.3s ease', color: activeTab === 'izinler' ? 'var(--text-main)' : 'var(--text-muted)' }}
              onClick={() => handleBottomTabClick('izinler')}
            >
              {t('worker_profile.leave_history', 'İzin Geçmişi')}
            </h3>
          </div>
          
          <div key={activeTab} style={{ animation: 'fadeIn 0.3s ease-out' }}>
            {activeTab === 'puantaj' ? (
            timesheets.length === 0 ? (
              <p className="text-muted text-center" style={{ marginTop: '2rem' }}>{t('worker_profile.no_timesheet')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[...timesheets].reverse().slice((pagePuantaj - 1) * ITEMS_PER_PAGE, pagePuantaj * ITEMS_PER_PAGE).map(ts => {
                  const rawName = workTypes.find(wt => wt.id == ts.work_type_id)?.name;
                  const typeName = rawName ? t(rawName, rawName) : t('worker_profile.unknown');
                  
                  const wDate = new Date(ts.work_date);
                  const overlap = workerLeaves.find(l => {
                    const sDate = new Date(l.start_date);
                    const eDate = new Date(l.end_date);
                    return wDate >= sDate && wDate <= eDate;
                  });
                  let leaveBadge = null;
                  if (overlap) {
                    const lType = overlap.type === 'Ücretli' ? t('worker_profile.leave_types.paid', 'Ücretli İzin') : overlap.type === 'Ücretsiz' ? t('worker_profile.leave_types.unpaid', 'Ücretsiz İzin') : t('worker_profile.leave_types.medical', 'Raporlu');
                    leaveBadge = <span style={{ marginLeft: '10px', fontSize: '0.7rem', color: '#d97706', border: '1px solid #d97706', padding: '2px 6px', borderRadius: '4px' }}>{lType}</span>;
                  }

                  return (
                    <div key={ts.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: '600' }}>{formatDate(ts.work_date, i18n.language)} <span className="wage-badge" style={{ marginLeft: '10px' }}>{typeName}</span>{leaveBadge}</div>
                        <div className="card-subtitle" style={{ marginTop: '0.5rem' }}>
                          {t('worker_profile.wage_history_label')}: {formatCurrency(ts.applied_wage, i18n.language)} (x{ts.applied_multiplier})
                          {ts.overtime_hours > 0 && ` | +${ts.overtime_hours} ${t('worker_profile.overtime_hours_suffix')}`}
                        </div>
                        {ts.notes && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{t('worker_profile.note_label')}: {t(ts.notes, ts.notes)}</div>}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--success-text)', fontSize: '1.1rem' }}>+{formatCurrency(ts.earned_amount, i18n.language)}</div>
                        <button onClick={() => handleDeleteTimesheet(ts.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.5rem' }}>{t('common.delete')}</button>
                      </div>
                    </div>
                  )
                })}
                {renderPagination(pagePuantaj, timesheets.length, setPagePuantaj)}
              </div>
            )
          ) : activeTab === 'avans' ? (
            transactions.length === 0 ? (
              <p className="text-muted text-center" style={{ marginTop: '2rem' }}>{t('worker_profile.no_advance')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[...transactions].reverse().slice((pageAvans - 1) * ITEMS_PER_PAGE, pageAvans * ITEMS_PER_PAGE).map(tr => (
                  <div key={tr.id} style={{ background: 'var(--danger-bg-light)', border: '1px solid var(--danger-border)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600' }}>{formatDate(tr.trans_date, i18n.language)} <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: 'var(--danger-text)', border: '1px solid var(--danger-text)', padding: '2px 6px', borderRadius: '4px' }}>{t('worker_profile.advance_out')}</span></div>
                      <div className="card-subtitle" style={{ marginTop: '0.5rem' }}>{tr.notes || '-'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: 'var(--danger-text)', fontSize: '1.1rem' }}>-{formatCurrency(tr.amount, i18n.language)}</div>
                      <button onClick={() => handleDeleteTransaction(tr.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontSize: '0.8rem', marginTop: '0.5rem', textDecoration: 'underline' }}>{t('worker_profile.delete_cancel')}</button>
                    </div>
                  </div>
                ))}
                {renderPagination(pageAvans, transactions.length, setPageAvans)}
              </div>
            )
          ) : null}
          {activeTab === 'rapor' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
                <span style={{ fontWeight: '600' }}>{t('worker_profile.summary.carried_balance_report', 'Devreden Bakiye Raporu')}</span>
                <div style={{ fontWeight: 'bold', color: cReport.devredenBakiye >= 0 ? 'var(--success-text)' : 'var(--danger-text)', fontSize: '1.1rem' }}>
                  {formatCurrency(cReport.devredenBakiye, i18n.language)}
                </div>
              </div>
              
              {cReport.islemler.length === 0 ? (
                <p className="text-muted text-center" style={{ marginTop: '2rem' }}>{t('worker_profile.no_period_data')}</p>
              ) : (
                <>
                {cReport.islemler.slice((pageRapor - 1) * ITEMS_PER_PAGE, pageRapor * ITEMS_PER_PAGE).map(item => (
                  <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', borderBottom: '1px solid var(--glass-border)', background: item.isIncome ? 'var(--success-bg-light)' : 'var(--danger-bg-light)' }}>
                    <div>
                      <div style={{ fontWeight: '600' }}>{formatDate(item.date, i18n.language)} <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: item.isIncome ? 'var(--success-text)' : 'var(--danger-text)', border: `1px solid var(${item.isIncome ? '--success-text' : '--danger-text'})`, padding: '2px 6px', borderRadius: '4px' }}>{item.isIncome ? t('worker_profile.filter.type_timesheet', 'Puantaj') : t('worker.advanceBadge', 'Avans')}</span></div>
                      <div className="card-subtitle" style={{ marginTop: '0.25rem' }}>{item.desc}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 'bold', color: item.isIncome ? 'var(--success-text)' : 'var(--danger-text)', fontSize: '1.1rem' }}>{item.isIncome ? '+' : '-'}{formatCurrency(item.amount, i18n.language)}</div>
                    </div>
                  </div>
                ))}
                {renderPagination(pageRapor, cReport.islemler.length, setPageRapor)}
                </>
              )}
            </div>
          )}
          {activeTab === 'izinler' && (() => {
            const fLeaves = filteredLeaves;
            return fLeaves.length === 0 ? (
              <p className="text-muted text-center" style={{ marginTop: '2rem' }}>{t('worker_profile.no_leave', 'Henüz izin kaydı bulunmamaktadır.')}</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {fLeaves.slice((pageIzin - 1) * ITEMS_PER_PAGE, pageIzin * ITEMS_PER_PAGE).map(l => (
                  <div key={l.id} style={{ background: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.3)', padding: '1rem', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600' }}>
                        {formatDate(l.start_date, i18n.language)} - {formatDate(l.end_date, i18n.language)} 
                        <span style={{ marginLeft: '10px', fontSize: '0.8rem', color: '#d97706', border: '1px solid #d97706', padding: '2px 6px', borderRadius: '4px' }}>
                          {l.type === 'Ücretli' ? t('worker_profile.leave_types.paid', 'Ücretli İzin') : l.type === 'Ücretsiz' ? t('worker_profile.leave_types.unpaid', 'Ücretsiz İzin') : t('worker_profile.leave_types.medical', 'Raporlu')}
                        </span>
                      </div>
                      <div className="card-subtitle" style={{ marginTop: '0.5rem' }}>{l.description || '-'}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <button onClick={() => handleDeleteLeave(l.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>{t('common.delete')}</button>
                    </div>
                  </div>
                ))}
                {renderPagination(pageIzin, fLeaves.length, setPageIzin)}
              </div>
            );
          })()}
          </div>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.onConfirm}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmText={confirmModalState.confirmText}
      />

      {/* ISG Update Modal */}
      {isgModalOpen && (
        <div className="drawer-overlay" onClick={() => setIsgModalOpen(false)}>
          <div 
            className="glass-card" 
            onClick={e => e.stopPropagation()}
            style={{ 
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
              width: '420px', maxWidth: '90vw', zIndex: 1000, padding: '2rem',
              boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--glass-border)',
              background: 'var(--spotlight-bg)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                 {t('isg.update_title', 'İSG Tarihlerini Güncelle')}
              </h3>
              <button 
                onClick={() => setIsgModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex' }}
              ><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('isg.start_date', 'İSG Başlangıç Tarihi')}</label>
                <CustomDatePicker 
                  name="isg_start_date" 
                  className="form-input" 
                  value={isgForm.isg_start_date} 
                  onChange={e => setIsgForm(prev => {
                    const val = e.target.value;
                    if (val && prev.isg_bitis_tarihi && new Date(val) > new Date(prev.isg_bitis_tarihi)) {
                      return { ...prev, isg_start_date: prev.isg_bitis_tarihi, isg_bitis_tarihi: val };
                    }
                    return { ...prev, isg_start_date: val };
                  })} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">{t('isg.expiry_date', 'İSG Bitiş Tarihi')}</label>
                <CustomDatePicker 
                  name="isg_bitis_tarihi" 
                  className="form-input" 
                  value={isgForm.isg_bitis_tarihi} 
                  onChange={e => setIsgForm(prev => {
                    const val = e.target.value;
                    if (val && prev.isg_start_date && new Date(prev.isg_start_date) > new Date(val)) {
                      return { ...prev, isg_bitis_tarihi: prev.isg_start_date, isg_start_date: val };
                    }
                    return { ...prev, isg_bitis_tarihi: val };
                  })} 
                />
              </div>
              <button 
                className="btn btn-primary" 
                style={{ marginTop: '0.5rem', fontWeight: 'bold' }}
                onClick={async () => {
                  if (window.api && window.api.db) {
                    // apiWrite already toasts the failure; only close the modal and
                    // report success when the write actually committed. Before this
                    // the modal closed and a green toast fired even on a rejected
                    // write, so the user saw both an error and a success toast.
                    const res = await apiWrite(window.api.db.update('workers', worker.id, {
                      isg_start_date: isgForm.isg_start_date || null,
                      isg_bitis_tarihi: isgForm.isg_bitis_tarihi || null
                    }));
                    if (res && res.success === false) return;
                    setIsgModalOpen(false);
                    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('isg.update_success', 'İSG tarihleri başarıyla güncellendi.'), type: 'success' } }));
                    fetchProfileData();
                  }
                }}
              >
                {t('common.save', 'Kaydet')}
              </button>
            </div>
          </div>
        </div>
      )}

      <GuideDrawer 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title={t('guides.worker_profile.title', 'Personel Detay & Ekstre Rehberi (5N1K)')} 
        desc="" 
        h1={t('guides.worker_profile.q1.title', '1. NE? (Personel Ekstre Takibi Nedir?)')} 
        p1={t('guides.worker_profile.q1.desc', 'Seçilen personelin çalıştığı günlerin (puantaj), hak ettiği ücretlerin, aldığı avansların ve izin geçmişinin dökümünü içeren cari hesabıdır.')} 
        h2={t('guides.worker_profile.q2.title', '2. NEREDE? (Veriler Nerede Görünür ve Saklanır?)')} 
        p2={t('guides.worker_profile.q2.desc', 'Personelin tüm puantaj, avans ve izin hareketleri yerel veritabanında saklanır. Kasa entegrasyonu sayesinde yapılan ödemeler Kasa Yönetimi sayfasında da görünür.')} 
        h3={t('guides.worker_profile.q3.title', '3. NE ZAMAN? (Puantaj ve Avans Ne Zaman Girilmelidir?)')} 
        p3={t('guides.worker_profile.q3.desc', 'Çalışan sahada mesai yaptığında günlük olarak puantajı işlenir. Avans veya haftalık ödeme verildiğinde ise anında avans hareketi olarak kaydedilir.')} 
        h4={t('guides.worker_profile.q4.title', '4. NASIL? (Raporlama ve WhatsApp Paylaşımı Nasıl Yapılır?)')} 
        p4={t('guides.worker_profile.q4.desc', 'Tarih filtrelerini kullanarak personelin cari hesap ekstresini oluşturabilir, tek tıkla PDF/Excel formatında indirebilir veya WhatsApp üzerinden personelin kendisine gönderebilirsiniz.')} 
        h5={t('guides.worker_profile.q5.title', '5. NEDEN? (Neden Detaylı Personel Cari Takibi Yapılmalıdır?)')} 
        p5={t('guides.worker_profile.q5.desc', 'Personel ile ay sonunda yaşanabilecek maaş ve avans uyuşmazlıklarını kesin olarak çözmek ve geriye dönük hak ediş doğruluğunu ispatlamak için tutulur.')} 
        h6={t('guides.worker_profile.q6.title', '6. KİM? (Personel Profil Sayfasını Kimler Yönetebilir?)')} 
        p6={t('guides.worker_profile.q6.desc', 'Proje yöneticisi, şantiye şefi veya muhasebe yetkilisi personelin profil sayfasından puantaj, avans ve izin ekleme/silme işlemlerini yapabilir.')} 
      />
    </div>
  );
};

export default WorkerProfile;
