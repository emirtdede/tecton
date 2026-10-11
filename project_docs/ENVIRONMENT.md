# Ortam Yapılandırması

## Kurulum Adımları

# 1. Bağımlılıkları yükle
npm install

# 2. Geliştirme ortamını başlat (Electron + React aynı anda çalışır)
npm run dev

# 3. Üretime hazır uygulama (.exe vb.) oluştur
npm run build

## Environment Değişkenleri
Proje varsayılan olarak yerel/offline çalışır. Tek istisna opsiyonel hava durumu özelliğidir: OpenWeather API anahtarı koda gömülmez, `.env`’ye yazılmaz; ilk kayıtta `Electron safeStorage` (DPAPI/Keychain) ile şifrelenip `app_settings.weather_api_key_enc`’te saklanır. Anahtar tanımlı değilse `system:get-weather` `{success:false, errorType:'missing_key'}` döner.

## Gereksinimler
- Node.js: 22 LTS zorunludur (`.nvmrc`=22, `package.json:engines`). Node 24 desteklenmez (sqlite3 native prebuild uyumsuzluğu).
- Portlar: Vite 5173 (dev), LAN 5001 (yalnızca aynı Wi-Fi, LAN IP bind).