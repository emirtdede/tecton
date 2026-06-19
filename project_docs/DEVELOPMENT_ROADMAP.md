# Geliştirme Yol Haritası

## V1 — Temel İskelet ve İşçi Yönetimi
- [x] Electron, React ve SQLite kurulumlarının yapılıp projenin ayağa kaldırılması.
- [x] Veritabanı tablolarının (migration) oluşturulması.
- [x] İşçi Ekleme, Listeleme, Düzenleme (CRUD) modüllerinin tamamlanması.
- [x] İşçi detay/profil ekranının temel arayüzünün yapılması.

## V2 — Puantaj ve Finansal Hareketler
- [x] Puantaj giriş modülü (Tam, yarım gün vb. işaretleme).
- [x] İşçiye göre otomatik hak ediş hesaplama mantığının kurulması.
- [x] Avans, Kesinti ve Ödeme giriş ekranlarının tamamlanması.
- [x] İşçi bakiyesinin (Alacak - Borç = Kalan) anlık olarak profiline yansıtılması.

## V3 — Kasa ve Excel İçe Aktarım
- [x] Merkez Kasa modülü (İşçiye yapılan ödemelerin kasadan düşülmesi).
- [x] Dosya yükleme modülü (Excel/CSV seçme ve önizleme).
- [x] Excel sütunlarını veritabanı alanlarıyla eşleştirip içeri aktarma (Import) mekanizması.

## V4 — Raporlama ve Çıktı Üretimi
- [x] İşçi bazlı "Aylık Hesap Ekstresi" oluşturulması.
- [x] Ekstrenin PDF formatında dışa aktarılması (Export) ve yazdırılabilir hale getirilmesi.
- [x] Şirket genel işçilik maliyeti ve avans toplamlarını gösteren Dashboard tasarımı.

## V5 — Kurumsal Mimari ve İleri Seviye Özellikler
- [x] İki Katmanlı Gelişmiş Loglama (Advanced Logging) ve Sistem Kayıtları arayüzü.
- [x] Uluslararasılaştırma (i18n - 19 Dil) desteği ve Dinamik Kurumsal Antet yapısı.
- [x] SQLite Otonom Bakım (VACUUM), Zaman Makinesi ve Sessiz Bulut Yedekleme.

## V6 — İSG, Taşeron ve Çoklu Puantaj
- [x] İşçi ve Taşeronlar için İSG (İş Sağlığı ve Güvenliği) eğitim ve sertifika takip modülü.
- [x] Taşeron cari takibi ve toplu (bulk) Excel/CSV ile içe aktarımı.
- [x] Çoklu personeli aynı anda seçip yevmiye girişi yapılabilen Çoklu Puantaj (Bulk Timesheet) ekranı.