import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CustomDatePicker from './ui/CustomDatePicker';
import GuideDrawer from './ui/GuideDrawer';
import { formatCurrency, trLower } from '../utils/formatUtils';

const BulkTimesheet = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [workers, setWorkers] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [workerGroups, setWorkerGroups] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [existingTimesheets, setExistingTimesheets] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  }, [activeProjectId]);

  useEffect(() => {
    fetchExistingTimesheets();
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

  const selectedType = workTypes.find(wt => wt.id == formData.work_type_id);

  const getDatesInRange = (startDateStr, endDateStr) => {
    const dates = [];
    let currentDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    return dates;
  };

  const handleBulkSave = async (e) => {
    if (e) e.preventDefault();
    if (selectedIds.size === 0) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('bulk_timesheet.no_workers_selected', 'Lütfen en az bir personel seçin.'), type: 'warning' } }));
      return;
    }
    if (!selectedType) return;

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    const dates = formData.end_date ? getDatesInRange(formData.work_date, formData.end_date) : [formData.work_date];
    const dataList = [];

    for (const date of dates) {
      for (const workerId of selectedIds) {
        try {
          const worker = workers.find(w => w.id === workerId);
          if (!worker) continue;

          const wageRes = await window.api.finance.calculateWage({
            daily_wage: worker.daily_wage,
            multiplier: selectedType.multiplier,
            overtime_hours: formData.overtime_hours
          });

          const earnedAmount = wageRes.success ? wageRes.wage : worker.daily_wage * selectedType.multiplier;

          dataList.push({
            worker_id: workerId,
            work_date: date,
            work_type_id: formData.work_type_id,
            applied_wage: worker.daily_wage,
            applied_multiplier: selectedType.multiplier,
            overtime_hours: formData.overtime_hours,
            earned_amount: earnedAmount,
            notes: formData.notes,
            tags: '[]',
            project_id: activeProjectId
          });
        } catch (err) {
          console.error(`Bulk timesheet calculation error for worker ${workerId} on ${date}:`, err);
        }
      }
    }

    const selectedGroupObj = workerGroups.find(g => String(g.id) === String(selectedGroup));
    const groupNameStr = selectedGroupObj ? selectedGroupObj.name : t('bulk_timesheet.personnel_fallback', 'personel');

    const logMessage = t('bulk_timesheet.save_success', '{{count}} {{group}} için {{days}} günlük (toplam {{total}} kayıt) puantaj başarıyla kaydedildi.')
      .replace('{{count}}', selectedIds.size)
      .replace('{{group}}', groupNameStr)
      .replace('{{days}}', dates.length)
      .replace('{{total}}', dataList.length);

    if (window.api.db.createBulk) {
      try {
        const res = await window.api.db.createBulk('timesheets', dataList, logMessage);
        setSaving(false);

        if (res.success) {
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: {
              message: logMessage,
              type: 'success'
            }
          }));
        } else {
          window.dispatchEvent(new CustomEvent('show-toast', {
            detail: {
              message: t('bulk_timesheet.save_error', 'Bazı kayıtlarda hata oluştu. Başarılı: {{success}}, Hata: {{error}}')
                .replace('{{success}}', 0)
                .replace('{{error}}', dataList.length),
              type: 'warning'
            }
          }));
        }
      } catch (err) {
        setSaving(false);
        console.error('Bulk save error:', err);
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: {
            message: t('bulk_timesheet.save_error', 'Bazı kayıtlarda hata oluştu. Başarılı: {{success}}, Hata: {{error}}')
              .replace('{{success}}', 0)
              .replace('{{error}}', dataList.length),
            type: 'warning'
          }
        }));
      }
    } else {
      // Fallback: loop-based create (if Electron app hasn't been restarted yet)
      let successCount = 0;
      let errorCount = 0;
      for (const item of dataList) {
        try {
          await window.api.db.create('timesheets', item);
          successCount++;
        } catch (err) {
          console.error('Fallback timesheet error:', err);
          errorCount++;
        }
      }
      setSaving(false);
      if (errorCount === 0) {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: {
            message: logMessage,
            type: 'success'
          }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', {
          detail: {
            message: t('bulk_timesheet.save_error', 'Bazı kayıtlarda hata oluştu. Başarılı: {{success}}, Hata: {{error}}')
              .replace('{{success}}', successCount)
              .replace('{{error}}', errorCount),
            type: 'warning'
          }
        }));
      }
    }

    setSelectedIds(new Set());
    fetchExistingTimesheets();
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

        {/* Add Record Form */}
        <form onSubmit={handleBulkSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'flex-end', marginBottom: '0.25rem' }}>
          
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('bulk_timesheet.start_date', 'Başlangıç Tarihi')}</label>
            <CustomDatePicker
              name="work_date"
              className="form-input"
              value={formData.work_date}
              onChange={e => handleStartDateChange(e.target.value)}
              required
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('bulk_timesheet.end_date', 'Bitiş Tarihi')}</label>
            <CustomDatePicker
              name="end_date"
              className="form-input"
              value={formData.end_date || ''}
              onChange={e => handleEndDateChange(e.target.value)}
              placeholder={t('bulk_timesheet.end_date_placeholder', 'Varsayılan: Tek Gün')}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_profile.timesheet_form.type', 'Çalışma Tipi')}</label>
            <select
              className="form-input"
              value={formData.work_type_id}
              onChange={e => setFormData(prev => ({ ...prev, work_type_id: e.target.value }))}
              required
            >
              {workTypes.map(wt => (
                <option key={wt.id} value={wt.id}>{wt.name} (x{wt.multiplier})</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_profile.timesheet_form.overtime', 'Mesai Saati')}</label>
            <input
              type="number"
              className="form-input"
              min="0"
              step="0.5"
              value={formData.overtime_hours}
              onChange={e => setFormData(prev => ({ ...prev, overtime_hours: Number(e.target.value) }))}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_profile.timesheet_form.notes', 'Açıklama / Not')}</label>
            <input
              type="text"
              className="form-input"
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder={t('worker_profile.timesheet_form.notes_ph', 'Örn: Kalıp söküm')}
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || selectedIds.size === 0}
            style={{
              height: '42px',
              fontSize: '0.95rem',
              fontWeight: 'bold',
              opacity: saving || selectedIds.size === 0 ? 0.5 : 1,
              cursor: saving || selectedIds.size === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? t('common.saving', 'Kaydediliyor...') : `${t('bulk_timesheet.save_btn', 'Toplu Kaydet')} (${selectedIds.size})`}
          </button>
        </form>

        {/* Filters & Search Bar */}
        <div style={{ 
          background: 'rgba(255, 255, 255, 0.02)', 
          border: '1px solid var(--glass-border)', 
          borderRadius: '12px', 
          padding: '0.75rem 1rem', 
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
                placeholder={t('bulk_timesheet.search_placeholder_new', 'İsim, TC, telefon, grup veya yevmiye ara...')}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', paddingRight: '2.5rem', marginBottom: 0 }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ position: 'absolute', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '4px' }}
                >✕</button>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('bulk_timesheet.group_label', 'Grup')}</label>
            <select
              className="form-input"
              value={selectedGroup}
              onChange={e => setSelectedGroup(e.target.value)}
              style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
            >
              <option value="">{t('bulk_timesheet.group_filter_all', 'Tüm Gruplar')}</option>
              {workerGroups.map(g => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 150px' }}>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('bulk_timesheet.status_label', 'Puantaj Durumu')}</label>
            <select
              className="form-input"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
            >
              <option value="">{t('bulk_timesheet.status_all', 'Tümü')}</option>
              <option value="entered">{t('bulk_timesheet.status_entered', 'Puantajı Girilenler')}</option>
              <option value="not_entered">{t('bulk_timesheet.status_not_entered', 'Puantajı Girilmeyenler')}</option>
            </select>
          </div>

          <button
            type="button"
            className="btn"
            onClick={handleSelectAll}
            style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem', minWidth: '120px', height: '38px' }}
          >
            {allEligibleSelected
              ? t('bulk_timesheet.deselect_all', 'Seçimi Kaldır')
              : t('bulk_timesheet.select_all', 'Tümünü Seç')}
          </button>
        </div>

      </div>

      {/* Bottom Card: Worker List (Independent Scrolling) */}
      <div className="glass-card" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          👥 {t('bulk_timesheet.select_workers', 'Personel Seçin')} ({t('bulk_timesheet.selected_count', '{{count}} personel seçildi').replace('{{count}}', selectedIds.size)})
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginTop: '0.25rem', paddingBottom: '2.5rem' }}>
          {loading ? (
            <div className="skeleton" style={{ height: '150px', width: '100%', gridColumn: '1 / -1' }}></div>
          ) : filteredWorkers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
              {searchQuery ? t('common.no_results', 'Sonuç bulunamadı.') : t('bulk_timesheet.no_workers', 'Aktif personel bulunamadı.')}
            </div>
          ) : (
            filteredWorkers.map(w => {
              const isSelected = selectedIds.has(w.id);
              const hasTimesheet = existingTimesheets.some(ts => ts.worker_id === w.id);
              const groupObj = workerGroups.find(g => g.id === w.group_id);
              const groupName = groupObj ? groupObj.name : '';
              return (
                <div
                  key={w.id}
                  onClick={() => handleToggle(w.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    borderRadius: '8px',
                    cursor: hasTimesheet ? 'not-allowed' : 'pointer',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--glass-border)'}`,
                    background: hasTimesheet 
                      ? 'rgba(16, 185, 129, 0.03)' 
                      : (isSelected ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.02)'),
                    opacity: hasTimesheet ? 0.75 : 1,
                    transition: 'all 0.15s ease',
                    userSelect: 'none'
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                    border: `2px solid ${hasTimesheet ? '#10b981' : (isSelected ? 'var(--primary)' : 'var(--text-muted)')}`,
                    background: hasTimesheet ? '#10b981' : (isSelected ? 'var(--primary)' : 'transparent'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}>
                    {(isSelected || hasTimesheet) && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', color: hasTimesheet ? 'var(--text-muted)' : 'var(--text-main)' }}>{w.full_name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {formatCurrency(w.daily_wage, i18n.language)} / {t('bulk_timesheet.day', 'gün')}
                        {groupName && ` • ${groupName}`}
                      </div>
                    </div>
                    {hasTimesheet && (
                      <span style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                        padding: '0.2rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '600'
                      }}>
                        {t('bulk_timesheet.already_entered', '✓ Girildi')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

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
