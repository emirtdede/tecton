const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../src/renderer/src/locales');
const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json'));

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace names
  content = content.replace(/ŞantiyeOS/g, 'Tecton');
  content = content.replace(/ŞantiyemOS/g, 'Tecton');
  content = content.replace(/Elektronik Yevmiye Defteri/g, 'Tecton');

  // Parse and add app.name
  let json = JSON.parse(content);
  if (!json['app.name']) {
    // Add app.name at the top level
    json = { 'app.name': 'Tecton', ...json };
  } else {
    json['app.name'] = 'Tecton';
  }

  // Also verify some keys directly, though we already used replace globally on string
  // Let's write back
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2), 'utf8');
});

console.log('Rebranding in i18n JSONs complete!');
