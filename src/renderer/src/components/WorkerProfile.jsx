import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { exportToExcel, exportToCSV, exportToJSON } from '../utils/exportUtils';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';
import { formatCurrency } from '../utils/formatUtils';
import WorkerIdentityCard from './WorkerIdentityCard';
import WorkerEntryForms from './WorkerEntryForms';
import WorkerHistoryLists from './WorkerHistoryLists';
import WorkerIsgModal from './WorkerIsgModal';
import { generateWorkerPdf } from './WorkerPdfExporter';

const WorkerProfile = ({ worker, onBack }) => {
  const { t, i18n } = useTranslation();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isgModalOpen, setIsgModalOpen] = useState(false);
  const [isgForm, setIsgForm] = useState({ isg_start_date: '', isg_bitis_tarihi: '' });
  const [projectName, setProjectName] = useState('');
  const [groupName, setGroupName] = useState('');
  const [workTypes, setWorkTypes] = useState([]);
  const [timesheets, setTimesheets] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [reportSummary, setReportSummary] = useState(null);
  const [activeTab, setActiveTab] = useState('puantaj'); // 'puantaj' | 'avans' | 'rapor' | 'izinler'

  // Dinamik Filtre State (Cari Hesap Ekstresi)
  const [filterStartDate, setFilterStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [filterEndDate, setFilterEndDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]);
  const handleStartDateChange = (val) => {
    if (val && filterEndDate && new Date(val) > new Date(filterEndDate)) {
      setFilterStartDate(filterEndDate);
      setFilterEndDate(val);
    } else {
      setFilterStartDate(val);
    }
    setPagePuantaj(1); setPageAvans(1); setPageRapor(1); setPageIzin(1);
  };
  const handleEndDateChange = (val) => {
    if (val && filterStartDate && new Date(filterStartDate) > new Date(val)) {
      setFilterEndDate(filterStartDate);
      setFilterStartDate(val);
    } else {
      setFilterEndDate(val);
    }
    setPagePuantaj(1); setPageAvans(1); setPageRapor(1); setPageIzin(1);
  };
  const [filterText, setFilterText] = useState('');
  const [filterType, setFilterType] = useState('Tümü'); // 'Tümü' | 'Puantaj' | 'Avans'

  const [pagePuantaj, setPagePuantaj] = useState(1);
  const [pageAvans, setPageAvans] = useState(1);
  const [pageRapor, setPageRapor] = useState(1);
  const [pageIzin, setPageIzin] = useState(1);

  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');

  // Form State for Leaves (list only; entry form lives in WorkerEntryForms)
  const [workerLeaves, setWorkerLeaves] = useState([]);

  // Confirmation Modal State
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const fetchProfileData = async () => {
    if (window.api && worker) {
      setLoading(true);
      const res = await window.api.finance.getBalance(worker.id);
      if (res.success) setBalance(res.balance);

      const wTypes = await window.api.db.read('work_types');
      setWorkTypes(wTypes);

      const settings = await window.api.db.read('app_settings');
      const cName = settings.find(s => s.setting_key === 'company_name')?.setting_value;
      const cLogo = settings.find(s => s.setting_key === 'company_logo')?.setting_value;
      if (cName) setCompanyName(cName);
      if (cLogo) setCompanyLogo(cLogo);

      const allProjects = await window.api.db.read('projects');
      const allGroups = await window.api.db.read('worker_groups');
      const matchedProj = allProjects.find(p => p.id == worker.project_id);
      const matchedGroup = allGroups.find(g => g.id == worker.group_id);
      setProjectName(matchedProj ? matchedProj.name : '');
      setGroupName(matchedGroup ? matchedGroup.name : '');

      // Perform backend statement calculation
      const stmtRes = await window.api.finance.workerStatement({
        worker_id: worker.id,
        start_date: filterStartDate,
        end_date: filterEndDate
      });

      if (stmtRes.success) {
        setTimesheets(stmtRes.timesheets);
        setTransactions(stmtRes.transactions);
        // We will store the summary for the report tab
        setReportSummary(stmtRes.summary);
      }

      const leaves = await window.api.db.read('worker_leaves');
      if (leaves) {
        setWorkerLeaves(leaves.filter(l => l.worker_id === worker.id && l.is_deleted !== 1));
      }

      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worker.id, filterStartDate, filterEndDate]);

  // Called by entry forms after a save; mirrors the original range-extension logic
  const handleEntrySaved = (savedDate) => {
    if (!savedDate) {
      fetchProfileData();
      return;
    }
    let needsFetch = true;
    setFilterEndDate(current => {
      if (savedDate > current) { needsFetch = false; return savedDate; }
      return current;
    });
    setFilterStartDate(current => {
      if (savedDate < current) { needsFetch = false; return savedDate; }
      return current;
    });

    if (needsFetch) {
      fetchProfileData();
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
        await window.api.db.delete('timesheets', id);
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
        await window.api.finance.deleteTransaction(id);
        fetchProfileData();
      }
    });
  };

  const handleDeleteLeave = (id) => {
    setConfirmModalState({
      isOpen: true,
      title: t('worker_profile.leave_form.delete_title', 'İzni Sil'),
      message: t('worker_profile.leave_form.delete_message', 'Bu izin kaydını silmek istediğinize emin misiniz?'),
      onConfirm: async () => {
        await window.api.db.delete('worker_leaves', id);
        fetchProfileData();
      }
    });
  };

  const handleBottomTabClick = (tab) => {
    setActiveTab(tab);
  };

  const handleOpenIsg = (start, end) => {
    setIsgForm({ isg_start_date: start, isg_bitis_tarihi: end });
    setIsgModalOpen(true);
  };

  // Dinamik Bakiye Hesaplama (Frontend Filtreleri + Backend Özeti)
  const calculateReport = () => {
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
  };

  const cReport = calculateReport();

  const handleExport = (format) => {
    const dataToExport = [];
    dataToExport.push({
      [t('worker_profile.table.date')]: filterStartDate || '-',
      [t('worker_profile.table.type')]: t('worker_profile.summary.previous_balance'),
      [t('worker_profile.table.desc')]: 'Önceki dönemlerden aktarılan net bakiye',
      [t('worker_profile.table.amount')]: cReport.devredenBakiye
    });

    cReport.islemler.forEach(item => {
      dataToExport.push({
        'Tarih': item.date,
        'İşlem Türü': item.type,
        'Açıklama': item.desc,
        'Tutar (TL)': (item.isIncome ? '+' : '-') + item.amount
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

  const handleGeneratePdf = () => generateWorkerPdf({
    t, i18n, worker, cReport, companyName, companyLogo, projectName, groupName, filterStartDate, filterEndDate
  });

  return (
    <div className="worker-profile" style={{ fontFamily: "'Inter', 'Noto Sans', 'Arial', sans-serif" }}>
      <div style={{ padding: '0' }}>
        <WorkerIdentityCard
          t={t}
          i18n={i18n}
          worker={worker}
          projectName={projectName}
          groupName={groupName}
          balance={balance}
          onBack={onBack}
          onHelp={() => setHelpOpen(true)}
          onOpenIsg={handleOpenIsg}
        />

        <div className="profile-grid" style={{ marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <WorkerEntryForms
              t={t}
              i18n={i18n}
              worker={worker}
              workTypes={workTypes}
              workerLeaves={workerLeaves}
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onSaved={handleEntrySaved}
              setConfirmModalState={setConfirmModalState}
              cReport={cReport}
              filterText={filterText}
              setFilterText={setFilterText}
              filterType={filterType}
              setFilterType={setFilterType}
              generatePDF={handleGeneratePdf}
              handleExport={handleExport}
              handleWhatsAppSend={handleWhatsAppSend}
            />
          </div>
        </div>

        <WorkerHistoryLists
          t={t}
          i18n={i18n}
          activeTab={activeTab}
          onBottomTabClick={handleBottomTabClick}
          filterStartDate={filterStartDate}
          filterEndDate={filterEndDate}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
          timesheets={timesheets}
          transactions={transactions}
          workerLeaves={workerLeaves}
          workTypes={workTypes}
          cReport={cReport}
          pagePuantaj={pagePuantaj}
          setPagePuantaj={setPagePuantaj}
          pageAvans={pageAvans}
          setPageAvans={setPageAvans}
          pageRapor={pageRapor}
          setPageRapor={setPageRapor}
          pageIzin={pageIzin}
          setPageIzin={setPageIzin}
          onDeleteTimesheet={handleDeleteTimesheet}
          onDeleteTransaction={handleDeleteTransaction}
          onDeleteLeave={handleDeleteLeave}
        />
      </div>

      <ConfirmationModal
        isOpen={confirmModalState.isOpen}
        onClose={() => setConfirmModalState(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModalState.onConfirm}
        title={confirmModalState.title}
        message={confirmModalState.message}
        confirmText={confirmModalState.confirmText}
      />

      <WorkerIsgModal
        t={t}
        worker={worker}
        open={isgModalOpen}
        onClose={() => setIsgModalOpen(false)}
        onSaved={fetchProfileData}
        isgForm={isgForm}
        setIsgForm={setIsgForm}
      />

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
