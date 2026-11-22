import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import CustomDatePicker from './ui/CustomDatePicker';
import GuideDrawer from './ui/GuideDrawer';
import { formatDate, trLower, localToday } from '../utils/formatUtils';
import apiWrite from '../utils/apiWrite';
import PageGuideIcon from './ui/PageGuideIcon';
import { clampRangeForStart, clampRangeForEnd } from '../utils/dateRangeUtils';
import Pagination from './ui/Pagination';
import NoProjectNotice from './ui/NoProjectNotice';
import { parsePositiveNumber } from '../utils/validation';
import { logError } from '../utils/logger';

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
    record_date: localToday(),
    notes: ''
  });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUnit, setFilterUnit] = useState('');
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 7;

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Guards against stale responses overwriting newer data after a project switch.
  const requestIdRef = useRef(0);

  const fetchRecords = async () => {
    if (!activeProjectId) {
      setRecords([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    if (window.api && window.api.db) {
      setLoading(true);
      try {
        const data = await window.api.db.read('production_records', { project_id: activeProjectId });
        if (requestId !== requestIdRef.current) return;
        setRecords(data || []);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        logError('Production records fetch failed:', err);
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: t('production.load_error', 'İmalat kayıtları yüklenemedi.'), type: 'error' }
        }));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
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
    // '-5' passes the truthiness check above; quantity has no CHECK constraint.
    const quantity = parsePositiveNumber(formData.quantity);
    if (quantity === null) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('common.invalid_positive_number', 'Lütfen sıfırdan büyük geçerli bir miktar girin.'), type: 'warning' }
      }));
      return;
    }

    if (window.api && window.api.db) {
      const payload = {
        project_id: activeProjectId,
        item_name: formData.item_name,
        quantity,
        unit: formData.unit,
        record_date: formData.record_date,
        notes: formData.notes
      };

      const res = editingId
        ? await apiWrite(window.api.db.update('production_records', editingId, payload))
        : await apiWrite(window.api.db.create('production_records', payload));
      if (res && res.success === false) return;
      if (editingId) setEditingId(null);

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
      const res = await apiWrite(window.api.db.delete('production_records', confirmModal.id));
      // Keep the dialog open on failure so the user can retry; apiWrite has
      // already surfaced the reason in a toast.
      if (res && res.success === false) return;
      setConfirmModal({ isOpen: false, id: null });
      fetchRecords();
    }
  };

  // Filter and paginate records.
  // Memoized: search + per-row date formatting previously ran on every render.
  const filteredRecords = useMemo(() => {
    const q = trLower(searchQuery);
    return records.filter(r => {
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
  }, [records, searchQuery, filterUnit, filterStartDate, filterEndDate, i18n.language]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!activeProjectId) {
    return <NoProjectNotice titleKey="nav.production" titleFallback="Production and quantities" />;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Main List and Form */}
      <div className="glass-card" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: 0 }}>{t('production.title', ' Metraj ve İmalat Takibi')}</h2>
          <PageGuideIcon onClick={() => setHelpOpen(true)} />
        </div>
        <p className="card-subtitle active-project-subtitle" style={{ marginBottom: '1.5rem' }}>{t('common.active_project', 'Aktif Şantiye:')} <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{activeProject?.name}</span></p>

        {/* Add Record Form */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('production.item_name', 'İmalat Kalemi')}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('production.item_name_ph', 'Örn: Tuğla Duvar Örme')} 
              value={formData.item_name}
              onChange={e => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('common.quantity', 'Miktar')}</label>
            <input 
              type="number" 
              className="form-input" 
              placeholder="0.00" 
              min="0.01" 
              step="0.01"
              value={formData.quantity}
              onChange={e => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('common.unit', 'Birim')}</label>
            <select 
              className="form-input" 
              value={formData.unit}
              onChange={e => setFormData(prev => ({ ...prev, unit: e.target.value }))}
            >
              <option value="m²">m² ({t('units.sqm', 'Metrekare')})</option>
              <option value="m³">m³ ({t('units.cbm', 'Metreküp')})</option>
              <option value="mt">mt ({t('units.linear_m', 'Metretül')})</option>
              <option value="ton">{t('units.ton', 'Ton')}</option>
              <option value="kg">{t('units.kg', 'Kg')}</option>
              <option value="adet">{t('units.adet', 'Adet')}</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('common.date', 'Tarih')}</label>
            <CustomDatePicker 
              className="form-input" 
              value={formData.record_date}
              onChange={e => setFormData(prev => ({ ...prev, record_date: e.target.value }))}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
            <label className="form-label">{t('common.notes', 'Açıklama / Not')}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('common.notes_placeholder', 'Ek notlar...')} 
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', gridColumn: 'span 2' }}>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '42px' }}>
              {editingId ? t('common.save', 'Güncelle') : t('common.save', 'Kaydet')}
            </button>
            {editingId && (
              <button 
                type="button" 
                className="btn" 
                onClick={() => {
                  setEditingId(null);
                  setFormData({
                    item_name: '',
                    quantity: '',
                    unit: 'm²',
                    record_date: localToday(),
                    notes: ''
                  });
                }} 
                style={{ height: '42px' }}
              >
                {t('common.cancel', 'Vazgeç')}
              </button>
            )}
          </div>
        </form>

        {/* Filters & Search Bar */}
        {records.length > 0 && (
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.02)', 
            border: '1px solid var(--glass-border)', 
            borderRadius: '12px', 
            padding: '0.75rem 1rem', 
            marginBottom: '0.25rem',
            display: 'flex', 
            gap: '1rem', 
            alignItems: 'flex-end', 
            flexWrap: 'wrap' 
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '2 1 200px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.search', 'Arama')}</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
                <input 
                  type="text"
                  className="form-input"
                  placeholder={t('filters.search_production', 'İmalat, tarih, miktar veya notlarda ara...')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ paddingRight: '2.5rem', width: '100%', marginBottom: 0 }}
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
                    
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.start_date', 'Başlangıç Tarihi')}</label>
              <CustomDatePicker 
                className="form-input" 
                value={filterStartDate} 
                onChange={e => handleStartDateChange(e.target.value)} 
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.end_date', 'Bitiş Tarihi')}</label>
              <CustomDatePicker 
                className="form-input" 
                value={filterEndDate} 
                onChange={e => handleEndDateChange(e.target.value)} 
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.unit', 'Birim')}</label>
              <select 
                className="form-input" 
                value={filterUnit} 
                onChange={e => setFilterUnit(e.target.value)}
                style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
              >
                <option value="">{t('filters.all_units', 'Tümü')}</option>
                <option value="m²">m²</option>
                <option value="m³">m³</option>
                <option value="mt">mt</option>
                <option value="adet">{t('units.adet', 'Adet')}</option>
                <option value="kg">{t('units.kg', 'Kg')}</option>
                <option value="ton">{t('units.ton', 'Ton')}</option>
              </select>
            </div>
          </div>
        )}

        {/* Records Table */}
        {loading ? (
          <div className="skeleton" style={{ height: '200px', width: '100%' }}></div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {searchQuery ? t('production.no_results', 'Arama kriterlerine uygun imalat kaydı bulunamadı.') : t('empty.production', 'Bu şantiye için henüz bir imalat kaydı girilmemiş.')}
          </div>
        ) : (
          <div className="fin-table-container" style={{ marginTop: '0.1rem' }}>
            <table className="fin-table">
              <thead>
                <tr>
                  <th>{t('common.date', 'Tarih')}</th>
                  <th>{t('production.item_name', 'İmalat Kalemi')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.quantity', 'Miktar')}</th>
                  <th>{t('common.unit', 'Birim')}</th>
                  <th>{t('common.description', 'Açıklama')}</th>
                  <th style={{ textAlign: 'right' }}>{t('subcontractor.table_action', 'İşlem')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map(r => (
                  <tr key={r.id}>
                    <td>{formatDate(r.record_date, i18n.language)}</td>
                    <td style={{ fontWeight: '600' }}>{r.item_name}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--secondary)' }}>{r.quantity}</td>
                    <td>{r.unit}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{r.notes || '-'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        <button 
                          className="btn" 
                          onClick={() => handleStartEdit(r)}
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
                          onClick={() => handleDelete(r.id)}
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
                ))}
              </tbody>
            </table>

            {/* Pagination - shared component (ui/Pagination) */}
            <Pagination variant="sticky" currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalRecords={filteredRecords.length} />
          </div>
        )}
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
