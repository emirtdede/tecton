# Tecton - Denetim Düzeltmeleri (1. Tur + 2. Tur)

**Sürüm:** 1.0.0
**Tarih:** 22 Kasım 2026
**İlgili rapor:** `docs/reports/QA_AUDIT_REPORT.md`

Bu dosya, denetimde bulunan her sorunun nasıl giderildiğini dosya ve satır
düzeyinde kaydeder. İkinci turda yeni bulgu çıkmadı; aşağıdaki maddelerin
tamamı doğrulandı.

---

## 1. Tur düzeltmeleri

### K-1 - Kasa türü veritabanında Türkçe metin olarak saklanıyordu

**Dosya:** `src/main/services/financialService.js` (eski 127. satır), `src/renderer/src/components/CashRegister.jsx` (eski 78, 244-245, 340, 485-486, 517, 520, 564-565, 612. satırlar)

**Sorun:** `cash_register.type` sütununa `'Nakit Girişi'` / `'Nakit Çıkışı'`
yazılıyordu. Bu değer hem anlamı hem de ekranda görünen metni taşıdığı için
İngilizce kullanıcının dışa aktardığı dosyada Türkçe kelime kalıyor, raporlar
ve yerel API `type = 'income'` filtresiyle hiçbir satır bulamıyordu.

**Düzeltme:** Kanonik değerler `income` / `expense` oldu.

```js
// src/main/services/cashTypes.js
const CASH_IN = 'income';
const CASH_OUT = 'expense';

function normalizeCashType(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return raw;
  return TO_CANONICAL.get(raw.toLowerCase()) || raw;
}
```

`normalizeCashType` eski kayıtları (`Nakit Girişi`, `Gelir`, `Tahsilat`, ...)
okurken kanonik değere çevirir, bilinmeyen değeri olduğu gibi bırakır.
Veritabanı göçü `src/main/database/db.js` içinde tek seferlik `UPDATE`
çalıştırır; sonraki açılışlarda etkisizdir.

Gösterim artık çeviriden gelir: `t('cash.income')` / `t('cash.expense')`.

**Doğrulama:** `cashTypes.test.js` (yeni), `financialService.test.js`
`cash.type` beklentisi `'expense'` olarak güncellendi. 140 test geçiyor.

---

### K-2 - Taşeron cari türü de Türkçe metin olarak saklanıyordu

**Dosya:** `src/main/services/financialService.js` (eski 223, 231, 234, 245. satırlar), `src/renderer/src/components/SubcontractorProfile.jsx` (eski 144, 170, 349, 421-422, 436-437, 447-448, 452, 471, 633-635. satırlar), `src/renderer/src/components/SubcontractorLedger.jsx` (eski 83-84. satırlar)

**Sorun:** `subcontractor_transactions.type` alanına `'Hakediş'` / `'Ödeme'`
yazılıyordu. Aynı sınıf hata: veri dili ile arayüz dili birbirine bağlıydı.

**Düzeltme:** `src/main/services/ledgerTypes.js` eklendi.

```js
const LEDGER_PAYMENT = 'payment';
const LEDGER_PROGRESS = 'progress';

function normalizeLedgerType(value) { ... }   // Hakediş -> progress, Ödeme -> payment
function ledgerTypeLabel(value, isTr) { ... } // yalnızca log cümlesi için
```

`financialService.createSubcontractorTransactionAndCash` girişte normalize eder,
yeni satırı kanonik değerle yazar, bilinmeyen türü reddeder. Arayüzdeki tüm
karşılaştırmalar `isLedgerPayment` / `isLedgerProgress` üzerinden yapılır; filtre
değerleri `all` / `progress` / `payment` oldu. Göç `db.js` içinde çalışır.

**Doğrulama:** `cashTypes.test.js` taşeron türünü de kapsıyor.

---

### K-3 - Personel avansı türü Türkçe metin olarak saklanıyordu

**Dosya:** `src/main/services/transactionTypes.js` (yeni), `financialService.js` (eski 123. satır), `src/renderer/src/components/WorkerProfile.jsx` (eski 375. satır)

**Sorun:** `transactions.trans_type` alanına `'Avans'` yazılıyordu ve
`createTransactionAndCash` yalnızca tam bu dizeyle eşleşince kasa çıkışı
oluşturuyordu. İngilizce bir istemci `advance` gönderirse kasa kaydı hiç
oluşmazdı.

**Düzeltme:**

```js
const WORKER_ADVANCE = 'advance';

function isAdvance(value) {
  const raw = String(value == null ? '' : value).trim().toLowerCase();
  return raw === WORKER_ADVANCE || raw === 'avans' || raw === 'ödeme' || raw === 'odeme';
}
```

`if (isAdvance(trans_type))` kullanılıyor, yeni satırlar `advance` yazıyor.
Göç eski `'Avans'` satırlarını günceller.

---

### K-4 - Rapor servisi kasa türünü sabit Türkçe metinle karşılaştırıyordu

**Dosya:** `src/main/services/reportService.js` (eski 249-250. satırlar)

**Sorun:** `if (c.type === 'Nakit Girişi')` - K-1 sonrası bu karşılaştırma
hiçbir zaman eşleşmez, aylık nakit özeti sıfır görünürdü.

**Düzeltme:**

```js
cashRegister.forEach(c => {
  if (isCashIncome(c.type)) totalCashIn += c.total;
  else if (isCashExpense(c.type)) totalCashOut += c.total;
});
```

`isCashIncome` / `isCashExpense` hem yeni hem eski değerleri tanır.

---

### K-5 - Log cümlelerinde ham enum değeri görünüyordu

**Dosya:** `src/main/services/crudService.js` (eski 87, 95, 175. satırlar)

**Sorun:** K-1 ve K-2 sonrası audit log cümlesi `(...income)` veya
`(...payment)` yazacaktı; Türkçe arayüzde İngilizce teknik kelime görünürdü.

**Düzeltme:** `cashTypeLabel(value, isTr)` ve `ledgerTypeLabel(value, isTr)`
eklendi. Log cümlesi artık `t` diline göre `Nakit Girişi` / `Cash in` üretir.
Saklanan JSON değeri kanonik kalır, yalnızca okunabilir cümle çevrilir.

---

### O-1 - Mojibake statik kapıda yakalanmıyordu

**Dosya:** `scripts/check-style.js`

**Sorun:** `db.js` içinde Türk lirası işareti ve uzun çizgi, UTF-8 baytlarının
Windows-1252 olarak okunmasıyla oluşan üç karakterli bozuk dizilere dönüşmüştü; hiçbir kapı
bunu görmediği için Türk lirası işareti ekranda bozuk çıkabiliyordu.

**Düzeltme:** `MOJIBAKE` deseni eklendi ve `scanFile`, özet ve `--fix`
davranışına bağlandı.

```js
const MOJIBAKE = /\uFFFD|\u00E2\u20AC|\u00E2\u201A/g;
```

`--fix` mojibake'i **bilerek düzeltmez**: hangi karakterin bozulduğu
bilinmediğinden otomatik onarım gerçek metni bozabilir. Bu durumda araç
dosya adını yazıp sıfırdan farklı çıkış koduyla biter; onarım elle yapılır.
`db.js` bu turda elle onarıldı: bozuk lira dizisi `₺` karakterine, bozuk uzun
çizgi dizisi ` - ` metnine çevrildi.

**Doğrulama:** `npm run style:check` -> `clean: no em dashes, no emoji and no mojibake.`

---

## 2. Tur düzeltmeleri

### O-2 - Görünüm dinleyicisi her bootstrap'ta yeniden ekleniyordu

**Dosya:** `src/renderer/src/theme/appearance.js` (eski 160-175. satırlar)

**Sorun:** `bootstrapAppearance()` her çağrıldığında
`matchMedia('(prefers-color-scheme: dark)')` için yeni bir `change` dinleyicisi
ekliyordu. Bileşen yeniden bağlandığında işletim sistemi teması her
değiştiğinde görünüm iki kez uygulanıyor, dinleyiciler birikiyordu.

**Düzeltme:**

```js
let systemThemeWatched = false;

export function bootstrapAppearance() {
  const cached = loadCachedAppearance();
  applyAppearance(cached);

  if (typeof window.matchMedia === 'function' && !systemThemeWatched) {
    systemThemeWatched = true;
    // ... tek dinleyici
  }
  return cached;
}
```

---

### O-3 - CLI, uygulama kapalıyken ham `fetch failed` yazıyordu

**Dosya:** `src/cli/tecton.js` (`api()` fonksiyonu)

**Sorun:** `integrations.json` vardı ama Tecton kapalıysa Node'un `fetch`
çağrısı `tecton: fetch failed` üretiyordu. Kullanıcı ne olduğunu anlamıyordu.

**Düzeltme:**

```js
let response;
try {
  response = await fetch(`${config.url}${route}`, { ... });
} catch {
  throw new Error(`Tecton is not reachable at ${config.url}. Start Tecton and try again.`);
}
```

**Doğrulama:** Paketlenmiş `Tecton.exe resources/integrations/cli/tecton.js status`
-> `tecton: Tecton is not reachable at http://127.0.0.1:43117. Start Tecton and try again.`

---

### O-4 - Kaldırıcı sayfası NSIS derlemesini kırıyordu

**Dosya:** `build/installer.nsh` (Var tanımları), `scripts/generateInstallerLanguages.js`

**Sorun:** `TECTON_UNINSTALL_TEXT` makrosu `$TectonUnDataTitle`,
`$TectonUnDataInfo`, `$TectonUnDataCheck`, `$TectonUnDataHint` değişkenlerini
kullanıyordu ama `installer.nsh` içinde bu dört değişken tanımlı değildi.
`makensis` şu hatayla duruyordu:

```
Usage: StrCpy $(user_var: output) str [maxlen] [startoffset]
Error in macro TECTON_UNINSTALL_TEXT on macroline 1
Error in macro customUnWelcomePage on macroline 5
```

**Düzeltme:** Dört `Var` bildirimi eklendi.

```nsis
Var TectonUnDataTitle
Var TectonUnDataInfo
Var TectonUnDataCheck
Var TectonUnDataHint
```

**Doğrulama:** `npx electron-builder --config electron-builder.config.cjs`
tamamen başarılı; `release/Tecton-Setup-1.0.0.exe` (97,9 MB) üretildi.

---

### D-1 - Adlandırma tutarsızlığı (bilgilendirme)

**Dosya:** `src/renderer/src/components/CashRegister.jsx` (14. satır)

Kullanılmayan `CASH_OUT` importu kaldırıldı; dosya yalnızca gerçekten
kullandığı `CASH_IN`, `isCashIncome`, `isCashExpense`, `normalizeCashType`
sembollerini alıyor. Davranış değişmedi.

---

## 3. Doğrulama özeti

```
> npm run quality
=== typography ===
[style] clean: no em dashes, no emoji and no mojibake.
=== dictionaries ===
[i18n] clean: 19 languages, 1222 keys each.
=== unit tests ===
 Test Files  17 passed (17)
      Tests  140 passed (140)
PASS  typography
PASS  dictionaries
PASS  unit tests
```

Arayüz doğrulaması (Electron 29.4.6, Türkçe, CDP ile 20 gezinme bağlantısı):
`problems: none`. Kasa sayfası kanonik değerlerle doğru toplamları gösteriyor
(Toplam Nakit Girişi 6.006.000 ₺ / Çıkışı 3.597.400 ₺), yapay zeka sayfası
donanım profilini ve önerilen modeli tek satırda işaretliyor.

Kurulum paketi: `release/Tecton-Setup-1.0.0.exe` (97,9 MB),
`resources/integrations/mcp/server.js` ve `resources/integrations/cli/tecton.js`
paket içinde doğrulandı.

**Sonuç:** İkinci turda yeni bulgu yok; açık kritik/yüksek/orta/düşük madde
kalmadı.
