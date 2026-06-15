const fs = require('fs');
const path = require('path');
const https = require('https');

const localesDir = path.join(__dirname, 'src', 'renderer', 'src', 'locales');

// Reference translations (in Turkish)
const referenceGuides = {
  "journal": {
    "title": "Yevmiye Rehberi",
    "step1": {
      "title": "1. Hava Durumu",
      "desc": "Günlük hava durumunu ve genel durumu kaydedin."
    },
    "step2": {
      "title": "2. Kronolojik Kayıt",
      "desc": "Önemli olayları sırasıyla kaydedin."
    },
    "step3": {
      "title": "3. Geçmiş",
      "desc": "Önceki günlere kolayca göz atın."
    }
  },
  "delivery": {
    "title": "İrsaliye Rehberi",
    "step1": {
      "title": "1. Tedarikçi ve Malzeme",
      "desc": "Tedarikçi ve malzeme isimlerini kaydedin."
    },
    "step2": {
      "title": "2. Belge Fotoğrafları",
      "desc": "Dijital arşiv için irsaliye fotoğraflarını yükleyin."
    },
    "step3": {
      "title": "3. Akıllı Arama",
      "desc": "İrsaliye numaralarında veya tedarikçilerde arama yapın."
    }
  },
  "production": {
    "title": "Üretim Rehberi",
    "step1": {
      "title": "1. Üretim Kayıtları",
      "desc": "Günlük üretimi kaydedin."
    },
    "step2": {
      "title": "2. Arşiv ve Detaylar",
      "desc": "Kronolojik bir arşiv tutmak için notlar yazın."
    },
    "step3": {
      "title": "3. Arama ve Filtreler",
      "desc": "Tarih aralığına veya birime göre filtreleyin."
    }
  },
  "personnel": {
    "title": "Personel Rehberi",
    "step1": {
      "title": "1. Personel Ekle ve Excel",
      "desc": "Toplu liste yüklemek için Excel şablonunu kullanın."
    },
    "step2": {
      "title": "2. Grup Analizi",
      "desc": "Grup kategorisine göre maliyetleri analiz edin."
    },
    "step3": {
      "title": "3. Puantaj ve Ekstreler",
      "desc": "Puantaj tablosunu görmek için isme tıklayın."
    },
    "step4": {
      "title": "4. İzin Yönetimi",
      "desc": "Personelin mazeretli veya raporlu olduğu günleri kaydedin."
    }
  }
};

function flattenObj(obj, prefix = '') {
  let result = {};
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      Object.assign(result, flattenObj(obj[key], prefix + key + '.'));
    } else {
      result[prefix + key] = obj[key];
    }
  }
  return result;
}

const flatSourceGuides = flattenObj(referenceGuides);

async function translateText(text, targetLang) {
  if (targetLang === 'tr') return text;
  
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=tr&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
  
  return new Promise((resolve) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          let translated = '';
          if (parsed && parsed[0]) {
            parsed[0].forEach(item => {
              if (item[0]) translated += item[0];
            });
            resolve(translated.trim());
          } else {
            resolve(text);
          }
        } catch (e) {
          resolve(text);
        }
      });
    }).on('error', () => {
      resolve(text);
    });
  });
}

function assignObjectByPath(obj, pathStr, value) {
  const parts = pathStr.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

async function run() {
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const langCode = file.replace('.json', '');
    const filePath = path.join(localesDir, file);
    let langData;
    
    try {
      langData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
      console.error(`Cannot parse ${file}`);
      continue;
    }
    
    if (!langData.guides) langData.guides = {};

    console.log(`Translating guides for ${langCode}...`);
    
    for (const [keyPath, trValue] of Object.entries(flatSourceGuides)) {
      if (typeof trValue === 'string' && trValue.trim() !== '') {
        const translated = await translateText(trValue, langCode);
        assignObjectByPath(langData.guides, keyPath, translated);
      }
    }
    
    fs.writeFileSync(filePath, JSON.stringify(langData, null, 2), 'utf8');
    console.log(`Updated guides for ${file}`);
    
    // Add a delay to avoid rate limit
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log("All languages successfully patched!");
}

run();
