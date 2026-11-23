import React, { useState, useEffect } from 'react';
import CustomDatePicker from './ui/CustomDatePicker';

const JournalForm = ({ t, i18n, activeProject, activeProjectId, formData, setFormData, editingId, setEditingId, todayStr, onSubmit, weatherLoading, setWeatherLoading, weatherError, setWeatherError }) => {
  // Fetch weather automatically when location or date changes + auto worker count
  useEffect(() => {
    const fetchWeather = async () => {
      if (!activeProject || !activeProject.location) return;
      setWeatherLoading(true);
      if (window.api && window.api.system.getWeather) {
        const res = await window.api.system.getWeather({ location: activeProject.location, lang: i18n.language, date: formData.journal_date });
        if (res.success) {
          setFormData(prev => ({
            ...prev,
            weather_temp: res.temp.toString(),
            weather_desc: res.desc,
            weather_icon: res.icon
          }));
          setWeatherError('');
        } else {
          let errorMessage = res.message;
          if (res.errorType === 'not_found') {
            errorMessage = t('journal.weather_not_found', 'Belirtilen konum bulunamadı: "{{location}}". Lütfen il/ilçe adını kontrol edin.', { location: activeProject.location });
          } else if (res.errorType === 'unauthorized') {
            errorMessage = t('journal.weather_unauthorized', 'Hava durumu API anahtarı geçersiz veya süresi dolmuş. Lütfen Ayarlar sayfasından güncelleyin.');
          } else if (res.errorType === 'offline') {
            errorMessage = t('journal.weather_offline', 'İnternet bağlantısı yok veya hava durumu servisine ulaşılamıyor.');
          } else if (res.errorType === 'api_error') {
            errorMessage = t('journal.weather_api_error', 'Hava durumu servisi hata döndürdü.');
          }

          setWeatherError(errorMessage || t('journal.weather_error', 'İnternet bağlantısı yok veya hava durumu servisine ulaşılamıyor.'));
          setFormData(prev => ({
            ...prev,
            weather_temp: '',
            weather_desc: '',
            weather_icon: ''
          }));
        }
      }

      // Calculate worker count automatically from timesheets for this date
      if (window.api && window.api.db) {
        const tsData = await window.api.db.read('timesheets', { work_date: formData.journal_date });
        // Filter by workers on active project
        const workers = await window.api.db.read('workers', { project_id: activeProjectId });
        const workerIds = workers.map(w => w.id);
        const count = tsData.filter(ts => workerIds.includes(ts.worker_id)).length;
        setFormData(prev => ({ ...prev, worker_count: count.toString() }));
      }

      setWeatherLoading(false);
    };

    fetchWeather();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, formData.journal_date]);

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 2, minWidth: '200px', marginBottom: 0 }}>
          <label className="form-label">{t('common.date', 'Tarih')}</label>
          <CustomDatePicker
            className="form-input"
            value={formData.journal_date}
            onChange={e => setFormData(prev => ({ ...prev, journal_date: e.target.value }))}
            required
          />
        </div>

        <div className="form-group" style={{ width: '180px', marginBottom: 0 }}>
          <label className="form-label">{t('journal.worker_count', 'Çalışan Personel Sayısı')}</label>
          <input
            type="number"
            className="form-input"
            min="0"
            value={formData.worker_count}
            onChange={e => setFormData(prev => ({ ...prev, worker_count: e.target.value }))}
            required
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: 0 }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '0.75rem 1.25rem', whiteSpace: 'nowrap' }}>
            {editingId ? t('common.save', 'Güncelle') : t('journal.save_btn', 'Jurnali Kaydet / Güncelle')}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn"
              onClick={() => {
                setEditingId(null);
                setFormData({
                  journal_date: todayStr,
                  weather_temp: '',
                  weather_desc: '',
                  weather_icon: '',
                  worker_count: '0',
                  notes: ''
                });
              }}
              style={{ padding: '0.75rem 1.25rem' }}
            >
              {t('common.cancel', 'Vazgeç')}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
        <div style={{ flex: 1 }}>
          <span className="form-label" style={{ marginBottom: '0.25rem' }}>{t('journal.weather', 'Hava Durumu')}</span>
          {weatherLoading ? (
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('journal.weather_loading', 'Bulutlardan okunuyor...')}</span>
          ) : weatherError ? (
            <span style={{ fontSize: '0.9rem', color: 'var(--danger-text)', fontWeight: 'bold' }}> {weatherError}</span>
          ) : formData.weather_desc ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {formData.weather_icon && <img src={`http://openweathermap.org/img/wn/${formData.weather_icon}.png`} alt="Weather Icon" style={{ width: '30px', height: '30px' }} />}
              <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{formData.weather_temp} °C, {formData.weather_desc.toUpperCase()}</strong>
            </div>
          ) : (
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('journal.weather_no_location', 'Şantiye konumu girilmediği için çekilemedi.')}</span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: '110px', marginBottom: 0 }}>
            <label className="form-label" style={{ whiteSpace: 'nowrap' }}>{t('journal.temperature', 'Sıcaklık')} (°C)</label>
            <input
              type="number"
              className="form-input"
              value={formData.weather_temp}
              onChange={e => setFormData(prev => ({ ...prev, weather_temp: e.target.value }))}
            />
          </div>
          <div className="form-group" style={{ width: '180px', marginBottom: 0 }}>
            <label className="form-label">{t('journal.weatherDesc', 'Hava Durumu Açıklaması')}</label>
            <input
              type="text"
              className="form-input"
              value={formData.weather_desc}
              onChange={e => setFormData(prev => ({ ...prev, weather_desc: e.target.value }))}
            />
          </div>
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">{t('journal.notes', 'Günlük Jurnal Notları / Yapılan İşler')}</label>
        <textarea
          className="form-input"
          placeholder={t('journal.notes_ph', 'Örn: 2. kat kolon demirleri bağlandı, C30 beton dökümü gerçekleştirildi...')}
          rows="2"
          value={formData.notes}
          onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
          required
        ></textarea>
      </div>

      {/* Buttons removed from bottom as they are now in the top row */}
    </form>
  );
};

export default JournalForm;
