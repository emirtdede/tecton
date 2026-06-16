# Teknik Borç

## Yüksek Öncelik
- [ ] **Otomatik Veritabanı Yedekleme (Auto-Backup)** — Proje lokal çalıştığı için kullanıcının bilgisayarı bozulursa tüm veriler gidebilir. İlk sürümlerde manuel yedekleme yapılacak ancak en kısa sürede uygulamanın çıkışında veya belirli periyotlarda otomatik `.sqlite` kopyası alma özelliği eklenmeli.
- [ ] **Veritabanı Geri Yükleme (Restore) Riski** — Sürükle-bırak ile .sqlite yüklemesi anında mevcut veriyi eziyor. Yüklemeden hemen önce geçici otomatik backup (örn: `backup_before_restore.sqlite`) oluşturulması sağlanmalı.

## Orta Öncelik
- [ ] **Dinamik Excel Sütun Eşleştirme** — İlk versiyonda içeri aktarılacak Excel/CSV dosyalarının sabit bir şablonda (Örn: A sütunu İsim, B sütunu Yevmiye vb.) olması istenecek. İlerleyen süreçte kullanıcının sürükle-bırak ile "Bu sütun şu anlama geliyor" diyebileceği dinamik bir eşleştirme arayüzü yazılmalı.
- [ ] **Sıfıra Bölme Hatası (Mesai Hesabı)** — Ayarlardan "Standart günlük çalışma saati" `0` girilirse mesai saatlik ücret hesaplaması Infinity hatası veriyor. Backend (wageService) veya form girişinde doğrulama (validation) eklenmeli.

## Düşük Öncelik
- [ ] **Gelişmiş Filtreleme ve Loglama** — Kullanıcının hangi tarihte hangi puantajı değiştirdiğinin logları şu an tutulmuyor. İleride olası bir iç itiraz durumunda geçmişe dönük işlem logları (audit trail) tutulabilir.
- [ ] **Çöp Kutusu Veri Yükü (Soft-delete)** — Silinen kayıtlar Geri Dönüşüm kutusunda birikiyor, zamanla RAM yükünü artırabilir. Çok eski kayıtların otomatik kalıcı silinmesi (otomatik vacuum) veya arayüzde sayfalanması (pagination) entegre edilmeli.

## Ödenen Borçlar
- Henüz ödenen bir borç yok.