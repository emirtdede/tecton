import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';
import { formatDate, trLower } from '../utils/formatUtils';
import ProductionForm from './ProductionForm';
import ProductionFilters from './ProductionFilters';
import ProductionTable from './ProductionTable';

const ProductionManagement = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit mode state
  const [editingId, setEditingId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const containerRef = useRef(null);

  const [formData, setFormData] = useState({
    item_name: '',
    quantity: '',
    unit: 'm²',
    record_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const activeProject = projects.find(p => p.id === activeProjectId);

  const fetchRecords = async () => {
    if (!activeProjectId) return;
    if (window.api && window.api.db) {
      setLoading(true);
      const data = await window.api.db.read('production_records', { project_id: activeProjectId });
      setRecords(data);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterUnit, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
      containerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [currentPage]);

  const handleStartEdit = (r) => {
    setEditingId(r.id);
    setFormData({
      item_name: r.item_name,
      quantity: r.quantity,
      unit: r.unit,
      record_date: r.record_date,
      notes: r.notes || ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeProjectId || !formData.item_name || !formData.quantity) return;

    if (window.api && window.api.db) {
      const payload = {
        project_id: activeProjectId,
        item_name: formData.item_name,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        record_date: formData.record_date,
        notes: formData.notes
      };

      if (editingId) {
        await window.api.db.update('production_records', editingId, payload);
        setEditingId(null);
      } else {
        await window.api.db.create('production_records', payload);
      }

      setFormData(prev => ({
        ...prev,
        item_name: '',
        quantity: '',
        notes: ''
      }));
      fetchRecords();
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (window.api && window.api.db && confirmModal.id) {
      await window.api.db.delete('production_records', confirmModal.id);
      setConfirmModal({ isOpen: false, id: null });
      fetchRecords();
    }
  };

  // Filter and paginated records
  const filteredRecords = records.filter(r => {
    const q = trLower(searchQuery);
    const formattedDate = formatDate(r.record_date, i18n.language);

    const qtyStr = String(r.quantity);
    const qtyCommaStr = qtyStr.replace('.', ',');
    const unitStr = r.unit ? trLower(r.unit) : '';
    const qtyWithUnit = `${qtyStr} ${unitStr}`;
    const qtyWithUnitNoSpace = `${qtyStr}${unitStr}`;
    const qtyCommaWithUnit = `${qtyCommaStr} ${unitStr}`;
    const qtyCommaWithUnitNoSpace = `${qtyCommaStr}${unitStr}`;

    const matchesSearch = !searchQuery ||
                          trLower(r.item_name).includes(q) ||
                          (r.notes && trLower(r.notes).includes(q)) ||
                          trLower(formattedDate).includes(q) ||
                          trLower(r.record_date).includes(q) ||
                          qtyStr.includes(q) ||
                          qtyCommaStr.includes(q) ||
                          qtyWithUnit.includes(q) ||
                          qtyWithUnitNoSpace.includes(q) ||
                          qtyCommaWithUnit.includes(q) ||
                          qtyCommaWithUnitNoSpace.includes(q);
    const matchesUnit = !filterUnit || r.unit === filterUnit;
    let matchesDate = true;
    if (filterStartDate) matchesDate = matchesDate && r.record_date >= filterStartDate;
    if (filterEndDate) matchesDate = matchesDate && r.record_date <= filterEndDate;
    return matchesSearch && matchesUnit && matchesDate;
  });

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!activeProjectId) {
    return (
      <div className="glass-card text-center" style={{ padding: '3rem' }}>
        <h2>📐 {t('nav.production', 'İmalat & Metraj Takibi')}</h2>
        <p className="text-muted" style={{ marginTop: '1rem' }}>{t('common.select_project_msg', 'Lütfen sol menüden veya Şantiye Yönetimi sayfasından aktif bir şantiye seçin.')}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Main List and Form */}
      <div className="glass-card" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: 0 }}>{t('production.title', '📐 Metraj ve İmalat Takibi')}</h2>
          <span
            onClick={() => setHelpOpen(true)}
            style={{
              cursor: 'pointer',
              opacity: 'var(--guide-icon-opacity, 0.4)', filter: 'var(--guide-icon-filter, none)',
              transition: 'opacity 0.25s ease-in-out',
              fontSize: '1.6rem',
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
        <p className="card-subtitle active-project-subtitle" style={{ marginBottom: '1.5rem' }}>{t('common.active_project', 'Aktif Şantiye:')} <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{activeProject?.name}</span></p>

        <ProductionForm
          t={t}
          formData={formData}
          setFormData={setFormData}
          editingId={editingId}
          setEditingId={setEditingId}
          onSubmit={handleSubmit}
        />

        <ProductionFilters
          t={t}
          hasRecords={records.length > 0}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          filterStartDate={filterStartDate}
          onStartDateChange={handleStartDateChange}
          filterEndDate={filterEndDate}
          onEndDateChange={handleEndDateChange}
          filterUnit={filterUnit}
          setFilterUnit={setFilterUnit}
        />

        <ProductionTable
          t={t}
          i18n={i18n}
          loading={loading}
          filteredRecords={filteredRecords}
          paginatedRecords={paginatedRecords}
          totalPages={totalPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          searchQuery={searchQuery}
          onEdit={handleStartEdit}
          onDelete={handleDelete}
        />
      </div>

      <ConfirmationModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title={t('production.delete_title', 'Kaydı Sil')}
        message={t('production.delete_confirm', 'Bu imalat kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')}
      />

      <GuideDrawer
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('guides.quantity.title')}
        desc=""
        h1={t('guides.quantity.q1.title')}
        p1={t('guides.quantity.q1.desc')}
        h2={t('guides.quantity.q2.title')}
        p2={t('guides.quantity.q2.desc')}
        h3={t('guides.quantity.q3.title')}
        p3={t('guides.quantity.q3.desc')}
        h4={t('guides.quantity.q4.title')}
        p4={t('guides.quantity.q4.desc')}
        h5={t('guides.quantity.q5.title')}
        p5={t('guides.quantity.q5.desc')}
        h6={t('guides.quantity.q6.title')}
        p6={t('guides.quantity.q6.desc')}
      />
    </div>
  );
};

export default ProductionManagement;
