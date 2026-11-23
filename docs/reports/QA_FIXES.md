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

## 4. Birleştirme sonrası ek düzeltmeler (main + development mutabakatı)

`main` ve `development` dalları tek bir mimaride birleştirildi: `main`'in
bölünmüş bileşen/test yapısı ve şifreli `better-sqlite3-multiple-ciphers`
altyapısı korundu, `development`'ın PowerPilot düz kabuk görsel katmanı
üzerine taşındı. Bu birleştirmede ortaya çıkan ek bulgular ve düzeltmeleri:

### M-1 - `better-sqlite3-multiple-ciphers@13` Electron 29 ile çalışmıyor (Kritik)

**Dosya:** `package.json` (dependencies)

**Sorun:** `13.2.0` sürümü `engines.node >= 22` istiyor. Electron 29.4.6
(Node 20.9) içinde modül `require` edilebiliyor, ancak ilk `new Database(...)`
çağrısında süreç sessizce çöküyordu:

```
exit=-36861 (0xFFFF7003)
probe-out.txt -> start 29.4.6 / REQUIRE OK   (OPEN satırı hiç yazılmadı)
```

Uygulama bu yüzden açılmıyordu; geliştirme modunda `electron .` hiç pencere
göstermiyor, paketlenmiş uygulama ise açılışta kapanıyordu.

**Düzeltme:** Electron 29 ile uyumlu son sürüme sabitlendi.

```json
"better-sqlite3-multiple-ciphers": "^12.11.1"
```

**Doğrulama:** `electron .` açılıyor, şifreli veritabanı anahtarı (`PRAGMA
key`) uygulanıyor, `select sqlite_version()` -> `3.53.2`. Paketleme sırasında
`electron-builder` yerel modülü Electron ABI'si için yeniden kuruyor
(`install prebuilt binary ... napi=`), böylece kurulum paketi de aynı sürümü
kullanıyor.

**Not (yerel geliştirme):** Yerel modül Node ve Electron ABI'leri için ayrı
derlenir. `npm ci` sonrası `npm test` Node ABI'sini kullanır; `npx
electron-builder` / `npm run dev:electron` Electron ABI'sini ister. Arada
geçiş için:

```powershell
# testler / Node tarafı icin
npx prebuild-install --prefix node_modules/better-sqlite3-multiple-ciphers
# Electron tarafı icin
npx electron-builder install-app-deps
```

### M-2 - Test paketi bellek sınırında çöküyordu (Yüksek)

**Dosya:** `vitest.config.js`

**Sorun:** 60 test dosyası varsayılan fork havuzuyla paralel çalışınca jsdom
örnekleri 4 GB heap sınırını aşıyor, `Worker forks emitted error` ve
`FATAL ERROR: Ineffective mark-compacts near heap limit` alınıyordu. Tek tek
çalıştırıldığında tüm dosyalar geçiyordu.

**Düzeltme:** Havuz üst sınırı sabitlendi.

```js
poolOptions: {
  forks: { minForks: 1, maxForks: 4 },
},
```

**Doğrulama:** `npx vitest run` -> `60 passed (60)`, `346 passed (346)`,
yaklaşık 40 saniye.

### M-3 - `MediaGallery` sonsuz render döngüsü (Yüksek)

**Dosya:** `src/renderer/src/components/MediaGallery.jsx` (109), testlerdeki
`react-i18next` sahteleri

**Sorun:** `useEffect(..., [activeProjectId, t])` bağımlılığında `t` var.
Üretimde i18next `t` referansını sabit tutuyor, ancak test sahteleri her
render'da yeni bir fonksiyon döndürüyordu; bu da sonsuz `fetchMedia` döngüsü
ve heap taşması üretiyordu. Aynı kalıp 15 test dosyasındaki sahtede vardı.

**Düzeltme:** Sahteler tek bir sabit `t` ve `i18n` nesnesi döndürüyor, gerçek
davranışı yansıtıyor.

```js
useTranslation: (() => {
  const t = (k, f) => f || k;
  const i18n = { language: 'tr', changeLanguage: vi.fn() };
  return () => ({ t, i18n });
})(),
```

### M-4 - `localStorage` jsdom testlerinde tanımsızdı (Orta)

**Dosya:** `vitest.config.js` (9), `src/renderer/src/testSetup.js`

**Sorun:** Vitest 4 jsdom ortamı Web Storage'ı test global'ine kopyalamıyor;
`window.localStorage` `undefined` kalıyordu ve `App.test.jsx` /
`AppDashboard.test.jsx` bu yüzden düşüyordu.

**Düzeltme:** jsdom'a gerçek bir origin verildi ve depolama nesneleri
altyapıdaki pencereden açıkça tanımlandı.

```js
environmentOptions: { jsdom: { url: 'http://localhost:5173/' } },
```

### M-5 - LAN sunucusu Windows'ta ayrılmış port aralığında açılmıyordu (Orta)

**Dosya:** `src/main/services/lanServer.js`, `lanServer.http.test.js`

**Sorun:** `5001-5010` aralığı bu makinede Hyper-V/WinNAT tarafından
ayrıldığı için `EACCES` dönüyordu; sunucu hiç açılmıyor, QR kod boş kalıyordu.
Ayrıca yanıt başlıklarında `Content-Security-Policy` yoktu ve yükleme sayfası
yalnızca `accept` kontrolüne güveniyordu.

**Düzeltme:** `startLANServer` asenkron oldu; önce `currentPort..+9` aralığını
dener, tamamı ayrılmışsa işletim sisteminin atadığı portu (`listen(0)`) alır
ve gerçek portu döndürür. Tüm yanıtlara katı CSP eklendi:

```js
res.setHeader(
  'Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-elem 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; object-src 'none'; frame-ancestors 'none'; base-uri 'none'"
);
```

Yükleme testi artık dönen portu ve uzantının doğrulanmış MIME türünden
geldiğini doğruluyor (`.png`, istemcinin verdiği ad değil).

### M-6 - `style:fix` emoji temizliğinde JSX düğmelerini boşaltmıştı (Orta)

**Dosyalar:** `MaterialFilters.jsx`, `MaterialForm.jsx`, `QualityForm.jsx`,
`CashHistory.jsx`, `ProjectList.jsx`, `SubcontractorTable.jsx`,
`WorkerEntryForms.jsx`, `AppDashboard.jsx`, `SettingsRecycleTab.jsx`,
`WorkerIdentityCard.jsx`, `SubcontractorHeader.jsx`,
`SubcontractorInfoCard.jsx`, `WorkerIsgModal.jsx`, `MediaGallery.jsx`,
`MediaViews.jsx`

**Sorun:** Emoji (carpi, ampul ve insaat isareti) karakterleri silinirken geriye boş
`<button>` ve `<span>` öğeleri kaldı; kapat/temizle düğmeleri görünmez oldu.

**Düzeltme:** Her biri anlamına uygun lucide ikonuyla değiştirildi (`X`,
`Lightbulb`, `Image`). Emoji yasağı korunuyor, düğmeler yeniden görünür ve
erişilebilir (`aria-hidden` + mevcut `title`/`aria-label`).

### M-7 - Testler birleşik görsel katmanla uyumsuzdu (Düşük)

**Dosyalar:** `App.test.jsx`, `PagesSmoke.test.jsx`, `Shells.test.jsx`,
`WorkerIdentityCard.test.jsx`, `exportImport.test.js`, `formatUtils.test.js`,
`ui/GuideDrawer.test.jsx`

**Sorun:** Testler kaldırılan metinlere (``), eski başlıklara
(`Şantiye (Lokasyon)`) veya eski hoş geldin modalına (`checkbox`) bağlıydı.
`exportToExcel` asenkron olduğu için `await` edilmeden dosya varlığı
denetleniyordu. `formatUtils` yalnızca modül içi `regionalSettings`
değişkenini okuyor, `window.regionalSettings` atamasını yok sayıyordu.

**Düzeltme:** Testler erişilebilir role/isim sorgularına çevrildi
(`getAllByRole('button', { name: /Skip|Atla/i })`,
`findByRole('heading', { name: /Şantiyeler|Projeler/i })`), sihirbaz akışı
ilk çalıştırma davranışına uyarlandı, `exportToExcel` `await` edildi ve
`resolveCurrency` her iki kaynağı da okur hale getirildi.

---

## 5. Son doğrulama (birleştirme sonrası)

```
> npm run quality
=== typography ===
[style] clean: no em dashes, no emoji and no mojibake.
=== dictionaries ===
[i18n] clean: 19 languages, 1229 keys each.
=== unit tests ===
 Test Files  60 passed (60)
      Tests  346 passed (346)
PASS  typography
PASS  dictionaries
PASS  unit tests
```

```
> npx vite build
 built in 9.80s   (226 modul, yalnizca bilinen >500 kB chunk uyarisi)
```

Sessiz ekran görüntüsü seti yeniden alındı (Electron 29.4.6, production,
`PrintWindow` + `SW_SHOWNOACTIVATE`, odak çalınmadan): 20 gezinme görüntüsü
`docs/screenshots/` altında, `=== problems === none`.
