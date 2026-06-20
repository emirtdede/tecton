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

An autonomous, offline-first corporate desktop application designed to replace physical general ledgers by digitizing worker timesheets, progress payments (hak ediş), advances (avans), and cash register balances. It operates completely independent of external APIs or accounting servers, providing mathematically absolute consistency under a zero-maintenance philosophy.

---

## 🚀 Key Features

*   **👥 Worker Profile & Algorithmic Verification**: Detailed profile sheets showing historical balances, combined with strict 11-digit algorithm-based Turkish Identification Number (TC Kimlik) validation.
*   **🛠️ Dynamic Work Types & Multipliers**: Work classifications (Full-Day, Half-Day, Overtime, Sunday shifts) are completely customizable in the settings, eliminating hardcoded calculations.
*   **📊 Integrated Ledger & Cash Register Synchronization**: Advances, payments, and deductions map automatically between Personal Ledgers and the Cash Register. Deleting or modifying one automatically syncs the other.
*   **⏳ Historical Value Integrity (Snapshotting)**: Timesheet rates and multipliers are hard-copied directly to the database on entry. Modifying global coefficients in the future will never alter past financial records.
*   **🧮 Summed-on-Demand Balances**: Balances are calculated dynamically using `SUM()` commands during execution rather than stored as hardcoded values, ensuring mathematical consistency.
*   **📋 Multi-Format Exports**: One-click exports of filtered datasets into Excel (`.xlsx`), CSV, JSON (AI-ready structured format), and PDF.
*   **🗑️ Data Recovery & Soft Delete**: Deleted records are routed to an interactive Archive (Trash Bin) where they can be restored with a single click.
*   **💾 Zero-Maintenance Backups & Tuning**:
    *   One-click database download (`database.sqlite`) from the settings.
    *   **Auto-optimize**: Triggers SQLite `VACUUM` to clean and speed up tables.
    *   **Automated daily restore points** allow a 24-hour window to undo mistakes.
    *   Silent background backups automatically save to local cloud sync directories (e.g., Google Drive local folders) on exit.
*   **📝 Human-Readable Log Archiving**: Daily rotated logs mapped via `electron-log` are written in plain, human-readable Turkish sentences (rather than raw JSON structures). Log streams are exportable into TXT, Markdown (AI-ready), JSON, CSV, and Excel.
*   **🏷️ Colored Tags & Anomaly Detection**: Supports custom tag assignments to transactions and workers, alongside an active Anomaly Panel alerting admins to negative balances or idle personnel.
*   **🌎 Localized UI & Themes**: Seamless toggle between Light/Dark modes and full translation support for 19 languages (Turkish, English, Chinese, Spanish, French, Arabic, Hindi, Russian, Portuguese, German, and 9 more).
*   **👥 Multi-Attendance (Çoklu Puantaj)**: Fast batch attendance entry for multiple workers at once.
*   **👷 OHS Integration (İSG Entegrasyonu)**: Built-in Occupational Health and Safety tracking and reporting.
*   **⏪ Advanced DB Rollback Mechanism**: Enhanced disaster recovery and state reversion.
*   **📊 Subcontractor Excel Import Fallback**: Robust error handling rules for importing messy Subcontractor ledgers.
*   **📱 Mobile LAN Uploader**: Instant photo upload from mobile phones via local network QR code.

---

## 🛠️ Technology Stack

*   **Frontend**: React (v18.2), Vite (bundler), Tailwind CSS (layout styling), Lucide React (icons), i18next (locale translation)
*   **Backend**: Node.js & Electron (v29.1) runtime shell
*   **Database**: SQLite3 relational file database
*   **Document Generation**: jsPDF (PDF layouts), SheetJS/xlsx (Excel exports)

---

## 📁 Project Structure

```text
Tecton-Yeni-Nesil-Santiye-Isletim-Sistemi/
├── project_docs/              # Architectural specs, DB schemas, and Vibe guidelines
├── scripts/                   # Database seeding and migration automation scripts
├── src/                       # Source code directory
│   ├── main/                  # Electron main process (IPC, window lifecycle, DB hooks)
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

**Tecton: Yeni Nesil Şantiye İşletim Sistemi**; fiziksel yevmiye defterlerinin yerini alarak işçi puantaj, hak ediş, avans ve kasa takibini dijitalleştiren; resmi muhasebe sistemlerinden tamamen bağımsız, tamamen yerel (offline) çalışan, sıfır kod değişikliği ve sıfır bakım gereksinimi (zero-maintenance) felsefesiyle tasarlanmış otonom bir masaüstü uygulamasıdır.

---

## 🚀 Öne Çıkan Özellikler

*   **👥 İşçi Sicil ve Algoritmik Doğrulama**: İşçi profili, günlük/aylık ücret tanımları ve anlık bakiye gösterimi ile birlikte 11 haneli algoritma tabanlı TC Kimlik numarası doğrulama zorunluluğu.
*   **🛠️ Dinamik Çalışma Tipleri ve Mesai**: "Tam Gün", "Yarım Gün", "Mesai", "Pazar Mesaisi" gibi çalışma tipleri ve çarpan katsayıları koda sabitlenmez (hardcode edilmez). Ayarlar sayfasından sınırsızca özelleştirilebilir.
*   **📊 Cari ve Kasa Otomasyonu**: İşçilere yapılan avans, ödeme ve kesintiler Kasa ve Cari tarafında otomatik eşleşir; bir tarafta yapılan güncelleme veya silme işlemi diğer tarafı da otonom olarak senkronize eder.
*   **⏳ Tarihsel Bütünlük (Değer Mühürleme)**: Puantaj girildiğinde, o günkü yevmiye ve çarpan katsayısı veritabanına mühürlenir (Snapshot). Kullanıcı aylar sonra katsayıları değiştirse dahi geçmiş hesaplamalar ve hak edişler ASLA bozulmaz.
*   **🧮 Dinamik Bakiye Hesaplama**: İşçilerin toplam bakiyeleri veritabanında sabit bir değer olarak tutulmaz. Bakiyeler daima ve anlık olarak girilen puantaj ve cari işlemlerin `SUM()` komutuyla dinamik hesaplanmasıyla elde edilir. Bu durum %100 matematiksel tutarlılığı garanti eder.
*   **📋 Çoklu Format Dışa Aktarım**: Filtrelenmiş veya tüm listelerin anında Excel (`.xlsx`), CSV, JSON (Yapay zeka analizine uyumlu) ve görsel mutabakat için PDF formatında indirilebilmesi.
*   **🗑️ Veri Kurtarma ve Arşiv (Soft Delete)**: Yanlışlıkla silinen kayıtlar kalıcı olarak yok edilmez. Arayüz üzerindeki "Çöp Kutusu" (Arşiv) alanı üzerinden tek tıkla geri yüklenebilir.
*   **💾 Sıfır Bakım ve Yedekleme**:
    *   Ayarlar sayfasından tek tıkla tüm veritabanı dosyasının (`database.sqlite`) indirilebilmesi.
    *   **Veritabanı Optimizasyonu**: SQLite `VACUUM` çalıştırarak veritabanı dosyasını temizler ve hızlandırır.
    *   24 saat aktif "Son İşlemi Geri Al" olanağı sunan otomatik günlük geri yükleme noktaları.
    *   Uygulama kapatılırken belirlenen bir bulut dizinine (örn: Google Drive yerel klasörü) otomatik ve sessiz veritabanı yedeği aktarma.
*   **📝 İnsan Dilinde Log Arşivleme**: Sistem ve veritabanı logları sadece teknik JSON formatında değil, insan tarafından okunabilir (Human-Readable) Türkçe cümleler halinde `electron-log` ile kaydedilir. Bu loglar günlük rotasyonla arşivlenir; arayüz üzerinden TXT, Markdown, JSON, CSV ve Excel formatlarında dışa aktarılabilir.
*   **🏷️ Renkli Etiketler ve Anomali Dedektörü**: Kayıtlara ve işçilere sınırsız renkli etiket ekleme imkanı ile birlikte, bakiyesi eksiye düşen veya atıl duran personelleri tespit eden Dashboard uyarı paneli.
*   **🌎 Çok Dilli Arayüz ve Temalar**: Açık/Koyu tema yönetimi ve tam 19 dilde anında çeviri desteği.
*   **👥 Çoklu Puantaj Sistemi**: Birden fazla işçiye tek seferde, hızlı ve toplu puantaj girebilme.
*   **👷 İSG Entegrasyonu**: İş Sağlığı ve Güvenliği takip ve raporlama modülü.
*   **⏪ Gelişmiş Veritabanı Rollback Mekanizması**: Felaket anında yedekten anında geri dönüş yapabilme gücü.
*   **📊 Taşeron Excel Import Fallback Kuralı**: Bozuk ve düzensiz Taşeron Excel dosyalarını hatasız içeri alma mantığı.
*   **📱 Mobil LAN Yükleyici**: QR kod okutarak cep telefonundan sisteme anında fotoğraf yükleme.

---

## 🛠️ Kullanılan Teknolojiler

*   **Önyüz (Frontend)**: React (v18.2), Vite (derleme ortamı), Tailwind CSS (tasarım), Lucide React (ikon kütüphanesi), i18next (dil çeviri motoru)
*   **Arkayüz (Backend)**: Node.js & Electron (v29.1) runtime masaüstü kabuğu
*   **Veritabanı**: SQLite3 ilişkisel yerel dosya veritabanı
*   **Belge Üretimi**: jsPDF (PDF tasarımı), SheetJS/xlsx (Excel raporları)

---

## 📁 Proje Yapısı

```text
Tecton-Yeni-Nesil-Santiye-Isletim-Sistemi/
├── project_docs/              # Proje mimarisi, DB şeması ve Vibe Coding kılavuzları
├── scripts/                   # Veritabanı test verisi ekleme ve göç betikleri
├── src/                       # Kaynak kod dizini
│   ├── main/                  # Electron ana süreç kodları (IPC, pencere yönetimi, DB)
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
