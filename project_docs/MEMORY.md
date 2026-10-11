# Proje Hafızası

Son güncelleme: 2026-10-11

## Proje Özeti
Elektronik Yevmiye Defteri; internetsiz (offline) çalışan, işçi puantaj ve avans/cari takibini yerel veritabanında tutan, Electron + React tabanlı bir iç denetim yazılımıdır. Şantiye yönetimi, taşeron takibi, çoklu dil (19 dil), İSG takibi ve mobil fotoğraf entegrasyonu (LAN) gibi modüllere sahip otonom bir Kurumsal ERP sistemidir.

## Teknik Özet
- Frontend: React.js (Tailwind CSS)
- Backend: Node.js (Electron IPC, Express.js LAN)
- DB: better-sqlite3-multiple-ciphers (TDE şifreli, safeStorage anahtar kasası, soft delete + rollback)
- Auth: Tek Kullanıcı / Yerel Erişim (Giriş ekranı yok)

## Şu Anki Durum
V1.0.0 (semver, tag `v1.0.0`, `release/Tecton Setup 1.0.0.exe` HEAD sonrası üretildi). Güvenlik P0’lar kapatıldı (hardcoded key yok, allowlist, hardened LAN, sandbox+CSP), 57/57 test yeşil, coverage bazı lines %7.43 (eşik 80/80/70 — renderer testleri sürecek iş).

## Son Yapılan İş (2026-10-11 güvenlik+kalite sprinti)
- Hardcoded OpenWeather key silindi → `secret.js` (safeStorage) + `missing_key` akışı (revoke-only, history’ye dokunulmadı).
- CRUD identifier injection kapatıldı → `allowlist.js` (17 tablo).
- LAN hardening: `multer@2.3.0`, senkron fileFilter, 10MB limit, magic-byte, projectId allowlist, HTML escape, rate-limit, LAN IP bind.
- Electron: `sandbox:true`, CSP, `will-navigate` deny, `setWindowOpenHandler:deny`.
- TDE: `better-sqlite3-multiple-ciphers@13.0.3` swap (async wrapper `dbCompat.js`), `keystore.js`, legacy plaintext otomatik şifreleme, `sqlite/sqlite3` kaldırıldı.
- Kod: `Settings.jsx` 1689→343 (4 sekme dosyası), `finance:get-balances` toplu IPC, `ErrorBoundary`, main log birleşimi (0 `console.*`), `wageService` validasyon.
- Test/CI: 27→57 test, E2E 3 spec + `ci.yml` (unit her push, e2e nightly), coverage v8 eşikleri.
- Sürüm: `1.0.0`, MIT `LICENSE`, `.nvmrc`=22, `asarUnpack *.node`, `signAndEditExecutable:false` (imzasız local build).

## Sıradaki Adım
1. Renderer component testleri (jsdom) ile coverage’ı eşiğe taşımak; 2. `App.jsx`/`WorkerProfile.jsx` god-file bölme; 3. İmzalı build (CSC sertifikası) + `flip-fuses` doğrulaması.

## Geçmiş Notlar (2026-06-20 öncesi)
- İç parametre `clean_shutdown` gizlendi; bulut klasörü "Güvenlik ve Yedekleme" sekmesine taşındı.
- Temaya duyarlı shutdown overlay (2.5sn güvenli gecikme), `VACUUM INTO` + `integrity_check`, auto-recovery, YYYY/MM arşivleme kuruldu.

## Dikkat Edilmesi Gerekenler
- Tüm veriler kullanıcının kendi makinesinde (şifreli SQLite) tutulmalıdır.
- LAN Fotoğraf Yükleyicisi sadece aynı yerel ağdaki (offline) cihazlar arasında çalışır.
- Gereken Node: 22 LTS (`.nvmrc`); Node 24 desteklenmez.
- Excel/CSV parse arka planda (Node.js/Electron) yapılır.
- Kapanışta `before-quit`/`will-quit` bütünlük garantisi + shutdown overlay korunur.