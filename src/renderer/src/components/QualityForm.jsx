import React from 'react';
import CustomDatePicker from './ui/CustomDatePicker';
import { X } from 'lucide-react';

const QualityForm = ({ t, formData, setFormData, photoPreview, setPhotoPreview, setLightboxImage, editingId, setEditingId, todayStr, onSubmit, onSelectLocalPhoto, onLocalFileChange, onOpenQr }) => {
  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '0.75rem', alignItems: 'flex-end' }}>
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
          <button type="button" className="btn" onClick={onSelectLocalPhoto} style={{ flex: 1, fontSize: '0.85rem' }}>
            {t('quality.select_pc', ' PC\'den Seç')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onOpenQr} style={{ flex: 1, fontSize: '0.85rem' }}>
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
              <img src={photoPreview} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>
        <input
          type="file"
          id="local-quality-photo-input"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onLocalFileChange}
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

      <div style={{ display: 'flex', gap: '0.5rem', width: '100%', gridColumn: 'span 2' }}>
        <button type="submit" className="btn btn-primary" style={{ flex: 1, height: '42px' }}>
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
            style={{ height: '42px' }}
          >
            {t('common.cancel', 'Vazgeç')}
          </button>
        )}
      </div>
    </form>
  );
};

export default QualityForm;
