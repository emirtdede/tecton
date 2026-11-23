import React, { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { exportToExcel, exportToCSV, exportToJSON } from '../utils/exportUtils';
import { formatCurrency, formatDate, formatCurrencySafe } from '../utils/formatUtils';

const SubcontractorStatement = ({ t, i18n, subcontractor, transactions, filterStartDate, filterEndDate, companyName, companyLogo, projectName }) => {
  const [reportFilterText, setReportFilterText] = useState('');
  const [reportFilterType, setReportFilterType] = useState('Tümü'); // 'Tümü' | 'Hakediş' | 'Ödeme'

  // Hesaplamalar (Rapor İçin)
  let reportDevreden = 0;
  let reportDonemHakedis = 0;
  let reportDonemOdeme = 0;
  let reportYeniBakiye = 0;

  const reportTransactions = transactions.filter(t => {
    // Devreden Bakiye
    if (filterStartDate && new Date(t.trans_date) < new Date(filterStartDate)) {
      if (t.type === 'Hakediş') reportDevreden += t.amount;
      else if (t.type === 'Ödeme') reportDevreden -= t.amount;
      return false;
    }

    // Bitiş tarihi sonrası
    if (filterEndDate && new Date(t.trans_date) > new Date(filterEndDate)) {
      return false;
    }

    // Dönem içi
    if (t.type === 'Hakediş') reportDonemHakedis += t.amount;
    else if (t.type === 'Ödeme') reportDonemOdeme += t.amount;

    return true;
  }).filter(t => {
    if (reportFilterType !== 'Tümü' && t.type !== reportFilterType) return false;
    if (reportFilterText) {
      const matchText = (t.description || '').toLowerCase().includes(reportFilterText.toLowerCase());
      if (!matchText) return false;
    }
    return true;
  }).sort((a, b) => new Date(b.trans_date) - new Date(a.trans_date));

  reportYeniBakiye = reportDevreden + reportDonemHakedis - reportDonemOdeme;

  const handleWhatsAppSend = () => {
    if (!subcontractor || !subcontractor.phone) {
      window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('subcontractor_profile.whatsapp_no_phone', 'Taşeronun kayıtlı telefon numarası bulunamadı.'), type: 'warning' } }));
      return;
    }

    let cleanPhone = subcontractor.phone.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = '90' + cleanPhone;
    else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) cleanPhone = '90' + cleanPhone.substring(1);

    const formattedEarned = formatCurrency(reportDonemHakedis, i18n.language);
    const formattedPaid = formatCurrency(reportDonemOdeme, i18n.language);
    const formattedBalance = formatCurrency(reportYeniBakiye, i18n.language);

    const messageTemplate = t('subcontractor_profile.whatsapp_message_template',
      'Sayın {{name}}, {{startDate}} - {{endDate}} tarihleri arasındaki hesap ekstreniz:\n\n- Toplam Hak Ediş: {{earned}}\n- Toplam Ödeme: {{paid}}\n- Kalan Bakiye: {{balance}}\n\nBilgilerinize sunarız.'
    );

    const message = messageTemplate
      .replace('{{name}}', subcontractor.name)
      .replace('{{startDate}}', filterStartDate || '')
      .replace('{{endDate}}', filterEndDate || '')
      .replace('{{earned}}', formattedEarned)
      .replace('{{paid}}', formattedPaid)
      .replace('{{balance}}', formattedBalance);

    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleExport = (format) => {
    const exportData = reportTransactions.map(tr => ({
      [t('global.date', 'Tarih')]: formatDate(tr.trans_date, i18n.language),
      [t('global.actionType', 'İşlem Türü')]: tr.type === 'Hakediş' ? t('subcontractor_profile.earned_badge', 'Hakediş') : t('subcontractor_profile.payment_badge', 'Ödeme'),
      [t('global.description', 'Açıklama')]: tr.description || '-',
      [t('global.amount', 'Tutar')]: formatCurrencySafe(tr.amount, i18n.language)
    }));

    exportData.push({
      [t('global.date', 'Tarih')]: '',
      [t('global.actionType', 'İşlem Türü')]: '',
      [t('global.description', 'Açıklama')]: t('subcontractor_profile.new_balance', 'Yeni Bakiye') + ':',
      [t('global.amount', 'Tutar')]: formatCurrencySafe(reportYeniBakiye, i18n.language)
    });

    const fileName = `${subcontractor.name.replace(/\s+/g, '_')}_Cari_Ekstre`;

    if (format === 'excel') exportToExcel(exportData, fileName);
    else if (format === 'csv') exportToCSV(exportData, fileName);
    else if (format === 'json') exportToJSON(exportData, fileName);
  };

  const generatePDF = async () => {
    const reportDateStr = new Date().toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US') + ' ' + new Date().toLocaleTimeString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

    // Group items into chunks of 15 items per page to prevent text/row cut-off
    const pdfItemsPerPage = 15;
    const chunks = [];
    const transactionsList = reportTransactions || [];
    for (let i = 0; i < transactionsList.length; i += pdfItemsPerPage) {
      chunks.push(transactionsList.slice(i, i + pdfItemsPerPage));
    }

    if (chunks.length === 0) chunks.push([]);

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgWidth = 190;
    const position = 15;

    for (let index = 0; index < chunks.length; index++) {
      const chunk = chunks[index];

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-9999px';
      container.style.top = '0';
      container.style.width = '800px';
      container.style.background = '#ffffff';
      container.style.color = '#1e293b';
      container.style.fontFamily = "'Inter', 'Noto Sans', 'Arial', sans-serif";
      container.style.padding = '40px';

      const isFirstPage = index === 0;
      const isLastPage = index === chunks.length - 1;

      let headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
          <div>
            ${companyLogo && isFirstPage ? `<img src="${companyLogo}" style="max-width: 150px; max-height: 50px; margin-bottom: 10px; display: block;" />` : ''}
            <div style="font-size: 14px; font-weight: bold; color: #334155; font-family: inherit;">${companyName || ''}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: bold; color: #6389b9; margin-bottom: 8px; font-family: inherit;">${t('subcontractor_profile.statementTitle', 'Taşeron Cari Ekstresi').toUpperCase()}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;"><strong>${t('global.filter', 'Filtre')}:</strong> ${projectName ? projectName : t('global.unspecified', 'Belirtilmemiş')}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;"><strong>${t('global.dateRange', 'Tarih Aralığı')}:</strong> ${filterStartDate || 'Tümü'} / ${filterEndDate || 'Tümü'}</div>
            <div style="font-size: 11px; color: #64748b; font-family: inherit;"><strong>${t('global.creationDate', 'Oluşturma Tarihi')}:</strong> ${reportDateStr}</div>
          </div>
        </div>
        <hr style="border: 0; border-top: 1px solid #cbd5e1; margin-bottom: 20px;" />
      `;

      let subInfoHtml = `
        <div style="margin-bottom: 20px; font-family: inherit;">
          <div style="font-size: 14px; font-weight: bold; color: #1e293b; margin-bottom: 6px; font-family: inherit;">${subcontractor.name}</div>
          <div style="font-size: 11px; color: #64748b; display: flex; gap: 15px; flex-wrap: wrap; font-family: inherit;">
            <span><strong>${t('recycle.tableProject', 'Şantiye')}:</strong> ${projectName ? projectName : t('global.unspecified', 'Belirtilmemiş')}</span>
            <span><strong>${t('subcontractor_profile.service_type', 'Hizmet Türü')}:</strong> ${subcontractor.service_type || '-'}</span>
            <span><strong>${t('worker.phone', 'Telefon')}:</strong> ${subcontractor.phone || '-'}</span>
          </div>
        </div>
      `;

      let summaryCardsHtml = '';
      if (isFirstPage) {
        summaryCardsHtml = `
          <div style="display: flex; gap: 10px; margin-bottom: 25px; font-family: inherit;">
            <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;">${t('subcontractor_profile.prev_balance', 'Devreden Bakiye')}</div>
              <div style="font-size: 14px; font-weight: bold; color: #334155; font-family: inherit;">${formatCurrencySafe(reportDevreden, i18n.language)}</div>
            </div>
            <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;">${t('subcontractor_profile.period_earned', 'Dönem Hakedişi')}</div>
              <div style="font-size: 14px; font-weight: bold; color: #16a34a; font-family: inherit;">+${formatCurrencySafe(reportDonemHakedis, i18n.language)}</div>
            </div>
            <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;">${t('subcontractor_profile.period_paid', 'Dönem Ödemesi')}</div>
              <div style="font-size: 14px; font-weight: bold; color: #dc2626; font-family: inherit;">-${formatCurrencySafe(reportDonemOdeme, i18n.language)}</div>
            </div>
            <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;">${t('subcontractor_profile.new_balance', 'Yeni Bakiye')}</div>
              <div style="font-size: 14px; font-weight: bold; color: ${reportYeniBakiye >= 0 ? '#16a34a' : '#dc2626'}; font-family: inherit;">${formatCurrencySafe(reportYeniBakiye, i18n.language)}</div>
            </div>
          </div>
        `;
      }

      let tableRowsHtml = '';
      if (chunk.length === 0) {
        tableRowsHtml = `
          <tr>
            <td colspan="4" style="padding: 20px; text-align: center; color: #64748b; font-family: inherit;">
              ${t('subcontractor_profile.no_records', 'Bu tarih aralığında kayıt bulunamadı.')}
            </td>
          </tr>
        `;
      } else {
        tableRowsHtml = chunk.map(item => {
          const isHakedis = item.type === 'Hakediş';
          const typeText = isHakedis
            ? t('subcontractor_profile.earned_badge', 'Hakediş')
            : t('subcontractor_profile.payment_badge', 'Ödeme');
          const amountSign = isHakedis ? '+' : '-';
          const amountColor = isHakedis ? '#16a34a' : '#dc2626';
          return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${formatDate(item.trans_date, i18n.language)}</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${typeText}</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${item.description || '-'}</td>
              <td style="padding: 8px 10px; text-align: right; border: 1px solid #e2e8f0; font-weight: 500; color: ${amountColor}; font-family: inherit;">${amountSign}${formatCurrencySafe(item.amount, i18n.language)}</td>
            </tr>
          `;
        }).join('');
      }

      let tableHtml = `
        <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #334155; font-family: inherit;">
          <thead>
            <tr style="background: #1e3a8a; color: #ffffff;">
              <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('global.date', 'Tarih')}</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('global.actionType', 'İşlem Türü')}</th>
              <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('global.description', 'Açıklama')}</th>
              <th style="padding: 10px; text-align: right; border: 1px solid #cbd5e1; font-family: inherit;">${t('global.amount', 'Tutar')}</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      `;

      let signatureHtml = '';
      if (isLastPage) {
        signatureHtml = `
          <div style="margin-top: 60px; display: flex; justify-content: space-between; font-family: inherit;">
            <div style="width: 250px; text-align: center; font-family: inherit;">
              <hr style="border: 0; border-top: 1px solid #94a3b8; margin-bottom: 8px;" />
              <div style="font-size: 11px; font-weight: 500; color: #334155; font-family: inherit;">${t('pdf.signatureSubcontractor', 'Taşeron (Kaşe/İmza)')}</div>
            </div>
            <div style="width: 250px; text-align: center; font-family: inherit;">
              <hr style="border: 0; border-top: 1px solid #94a3b8; margin-bottom: 8px;" />
              <div style="font-size: 11px; font-weight: 500; color: #334155; font-family: inherit;">${t('pdf.signatureCompany', 'Firma Yetkilisi (Kaşe/İmza)')}</div>
            </div>
          </div>
        `;
      }

      container.innerHTML = `
        ${headerHtml}
        ${subInfoHtml}
        ${summaryCardsHtml}
        ${tableHtml}
        ${signatureHtml}
      `;

      document.body.appendChild(container);

      await document.fonts.ready;

      const canvas = await html2canvas(container, {
        scale: 2.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      document.body.removeChild(container);

      const imgData = canvas.toDataURL('image/jpeg', 1.0);
      const imgHeight = canvas.height * imgWidth / canvas.width;

      pdf.addImage(imgData, 'JPEG', 10, position, imgWidth, imgHeight);

      if (index < chunks.length - 1) {
        pdf.addPage();
      }
    }

    const trMap = { 'ç':'c', 'ğ':'g', 'ş':'s', 'ö':'o', 'ü':'u', 'ı':'i', 'Ç':'C', 'Ğ':'G', 'Ş':'S', 'Ö':'O', 'Ü':'U', 'İ':'I' };
    const toEn = (str) => {
      if (!str) return '';
      let s = String(str);
      s = s.replace(/[çğşöüıÇĞŞÖÜİ]/g, letter => trMap[letter]);
      s = s.replace(/₺/g, 'TL');
      return s;
    };

    pdf.save(`${toEn(subcontractor.name)}_Cari_Hesap_Ekstresi.pdf`);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.prev_balance', 'Devreden Bakiye')}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{formatCurrencySafe(reportDevreden, i18n.language)}</div>
        </div>
        <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.period_earned', 'Dönem Hakedişi')}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--success-text)' }}>+{formatCurrencySafe(reportDonemHakedis, i18n.language)}</div>
        </div>
        <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.period_paid', 'Dönem Ödemesi')}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--danger-text)' }}>-{formatCurrencySafe(reportDonemOdeme, i18n.language)}</div>
        </div>
        <div style={{ flex: 1, minWidth: '120px', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'center' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('subcontractor_profile.new_balance', 'Yeni Bakiye')}</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: reportYeniBakiye >= 0 ? 'var(--success-text)' : 'var(--danger-text)' }}>{formatCurrencySafe(reportYeniBakiye, i18n.language)}</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-input"
          placeholder={t('subcontractor_profile.search_placeholder', 'Kelime ara...')}
          value={reportFilterText}
          onChange={e => setReportFilterText(e.target.value)}
          style={{ flex: 2, minWidth: '200px' }}
        />
        <select
          className="form-input"
          value={reportFilterType}
          onChange={e => setReportFilterType(e.target.value)}
          style={{ flex: 1, minWidth: '120px' }}
        >
          <option value="Tümü">{t('subcontractor_profile.filter_all', 'Tümü')}</option>
          <option value="Hakediş">{t('subcontractor_profile.filter_earned', 'Hakediş')}</option>
          <option value="Ödeme">{t('subcontractor_profile.filter_paid', 'Ödeme')}</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <select
          className="btn form-input"
          style={{ flex: 1, background: '#1e3a8a', color: '#fff', border: 'none', cursor: 'pointer', padding: '0.5rem', fontWeight: 'bold' }}
          onChange={e => {
            const val = e.target.value;
            if (val === 'pdf') generatePDF();
            else if (val) handleExport(val);
            e.target.value = "";
          }}
          value=""
        >
          <option value="" disabled> {t('worker_profile.filter.export', 'Dışa Aktar / Yazdır...')}</option>
          <option value="pdf">PDF</option>
          <option value="excel">Excel (.xlsx)</option>
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <button onClick={handleWhatsAppSend} className="btn" style={{ flex: 1, background: '#16a34a', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
           {t('subcontractor_profile.whatsapp_share', 'WhatsApp')}
        </button>
      </div>
    </div>
  );
};

export default SubcontractorStatement;
