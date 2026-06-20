<div align="center">

# 📘 Tecton: Next-Generation Construction Site Operating System

[![](https://img.shields.io/badge/Language-English-blue?style=for-the-badge&logo=google-translate)](#english-version)
&nbsp;&nbsp;&nbsp;&nbsp;
[![](https://img.shields.io/badge/Dil-T%C3%BCrk%C3%A7e-red?style=for-the-badge&logo=google-translate)](#turkish-version)

---

[![Electron](https://img.shields.io/badge/Electron-v29.1-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-v18.2-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![SQLite3](https://img.shields.io/badge/SQLite3-v5.1-003B57?style=flat-square&logo=sqlite)](https://www.sqlite.org/)
[![Vite](https://img.shields.io/badge/Vite-v5.2-646CFF?style=flat-square&logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v3.4-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com/)

</div>

---

<a id="english-version"></a>
# English Version

> **🎉 V1.0.0 STABLE (PRODUCTION READY)**: The project has successfully passed all development phases, boasting a "Zero Error, Zero Warning" optimized codebase.

Tecton is an autonomous, offline-first corporate desktop application designed to replace physical general ledgers by digitizing worker timesheets, progress payments (hak ediş), advances (avans), cash register balances, materials, subcontractor ledgers, and site daily journals. It operates completely independent of external APIs or accounting servers, providing mathematically absolute consistency under a zero-maintenance, zero-dependency philosophy.

---

## 🚀 Key Features & User Experience (UX)

*   **Premium Visuals & Dynamic Themes**:
    *   Sleek dashboard layout with glassmorphic cards, smooth hover micro-animations, and curated harmonic HSL color palettes.
    *   **Theme-Aware Animations**: Interactive laser scanning overlays on both startup (splash screen) and shutdown, reinforcing visual feedback and ensuring operations finish securely.
    *   Seamless toggle between Light and Dark modes.
*   **👥 Worker Profile & Algorithmic Verification**:
    *   Comprehensive profile sheets showing historical balances, combined with strict 11-digit algorithm-based Turkish Identification Number (TC Kimlik) validation.
    *   Color-coded custom tags for categorizing workers and ledger transactions.
*   **🛠️ Dynamic Work Types & Multipliers**:
    *   Work classifications (Full-Day, Half-Day, Overtime, Sunday shifts) and coefficients are completely customizable in the settings, eliminating hardcoded calculations.
*   **📊 Integrated Ledger & Cash Register Synchronization**:
    *   Advances, payments, and deductions map automatically between Personal Ledgers and the Cash Register. Modifying or deleting one automatically syncs the other.
*   **⏳ Historical Value Integrity (Snapshotting)**:
    *   Timesheet rates and multipliers are hard-copied directly to the database on entry. Modifying global coefficients in the future will never alter past financial records.
*   **🧮 Summed-on-Demand Balances**:
    *   Balances are calculated dynamically using `SUM()` commands during execution rather than stored as hardcoded values, preventing discrepancies.
*   **📋 Multi-Format Exports**:
    *   One-click exports of filtered datasets into Excel (`.xlsx`), CSV, JSON (AI-ready structured format), and PDF.
*   **🗑️ Data Recovery & Soft Delete**:
    *   Deleted records are routed to an interactive Archive (Trash Bin) where they can be restored with a single click.
*   **💾 Zero-Maintenance Backups & Auto-Recovery**:
    *   **Atomic Shutdown Backup**: Triggers SQLite `VACUUM INTO` and `PRAGMA integrity_check` on app close.
    *   **Auto-Recovery**: If database corruption is detected on launch, Tecton automatically finds and restores the latest valid backup.
    *   **Year/Month Structuring**: Daily backups and logs are organized in nested `YYYY/MM/` folders.
    *   **Background Archiving**: Squeezes previous months' backups into ZIP archives on startup to avoid freezing the app upon closing.
*   **📝 Human-Readable Log Archiving**:
    *   System events are converted into natural language sentences (Turkish) using `electron-log` and stored locally, exportable in various formats.
*   **📱 Mobile LAN Uploader**:
    *   Instant photo upload from mobile phones via a local network QR code, without sending data to public cloud servers.

---

## 🛠️ Technology Stack & Technical Details

### Frontend Architecture
*   **Core UI**: React (v18.2) structured in modular components.
*   **Styling**: Vanilla Tailwind CSS (v3.4) with custom interactive utilities.
*   **Icons**: Lucide React for consistent vector design.
*   **Localization (i18n)**: Comprehensive Multi-Language support for 19 languages using `i18next`.
*   **Document Generation**: jsPDF (PDF layouts) and SheetJS (`xlsx`) for local client-side sheet exports.

### Backend Architecture
*   **Shell**: Node.js and Electron (v29.1) container.
*   **IPC Communication**: Secure `ipcMain` and `ipcRenderer` bridges using context isolation (`preload.js`) to expose narrow backend APIs to the frontend.
*   **Local Network Server**: Express.js server instances spun up locally to facilitate secure photo uploading via QR-code scanning within the same local network (Wi-Fi).
*   **File Management**: Native `fs` modules handles log rotations, dynamic directories (`TectonBackups/YYYY/MM`), and file compression using `adm-zip` on startup.

### Database Layer
*   **Engine**: SQLite3 relational file database (`sqlite3` & `sqlite`).
*   **Integrity System**: Automated migration and table setup, combined with strict transaction bounds. Runs integrity checks on unclean shutdowns and performs automated database optimizations (`VACUUM`).

---

## 📁 Project Structure

```text
Tecton-Yeni-Nesil-Santiye-Isletim-Sistemi/
├── project_docs/              # Architectural specs, DB schemas, and Vibe guidelines
├── scripts/                   # Database seeding and migration automation scripts
├── src/                       # Source code directory
│   ├── main/                  # Electron main process (IPC, window lifecycle, DB hooks, Express server)
│   └── renderer/              # React components, style sheets, and translation locales
├── database.sqlite            # Local SQLite database file
├── tailwind.config.js         # Tailwind styling attributes
├── vite.config.js             # Vite development configurations
└── package.json               # Dependencies and execution script definitions
```

---

## ⚙️ Setup & Execution Guide

### Prerequisites
*   Node.js 18+ installed on your system.

### 1. Install Dependencies
Clone the repository and install the packages:
```bash
git clone https://github.com/emirtdede/Tecton-Yeni-Nesil-Santiye-Isletim-Sistemi.git
cd Tecton-Yeni-Nesil-Santiye-Isletim-Sistemi
npm install
```

### 2. Run Database Seeding (Optional)
Populate the local database with faker-based dummy data for testing:
```bash
npm run seed
```

### 3. Run in Development Mode
Start both the React development server and the Electron container simultaneously:
```bash
npm run dev
```

### 4. Package Standalone App
Compile the application into a standalone Windows installer using `electron-builder`:
```bash
npm run build
```
The compiled installer will be saved inside the `release/` directory.

---

## ⚖️ License
Licensed under the MIT License. Developed for internal enterprise usage.

---

<a id="turkish-version"></a>
# Türkçe Versiyon

> **🎉 V1.0.0 STABLE (PRODUCTION READY)**: Projenin tüm geliştirme fazları başarıyla tamamlanmış, QA denetimlerinden geçmiş ve %100 "Zero Error, Zero Warning" durumu ile canlı yayına (production) hazır hale gelmiştir.

**Tecton: Yeni Nesil Şantiye İşletim Sistemi**; fiziksel yevmiye defterlerinin yerini alarak işçi puantaj, hak ediş, avans, malzeme, kasa, taşeron cari takibi ve şantiye günlük raporlama işlemlerini dijitalleştiren; resmi muhasebe sistemlerinden tamamen bağımsız, tamamen yerel (offline) çalışan, sıfır kod değişikliği ve sıfır bakım gereksinimi (zero-maintenance) felsefesiyle tasarlanmış otonom bir masaüstü uygulamasıdır.

---

## 🚀 Öne Çıkan Özellikler & Kullanıcı Deneyimi (UX)

*   **Premium Tasarım & Dinamik Temalar**:
    *   Glassmorphism (cam tasarımı) kartlar, yumuşak mikro animasyonlar ve özenle seçilmiş HSL renk paletlerine sahip modern arayüz.
    *   **Temaya Duyarlı Animasyonlar**: Açılış ve kapanışta (shutdown overlay) çalışan lazer tarayıcı efekti ile kullanıcıya görsel geribildirim sunulur, işlemler güvenle bitirilir.
    *   Açık (Light) ve Koyu (Dark) temalar arasında anında geçiş.
*   **👥 İşçi Sicil ve Algoritmik Doğrulama**:
    *   İşçi profili, detaylı bakiye dökümleri ve 11 haneli algoritma tabanlı TC Kimlik numarası doğrulama zorunluluğu.
    *   İşçi ve işlemleri gruplamak için özelleştirilebilir renkli etiketler.
*   **🛠️ Dinamik Çalışma Tipleri ve Katsayılar**:
    *   "Tam Gün", "Yarım Gün", "Mesai", "Pazar Mesaisi" gibi çalışma tipleri ve çarpan katsayıları koda sabitlenmez (hardcode edilmez). Ayarlar sayfasından kolayca özelleştirilebilir.
*   **📊 Cari ve Kasa Otomasyonu**:
    *   İşçilere yapılan avans, ödeme ve kesintiler Kasa ve Cari tarafında otomatik eşleşir; bir tarafta yapılan güncelleme veya silme işlemi diğer tarafı da otonom olarak senkronize eder.
*   **⏳ Tarihsel Bütünlük (Değer Mühürleme)**:
    *   Puantaj girildiğinde, o günkü yevmiye ve çarpan katsayısı veritabanına mühürlenir (Snapshot). Kullanıcı aylar sonra katsayıları değiştirse dahi geçmiş hesaplamalar ve hak edişler ASLA bozulmaz.
*   **🧮 Dinamik Bakiye Hesaplama**:
    *   İşçilerin toplam bakiyeleri veritabanında sabit bir değer olarak tutulmaz. Bakiyeler daima ve anlık olarak girilen puantaj ve cari işlemlerin `SUM()` komutuyla dinamik hesaplanmasıyla elde edilir. Bu durum %100 matematiksel tutarlılığı garanti eder.
*   **📋 Çoklu Format Dışa Aktarım**:
    *   Filtrelenmiş veya tüm listelerin anında Excel (`.xlsx`), CSV, JSON (Yapay zeka analizine uyumlu) ve görsel mutabakat için PDF formatında indirilebilmesi.
*   **🗑️ Veri Kurtarma ve Arşiv (Soft Delete)**:
    *   Yanlışlıkla silinen kayıtlar kalıcı olarak yok edilmez. Arayüz üzerindeki "Çöp Kutusu" (Arşiv) alanı üzerinden tek tıkla geri yüklenebilir.
*   **💾 Sıfır Bakım ve Otomatik Hata Kurtarma**:
    *   **Atomik Kapanış Yedeklemesi**: Uygulama kapatılırken otomatik `VACUUM INTO` ve `PRAGMA integrity_check` ile sıfır veri kaybı garantisi.
    *   **Otomatik Geri Yükleme**: Veritabanı dosyasının bozulduğu durumlarda en son geçerli yedeği bularak sistemi ayağa kaldıran mekanizma.
    *   **Yıl/Ay Yapılandırması**: Yedek ve günlük loglar `TectonBackups/YYYY/MM` klasörleri altında toplanır.
    *   **Arka Planda Arşivleme**: Kapanışta gecikme yaşanmaması için eski ayların yedekleri açılışta arka planda otomatik ZIP formatında sıkıştırılır.
*   **📝 İnsan Dilinde Log Arşivleme**:
    *   Sistem logları, insan tarafından okunabilir (Human-Readable) Türkçe cümleler halinde `electron-log` ile kaydedilir. TXT, Markdown, JSON, CSV ve Excel formatlarında dışa aktarılabilir.
*   **📱 Mobil LAN Yükleyici**:
    *   Aynı yerel ağ (Wi-Fi) üzerinden cep telefonu kamerasıyla QR kod okutarak şantiye tutanak/fotoğraflarını bulut sunuculara göndermeden, yerel ağdan direkt olarak sisteme yükleme imkanı.

---

## 🛠️ Kullanılan Teknolojiler & Teknik Detaylar

### Önyüz (Frontend) Detayları
*   **Arayüz Kitaplığı**: React (v18.2) modüler ve yeniden kullanılabilir bileşen yapısı.
*   **Stil Yönetimi**: Özelleştirilmiş Tailwind CSS (v3.4).
*   **İkonlar**: Lucide React vektörel kütüphane.
*   **Çoklu Dil (i18n)**: `i18next` altyapısı ile 19 dilde anında ve yerel terimlere uygun çeviri desteği.
*   **Doküman Üretimi**: Tarayıcı tarafında çalışan jsPDF ve SheetJS (`xlsx`) entegrasyonu.

### Arkayüz (Backend) Detayları
*   **Çalışma Ortamı**: Node.js & Electron (v29.1) masaüstü kabuğu.
*   **Güvenlik & IPC**: `preload.js` köprüsü üzerinden kısıtlı ve güvenli IPC kanalları (`contextBridge`).
*   **Yerel Ağ Sunucusu**: Express.js yerel ağ görüntü yükleme sunucusu.
*   **Dosya İşlemleri**: `fs` ile günlük log rotasyonu, `TectonBackups/YYYY/MM` dinamik klasörleme ve `adm-zip` tabanlı arka plan sıkıştırma sistemi.

### Veritabanı Katmanı
*   **Altyapı**: SQLite3 ilişkisel yerel dosya veritabanı.
*   **Güvenlik**: Kapatılırken bütünlük denetimi (`PRAGMA integrity_check`) ve otomatik veritabanı optimizasyonu (`VACUUM`). Açılışta yedekten otomatik sistem kurtarma (Auto-Recovery).

---

## 📁 Proje Yapısı

```text
Tecton-Yeni-Nesil-Santiye-Isletim-Sistemi/
├── project_docs/              # Proje mimarisi, DB şeması ve Vibe Coding kılavuzları
├── scripts/                   # Veritabanı test verisi ekleme ve göç betikleri
├── src/                       # Kaynak kod dizini
│   ├── main/                  # Electron ana süreç kodları (IPC, pencere yönetimi, DB, Express sunucusu)
│   └── renderer/              # React bileşenleri, stil kodları ve yerelleştirme dosyaları
├── database.sqlite            # Yerel SQLite veritabanı dosyası
├── tailwind.config.js         # Tailwind yapılandırma dosyası
├── vite.config.js             # Vite derleme parametreleri
└── package.json               # Bağımlılıklar ve çalıştırma komutları
```

---

## ⚙️ Kurulum ve Çalıştırma

### Önkoşullar
*   Bilgisayarınızda Node.js 18+ kurulu olmalıdır.

### 1. Bağımlılıkları Yükleyin
Depoyu klonlayıp paketleri yükleyin:
```bash
git clone https://github.com/emirtdede/Tecton-Yeni-Nesil-Santiye-Isletim-Sistemi.git
cd Tecton-Yeni-Nesil-Santiye-Isletim-Sistemi
npm install
```

### 2. Test Verisi Ekleme (Opsiyonel)
Veritabanını test etmek amacıyla faker tabanlı sahte verilerle doldurmak için:
```bash
npm run seed
```

### 3. Geliştirici Ortamında Başlatın
React sunucusunu ve Electron masaüstü kabuğunu aynı anda başlatmak için:
```bash
npm run dev
```

### 4. Kurulum Dosyası (.exe) Paketleme
Uygulamayı nsis tabanlı bağımsız bir Windows kurulum dosyası haline getirmek için:
```bash
npm run build
```
Derlenen kurulum setup dosyası `release/` klasöründe yer alacaktır.

---

## ⚖️ Lisans
Bu proje [MIT Lisansı](LICENSE) kapsamında lisanslanmıştır. Kurumsal kapalı kullanım amacıyla geliştirilmiştir.
