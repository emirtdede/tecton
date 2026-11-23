import React, { useState, useEffect } from 'react';
import TagInput from './ui/TagInput';
import CustomDatePicker from './ui/CustomDatePicker';
import { getCurrencySymbol } from '../utils/formatUtils';
import { X } from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  service_type: '',
  phone: '',
  daily_wage: '',
  status: 'active',
  isg_start_date: '',
  isg_expiry_date: ''
};

const SubcontractorFormDrawer = ({ t, i18n, activeProjectId, contractor, open, onClose, onSaved }) => {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [tags, setTags] = useState([]);
  const editingId = contractor ? contractor.id : null;

  useEffect(() => {
    if (contractor) {
      setFormData({
        name: contractor.name,
        service_type: contractor.service_type,
        phone: contractor.phone || '',
        daily_wage: contractor.daily_wage.toString(),
        status: contractor.status || 'active',
        isg_start_date: contractor.isg_start_date || '',
        isg_expiry_date: contractor.isg_expiry_date || ''
      });
      try {
        if (contractor.tags) {
          const parsed = typeof contractor.tags === 'string' ? JSON.parse(contractor.tags) : contractor.tags;
          setTags(Array.isArray(parsed) ? parsed : []);
        } else {
          setTags([]);
        }
      } catch (e) {
        setTags([]);
      }
    } else {
      setFormData(EMPTY_FORM);
      setTags([]);
    }
  }, [contractor, open]);

  if (!open) return null;

  const handleClose = () => {
    setFormData(EMPTY_FORM);
    setTags([]);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeProjectId || !formData.name || !formData.service_type || !formData.daily_wage) return;

    if (window.api && window.api.db) {
      const payload = {
        project_id: activeProjectId,
        name: formData.name,
        service_type: formData.service_type,
        phone: formData.phone,
        daily_wage: Number(formData.daily_wage),
        status: formData.status,
        isg_start_date: formData.isg_start_date || null,
        isg_expiry_date: formData.isg_expiry_date || null,
        tags: JSON.stringify(tags)
      };

      if (editingId) {
        await window.api.db.update('subcontractor_ledgers', editingId, payload);
      } else {
        await window.api.db.create('subcontractor_ledgers', payload);
      }

      handleClose();
      onSaved();
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: editingId ? t('subcontractor.update_success', 'Taşeron başarıyla güncellendi.') : t('subcontractor.add_success', 'Taşeron başarıyla eklendi.'),
          type: 'success'
        }
      }));
    }
  };

  return (
    <div className="drawer-overlay" onClick={handleClose}>
      <div className="drawer-content" style={{ display: 'flex', flexDirection: 'column', padding: '2rem' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
          <h2 className="drawer-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>
            {editingId ? t('subcontractor.edit_title', 'Taşeronu Düzenle') : t('subcontractor.new_title', 'Yeni Taşeron Ekle')}
          </h2>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleClose}
            style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: 'none' }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('subcontractor.name', 'Taşeron Adı / Ünvanı')}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t('subcontractor.name_ph', 'Örn: Öz Karadeniz Hafriyat')}
              value={formData.name}
              onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('subcontractor.service', 'Hizmet Alanı')}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t('subcontractor.service_ph', 'Örn: Kepçe Kiralama / Hafriyat')}
              value={formData.service_type}
              onChange={e => setFormData(prev => ({ ...prev, service_type: e.target.value }))}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('common.phone', 'Telefon')}</label>
            <input
              type="text"
              className="form-input"
              placeholder={t('worker_modal.phone_ph', '05XX XXX XX XX')}
              value={formData.phone}
              onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">
              {t('subcontractor.wage', 'Yevmiye / Günlük Bedel (₺)').includes('(₺)')
                ? t('subcontractor.wage', 'Yevmiye / Günlük Bedel (₺)').replace('(₺)', `(${getCurrencySymbol(i18n.language)})`)
                : `${t('subcontractor.wage', 'Yevmiye / Günlük Bedel (₺)')} (${getCurrencySymbol(i18n.language)})`}
            </label>
            <input
              type="number"
              className="form-input"
              placeholder="0.00"
              min="0"
              value={formData.daily_wage}
              onChange={e => setFormData(prev => ({ ...prev, daily_wage: e.target.value }))}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_modal.status', 'Durum')}</label>
            <select
              className="form-input"
              value={formData.status}
              onChange={e => setFormData(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="active">{t('filters.active', 'Aktif')}</option>
              <option value="passive">{t('filters.passive', 'Pasif')}</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_modal.tags', 'Etiketler')}</label>
            <TagInput tags={tags} setTags={setTags} placeholder={t('worker_modal.tags_ph', 'Etiket ekleyin...')} />
          </div>

          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginTop: '0.25rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               {t('isg.section_title', 'İSG (İş Sağlığı ve Güvenliği)')}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label">{t('isg.start_date', 'İSG Başlangıç Tarihi')}</label>
                <CustomDatePicker
                  className="form-input"
                  value={formData.isg_start_date}
                  onChange={e => setFormData(prev => {
                    const val = e.target.value;
                    if (val && prev.isg_expiry_date && new Date(val) > new Date(prev.isg_expiry_date)) {
                      return { ...prev, isg_start_date: prev.isg_expiry_date, isg_expiry_date: val };
                    }
                    return { ...prev, isg_start_date: val };
                  })}
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label">{t('isg.expiry_date', 'İSG Bitiş Tarihi')}</label>
                <CustomDatePicker
                  className="form-input"
                  value={formData.isg_expiry_date}
                  onChange={e => setFormData(prev => {
                    const val = e.target.value;
                    if (val && prev.isg_start_date && new Date(prev.isg_start_date) > new Date(val)) {
                      return { ...prev, isg_expiry_date: prev.isg_start_date, isg_start_date: val };
                    }
                    return { ...prev, isg_expiry_date: val };
                  })}
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
            <button type="button" className="btn" onClick={handleClose} style={{ flex: 1, fontWeight: 'bold' }}>{t('worker_modal.cancel', 'İptal')}</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 'bold' }}>{t('worker_modal.save', 'Kaydet')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SubcontractorFormDrawer;
