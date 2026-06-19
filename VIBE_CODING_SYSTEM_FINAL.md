# VIBE CODING SYSTEM — Kurumsal Otonom Yazılım Mimarisi (.rules)

> Bu dosya, otonom yapay zeka ajanlarıyla (AI Agents) geliştirme yapmak için tasarlanmış,
> araçtan bağımsız (tool-agnostic) TEK MERKEZİLİ sistem anayasasıdır.
> Ajan, her göreve sadece bu dosyayı okuyarak başlar ve bağlama göre diğer dosyalara yönlenir.

---

## 1. MİMARİ KLASÖR YAPISI

```text
project-root/
│
├── src/
├── public/
├── locales/                     ← Çoklu dil metinleri (Hardcoded metin YASAK)
│   ├── tr.js                    ← Ana Dil
│   └── en.js                    ← İkinci Dil
│
├── .env                         ← GİZLİ: Tüm API/Secret Keyler (Asla commit edilmez)
├── .gitignore
├── .rules                       ← BU DOSYA: Ajanın TEK anayasası
│
└── project_docs/
    │
    ├── PRD.md                   ← Ürün Gereksinimleri (Amacı ve hedefler)
    ├── SRS.md                   ← Yazılım Gereksinimleri (İşlevsel/Teknik)
    ├── SAD.md                   ← Sistem Mimarisi & DB Şemaları (TDD detayları)
    ├── API_SPECIFICATION.md     ← Endpoint Listesi (Swagger formatında)
    │
    ├── MEMORY.md                ← Proje Özeti (Max 100 satır)
    ├── TASKS.md                 ← Eyleme geçirilebilir Todo Listeleri
    ├── CHANGELOG.md             ← Conventional Commits geçmişi
    └── SECURITY.md              ← Güvenlik kuralları
```

---

## 2. KATI MİMARİ STANDARTLAR (CRITICAL RULES)

Ajan, geliştirme yaparken aşağıdaki prensipleri **İHLAL EDEMEZ:**

1. **Çoklu Dil (i18n) Zorunluluğu:** Kod içine sabit metin (hardcoded text) yazmak **KESİNLİKLE YASAKTIR**. Uyarı mesajları, onay metinleri, başlıklar ve arayüdeki tüm yazılar `locales/` altındaki `tr.js` ve `en.js` dosyalarında key-value mantığıyla tutulacaktır. Uygulamanın ana dili Türkçe'dir.

2. **Data-Driven & Zero-Code Change:** İş kuralları koda gömülmeyecektir. Değişkenlik gösterebilecek tüm iş mantıkları ve durumlar (states) konfigürasyon dosyalarından, veritabanından veya `.env` üzerinden yönetilecektir.

3. **Test-Driven Development (TDD):** Herhangi bir özellik (feature) kodunu yazmadan **ÖNCE** ilgili birim (unit) veya entegrasyon testlerini yazmak zorunludur. Testler yazılmadan asıl koda dokunulamaz.

4. **Yan Etki (Side-Effect) İzolasyonu & Saf Fonksiyonlar:** Veritabanı yazmaları, API istekleri ve DOM/UI manipülasyonları gibi "yan etkiler", asıl iş kurallarını (business logic) çalıştıran saf fonksiyonlardan kesin sınırlarla ayrılmalıdır.

5. **Katı Bağımlılık Kilidi:** Kullanıcının AÇIK ONAYI olmadan yeni bir paket (npm, pip vb.) kurmak yasaktır. Kurulan paketlerin sürümleri esnek değil, KESİN sürüm numarasıyla kilitlenmelidir.

6. **Encoding & Assets:** Sistemdeki tüm dosyalar istisnasiz **UTF-8** formatındadır. Özel karakter (Türkçe karakter vb.) destekleyen fontlar kullanılmalı, asenkron işlemlerde `try/catch` blokları zorunlu tutulmalıdır.

---

## 3. GÜVENLİK VE FALLBACK (B PLANI) SİSTEMİ

### 3.1. Proje Güvenliği & Fallback

* **Sırların Korunması:** Tüm API key, secret, veritabanı stringleri SADECE `.env` dosyasında durur. Kodun içine asla yazılmaz.
* **Graceful Degradation:** Çalışma zamanında (runtime) bir API yanıt vermezse veya DB koparsa sistem beyaz ekran veremez. i18n üzerinden uygun hata mesajı gösterilmeli veya önbellekten (cache) veri dönülmelidir.
* **Audit & Logging:** İnsan tarafından okunabilir loglama adımları; veri mutasyonları, giriş/çıkış işlemleri ve sistem hataları için plana zorunlu olarak dahil edilecektir.

### 3.2. Ajan (Anti-Loop) Fallback Sistemi

* **Sonsuz Döngü Kırıcısı:** Eğer ajan (sen), aynı hatayı (derleme, test, lint) çözmek için üst üste **3 KEZ** başarısız olursan, denemeyi derhal durdur. Durumu raporla ve kullanıcıdan açıkça yönlendirme iste.
* Eğer okuman gereken bir dosyayı bulamazsan veya yazdığın komut çökerse, tahminde bulunma; işlemi **rollback** yap (geri al).

---

## 4. AJAN TALİMATLARI — ÇALIŞMA PROTOKOLÜ

**Ajan (AI) bu bölümü okuyup doğrudan uygulamalıdır.**

### A. DİNAMİK BAĞLAM OKUMA (Dynamic Context Routing)

Her göreve başlarken tüm dosyaları okumak **YASAKTIR**. Sadece Kapsam ile ilgili dosyaları oku:

* **Yeni özellik mi eklenecek?** Önce `PRD.md` ve `SRS.md` oku.
* **Veritabanı veya mimari mi değişecek?** Önce `SAD.md` oku.
* **Güvenlik/Auth işlemi mi var?** Önce `SECURITY.md` oku.
* **Genel durum nedir?** Sadece `MEMORY.md` oku.
* *(Not: Hiçbir proje dokümanı 250 satırı geçemez. Geçiyorsa alt dosyalara bölüp referansla).*

### B. PLANLAMA VE GÖREV FORMATI

* Uzun markdown planlamaları yapma. Sadece net, eyleme geçirilebilir **ToDo Listeleri** oluştur (`TASKS.md`).
* Görevler için **KESİNLİKLE** efor veya zaman tahmini (saat, gün, hafta) YAPMA. Odak sadece işi adımlara bölmektir.
* Yeni plan dosyalarını `/plans` dizinine kaydet.

### C. GÖREV SONUNDA YAPILACAKLAR

Bir modülü veya görevi bitirdiğinde şunları güncelle:

1. `MEMORY.md` (Özet durumu güncelle - Max 100 satır sınırını aşma).
2. `TASKS.md` (Tamamlananları [x] yap).
3. Eklentiler varsa `locales/` dosyaları.

### D. GIT & VERSİYONLAMA

Testleri başarıyla geçen veya önemli bir dönüm noktasına ulaşan her kod parçası için **Conventional Commits** standardında commit öner:

* `feat(auth): giriş ekranına i18n desteği eklendi`
* `test(users): profil kayıt unit testleri yazıldı`