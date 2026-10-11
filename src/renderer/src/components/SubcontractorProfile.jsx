import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import CustomDatePicker from './ui/CustomDatePicker';
import GuideDrawer from './ui/GuideDrawer';
import SubcontractorInfoCard from './SubcontractorInfoCard';
import SubcontractorForms from './SubcontractorForms';
import SubcontractorStatement from './SubcontractorStatement';
import SubcontractorTxList from './SubcontractorTxList';

const SubcontractorProfile = ({ subcontractor, onBack }) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [projectName, setProjectName] = useState('');

  const [transactions, setTransactions] = useState([]);
  const [activeTab, setActiveTab] = useState('hakedis'); // 'hakedis' | 'odeme'

  // Date filters
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  const handleStartDateChange = (val) => {
    setFilterStartDate(val);
    if (val && filterEndDate && new Date(val) > new Date(filterEndDate)) {
      setFilterEndDate(val);
    }
  };

  const handleEndDateChange = (val) => {
    setFilterEndDate(val);
    if (val && filterStartDate && new Date(filterStartDate) > new Date(val)) {
      setFilterStartDate(val);
    }
  };

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 4;

  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [helpOpen, setHelpOpen] = useState(false);

  const fetchProfileData = async () => {
    if (window.api && subcontractor) {
      setLoading(true);

      const settings = await window.api.db.read('app_settings');
      const cName = settings.find(s => s.setting_key === 'company_name')?.setting_value;
      const cLogo = settings.find(s => s.setting_key === 'company_logo')?.setting_value;
      if (cName) setCompanyName(cName);
      if (cLogo) setCompanyLogo(cLogo);

      const allProjects = await window.api.db.read('projects');
      const matchedProj = allProjects.find(p => p.id == subcontractor.project_id);
      setProjectName(matchedProj ? matchedProj.name : '');

      const rawTransactions = await window.api.db.read('subcontractor_transactions', { subcontractor_id: subcontractor.id });
      setTransactions(rawTransactions);

      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfileData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subcontractor.id]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterStartDate, filterEndDate]);

  const handleDeleteTransaction = (tr) => {
    setConfirmModal({
      isOpen: true,
      title: t('subcontractor_profile.delete_title', 'İşlemi Sil'),
      message: t('subcontractor_profile.delete_msg', 'Bu işlemi silmek istediğinize emin misiniz? Eğer bu bir ödeme ise Kasa tablosundan da silinecektir.'),
      onConfirm: async () => {
        if (window.api) {
          await window.api.db.delete('subcontractor_transactions', tr.id);
          if (tr.linked_cash_id) {
            await window.api.db.delete('cash_register', tr.linked_cash_id);
          }
          fetchProfileData();
        }
      }
    });
  };

  // Hesaplamalar (Genel)
  let totalHakedis = 0;
  let totalOdeme = 0;

  transactions.forEach(tr => {
    if (tr.type === 'Hakediş') totalHakedis += tr.amount;
    else if (tr.type === 'Ödeme') totalOdeme += tr.amount;
  });

  const netBalance = totalHakedis - totalOdeme;

  const filteredTransactions = transactions.filter(tr => {
    return tr.type === (activeTab === 'hakedis' ? 'Hakediş' : 'Ödeme') &&
           (!filterStartDate || tr.trans_date >= filterStartDate) &&
           (!filterEndDate || tr.trans_date <= filterEndDate);
  }).sort((a, b) => new Date(b.trans_date) - new Date(a.trans_date));

  const itemsToPaginate = activeTab === 'rapor'
    ? transactions
        .filter(tr => (!filterStartDate || tr.trans_date >= filterStartDate) && (!filterEndDate || tr.trans_date <= filterEndDate))
        .sort((a, b) => new Date(b.trans_date) - new Date(a.trans_date))
    : filteredTransactions;
  const totalPages = Math.ceil(itemsToPaginate.length / ITEMS_PER_PAGE) || 1;
  const paginatedTransactions = itemsToPaginate.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  void loading;

  return (
    <div className="worker-profile" style={{ fontFamily: "'Inter', 'Noto Sans', 'Arial', sans-serif" }}>
      <div style={{ padding: '0' }}>
        <SubcontractorInfoCard
          t={t}
          i18n={i18n}
          subcontractor={subcontractor}
          projectName={projectName}
          totalHakedis={totalHakedis}
          totalOdeme={totalOdeme}
          netBalance={netBalance}
          onBack={onBack}
          onHelp={() => setHelpOpen(true)}
        />

        <div className="profile-grid" style={{ marginTop: '0.5rem', gridTemplateColumns: '350px 1fr' }}>
          <div />
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
              <SubcontractorStatement
                t={t}
                i18n={i18n}
                subcontractor={subcontractor}
                transactions={transactions}
                filterStartDate={filterStartDate}
                filterEndDate={filterEndDate}
                companyName={companyName}
                companyLogo={companyLogo}
                projectName={projectName}
              />
            ) : (
              <SubcontractorForms
                t={t}
                i18n={i18n}
                subcontractor={subcontractor}
                mode={activeTab}
                onSaved={fetchProfileData}
              />
            )}

            {/* Liste */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto' }}>
              <SubcontractorTxList
                t={t}
                i18n={i18n}
                paginatedTransactions={paginatedTransactions}
                totalPages={totalPages}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                onDelete={handleDeleteTransaction}
              />
            </div>

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
