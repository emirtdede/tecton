import React from 'react';

const ProjectForm = ({ t, formData, setFormData, onSubmit }) => {
  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
      <div className="form-group" style={{ flex: 2, marginBottom: 0, minWidth: '200px' }}>
        <label className="form-label">{t('projects.name_label', 'Şantiye / Proje Adı')}</label>
        <input
          type="text"
          className="form-input"
          placeholder={t('projects.name_ph', 'Örn: Kuzey Otoyolu Viyadük İnşaatı')}
          value={formData.name}
          onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>
      <div className="form-group" style={{ flex: 1.5, marginBottom: 0, minWidth: '150px' }}>
        <label className="form-label">{t('projects.location_label', 'Lokasyon / Adres')}</label>
        <input
          type="text"
          className="form-input"
          placeholder={t('projects.location_ph', 'Örn: İstanbul / Çatalca')}
          value={formData.location}
          onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
        />
      </div>
      <button type="submit" className="btn btn-primary" style={{ height: '42px' }}>{t('projects.add_btn', 'Proje Ekle')}</button>
    </form>
  );
};

export default ProjectForm;
