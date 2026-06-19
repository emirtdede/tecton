import * as XLSX from 'xlsx';

/**
 * Verilen JSON dizisini Excel (.xlsx) formatında dışa aktarır.
 * @param {Array} data Dışa aktarılacak veri dizisi
 * @param {string} filename İndirilecek dosya adı (uzantısız)
 */
export const exportToExcel = (data, filename) => {
  if (!data || !data.length) {
    alert('Dışa aktarılacak veri bulunamadı.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Veri');
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

/**
 * Verilen JSON dizisini CSV (.csv) formatında dışa aktarır.
 * @param {Array} data Dışa aktarılacak veri dizisi
 * @param {string} filename İndirilecek dosya adı (uzantısız)
 */
export const exportToCSV = (data, filename) => {
  if (!data || !data.length) {
    alert('Dışa aktarılacak veri bulunamadı.');
    return;
  }
  const worksheet = XLSX.utils.json_to_sheet(data);
  const csv = XLSX.utils.sheet_to_csv(worksheet);
  
  // Create blob and download (UTF-8 BOM added for Excel compatibility)
  const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Verilen JSON dizisini doğrudan JSON (.json) formatında dışa aktarır.
 * @param {Array} data Dışa aktarılacak veri dizisi
 * @param {string} filename İndirilecek dosya adı (uzantısız)
 */
export const exportToJSON = (data, filename) => {
  if (!data || !data.length) {
    alert('Dışa aktarılacak veri bulunamadı.');
    return;
  }
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToText = (lines, filename) => {
  if (!lines || !lines.length) {
    alert('Dışa aktarılacak veri bulunamadı.');
    return;
  }
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.txt`;
  link.click();
};

export const exportToMarkdown = (lines, filename) => {
  if (!lines || !lines.length) {
    alert('Dışa aktarılacak veri bulunamadı.');
    return;
  }
  const content = `# ${filename}\n\n` + lines.map(l => `- ${l}`).join('\n');
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.md`;
  link.click();
};

export const generateExcelTemplate = (t, lang) => {
  const isTr = lang === 'tr';
  const headers = [
    isTr ? t('about.col_name') : 'Full Name',
    isTr ? t('about.col_tc') : 'TC Identity No',
    isTr ? t('about.col_phone') : 'Phone',
    isTr ? t('about.col_wage') : 'Daily Wage',
    isTr ? t('about.col_start_date') : 'Start Date',
    isTr ? t('about.col_group') : 'Group',
    isTr ? t('about.col_status') : 'Status (Active/Passive)',
    isTr ? t('about.col_tags') : 'Tags',
    isTr ? 'İSG Başlangıç' : 'ISG Start Date',
    isTr ? 'İSG Bitiş' : 'ISG End Date'
  ];
  
  const tips = [
    isTr ? t('about.tip_name') : '(Required) Enter First and Last Name',
    isTr ? t('about.tip_tc') : '(Optional) Enter valid 11-Digit TC',
    isTr ? t('about.tip_phone') : '(Optional) Enter phone number',
    isTr ? t('about.tip_wage') : '(Optional) Enter numerical value',
    isTr ? t('about.tip_start_date') : '(Optional) Enter date in YYYY-MM-DD format',
    isTr ? t('about.tip_group') : '(Optional) Enter group name',
    isTr ? t('about.tip_status') : '(Optional) Enter Active or Passive',
    isTr ? t('about.tip_tags') : '(Optional) Enter tags separated by commas',
    isTr ? '(Opsiyonel) YYYY-MM-DD formatında' : '(Optional) Enter date in YYYY-MM-DD format',
    isTr ? '(Opsiyonel) YYYY-MM-DD formatında' : '(Optional) Enter date in YYYY-MM-DD format'
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, tips]);
  const workbook = XLSX.utils.book_new();
  const sheetName = isTr ? 'Personel Taslak' : 'Personnel Template';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const fileName = isTr ? 'Personel_İçe_Aktarma_Taslağı.xlsx' : 'Personnel_Import_Template.xlsx';
  XLSX.writeFile(workbook, fileName);
};

export const generateSubcontractorTemplate = (t, lang) => {
  const isTr = lang === 'tr';
  const headers = [
    isTr ? 'Taşeron Adı' : 'Subcontractor Name',
    isTr ? 'Hizmet Alanı' : 'Service Type',
    isTr ? 'Telefon' : 'Phone',
    isTr ? 'Günlük Bedel' : 'Daily Rate',
    isTr ? 'Durum' : 'Status',
    isTr ? 'İSG Başlangıç' : 'ISG Start Date',
    isTr ? 'İSG Bitiş' : 'ISG End Date'
  ];

  const tips = [
    isTr ? '(Zorunlu) Taşeron adı veya ünvanı' : '(Required) Enter subcontractor name',
    isTr ? '(Zorunlu) Hizmet alanı giriniz' : '(Required) Enter service type',
    isTr ? '(Opsiyonel) Telefon numarası' : '(Optional) Enter phone number',
    isTr ? '(Zorunlu) Sayısal değer giriniz' : '(Required) Enter numerical value',
    isTr ? '(Opsiyonel) Aktif veya Pasif' : '(Optional) Enter Active or Passive',
    isTr ? '(Opsiyonel) YYYY-MM-DD formatında' : '(Optional) Enter date in YYYY-MM-DD format',
    isTr ? '(Opsiyonel) YYYY-MM-DD formatında' : '(Optional) Enter date in YYYY-MM-DD format'
  ];

  const worksheet = XLSX.utils.aoa_to_sheet([headers, tips]);
  const workbook = XLSX.utils.book_new();
  const sheetName = isTr ? 'Taşeron Taslak' : 'Subcontractor Template';
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  const fileName = isTr ? 'Taseron_İçe_Aktarma_Taslağı.xlsx' : 'Subcontractor_Import_Template.xlsx';
  XLSX.writeFile(workbook, fileName);
};
