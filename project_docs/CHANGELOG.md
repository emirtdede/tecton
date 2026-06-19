# Değişiklik Geçmişi

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
