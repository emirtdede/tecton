import React from 'react';
import { X } from 'lucide-react';
import CustomDatePicker from './ui/CustomDatePicker';

const WorkerIsgModal = ({ t, worker, open, onClose, onSaved, isgForm, setIsgForm }) => {
  if (!open) return null;

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div
        className="glass-card"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: '420px', maxWidth: '90vw', zIndex: 1000, padding: '2rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)', border: '1px solid var(--glass-border)',
          background: 'var(--spotlight-bg)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
             {t('isg.update_title', 'İSG Tarihlerini Güncelle')}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('isg.start_date', 'İSG Başlangıç Tarihi')}</label>
            <CustomDatePicker
              name="isg_start_date"
              className="form-input"
              value={isgForm.isg_start_date}
              onChange={e => setIsgForm(prev => {
                const val = e.target.value;
                if (val && prev.isg_bitis_tarihi && new Date(val) > new Date(prev.isg_bitis_tarihi)) {
                  return { ...prev, isg_start_date: prev.isg_bitis_tarihi, isg_bitis_tarihi: val };
                }
                return { ...prev, isg_start_date: val };
              })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">{t('isg.expiry_date', 'İSG Bitiş Tarihi')}</label>
            <CustomDatePicker
              name="isg_bitis_tarihi"
              className="form-input"
              value={isgForm.isg_bitis_tarihi}
              onChange={e => setIsgForm(prev => {
                const val = e.target.value;
                if (val && prev.isg_start_date && new Date(prev.isg_start_date) > new Date(val)) {
                  return { ...prev, isg_bitis_tarihi: prev.isg_start_date, isg_start_date: val };
                }
                return { ...prev, isg_bitis_tarihi: val };
              })}
            />
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: '0.5rem', fontWeight: 'bold' }}
            onClick={async () => {
              if (window.api && window.api.db) {
                await window.api.db.update('workers', worker.id, {
                  isg_start_date: isgForm.isg_start_date || null,
                  isg_bitis_tarihi: isgForm.isg_bitis_tarihi || null
                });
                onClose();
                window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('isg.update_success', 'İSG tarihleri başarıyla güncellendi.'), type: 'success' } }));
                onSaved();
              }
            }}
          >
            {t('common.save', 'Kaydet')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default WorkerIsgModal;
