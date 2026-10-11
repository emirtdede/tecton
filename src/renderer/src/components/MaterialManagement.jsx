import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import LightboxModal from './ui/LightboxModal';
import { compressImage } from '../utils/imageCompressor';
import GuideDrawer from './ui/GuideDrawer';
import { formatDate, trLower } from '../utils/formatUtils';
import MaterialForm from './MaterialForm';
import MaterialFilters from './MaterialFilters';
import MaterialTable from './MaterialTable';

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
    receipt_date: new Date().toISOString().split('T')[0],
    photo_path: '',
    notes: ''
  });

  const [photoPreview, setPhotoPreview] = useState('');
  const [qrModal, setQrModal] = useState({ isOpen: false, qrCode: '', url: '' });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });
  const [lightboxImage, setLightboxImage] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage('');
    }, 3000);
  };

  const renderDescription = (text) => {
    const parts = text.split('**');
    return parts.map((part, index) => {
      if (index % 2 === 1) {
        return <strong key={index} style={{ fontWeight: 'bold' }}>{part}</strong>;
      }
      return part;
    });
  };

  // Search & Pagination states
  const [searchQuery, setSearchQuery] = useState('');
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

  const fetchRecords = async () => {
    if (!activeProjectId) return;
    if (window.api && window.api.db) {
      setLoading(true);
      const data = await window.api.db.read('materials', { project_id: activeProjectId });
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
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('materials.photo_success', '✓ Mobil cihazdan çekilen fotoğraf başarıyla alındı!'), type: 'success' } }));
          setQrModal({ isOpen: false, qrCode: '', url: '' });
          window.api.system.stopLANServer();
        }
      });
      return () => unsubscribe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  const loadPhotoPreview = async (relativePath) => {
    if (window.api && window.api.media.readPhoto && relativePath) {
      const res = await window.api.media.readPhoto({ relativePath });
      if (res.success) {
        setPhotoPreview(res.base64);
      }
    }
  };

  const handleSelectLocalPhoto = () => {
    document.getElementById('local-material-photo-input').click();
  };

  const handleLocalFileChange = async (e) => {
    if (e.target.files && e.target.files.length > 0) {
      try {
        const compressedBase64 = await compressImage(e.target.files[0]);
        if (window.api && window.api.media.savePhotoBase64) {
          const saveRes = await window.api.media.savePhotoBase64({
            projectId: activeProjectId,
            base64Data: compressedBase64
          });
          if (saveRes.success) {
            setFormData(prev => ({ ...prev, photo_path: saveRes.relativePath }));
            setPhotoPreview(compressedBase64);
          } else {
            window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('materials.photo_error', 'Fotoğraf kaydedilemedi:') + ' ' + saveRes.message, type: 'error' } }));
          }
        }
      } catch (err) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('materials.photo_upload_error', 'Fotoğraf işlenirken hata oluştu:') + ' ' + err.message, type: 'error' } }));
      }
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
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('materials.lan_error', 'Yerel sunucu başlatılamadı:') + ' ' + res.message, type: 'error' } }));
      }
    }
  };

  const handleCloseQRModal = () => {
    setQrModal({ isOpen: false, qrCode: '', url: '' });
    if (window.api && window.api.system.stopLANServer) {
      window.api.system.stopLANServer();
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

    if (window.api && window.api.db) {
      const payload = {
        project_id: activeProjectId,
        supplier: formData.supplier,
        material_type: formData.material_type,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        receipt_number: formData.receipt_number,
        receipt_date: formData.receipt_date,
        photo_path: formData.photo_path,
        notes: formData.notes
      };

      if (editingId) {
        await window.api.db.update('materials', editingId, payload);
        setEditingId(null);
      } else {
        await window.api.db.create('materials', payload);
      }

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
      await window.api.db.delete('materials', confirmModal.id);
      setConfirmModal({ isOpen: false, id: null });
      fetchRecords();
    }
  };

  const handleViewPhoto = async (relativePath) => {
    const res = await window.api.media.readPhoto({ relativePath });
    if (res.success) {
      setLightboxImage(res.base64);
    }
  };

  // Filter and Paginated records
  const filteredRecords = records.filter(r => {
    const q = trLower(searchQuery);
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

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const paginatedRecords = filteredRecords.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  void showToast;

  if (!activeProjectId) {
    return (
      <div className="glass-card text-center" style={{ padding: '3rem' }}>
        <h2>📄 {t('nav.materials', 'İrsaliye & Malzeme Takibi')}</h2>
        <p className="text-muted" style={{ marginTop: '1rem' }}>{t('common.select_project_msg', 'Lütfen sol menüden veya Şantiye Yönetimi sayfasından aktif bir şantiye seçin.')}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      {/* Main List and Form */}
      <div className="glass-card" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
          <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: 0 }}>{t('materials.title', '🚚 İrsaliye ve Malzeme Girişi')}</h2>
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

        <MaterialForm
          t={t}
          formData={formData}
          setFormData={setFormData}
          photoPreview={photoPreview}
          setPhotoPreview={setPhotoPreview}
          setLightboxImage={setLightboxImage}
          editingId={editingId}
          setEditingId={setEditingId}
          onSubmit={handleSubmit}
          onSelectLocalPhoto={handleSelectLocalPhoto}
          onLocalFileChange={handleLocalFileChange}
          onOpenQr={handleOpenQRModal}
        />

        <MaterialFilters
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
          filterPhoto={filterPhoto}
          setFilterPhoto={setFilterPhoto}
        />

        <MaterialTable
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
          onViewPhoto={handleViewPhoto}
        />
      </div>

      {/* QR Code Pop-up Modal (Centered, Glassmorphism Backdrop Blur) */}
      {qrModal.isOpen && (
        <div
          className="drawer-overlay"
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backdropFilter: 'blur(16px)',
            backgroundColor: 'rgba(15, 23, 42, 0.75)'
          }}
          onClick={handleCloseQRModal}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '400px',
              width: '90%',
              padding: '2.5rem 2rem',
              textAlign: 'center',
              background: 'var(--spotlight-bg)',
              border: '1px solid var(--glass-border)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              borderRadius: '20px'
            }}
            onClick={e => e.stopPropagation()}
          >
            <h3 className="card-title" style={{ fontSize: '1.4rem', marginBottom: '0.5rem', color: 'var(--accent)' }}>📲 {t('materials.upload_mobile_title', 'Mobil Fotoğraf Yükle')}</h3>
            <p className="card-subtitle" style={{ marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              {renderDescription(t('materials.upload_mobile_desc', 'Telefonunuzu ve bilgisayarınızı **aynı WiFi ağına** bağlayın, ardından QR kodu kameranızla taratın:'))}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.25rem' }}>
              <div style={{ background: '#fff', padding: '1rem', borderRadius: '16px', boxShadow: '0 10px 20px rgba(0,0,0,0.2)', width: '212px', height: '212px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={qrModal.qrCode} alt="LAN QR Code" style={{ width: '180px', height: '180px', display: 'block', objectFit: 'contain' }} />
              </div>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', wordBreak: 'break-all', padding: '0.5rem', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
              {t('materials.qr_link', 'Bağlantı:')} <code style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{qrModal.url}</code>
            </div>
            <button className="btn btn-danger" onClick={handleCloseQRModal} style={{ width: '100%', marginTop: '1.5rem', height: '42px', fontWeight: 'bold' }}>{t('common.cancel', 'İptal Et')}</button>
          </div>
        </div>
      )}

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
