import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';
import { formatDate, trLower } from '../utils/formatUtils';
import JournalForm from './JournalForm';
import JournalFilters from './JournalFilters';
import JournalList from './JournalList';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

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
        <h2>📓 {t('nav.journal', 'Günlük Jurnal Takibi')}</h2>
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

        <JournalForm
          t={t}
          i18n={i18n}
          activeProject={activeProject}
          activeProjectId={activeProjectId}
          formData={formData}
          setFormData={setFormData}
          editingId={editingId}
          setEditingId={setEditingId}
          todayStr={todayStr}
          onSubmit={handleSubmit}
          weatherLoading={weatherLoading}
          setWeatherLoading={setWeatherLoading}
          weatherError={weatherError}
          setWeatherError={setWeatherError}
        />

        <JournalFilters
          t={t}
          hasJournals={journals.length > 0}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          startDate={startDate}
          onStartDateChange={handleFilterStartDateChange}
          endDate={endDate}
          onEndDateChange={handleFilterEndDateChange}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />

        <JournalList
          t={t}
          i18n={i18n}
          loading={loading}
          filteredJournals={filteredJournals}
          paginatedJournals={paginatedJournals}
          totalPages={totalPages}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          searchQuery={searchQuery}
          todayStr={todayStr}
          onEdit={handleStartEdit}
          onDelete={handleDelete}
        />
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
