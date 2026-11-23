import { useState, useEffect, useRef, useMemo } from 'react';
import { logError } from '../utils/logger';
import { apiMessage } from '../utils/apiWrite';
import { useTranslation } from 'react-i18next';
import { exportToExcel, exportToCSV, exportToJSON, exportToText, exportToMarkdown } from '../utils/exportUtils';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatDate, formatTime } from '../utils/formatUtils';
import GuideDrawer from './ui/GuideDrawer';
import { Lightbulb, X } from 'lucide-react';
import { reorderRangeForStart, reorderRangeForEnd } from '../utils/dateRangeUtils';
import Pagination from './ui/Pagination';

const SystemLogs = () => {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [filterText, setFilterText] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedTable, setSelectedTable] = useState('');
  
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const containerRef = useRef(null);
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const handleStartDateChange = (val) => {
    const [start, end] = reorderRangeForStart(val, endDate);
    setStartDate(start);
    setEndDate(end);
  };

  const handleEndDateChange = (val) => {
    const [start, end] = reorderRangeForEnd(val, startDate);
    setStartDate(start);
    setEndDate(end);
  };

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  useEffect(() => {
    // `active` guards the late reply: the IPC round-trip can outlive the
    // component (the user switches screen while projects are loading), and
    // calling setProjects afterwards updates an unmounted component.
    let active = true;
    const fetchProjects = async () => {
      if (window.api && window.api.db) {
        const projs = await window.api.db.read('projects');
        if (!active) return;
        setProjects(projs || []);
      }
    };
    fetchProjects();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [filterText, startDate, endDate, selectedType, selectedProjectId, selectedTable]);

  // Guards against stale log responses overwriting newer ones after a date change.
  const requestIdRef = useRef(0);

  const fetchLogs = async () => {
    if (window.api) {
      const requestId = ++requestIdRef.current;
      setLoading(true);
      try {
        const res = await window.api.system.readLogs(startDate, endDate);
        if (requestId !== requestIdRef.current) return;
        if (res.success) {
          setLogs(res.logs);
        } else {
          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings_logs.error_read', 'Loglar okunamadı:') + ' ' + apiMessage(res), type: 'error' } }));
        }
      } catch (error) {
        logError(error);
      }
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [startDate, endDate]);

  const selectedProject = projects.find(p => String(p.id) === String(selectedProjectId));
  const selectedProjectName = selectedProject ? selectedProject.name : '';

  // Filtered log list, latest first.
  // Memoized: the filter chain previously re-ran on every render (each page
  // change, export menu toggle...) and `.reverse()` mutated the result in place.
  const filteredLogs = useMemo(() => {
    const needle = filterText ? filterText.toLowerCase() : '';
    const projectMarkers = selectedProjectId && selectedProjectName
      ? [`[Şantiye: ${selectedProjectName}]`, `[Project: ${selectedProjectName}]`]
      : null;

    const rows = logs.filter(log => {
      if (needle && !log.toLowerCase().includes(needle)) {
        return false;
      }
      if (selectedType) {
        if (selectedType === 'error' && !log.includes('[error]')) return false;
        if (selectedType === 'info' && !log.includes('[info]')) return false;
        if (selectedType === 'db_create' && !log.includes('[DB CREATE')) return false;
        if (selectedType === 'db_update' && !log.includes('[DB UPDATE]')) return false;
        if (selectedType === 'db_delete' && !log.includes('[DB DELETE]')) return false;
      }
      if (selectedTable) {
        if (!log.includes(`[${selectedTable}]`)) return false;
      }
      if (projectMarkers) {
        if (!projectMarkers.some(marker => log.includes(marker))) return false;
      }
      return true;
    });

    return rows.reverse(); // Show latest first
  }, [logs, filterText, selectedType, selectedTable, selectedProjectId, selectedProjectName]);

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

  const handleOpenLogsFolder = () => {
    if (window.api && window.api.system && window.api.system.openLogsFolder) {
      Promise.resolve(window.api.system.openLogsFolder()).catch(logError);
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
      <div className="card-toolbar">
        <div className="card-toolbar-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setIsGuideOpen(true)}
            title={t('guides.logs.title', 'Sistem Kayıtları Kılavuzu (5N1K)')}
          >
            <Lightbulb size={14} aria-hidden="true" />
            {t('common.page_guide', 'Page guide')}
          </button>
          <button
            type="button"
            className="btn"
            onClick={handleOpenLogsFolder}
          >
            {t('logs.open_folder', 'Geçmiş Log Klasörünü Aç')}
          </button>

          <select className="form-input" style={{ width: 'auto' }} onChange={e => {
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
              ><X size={14} aria-hidden="true" />
                
              </button>
            )}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('logs.filter_table', 'Modül / Tablo')}</label>
          <select
            className="form-input"
            value={selectedTable}
            onChange={e => setSelectedTable(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="">{t('logs.table_all', 'Tüm Modüller')}</option>
            <option value="app_settings">{t('logs.table_app_settings', 'Uygulama Ayarları')}</option>
            <option value="workers">{t('logs.table_workers', 'Personel')}</option>
            <option value="worker_groups">{t('logs.table_worker_groups', 'Personel Grupları')}</option>
            <option value="timesheets">{t('logs.table_timesheets', 'Puantaj')}</option>
            <option value="transactions">{t('logs.table_transactions', 'Avans / İşlem')}</option>
            <option value="cash_register">{t('logs.table_cash_register', 'Kasa')}</option>
            <option value="projects">{t('logs.table_projects', 'Şantiye')}</option>
            <option value="production_records">{t('logs.table_production_records', 'İmalat / Metraj')}</option>
            <option value="materials">{t('logs.table_materials', 'Malzeme / İrsaliye')}</option>
            <option value="daily_journals">{t('logs.table_daily_journals', 'Jurnal')}</option>
            <option value="quality_reports">{t('logs.table_quality_reports', 'Tutanaklar')}</option>
            <option value="subcontractor_ledgers">{t('logs.table_subcontractor_ledgers', 'Taşeron Cari')}</option>
            <option value="subcontractor_transactions">{t('logs.table_subcontractor_transactions', 'Taşeron İşlemleri')}</option>
            <option value="worker_leaves">{t('logs.table_worker_leaves', 'Personel İzni')}</option>
          </select>
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
            <option value="info">{t('logs.type_info', 'Bilgi')}</option>
            <option value="error">{t('logs.type_error', 'Hata')}</option>
            <option value="db_create">{t('logs.type_db_create', 'Kayıt Oluşturma')}</option>
            <option value="db_update">{t('logs.type_db_update', 'Kayıt Güncelleme')}</option>
            <option value="db_delete">{t('logs.type_db_delete', 'Kayıt Silme')}</option>
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
                {proj.name}
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

      {/* Pagination - shared component (ui/Pagination) */}
      <Pagination variant="sticky" currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} totalRecords={filteredLogs.length} />
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
