const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname);

const patchData = {
  tr: { title: "4. İzin Yönetimi", desc: "Personelin raporlu veya izinli olduğu günleri kaydedin." },
  en: { title: "4. Leave Management", desc: "Record the days when the personnel is on leave or sick leave." },
  es: { title: "4. Gestión de Permisos", desc: "Registre los días en que el personal está de baja o permiso médico." },
  ar: { title: "٤. إدارة الإجازات", desc: "قم بتسجيل الأيام التي يكون فيها الموظفون في إجازة أو إجازة مرضية." },
  de: { title: "4. Urlaubsverwaltung", desc: "Erfassen Sie die Tage, an denen das Personal im Urlaub oder krankgeschrieben ist." },
  fr: { title: "4. Gestion des Congés", desc: "Enregistrez les jours où le personnel est en congé ou en arrêt maladie." },
  ru: { title: "4. Управление отпусками", desc: "Запишите дни, когда персонал находится в отпуске или на больничном." },
  hi: { title: "4. छुट्टी प्रबंधन", desc: "उन दिनों को रिकॉर्ड करें जब कर्मचारी छुट्टी या बीमारी की छुट्टी पर हों।" },
  zh: { title: "4. 请假管理", desc: "记录人员休假或病假的日子。" },
  ja: { title: "4. 休暇管理", desc: "スタッフが休暇中または病休中の日を記録します。" },
  ko: { title: "4. 휴가 관리", desc: "직원이 휴가 또는 병가 중인 날짜를 기록합니다。" },
  cs: { title: "4. Správa dovolené", desc: "Zaznamenejte dny, kdy je personál na dovolené nebo na nemocenské." },
  da: { title: "4. Fraværshåndtering", desc: "Registrer de dage, hvor personalet er på orlov eller sygemeldt." },
  it: { title: "4. Gestione Permessi", desc: "Registra i giorni in cui il personale è in permesso o in congedo per malattia." },
  nl: { title: "4. Verlofbeheer", desc: "Registreer de dagen waarop het personeel met verlof of ziekteverlof is." },
  no: { title: "4. Fraværshåndtering", desc: "Registrer dagene når personalet er på permisjon eller sykemeldt." },
  pl: { title: "4. Zarządzanie urlopami", desc: "Zapisz dni, w których personel przebywa na urlopie lub zwolnieniu lekarskim." },
  pt: { title: "4. Gestão de Licenças", desc: "Registe os dias em que o pessoal está de licença ou baixa médica." },
  sv: { title: "4. Frånvarohantering", desc: "Registrera de dagar då personalen är ledig eller sjukskriven." }
};

const files = fs.readdirSync(localesDir);
files.forEach(file => {
  if (file.endsWith('.json')) {
    const lang = file.replace('.json', '');
    const data = patchData[lang] || patchData.en;
    
    const filePath = path.join(localesDir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    try {
      const json = JSON.parse(content);
      
      if (!json.guides) json.guides = {};
      if (!json.guides.personnel) json.guides.personnel = {};
      
      json.guides.personnel.step4 = {
        title: data.title,
        desc: data.desc
      };

      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
      console.log(`Successfully patched step4 in: ${lang}.json`);
    } catch (err) {
      console.error(`Error processing ${lang}.json:`, err);
    }
  }
});
