import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { formatCurrencySafe } from '../utils/formatUtils';

export async function generateCashPdf({ t, i18n, filterProject, filterStartDate, filterEndDate, filteredTransactions, projNetBalance, companyName, companyLogo, getProjectName }) {
  const projFilterText = filterProject === 'all'
    ? t('cash.allCompany')
    : filterProject === 'merkez'
      ? t('cash.headquarters')
      : getProjectName(Number(filterProject));

  const reportDateStr = new Date().toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US') + ' ' + new Date().toLocaleTimeString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  // Group items into chunks of 18 items per page to prevent text/row cut-off
  const pdfItemsPerPage = 18;
  const chunks = [];
  for (let i = 0; i < filteredTransactions.length; i += pdfItemsPerPage) {
    chunks.push(filteredTransactions.slice(i, i + pdfItemsPerPage));
  }

  if (chunks.length === 0) {
    chunks.push([]);
  }

  const pdf = new jsPDF('p', 'mm', 'a4');
  const imgWidth = 190;
  const position = 15;

  for (let index = 0; index < chunks.length; index++) {
    const chunk = chunks[index];

    // Create a temporary container styled as a clean A4 sheet
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '800px';
    container.style.background = '#ffffff';
    container.style.color = '#1e293b';
    container.style.fontFamily = "'Inter', 'Noto Sans', 'Arial', sans-serif";
    container.style.padding = '40px';

    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div>
          ${companyLogo ? `<img src="${companyLogo}" style="max-width: 150px; max-height: 50px; margin-bottom: 10px; display: block;" />` : ''}
          <div style="font-size: 14px; font-weight: bold; color: #334155; font-family: inherit;">${companyName || ''}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 18px; font-weight: bold; color: #6389b9; margin-bottom: 8px; font-family: inherit;">${t('cash.reportTitle', 'Kasa Hareketleri Raporu').toUpperCase()}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;"><strong>${t('global.filter', 'Filtre')}:</strong> ${projFilterText}</div>
          <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;"><strong>${t('global.dateRange', 'Tarih Aralığı')}:</strong> ${filterStartDate || 'Tümü'} / ${filterEndDate || 'Tümü'}</div>
          <div style="font-size: 11px; color: #64748b; font-family: inherit;"><strong>${t('global.creationDate', 'Oluşturma Tarihi')}:</strong> ${reportDateStr}</div>
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid #cbd5e1; margin-bottom: 20px;" />

      <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 15px; margin-bottom: 25px; display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 13px; color: #64748b; font-weight: 500; font-family: inherit;">${t('cash.netBalance', 'Net Kasa Bakiyesi')}:</span>
        <span style="font-size: 18px; font-weight: bold; color: ${projNetBalance >= 0 ? '#16a34a' : '#dc2626'}; font-family: inherit;">
          ${formatCurrencySafe(projNetBalance, i18n.language)}
        </span>
      </div>

      <table style="width: 100%; border-collapse: collapse; font-size: 12px; color: #334155; font-family: inherit;">
        <thead>
          <tr style="background: #1e3a8a; color: #ffffff;">
            <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('cash.table.date', 'Tarih')}</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('cash.table.type', 'İşlem Türü')}</th>
            <th style="padding: 10px; text-align: right; border: 1px solid #cbd5e1; font-family: inherit;">${t('cash.table.amount', 'Tutar')}</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('pdf_project_site', 'Project / Site')}</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #cbd5e1; font-family: inherit;">${t('cash.table.desc', 'Açıklama')}</th>
          </tr>
        </thead>
        <tbody>
          ${chunk.length === 0 ? `
            <tr>
              <td colspan="5" style="padding: 20px; text-align: center; color: #64748b; font-family: inherit;">
                ${t('cash.table.empty', 'Kasa işlemi bulunamadı.')}
              </td>
            </tr>
          ` : chunk.map(t_row => {
            const typeText = t_row.type === 'Nakit Girişi'
              ? t('cash.income', 'Nakit Girişi')
              : t('cash.expense', 'Nakit Çıkışı');
            return `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${t_row.trans_date}</td>
                <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${typeText}</td>
                <td style="padding: 8px 10px; text-align: right; border: 1px solid #e2e8f0; font-weight: 500; font-family: inherit;">${formatCurrencySafe(t_row.amount, i18n.language)}</td>
                <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${getProjectName(t_row.project_id)}</td>
                <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${t_row.description || '-'}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    document.body.appendChild(container);

    // Wait for fonts to load
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

  pdf.save(`${toEn(companyName || 'Kasa')}_Raporu.pdf`);
}
