import React, { useState } from 'react';
import CustomDatePicker from './ui/CustomDatePicker';

const BulkForm = ({ t, i18n, workers, workerGroups, selectedIds, setSelectedIds, selectedGroup, formData, setFormData, workTypes, activeProjectId, onSaved, onStartDateChange, onEndDateChange }) => {
  const [saving, setSaving] = useState(false);
  void i18n;

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
    onSaved();
  };

  return (
    <form onSubmit={handleBulkSave} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', alignItems: 'flex-end', marginBottom: '0.25rem' }}>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">{t('bulk_timesheet.start_date', 'Başlangıç Tarihi')}</label>
        <CustomDatePicker
          name="work_date"
          className="form-input"
          value={formData.work_date}
          onChange={e => onStartDateChange(e.target.value)}
          required
        />
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label className="form-label">{t('bulk_timesheet.end_date', 'Bitiş Tarihi')}</label>
        <CustomDatePicker
          name="end_date"
          className="form-input"
          value={formData.end_date || ''}
          onChange={e => onEndDateChange(e.target.value)}
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
          onChange={e => setFormData(prev => ({ ...prev, overtime_hours: e.target.value === '' ? '' : Number(e.target.value) }))}
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
  );
};

export default BulkForm;
