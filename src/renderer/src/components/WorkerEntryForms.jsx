import React, { useState, useEffect } from 'react';
import TagInput from './ui/TagInput';
import CustomDatePicker from './ui/CustomDatePicker';
import { formatCurrency } from '../utils/formatUtils';
import { formatDate, getCurrencySymbol } from '../utils/formatUtils';

const WorkerEntryForms = ({ t, i18n, worker, workTypes, workerLeaves, activeTab, setActiveTab, onSaved, setConfirmModalState, cReport, filterText, setFilterText, filterType, setFilterType, generatePDF, handleExport, handleWhatsAppSend }) => {
  // Form State for Puantaj
  const [formData, setFormData] = useState({
    work_date: new Date().toISOString().split('T')[0],
    work_type_id: '',
    overtime_hours: 0,
    notes: ''
  });
  const [calculatedWage, setCalculatedWage] = useState(0);
  const [puantajTags, setPuantajTags] = useState([]);

  // Form State for Avans
  const [avansData, setAvansData] = useState({
    trans_date: new Date().toISOString().split('T')[0],
    amount: '',
    notes: ''
  });
  const [avansTags, setAvansTags] = useState([]);

  // Form State for Leaves
  const [leaveData, setLeaveData] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    type: 'Ücretli',
    description: ''
  });

  // Select 'Tam Gün' or multiplier-1.0 default once work types arrive
  useEffect(() => {
    if (workTypes && workTypes.length > 0 && !formData.work_type_id) {
      const defaultType = workTypes.find(wt => wt.name === 'Tam Gün') || workTypes.find(wt => wt.multiplier === 1.0) || workTypes[0];
      if (defaultType) {
        setFormData(prev => ({ ...prev, work_type_id: defaultType.id }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workTypes]);

  // Live calculation of wage
  useEffect(() => {
    const calculateLive = async () => {
      if (formData.work_type_id && window.api) {
        const selectedType = workTypes.find(wt => wt.id == formData.work_type_id);
        if (selectedType) {
          const res = await window.api.finance.calculateWage({
            daily_wage: worker.daily_wage,
            multiplier: selectedType.multiplier,
            overtime_hours: formData.overtime_hours
          });
          if (res.success) {
            setCalculatedWage(res.wage);
          }
        }
      }
    };
    calculateLive();
  }, [formData.work_type_id, formData.overtime_hours, workTypes, worker.daily_wage]);

  const handlePuantajChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'overtime_hours' ? Number(value) : value
    }));
  };

  const handleAvansChange = (e) => {
    const { name, value } = e.target;
    setAvansData(prev => ({
      ...prev,
      [name]: name === 'amount' ? Number(value) : value
    }));
  };

  const handleSubmitTimesheet = async (e) => {
    e.preventDefault();
    const selectedType = workTypes.find(wt => wt.id == formData.work_type_id);

    if (window.api && selectedType) {
      const dataToSave = {
        worker_id: worker.id,
        work_date: formData.work_date,
        work_type_id: formData.work_type_id,
        applied_wage: worker.daily_wage,
        applied_multiplier: selectedType.multiplier,
        overtime_hours: formData.overtime_hours,
        earned_amount: calculatedWage,
        notes: formData.notes,
        tags: JSON.stringify(puantajTags),
        project_id: worker.project_id
      };

      const doSave = async () => {
        await window.api.db.create('timesheets', dataToSave);
        setFormData(prev => ({ ...prev, overtime_hours: 0, notes: '' }));
        setPuantajTags([]);
        onSaved(dataToSave.work_date);
      };

      const wDate = new Date(formData.work_date);
      const overlap = workerLeaves.find(l => {
        const sDate = new Date(l.start_date);
        const eDate = new Date(l.end_date);
        return wDate >= sDate && wDate <= eDate;
      });

      if (overlap) {
        let typeText = overlap.type;
        if (overlap.type === 'Ücretli') typeText = t('worker_profile.leave_types.paid', 'Ücretli İzin');
        else if (overlap.type === 'Ücretsiz') typeText = t('worker_profile.leave_types.unpaid', 'Ücretsiz İzin');
        else if (overlap.type === 'Rapor') typeText = t('worker_profile.leave_types.medical', 'Raporlu');

        const typeReason = overlap.description ? `${typeText} / ${overlap.description}` : typeText;
        let warningMsg = t('worker_profile.overlap_warning.message', 'Bu personel {{startDate}} - {{endDate}} tarihleri arasında {{type}} nedeniyle izinlidir. Yine de bu tarihe puantaj girmek istediğinize emin misiniz?');
        warningMsg = warningMsg.replace('{{startDate}}', formatDate(overlap.start_date, i18n.language))
                               .replace('{{endDate}}', formatDate(overlap.end_date, i18n.language))
                               .replace('{{type}}', typeReason);

        setConfirmModalState({
          isOpen: true,
          title: t('worker_profile.overlap_warning.title', 'Puantaj - İzin Çakışması'),
          message: warningMsg,
          confirmText: t('common.yes', 'Evet'),
          onConfirm: async () => {
            setConfirmModalState(prev => ({ ...prev, isOpen: false }));
            await doSave();
          }
        });
      } else {
        await doSave();
      }
    }
  };

  const handleSubmitAvans = async (e) => {
    e.preventDefault();
    if (window.api && avansData.amount > 0) {
      const dataToSave = {
        worker_id: worker.id,
        trans_date: avansData.trans_date,
        trans_type: 'Avans',
        amount: avansData.amount,
        notes: avansData.notes,
        tags: JSON.stringify(avansTags),
        project_id: worker.project_id
      };

      const res = await window.api.finance.createAdvance(dataToSave);
      if (res.success) {
        setAvansData(prev => ({ ...prev, amount: '', notes: '' }));
        setAvansTags([]);
        onSaved(dataToSave.trans_date);
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('common.error_occurred', 'Hata:') + ' ' + res.message, type: 'error' } }));
      }
    }
  };

  const handleLeaveChange = (e) => {
    const { name, value } = e.target;
    setLeaveData(prev => {
      const nextData = { ...prev, [name]: value };
      if (nextData.start_date && nextData.end_date && new Date(nextData.start_date) > new Date(nextData.end_date)) {
        const temp = nextData.start_date;
        nextData.start_date = nextData.end_date;
        nextData.end_date = temp;
      }
      return nextData;
    });
  };

  const handleSubmitLeave = async (e) => {
    e.preventDefault();
    if (window.api) {
      const dataToSave = {
        worker_id: worker.id,
        start_date: leaveData.start_date,
        end_date: leaveData.end_date,
        type: leaveData.type,
        description: leaveData.description,
        project_id: worker.project_id
      };
      await window.api.db.create('worker_leaves', dataToSave);
      setLeaveData(prev => ({ ...prev, description: '' }));
      onSaved();
    }
  };

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)' }}>
        <div
          style={{ flex: 1, padding: '1rem', textAlign: 'center', cursor: 'pointer', fontWeight: '500', background: activeTab === 'puantaj' ? 'rgba(139, 92, 246, 0.2)' : 'transparent' }}
          onClick={() => setActiveTab('puantaj')}
        >
          {t('worker_profile.timesheet')}
        </div>
        <div
          style={{ flex: 1, padding: '1rem', textAlign: 'center', cursor: 'pointer', fontWeight: '500', background: activeTab === 'avans' ? 'rgba(239, 68, 68, 0.2)' : 'transparent' }}
          onClick={() => setActiveTab('avans')}
        >
          {t('worker_profile.advance')}
        </div>
        <div
          style={{ flex: 1, padding: '1rem', textAlign: 'center', cursor: 'pointer', fontWeight: '500', background: activeTab === 'rapor' ? 'rgba(56, 189, 248, 0.2)' : 'transparent' }}
          onClick={() => setActiveTab('rapor')}
        >
          {t('worker_profile.report')}
        </div>
        <div
          style={{ flex: 1, padding: '1rem', textAlign: 'center', cursor: 'pointer', fontWeight: '500', background: activeTab === 'izinler' ? 'rgba(245, 158, 11, 0.2)' : 'transparent' }}
          onClick={() => setActiveTab('izinler')}
        >
          {t('worker_profile.leaves', 'İzinler')}
        </div>
      </div>

      <div style={{ padding: '1.5rem' }}>
        {activeTab === 'puantaj' ? (
          <form onSubmit={handleSubmitTimesheet}>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.timesheet_form.date')}</label>
              <CustomDatePicker name="work_date" className="form-input" value={formData.work_date} onChange={handlePuantajChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.timesheet_form.type')}</label>
              <select name="work_type_id" className="form-input" value={formData.work_type_id} onChange={handlePuantajChange} required>
                {workTypes.map(wt => <option key={wt.id} value={wt.id}>{wt.name} (x{wt.multiplier})</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.timesheet_form.overtime')}</label>
              <input type="number" name="overtime_hours" className="form-input" min="0" step="0.5" value={formData.overtime_hours} onChange={handlePuantajChange} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.timesheet_form.notes')}</label>
              <input type="text" name="notes" className="form-input" value={formData.notes} onChange={handlePuantajChange} placeholder={t('worker_profile.timesheet_form.notes_ph')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.timesheet_form.tags_label')}</label>
              <TagInput tags={puantajTags} setTags={setPuantajTags} placeholder={t('worker_profile.timesheet_form.tags_ph')} />
            </div>
            <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', textAlign: 'center' }}>
              <span className="form-label" style={{ marginBottom: 0 }}>{t('worker_profile.calculated_earned')}</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent)' }}>{formatCurrency(calculatedWage, i18n.language)}</div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>{t('worker_profile.timesheet_form.add_btn')}</button>
          </form>
        ) : activeTab === 'avans' ? (
          <form onSubmit={handleSubmitAvans}>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.advance_form.date')}</label>
              <CustomDatePicker name="trans_date" className="form-input" value={avansData.trans_date} onChange={handleAvansChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.advance_form.amount')} ({getCurrencySymbol(i18n.language)})</label>
              <input type="number" name="amount" className="form-input" min="1" step="0.01" value={avansData.amount} onChange={handleAvansChange} required />
            </div>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.advance_form.notes')}</label>
              <input type="text" name="notes" className="form-input" value={avansData.notes} onChange={handleAvansChange} placeholder={t('worker_profile.advance_form.notes_ph', 'Örn: Haftalık avans')} />
            </div>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.advance_form.tags_label')}</label>
              <TagInput tags={avansTags} setTags={setAvansTags} placeholder={t('worker_profile.advance_form.tags_ph')} />
            </div>
            <div style={{ color: 'var(--danger-text)', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>
              {t('worker_profile.auto_deduct_notice')}
            </div>
            <button type="submit" className="btn btn-danger" style={{ width: '100%' }}>{t('worker_profile.advance_form.add_btn')}</button>
          </form>
        ) : activeTab === 'izinler' ? (
          <form onSubmit={handleSubmitLeave}>
            <div className="form-group" style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ flex: 1 }}>
                <label className="form-label">{t('worker_profile.leave_form.start_date', 'Başlangıç')}</label>
                <CustomDatePicker name="start_date" className="form-input" value={leaveData.start_date} onChange={handleLeaveChange} required />
              </div>
              <div style={{ flex: 1 }}>
                <label className="form-label">{t('worker_profile.leave_form.end_date', 'Bitiş')}</label>
                <CustomDatePicker name="end_date" className="form-input" value={leaveData.end_date} onChange={handleLeaveChange} required />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.leave_form.type', 'İzin Türü')}</label>
              <select name="type" className="form-input" value={leaveData.type} onChange={handleLeaveChange} required>
                <option value="Ücretli">{t('worker_profile.leave_types.paid', 'Ücretli İzin')}</option>
                <option value="Ücretsiz">{t('worker_profile.leave_types.unpaid', 'Ücretsiz İzin')}</option>
                <option value="Rapor">{t('worker_profile.leave_types.medical', 'Raporlu')}</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">{t('worker_profile.leave_form.description', 'Açıklama / Sebep')}</label>
              <input type="text" name="description" className="form-input" value={leaveData.description} onChange={handleLeaveChange} />
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%', background: '#f59e0b', color: '#fff', border: 'none' }}>
              {t('worker_profile.leave_form.add_btn', 'İzin Ekle')}
            </button>
          </form>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <h3 className="card-title mb-4">{t('worker_profile.account_statement')}</h3>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
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
              <div style={{ flex: 1 }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{t('worker_profile.table.type', 'İşlem Türü')}</label>
                <select className="form-input" value={filterType} onChange={e => setFilterType(e.target.value)}>
                  <option value="Tümü">{t('worker_profile.filter.type_all')}</option>
                  <option value="Puantaj">{t('worker_profile.filter.type_timesheet')}</option>
                  <option value="Avans">{t('worker_profile.filter.type_advance')}</option>
                </select>
              </div>
            </div>

            <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-border)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="text-muted">{t('worker_profile.summary.previous_balance')}:</span>
                <span style={{ fontWeight: 'bold' }}>{formatCurrency(cReport.devredenBakiye, i18n.language)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span className="text-muted">{t('worker_profile.summary.period_earned')}:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--success-text)' }}>+{formatCurrency(cReport.donemHakEdis, i18n.language)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
                <span className="text-muted">{t('worker_profile.summary.period_advance')}:</span>
                <span style={{ fontWeight: 'bold', color: 'var(--danger-text)' }}>-{formatCurrency(cReport.donemAvans, i18n.language)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">{t('worker_profile.summary.new_balance')}:</span>
                <span style={{ fontWeight: 'bold', fontSize: '1.2rem', color: cReport.yeniBakiye >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>
                  {formatCurrency(cReport.yeniBakiye, i18n.language)}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
              <select className="btn" style={{ padding: '0.5rem', flex: 1, background: 'var(--accent)', color: 'var(--accent-text)', fontWeight: 'bold' }} onChange={e => {
                  const val = e.target.value;
                  if (val === 'pdf') generatePDF();
                  else if (val) handleExport(val);
                  e.target.value = "";
                }} value="">
                <option value="" disabled>{t('worker_profile.filter.export')}...</option>
                <option value="pdf">PDF</option>
                <option value="excel">Excel (.xlsx)</option>
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
              </select>
              <button
                type="button"
                className="btn"
                style={{ padding: '0.5rem', flex: 1, background: '#25D366', color: '#fff', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', border: 'none' }}
                onClick={handleWhatsAppSend}
              >
                🟢 WhatsApp
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkerEntryForms;
