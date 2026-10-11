import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { exportToExcel, exportToCSV, exportToJSON } from '../utils/exportUtils';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';
import CashSummary from './CashSummary';
import CashForm from './CashForm';
import CashHistory from './CashHistory';
import { generateCashPdf } from './CashPdfExporter';

const CashRegister = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [transactions, setTransactions] = useState([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');
  void balance;

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
  void getFirstDayOfCurrentMonth;
  void getLastDayOfCurrentMonth;

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
      data.forEach(tr => {
        if (tr.type === 'Nakit Girişi') total += tr.amount;
        else if (tr.type === 'Nakit Çıkışı') total -= tr.amount;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (reportDate) {
      const parts = reportDate.split('-');
      if (parts.length >= 2) {
        fetchReportData(parseInt(parts[0]), parseInt(parts[1]), filterProject);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const projectFilteredTransactions = transactions.filter(tr => {
    if (filterProject === 'merkez') {
      return !tr.project_id;
    } else if (filterProject !== 'all') {
      return tr.project_id === Number(filterProject);
    }
    return true;
  });

  let projTotalIn = 0;
  let projTotalOut = 0;
  projectFilteredTransactions.forEach(tr => {
    if (tr.type === 'Nakit Girişi') projTotalIn += tr.amount;
    else if (tr.type === 'Nakit Çıkışı') projTotalOut += tr.amount;
  });
  const projNetBalance = projTotalIn - projTotalOut;

  // Filtered transactions for current listing (includes dates, search query and type filters)
  const filteredTransactions = transactions.filter(tr => {
    let matchStart = true;
    let matchEnd = true;
    let matchType = true;
    let matchSearch = true;
    let matchProject = true;

    if (filterStartDate) matchStart = tr.trans_date >= filterStartDate;
    if (filterEndDate) matchEnd = tr.trans_date <= filterEndDate;
    if (filterType) matchType = tr.type === filterType;
    if (searchQuery) matchSearch = tr.description && tr.description.toLowerCase().includes(searchQuery.toLowerCase());

    if (filterProject === 'merkez') {
      matchProject = !tr.project_id;
    } else if (filterProject !== 'all') {
      matchProject = tr.project_id === Number(filterProject);
    }

    return matchStart && matchEnd && matchType && matchSearch && matchProject;
  });

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);
  const paginatedTransactions = filteredTransactions.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleGeneratePdf = () => generateCashPdf({
    t, i18n, filterProject, filterStartDate, filterEndDate, filteredTransactions,
    projNetBalance, companyName, companyLogo, getProjectName
  });

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
    if (format === 'pdf') handleGeneratePdf();
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
      </header>

      <div className="profile-grid">
        {/* Left Column: Balance, Report & Form */}
        <div className="left-panel" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <CashSummary
            t={t}
            i18n={i18n}
            projNetBalance={projNetBalance}
            projTotalIn={projTotalIn}
            projTotalOut={projTotalOut}
            reportDate={reportDate}
            setReportDate={setReportDate}
            reportData={reportData}
          />

          <CashForm
            t={t}
            i18n={i18n}
            formData={formData}
            onChange={handleChange}
            onSubmit={handleSubmit}
            cashTags={cashTags}
            setCashTags={setCashTags}
            projects={projects}
            activeProjectId={activeProjectId}
          />
        </div>

        <CashHistory
          t={t}
          i18n={i18n}
          projects={projects}
          filterProject={filterProject}
          setFilterProject={setFilterProject}
          filterStartDate={filterStartDate}
          onStartDateChange={handleStartDateChange}
          filterEndDate={filterEndDate}
          onEndDateChange={handleEndDateChange}
          filterType={filterType}
          setFilterType={setFilterType}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filteredTransactions={filteredTransactions}
          paginatedTransactions={paginatedTransactions}
          totalPages={totalPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          getProjectName={getProjectName}
          onDelete={handleDelete}
          onExport={handleExport}
          listRef={cashListBodyRef}
        />
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
