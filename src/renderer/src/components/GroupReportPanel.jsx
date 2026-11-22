import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import CustomDatePicker from './ui/CustomDatePicker';
import { logError } from '../utils/logger';
import { apiMessage } from '../utils/apiWrite';
import { exportToExcel, exportToJSON } from '../utils/exportUtils';
import { formatCurrency, toLocalDateString } from '../utils/formatUtils';
import { loadPdf } from '../utils/lazyLibraries';
import { reorderRangeForStart, reorderRangeForEnd } from '../utils/dateRangeUtils';

import { toAsciiFilename, toAsciiText } from '../utils/pdfUtils';
const GroupReportPanel = ({ activeProjectId, viewMode }) => {
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState([]);
  
  const today = new Date();
  const firstDay = toLocalDateString(new Date(today.getFullYear(), today.getMonth(), 1));
  const lastDay = toLocalDateString(new Date(today.getFullYear(), today.getMonth() + 1, 0));
 
  const [startDate, setStartDate] = useState(firstDay);
  const [endDate, setEndDate] = useState(lastDay);
  const [companyName, setCompanyName] = useState('');
  const [companyLogo, setCompanyLogo] = useState('');

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

  // Guards against stale responses overwriting newer report data when the date
  // range or project changes rapidly.
  const requestIdRef = useRef(0);

  const fetchGroupReport = async () => {
    if (!(window.api && window.api.finance)) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = await window.api.finance.groupStatement({ start_date: startDate, end_date: endDate, project_id: activeProjectId });
      if (requestId !== requestIdRef.current) return;
      if (res.success) {
        setReportData(res.groups || []);
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('group_report.error', 'Rapor alınırken hata oluştu:') + ' ' + apiMessage(res), type: 'error' } }));
      }

      const settings = await window.api.db.read('app_settings');
      if (requestId !== requestIdRef.current) return;
      const cName = settings.find(s => s.setting_key === 'company_name')?.setting_value;
      const cLogo = settings.find(s => s.setting_key === 'company_logo')?.setting_value;
      if (cName) setCompanyName(cName);
      if (cLogo) setCompanyLogo(cLogo);
    } catch (err) {
      // The settings read used to sit outside the try block, so a single failed
      // IPC left the panel spinning forever with an unhandled rejection.
      if (requestId !== requestIdRef.current) return;
      logError('Group report fetch failed:', err);
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('group_report.error', 'Rapor alınırken hata oluştu.'), type: 'error' } }));
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  };
 
  useEffect(() => {
    fetchGroupReport();
    // `workers` and `balances` were in this list but are never read by
    // fetchGroupReport: every dashboard refresh (balance load, worker rename)
    // re-ran the backend group statement for nothing.
  }, [startDate, endDate, activeProjectId]);

  // `jspdf` + `jspdf-autotable` are ~610 kB combined and are only needed when
  // a PDF is actually requested, so they load on demand. `generatePDF` itself
  // stays synchronous from the caller's point of view and swallows failures
  // into a toast: a rejected dynamic chunk must never surface as an unhandled
  // rejection (the user would just see the button do nothing).
  const generatePDF = () => {
    buildPdf().catch((err) => {
      logError('Group report PDF failed:', err);
      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: { message: t('export.failed', 'Dışa aktarma başarısız oldu.'), type: 'error' }
      }));
    });
  };

  const buildPdf = async () => {
    const { jsPDF, autoTable } = await loadPdf();
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const getFormatFromBase64 = (base64) => {
      if (!base64) return 'PNG';
      const match = base64.match(/^data:image\/([a-zA-Z+]+);base64,/);
      if (match && match[1]) {
        const ext = match[1].toUpperCase();
        if (ext === 'JPEG' || ext === 'JPG') return 'JPEG';
        if (ext === 'PNG') return 'PNG';
        if (ext === 'WEBP') return 'WEBP';
        return ext;
      }
      return 'PNG';
    };

    
    // Header
    let textStartY = 20;

    if (companyLogo) {
      try {
        doc.addImage(companyLogo, getFormatFromBase64(companyLogo), pageWidth / 2 - 15, 10, 30, 15);
        textStartY = 35;
      } catch (err) {
        logError('Error adding logo to PDF', err);
      }
    }

    doc.setFontSize(22);
    doc.setTextColor(30, 58, 138);
    doc.text(toAsciiText(companyName), pageWidth / 2, textStartY, { align: 'center' });
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text(toAsciiText(t('group_report.title')), pageWidth / 2, textStartY + 10, { align: 'center' });
    doc.setFontSize(10);
    doc.text(
      toAsciiText(
        t('group_report.period_range', {
          start: startDate || t('group_report.all_periods', 'Tümü'),
          end: endDate || t('group_report.all_periods', 'Tümü')
        })
      ),
      14,
      textStartY + 25
    );
    
    // Table
    // Headers come from the active locale; previously they were hardcoded
    // Turkish, so an English/Arabic user still got a Turkish PDF.
    const tableColumn = [
      t('group_report.col_group', 'Grup Adı'),
      t('group_report.col_count', 'Kişi Sayısı'),
      t('group_report.col_earned', 'Bu Dönem Hak Ediş'),
      t('group_report.col_advance', 'Bu Dönem Avans/Ödeme'),
      t('group_report.col_total', 'Genel Toplam Bakiye')
    ];
    const tableRows = [];

    reportData.forEach(g => {
      const rowData = [
        toAsciiText(g.group_name === 'Grupsuz Personeller' ? t('group_report.no_group') : g.group_name),
        `${g.worker_count}`,
        toAsciiText(formatCurrency(g.period_earned, i18n.language)),
        toAsciiText(formatCurrency(g.period_advance, i18n.language)),
        toAsciiText(formatCurrency(g.absolute_balance, i18n.language))
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: textStartY + 35,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [30, 58, 138], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [249, 250, 251] },
    });

    doc.save(`${toAsciiFilename(companyName)}_Grup_Raporu.pdf`);
  };

  const handleExport = (format) => {
    const dataToExport = reportData.map(g => ({
      [t('group_report.col_group', 'Grup Adı')]:
        g.group_name === 'Grupsuz Personeller' ? t('group_report.no_group') : g.group_name,
      [t('group_report.col_count', 'Kişi Sayısı')]: g.worker_count,
      [t('group_report.col_earned', 'Bu Dönem Hak Ediş')]: formatCurrency(g.period_earned, i18n.language),
      [t('group_report.col_advance', 'Bu Dönem Avans/Ödeme')]: formatCurrency(g.period_advance, i18n.language),
      [t('group_report.col_total', 'Genel Toplam Bakiye')]: formatCurrency(g.absolute_balance, i18n.language)
    }));

    if (format === 'excel') exportToExcel(dataToExport, `Grup_Raporu_${startDate}_${endDate}`);
    if (format === 'json') exportToJSON(dataToExport, `Grup_Raporu_${startDate}_${endDate}`);
    if (format === 'pdf') generatePDF();
  };

  if (loading) {
    return (
      <div className="glass-card text-center" style={{ marginBottom: '2rem' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (reportData.length === 0) {
    return null; // Return nothing if no data to show
  }

  return (
    <div className="glass-card" style={{ marginBottom: '2rem', padding: viewMode === 'list' ? '1.25rem 0.5rem' : '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <h3 className="card-title" style={{ marginBottom: 0 }}>{t('group_report.title')}</h3>
        <select className="btn" style={{ padding: '0.5rem', height: '38px' }} onChange={e => {
            if(e.target.value) handleExport(e.target.value);
            e.target.value = '';
          }} value="">
          <option value="" disabled>{t('group_report.export')}</option>
          <option value="pdf">PDF (.pdf)</option>
          <option value="excel">Excel (.xlsx)</option>
          <option value="json">JSON (.json)</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', padding: viewMode === 'list' ? '0 0.15rem' : '0' }}>
        <div style={{ flex: '1 1 150px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.35rem', paddingLeft: '0.75rem' }}>{t('group_report.start_date')}</label>
          <CustomDatePicker className="form-input" style={{ padding: '0.25rem 0.5rem' }} value={startDate} onChange={e => handleStartDateChange(e.target.value)} />
        </div>
        <div style={{ flex: '1 1 150px' }}>
          <label className="form-label" style={{ fontSize: '0.8rem', marginBottom: '0.35rem', paddingLeft: '0.75rem' }}>{t('group_report.end_date')}</label>
          <CustomDatePicker className="form-input" style={{ padding: '0.25rem 0.5rem' }} value={endDate} onChange={e => handleEndDateChange(e.target.value)} />
        </div>
      </div>

      {viewMode === 'list' ? (
        <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
          <table className="fin-table" style={{ width: '100%', fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th style={{ width: '25%', textAlign: 'left', padding: '0.5rem 0.15rem', fontSize: '0.8rem' }}>{t('settings.group_name_label', 'Grup Adı')}</th>
                <th style={{ width: '10%', textAlign: 'left', padding: '0.5rem 0.15rem', fontSize: '0.8rem' }}>{t('group_report.person_count', 'Kişi')}</th>
                <th style={{ width: '22%', textAlign: 'right', padding: '0.5rem 0.15rem', fontSize: '0.8rem' }}>{t('group_report.earned', 'Hak Ediş')}</th>
                <th style={{ width: '21%', textAlign: 'right', padding: '0.5rem 0.15rem', fontSize: '0.8rem' }}>{t('group_report.advance', 'Avans')}</th>
                <th style={{ width: '22%', textAlign: 'right', padding: '0.5rem 0.15rem', fontSize: '0.8rem' }}>{t('dashboard.net_balance', 'Bakiye')}</th>
              </tr>
            </thead>
            <tbody>
              {reportData.map(group => {
                const isPositive = group.absolute_balance >= 0;
                return (
                  <tr key={group.group_id}>
                    <td style={{ fontWeight: '600', textAlign: 'left', padding: '0.6rem 0.15rem', whiteSpace: 'nowrap' }}>
                      {group.group_name === 'Grupsuz Personeller' ? t('group_report.no_group') : group.group_name}
                    </td>
                    <td style={{ textAlign: 'left', padding: '0.6rem 0.15rem 0.6rem 0.35rem', whiteSpace: 'nowrap' }}>
                      <span style={{ fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '0.15rem 0.4rem', borderRadius: '12px' }}>
                        {group.worker_count}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', color: '#34d399', fontWeight: 'bold', padding: '0.6rem 0.15rem', whiteSpace: 'nowrap' }}>
                      +{formatCurrency(group.period_earned, i18n.language)}
                    </td>
                    <td style={{ textAlign: 'right', color: '#ef4444', fontWeight: 'bold', padding: '0.6rem 0.15rem', whiteSpace: 'nowrap' }}>
                      -{formatCurrency(group.period_advance, i18n.language)}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 'bold', color: isPositive ? '#34d399' : '#ef4444', padding: '0.6rem 0.15rem', whiteSpace: 'nowrap' }}>
                      {formatCurrency(group.absolute_balance, i18n.language)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {reportData.map(group => {
            return (
              <div key={group.group_id} style={{ 
                background: 'rgba(255,255,255,0.02)', 
                border: '1px solid var(--glass-border)', 
                borderRadius: '8px', 
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
                  <h4 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.1rem' }}>{group.group_name === 'Grupsuz Personeller' ? t('group_report.no_group') : group.group_name}</h4>
                  <span style={{ fontSize: '0.8rem', background: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8', padding: '0.2rem 0.6rem', borderRadius: '12px' }}>
                    {group.worker_count} {t('group_report.person_count')}
                  </span>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ flex: 1, borderRight: '1px solid rgba(255,255,255,0.05)', paddingRight: '1rem' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('group_report.period')}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                      <span>{t('group_report.earned')}</span>
                      <span style={{ color: '#34d399' }}>+{formatCurrency(group.period_earned, i18n.language)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      <span>{t('group_report.advance')}</span>
                      <span style={{ color: '#ef4444' }}>-{formatCurrency(group.period_advance, i18n.language)}</span>
                    </div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('group_report.total_balance')}</div>
                    <div style={{ 
                      fontSize: '1.4rem', 
                      fontWeight: 'bold', 
                      color: group.absolute_balance >= 0 ? '#34d399' : '#ef4444' 
                    }}>
                      {formatCurrency(group.absolute_balance, i18n.language)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default GroupReportPanel;
