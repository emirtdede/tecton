import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import GuideDrawer from './ui/GuideDrawer';
import { formatCurrency, trLower } from '../utils/formatUtils';
import BulkForm from './BulkForm';
import BulkFilters from './BulkFilters';
import BulkWorkerGrid from './BulkWorkerGrid';

const BulkTimesheet = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [workers, setWorkers] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [workerGroups, setWorkerGroups] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [existingTimesheets, setExistingTimesheets] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  // Unified form
  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    end_date: '',
    work_type_id: '',
    overtime_hours: 0,
    notes: ''
  });

  const activeProject = projects.find(p => p.id === activeProjectId);

  const fetchExistingTimesheets = async () => {
    if (!activeProjectId || !window.api || !formData.work_date) return;
    try {
      const tsData = await window.api.db.read('timesheets', { project_id: activeProjectId });

      const start = formData.work_date;
      const end = formData.end_date || formData.work_date;

      const overlapping = (tsData || []).filter(ts => ts.work_date >= start && ts.work_date <= end);
      setExistingTimesheets(overlapping);
    } catch (err) {
      console.error('Error fetching existing timesheets:', err);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!activeProjectId || !window.api) return;
      setLoading(true);
      const [workerData, workTypeData, groupData] = await Promise.all([
        window.api.db.read('workers', { project_id: activeProjectId }),
        window.api.db.read('work_types'),
        window.api.db.read('worker_groups')
      ]);
      setWorkers(workerData.filter(w => w.status !== 'passive'));
      setWorkTypes(workTypeData);
      setWorkerGroups(groupData || []);
      if (workTypeData.length > 0 && !formData.work_type_id) {
        const defaultType = workTypeData.find(wt => wt.name === 'Tam Gün') || workTypeData.find(wt => wt.multiplier === 1.0) || workTypeData[0];
        if (defaultType) {
          setFormData(prev => ({ ...prev, work_type_id: defaultType.id }));
        }
      }
      setLoading(false);
    };
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId]);

  useEffect(() => {
    fetchExistingTimesheets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId, formData.work_date, formData.end_date]);

  useEffect(() => {
    if (existingTimesheets.length > 0) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        let changed = false;
        existingTimesheets.forEach(ts => {
          if (next.has(ts.worker_id)) {
            next.delete(ts.worker_id);
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }
  }, [existingTimesheets]);

  const handleStartDateChange = (val) => {
    setFormData(prev => {
      const next = { ...prev, work_date: val };
      if (val && prev.end_date && new Date(val) > new Date(prev.end_date)) {
        next.end_date = val;
      }
      return next;
    });
  };

  const handleEndDateChange = (val) => {
    setFormData(prev => {
      const next = { ...prev, end_date: val };
      if (val && prev.work_date && new Date(prev.work_date) > new Date(val)) {
        next.work_date = val;
      }
      return next;
    });
  };

  const filteredWorkers = workers.filter(w => {
    const q = trLower(searchQuery);
    const groupObj = workerGroups.find(g => g.id === w.group_id);
    const groupName = groupObj ? trLower(groupObj.name) : '';

    const wageStr = String(w.daily_wage);
    const wageCommaStr = wageStr.replace('.', ',');
    const formattedWage = formatCurrency(w.daily_wage, i18n.language);

    const matchesSearch = !searchQuery ||
      trLower(w.full_name).includes(q) ||
      (w.tc_no && w.tc_no.includes(q)) ||
      (w.phone && w.phone.includes(q)) ||
      groupName.includes(q) ||
      wageStr.includes(q) ||
      wageCommaStr.includes(q) ||
      trLower(formattedWage).includes(q);

    const matchesGroup = !selectedGroup || String(w.group_id) === String(selectedGroup);

    const hasTimesheet = existingTimesheets.some(ts => ts.worker_id === w.id);
    let matchesStatus = true;
    if (filterStatus === 'entered') matchesStatus = hasTimesheet;
    if (filterStatus === 'not_entered') matchesStatus = !hasTimesheet;

    return matchesSearch && matchesGroup && matchesStatus;
  });

  const handleToggle = (id) => {
    const hasTimesheet = existingTimesheets.some(ts => ts.worker_id === id);
    if (hasTimesheet) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const eligibleWorkers = filteredWorkers.filter(w => !existingTimesheets.some(ts => ts.worker_id === w.id));
  const allEligibleSelected = eligibleWorkers.length > 0 && eligibleWorkers.every(w => selectedIds.has(w.id));

  const handleSelectAll = () => {
    if (allEligibleSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev);
        eligibleWorkers.forEach(w => next.delete(w.id));
        return next;
      });
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev);
        eligibleWorkers.forEach(w => next.add(w.id));
        return next;
      });
    }
  };

  if (!activeProjectId) {
    return (
      <div className="glass-card text-center" style={{ padding: '3rem' }}>
        <h2>📋 {t('bulk_timesheet.title', 'Çoklu Puantaj Girişi')}</h2>
        <p className="text-muted" style={{ marginTop: '1rem' }}>{t('common.select_project_msg', 'Lütfen sol menüden veya Şantiye Yönetimi sayfasından aktif bir şantiye seçin.')}</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'calc(100vh - 80px)', position: 'relative' }}>

      {/* Top Card: Title, Form, Filters (Fixed/Non-scrolling) */}
      <div className="glass-card" style={{ flexShrink: 0, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <h2 className="card-title" style={{ fontSize: '1.5rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              📋 {t('bulk_timesheet.title', 'Çoklu Puantaj Girişi')}
            </h2>
            <p className="card-subtitle active-project-subtitle" style={{ margin: 0 }}>
              {t('common.active_project', 'Aktif Şantiye:')} <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{activeProject?.name}</span>
            </p>
          </div>
          <span
            onClick={() => setHelpOpen(true)}
            style={{ cursor: 'pointer', opacity: 'var(--guide-icon-opacity, 0.4)', filter: 'var(--guide-icon-filter, none)', transition: 'opacity 0.25s ease-in-out', fontSize: '1.5rem', userSelect: 'none', padding: '0.25rem' }}
            onMouseEnter={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity-hover, 1)'}
            onMouseLeave={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity, 0.4)'}
            title={t('common.page_guide', 'Sayfa Kılavuzu')}
          >💡</span>
        </div>

        <BulkForm
          t={t}
          i18n={i18n}
          workers={workers}
          workerGroups={workerGroups}
          selectedIds={selectedIds}
          setSelectedIds={setSelectedIds}
          selectedGroup={selectedGroup}
          formData={formData}
          setFormData={setFormData}
          workTypes={workTypes}
          activeProjectId={activeProjectId}
          onSaved={fetchExistingTimesheets}
          onStartDateChange={handleStartDateChange}
          onEndDateChange={handleEndDateChange}
        />

        <BulkFilters
          t={t}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          selectedGroup={selectedGroup}
          setSelectedGroup={setSelectedGroup}
          workerGroups={workerGroups}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          allEligibleSelected={allEligibleSelected}
          onSelectAll={handleSelectAll}
        />

      </div>

      {/* Bottom Card: Worker List (Independent Scrolling) */}
      <BulkWorkerGrid
        t={t}
        i18n={i18n}
        loading={loading}
        filteredWorkers={filteredWorkers}
        selectedIds={selectedIds}
        existingTimesheets={existingTimesheets}
        workerGroups={workerGroups}
        searchQuery={searchQuery}
        onToggle={handleToggle}
      />

      <GuideDrawer
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        title={t('guides.bulk.title')}
        desc=""
        h1={t('guides.bulk.q1.title')}
        p1={t('guides.bulk.q1.desc')}
        h2={t('guides.bulk.q2.title')}
        p2={t('guides.bulk.q2.desc')}
        h3={t('guides.bulk.q3.title')}
        p3={t('guides.bulk.q3.desc')}
        h4={t('guides.bulk.q4.title')}
        p4={t('guides.bulk.q4.desc')}
        h5={t('guides.bulk.q5.title')}
        p5={t('guides.bulk.q5.desc')}
        h6={t('guides.bulk.q6.title')}
        p6={t('guides.bulk.q6.desc')}
      />
    </div>
  );
};

export default BulkTimesheet;
