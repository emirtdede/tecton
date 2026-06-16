# Değişiklik Geçmişi

## 2026-06-16
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
