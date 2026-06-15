const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname);

const patchData = {
  tr: { worker: { advanceBadge: "AVANS" }, common: { yes: "Evet" } },
  en: { worker: { advanceBadge: "ADVANCE" }, common: { yes: "Yes" } },
  es: { worker: { advanceBadge: "ANTICIPO" }, common: { yes: "Sí" } },
  ar: { worker: { advanceBadge: "مقدم" }, common: { yes: "نعم" } },
  de: { worker: { advanceBadge: "VORSCHUSS" }, common: { yes: "Ja" } },
  fr: { worker: { advanceBadge: "AVANCE" }, common: { yes: "Oui" } },
  ru: { worker: { advanceBadge: "АВАНС" }, common: { yes: "Да" } },
  hi: { worker: { advanceBadge: "अग्रिम" }, common: { yes: "हाँ" } },
  zh: { worker: { advanceBadge: "预支" }, common: { yes: "是" } },
  ja: { worker: { advanceBadge: "前払い" }, common: { yes: "はい" } },
  ko: { worker: { advanceBadge: "가불" }, common: { yes: "예" } },
  cs: { worker: { advanceBadge: "ZÁLOHA" }, common: { yes: "Ano" } },
  da: { worker: { advanceBadge: "FORSKUD" }, common: { yes: "Ja" } },
  it: { worker: { advanceBadge: "ANTICIPO" }, common: { yes: "Sì" } },
  nl: { worker: { advanceBadge: "VOORSCHOT" }, common: { yes: "Ja" } },
  no: { worker: { advanceBadge: "FORSKUDD" }, common: { yes: "Ja" } },
  pl: { worker: { advanceBadge: "ZALICZKA" }, common: { yes: "Tak" } },
  pt: { worker: { advanceBadge: "ADIANTAMENTO" }, common: { yes: "Sim" } },
  sv: { worker: { advanceBadge: "FÖRSKOTT" }, common: { yes: "Ja" } }
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
      
      if (!json.common) json.common = {};
      if (!json.worker) json.worker = {};
      
      Object.assign(json.common, { ...json.common, ...data.common });
      Object.assign(json.worker, { ...json.worker, ...data.worker });

      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
      console.log(`Successfully patched advance and yes: ${lang}.json`);
    } catch (err) {
      console.error(`Error processing ${lang}.json:`, err);
    }
  }
});
