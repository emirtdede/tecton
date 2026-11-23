/**
 * Generates the NSIS language catalogue used by `build/installer.nsh`.
 *
 * The installer must offer 73 languages before the app exists, defaulting to the
 * Windows display language and falling back to English. NSIS only ships wizard
 * translations for a subset of them, so the generated file carries two things:
 *
 *  1. the full 73-entry list, with native names, shown in the drop-down;
 *  2. for each entry the LCID NSIS can actually render, or 1033 (English) when
 *     NSIS has no translation. The chosen language code is still persisted so a
 *     matching in-app dictionary is activated on first run.
 *
 * Run with `npm run installer:langs`. `npm run quality` fails when the generated
 * file drifts from `src/renderer/src/config/languages.js`.
 */

const fs = require('fs');
const path = require('path');
const { langIdToName, lcid } = require('app-builder-lib/out/util/langs.js');

const ROOT = path.join(__dirname, '..');
const CONFIG = path.join(ROOT, 'src/renderer/src/config/languages.js');
const BUILD_DIR = path.join(ROOT, 'build');
const OUTPUT_NSH = path.join(BUILD_DIR, 'installer-languages.nsh');
const OUTPUT_JSON = path.join(BUILD_DIR, 'nsis-languages.json');

const EXPECTED_COUNT = 73;

function readInstallerLanguages() {
  const source = fs.readFileSync(CONFIG, 'utf8');
  const start = source.indexOf('export const INSTALLER_LANGUAGES = [');
  if (start === -1) throw new Error('INSTALLER_LANGUAGES not found in config/languages.js');
  const end = source.indexOf('];', start);
  const body = source.slice(source.indexOf('[', start) + 1, end);
  return new Function(`return [${body}]`)();
}

/**
 * The name electron-builder actually emits for a locale.
 *
 * `LangConfigurator` derives the NSIS language from the locale code, so a
 * locale whose derived name NSIS does not ship (Persian instead of Farsi)
 * cannot be passed in `installerLanguages` at all. Checking the derived name
 * here keeps the generated list in sync with what the packager will do.
 */
function emittedName(region) {
  if (region === 'zh_CN') return 'SimpChinese';
  if (region === 'zh_TW') return 'TradChinese';
  if (region === 'nb_NO') return 'Norwegian';
  if (region === 'pt_BR') return 'PortugueseBR';
  const lang = region.split('_')[0];
  const name = langIdToName[lang];
  if (name == null) return null;
  return name === 'Spanish' ? 'SpanishInternational' : name;
}

// NSIS 3.0.4.1 ships these `.nlf` files. Kept here so the generator does not
// depend on the machine's electron-builder cache.
const NSIS_LANGUAGES = new Set([
  'Afrikaans', 'Albanian', 'Arabic', 'Armenian', 'Asturian', 'Basque', 'Belarusian', 'Bosnian',
  'Breton', 'Bulgarian', 'Catalan', 'Cibemba', 'Corsican', 'Croatian', 'Czech', 'Danish', 'Dutch',
  'Efik', 'English', 'Esperanto', 'Estonian', 'Farsi', 'Finnish', 'French', 'Galician', 'Georgian',
  'German', 'Greek', 'Hebrew', 'Hindi', 'Hungarian', 'Icelandic', 'Igbo', 'Indonesian', 'Irish',
  'Italian', 'Japanese', 'Khmer', 'Korean', 'Kurdish', 'Latvian', 'Lithuanian', 'Luxembourgish',
  'Macedonian', 'Malagasy', 'Malay', 'Mongolian', 'Norwegian', 'NorwegianNynorsk', 'Pashto',
  'Polish', 'Portuguese', 'PortugueseBR', 'Romanian', 'Russian', 'ScotsGaelic', 'Serbian',
  'SerbianLatin', 'SimpChinese', 'Slovak', 'Slovenian', 'Spanish', 'SpanishInternational',
  'Swahili', 'Swedish', 'Tatar', 'Thai', 'TradChinese', 'Turkish', 'Ukrainian', 'Uzbek',
  'Valencian', 'Vietnamese', 'Welsh', 'Yoruba',
]);

// NSIS names whose Windows LCID electron-builder's map spells differently.
const MANUAL = {
  no: { region: 'nb_NO', nsisName: 'Norwegian' },
  fa: { region: 'fa_IR', nsisName: 'Farsi' },
  sl: { region: 'sl_SI', nsisName: 'Slovenian' },
  km: { region: 'km_KH', nsisName: 'Khmer' },
};

// NSIS 3.0.4.1 ships broken translations that fail to compile:
//  - Hindi.nsh line 128: unterminated string in the multi-user page block.
//  - Yoruba.nsh line 84: a quote inside the finish-page text breaks
//    LANGFILE_SETSTRING.
// Both keep their entry in the picker but render the English wizard text.
// Removable once electron-builder bundles a newer NSIS.
const BROKEN_NSIS = new Set(['Hindi', 'Yoruba']);

const lcidToRegion = new Map(Object.entries(lcid).map(([region, id]) => [id, region]));

function resolve(language) {
  const manual = MANUAL[language.code];
  const candidateRegions = [];
  if (manual) candidateRegions.push(manual.region);
  const declared = lcidToRegion.get(language.lcid);
  if (declared && !candidateRegions.includes(declared)) candidateRegions.push(declared);

  for (const region of candidateRegions) {
    if (!lcid[region]) continue;
    const name = emittedName(region);
    if (!name || !NSIS_LANGUAGES.has(name) || BROKEN_NSIS.has(name)) continue;
    return { region, muiLcid: lcid[region], nsisName: name };
  }
  return { region: null, muiLcid: null, nsisName: null };
}

function escape(value) {
  return String(value).replace(/"/g, '""');
}

/**
 * Header text for the first page, in the language Windows is already using.
 *
 * NSIS only renders the wizard chrome after `$LANGUAGE` is set, which happens
 * when the user leaves the page, so the page would otherwise open in English.
 * These three strings are translated here and written into the header and the
 * label before the drop-down is drawn.
 */
const HEADER_TEXT = {
  en: ['Select language', 'Choose the language for the installer and for Tecton.', 'Select the language you want to use. Tecton will also start in this language.'],
  tr: ['Dil seçimi', 'Kurulum ve Tecton için dili seçin.', 'Kullanmak istediğiniz dili seçin. Tecton da bu dilde açılacak.'],
  de: ['Sprache auswählen', 'Wählen Sie die Sprache für Setup und Tecton.', 'Wählen Sie die gewünschte Sprache. Tecton startet ebenfalls in dieser Sprache.'],
  es: ['Seleccionar idioma', 'Elija el idioma del instalador y de Tecton.', 'Elija el idioma que desea usar. Tecton también se abrirá en este idioma.'],
  fr: ['Choisir la langue', "Choisissez la langue de l'installateur et de Tecton.", 'Choisissez la langue à utiliser. Tecton démarrera aussi dans cette langue.'],
  it: ['Seleziona la lingua', 'Scegli la lingua del programma di installazione e di Tecton.', 'Scegli la lingua da usare. Anche Tecton si avvierà in questa lingua.'],
  pt: ['Selecionar idioma', 'Escolha o idioma do instalador e do Tecton.', 'Escolha o idioma que pretende usar. O Tecton também abrirá neste idioma.'],
  nl: ['Taal kiezen', 'Kies de taal voor het installatieprogramma en Tecton.', 'Kies de taal die u wilt gebruiken. Tecton start ook in deze taal.'],
  pl: ['Wybierz język', 'Wybierz język instalatora i programu Tecton.', 'Wybierz język, którego chcesz używać. Tecton również uruchomi się w tym języku.'],
  ru: ['Выбор языка', 'Выберите язык установщика и Tecton.', 'Выберите нужный язык. Tecton также запустится на этом языке.'],
  ja: ['言語の選択', 'インストーラーと Tecton の言語を選択します。', '使用する言語を選択してください。Tecton もこの言語で起動します。'],
  ko: ['언어 선택', '설치 프로그램과 Tecton의 언어를 선택하세요.', '사용할 언어를 선택하세요. Tecton도 이 언어로 시작합니다.'],
  zh: ['选择语言', '选择安装程序和 Tecton 使用的语言。', '请选择要使用的语言。Tecton 也将以该语言启动。'],
  sv: ['Välj språk', 'Välj språk för installationsprogrammet och Tecton.', 'Välj det språk du vill använda. Tecton startar också på detta språk.'],
  no: ['Velg språk', 'Velg språk for installasjonsprogrammet og Tecton.', 'Velg språket du vil bruke. Tecton starter også på dette språket.'],
  da: ['Vælg sprog', 'Vælg sprog til installationsprogrammet og Tecton.', 'Vælg det sprog, du vil bruge. Tecton starter også på dette sprog.'],
  cs: ['Výběr jazyka', 'Vyberte jazyk instalace a programu Tecton.', 'Vyberte jazyk, který chcete používat. Tecton se také spustí v tomto jazyce.'],
  ar: ['اختيار اللغة', 'اختر لغة مثبّت البرنامج وTecton.', 'اختر اللغة التي تريد استخدامها. سيبدأ Tecton أيضًا بهذه اللغة.'],
  hi: ['भाषा चुनें', 'इंस्टॉलर और Tecton के लिए भाषा चुनें।', 'वह भाषा चुनें जिसका उपयोग आप करना चाहते हैं। Tecton भी इसी भाषा में शुरू होगा।'],
};

/**
 * Strings for the custom uninstall page that asks whether user data should be
 * removed. They are translated here (not in the app dictionaries) because the
 * uninstaller runs without the renderer.
 *
 * Order: page title, explanation, checkbox label, hint under the checkbox.
 */
const UNINSTALL_TEXT = {
  en: ['Your Tecton data', 'Tecton stores its database, backups and logs in your user profile. Removing the program keeps them by default.', 'Also delete my Tecton data (cannot be undone)', 'Leave this unchecked to keep your records if you install Tecton again.'],
  tr: ['Tecton verileriniz', 'Tecton veritabanını, yedeklerini ve kayıtlarını kullanıcı profilinizde saklar. Programı kaldırmak bunları varsayılan olarak silmez.', 'Tecton verilerimi de sil (geri alınamaz)', 'Tecton’u yeniden kurarsanız kayıtlarınızın kalması için bu seçeneği işaretlemeyin.'],
  de: ['Ihre Tecton-Daten', 'Tecton speichert Datenbank, Sicherungen und Protokolle in Ihrem Benutzerprofil. Das Entfernen des Programms behält sie standardmäßig bei.', 'Meine Tecton-Daten ebenfalls löschen (nicht rückgängig zu machen)', 'Lassen Sie dies deaktiviert, um Ihre Daten für eine spätere Neuinstallation zu behalten.'],
  es: ['Sus datos de Tecton', 'Tecton guarda la base de datos, las copias y los registros en su perfil de usuario. Desinstalar el programa los conserva de forma predeterminada.', 'Eliminar también mis datos de Tecton (no se puede deshacer)', 'Deje esta opción sin marcar para conservar sus datos si vuelve a instalar Tecton.'],
  fr: ['Vos données Tecton', 'Tecton conserve la base de données, les sauvegardes et les journaux dans votre profil utilisateur. La désinstallation du programme les conserve par défaut.', 'Supprimer aussi mes données Tecton (irréversible)', 'Laissez cette case décochée pour conserver vos données en cas de réinstallation.'],
  it: ['I tuoi dati Tecton', 'Tecton conserva database, backup e registri nel profilo utente. La disinstallazione del programma li mantiene per impostazione predefinita.', 'Elimina anche i miei dati Tecton (irreversibile)', 'Lascia deselezionato per conservare i dati in caso di nuova installazione.'],
  pt: ['Os seus dados do Tecton', 'O Tecton guarda a base de dados, as cópias e os registos no seu perfil de utilizador. Desinstalar o programa mantém-nos por predefinição.', 'Eliminar também os meus dados do Tecton (não pode ser anulado)', 'Deixe esta opção desmarcada para manter os dados se voltar a instalar o Tecton.'],
  nl: ['Uw Tecton-gegevens', 'Tecton bewaart de database, back-ups en logboeken in uw gebruikersprofiel. Bij verwijdering van het programma blijven ze standaard staan.', 'Mijn Tecton-gegevens ook verwijderen (kan niet ongedaan worden gemaakt)', 'Laat dit uitgeschakeld om uw gegevens te bewaren voor een nieuwe installatie.'],
  pl: ['Twoje dane Tecton', 'Tecton przechowuje bazę danych, kopie i dzienniki w profilu użytkownika. Odinstalowanie programu domyślnie je zachowuje.', 'Usuń także moje dane Tecton (nieodwracalne)', 'Pozostaw niezaznaczone, aby zachować dane na wypadek ponownej instalacji.'],
  ru: ['Ваши данные Tecton', 'Tecton хранит базу данных, резервные копии и журналы в профиле пользователя. Удаление программы по умолчанию их сохраняет.', 'Также удалить мои данные Tecton (необратимо)', 'Оставьте флажок снятым, чтобы сохранить данные для повторной установки.'],
  ja: ['Tecton のデータ', 'Tecton はデータベース、バックアップ、ログをユーザープロファイルに保存します。プログラムを削除しても既定では残ります。', 'Tecton のデータも削除する (元に戻せません)', '再インストールに備えてデータを残す場合は、チェックを外したままにしてください。'],
  ko: ['Tecton 데이터', 'Tecton은 데이터베이스, 백업, 로그를 사용자 프로필에 저장합니다. 프로그램을 제거해도 기본적으로 유지됩니다.', 'Tecton 데이터도 삭제 (되돌릴 수 없음)', '다시 설치할 때 데이터를 유지하려면 선택하지 마세요.'],
  zh: ['Tecton 数据', 'Tecton 将数据库、备份和日志保存在用户配置文件中。卸载程序默认会保留这些数据。', '同时删除我的 Tecton 数据（无法撤销）', '如需保留数据以便日后重新安装，请勿勾选。'],
  sv: ['Dina Tecton-data', 'Tecton lagrar databasen, säkerhetskopiorna och loggarna i din användarprofil. De finns kvar när programmet tas bort.', 'Ta även bort mina Tecton-data (kan inte ångras)', 'Låt rutan vara omarkerad om du vill behålla data för en ny installation.'],
  no: ['Dine Tecton-data', 'Tecton lagrer databasen, sikkerhetskopiene og loggene i brukerprofilen din. De beholdes når programmet fjernes.', 'Slett også mine Tecton-data (kan ikke angres)', 'La ruten stå tom for å beholde dataene ved en ny installasjon.'],
  da: ['Dine Tecton-data', 'Tecton gemmer databasen, sikkerhedskopierne og logfilerne i din brugerprofil. De bevares, når programmet fjernes.', 'Slet også mine Tecton-data (kan ikke fortrydes)', 'Lad afkrydsningsfeltet være tomt for at beholde data til en ny installation.'],
  cs: ['Vaše data Tecton', 'Tecton ukládá databázi, zálohy a protokoly do vašeho uživatelského profilu. Odinstalování programu je ve výchozím nastavení zachová.', 'Smazat také moje data Tecton (nelze vrátit)', 'Ponechte nezaškrtnuté, pokud chcete data zachovat pro novou instalaci.'],
  ar: ['بيانات Tecton', 'يحفظ Tecton قاعدة البيانات والنسخ الاحتياطية والسجلات في ملف تعريف المستخدم. تبقى هذه البيانات عند إزالة البرنامج افتراضيًا.', 'حذف بيانات Tecton أيضًا (لا يمكن التراجع)', 'اترك هذا الخيار دون تحديد للاحتفاظ ببياناتك عند إعادة التثبيت.'],
  hi: ['आपका Tecton डेटा', 'Tecton डेटाबेस, बैकअप और लॉग आपकी उपयोगकर्ता प्रोफ़ाइल में रखता है। प्रोग्राम हटाने पर ये डिफ़ॉल्ट रूप से बने रहते हैं।', 'मेरा Tecton डेटा भी हटाएँ (पूर्ववत नहीं हो सकता)', 'दोबारा इंस्टॉल करने पर डेटा बनाए रखने के लिए इसे अनचेक छोड़ें।'],
};

const UNINSTALL_KEYS = ['DataTitle', 'DataInfo', 'DataCheck', 'DataHint'];

function uninstallLines(languages) {
  const known = new Map(languages.map((language) => [language.code, UNINSTALL_TEXT[language.code]]));
  return languages
    .filter((language) => known.get(language.code))
    .map((language) => {
      const values = known.get(language.code);
      const assignments = values
        .map((value, index) => `    StrCpy $TectonUn${UNINSTALL_KEYS[index]} "${escape(value)}"`)
        .join('\n');
      return `  StrCmp $TectonUninstallLanguage "${escape(language.code)}" 0 +${values.length + 2}\n${assignments}\n    Goto tectonUninstallStringsDone`;
    })
    .join('\n');
}

// Languages whose code has no header entry fall back to English chrome.
function headerLines(languages) {
  const known = new Map(languages.map((language) => [language.code, HEADER_TEXT[language.code]]));
  return languages
    .filter((language) => known.get(language.code))
    .map((language) => {
      const [title, sub, label] = known.get(language.code);
      return `  StrCmp $TectonLanguage "${escape(language.code)}" 0 +4\n    StrCpy $TectonHeaderTitle "${escape(title)}"\n    StrCpy $TectonHeaderText "${escape(sub)}"\n    StrCpy $TectonLangLabel "${escape(label)}"`;
    })
    .join('\n');
}

function generate(languages) {
  const rows = languages.map((language) => ({ ...language, ...resolve(language) }));

  const addLines = rows
    .map((row) => `  \${NSD_CB_AddString} $TectonLangCombo "${escape(row.nativeName)}"`)
    .join('\n');

  // Windows reports a full LANGID (de-AT is 3079), so an exact match is tried
  // first and the primary language id second: 3079 & 0x3FF == 7, the same
  // primary id as de-DE (1031). A user whose regional variant is missing still
  // lands on their language instead of English.
  const exactMatch = rows
    .map(
      (row, index) =>
        `  StrCmp $0 ${row.lcid} 0 +2\n    StrCpy $TectonLangIndex ${index}\n    Goto tectonLanguageResolved`
    )
    .join('\n');

  const seenPrimary = new Set();
  const primaryMatch = rows
    .filter((row) => {
      const primary = row.lcid & 0x3ff;
      if (seenPrimary.has(primary)) return false;
      seenPrimary.add(primary);
      return true;
    })
    .map((row) => {
      const index = rows.indexOf(row);
      return `  StrCmp $1 ${row.lcid & 0x3ff} 0 +2\n    StrCpy $TectonLangIndex ${index}\n    Goto tectonLanguageResolved`;
    })
    .join('\n');

  // Every language keeps its own code so a first-run install opens with the
  // matching in-app dictionary. Languages NSIS has no wizard text for fall back
  // to English pages but still persist their code.
  const applyLines = rows
    .map((row, index) => {
      const lcidToUse = row.muiLcid || 1033;
      return `  StrCmp $TectonLangIndex ${index} 0 +2\n    StrCpy $LANGUAGE ${lcidToUse}\n    StrCpy $TectonLanguage "${escape(row.code)}"`;
    })
    .join('\n');

  // The default language is resolved before the page is drawn, so the code has
  // to be known before the user leaves the page.
  const codeLines = rows
    .map(
      (row, index) =>
        `  StrCmp $TectonLangIndex ${index} 0 +2\n    StrCpy $TectonLanguage "${escape(row.code)}"\n    Goto tectonLanguageCodeResolved`
    )
    .join('\n');

  // The uninstaller knows only the language code saved at install time, so its
  // wizard language has to be resolved by code rather than by combo index.
  const uninstallApplyLines = rows
    .map(
      (row) =>
        `  StrCmp $TectonUninstallLanguage "${escape(row.code)}" 0 +2\n    StrCpy $LANGUAGE ${row.muiLcid || 1033}`
    )
    .join('\n');

  const nsh = `; Auto-generated by scripts/generateInstallerLanguages.js - do not edit.
; ${rows.length} installer languages; ${rows.filter((row) => row.muiLcid).length} have native NSIS wizard text.

!macro TECTON_LANG_ADD
${addLines}
!macroend

!macro TECTON_LANG_DEFAULT
  System::Call 'kernel32::GetUserDefaultUILanguage() i .r0'
  IntOp $1 $0 & 0x3FF
  StrCpy $TectonLangIndex 1
${exactMatch}
${primaryMatch}
  tectonLanguageResolved:
  StrCpy $TectonLanguage "en"
${codeLines}
  tectonLanguageCodeResolved:
!macroend

!macro TECTON_LANG_APPLY
  StrCpy $LANGUAGE 1033
  StrCpy $TectonLanguage "en"
${applyLines}
!macroend

!macro TECTON_LANG_HEADER
  StrCpy $TectonHeaderTitle "Select language"
  StrCpy $TectonHeaderText "Choose the language for the installer and for Tecton."
  StrCpy $TectonLangLabel "Select the language you want to use. Tecton will also start in this language."
${headerLines(rows)}
!macroend

!macro TECTON_UNINSTALL_TEXT
  StrCpy $TectonUnDataTitle "Your Tecton data"
  StrCpy $TectonUnDataInfo "Tecton stores its database, backups and logs in your user profile. Removing the program keeps them by default."
  StrCpy $TectonUnDataCheck "Also delete my Tecton data (cannot be undone)"
  StrCpy $TectonUnDataHint "Leave this unchecked to keep your records if you install Tecton again."
${uninstallLines(rows)}
  tectonUninstallStringsDone:
!macroend

!macro TECTON_UNINSTALL_APPLY
  StrCpy $LANGUAGE 1033
${uninstallApplyLines}
!macroend
`;

  const supported = rows.filter((row) => row.region).map((row) => row.region);

  fs.mkdirSync(BUILD_DIR, { recursive: true });
  fs.writeFileSync(OUTPUT_NSH, nsh, 'utf8');
  fs.writeFileSync(
    OUTPUT_JSON,
    JSON.stringify({ count: rows.length, supported, languages: rows }, null, 2) + '\n',
    'utf8'
  );

  return rows;
}

function main() {
  const languages = readInstallerLanguages();
  if (languages.length !== EXPECTED_COUNT) {
    throw new Error(`Expected ${EXPECTED_COUNT} installer languages, found ${languages.length}`);
  }
  const rows = generate(languages);
  const native = rows.filter((row) => row.muiLcid).length;
  console.log(`[installer] ${rows.length} languages, ${native} with native wizard text`);
}

if (require.main === module) {
  main();
}

module.exports = { generate, readInstallerLanguages, resolve, NSIS_LANGUAGES, EXPECTED_COUNT };
