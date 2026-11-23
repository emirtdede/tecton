/**
 * Main-process localisation for native OS dialogs.
 *
 * The renderer owns i18next, but native dialogs (`dialog.showSaveDialog`,
 * `showOpenDialog`) are rendered by the OS from the main process, so their
 * titles and filter names cannot go through `t()`. They were hardcoded Turkish,
 * meaning an English/German/Japanese user saw a Turkish file dialog.
 *
 * The handler responses already carry a `messageKey` translated in the
 * renderer; this module covers the strings that never travel through IPC.
 */

const LANGS = ['tr', 'en', 'de', 'fr', 'es', 'ar', 'hi', 'ru', 'pt', 'it', 'nl', 'pl', 'sv', 'no', 'da', 'cs', 'zh', 'ja', 'ko'];

const STRINGS = {
  backup_title: {
    tr: 'Veritabanını Yedekle',
    en: 'Back Up Database',
    de: 'Datenbank sichern',
    fr: 'Sauvegarder la base de données',
    es: 'Copia de seguridad de la base de datos',
    ar: 'نسخ قاعدة البيانات احتياطيًا',
    hi: 'डेटाबेस का बैकअप लें',
    ru: 'Резервное копирование базы данных',
    pt: 'Fazer backup do banco de dados',
    it: 'Esegui backup del database',
    nl: 'Database back-uppen',
    pl: 'Utwórz kopię zapasową bazy danych',
    sv: 'Säkerhetskopiera databasen',
    no: 'Sikkerhetskopier database',
    da: 'Sikkerhedskopier database',
    cs: 'Zálohovat databázi',
    zh: '备份数据库',
    ja: 'データベースをバックアップ',
    ko: '데이터베이스 백업'
  },
  cloud_folder_title: {
    tr: 'Sessiz Bulut Yedekleme Klasörünü Seç',
    en: 'Choose Silent Cloud Backup Folder',
    de: 'Ordner für stille Cloud-Sicherung wählen',
    fr: 'Choisir le dossier de sauvegarde cloud silencieuse',
    es: 'Elegir carpeta de copia en la nube silenciosa',
    ar: 'اختر مجلد النسخ الاحتياطي السحابي الصامت',
    hi: 'साइलेंट क्लाउड बैकअप फ़ोल्डर चुनें',
    ru: 'Выберите папку тихого облачного резервирования',
    pt: 'Escolher pasta de backup silencioso na nuvem',
    it: 'Scegli cartella di backup cloud silenzioso',
    nl: 'Map voor stille cloudback-up kiezen',
    pl: 'Wybierz folder cichej kopii w chmurze',
    sv: 'Välj mapp för tyst molnsäkerhetskopiering',
    no: 'Velg mappe for stille skysikkerhetskopi',
    da: 'Vælg mappe til tavs skybackup',
    cs: 'Vyberte složku tiché cloudové zálohy',
    zh: '选择静默云备份文件夹',
    ja: 'サイレントクラウドバックアップフォルダを選択',
    ko: '자동 클라우드 백업 폴더 선택'
  }
};

const isSupported = (lang) => LANGS.includes(lang);

/**
 * Resolves a main-process dialog string in the user's chosen language.
 *
 * @param {object} db  sqlite wrapper (has `.get`)
 * @param {string} key key in STRINGS
 * @returns {Promise<string>} localised string, Turkish on any failure
 */
async function getDialogString(db, key) {
  const entry = STRINGS[key];
  if (!entry) return key;

  let lang = 'tr';
  try {
    const row = await db.get("SELECT setting_value FROM app_settings WHERE setting_key = 'language'");
    if (row && isSupported(row.setting_value)) lang = row.setting_value;
  } catch {
    // A missing settings table must never break a file dialog.
  }

  return entry[lang] || entry.tr;
}

// Only the resolver is part of the public surface: STRINGS and LANGS are
// module internals, exporting them invited callers to bypass getDialogString.
module.exports = { getDialogString };
