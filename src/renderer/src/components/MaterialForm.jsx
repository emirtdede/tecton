import React from 'react';
import CustomDatePicker from './ui/CustomDatePicker';
import { X } from 'lucide-react';

const MaterialForm = ({ t, formData, setFormData, photoPreview, setPhotoPreview, setLightboxImage, editingId, setEditingId, onSubmit, onSelectLocalPhoto, onLocalFileChange, onOpenQr }) => {
  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
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
          <option value="ton">ton</option>
          <option value="kg">kg</option>
          <option value="adet">adet</option>
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
          id="local-material-photo-input"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={onLocalFileChange}
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
                receipt_date: new Date().toISOString().split('T')[0],
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
  );
};

export default MaterialForm;
