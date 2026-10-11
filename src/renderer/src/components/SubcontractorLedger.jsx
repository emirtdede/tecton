import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';
import { formatCurrency, trLower } from '../utils/formatUtils';
import SubcontractorHeader from './SubcontractorHeader';
import SubcontractorTable from './SubcontractorTable';
import SubcontractorAnomalies from './SubcontractorAnomalies';
import SubcontractorFormDrawer from './SubcontractorFormDrawer';

const SubcontractorLedger = ({ activeProjectId, projects = [], onViewProfile }) => {
  const { t, i18n } = useTranslation();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [editingContractor, setEditingContractor] = useState(null);
  const containerRef = useRef(null);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterServiceType, setFilterServiceType] = useState('');
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'active' | 'passive'
  const [anomalyActiveTab, setAnomalyActiveTab] = useState('all');
  const [anomalySearch, setAnomalySearch] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterServiceType, filterStatus]);

  const handleOpenDrawer = (c = null) => {
    setEditingContractor(c);
    setIsDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setIsDrawerOpen(false);
    setEditingContractor(null);
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
        <h2>🚜 {t('nav.subcontractors', 'Taşeron Cari Takibi')}</h2>
        <p className="text-muted" style={{ marginTop: '1rem' }}>{t('common.select_project_msg', 'Lütfen sol menüden veya Şantiye Yönetimi sayfasından aktif bir şantiye seçin.')}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="subcontractor-page" style={{ animation: 'fadeIn 0.3s ease' }}>
      <SubcontractorHeader
        t={t}
        i18n={i18n}
        contractors={contractors}
        activeProjectId={activeProjectId}
        fetchContractors={fetchContractors}
        onAdd={() => handleOpenDrawer()}
        onHelp={() => setHelpOpen(true)}
      />

      {/* Bento Grid layout */}
      <div className="bento-grid">
        <SubcontractorTable
          t={t}
          i18n={i18n}
          loading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterServiceType={filterServiceType}
          setFilterServiceType={setFilterServiceType}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          uniqueServiceTypes={uniqueServiceTypes}
          filteredContractors={filteredContractors}
          paginatedContractors={paginatedContractors}
          totalPages={totalPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          onViewProfile={onViewProfile}
          onOpenDrawer={handleOpenDrawer}
          onDelete={handleDelete}
        />

        <SubcontractorAnomalies
          t={t}
          i18n={i18n}
          anomalySearch={anomalySearch}
          setAnomalySearch={setAnomalySearch}
          anomalyActiveTab={anomalyActiveTab}
          setAnomalyActiveTab={setAnomalyActiveTab}
          filteredNegativeBalance={filteredNegativeBalance}
          filteredIsgExpired={filteredIsgExpired}
          filteredIsgApproaching={filteredIsgApproaching}
          contractors={contractors}
        />
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

      <SubcontractorFormDrawer
        t={t}
        i18n={i18n}
        activeProjectId={activeProjectId}
        contractor={editingContractor}
        open={isDrawerOpen}
        onClose={handleCloseDrawer}
        onSaved={fetchContractors}
      />
    </div>
  );
};

export default SubcontractorLedger;
