import React, { useState } from 'react';
import CustomDatePicker from './ui/CustomDatePicker';
import { getCurrencySymbol } from '../utils/formatUtils';

const SubcontractorForms = ({ t, i18n, subcontractor, mode, onSaved }) => {
  const [hakedisData, setHakedisData] = useState({
    trans_date: new Date().toISOString().split('T')[0],
    amount: '',
    description: ''
  });

  const [odemeData, setOdemeData] = useState({
    trans_date: new Date().toISOString().split('T')[0],
    amount: '',
    description: ''
  });

  const handleHakedisChange = (e) => {
    const { name, value } = e.target;
    setHakedisData(prev => ({ ...prev, [name]: name === 'amount' ? Number(value) : value }));
  };

  const handleOdemeChange = (e) => {
    const { name, value } = e.target;
    setOdemeData(prev => ({ ...prev, [name]: name === 'amount' ? Number(value) : value }));
  };

  const handleSaveHakedis = async (e) => {
    e.preventDefault();
    if (window.api && hakedisData.amount > 0) {
      const dataToSave = {
        subcontractor_id: subcontractor.id,
        trans_date: hakedisData.trans_date,
        type: 'Hakediş',
        amount: hakedisData.amount,
        description: hakedisData.description,
        project_id: subcontractor.project_id,
        tags: JSON.stringify([])
      };

      await window.api.db.create('subcontractor_transactions', dataToSave);
      setHakedisData(prev => ({ ...prev, amount: '', description: '' }));
      onSaved();
    }
  };

  const handleSaveOdeme = async (e) => {
    e.preventDefault();
    if (window.api && odemeData.amount > 0) {
      const dataToSave = {
        subcontractor_id: subcontractor.id,
        trans_date: odemeData.trans_date,
        type: 'Ödeme',
        amount: odemeData.amount,
        description: odemeData.description,
        project_id: subcontractor.project_id,
        tags: JSON.stringify([])
      };

      // 1. Kasa (Cash Register) Entegrasyonu
      const cashDesc = t('subcontractor_profile.cash_desc', '[{{name}}] - Taşeron Ödemesi', { name: subcontractor.name });
      const cashRes = await window.api.db.create('cash_register', {
        trans_date: odemeData.trans_date,
        type: 'Nakit Çıkışı',
        amount: odemeData.amount,
        description: cashDesc,
        project_id: subcontractor.project_id,
        tags: JSON.stringify([])
      });

      if (cashRes && cashRes.success) {
        dataToSave.linked_cash_id = cashRes.id;
      }

      // 2. Taşeron İşlemi
      await window.api.db.create('subcontractor_transactions', dataToSave);

      setOdemeData(prev => ({ ...prev, amount: '', description: '' }));
      onSaved();
    }
  };

  return (
    <>
      {mode !== 'odeme' && (
      <form onSubmit={handleSaveHakedis} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{t('common.description', 'Açıklama / İş Detayı')}</label>
          <input type="text" name="description" className="form-input" placeholder={t('subcontractor_profile.desc_earned_ph', 'Örn: 3 Gün Kepçe Çalışması')} value={hakedisData.description} onChange={handleHakedisChange} required />
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">{t('common.amount', 'Tutar')} ({getCurrencySymbol(i18n.language)})</label>
            <input type="number" name="amount" className="form-input" min="1" step="0.01" value={hakedisData.amount} onChange={handleHakedisChange} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">{t('common.date', 'Tarih')}</label>
            <CustomDatePicker name="trans_date" className="form-input" value={hakedisData.trans_date} onChange={handleHakedisChange} required />
          </div>
          <button type="submit" className="btn btn-primary" style={{ height: '42px', flex: 1 }}>{t('subcontractor_profile.add_earned', 'Hakediş Ekle')}</button>
        </div>
      </form>
      )}
      {mode !== 'hakedis' && (
      <form onSubmit={handleSaveOdeme} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">{t('common.description', 'Açıklama')}</label>
          <input type="text" name="description" className="form-input" placeholder={t('subcontractor_profile.desc_payment_ph', 'Örn: Nakit Avans / Banka Transferi')} value={odemeData.description} onChange={handleOdemeChange} required />
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">{t('common.amount', 'Tutar')} ({getCurrencySymbol(i18n.language)})</label>
            <input type="number" name="amount" className="form-input" min="1" step="0.01" value={odemeData.amount} onChange={handleOdemeChange} required />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
            <label className="form-label">{t('common.date', 'Tarih')}</label>
            <CustomDatePicker name="trans_date" className="form-input" value={odemeData.trans_date} onChange={handleOdemeChange} required />
          </div>
          <button type="submit" className="btn btn-danger" style={{ height: '42px', flex: 1 }}>{t('subcontractor_profile.add_payment', 'Ödeme Ekle')}</button>
        </div>
      </form>
      )}
    </>
  );
};

export default SubcontractorForms;
