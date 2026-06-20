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
Sessiz otomatik bulut yedekleme klasörünün (`TectonBackups`) uygulama ilk açılışında ve kapanışında otomatik olarak (`fs.mkdirSync` ile) oluşturulmasını sağlayan düzeltmeler yapıldı ve uygulamanın yeniden derlenmesi (build) sağlandı.

## Dikkat Edilmesi Gerekenler
- Tüm veriler kullanıcının kendi makinesinde (SQLite) tutulmalıdır.
- LAN Fotoğraf Yükleyicisi sadece aynı yerel ağdaki (offline) cihazlar arasında çalışır.
- Node.js sürümü uyumsuzluğu sebebiyle Windows C++ Build Tools ihtiyacı olabilir (`sqlite3` native derleme sorunu).
- Excel/CSV parse işlemleri performansı etkilememesi için frontend'de değil, arka planda (Node.js/Electron) yapılmaktadır.