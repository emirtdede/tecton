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
import { Eye, Pencil, Trash2, X } from 'lucide-react';
import useTransientMessage from '../hooks/useTransientMessage';
import MobileUploadModal from './ui/MobileUploadModal';
import Pagination from './ui/Pagination';

/**
 * Report bodies are written by site staff and saved with `**bold**` markers for
 * emphasis. Rendering them as plain text left the asterisks visible, so the
 * markers are turned into real emphasis here.
 */
function ReportText({ text }) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.55, margin: 0 }}>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={index} style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{part.slice(2, -2)}</strong>
          : <span key={index}>{part}</span>
      )}
    </p>
  );
}

const QualityReports = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const containerRef = useRef(null);
  
  const todayStr = localToday();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'open',
    photo_path: '',
    report_date: todayStr
  });

  const [photoPreview, setPhotoPreview] = useState('');
  const [qrModal, setQrModal] = useState({ isOpen: false, qrCode: '', url: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const [lightboxImage, setLightboxImage] = useState(null);
  // Inline transient message (replaces the local timer ref + cleanup copy).
  const { message: toastMessage, show: showToast } = useTransientMessage();

  const handleStartEdit = (rep) => {
    setEditingId(rep.id);
    setFormData({
      title: rep.title,
      description: rep.description || '',
      status: rep.status,
      photo_path: rep.photo_path || '',
      report_date: rep.report_date
    });
    if (rep.photo_path) {
      loadPhotoPreview(rep.photo_path);
    } else {
      setPhotoPreview('');
    }
  };

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [filterPhoto, setFilterPhoto] = useState(''); // '' | 'yes' | 'no'
  const [filterStatus, setFilterStatus] = useState(''); // '' | 'open' | 'resolved'
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 4;

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterPhoto, filterStatus, filterStartDate, filterEndDate]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  // Guards against stale responses overwriting newer data after a project switch.
  const requestIdRef = useRef(0);

  const fetchReports = async () => {
    if (!activeProjectId) {
      setReports([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    if (window.api && window.api.db) {
      setLoading(true);
      try {
        const data = await window.api.db.read('quality_reports', { project_id: activeProjectId });
        if (requestId !== requestIdRef.current) return;
        setReports(Array.isArray(data) ? data : []);
      } catch (err) {
        // An unguarded rejection used to leave the table spinning forever.
        if (requestId !== requestIdRef.current) return;
        logError('Quality reports fetch failed:', err);
        setReports([]);
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: t('quality.load_error', 'Kalite tutanakları yüklenemedi.'), type: 'error' }
        }));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
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
          // Local showToast removed, using global ToastManager
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('materials.photo_success', 'Mobil cihazdan çekilen fotoğraf başarıyla alındı!'), type: 'success' } }));
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
    document.getElementById('local-quality-photo-input').click();
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeProjectId || !formData.title) return;

    if (window.api && window.api.db) {
      const payload = {
        project_id: activeProjectId,
        title: formData.title,
        description: formData.description,
        status: formData.status,
        photo_path: formData.photo_path,
        report_date: formData.report_date
      };

      const res = editingId
        ? await apiWrite(window.api.db.update('quality_reports', editingId, payload))
        : await apiWrite(window.api.db.create('quality_reports', payload));
      if (res && res.success === false) return;
      if (editingId) setEditingId(null);

      setFormData(prev => ({
        ...prev,
        title: '',
        description: '',
        status: 'open',
        photo_path: '',
        report_date: todayStr
      }));
      setPhotoPreview('');
      fetchReports();
    }
  };

  const handleToggleStatus = async (report) => {
    if (window.api && window.api.db) {
      const nextStatus = report.status === 'open' ? 'resolved' : 'open';
      await apiWrite(window.api.db.update('quality_reports', report.id, { status: nextStatus }));
      fetchReports();
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (window.api && window.api.db && confirmModal.id) {
      await apiWrite(window.api.db.delete('quality_reports', confirmModal.id));
      setConfirmModal({ isOpen: false, id: null });
      fetchReports();
    }
  };

  // Filter and sort reports (memoized - filter + in-place sort ran on every render).
  const filteredReports = useMemo(() => {
    const q = trLower(searchQuery);
    const rows = reports.filter(r => {
      const matchesSearch = !searchQuery ||
                            trLower(r.title).includes(q) ||
                            (r.description && trLower(r.description).includes(q)) ||
                            trLower(formatDate(r.report_date, i18n.language)).includes(q);
      const matchesPhoto = !filterPhoto ||
                           (filterPhoto === 'yes' && !!r.photo_path) ||
                           (filterPhoto === 'no' && !r.photo_path);
      const matchesStatus = !filterStatus || r.status === filterStatus;

      let matchesDate = true;
      if (filterStartDate) matchesDate = matchesDate && r.report_date >= filterStartDate;
      if (filterEndDate) matchesDate = matchesDate && r.report_date <= filterEndDate;

      return matchesSearch && matchesPhoto && matchesStatus && matchesDate;
    });

    return rows.sort((a, b) => {
      if (sortBy === 'date_desc') {
        return b.report_date.localeCompare(a.report_date);
      } else if (sortBy === 'date_asc') {
        return a.report_date.localeCompare(b.report_date);
      }
      return 0;
    });
  }, [reports, searchQuery, filterPhoto, filterStatus, filterStartDate, filterEndDate, sortBy, i18n.language]);

  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!activeProjectId) {
    return <NoProjectNotice titleKey="nav.quality" titleFallback="Quality control reports" />;
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <header className="page-head">
        <div>
          <h1 className="page-head-title">{t('quality.title', 'Kalite Kontrol & Şantiye Tutanakları')}</h1>
          <p className="card-subtitle active-project-subtitle">
            {t('common.active_project', 'Aktif Şantiye:')} <strong>{activeProject?.name}</strong>
          </p>
        </div>
        <PageGuideIcon onClick={() => setHelpOpen(true)} />
      </header>

      {/* Main List and Form */}
      <div className="glass-card" style={{ width: '100%', marginTop: '1rem' }}>
        {/* Add Record Form */}
        <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '0.75rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 3' }}>
            <label className="form-label">{t('quality.report_title', 'Tutanak / Tespit Başlığı')}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('quality.report_title_ph', 'Örn: 3. Kat Aks Kayması / Hatalı Kalıp Kurulumu')} 
              value={formData.title}
              onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 1' }}>
            <label className="form-label">{t('common.date', 'Tarih')}</label>
            <CustomDatePicker 
              className="form-input"
              value={formData.report_date} 
              onChange={e => setFormData(prev => ({ ...prev, report_date: e.target.value }))} 
              required 
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
            <label className="form-label">{t('quality.initial_status', 'Başlangıç Durumu')}</label>
            <select 
              className="form-input" 
              value={formData.status}
              onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="open">{t('quality.status_open', 'AÇIK (Sorun Çözülmedi)')}</option>
              <option value="resolved">{t('filters.status_resolved', 'ÇÖZÜLDÜ (Kapatıldı)')}</option>
            </select>
          </div>
          
          <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 2' }}>
            <label className="form-label">{t('quality.photo_label', 'Görsel / Tutanak Fotoğrafı')}</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <button type="button" className="btn" onClick={handleSelectLocalPhoto} style={{ flex: 1, fontSize: '0.85rem' }}>
                {t('quality.select_pc', 'PC\'den Seç')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleOpenQRModal} style={{ flex: 1, fontSize: '0.85rem' }}>
                {t('quality.upload_mobile', 'Mobilden Yükle (QR)')}
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
                      background: 'var(--danger)', 
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
                  ><X size={10} aria-hidden="true" />
                    
                  </button>
                </div>
              )}
            </div>
            <input 
              type="file" 
              id="local-quality-photo-input" 
              accept="image/*" 
              style={{ display: 'none' }} 
              onChange={handleLocalFileChange} 
            />
          </div>
 
          <div className="form-group" style={{ marginBottom: 0, gridColumn: 'span 6' }}>
            <label className="form-label">{t('quality.detailed_description', 'Detaylı Açıklama')}</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('quality.description_ph', 'Tespit edilen aksaklığın ayrıntıları...')} 
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>
          
          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              {editingId ? t('common.save', 'Tutanak Güncelle') : t('quality.add_report', 'Tutanak Ekle')}
            </button>
            {editingId && (
              <button 
                type="button" 
                className="btn" 
                onClick={() => {
                  setEditingId(null);
                  setFormData({
                    title: '',
                    description: '',
                    status: 'open',
                    photo_path: '',
                    report_date: todayStr
                  });
                  setPhotoPreview('');
                }}
               
              >
                {t('common.cancel', 'Vazgeç')}
              </button>
            )}
          </div>
        </form>

        {/* Filters & Search Bar */}
        {reports.length > 0 && (
          <div style={{ 
            background: 'var(--surface-subtle)', 
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
                  placeholder={t('filters.search_reports', 'Tutanak başlıklarında, açıklamalarda veya tarihte ara...')}
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
                  ><X size={14} aria-hidden="true" />
                    
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.start_date', 'Başlangıç Tarihi')}</label>
              <CustomDatePicker
                value={filterStartDate}
                onChange={e => handleStartDateChange(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.end_date', 'Bitiş Tarihi')}</label>
              <CustomDatePicker
                value={filterEndDate}
                onChange={e => handleEndDateChange(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 130px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.sort', 'Sıralama')}</label>
              <select 
                className="form-input" 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)}
                style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
              >
                <option value="date_desc">{t('filters.newest', 'Yeniden Eskiye')}</option>
                <option value="date_asc">{t('filters.oldest', 'Eskiden Yeniye')}</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.photo_status', 'Görsel Durumu')}</label>
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.status', 'Durum')}</label>
              <select 
                className="form-input" 
                value={filterStatus} 
                onChange={e => setFilterStatus(e.target.value)}
                style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
              >
                <option value="">{t('filters.status_all', 'Tümü')}</option>
                <option value="open">{t('quality.status_open', 'Açık')}</option>
                <option value="resolved">{t('filters.status_resolved', 'Çözüldü')}</option>
              </select>
            </div>
          </div>
        )}

        {/* Tutanak List */}
        {loading ? (
          <div className="skeleton" style={{ height: '200px', width: '100%' }}></div>
        ) : filteredReports.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {searchQuery ? t('quality.no_results', 'Arama kriterlerine uygun tutanak kaydı bulunamadı.') : t('empty.quality', 'Bu şantiye için henüz kalite kontrol raporu bulunmuyor.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.25rem' }}>
            {paginatedReports.map(rep => (
              <div
                key={rep.id}
                className="glass-card"
                style={{ padding: '0.875rem 1rem', gap: '0.5rem' }}
              >
                <div className="card-toolbar">
                  <div>
                    <h3 className="card-title" style={{ fontSize: '0.9375rem', marginBottom: '0.125rem' }}>{rep.title}</h3>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{formatDate(rep.report_date, i18n.language)}</span>
                  </div>
                  <div className="card-toolbar-actions">
                    <button
                      type="button"
                      className={`pill ${rep.status === 'resolved' ? 'pill-success' : 'pill-danger'}`}
                      onClick={() => handleToggleStatus(rep)}
                      title={t('quality.toggle_status', 'Durumu değiştir')}
                    >
                      {rep.status === 'resolved'
                        ? t('filters.status_resolved', 'ÇÖZÜLDÜ')
                        : t('quality.status_open', 'AÇIK (Sorun Çözülmedi)')}
                    </button>
                    <div className="row-actions">
                      {rep.photo_path && (
                        <button
                          type="button"
                          className="icon-btn"
                          onClick={async () => {
                            const res = await window.api.media.readPhoto({ relativePath: rep.photo_path });
                            if (res.success) {
                              setLightboxImage(res.base64);
                            }
                          }}
                          title={t('quality.open_photo', 'Tutanak Görselini Aç')}
                          aria-label={t('quality.open_photo', 'Tutanak Görselini Aç')}
                        >
                          <Eye size={15} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => handleStartEdit(rep)}
                        title={t('dashboard.edit', 'Düzenle')}
                        aria-label={t('dashboard.edit', 'Düzenle')}
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn is-danger"
                        onClick={() => handleDelete(rep.id)}
                        title={t('common.delete', 'Sil')}
                        aria-label={t('common.delete', 'Sil')}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
                {rep.description && <ReportText text={rep.description} />}
              </div>
            ))}

            {/* Pagination - shared component (ui/Pagination) */}
            <Pagination variant="sticky" currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalRecords={filteredReports.length} />
          </div>
        )}
      </div>

      <MobileUploadModal
        isOpen={qrModal.isOpen}
        onClose={handleCloseQRModal}
        title={t('quality.upload_mobile_title', 'Tutanak Fotoğrafı Yükle')}
        description={t('quality.upload_mobile_desc', 'Telefonunuzu **aynı WiFi ağına** bağlayıp aşağıdaki QR kodu okutun:')}
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
        title={t('quality.delete_title', 'Tutanak Sil')}
        message={t('quality.delete_confirm', 'Bu kalite kontrol tutanağını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')}
      />

      <GuideDrawer 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title={t('guides.quality.title')} 
        desc="" 
        h1={t('guides.quality.q1.title')} 
        p1={t('guides.quality.q1.desc')} 
        h2={t('guides.quality.q2.title')} 
        p2={t('guides.quality.q2.desc')} 
        h3={t('guides.quality.q3.title')} 
        p3={t('guides.quality.q3.desc')} 
        h4={t('guides.quality.q4.title')} 
        p4={t('guides.quality.q4.desc')} 
        h5={t('guides.quality.q5.title')} 
        p5={t('guides.quality.q5.desc')} 
        h6={t('guides.quality.q6.title')} 
        p6={t('guides.quality.q6.desc')} 
      />

      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'var(--success)',
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

export default QualityReports;
