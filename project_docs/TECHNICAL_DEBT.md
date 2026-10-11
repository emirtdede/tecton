# Teknik Borç

## Yüksek Öncelik
- [x] **Otomatik Veritabanı Yedekleme (Auto-Backup)** — ÖDENDİ: kapanışta `VACUUM INTO` + `integrity_check` (`src/main/index.js`), `YYYY/MM` klasörleme.
- [x] **Veritabanı Geri Yükleme (Restore) Riski** — ÖDENDİ: restore öncesi `backup_before_restore_*.sqlite` + auto-recovery (`src/main/database/db.js`).
- [ ] **Disk şifreleme (TDE)** — Kalan: `better-sqlite3-multiple-ciphers@13.0.3` migrasyonu (Faz 2: `keystore.js` hazır, `db-compat` shim + `VACUUM INTO` key’li taşıma bekliyor).

## Orta Öncelik
- [ ] **Dinamik Excel Sütun Eşleştirme** — İlk versiyonda içeri aktarılacak Excel/CSV dosyalarının sabit bir şablonda (Örn: A sütunu İsim, B sütunu Yevmiye vb.) olması istenecek. İlerleyen süreçte kullanıcının sürükle-bırak ile "Bu sütun şu anlama geliyor" diyebileceği dinamik bir eşleştirme arayüzü yazılmalı.
- [ ] **Sıfıra Bölme Hatası (Mesai Hesabı)** — Ayarlardan "Standart günlük çalışma saati" `0` girilirse mesai saatlik ücret hesaplaması Infinity hatası veriyor. Backend (wageService) veya form girişinde doğrulama (validation) eklenmeli.

## Düşük Öncelik
- [ ] **Gelişmiş Filtreleme ve Loglama** — Kullanıcının hangi tarihte hangi puantajı değiştirdiğinin logları şu an tutulmuyor. İleride olası bir iç itiraz durumunda geçmişe dönük işlem logları (audit trail) tutulabilir.
- [ ] **Çöp Kutusu Veri Yükü (Soft-delete)** — Silinen kayıtlar Geri Dönüşüm kutusunda birikiyor, zamanla RAM yükünü artırabilir. Çok eski kayıtların otomatik kalıcı silinmesi (otomatik vacuum) veya arayüzde sayfalanması (pagination) entegre edilmeli.

## Ödenen Borçlar
- Henüz ödenen bir borç yok.
## Olcum 2026-10-11 (jscpd@4.0.5, --min-lines 30, src/main + src/renderer/src)
- 30 exact clone, 1853 satir (%7.79) duplikasyon. Kaynak: locale disi tekrarlar (export-to-excel kopyalari, unit option bloklari). Hedef: ortak exportUtils + sabit listelerle <%4.
