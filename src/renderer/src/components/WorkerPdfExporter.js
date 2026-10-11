import React from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { formatDate, formatCurrencySafe } from '../utils/formatUtils';

void React;
void autoTable;

export async function generateWorkerPdf({ t, i18n, worker, cReport, companyName, companyLogo, projectName, groupName, filterStartDate, filterEndDate }) {
    const reportDateStr = new Date().toLocaleDateString(i18n.language === 'tr' ? 'tr-TR' : 'en-US') + ' ' + new Date().toLocaleTimeString(i18n.language === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' });

    // Group items into chunks of 15 items per page to prevent text/row cut-off
    const pdfItemsPerPage = 15;
    const chunks = [];
    const transactionsList = cReport.islemler || [];
    for (let i = 0; i < transactionsList.length; i += pdfItemsPerPage) {
      chunks.push(transactionsList.slice(i, i + pdfItemsPerPage));
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

      const isFirstPage = index === 0;
      const isLastPage = index === chunks.length - 1;

      // Build top header HTML
      let headerHtml = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
          <div>
            ${companyLogo && isFirstPage ? `<img src="${companyLogo}" style="max-width: 150px; max-height: 50px; margin-bottom: 10px; display: block;" />` : ''}
            <div style="font-size: 14px; font-weight: bold; color: #334155; font-family: inherit;">${companyName || ''}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 18px; font-weight: bold; color: #6389b9; margin-bottom: 8px; font-family: inherit;">${t('worker.statementTitle', 'Cari Hesap Ekstresi').toUpperCase()}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;"><strong>${t('global.filter', 'Filtre')}:</strong> ${projectName ? projectName : t('global.unspecified', 'Belirtilmemiş')}</div>
            <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;"><strong>${t('global.dateRange', 'Tarih Aralığı')}:</strong> ${filterStartDate || 'Tümü'} / ${filterEndDate || 'Tümü'}</div>
            <div style="font-size: 11px; color: #64748b; font-family: inherit;"><strong>${t('global.creationDate', 'Oluşturma Tarihi')}:</strong> ${reportDateStr}</div>
          </div>
        </div>
        <hr style="border: 0; border-top: 1px solid #cbd5e1; margin-bottom: 20px;" />
      `;

      // Build worker info header HTML
      let workerInfoHtml = `
        <div style="margin-bottom: 20px; font-family: inherit;">
          <div style="font-size: 14px; font-weight: bold; color: #1e293b; margin-bottom: 6px; font-family: inherit;">${worker.full_name}</div>
          <div style="font-size: 11px; color: #64748b; display: flex; gap: 15px; flex-wrap: wrap; font-family: inherit;">
            ${worker.tc_no ? `<span><strong>${t('worker.id_tc', 'ID/TC')}:</strong> ${worker.tc_no}</span>` : ''}
            <span><strong>${t('recycle.tableProject', 'Şantiye')}:</strong> ${projectName ? projectName : t('global.unspecified', 'Belirtilmemiş')}</span>
            <span><strong>${t('worker.group', 'Grup')}:</strong> ${groupName ? groupName : t('global.unspecified', 'Belirtilmemiş')}</span>
            <span><strong>${t('worker.phone', 'Telefon')}:</strong> ${worker.phone || '-'}</span>
          </div>
        </div>
      `;

      // Build summary cards HTML (only on the first page)
      let summaryCardsHtml = '';
      if (isFirstPage) {
        summaryCardsHtml = `
          <div style="display: flex; gap: 10px; margin-bottom: 25px; font-family: inherit;">
            <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;">${t('worker.forwardBalance', 'Devreden Bakiye')}</div>
              <div style="font-size: 14px; font-weight: bold; color: #334155; font-family: inherit;">${formatCurrencySafe(cReport.devredenBakiye, i18n.language)}</div>
            </div>
            <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;">${t('worker.periodEarned', 'Dönem Hak Edişi')}</div>
              <div style="font-size: 14px; font-weight: bold; color: #16a34a; font-family: inherit;">+${formatCurrencySafe(cReport.donemHakEdis, i18n.language)}</div>
            </div>
            <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;">${t('worker.periodAdvance', 'Dönem Avansı')}</div>
              <div style="font-size: 14px; font-weight: bold; color: #dc2626; font-family: inherit;">-${formatCurrencySafe(cReport.donemAvans, i18n.language)}</div>
            </div>
            <div style="flex: 1; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; text-align: center;">
              <div style="font-size: 11px; color: #64748b; margin-bottom: 4px; font-family: inherit;">${t('worker.netBalance', 'Net Bakiye')}</div>
              <div style="font-size: 14px; font-weight: bold; color: ${cReport.yeniBakiye >= 0 ? '#16a34a' : '#dc2626'}; font-family: inherit;">${formatCurrencySafe(cReport.yeniBakiye, i18n.language)}</div>
            </div>
          </div>
        `;
      }

      // Build table rows HTML
      let tableRowsHtml = '';
      if (chunk.length === 0) {
        tableRowsHtml = `
          <tr>
            <td colspan="4" style="padding: 20px; text-align: center; color: #64748b; font-family: inherit;">
              ${t('worker_profile.no_period_data', 'Bu dönemde herhangi bir işlem bulunamadı.')}
            </td>
          </tr>
        `;
      } else {
        tableRowsHtml = chunk.map(item => {
            const typeText = item.isIncome
              ? t('worker_profile.filter.type_timesheet', 'Puantaj')
              : t('worker.advanceBadge', 'Avans');
          const amountSign = item.isIncome ? '+' : '-';
          const amountColor = item.isIncome ? '#16a34a' : '#dc2626';
          return `
            <tr style="border-bottom: 1px solid #e2e8f0;">
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${formatDate(item.date, i18n.language)}</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${typeText}</td>
              <td style="padding: 8px 10px; border: 1px solid #e2e8f0; font-family: inherit;">${item.desc || '-'}</td>
              <td style="padding: 8px 10px; text-align: right; border: 1px solid #e2e8f0; font-weight: 500; color: ${amountColor}; font-family: inherit;">${amountSign}${formatCurrencySafe(item.amount, i18n.language)}</td>
            </tr>
          `;
        }).join('');
      }

      // Build table HTML
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

      // Build signature block HTML (only on the last page)
      let signatureHtml = '';
      if (isLastPage) {
        signatureHtml = `
          <div style="margin-top: 60px; display: flex; justify-content: space-between; font-family: inherit;">
            <div style="width: 250px; text-align: center; font-family: inherit;">
              <hr style="border: 0; border-top: 1px solid #94a3b8; margin-bottom: 8px;" />
              <div style="font-size: 11px; font-weight: 500; color: #334155; font-family: inherit;">${t('pdf.signatureWorker', 'Personel (Ad/Soyad - İmza)')}</div>
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
        ${workerInfoHtml}
        ${summaryCardsHtml}
        ${tableHtml}
        ${signatureHtml}
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

    pdf.save(`${toEn(worker.full_name)}_Hesap_Ekstresi.pdf`);
}
