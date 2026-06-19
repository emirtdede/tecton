import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CustomDatePicker from './ui/CustomDatePicker';
import GuideDrawer from './ui/GuideDrawer';
import { formatCurrency } from '../utils/formatUtils';

const BulkTimesheet = ({ activeProjectId, projects = [] }) => {
  const { t, i18n } = useTranslation();
  const [workers, setWorkers] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);

  // Unified form
  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    work_type_id: '',
    overtime_hours: 0,
    notes: ''
  });

  const activeProject = projects.find(p => p.id === activeProjectId);

  useEffect(() => {
    const fetchData = async () => {
      if (!activeProjectId || !window.api) return;
      setLoading(true);
      const [workerData, workTypeData] = await Promise.all([
        window.api.db.read('workers', { project_id: activeProjectId }),
        window.api.db.read('work_types')
      ]);
      setWorkers(workerData.filter(w => w.status !== 'passive'));
      setWorkTypes(workTypeData);
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

  const filteredWorkers = workers.filter(w =>
    w.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (w.tc_no && w.tc_no.includes(searchQuery)) ||
    (w.phone && w.phone.includes(searchQuery))
  );

  const handleToggle = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredWorkers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredWorkers.map(w => w.id)));
    }
  };

  const selectedType = workTypes.find(wt => wt.id == formData.work_type_id);

  const handleBulkSave = async () => {
    if (selectedIds.size === 0) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('bulk_timesheet.no_workers_selected', 'Lütfen en az bir personel seçin.'), type: 'warning' } }));
      return;
    }
    if (!selectedType) return;

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

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

        await window.api.db.create('timesheets', {
          worker_id: workerId,
          work_date: formData.work_date,
          work_type_id: formData.work_type_id,
          applied_wage: worker.daily_wage,
          applied_multiplier: selectedType.multiplier,
          overtime_hours: formData.overtime_hours,
          earned_amount: earnedAmount,
          notes: formData.notes,
          tags: '[]',
          project_id: activeProjectId
        });
        successCount++;
      } catch (err) {
        console.error(`Bulk timesheet error for worker ${workerId}:`, err);
        errorCount++;
      }
    }

    setSaving(false);

    if (errorCount === 0) {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: t('bulk_timesheet.save_success', '{{count}} personel için puantaj başarıyla kaydedildi.').replace('{{count}}', successCount),
          type: 'success'
        }
      }));
    } else {
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: t('bulk_timesheet.save_error', 'Bazı kayıtlarda hata oluştu. Başarılı: {{success}}, Hata: {{error}}').replace('{{success}}', successCount).replace('{{error}}', errorCount),
          type: 'warning'
        }
      }));
    }

    setSelectedIds(new Set());
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
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
      {/* Left Panel — Personnel Selection */}
      <div className="glass-card" style={{ maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h2 className="card-title" style={{ fontSize: '1.3rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            👥 {t('bulk_timesheet.select_workers', 'Personel Seçin')}
          </h2>
          <span 
            onClick={() => setHelpOpen(true)}
            style={{ cursor: 'pointer', opacity: 0.4, transition: 'opacity 0.25s ease-in-out', fontSize: '1.4rem', userSelect: 'none', padding: '0.25rem' }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.4}
            title={t('common.page_guide', 'Sayfa Kılavuzu')}
          >💡</span>
        </div>

        <p className="card-subtitle" style={{ marginBottom: '1rem' }}>
          {t('common.active_project', 'Aktif Şantiye:')} <span style={{ color: 'var(--primary)', fontWeight: '600' }}>{activeProject?.name}</span>
        </p>

        {/* Search & Select All */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, display: 'flex', alignItems: 'center' }}>
            <input
              type="text"
              className="form-input"
              placeholder={t('bulk_timesheet.search_workers', 'Personel ara...')}
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
          <button
            className="btn"
            onClick={handleSelectAll}
            style={{ whiteSpace: 'nowrap', fontSize: '0.85rem', padding: '0.5rem 1rem' }}
          >
            {selectedIds.size === filteredWorkers.length && filteredWorkers.length > 0
              ? t('bulk_timesheet.deselect_all', 'Seçimi Kaldır')
              : t('bulk_timesheet.select_all', 'Tümünü Seç')}
          </button>
        </div>

        {/* Selected Count */}
        <div style={{
          background: selectedIds.size > 0 ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${selectedIds.size > 0 ? 'var(--primary)' : 'var(--glass-border)'}`,
          borderRadius: '8px',
          padding: '0.5rem 1rem',
          marginBottom: '1rem',
          fontSize: '0.9rem',
          fontWeight: '600',
          color: selectedIds.size > 0 ? 'var(--primary)' : 'var(--text-muted)',
          textAlign: 'center',
          transition: 'all 0.2s ease'
        }}>
          {t('bulk_timesheet.selected_count', '{{count}} personel seçildi').replace('{{count}}', selectedIds.size)}
        </div>

        {/* Worker List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {loading ? (
            <div className="skeleton" style={{ height: '200px', width: '100%' }}></div>
          ) : filteredWorkers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              {searchQuery ? t('common.no_results', 'Sonuç bulunamadı.') : t('bulk_timesheet.no_workers', 'Aktif personel bulunamadı.')}
            </div>
          ) : (
            filteredWorkers.map(w => {
              const isSelected = selectedIds.has(w.id);
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
                    cursor: 'pointer',
                    border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--glass-border)'}`,
                    background: isSelected ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.02)',
                    transition: 'all 0.15s ease',
                    userSelect: 'none'
                  }}
                >
                  <div style={{
                    width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                    border: `2px solid ${isSelected ? 'var(--primary)' : 'var(--text-muted)'}`,
                    background: isSelected ? 'var(--primary)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s ease'
                  }}>
                    {isSelected && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}>✓</span>}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>{w.full_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatCurrency(w.daily_wage, i18n.language)} / {t('common.day', 'gün')}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Right Panel — Unified Timesheet Form */}
      <div className="glass-card" style={{ position: 'sticky', top: '1rem' }}>
        <h2 className="card-title" style={{ fontSize: '1.3rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          📋 {t('bulk_timesheet.form_title', 'Puantaj Bilgileri')}
        </h2>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_profile.timesheet_form.date', 'Tarih')}</label>
            <CustomDatePicker
              name="work_date"
              className="form-input"
              value={formData.work_date}
              onChange={e => setFormData(prev => ({ ...prev, work_date: e.target.value }))}
              required
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

          {/* Preview */}
          {selectedType && selectedIds.size > 0 && (
            <div style={{
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.3)',
              borderRadius: '8px',
              padding: '1rem',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                {t('bulk_timesheet.preview_wage', 'Tahmini Ücret')} ({selectedType.name} x{selectedType.multiplier})
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {t('bulk_timesheet.selected_count', '{{count}} personel seçildi').replace('{{count}}', selectedIds.size)}
              </div>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleBulkSave}
            disabled={saving || selectedIds.size === 0}
            style={{
              padding: '0.75rem 1.5rem',
              fontSize: '1rem',
              fontWeight: 'bold',
              opacity: saving || selectedIds.size === 0 ? 0.5 : 1,
              cursor: saving || selectedIds.size === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            {saving ? (
              <>{t('common.saving', 'Kaydediliyor...')}</>
            ) : (
              <>{t('bulk_timesheet.save_btn', 'Toplu Kaydet')} ({selectedIds.size})</>
            )}
          </button>
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
