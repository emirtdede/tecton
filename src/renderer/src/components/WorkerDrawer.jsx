import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import TagInput from './ui/TagInput';
import CustomDatePicker from './ui/CustomDatePicker';
import { isValidTCKN } from '../utils/validation';
import useModalA11y from '../hooks/useModalA11y';
import { logError } from '../utils/logger';
import { localToday } from '../utils/formatUtils';
import { parseTags } from '../utils/tagUtils';
import { X } from 'lucide-react';

const WorkerDrawer = ({ isOpen, onClose, onSave, worker }) => {
  const { t } = useTranslation();
  const [workerGroups, setWorkerGroups] = useState([]);
  
  const [formData, setFormData] = useState({
    full_name: '',
    tc_no: '',
    phone: '',
    daily_wage: '',
    group_id: '',
    start_date: localToday(),
    status: 'active',
    isg_start_date: '',
    isg_bitis_tarihi: ''
  });
  const [tags, setTags] = useState([]);
  const [tcError, setTcError] = useState('');

  // Guards against stale responses overwriting newer data when the drawer is
  // opened/closed rapidly.
  const groupsRequestIdRef = useRef(0);

  useEffect(() => {
    const fetchGroups = async () => {
      if (window.api && isOpen) {
        const requestId = ++groupsRequestIdRef.current;
        try {
          const groups = await window.api.db.read('worker_groups');
          if (requestId !== groupsRequestIdRef.current) return;
          setWorkerGroups(groups || []);
        } catch (err) {
          if (requestId !== groupsRequestIdRef.current) return;
          logError('Worker groups fetch failed:', err);
          setWorkerGroups([]);
        }
      }
    };
    fetchGroups();
    return () => {
      // Invalidate in-flight responses when the drawer closes.
      groupsRequestIdRef.current += 1;
    };
  }, [isOpen]);

  useEffect(() => {
    if (worker) {
      setFormData({
        full_name: worker.full_name || '',
        tc_no: worker.tc_no || '',
        phone: worker.phone || '',
        daily_wage: worker.daily_wage || '',
        group_id: worker.group_id || '',
        start_date: worker.start_date || localToday(),
        status: worker.status || 'active',
        isg_start_date: worker.isg_start_date || '',
        isg_bitis_tarihi: worker.isg_bitis_tarihi || ''
      });
      setTags(parseTags(worker.tags));
    } else {
      setFormData({
        full_name: '',
        tc_no: '',
        phone: '',
        daily_wage: '',
        group_id: '',
        start_date: localToday(),
        status: 'active',
        isg_start_date: '',
        isg_bitis_tarihi: ''
      });
      setTags([]);
    }
    setTcError(''); // Clear error state on open/reset
  }, [worker, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'tc_no') {
      setTcError(''); // Clear error on change
    }
    setFormData(prev => {
      let updated = {
        ...prev,
        [name]: name === 'group_id' ? (value ? Number(value) : null) : value
      };
      if (name === 'isg_start_date' && value && updated.isg_bitis_tarihi && new Date(value) > new Date(updated.isg_bitis_tarihi)) {
        updated.isg_start_date = updated.isg_bitis_tarihi;
        updated.isg_bitis_tarihi = value;
      }
      if (name === 'isg_bitis_tarihi' && value && updated.isg_start_date && new Date(updated.isg_start_date) > new Date(value)) {
        updated.isg_bitis_tarihi = updated.isg_start_date;
        updated.isg_start_date = value;
      }
      return updated;
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // TC Validation
    if (formData.tc_no && !isValidTCKN(formData.tc_no)) {
      setTcError(t('worker_modal.invalid_tc', 'Geçersiz TC Kimlik No. Lütfen kontrol edin.'));
      return;
    }

    const submitData = { ...formData, tags: JSON.stringify(tags) };
    onSave(worker?.id, submitData);
  };

  const { dialogProps, containerRef } = useModalA11y({
    isOpen,
    onClose,
    label: worker ? t('worker_modal.title_edit') : t('worker_modal.title_new')
  });

  if (!isOpen) return null;

  return (
    <div className="drawer-overlay">
      <div
        ref={containerRef}
        {...dialogProps}
        className="drawer-content"
        style={{ display: 'flex', flexDirection: 'column', padding: '2rem', outline: 'none' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.75rem' }}>
          <h2 className="drawer-title" style={{ margin: 0, fontSize: '1.3rem', fontWeight: 'bold' }}>{worker ? t('worker_modal.title_edit') : t('worker_modal.title_new')}</h2>
          <button 
            type="button"
            className="btn btn-danger" 
            aria-label={t('common.close', 'Kapat')}
            title={t('common.close', 'Kapat')}
            onClick={onClose} 
            style={{ width: '32px', height: '32px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', border: 'none' }}
          ><X size={14} aria-hidden="true" />
            
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_modal.name')}</label>
            <input 
              type="text" 
              name="full_name" 
              className="form-input"
              value={formData.full_name} 
              onChange={handleChange} 
              placeholder={t('worker_modal.name_ph')}
              required 
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_modal.tc')}</label>
            <input 
              type="text" 
              name="tc_no" 
              className={`form-input ${tcError ? 'error-border' : ''}`}
              style={tcError ? { border: '1px solid var(--danger)' } : {}}
              value={formData.tc_no} 
              onChange={handleChange} 
              placeholder={t('worker_modal.tc_ph')}
              maxLength={11}
            />
            {tcError && <span style={{ color: 'var(--danger)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>{tcError}</span>}
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_modal.tags')}</label>
            <TagInput tags={tags} setTags={setTags} placeholder={t('worker_modal.tags_ph')} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_modal.status')}</label>
            <select name="status" className="form-input" value={formData.status} onChange={handleChange}>
              <option value="active">{t('worker_modal.status_active')}</option>
              <option value="passive">{t('worker_modal.status_inactive')}</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_modal.group')}</label>
            <select 
              name="group_id" 
              className="form-input" 
              value={formData.group_id || ''} 
              onChange={handleChange}
            >
              <option value="">{t('worker_modal.group_empty')}</option>
              {workerGroups.map(grp => (
                <option key={grp.id} value={grp.id}>{grp.name}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_modal.phone')}</label>
            <input 
              type="text" 
              name="phone" 
              className="form-input"
              value={formData.phone} 
              onChange={handleChange} 
              placeholder={t('worker_modal.phone_ph')}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_modal.wage')}</label>
            <input 
              type="number" 
              name="daily_wage" 
              className="form-input"
              value={formData.daily_wage} 
              onChange={handleChange} 
              placeholder={t('worker_modal.wage_ph')}
              required 
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('worker_modal.start_date')}</label>
            <CustomDatePicker 
              name="start_date" 
              className="form-input" 
              value={formData.start_date} 
              onChange={handleChange} 
              required 
            />
          </div>

          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1rem', marginTop: '0.25rem' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
               {t('isg.section_title', 'İSG (İş Sağlığı ve Güvenliği)')}
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label">{t('isg.start_date', 'İSG Başlangıç Tarihi')}</label>
                <CustomDatePicker 
                  name="isg_start_date" 
                  className="form-input" 
                  value={formData.isg_start_date} 
                  onChange={handleChange} 
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                <label className="form-label">{t('isg.expiry_date', 'İSG Bitiş Tarihi')}</label>
                <CustomDatePicker 
                  name="isg_bitis_tarihi" 
                  className="form-input" 
                  value={formData.isg_bitis_tarihi} 
                  onChange={handleChange} 
                />
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
            <button type="button" className="btn" onClick={onClose} style={{ flex: 1, fontWeight: 'bold' }}>{t('worker_modal.cancel')}</button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, fontWeight: 'bold' }}>{t('worker_modal.save')}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default WorkerDrawer;
