import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import NoProjectNotice from './ui/NoProjectNotice';
import CustomDatePicker from './ui/CustomDatePicker';
import GuideDrawer from './ui/GuideDrawer';
import { formatDate, trLower, localToday } from '../utils/formatUtils';
import { logError } from '../utils/logger';
import apiWrite from '../utils/apiWrite';
import PageGuideIcon from './ui/PageGuideIcon';
import Pagination from './ui/Pagination';
import { X } from 'lucide-react';

const DailyJournal = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [journals, setJournals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const containerRef = useRef(null);
  const todayStr = localToday();

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

  // Guards against stale responses overwriting newer data after a project switch.
  const requestIdRef = useRef(0);

  const fetchJournals = async () => {
    if (!activeProjectId) {
      setJournals([]);
      setLoading(false);
      return;
    }
    const requestId = ++requestIdRef.current;
    if (window.api && window.api.db) {
      setLoading(true);
      try {
        const data = await window.api.db.read('daily_journals', { project_id: activeProjectId });
        if (requestId !== requestIdRef.current) return;
        setJournals(Array.isArray(data) ? data : []);
      } catch (err) {
        // An unguarded rejection used to leave the list on a permanent spinner.
        if (requestId !== requestIdRef.current) return;
        logError('Daily journals fetch failed:', err);
        setJournals([]);
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: { message: t('journal.load_error', 'Günlük kayıtlar yüklenemedi.'), type: 'error' }
        }));
      } finally {
        if (requestId === requestIdRef.current) setLoading(false);
      }
    } else {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournals();
  }, [activeProjectId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  // Weather + worker-count fetch is async and keyed on date/project, so a fast
  // date change could let an older response overwrite the newer one.
  const weatherRequestIdRef = useRef(0);

  // Fetch weather automatically when location or date changes
  useEffect(() => {
    const fetchWeather = async () => {
      if (!activeProject || !activeProject.location) return;
      const requestId = ++weatherRequestIdRef.current;
      setWeatherLoading(true);
      try {
        if (window.api && window.api.system.getWeather) {
          const res = await window.api.system.getWeather({ location: activeProject.location, lang: i18n.language, date: formData.journal_date });
          // A newer request (date/language/project change) already took over.
          if (requestId !== weatherRequestIdRef.current) return;
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
          // The two reads are independent.
          const [tsData, workers] = await Promise.all([
            window.api.db.read('timesheets', { work_date: formData.journal_date }),
            window.api.db.read('workers', { project_id: activeProjectId })
          ]);
          if (requestId !== weatherRequestIdRef.current) return;
          const workerIds = new Set((workers || []).map(w => w.id));
          const count = (tsData || []).filter(ts => workerIds.has(ts.worker_id)).length;
          setFormData(prev => ({ ...prev, worker_count: count.toString() }));
        }
      } catch (err) {
        if (requestId === weatherRequestIdRef.current) {
          logError('Weather/worker-count fetch failed:', err);
          setWeatherError(t('journal.weather_error', 'İnternet bağlantısı yok veya hava durumu servisine ulaşılamıyor.'));
        }
      } finally {
        // Only the newest request may clear the spinner; an older rejected call
        // must not hide the loader while the current one is still running.
        if (requestId === weatherRequestIdRef.current) setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [activeProjectId, formData.journal_date, activeProject?.location, i18n.language, t]);

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

      let res;
      if (editingId) {
        res = await apiWrite(window.api.db.update('daily_journals', editingId, payload));
      } else {
        // Check if journal already exists for this date on this project
        const existing = journals.find(j => j.journal_date === formData.journal_date);
        res = existing
          ? await apiWrite(window.api.db.update('daily_journals', existing.id, payload))
          : await apiWrite(window.api.db.create('daily_journals', {
            project_id: activeProjectId,
            journal_date: formData.journal_date,
            ...payload
          }));
      }
      if (res && res.success === false) return;
      if (editingId) setEditingId(null);
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
      await apiWrite(window.api.db.delete('daily_journals', confirmModal.id));
      setConfirmModal({ isOpen: false, id: null });
      fetchJournals();
    }
  };

  // Filter and sort journals.
  // Memoized: the previous version filtered AND globally re-sorted on every
  // render (sort mutates the filtered array in place), including while typing in
  // unrelated form fields.
  const filteredJournals = useMemo(() => {
    const q = trLower(searchQuery);
    const rows = journals.filter(j => {
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

    return rows.sort((a, b) => {
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
  }, [journals, searchQuery, startDate, endDate, sortBy, i18n.language]);

  const totalPages = Math.ceil(filteredJournals.length / itemsPerPage);
  const paginatedJournals = filteredJournals.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (!activeProjectId) {
    return <NoProjectNotice titleKey="nav.journal" titleFallback="Daily journal" />;
  }

  return (
    <div ref={containerRef} style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem', alignItems: 'start', position: 'relative' }}>
      <header className="page-head">
        <div>
          <h1 className="page-head-title">{t('journal.title', 'Şantiye Günlük Jurnali')}</h1>
          <p className="card-subtitle active-project-subtitle">
            {t('common.active_project', 'Aktif Şantiye:')} <strong>{activeProject?.name}</strong>
          </p>
        </div>
        <PageGuideIcon onClick={() => setHelpOpen(true)} />
      </header>

      {/* Main List and Form */}
      <div className="glass-card" style={{ padding: '1.25rem', gap: '0.5rem' }}>
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

          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', background: 'var(--surface-subtle)', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
            <div style={{ flex: 1 }}>
              <span className="form-label" style={{ marginBottom: '0.25rem' }}>{t('journal.weather', 'Hava Durumu')}</span>
              {weatherLoading ? (
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{t('journal.weather_loading', 'Bulutlardan okunuyor...')}</span>
              ) : weatherError ? (
                <span style={{ fontSize: '0.9rem', color: 'var(--danger-text)', fontWeight: 'bold' }}> {weatherError}</span>
              ) : formData.weather_desc ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {formData.weather_icon && <img src={`https://openweathermap.org/img/wn/${formData.weather_icon}.png`} alt={t('common.weather_icon', 'Hava durumu simgesi')} style={{ width: '30px', height: '30px' }} />}
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
                  ><X size={14} aria-hidden="true" />
                    
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
                        {j.weather_icon && <img src={`https://openweathermap.org/img/wn/${j.weather_icon}.png`} alt={t('common.weather_icon', 'Hava durumu simgesi')} style={{ width: '20px', height: '20px' }} />}
                        {j.weather_temp} °C, {j.weather_desc}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.8rem', background: 'var(--accent-bg)', color: 'var(--accent)', padding: '2px 8px', borderRadius: '10px', marginRight: '0.5rem', fontWeight: '500' }}>
                       {j.worker_count} {t('journal.worker_count_badge', 'Çalışan')}
                    </span>
                    {j.journal_date === todayStr && (
                      <button 
                        className="btn" 
                        onClick={() => handleStartEdit(j)}
                        style={{ width: '28px', height: '28px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-subtle)' }}
                        title={t('dashboard.edit', 'Düzenle')}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

            {/* Pagination - shared component (ui/Pagination) */}
            <Pagination variant="sticky" currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalRecords={filteredJournals.length} />
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
