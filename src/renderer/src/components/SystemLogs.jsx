import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { exportToExcel, exportToCSV, exportToJSON, exportToText, exportToMarkdown } from '../utils/exportUtils';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatDate, formatTime } from '../utils/formatUtils';
import GuideDrawer from './ui/GuideDrawer';

const SystemLogs = () => {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterText, setFilterText] = useState('');
  const [selectedType, setSelectedType] = useState('');
  
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const containerRef = useRef(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const handleStartDateChange = (val) => {
    if (val && endDate && new Date(val) > new Date(endDate)) {
      setStartDate(endDate);
      setEndDate(val);
    } else {
      setStartDate(val);
    }
  };

  const handleEndDateChange = (val) => {
    if (val && startDate && new Date(startDate) > new Date(val)) {
      setEndDate(startDate);
      setStartDate(val);
    } else {
      setEndDate(val);
    }
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  useEffect(() => {
    const fetchProjects = async () => {
      if (window.api && window.api.db) {
        const projs = await window.api.db.read('projects');
        setProjects(projs || []);
      }
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterText, startDate, endDate, selectedType, selectedProjectId]);

  const fetchLogs = async () => {
    if (window.api) {
      setLoading(true);
      try {
        const res = await window.api.system.readLogs(startDate, endDate);
        if (res.success) {
          setLogs(res.logs);
        } else {
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings_logs.error_read', 'Loglar okunamadı:') + ' ' + res.message, type: 'error' } }));
        }
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [startDate, endDate]);

  const selectedProject = projects.find(p => String(p.id) === String(selectedProjectId));
  const selectedProjectName = selectedProject ? selectedProject.name : '';

  const filteredLogs = logs.filter(log => {
    if (filterText && !log.toLowerCase().includes(filterText.toLowerCase())) {
      return false;
    }
    if (selectedType) {
      if (selectedType === 'error' && !log.includes('[error]')) return false;
      if (selectedType === 'info' && !log.includes('[info]')) return false;
      if (selectedType === 'db_create' && !log.includes('[DB CREATE]')) return false;
      if (selectedType === 'db_update' && !log.includes('[DB UPDATE]')) return false;
      if (selectedType === 'db_delete' && !log.includes('[DB DELETE]')) return false;
    }
    if (selectedProjectId && selectedProjectName) {
      if (!log.includes(`[Şantiye: ${selectedProjectName}]`) && !log.includes(`[Project: ${selectedProjectName}]`)) {
        return false;
      }
    }
    return true;
  }).reverse(); // Show latest first

  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage);
  const paginatedLogs = filteredLogs.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleExport = (format) => {
    const filename = `Sistem_Loglari_${startDate || 'Tumu'}_${endDate || 'Tumu'}`;
    
    if (format === 'txt') {
      exportToText(filteredLogs, filename);
    } else if (format === 'md') {
      exportToMarkdown(filteredLogs, filename);
    } else {
      // For JSON, Excel, CSV we need array of objects
      const objects = filteredLogs.map(l => {
        // Try to parse "[2026-06-11 15:30:00.000] [info] [DB CREATE] ..."
        const match = l.match(/^\[(.*?)\] \[(.*?)\] (.*)$/);
        if (match) {
          return { Tarih: match[1], Seviye: match[2], Mesaj: match[3] };
        }
        return { Log: l };
      });

      if (format === 'excel') exportToExcel(objects, filename);
      if (format === 'csv') exportToCSV(objects, filename);
      if (format === 'json') exportToJSON(objects, filename);
    }
  };

  const formatLogLine = (line) => {
    const match = line.match(/^\[(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})(?:\.\d+)?\] (.*)$/);
    if (match) {
      const datePart = match[1];
      const timePart = match[2];
      const rest = match[3];
      
      const [year, month, day] = datePart.split('-').map(Number);
      const [hours, minutes, seconds] = timePart.split(':').map(Number);
      const d = new Date(year, month - 1, day, hours, minutes, seconds);
      
      if (!isNaN(d.getTime())) {
        const formattedDate = formatDate(d, i18n.language);
        const formattedTime = formatTime(d, i18n.language);
        return `[${formattedDate} ${formattedTime}] ${rest}`;
      }
    }
    return line;
  };

  return (
    <>
      <div className="glass-card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h3 className="card-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span>{t('logs.title')}</span>
          <span 
            onClick={() => setIsGuideOpen(true)}
            style={{ 
              cursor: 'pointer', 
              opacity: 0.4, 
              transition: 'opacity 0.25s ease-in-out', 
              fontSize: '1.4rem',
              userSelect: 'none',
              padding: '0.25rem',
              display: 'inline-flex',
              alignItems: 'center'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
            title={t('common.page_guide', 'Sayfa Kılavuzu')}
          >
            💡
          </span>
        </h3>
        
        <select className="btn btn-primary" style={{ padding: '0.5rem', background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 'bold' }} onChange={e => {
            const val = e.target.value;
            if (val) handleExport(val);
            e.target.value = "";
          }} value="">
          <option value="" disabled>{t('logs.export')}...</option>
          <option value="txt">Metin (.txt)</option>
          <option value="md">Markdown (.md)</option>
          <option value="excel">Excel (.xlsx)</option>
          <option value="csv">CSV (.csv)</option>
          <option value="json">JSON (.json)</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 2 }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('worker_profile.filter.search')}</label>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder={t('worker_profile.filter.search')} 
              value={filterText} 
              onChange={e => setFilterText(e.target.value)} 
              style={{ width: '100%', paddingRight: '2.5rem' }}
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
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
        <div style={{ flex: 1, minWidth: '150px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('logs.filter_type', 'Log Türü')}</label>
          <select
            className="form-input"
            value={selectedType}
            onChange={e => setSelectedType(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">{t('logs.type_all', 'Tüm Log Türleri')}</option>
            <option value="info">🔵 Info</option>
            <option value="error">❌ Error</option>
            <option value="db_create">➕ DB Create</option>
            <option value="db_update">🔄 DB Update</option>
            <option value="db_delete">🗑️ DB Delete</option>
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('logs.filter_project', 'Şantiye')}</label>
          <select
            className="form-input"
            value={selectedProjectId}
            onChange={e => setSelectedProjectId(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">{t('logs.project_all', 'Tüm Şantiyeler')}</option>
            {projects.map(proj => (
              <option key={proj.id} value={proj.id}>
                🏢 {proj.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('worker_profile.filter.start_date')}</label>
          <CustomDatePicker className="form-input" value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
        </div>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('worker_profile.filter.end_date')}</label>
          <CustomDatePicker className="form-input" value={endDate} onChange={e => handleEndDateChange(e.target.value)} />
        </div>
      </div>

      <div ref={containerRef} style={{ flex: 1, background: 'var(--log-bg)', borderRadius: '8px', padding: '1rem', overflowY: 'auto', border: '1px solid var(--log-border)', fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--log-text)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{t('common.loading', 'Yükleniyor...')}</div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>{t('logs.no_logs', 'Seçili aralıkta log bulunamadı.')}</div>
        ) : (
          <div key={currentPage} className="recycle-animate-page" style={{ display: 'flex', flexDirection: 'column' }}>
            {paginatedLogs.map((logLine, idx) => {
              // Simple syntax highlighting based on log level or keywords
              let color = 'var(--log-text)';
              if (logLine.includes('[error]')) color = 'var(--danger-text)';
              else if (logLine.includes('[DB CREATE]')) color = 'var(--success-text)';
              else if (logLine.includes('[DB DELETE]')) color = 'var(--danger-text)';
              else if (logLine.includes('[DB UPDATE]')) color = 'var(--accent)';

              return (
                <div key={idx} style={{ marginBottom: '4px', color, borderBottom: '1px solid var(--log-border)', paddingBottom: '4px', wordBreak: 'break-all' }}>
                  {formatLogLine(logLine)}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
          borderRadius: '0 0 8px 8px'
        }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>
            {t('common.page_info', 'Sayfa')} {currentPage} / {totalPages} {t('global.recordsCount', { count: filteredLogs.length })}
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
      {/* Guide Drawer */}
      <GuideDrawer 
        isOpen={isGuideOpen} 
        onClose={() => setIsGuideOpen(false)} 
        title={t('guides.logs.title', 'Sistem Kayıtları Kılavuzu (5N1K)')} 
        desc="" 
        h1={t('guides.logs.q1.title')} 
        p1={t('guides.logs.q1.desc')} 
        h2={t('guides.logs.q2.title')} 
        p2={t('guides.logs.q2.desc')} 
        h3={t('guides.logs.q3.title')} 
        p3={t('guides.logs.q3.desc')} 
        h4={t('guides.logs.q4.title')} 
        p4={t('guides.logs.q4.desc')} 
        h5={t('guides.logs.q5.title')} 
        p5={t('guides.logs.q5.desc')} 
        h6={t('guides.logs.q6.title')} 
        p6={t('guides.logs.q6.desc')} 
      />
    </>
  );
};

export default SystemLogs;
