import React, { useRef } from 'react';
import { exportToExcel, exportToCSV, exportToJSON, generateSubcontractorTemplate } from '../utils/exportUtils';
import { readSubcontractorsFromExcel } from '../utils/importUtils';
import { trLower } from '../utils/formatUtils';

const SubcontractorHeader = ({ t, i18n, contractors, activeProjectId, fetchContractors, onAdd, onHelp }) => {
  const fileInputRef = useRef(null);

  return (
    <header className="header" style={{ marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <h1 style={{ margin: 0 }}>{t('subcontractor.title', '🚜 Taşeron ve Alt Yüklenici Carileri')}</h1>
        <span
          onClick={onHelp}
          style={{
            cursor: 'pointer',
            opacity: 'var(--guide-icon-opacity, 0.4)', filter: 'var(--guide-icon-filter, none)',
            transition: 'opacity 0.25s ease-in-out',
            fontSize: '1.4rem',
            userSelect: 'none',
            padding: '0.25rem'
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity-hover, 1)'}
          onMouseLeave={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity, 0.4)'}
          title={t('common.page_guide', 'Sayfa Kılavuzu')}
        >
          💡
        </span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="file"
          accept=".xlsx, .xls"
          style={{ display: 'none' }}
          ref={fileInputRef}
          onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
              const result = await readSubcontractorsFromExcel(file, t, i18n.language);
              if (result.success) {
                for (const sub of result.data) {
                  const existing = contractors.find(c => trLower(c.name.trim()) === trLower(sub.name.trim()));
                  if (existing) {
                    await window.api.db.update('subcontractor_ledgers', existing.id, {
                      ...sub, project_id: activeProjectId
                    });
                  } else {
                    await window.api.db.create('subcontractor_ledgers', {
                      ...sub, project_id: activeProjectId
                    });
                  }
                }
                window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('subcontractor_import.import_success', '{{count}} taşeron kaydı başarıyla içe aktarıldı.').replace('{{count}}', result.data.length), type: 'success' } }));
                fetchContractors();
              }
            } catch (err) {
              window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('common.error_occurred', 'Hata:') + ' ' + (err.message || JSON.stringify(err)), type: 'error' } }));
            }
            e.target.value = null;
          }}
        />
        <button className="btn" style={{ background: '#10B981', color: 'white', border: 'none' }} onClick={() => fileInputRef.current.click()}>
          {t('subcontractor_import.import_btn', 'Excel\'den İçe Aktar')}
        </button>
        <button className="btn" style={{ background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', border: '1px solid #38bdf8' }} onClick={() => generateSubcontractorTemplate(t, i18n.language)}>
          {t('subcontractor_import.download_template', 'Excel Taslağını İndir')}
        </button>
        <select className="btn" style={{ padding: '0.5rem' }} onChange={e => {
          const format = e.target.value;
          if (!format) return;
          const lang = i18n.language;
          const isTr = lang === 'tr';
          const dataToExport = contractors.map(c => ({
            [isTr ? 'Taşeron Adı' : 'Subcontractor Name']: c.name,
            [isTr ? 'Hizmet Alanı' : 'Service Type']: c.service_type,
            [isTr ? 'Telefon' : 'Phone']: c.phone || '-',
            [isTr ? 'Günlük Bedel' : 'Daily Rate']: c.daily_wage,
            [isTr ? 'Durum' : 'Status']: c.status === 'active' ? (isTr ? 'Aktif' : 'Active') : (isTr ? 'Pasif' : 'Passive'),
            [isTr ? 'İSG Başlangıç' : 'ISG Start Date']: c.isg_start_date || '-',
            [isTr ? 'İSG Bitiş' : 'ISG End Date']: c.isg_expiry_date || '-'
          }));
          const fName = isTr ? 'Taseron_Listesi' : 'Subcontractor_List';
          if (format === 'excel') exportToExcel(dataToExport, fName);
          if (format === 'csv') exportToCSV(dataToExport, fName);
          if (format === 'json') exportToJSON(dataToExport, fName);
          e.target.value = '';
        }} value="">
          <option value="" disabled>{t('subcontractor_import.export_btn', 'Dışa Aktar...')}</option>
          <option value="excel">Excel (.xlsx)</option>
          <option value="csv">CSV (.csv)</option>
          <option value="json">JSON (.json)</option>
        </select>
        <button className="btn btn-primary" onClick={onAdd}>
          {t('subcontractor.add_new', '+ Yeni Taşeron Ekle')}
        </button>
      </div>
    </header>
  );
};

export default SubcontractorHeader;
