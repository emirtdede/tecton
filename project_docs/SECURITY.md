# Güvenlik Kuralları

## Hassas Alanlar
Bu alanlara dokunurken ekstra dikkatli ol:
- `src/main/database/` — Veritabanı sorguları (Veri bütünlüğünün kalbi)
- `src/preload/index.js` — ContextBridge (Node.js yetkilerinin Frontend'e açıldığı kapı)

## Zorunlu Kurallar

### Electron IPC Güvenliği
- `nodeIntegration: false` olmak zorundadır. Frontend (React) hiçbir şekilde doğrudan Node.js modüllerine (`fs`, `path` vb.) erişemez.
- `contextIsolation: true` olmak zorundadır.
- Frontend'den gelen IPC çağrıları (invoke) körü körüne kabul edilmemeli, main process'te (backend) veri doğrulamasından geçmelidir.

### Veritabanı Güvenliği (SQL Injection)
- Uygulama sadece lokalde çalışıyor ve tek bir kişi kullanıyor olsa bile, tüm SQLite sorguları **Parameterized Query (Parametrik Sorgu)** ile yapılmalıdır. 
- Örnek YANLIŞ: `db.run("SELECT * FROM workers WHERE name = '" + userInput + "'")`
- Örnek DOĞRU: `db.run("SELECT * FROM workers WHERE name = ?", [userInput])`

### Denetim İzi (Audit Logging) ve Gözetlenebilirlik
- Veritabanında (ekleme, silme, güncelleme) yapılan tüm işlemler mutlaka `electron-log` kullanılarak "Human-Readable" Türkçe cümleler formatında (Örn: "Ahmet kişisi eklendi") kayıt altına alınmalıdır.
- Loglar `userData/logs/YYYY/MM/YYYY-MM-DD.log` şeklinde rotasyona tabi tutularak şişme engellenmelidir.

### Yerel Ağ (LAN) Sunucu Güvenliği
- **Zero Internet Exposure:** Express.js ile başlatılan LAN Fotoğraf Yükleyici, sadece şantiyenin kendi lokal ağında (Örn: `192.168.x.x:5001`) yayın yapmalıdır. Dış dünyaya (İnternete) port açılmasına izin verilmez.
- Yüklenen dosyalar, sunucu tarafında işlenirken boyut sınırlamasına ve format doğrulama (`.webp` sıkıştırma) süreçlerine tabi tutularak zararlı dosya (RCE vb.) enjeksiyonları önlenmelidir.

## Güvenlik Kontrol Listesi (Canlıya Geçmeden / Build Almadan)
- [x] `nodeIntegration` kapalı mı? (`src/main/index.js` splash+main: false)
- [x] `contextIsolation` + `sandbox:true` + `webSecurity:true` açık mı?
- [x] CSP header + `will-navigate` deny + `setWindowOpenHandler:deny` aktif mi?
- [x] Tüm DB sorguları parametrik mi? (değerler `?`, tanımlayıcılar `allowlist.js`)
- [x] CRUD tablo/kolon allowlist (`src/main/services/allowlist.js`) bağlı mı?
- [x] Hardcoded secret yok mu? (`Select-String 'c635dd87' src/` → 0; weather key `safeStorage`’da)
- [x] LAN: `multer@2.3.0` + senkron fileFilter + `limits{10MB,1 dosya}` + magic-byte + projectId allowlist + HTML escape + rate-limit (15/dk) + LAN IP bind (0.0.0.0 yok) mu?
- [x] Fuse durumu okundu (`npm run flip-fuses`, 2026-10-11): `RunAsNode Enabled`, `EnableNodeCliInspectArguments Enabled` (Playwright E2E uyumlu). Sıkılaştırma flip'i (runAsNode→false) sürüm politikası kararı bekliyor.
- [ ] CSC imzası ERTELENDİ: makinede admin/Developer Mode yok (`reg add` erişim reddi), `create-self-signed-cert` araç hatası. `signAndEditExecutable:false` ile imzasız build; imzalı build CI'da `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD` ile yapılacak. `.gitignore`: `*.pfx,*.p12` EKLENMELİ (henüz yok — sıradaki iş).
- [x] LAN rate-limit: in-memory (15/dk/IP). `express-rate-limit` KALDIRILDI: v6 Express-4-only (Express 5.2.1'de 500 veriyor, testle kanıtlandı), v8 ESM-only (CJS main ile uyumsuz). Tek prosesli LAN'da harici store gereksiz.
- [ ] `release/*.exe` HEAD sonrası üretildi mi?