import i18n from '../i18n';
import { rowsToCsv } from './csvEscape';
import { loadXlsx } from './lazyLibraries';

/**
 * Shows a non-blocking toast through the app's global toast channel instead of
 * a blocking window.alert().
 */
const notify = (message, type = 'error') => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
  }
};

/**
 * Triggers a browser download for a Blob and always releases the object URL
 * (prevents a memory leak from accumulating blob URLs).
 */
const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Reports a failed export instead of leaving a rejected promise unhandled.
 * A lazy chunk can fail to load (offline / corrupted cache), and the user would
 * otherwise click "Excel" and see nothing happen at all.
 */
const notifyExportFailure = () => {
  notify(i18n.t('export.failed', 'Dışa aktarma başarısız oldu.'));
};

const notifyNoData = () => {
  notify(i18n.t('export.no_data', 'Dışa aktarılacak veri bulunamadı.'));
};

/**
 * Verilen JSON dizisini Excel (.xlsx) formatında dışa aktarır.
 *
 * `xlsx` is loaded on demand: it is ~415 kB and most sessions never export a
 * spreadsheet, so it must not sit in the initial bundle.
 *
 * @param {Array} data Dışa aktarılacak veri dizisi
 * @param {string} filename İndirilecek dosya adı (uzantısız)
 * @returns {Promise<void>}
 */
export const exportToExcel = async (data, filename) => {
  if (!data || !data.length) {
    notifyNoData();
    return;
  }
  try {
    const XLSX = await loadXlsx();
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, i18n.t('export.sheet_data', 'Veri'));
    XLSX.writeFile(workbook, `${filename}.xlsx`);
  } catch {
    notifyExportFailure();
  }
};

/**
 * Verilen JSON dizisini CSV (.csv) formatında dışa aktarır.
 *
 * CSV used to be produced by routing the rows through `xlsx`
 * (`json_to_sheet` + `sheet_to_csv`), which pulled a spreadsheet library into
 * the initial bundle just to join strings. `rowsToCsv` does it directly.
 *
 * @param {Array} data Dışa aktarılacak veri dizisi
 * @param {string} filename İndirilecek dosya adı (uzantısız)
 */
export const exportToCSV = (data, filename) => {
  if (!data || !data.length) {
    notifyNoData();
    return;
  }
  const csv = rowsToCsv(data);
  if (!csv) {
    notifyNoData();
    return;
  }

  // UTF-8 BOM added for Excel compatibility
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
};

/**
 * Verilen JSON dizisini doğrudan JSON (.json) formatında dışa aktarır.
 * @param {Array} data Dışa aktarılacak veri dizisi
 * @param {string} filename İndirilecek dosya adı (uzantısız)
 */
export const exportToJSON = (data, filename) => {
  if (!data || !data.length) {
    notifyNoData();
    return;
  }
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
};

export const exportToText = (lines, filename) => {
  if (!lines || !lines.length) {
    notifyNoData();
    return;
  }
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `${filename}.txt`);
};

export const exportToMarkdown = (lines, filename) => {
  if (!lines || !lines.length) {
    notifyNoData();
    return;
  }
  const content = `# ${filename}\n\n` + lines.map(l => `- ${l}`).join('\n');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  downloadBlob(blob, `${filename}.md`);
};

export const generateExcelTemplate = async (t, lang) => {
  const isTr = lang === 'tr';
  const headers = isTr ? [
    'Ad Soyad',
    'TC Kimlik No (11 Haneli - Opsiyonel)',
    'Telefon (Opsiyonel)',
    'Günlük Yevmiye (TL)',
    'İşe Başlama Tarihi (YYYY-MM-DD)',
    'Bağlı Olduğu Grup',
    'Durum (Aktif/Pasif)',
    'Etiketler (Virgülle ayırın, Opsiyonel)',
    'İSG Başlangıç (YYYY-MM-DD)',
    'İSG Bitiş (YYYY-MM-DD)'
  ] : [
    'Full Name',
    'National ID Number (11 Digits - Optional)',
    'Phone (Optional)',
    'Daily Wage (TL)',
    'Start Date (YYYY-MM-DD)',
    'Group',
    'Status (Active/Passive)',
    'Tags (Comma separated, Optional)',
    'OHS Start Date (YYYY-MM-DD)',
    'OHS End Date (YYYY-MM-DD)'
  ];

  try {
    const XLSX = await loadXlsx();
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    const sheetName = isTr ? 'Personel Taslak' : 'Personnel Template';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const fileName = isTr ? 'Personel_İçe_Aktarma_Taslağı.xlsx' : 'Personnel_Import_Template.xlsx';
    XLSX.writeFile(workbook, fileName);
  } catch {
    notifyExportFailure();
  }
};

export const generateSubcontractorTemplate = async (t, lang) => {
  const isTr = lang === 'tr';
  const headers = [
    isTr ? 'Taşeron Adı' : 'Subcontractor Name',
    isTr ? 'Hizmet Alanı' : 'Service Type',
    isTr ? 'Telefon' : 'Phone',
    isTr ? 'Günlük Bedel' : 'Daily Rate',
    isTr ? 'Durum' : 'Status',
    isTr ? 'Etiketler' : 'Tags',
    isTr ? 'İSG Başlangıç' : 'ISG Start Date',
    isTr ? 'İSG Bitiş' : 'ISG End Date'
  ];

  const tips = [
    isTr ? '(Zorunlu) Taşeron adı veya ünvanı' : '(Required) Enter subcontractor name',
    isTr ? '(Zorunlu) Hizmet alanı giriniz' : '(Required) Enter service type',
    isTr ? '(Opsiyonel) Telefon numarası' : '(Optional) Enter phone number',
    isTr ? '(Zorunlu) Sayısal değer giriniz' : '(Required) Enter numerical value',
    isTr ? '(Opsiyonel) Aktif veya Pasif' : '(Optional) Enter Active or Passive',
    isTr ? '(Opsiyonel) Virgülle ayırarak etiketleri girin' : '(Optional) Enter tags separated by commas',
    isTr ? '(Opsiyonel) YYYY-MM-DD formatında' : '(Optional) Enter date in YYYY-MM-DD format',
    isTr ? '(Opsiyonel) YYYY-MM-DD formatında' : '(Optional) Enter date in YYYY-MM-DD format'
  ];

  try {
    const XLSX = await loadXlsx();
    const worksheet = XLSX.utils.aoa_to_sheet([headers, tips]);
    const workbook = XLSX.utils.book_new();
    const sheetName = isTr ? 'Taşeron Taslak' : 'Subcontractor Template';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    const fileName = isTr ? 'Taseron_İçe_Aktarma_Taslağı.xlsx' : 'Subcontractor_Import_Template.xlsx';
    XLSX.writeFile(workbook, fileName);
  } catch {
    notifyExportFailure();
  }
};
