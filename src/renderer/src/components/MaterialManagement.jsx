import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { logError } from '../utils/logger';
import ConfirmationModal from './ui/ConfirmationModal';
import NoProjectNotice from './ui/NoProjectNotice';
import CustomDatePicker from './ui/CustomDatePicker';
import LightboxModal from './ui/LightboxModal';
import { readPhotoAsBase64, savePhotoFromFile } from '../utils/photoUtils';
import GuideDrawer from './ui/GuideDrawer';
import { formatDate, trLower, localToday } from '../utils/formatUtils';
import apiWrite, { apiMessage } from '../utils/apiWrite';
import PageGuideIcon from './ui/PageGuideIcon';
import { clampRangeForStart, clampRangeForEnd } from '../utils/dateRangeUtils';
import useTransientMessage from '../hooks/useTransientMessage';
import MobileUploadModal from './ui/MobileUploadModal';
import Pagination from './ui/Pagination';
import { parsePositiveNumber } from '../utils/validation';

const MaterialManagement = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Edit mode state
  const [editingId, setEditingId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const [formData, setFormData] = useState({
    supplier: '',
    material_type: '',
    quantity: '',
    unit: 'm³',
    receipt_number: '',
    receipt_date: localToday(),
    photo_path: '',
    notes: ''
  });
  
  const [photoPreview, setPhotoPreview] = useState('');
  const [qrModal, setQrModal] = useState({ isOpen: false, qrCode: '', url: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const [lightboxImage, setLightboxImage] = useState(null);
  // Inline transient message (replaces the local timer ref + cleanup copy).
  const { message: toastMessage, show: showToast } = useTransientMessage();

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
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
  const [filterPhoto, setFilterPhoto] = useState(''); // '' | 'yes' | 'no'
  const [filterUnit, setFilterUnit] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;
  const containerRef = useRef(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStartDate, filterEndDate, filterPhoto, filterUnit]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

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
        const data = await window.api.db.read('materials', { project_id: activeProjectId });
        if (requestId !== requestIdRef.current) return;
        setRecords(Array.isArray(data) ? data : []);
      } catch (err) {
        // Previously an IPC rejection escaped as an unhandled rejection and the
        // loader never cleared.
        if (requestId !== requestIdRef.current) return;
        logError('Materials fetch failed:', err);
        setRecords([]);
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: t('materials.load_error', 'Malzeme kayıtları yüklenemedi.'), type: 'error' }
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
  }, [searchQuery]);

  // Listen for LAN photo uploads
  useEffect(() => {
    if (window.api && window.api.system.onPhotoUploaded) {
      const unsubscribe = window.api.system.onPhotoUploaded((data) => {
        if (data.projectId == activeProjectId) {
          setFormData(prev => ({ ...prev, photo_path: data.relativePath }));
          loadPhotoPreview(data.relativePath);
          // Show non-blocking toast and close QR Modal
          // Local showToast removed, using global ToastManager
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('materials.photo_success', ' Mobil cihazdan çekilen fotoğraf başarıyla alındı!'), type: 'success' } }));
          setQrModal({ isOpen: false, qrCode: '', url: '' });
          // Fire-and-forget, but a rejection must not surface as an
          // unhandled promise rejection in the renderer.
          Promise.resolve(window.api.system.stopLANServer()).catch(logError);
        }
      });
      return () => unsubscribe();
    }
  }, [activeProjectId]);

  const loadPhotoPreview = async (relativePath) => {
    const base64 = await readPhotoAsBase64(relativePath);
    if (base64) setPhotoPreview(base64);
  };

  const handleSelectLocalPhoto = () => {
    document.getElementById('local-material-photo-input').click();
  };

  const handleLocalFileChange = async (e) => {
    if (!e.target.files || e.target.files.length === 0) return;
    try {
      const saveRes = await savePhotoFromFile(e.target.files[0], activeProjectId);
      if (saveRes.success) {
        setFormData(prev => ({ ...prev, photo_path: saveRes.relativePath }));
        setPhotoPreview(saveRes.base64);
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('materials.photo_error', 'Fotoğraf kaydedilemedi:') + ' ' + apiMessage(saveRes), type: 'error' } }));
      }
    } catch (err) {
      // Log technical detail, show a user-safe message instead of the raw error.
      logError('Photo upload failed:', err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('materials.photo_upload_error', 'Fotoğraf işlenirken hata oluştu.'), type: 'error' } }));
    }
  };

  const handleOpenQRModal = async () => {
    if (window.api && window.api.system.startLANServer && activeProject) {
      const res = await window.api.system.startLANServer({
        projectId: activeProjectId,
        projectName: activeProject.name,
        lang: i18n.language
      });
      if (res.success) {
        setQrModal({
          isOpen: true,
          qrCode: res.qrCodeDataUrl,
          url: res.url
        });
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('materials.lan_error', 'Yerel sunucu başlatılamadı:') + ' ' + apiMessage(res), type: 'error' } }));
      }
    }
  };

  const handleCloseQRModal = () => {
    setQrModal({ isOpen: false, qrCode: '', url: '' });
    if (window.api && window.api.system.stopLANServer) {
      Promise.resolve(window.api.system.stopLANServer()).catch(logError);
    }
  };

  const handleStartEdit = (r) => {
    setEditingId(r.id);
    setFormData({
      supplier: r.supplier,
      material_type: r.material_type,
      quantity: r.quantity,
      unit: r.unit,
      receipt_number: r.receipt_number || '',
      receipt_date: r.receipt_date,
      photo_path: r.photo_path || '',
      notes: r.notes || ''
    });
    if (r.photo_path) {
      loadPhotoPreview(r.photo_path);
    } else {
      setPhotoPreview('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeProjectId || !formData.supplier || !formData.material_type || !formData.quantity) return;
    // The truthiness check above accepts '-5'. Quantity is stored as REAL with no
    // CHECK constraint, so a negative value would persist and corrupt every total.
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
        supplier: formData.supplier,
        material_type: formData.material_type,
        quantity,
        unit: formData.unit,
        receipt_number: formData.receipt_number,
        receipt_date: formData.receipt_date,
        photo_path: formData.photo_path,
        notes: formData.notes
      };

      const res = editingId
        ? await apiWrite(window.api.db.update('materials', editingId, payload))
        : await apiWrite(window.api.db.create('materials', payload));
      // Keep the filled form on failure so the user does not have to retype it.
      if (res && res.success === false) return;
      if (editingId) setEditingId(null);

      setFormData(prev => ({
        ...prev,
        supplier: '',
        material_type: '',
        quantity: '',
        receipt_number: '',
        photo_path: '',
        notes: ''
      }));
      setPhotoPreview('');
      fetchRecords();
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (window.api && window.api.db && confirmModal.id) {
      await apiWrite(window.api.db.delete('materials', confirmModal.id));
      setConfirmModal({ isOpen: false, id: null });
      fetchRecords();
    }
  };

  // Filter and paginate records.
  // Memoized: search + per-row currency/date formatting previously ran on every
  // render (typing in the form, opening modals, photo previews...).
  const filteredRecords = useMemo(() => {
    const q = trLower(searchQuery);
    return records.filter(r => {
      const formattedDate = formatDate(r.receipt_date, i18n.language);

      const qtyStr = String(r.quantity);
      const qtyCommaStr = qtyStr.replace('.', ',');
      const unitStr = r.unit ? trLower(r.unit) : '';
      const qtyWithUnit = `${qtyStr} ${unitStr}`;
      const qtyWithUnitNoSpace = `${qtyStr}${unitStr}`;
      const qtyCommaWithUnit = `${qtyCommaStr} ${unitStr}`;
      const qtyCommaWithUnitNoSpace = `${qtyCommaStr}${unitStr}`;

      const matchesSearch = !searchQuery ||
                            trLower(r.supplier).includes(q) ||
                            trLower(r.material_type).includes(q) ||
                            (r.receipt_number && trLower(r.receipt_number).includes(q)) ||
                            (r.notes && trLower(r.notes).includes(q)) ||
                            trLower(formattedDate).includes(q) ||
                            trLower(r.receipt_date).includes(q) ||
                            qtyStr.includes(q) ||
                            qtyCommaStr.includes(q) ||
                            qtyWithUnit.includes(q) ||
                            qtyWithUnitNoSpace.includes(q) ||
                            qtyCommaWithUnit.includes(q) ||
                            qtyCommaWithUnitNoSpace.includes(q);
      const matchesUnit = !filterUnit || r.unit === filterUnit;
      const matchesPhoto = !filterPhoto ||
                           (filterPhoto === 'yes' && !!r.photo_path) ||
                           (filterPhoto === 'no' && !r.photo_path);
      let matchesDate = true;
      if (filterStartDate) matchesDate = matchesDate && r.receipt_date >= filterStartDate;
      if (filterEndDate) matchesDate = matchesDate && r.receipt_date <= filterEndDate;
      return matchesSearch && matchesUnit && matchesPhoto && matchesDate;
    });
  }, [records, searchQuery, filterUnit, filterPhoto, filterStartDate, filterEndDate, i18n.language]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!activeProjectId) {
    return <NoProjectNotice titleKey="nav.materials" titleFallback="Delivery notes and materials" />;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Main List and Form */}
      <div className="glass-card" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: 0 }}>{t('materials.title', ' İrsaliye ve Malzeme Girişi')}</h2>
          <PageGuideIcon onClick={() => setHelpOpen(true)} />
        </div>
        <p className="card-subtitle active-project-subtitle" style={{ marginBottom: '1.5rem' }}>{t('common.active_project', 'Aktif Şantiye:')} <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{activeProject?.name}</span></p>

        {/* Add Record Form */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('materials.supplier', 'Tedarikçi Firma')}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('materials.supplier_ph', 'Örn: Akçansa Beton A.Ş.')} 
              value={formData.supplier}
              onChange={e => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('materials.material_type', 'Malzeme Cinsi')}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('materials.material_type_ph', 'Örn: C30 Hazır Beton')} 
              value={formData.material_type}
              onChange={e => setFormData(prev => ({ ...prev, material_type: e.target.value }))}
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
              <option value="m³">m³</option>
              <option value="ton">{t('units.ton', 'Ton')}</option>
              <option value="kg">{t('units.kg', 'Kg')}</option>
              <option value="adet">{t('units.adet', 'Adet')}</option>
              <option value="m²">m²</option>
              <option value="mt">mt</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('materials.receipt_no', 'İrsaliye / Fiş No')}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="IRS-998822" 
              value={formData.receipt_number}
              onChange={e => setFormData(prev => ({ ...prev, receipt_number: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('common.date', 'Tarih')}</label>
            <CustomDatePicker 
              className="form-input" 
              value={formData.receipt_date}
              onChange={e => setFormData(prev => ({ ...prev, receipt_date: e.target.value }))}
              required
            />
          </div>
          
          <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
            <label className="form-label">{t('materials.document_photo', 'Evrak Fotoğrafı')}</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button type="button" className="btn" onClick={handleSelectLocalPhoto} style={{ flex: 1, fontSize: '0.85rem' }}>
                {t('quality.select_pc', ' PC\'den Seç')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleOpenQRModal} style={{ flex: 1, fontSize: '0.85rem' }}>
                {t('quality.upload_mobile', ' Mobilden Yükle (QR)')}
              </button>
              {photoPreview && (
                <div 
                  style={{ 
                    position: 'relative', 
                    width: '45px', 
                    height: '38px', 
                    flexShrink: 0, 
                    borderRadius: '6px', 
                    overflow: 'hidden', 
                    border: '1px solid var(--glass-border)', 
                    cursor: 'pointer',
                    boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
                  }} 
                  onClick={() => setLightboxImage(photoPreview)}
                >
                  <img src={photoPreview} alt={t('common.preview', 'Önizleme')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button 
                    type="button"
                    style={{ 
                      position: 'absolute', 
                      top: 0, 
                      right: 0, 
                      background: 'rgba(239, 68, 68, 0.9)', 
                      color: 'white', 
                      border: 'none', 
                      width: '14px', 
                      height: '14px', 
                      borderRadius: '50%', 
                      fontSize: '9px', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      cursor: 'pointer', 
                      padding: 0 
                    }}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      setPhotoPreview(''); 
                      setFormData(prev => ({ ...prev, photo_path: '' })); 
                    }}
                  >
                    
                  </button>
                </div>
              )}
            </div>
            <input 
              type="file" 
              id="local-material-photo-input" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleLocalFileChange} 
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 5' }}>
            <label className="form-label">{t('common.notes', 'Açıklama / Not')}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('common.notes_placeholder', 'Ek notlar...')} 
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem', width: '100%', gridColumn: 'span 3' }}>
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
                    supplier: '',
                    material_type: '',
                    quantity: '',
                    unit: 'm³',
                    receipt_number: '',
                    receipt_date: localToday(),
                    photo_path: '',
                    notes: ''
                  });
                  setPhotoPreview('');
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
                  placeholder={t('filters.search_materials', 'Tedarikçi, malzeme, tarih, miktar veya notlarda ara...')}
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
                <option value="m³">m³</option>
                <option value="adet">{t('units.adet', 'Adet')}</option>
                <option value="ton">{t('units.ton', 'Ton')}</option>
                <option value="kg">{t('units.kg', 'Kg')}</option>
                <option value="m²">m²</option>
                <option value="mt">mt</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.photo_status', 'Görsel')}</label>
              <select 
                className="form-input" 
                value={filterPhoto} 
                onChange={e => setFilterPhoto(e.target.value)}
                style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
              >
                <option value="">{t('filters.photo_all', 'Tümü')}</option>
                <option value="yes">{t('filters.with_photo', 'Fotoğraflı')}</option>
                <option value="no">{t('filters.without_photo', 'Fotoğrafsız')}</option>
              </select>
            </div>
          </div>
        )}

        {/* Records List */}
        {loading ? (
          <div className="skeleton" style={{ height: '200px', width: '100%' }}></div>
        ) : filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {searchQuery ? t('materials.no_results', 'Arama kriterlerine uygun malzeme/irsaliye kaydı bulunamadı.') : t('empty.delivery', 'Henüz irsaliye kaydı bulunmuyor.')}
          </div>
        ) : (
          <div className="fin-table-container" style={{ marginTop: '0.1rem' }}>
            <table className="fin-table">
              <thead>
                <tr>
                  <th>{t('common.date', 'Tarih')}</th>
                  <th>{t('materials.receipt_no', 'Evrak / Fiş No')}</th>
                  <th>{t('materials.supplier', 'Tedarikçi')}</th>
                  <th>{t('materials.material_type', 'Malzeme')}</th>
                  <th style={{ textAlign: 'right' }}>{t('common.quantity', 'Miktar')}</th>
                  <th style={{ textAlign: 'right' }}>{t('subcontractor.table_action', 'İşlem')}</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRecords.map(r => (
                  <tr key={r.id}>
                    <td>{formatDate(r.receipt_date, i18n.language)}</td>
                    <td style={{ fontWeight: '600' }}>{r.receipt_number || '-'}</td>
                    <td>{r.supplier}</td>
                    <td>{r.material_type}</td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--success)' }}>
                      {r.quantity} {r.unit}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'flex-end' }}>
                        {r.photo_path && (
                          <button 
                            className="btn btn-primary" 
                            onClick={async () => {
                              const res = await window.api.media.readPhoto({ relativePath: r.photo_path });
                              if (res.success) {
                                setLightboxImage(res.base64);
                              }
                            }}
                            style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            title={t('materials.view_photo', 'Görüntüle')}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                              <circle cx="12" cy="12" r="3" />
                            </svg>
                          </button>
                        )}
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

      <MobileUploadModal
        isOpen={qrModal.isOpen}
        onClose={handleCloseQRModal}
        title={t('materials.upload_mobile_title', 'Mobil Fotoğraf Yükle')}
        description={t('materials.upload_mobile_desc', 'Telefonunuzu ve bilgisayarınızı **aynı WiFi ağına** bağlayın, ardından QR kodu kameranızla taratın:')}
        qrCode={qrModal.qrCode}
        url={qrModal.url}
      />

      {/* Lightbox / Fullscreen Image Viewer Modal */}
      <LightboxModal 
        isOpen={!!lightboxImage} 
        imageSrc={lightboxImage} 
        onClose={() => setLightboxImage(null)} 
      />

      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title={t('materials.delete_title', 'Evrak Sil')}
        message={t('materials.delete_confirm', 'Bu irsaliye kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')}
      />

      <GuideDrawer 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title={t('guides.delivery.title')} 
        desc="" 
        h1={t('guides.delivery.q1.title')} 
        p1={t('guides.delivery.q1.desc')} 
        h2={t('guides.delivery.q2.title')} 
        p2={t('guides.delivery.q2.desc')} 
        h3={t('guides.delivery.q3.title')} 
        p3={t('guides.delivery.q3.desc')} 
        h4={t('guides.delivery.q4.title')} 
        p4={t('guides.delivery.q4.desc')} 
        h5={t('guides.delivery.q5.title')} 
        p5={t('guides.delivery.q5.desc')} 
        h6={t('guides.delivery.q6.title')} 
        p6={t('guides.delivery.q6.desc')} 
      />

      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(16, 185, 129, 0.95)',
          color: '#fff',
          padding: '0.75rem 1.5rem',
          borderRadius: '8px',
          zIndex: 10000,
          boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.2)',
          fontWeight: 'bold',
          pointerEvents: 'none',
          animation: 'fadeIn 0.3s ease'
        }}>
          {toastMessage}
        </div>
      )}
    </div>
  );
};

export default MaterialManagement;
