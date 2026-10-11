# Sözlük

## İş Terimleri
- **Puantaj**: İşçinin günlük çalışma durumunun (tam gün, yarım gün, mesai, devamsız) kaydedilmesi işlemi.
- **Yevmiye**: İşçinin bir günlük tam çalışması karşılığında anlaştığı sabit günlük ücret.
- **Hak ediş**: İşçinin çalıştığı gün sayısı ve yevmiyesi çarpılarak hesaplanan, şirketten alacaklı olduğu toplam tutar.
- **Cari Hesap (Personel)**: İşçi ile şirket arasındaki parasal ilişkinin (alacak ve borç durumu) bütünü.
- **Avans**: İşçiye hak edişinden düşülmek üzere, ay içinde önceden ödenen nakit para.
- **Mutabakat Fişi (Ekstre)**: İşçi ile şirket arasındaki hesap durumunu (puantaj ve avanslar) teyit etmek için sistemden alınan gayriresmi PDF çıktısı.
- **Mizan**: Yerel sistemin kendi içindeki borç/alacak tutarlılığını kontrol eden genel denge tablosu (Resmi mizan değildir).

## Teknik Terimler
- **IPC (Inter-Process Communication)**: Electron yapısında, React (arayüz) ile Node.js (arka plan) süreçlerinin birbiriyle güvenli bir şekilde veri alışverişi yapmasını sağlayan iletişim köprüsü.
- **Offline-First**: Uygulamanın internet bağlantısına ihtiyaç duymadan, %100 yerel kaynaklarla çalışacak şekilde tasarlanması. Tek istisna opsiyonel hava durumu (opt-in API anahtarı, `safeStorage`’da saklanır).
- **Taşeron**: Şantiyede belirli bir iş paketini üstlenen alt yüklenici; `subcontractor_ledgers` + `subcontractor_transactions` ile cari takibi yapılır.
- **İSG**: İş Sağlığı ve Güvenliği; personel/taşeron sertifika bitiş tarihleri (`isg_bitis_tarihi` / `isg_expiry_date`) izlenir.
- **Snapshot (Değer Mühürleme)**: Puantaj girilirken yevmiye+çarpanın DB’ye kopyalanması; sonraki katsayı değişimleri geçmişi bozmaz.
- **Soft-Delete**: Silinen kaydın `is_deleted=1` ile arşivlenmesi; `recycle_bin` üzerinden tek tıkla geri yüklenir.
- **VACUUM (INTO)**: SQLite optimizasyonu; kapanışta `VACUUM INTO` ile atomik günlük yedek + `integrity_check`.
- **Devreden Bakiye**: `SUM(puantaj) - SUM(avans)` ile anlık hesaplanan personel bakiyesi (DB’de sabit tutulmaz).
- **Bulk Timesheet**: Çoklu personel puantaj girişi (`db:create-bulk`).
- **Anomali Dedektörü**: Tutarsız kayıtları işaretleyen rapor paneli (`AnomalyPanel`).
- **Audit Trail**: `audit_logs` + human-readable Türkçe loglar (`electron-log`, YYYY/MM rotasyon).
- **Allowlist**: `crudService` tablo/kolon beyaz listesi (`allowlist.js`); `sqlite_master` gibi sistem tabloları reddedilir.
- **TDE**: Transparent Data Encryption; `better-sqlite3-multiple-ciphers` + `safeStorage` anahtar kasasıyla dinlenimde şifreleme.
- **CSP**: Content Security Policy; LAN formunda `default-src 'self'`.
- **N+1**: Her işçi için tekil bakiye sorgusu anti-pattern’ı; `finance:get-balances` toplu IPC ile çözüldü.