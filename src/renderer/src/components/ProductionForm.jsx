import React from 'react';
import CustomDatePicker from './ui/CustomDatePicker';

const ProductionForm = ({ t, formData, setFormData, editingId, setEditingId, onSubmit }) => {
  return (
    <form onSubmit={onSubmit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginBottom: '0.5rem', alignItems: 'flex-end' }}>
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
          <option value="m²">m² (Metrekare)</option>
          <option value="m³">m³ (Metreküp)</option>
          <option value="mt">mt (Metretül)</option>
          <option value="ton">ton</option>
          <option value="kg">kg</option>
          <option value="adet">adet</option>
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
                record_date: new Date().toISOString().split('T')[0],
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
  );
};

export default ProductionForm;
