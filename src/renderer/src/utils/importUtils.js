import * as XLSX from 'xlsx';
import { isValidTCKN } from './validation.js';

/**
 * Excel dosyasını okur ve JSON olarak döndürür
 * Beklenen Sütunlar: Ad Soyad, TC Kimlik No, Telefon, Günlük Yevmiye (TL)
 */
export const readWorkersFromExcel = (file, t) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        
        // İlk sayfayı al
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // JSON'a çevir
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        
        const parsedWorkers = [];
        const errors = [];

        json.forEach((row, index) => {
          // Normalize keys (handle spaces and case)
          const normalizedRow = {};
          for (let key in row) {
            normalizedRow[key.trim().toLowerCase()] = row[key];
          }

          // Ad Soyad (Zorunlu)
          const fullName = normalizedRow[String(t('about.col_name')).toLowerCase()] || 
                           normalizedRow['ad soyad'] || 
                           normalizedRow['full name'] || 
                           normalizedRow['ad'] || 
                           normalizedRow['isim'] || '';
          if (!fullName) {
            errors.push(t('about.err_name_empty').replace('{line}', index + 2));
            return;
          }

          // TC No (Opsiyonel ama varsa geçerli olmalı)
          const tcNo = String(
            normalizedRow[String(t('about.col_tc')).toLowerCase()] || 
            normalizedRow['tc kimlik no'] || 
            normalizedRow['tc kimlik no (11 haneli - opsiyonel)'] || 
            normalizedRow['national id number (11 digits - optional)'] || 
            normalizedRow['tc no'] || 
            normalizedRow['tc'] || ''
          ).trim();
          if (tcNo && !isValidTCKN(tcNo)) {
            errors.push(t('about.err_tc_invalid').replace('{line}', index + 2).replace('{tc}', tcNo));
            return;
          }

          // Telefon
          const phone = String(
            normalizedRow[String(t('about.col_phone')).toLowerCase()] || 
            normalizedRow['telefon'] || 
            normalizedRow['telefon (opsiyonel)'] || 
            normalizedRow['phone (optional)'] || 
            normalizedRow['phone'] || 
            normalizedRow['tel'] || ''
          ).trim();

          // Günlük Yevmiye
          const rawWage = normalizedRow[String(t('about.col_wage')).toLowerCase()] || 
                          normalizedRow['günlük yevmiye (tl)'] || 
                          normalizedRow['daily wage (tl)'] || 
                          normalizedRow['günlük yevmiye'] || 
                          normalizedRow['yevmiye'] || 
                          normalizedRow['wage'] || '';
          let dailyWage = 0;
          if (rawWage) {
            const num = Number(String(rawWage).replace(',', '.'));
            if (!isNaN(num)) dailyWage = num;
          }

          // İşe Başlama Tarihi
          const rawDate = normalizedRow[String(t('about.col_start_date')).toLowerCase()] || 
                          normalizedRow['işe başlama tarihi (yyyy-mm-dd)'] || 
                          normalizedRow['start date (yyyy-mm-dd)'] || 
                          normalizedRow['işe başlama tarihi'] || 
                          normalizedRow['işe başlama'] || 
                          normalizedRow['başlama tarihi'] || 
                          normalizedRow['start date'] || '';
          let startDate = new Date().toISOString().split('T')[0]; // default to today
          if (rawDate) {
            if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
              const y = rawDate.getFullYear();
              const m = String(rawDate.getMonth() + 1).padStart(2, '0');
              const d = String(rawDate.getDate()).padStart(2, '0');
              startDate = `${y}-${m}-${d}`;
            } else {
              const dateStr = String(rawDate).trim();
              if (dateStr) {
                const serialNum = Number(dateStr);
                if (!isNaN(serialNum) && serialNum > 10000) {
                  // Excel serial number format
                  const utc_days = Math.floor(serialNum - 25569);
                  const utc_value = utc_days * 86400;
                  const dateInfo = new Date(utc_value * 1000);
                  startDate = dateInfo.toISOString().split('T')[0];
                } else {
                  // Handle DD.MM.YYYY, DD-MM-YYYY, YYYY-MM-DD, YYYY-DD-MM, MM-DD-YYYY
                  const parts = dateStr.split(/[-./]/);
                  if (parts.length === 3) {
                    if (parts[0].length === 4) {
                      // YYYY and two parts: parts[1], parts[2]
                      const year = parts[0];
                      let p1 = parseInt(parts[1], 10);
                      let p2 = parseInt(parts[2], 10);
                      if (!isNaN(p1) && !isNaN(p2)) {
                        if (p1 > 12) {
                          // YYYY-DD-MM format
                          startDate = `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
                        } else {
                          // YYYY-MM-DD format
                          startDate = `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
                        }
                      }
                    } else if (parts[2].length === 4) {
                      // Two parts and YYYY: parts[0], parts[1]
                      const year = parts[2];
                      let p1 = parseInt(parts[0], 10);
                      let p2 = parseInt(parts[1], 10);
                      if (!isNaN(p1) && !isNaN(p2)) {
                        if (p2 > 12) {
                          // MM-DD-YYYY format
                          startDate = `${year}-${String(p1).padStart(2, '0')}-${String(p2).padStart(2, '0')}`;
                        } else {
                          // DD-MM-YYYY format
                          startDate = `${year}-${String(p2).padStart(2, '0')}-${String(p1).padStart(2, '0')}`;
                        }
                      }
                    }
                  }
                }
              }
            }
          }

          // Bağlı Olduğu Grup
          const groupName = String(normalizedRow[String(t('about.col_group')).toLowerCase()] || normalizedRow['bağlı olduğu grup'] || normalizedRow['grup'] || normalizedRow['group'] || '').trim();

          // Durum (aktif/pasif)
          const rawStatus = String(
            normalizedRow[String(t('about.col_status')).toLowerCase()] || 
            normalizedRow['durum (aktif/pasif)'] || 
            normalizedRow['status (active/passive)'] || 
            normalizedRow['durum'] || 
            normalizedRow['status'] || ''
          ).trim().toLowerCase();
          let statusValue = 'active';
          if (rawStatus === 'pasif' || rawStatus === 'passive' || rawStatus === 'inactive' || rawStatus === '0') {
            statusValue = 'passive';
          }

          // Etiketler
          const rawTags = String(
            normalizedRow[String(t('about.col_tags')).toLowerCase()] || 
            normalizedRow['etiketler (virgülle ayırın, opsiyonel)'] || 
            normalizedRow['tags (comma separated, optional)'] || 
            normalizedRow['etiketler'] || 
            normalizedRow['etiket'] || 
            normalizedRow['tags'] || ''
          ).trim();
          let tagsArray = [];
          if (rawTags) {
            tagsArray = rawTags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
          }

          parsedWorkers.push({
            full_name: fullName.trim(),
            tc_no: tcNo,
            phone: phone,
            daily_wage: dailyWage,
            group_name: groupName || null,
            start_date: startDate,
            status: statusValue,
            tags: JSON.stringify(tagsArray),
            isg_start_date: parseFlexDate(normalizedRow, ['isg başlangıç (yyyy-mm-dd)', 'ohs start date (yyyy-mm-dd)', 'isg başlangıç', 'isg start date', 'isg start', 'isg başlangıc'], null),
            isg_bitis_tarihi: parseFlexDate(normalizedRow, ['isg bitiş (yyyy-mm-dd)', 'ohs end date (yyyy-mm-dd)', 'isg bitiş', 'isg end date', 'isg end', 'isg bitis', 'isg_bitis_tarihi'], null)
          });
        });

        if (errors.length > 0) {
          reject({ success: false, message: t('about.err_excel_errors') + '\n' + errors.join('\n') });
        } else {
          resolve({ success: true, data: parsedWorkers });
        }

      } catch (err) {
        reject({ success: false, message: t('about.err_excel_read').replace('{err}', err.message) });
      }
    };

    reader.onerror = () => {
      reject({ success: false, message: t('about.err_file_read') });
    };

    reader.readAsArrayBuffer(file);
  });
};

/**
 * Helper: parse a date from a normalized row using multiple possible column names.
 */
function parseFlexDate(normalizedRow, possibleKeys, fallback) {
  let rawDate = null;
  for (const key of possibleKeys) {
    if (normalizedRow[key] !== undefined && normalizedRow[key] !== '') {
      rawDate = normalizedRow[key];
      break;
    }
  }
  if (!rawDate) return fallback;
  if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
    const y = rawDate.getFullYear();
    const m = String(rawDate.getMonth() + 1).padStart(2, '0');
    const d = String(rawDate.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const dateStr = String(rawDate).trim();
  if (!dateStr) return fallback;
  const serialNum = Number(dateStr);
  if (!isNaN(serialNum) && serialNum > 10000) {
    const utc_days = Math.floor(serialNum - 25569);
    const utc_value = utc_days * 86400;
    const dateInfo = new Date(utc_value * 1000);
    return dateInfo.toISOString().split('T')[0];
  }
  const parts = dateStr.split(/[-./]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }
  return fallback;
}

/**
 * Taşeron Excel dosyasını okur ve JSON olarak döndürür.
 * TR ise Türkçe sütun başlıkları, diğer diller İngilizce fallback.
 */
export const readSubcontractorsFromExcel = (file, t, lang) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const parsed = [];
        const errors = [];
        const isTr = lang === 'tr';

        json.forEach((row, index) => {
          const normalizedRow = {};
          for (let key in row) {
            normalizedRow[key.trim().toLowerCase()] = row[key];
          }

          // Name (Required)
          const name = normalizedRow[isTr ? 'taşeron adı' : 'subcontractor name'] || normalizedRow['taşeron adı'] || normalizedRow['subcontractor name'] || normalizedRow['ad'] || normalizedRow['name'] || '';
          if (!name) {
            errors.push(`Satır ${index + 2}: ${isTr ? 'Taşeron adı boş olamaz.' : 'Subcontractor name cannot be empty.'}`);
            return;
          }

          // Service Type (Required)
          const service_type = normalizedRow[isTr ? 'hizmet alanı' : 'service type'] || normalizedRow['hizmet alanı'] || normalizedRow['service type'] || normalizedRow['hizmet'] || '';
          if (!service_type) {
            errors.push(`Satır ${index + 2}: ${isTr ? 'Hizmet alanı boş olamaz.' : 'Service type cannot be empty.'}`);
            return;
          }

          // Phone
          const phone = String(normalizedRow[isTr ? 'telefon' : 'phone'] || normalizedRow['telefon'] || normalizedRow['phone'] || normalizedRow['tel'] || '').trim();

          // Daily Rate (Required)
          const rawWage = normalizedRow[isTr ? 'günlük bedel' : 'daily rate'] || normalizedRow['günlük bedel'] || normalizedRow['daily rate'] || normalizedRow['wage'] || normalizedRow['bedel'] || '';
          let daily_wage = 0;
          if (rawWage) {
            const num = Number(String(rawWage).replace(',', '.'));
            if (!isNaN(num)) daily_wage = num;
          }

          // Status
          const rawStatus = String(normalizedRow[isTr ? 'durum' : 'status'] || normalizedRow['durum'] || normalizedRow['status'] || '').trim().toLowerCase();
          let status = 'active';
          if (rawStatus === 'pasif' || rawStatus === 'passive' || rawStatus === 'inactive' || rawStatus === '0') {
            status = 'passive';
          }

           // ISG Dates
          const isg_start_date = parseFlexDate(normalizedRow, ['isg başlangıç', 'isg start date', 'isg start', 'isg başlangıc'], null);
          const isg_expiry_date = parseFlexDate(normalizedRow, ['isg bitiş', 'isg end date', 'isg end', 'isg bitis'], null);

          // Etiketler
          const rawTags = String(normalizedRow['etiketler'] || normalizedRow['etiket'] || normalizedRow['tags'] || '').trim();
          let tagsArray = [];
          if (rawTags) {
            tagsArray = rawTags.split(',').map(tag => tag.trim()).filter(tag => tag !== '');
          }

          parsed.push({
            name: name.trim(),
            service_type: service_type.trim(),
            phone,
            daily_wage,
            status,
            tags: JSON.stringify(tagsArray),
            isg_start_date,
            isg_expiry_date
          });
        });

        if (errors.length > 0) {
          reject({ success: false, message: errors.join('\n') });
        } else {
          resolve({ success: true, data: parsed });
        }

      } catch (err) {
        reject({ success: false, message: err.message });
      }
    };

    reader.onerror = () => {
      reject({ success: false, message: 'File read error.' });
    };

    reader.readAsArrayBuffer(file);
  });
};
