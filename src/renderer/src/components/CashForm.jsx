import React from 'react';
import TagInput from './ui/TagInput';
import CustomDatePicker from './ui/CustomDatePicker';
import { getCurrencySymbol } from '../utils/formatUtils';

const CashForm = ({ t, i18n, formData, onChange, onSubmit, cashTags, setCashTags, projects, activeProjectId }) => {
  return (
    <div className="glass-card">
      <h3 className="card-title" style={{ marginBottom: '1.5rem' }}>{t('cash.new_transaction', 'Yeni Nakit İşlemi')}</h3>
      <form onSubmit={onSubmit}>
        <div className="form-group">
          <label className="form-label">{t('cash.table.date')}</label>
          <CustomDatePicker name="trans_date" className="form-input" value={formData.trans_date} onChange={onChange} required />
        </div>
        <div className="form-group">
          <label className="form-label">{t('cash.table.type')}</label>
          <select name="type" className="form-input" value={formData.type} onChange={onChange} required>
            <option value="Nakit Girişi">{t('cash.table.income')} (+)</option>
            <option value="Nakit Çıkışı">{t('cash.table.expense')} (-)</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('cash.relatedProject')}</label>
          <select name="project_id" className="form-input" value={formData.project_id} onChange={onChange}>
            <option value="">{t('cash.headquarters')}</option>
            {activeProjectId && (
              <option value={activeProjectId}>
                {t('common.active_project', 'Aktif Şantiye')}: {projects.find(p => p.id === activeProjectId)?.name}
              </option>
            )}
            {projects.filter(p => p.id !== activeProjectId).map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">{t('cash.table.amount')} ({getCurrencySymbol(i18n.language)})</label>
          <input type="number" name="amount" className="form-input" min="1" step="0.01" value={formData.amount} onChange={onChange} required />
        </div>
        <div className="form-group">
          <label className="form-label">{t('cash.table.desc')}</label>
          <input type="text" name="description" className="form-input" value={formData.description} onChange={onChange} placeholder={t('cash.desc_ph')} required />
        </div>
        <div className="form-group">
          <label className="form-label">{t('cash.tags', 'Etiketler')}</label>
          <TagInput tags={cashTags} setTags={setCashTags} placeholder={t('cash.tags_ph')} />
        </div>
        <button
          type="submit"
          className={`btn ${formData.type === 'Nakit Girişi' ? 'btn-primary' : 'btn-danger'}`}
          style={{ width: '100%' }}
        >
          {formData.type === 'Nakit Girişi' ? t('cash.add_in') : t('cash.add_out')}
        </button>
      </form>
    </div>
  );
};

export default CashForm;
