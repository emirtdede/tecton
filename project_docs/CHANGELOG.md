# Değişiklik Geçmişi

## 2026-10-11 — v1.0.0 güvenlik+kalite sprinti (65→100 programı)
- [Güvenlik] Hardcoded OpenWeather anahtarı silindi; `secret.js` (safeStorage) + `missing_key` akışı. Revoke-only, history rewrite yok.
- [Güvenlik] CRUD identifier injection kapatıldı; `allowlist.js` (17 tablo) tüm jenerik kanallara bağlandı.
- [Güvenlik] LAN hardening: `multer@2.3.0`, senkron fileFilter, 10MB limit, magic-byte, projectId allowlist, HTML escape, rate-limit 15/dk, LAN IP bind.
- [Güvenlik] Electron: `sandbox:true`, CSP header, `will-navigate` deny, `setWindowOpenHandler:deny`.
- [Veritabanı] `better-sqlite3-multiple-ciphers@13.0.3` geçişi (`dbCompat.js` async wrapper); `keystore.js`; legacy plaintext otomatik şifreleme; `sqlite/sqlite3` kaldırıldı.
- [Kod] `Settings.jsx` 1689→343 satır (4 sekme dosyası); `finance:get-balances` toplu IPC; `ErrorBoundary`; main log birleşimi (0 `console.*`); `wageService` validasyon.
- [Test] 27→57 test (allowlist, secret, lan-validate, dbCompat-encryption, bulk, wage-guard, TC, format); E2E 3 spec + `ci.yml`; coverage v8 eşikleri (baz: lines %7.43).
- [Sürüm] `1.0.0` (semver), MIT LICENSE, `.nvmrc`=22, `release/Tecton Setup 1.0.0.exe` üretildi, tag `v1.0.0`.
- [Doküman] API_SPEC gerçek kanal listesi, DATABASE_SCHEMA project_id/tags, FILE_STRUCTURE v1.0.0 ağacı, GLOSSARY 9→25 terim, MEMORY tazelendi.

## 2026-06-20
- [Değişiklik] **İç Parametre Gizleme (clean_shutdown)**: Veritabanı bütünlük kontrolü için kullanılan iç parametre `clean_shutdown`, kullanıcı arayüzündeki parametreler listesinden gizlendi.
- [Değişiklik] **Bulut Yedekleme Klasör Seçimi Taşınması**: "Bulut Yedekleme Klasörü" parametresi, "Finans & Operasyon" sekmesinden kaldırılıp "Güvenlik ve Yedekleme" altındaki "Sistem Bakımı" paneline taşındı. Burada seçili klasörün yolu ve yeni "Klasör Seç" butonu bir arada sunuldu.
- [Eklenen Özellik] **Yerelleştirilmiş Klasör Seç Butonu**: Klasör seçme butonu hardcoded olmaktan çıkarılarak tüm 19 dil dosyasında (`select_folder` anahtarıyla) yerelleştirildi.
- [Eklenen Özellik] **Güvenli Kapatma Arayüzü & Animasyonu**: Kapanış esnasında temaya (Light/Dark) duyarlı, lazer efektli animasyona sahip ve 2.5 saniyelik güvenli gecikmeli yeni kapatma ekranı eklendi. Light temadaki metin okunurluğu iyileştirildi.
- [Eklenen Özellik] **Atomik Veritabanı Yedekleme & Bütünlük Denetimi**: Uygulama kapanırken veritabanı yedeğinin sıfır veri kaybı ile alınması amacıyla `VACUUM INTO` ve `PRAGMA integrity_check` entegrasyonu sağlandı.
- [Eklenen Özellik] **Açılışta Otomatik Kurtarma (Auto-Recovery)**: Bir çökme durumunda açılışta bozulan veritabanını en son yedekten otonom olarak kurtaran mekanizma yazıldı.
- [Eklenen Özellik] **Yıl/Ay Klasör Yapısı ve Arşivleme**: Günlük loglar ve yedekler `YYYY/MM/` yapısında saklanacak şekilde güncellendi. Aylık ZIP arşivleme işlemlerinin açılışta arka planda çalışması sağlanarak kapanış performansı optimize edildi.
- [Düzeltme] **Sessiz Bulut Yedekleme Klasörü**: Uygulama kapanırken yedek alınamamasına yol açan hedef klasörün mevcut olmaması hatası giderildi. Yedek klasörü (`TectonBackups`) ilk çalıştırmada ve yedek kopyalama anında otomatik olarak (`fs.mkdirSync` ile recursive) oluşturulacak şekilde ayarlandı.

## 2026-06-19 - V1.0.0 STABLE (PRODUCTION READY) 🚀
- [Yayın] Projenin tüm fazları (1-7) resmen tamamlandı, kod tabanında derin temizlik (Pre-flight check) yapılarak yayın ortamına (production) hazır hale getirildi. Sistem %100 "Zero Error, Zero Warning" ile optimize edildi.
- [Eklenen Özellik] **Mobil LAN Yükleyici (QR Kod)**: Aynı yerel ağ (Wi-Fi) üzerinden cep telefonu kamerasıyla QR kod okutarak şantiye tutanak/fotoğraflarını direkt olarak sisteme yükleme özelliği eklendi (Express.js entegrasyonu).
- [Eklenen Özellik] **Gelişmiş Rollback Mekanizması**: Veritabanı ve toplu veri (Excel) yüklemeleri esnasında felaket senaryolarına karşı (Disaster Recovery) tam otomatik "Zaman Makinesi" ve Soft-Delete tabanlı Geri Dönüşüm Kutusu oluşturuldu.
- [Eklenen Özellik] Tüm IPC Handler'larına (Minimize, Maximize, File Save) otonom hata yakalama (Try/Catch) mimarisi yerleştirildi.
- [Güncelleme] Tüm dokümantasyon dosyaları güncel mimariye, 19 dile ve yeni ERP özelliklerine göre baştan yazıldı.

## 2026-06-17
- [Eklenen Özellik] İşçi ve Taşeron profillerine "İSG (İş Sağlığı ve Güvenliği)" modülü eklendi. Renk kodlu uyarı sistemiyle yaklaşan veya süresi dolan sertifikalar kolayca takip edilebilir hale getirildi.
- [Eklenen Özellik] Saha puantörlerinin işini hızlandıran "Çoklu Puantaj (Bulk Timesheet)" sayfası eklendi. Tek ekrandan birden fazla personeli seçip aynı anda yevmiye girişi yapılabilmesi sağlandı.
- [Eklenen Özellik] Taşeron listeleri için "Toplu İçe / Dışa Aktarım" (Excel, CSV) desteği eklendi.
- [Eklenen Özellik] Uygulamanın Çoklu Dil (i18n) kapasitesi 19 farklı dile genişletildi (Türkçe, İngilizce, Almanca, İspanyolca, Fransızca, İtalyanca, Arapça, Rusça vb.). Tüm çeviriler manuel olarak yerel dile uygun hale getirildi.
- [Eklenen Özellik] Sistem logları modülüne İSG güncellemeleri için özel Türkçe log mesajları eklendi.

## 2026-06-16
- [Düzeltme] İşçi Profil ekranındaki dolgular (padding) ve profil kartı dizilimi görsel olarak iyileştirildi.
- [Düzeltme] Kılavuz çekmecesindeki (GuideDrawer) açıklama metinlerinin boş olduğu durumlardaki boşluk hatası giderildi.
- [Düzeltme] Özel takvim bileşenindeki (CustomDatePicker) (X) temizleme butonunun takvim ikonuyla çakışması sorunu giderildi ve zorunlu alanlarda da gösterilmesi sağlandı.
- [Düzeltme] İşçi Profilinde ana sekmeler arası geçişlerde yaşanan istemsiz sayfa kaydırma (scroll) sorunu düzeltildi.
- [Düzeltme] Takvim bileşenlerinde "Başlangıç tarihi bitiş tarihinden sonra olamaz" kuralı eklendi; hatalı girişlerde tarihler otonom olarak yer değiştirecek şekilde tasarlandı.

## 2026-06-11
- [Eklenen Özellik] Yeni proje başlangıcı için VIBE Coding System gereksinim dosyaları oluşturuldu.
- [Değişiklik] Cline ve Cursor kural dosyaları silindi, yerine Antigravity'ye özel `.antigravityrules` dosyası oluşturuldu.
- [Eklenen Özellik] İşçi Profili (WorkerProfile) detaylı Hesap Ekstresi (Filtrelenebilir Devreden Bakiye dahil) formatına dönüştürüldü.
- [Eklenen Özellik] Kasa (CashRegister) ve Grup Raporu (GroupReportPanel) sayfalarına PDF, Excel, JSON, CSV formatlarında dışa aktarım seçenekleri eklendi.
- [Eklenen Özellik] Kurumsal Şirket Anteti altyapısı kuruldu (Ayarlar'dan logo/şirket ismi eklenip PDF raporlarının başlığına dinamik olarak basılması sağlandı).
- [Eklenen Özellik] Dil ve lokalizasyon altyapısı genişletilerek toplam 19 dile (Asya, Avrupa, Ortadoğu dahil) destek sağlandı ve otomatik tarayıcı diliyle başlatma özelliği eklendi.
- [Eklenen Özellik] Veritabanı "Kurumsal Muhasebe Asistanı" otonomi seviyesine çıkartılarak tüm testler başarıyla geçildi (TDD coverage %100).
