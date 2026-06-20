# Proje Hafızası

Son güncelleme: 2026-06-20

## Proje Özeti
Elektronik Yevmiye Defteri; internetsiz (offline) çalışan, işçi puantaj ve avans/cari takibini yerel veritabanında tutan, Electron + React tabanlı bir iç denetim yazılımıdır. Şantiye yönetimi, taşeron takibi, çoklu dil (19 dil), İSG takibi ve mobil fotoğraf entegrasyonu (LAN) gibi modüllere sahip otonom bir Kurumsal ERP sistemidir.

## Teknik Özet
- Frontend: React.js (Tailwind CSS)
- Backend: Node.js (Electron IPC, Express.js LAN)
- DB: SQLite (Yerel, Gelişmiş Rollback ve Soft Delete)
- Auth: Tek Kullanıcı / Yerel Erişim (Giriş ekranı yok)

## Şu Anki Durum
V1.0.0 Stable (Production Ready). Projenin tüm fazları (Faz 1 - Faz 7) tamamlanmış, QA denetimlerinden geçmiş ve gereksiz kodlardan arındırılmıştır. Sistem hatasız (Zero Error, Zero Warning) çalışacak şekilde optimize edilmiştir.

## Son Yapılan İş
- **İç Parametre Gizleme & Bulut Yedekleme Klasör Seçimi**: Sistem durum parametresi `clean_shutdown` kullanıcı parametreler listesinden gizlendi. "Bulut Yedekleme Klasörü" parametresi, "Finans & Operasyon" sekmesinden kaldırılıp "Güvenlik ve Yedekleme" altındaki "Sistem Bakımı" paneline yeni bir giriş alanı ve yerelleştirilmiş (19 dile çevrilmiş) "Klasör Seç" butonu ile taşındı.
- **Güvenli Kapatma Ekranı ve Animasyonu**: Uygulamanın kapanışında veritabanı işlemlerinin yarıda kalmaması için 2.5 saniyelik güvenli gecikmeye sahip, temaya duyarlı ve lazer tarayıcı efektli özel bir kapatma arayüzü (shutdown overlay) eklendi.
- **Atomik Veritabanı Yedekleme**: Veritabanının kapatılırken güvenli yedeğinin alınması amacıyla `VACUUM INTO` ve `PRAGMA integrity_check` entegrasyonu sağlandı.
- **Hata Kurtarma (Auto-Recovery)**: Uygulama açılışında veritabanı dosyasının bozulmuş olması durumunda, en güncel yedek dosyasını otomatik bularak geri yükleyen hata kurtarma mekanizması kuruldu.
- **Yıl/Ay Klasör Yapısı ve Arşivleme**: Günlük yedekler ile günlük loglar artık `YYYY/MM/` şeklinde klasörlenmektedir. Uygulama açılışında önceki aylara ait log/yedek klasörlerinin otonom olarak sıkıştırılıp (ZIP) arşivlenmesi sağlandı; bu sayede kapanış süresi minimize edildi.

## Dikkat Edilmesi Gerekenler
- Tüm veriler kullanıcının kendi makinesinde (SQLite) tutulmalıdır.
- LAN Fotoğraf Yükleyicisi sadece aynı yerel ağdaki (offline) cihazlar arasında çalışır.
- Node.js sürümü uyumsuzluğu sebebiyle Windows C++ Build Tools ihtiyacı olabilir (`sqlite3` native derleme sorunu).
- Excel/CSV parse işlemleri performansı etkilememesi için frontend'de değil, arka planda (Node.js/Electron) yapılmaktadır.
- Uygulama kapatılırken `before-quit` ve `will-quit` süreçlerinde veritabanının bütünlüğü garanti altına alınana kadar kapatma ekranı görünür kalır.