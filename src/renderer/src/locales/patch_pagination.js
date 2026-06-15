const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname);

const patchData = {
  tr: { common: { prev: "Önceki", page: "Sayfa", next_short: "Sonraki" } },
  en: { common: { prev: "Previous", page: "Page", next_short: "Next" } },
  es: { common: { prev: "Anterior", page: "Página", next_short: "Siguiente" } },
  ar: { common: { prev: "السابق", page: "الصفحة", next_short: "التالي" } },
  de: { common: { prev: "Zurück", page: "Seite", next_short: "Weiter" } },
  fr: { common: { prev: "Précédent", page: "Page", next_short: "Suivant" } },
  ru: { common: { prev: "Назад", page: "Страница", next_short: "Вперед" } },
  hi: { common: { prev: "पिछला", page: "पृष्ठ", next_short: "अगला" } },
  zh: { common: { prev: "上一页", page: "页", next_short: "下一页" } },
  ja: { common: { prev: "前へ", page: "ページ", next_short: "次へ" } },
  ko: { common: { prev: "이전", page: "페이지", next_short: "다음" } },
  cs: { common: { prev: "Předchozí", page: "Strana", next_short: "Další" } },
  da: { common: { prev: "Forrige", page: "Side", next_short: "Næste" } },
  it: { common: { prev: "Precedente", page: "Pagina", next_short: "Successivo" } },
  nl: { common: { prev: "Vorige", page: "Pagina", next_short: "Volgende" } },
  no: { common: { prev: "Forrige", page: "Side", next_short: "Neste" } },
  pl: { common: { prev: "Poprzedni", page: "Strona", next_short: "Następny" } },
  pt: { common: { prev: "Anterior", page: "Página", next_short: "Próximo" } },
  sv: { common: { prev: "Föregående", page: "Sida", next_short: "Nästa" } }
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
      Object.assign(json.common, { ...json.common, ...data.common });

      fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
      console.log(`Successfully patched: ${lang}.json`);
    } catch (err) {
      console.error(`Error processing ${lang}.json:`, err);
    }
  }
});
