# API / IPC Spesifikasyonu

Proje yerel çalıştığı için HTTP istekleri yerine Electron IPC (invoke/handle) yapısı kullanılmaktadır.

## İşçi Yönetimi (Workers)

### Kanal: `workers:getAll`
Açıklama: Sistemdeki tüm işçileri listeler.
Parametreler: Yok
Dönen Değer: `Array<{ id, full_name, phone, daily_wage, status }>`

### Kanal: `workers:getById`
Açıklama: Tek bir işçinin detaylarını getirir.
Parametreler: `{ id: number }`
Dönen Değer: `{ id, full_name, phone, daily_wage, start_date, status }`

### Kanal: `workers:create`
Açıklama: Yeni bir işçi kaydeder.
Parametreler: `{ full_name, phone, daily_wage, start_date }`
Dönen Değer: `{ success: boolean, id: number, message: string }`

## Puantaj ve Yevmiye (Timesheets)

### Kanal: `timesheets:add`
Açıklama: İşçiye günlük puantaj girer ve hak edişi otomatik hesaplar.
Parametreler: `{ worker_id, work_date, work_type, notes }`
Dönen Değer: `{ success: boolean, earned_amount: number }`

### Kanal: `timesheets:getByWorker`
Açıklama: İşçinin belirli bir tarih aralığındaki puantaj dökümünü getirir.
Parametreler: `{ worker_id, start_date, end_date }`
Dönen Değer: `Array<{ id, work_date, work_type, earned_amount }>`

## Dışa / İçe Aktarım (Import / Export)

### Kanal: `import:parseExcel`
Açıklama: Seçilen Excel/CSV dosyasını okuyup ham veri olarak frontend'e gönderir. İşçi kayıtları için kullanılır.
Parametreler: `{ filePath: string }`
Dönen Değer: `Array<Object> (Satır ve Sütun Verileri)`

### Kanal: `import:parseSubcontractors`
Açıklama: Taşeron listesini içeren Excel/CSV dosyasını okur ve UI formuna/doğrudan DB'ye aktarım için verileri hazırlar.
Parametreler: `{ filePath: string }`
Dönen Değer: `Array<Object> (Taşeron Verileri)`

### Kanal: `export:generateExcel`
Açıklama: Aktif personel listesini, İSG tarihleriyle birlikte sistemin diline uygun başlıklarla Excel formatında kaydeder.

### Kanal: `export:generateSubcontractorExcel`
Açıklama: Aktif taşeron listesini sistemin diline uygun başlıklarla (i18n) Excel formatında kaydeder.

### Kanal: `export:generatePDF`
Açıklama: Verilen hesap ekstresini PDF'e dönüştürüp bilgisayara kaydeder.
Parametreler: `{ worker_id, htmlContent, month }`
Dönen Değer: `{ success: boolean, filePath: string }`

## Sistem Veritabanı Jenerik Kanalları (CRUD)

### Kanal: `db:read`
Açıklama: Herhangi bir tablodan veri okumayı sağlar. `is_deleted = 0` filtresini otomatik uygular (gerekirse pas geçilebilir).
Parametreler: `(tableName, whereClause)`
Dönen Değer: `Array<Object>`

### Kanal: `db:create`
Açıklama: Herhangi bir tabloya yeni kayıt ekler. İşlem sonrası otomatik olarak `audit_logs` tablosuna INSERT işlemi loglanır.
Parametreler: `(tableName, data)`
Dönen Değer: `{ success: boolean, id: number, message: string }`

### Kanal: `db:update`
Açıklama: Herhangi bir tablodaki veriyi günceller. Değişen değerleri eski-yeni (old_values, new_values) olarak `audit_logs` tablosuna "Human-Readable" (Türkçe metinli) formatta kaydeder.
Parametreler: `(tableName, id, data)`
Dönen Değer: `{ success: boolean, message: string }`

### Kanal: `db:delete`
Açıklama: Fiziksel silme yerine (Soft-Delete) yapar. İlgili kaydın `is_deleted` değerini 1 yapar ve çöp kutusuna taşır.
Parametreler: `(tableName, id)`
Dönen Değer: `{ success: boolean, message: string }`

## Çoklu İşlemler (Bulk Operations)

### Kanal: `finance:calculateWage` (Bulk Timesheet Loop Kullanımı)
Açıklama: Çoklu puantaj (Bulk Timesheet) arayüzünden seçilen her bir personel için döngü içinde çağrılarak, personelin günlük yevmiyesi ve seçilen çalışma tipinin çarpanıyla hak edişi hesaplanır ve arka arkaya `db:create` kanalına gönderilir.

## Yerel Ağ (LAN) Sunucu API'leri (Express.js)

### Endpoint: `GET /api/ping`
Açıklama: Mobil cihazın sunucuya erişip erişemediğini test eder.
Dönen Değer: `{ status: 'ok', timestamp: number }`

### Endpoint: `GET /api/projects`
Açıklama: Şantiyedeki aktif projeleri JSON olarak döndürür. Mobilden İrsaliye/Tutanak/İmalat girişi yaparken proje seçtirmek için kullanılır.
Dönen Değer: `Array<{ id, name }>`

### Endpoint: `POST /api/upload`
Açıklama: İrsaliye veya Kalite Raporu (Tutanak) fotoğraflarını mobil cihazdan sisteme yükler.
Parametreler: `multipart/form-data` (photo, targetFolder, projectId)
Dönen Değer: `{ success: boolean, filePath: string }`

### Endpoint: `POST /api/submit-record`
Açıklama: Mobil cihazdan girilen form verilerini (İrsaliye, Kalite Kontrol, İmalat, Günlük Jurnal) Electron veritabanına yazar.
Parametreler: `JSON Object` (tableName, data)
Dönen Değer: `{ success: boolean, message: string }`