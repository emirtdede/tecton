const fs = require('fs');
const path = require('path');
const https = require('https');

const localesDir = path.join(__dirname, 'src', 'renderer', 'src', 'locales');

// English base definitions for new keys
const newKeysEn = {
  "common.yes": "Yes",
  "common.no": "No",
  "recycle.type.worker_leaves": "Personnel Leave",
  "recycle_type_worker_leaves": "Personnel Leave",
  "recycle.leave_title": "{{type}} Leave ({{start}} - {{end}})",
  "worker_profile.timesheet_delete_title": "Delete Timesheet",
  "worker_profile.timesheet_delete_msg": "Are you sure you want to delete this timesheet record? This action cannot be undone.",
  "worker_profile.advance_delete_title": "Delete Advance/Transaction",
  "worker_profile.advance_delete_msg": "Are you sure you want to delete this advance? The system will also automatically cancel this amount from the Cash Register.",
  "leave_type.Ücretsiz": "Unpaid",
  "leave_type.Ücretli": "Paid",
  "leave_type.Yıllık": "Annual",
  "leave_type.Mazeret": "Excuse",
  "leave_type.Sağlık": "Medical"
};

// Turkish base definitions
const newKeysTr = {
  "common.yes": "Evet",
  "common.no": "Hayır",
  "recycle.type.worker_leaves": "Personel İzni",
  "recycle_type_worker_leaves": "Personel İzni",
  "recycle.leave_title": "{{type}} İzni ({{start}} - {{end}})",
  "worker_profile.timesheet_delete_title": "Puantajı Sil",
  "worker_profile.timesheet_delete_msg": "Bu puantaj kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
  "worker_profile.advance_delete_title": "Avansı Sil",
  "worker_profile.advance_delete_msg": "Bu avansı silmek istediğinize emin misiniz? Sistem bu tutarı Kasa'dan da otomatik olarak iptal edecektir.",
  "leave_type.Ücretsiz": "Ücretsiz",
  "leave_type.Ücretli": "Ücretli",
  "leave_type.Yıllık": "Yıllık",
  "leave_type.Mazeret": "Mazeret",
  "leave_type.Sağlık": "Sağlık"
};

function assignObjectByPath(obj, pathString, value) {
  const parts = pathString.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]]) current[parts[i]] = {};
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

// Translate via Google Translate API
async function translateText(text, targetLang) {
  if (targetLang === 'en') return text;
  return new Promise((resolve) => {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed[0].map(item => item[0]).join(''));
        } catch (e) {
          resolve(text); // fallback to English
        }
      });
    }).on('error', () => resolve(text));
  });
}

// Interpolation pattern restorer (like {{type}})
function restoreInterpolations(original, translated) {
  let restored = translated;
  const matches = original.match(/{{[^}]+}}/g);
  if (matches) {
    // Basic heuristics to replace spaces around brackets caused by translation
    restored = restored.replace(/{\s*{\s*/g, '{{').replace(/\s*}\s*}/g, '}}');
    matches.forEach(match => {
      // In a real robust system we'd map them precisely, but for simple strings this is okay.
      // Often translations mess up the variable name inside, but assuming they don't break {{name}} entirely
    });
  }
  return restored;
}

async function run() {
  const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const langCode = file.replace('.json', '');
    const filePath = path.join(localesDir, file);
    let jsonData = {};
    if (fs.existsSync(filePath)) {
      jsonData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }

    console.log(`Processing language: ${langCode}`);

    const sourceKeys = langCode === 'tr' ? newKeysTr : newKeysEn;
    
    for (const [keyPath, englishVal] of Object.entries(newKeysEn)) {
      if (langCode === 'en') {
        assignObjectByPath(jsonData, keyPath, newKeysEn[keyPath]);
      } else if (langCode === 'tr') {
        assignObjectByPath(jsonData, keyPath, newKeysTr[keyPath]);
      } else {
        const valToTranslate = newKeysEn[keyPath];
        const translated = await translateText(valToTranslate, langCode);
        const finalVal = restoreInterpolations(valToTranslate, translated);
        assignObjectByPath(jsonData, keyPath, finalVal);
      }
    }

    fs.writeFileSync(filePath, JSON.stringify(jsonData, null, 2), 'utf8');
  }
  console.log("All locale files updated with v6 patch.");
}

run();
