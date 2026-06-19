import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import CustomDatePicker from './ui/CustomDatePicker';
import GuideDrawer from './ui/GuideDrawer';
import { formatDate, trLower } from '../utils/formatUtils';

const DailyJournal = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const containerRef = useRef(null);
  const getLocalDateString = () => {
    const d = new Date();
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().split('T')[0];
  };

  const todayStr = getLocalDateString();

  const [formData, setFormData] = useState({
    journal_date: todayStr,
    weather_temp: '',
    weather_desc: '',
    weather_icon: '',
    worker_count: '0',
    notes: ''
  });
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, id: null });

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('date_desc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 3;
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleFilterStartDateChange = (val) => {
    setStartDate(val);
    if (val && endDate && new Date(val) > new Date(endDate)) {
      setEndDate(val);
    }
  };

  const handleFilterEndDateChange = (val) => {
    setEndDate(val);
    if (val && startDate && new Date(startDate) > new Date(val)) {
      setStartDate(val);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, startDate, endDate]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  const activeProject = projects.find(p => p.id === activeProjectId);

  const handleStartEdit = (j) => {
    setEditingId(j.id);
    setFormData({
      journal_date: j.journal_date,
      weather_temp: j.weather_temp !== null && j.weather_temp !== undefined ? j.weather_temp.toString() : '',
      weather_desc: j.weather_desc || '',
      weather_icon: j.weather_icon || '',
      worker_count: j.worker_count !== null && j.worker_count !== undefined ? j.worker_count.toString() : '0',
      notes: j.notes || ''
    });
  };

  const fetchJournals = async () => {
    if (!activeProjectId) return;
    if (window.api && window.api.db) {
      setLoading(true);
      const data = await window.api.db.read('daily_journals', { project_id: activeProjectId });
      setJournals(data);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, [activeProjectId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Fetch weather automatically when location or date changes
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
  }, [activeProjectId, formData.journal_date]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!activeProjectId || !formData.journal_date) return;

    if (window.api && window.api.db) {
      const payload = {
        weather_temp: formData.weather_temp ? Number(formData.weather_temp) : null,
        weather_desc: formData.weather_desc,
        weather_icon: formData.weather_icon,
        worker_count: formData.worker_count ? Number(formData.worker_count) : 0,
        notes: formData.notes
      };

      if (editingId) {
        await window.api.db.update('daily_journals', editingId, payload);
        setEditingId(null);
      } else {
        // Check if journal already exists for this date on this project
        const existing = journals.find(j => j.journal_date === formData.journal_date);
        if (existing) {
          // Update it
          await window.api.db.update('daily_journals', existing.id, payload);
        } else {
          // Create new
          await window.api.db.create('daily_journals', {
            project_id: activeProjectId,
            journal_date: formData.journal_date,
            ...payload
          });
        }
      }
      setFormData(prev => ({
        ...prev,
        notes: ''
      }));
      fetchJournals();
    }
  };

  const handleDelete = (id) => {
    setConfirmModal({ isOpen: true, id });
  };

  const confirmDelete = async () => {
    if (window.api && window.api.db && confirmModal.id) {
      await window.api.db.delete('daily_journals', confirmModal.id);
      setConfirmModal({ isOpen: false, id: null });
      fetchJournals();
    }
  };

  // Filter and paginated journals
  const filteredJournals = journals.filter(j => {
    const q = trLower(searchQuery);
    if (searchQuery && 
        !trLower(j.notes).includes(q) && 
        !(j.weather_desc && trLower(j.weather_desc).includes(q)) &&
        !trLower(formatDate(j.journal_date, i18n.language)).includes(q)) {
      return false;
    }
    if (startDate && j.journal_date < startDate) return false;
    if (endDate && j.journal_date > endDate) return false;
    return true;
  });

  // Apply sorting
  filteredJournals.sort((a, b) => {
    if (sortBy === 'date_desc') {
      return b.journal_date.localeCompare(a.journal_date);
    } else if (sortBy === 'date_asc') {
      return a.journal_date.localeCompare(b.journal_date);
    } else if (sortBy === 'workers_desc') {
      const wa = a.worker_count ? parseInt(a.worker_count, 10) : 0;
      const wb = b.worker_count ? parseInt(b.worker_count, 10) : 0;
      return wb - wa;
    } else if (sortBy === 'workers_asc') {
      const wa = a.worker_count ? parseInt(a.worker_count, 10) : 0;
      const wb = b.worker_count ? parseInt(b.worker_count, 10) : 0;
      return wa - wb;
    }
    return 0;
  });

  const totalPages = Math.ceil(filteredJournals.length / itemsPerPage);
  const paginatedJournals = filteredJournals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!activeProjectId) {
    return (
      <div className="glass-card text-center" style={{ padding: '3rem' }}>
        <h2>{t('nav.journal', 'Günlük Jurnal Takibi')}</h2>
        <p className="text-muted" style={{ marginTop: '1rem' }}>{t('common.select_project_msg', 'Lütfen sol menüden veya Şantiye Yönetimi sayfasından aktif bir şantiye seçin.')}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', alignItems: 'start', position: 'relative' }}>
      {/* Main List and Form */}
      <div className="glass-card" style={{ padding: '1.25rem', gap: '0.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div>
            <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>{t('journal.title', '📓 Şantiye Günlük Jurnali')}</h2>
            <p className="card-subtitle active-project-subtitle" style={{ marginBottom: 0 }}>{t('common.active_project', 'Aktif Şantiye:')} <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{activeProject?.name}</span></p>
          </div>
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

        {/* Add/Edit Journal Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '0.5rem' }}>
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
                <span style={{ fontSize: '0.9rem', color: 'var(--danger-text)', fontWeight: 'bold' }}>⚠️ {weatherError}</span>
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

        {/* Filters & Search Bar */}
        {journals.length > 0 && (
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
                  placeholder={t('filters.search_journal', 'Jurnal notlarında, hava durumunda veya tarihte ara...')}
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
                    ✕
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.start_date', 'Başlangıç Tarihi')}</label>
              <CustomDatePicker 
                className="form-input" 
                value={startDate} 
                onChange={e => handleFilterStartDateChange(e.target.value)} 
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.end_date', 'Bitiş Tarihi')}</label>
              <CustomDatePicker 
                className="form-input" 
                value={endDate} 
                onChange={e => handleFilterEndDateChange(e.target.value)} 
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 150px' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.sort', 'Sıralama')}</label>
              <select 
                className="form-input" 
                value={sortBy} 
                onChange={e => setSortBy(e.target.value)}
                style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
              >
                <option value="date_desc">{t('filters.newest', 'Tarih: Yeniden Eskiye')}</option>
                <option value="date_asc">{t('filters.oldest', 'Tarih: Eskiden Yeniye')}</option>
                <option value="workers_desc">{t('filters.workers_desc', 'İşçi Sayısı: Çoktan Aza')}</option>
                <option value="workers_asc">{t('filters.workers_asc', 'İşçi Sayısı: Azdan Çoğa')}</option>
              </select>
            </div>
          </div>
        )}

        {/* Journals List */}
        {loading ? (
          <div className="skeleton" style={{ height: '200px', width: '100%' }}></div>
        ) : filteredJournals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            {searchQuery ? t('journal.no_results', 'Arama kriterlerine uygun jurnal kaydı bulunamadı.') : t('empty.journal', 'Henüz günlük jurnal kaydı bulunmuyor.')}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.1rem' }}>
            {paginatedJournals.map(j => (
              <div key={j.id} className="glass-card" style={{ padding: '1rem 1.25rem', gap: '0.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <strong style={{ fontSize: '1.05rem', color: 'var(--primary)' }}>{formatDate(j.journal_date, i18n.language)}</strong>
                    {j.weather_desc && (
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        {j.weather_icon && <img src={`http://openweathermap.org/img/wn/${j.weather_icon}.png`} alt="Icon" style={{ width: '20px', height: '20px' }} />}
                        {j.weather_temp} °C, {j.weather_desc}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', background: 'var(--accent-bg)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px', marginRight: '0.5rem', fontWeight: '500' }}>
                      👷 {j.worker_count} {t('journal.worker_count_badge', 'Çalışan')}
                    </span>
                    {j.journal_date === todayStr && (
                      <button 
                        className="btn" 
                        onClick={() => handleStartEdit(j)}
                        style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255, 255, 255, 0.05)' }}
                        title={t('dashboard.edit', 'Düzenle')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    )}
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handleDelete(j.id)}
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
                </div>
                <p style={{ fontSize: '0.95rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', color: 'var(--text-main)' }}>{j.notes}</p>
              </div>
            ))}

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{
                position: 'sticky',
                bottom: 0,
                background: 'var(--option-bg, #0f172a)',
                borderTop: '1px solid var(--glass-border)',
                zIndex: 10,
                padding: '1rem',
                marginTop: '1rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backdropFilter: 'blur(10px)',
                borderRadius: '0 0 12px 12px'
              }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
                  {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages} {t('global.recordsCount', { count: filteredJournals.length })}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <button 
                    className="btn" 
                    disabled={currentPage === 1} 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{ 
                      padding: '0.4rem 1rem', 
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      opacity: currentPage === 1 ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { if (currentPage !== 1) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={(e) => { if (currentPage !== 1) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  >
                    {t('common.prev', 'Önceki')}
                  </button>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages}
                  </span>
                  <button 
                    className="btn" 
                    disabled={currentPage === totalPages} 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    style={{ 
                      padding: '0.4rem 1rem', 
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: '8px',
                      color: 'var(--text-main)',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      opacity: currentPage === totalPages ? 0.5 : 1,
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
                    onMouseLeave={(e) => { if (currentPage !== totalPages) e.currentTarget.style.background = 'rgba(255,255,255,0.03)' }}
                  >
                    {t('common.next', 'Sonraki')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>


      <GuideDrawer 
        isOpen={helpOpen} 
        onClose={() => setHelpOpen(false)} 
        title={t('guides.journal.title')} 
        desc="" 
        h1={t('guides.journal.q1.title')} 
        p1={t('guides.journal.q1.desc')} 
        h2={t('guides.journal.q2.title')} 
        p2={t('guides.journal.q2.desc')} 
        h3={t('guides.journal.q3.title')} 
        p3={t('guides.journal.q3.desc')} 
        h4={t('guides.journal.q4.title')} 
        p4={t('guides.journal.q4.desc')} 
        h5={t('guides.journal.q5.title')} 
        p5={t('guides.journal.q5.desc')} 
        h6={t('guides.journal.q6.title')} 
        p6={t('guides.journal.q6.desc')} 
      />

      <ConfirmationModal 
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, id: null })}
        onConfirm={confirmDelete}
        title={t('journal.delete_title', 'Jurnali Sil')}
        message={t('journal.delete_confirm', 'Bu günlük jurnal kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')}
      />
    </div>
  );
};

export default DailyJournal;
