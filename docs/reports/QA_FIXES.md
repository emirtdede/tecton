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

## 6. Paketleme ve şifreli veritabanı düzeltmeleri (sürüm öncesi son tur)

Birleştirme sonrası paketlenmiş uygulama açılıyor ama veritabanını açamıyordu
(`SqliteError: file is not a database`). Kök neden üç ayrı hata zinciriydi:

### P-1 - Yerel modül `app.asar` içinden yüklenemiyordu (Kritik)

**Dosya:** `electron-builder.config.cjs` (47)

**Sorun:** `asar: true` ile `better_sqlite3.node` arşivin içine giriyordu.
`.node` dosyaları gerçek bir dosya yolu gerektirir; arşivden yüklenemez.
Paketlenmiş uygulamada veritabanı hiç açılmıyor, yalnızca geliştirme modunda
çalışıyordu.

**Düzeltme:** Şifreli SQLite modülünün tamamı arşiv dışında tutuldu.

```js
asar: true,
asarUnpack: ['**/node_modules/better-sqlite3-multiple-ciphers/**'],
```

**Doğrulama:** `release/win-unpacked/resources/app.asar.unpacked/node_modules/
better-sqlite3-multiple-ciphers/build/Release/better_sqlite3.node` var;
paketlenmiş `Tecton.exe` veritabanını açıyor.

### P-2 - Anahtar her açılışta yeniden üretiliyordu ve veritabanı kilitleniyordu (Kritik)

**Dosya:** `src/main/services/keystore.js`

**Sorun:** `getDB()` uygulama hazır olmadan çağrılıyor. Bu anda
`safeStorage.isEncryptionAvailable()` her zaman `false` döner, bu yüzden ilk
açılışta anahtar `safeStorage` ile sarılmadan yazılıyordu (`Buffer.from(rawB64,
'utf8').toString('base64')`, 60 karakter). Okuma yolu ise yalnızca
`safeStorage.decryptString` deniyordu; sarılmamış anahtar okunamıyor, kod
"anahtar yok" sayıp her açılışta yeni anahtar üretiyordu. Veritabanı eski
anahtarla şifreli kaldığı için bir sonraki açılışta açılamıyordu. Ölçüm:

```
çalıştırma 1 -> key 2F4B4071...
çalıştırma 2 -> key 5B1D55F2...   (her açılışta değişiyor)
```

**Düzeltme:**

- `safeStorage` kullanılmadan önce `app.whenReady()` bekleniyor.
- Okuma yolu üç biçimi destekliyor: `safeStorage` ile sarılmış anahtar, düz
  base64 anahtar (44 karakter) ve eski çift kodlanmış biçim (60 karakter).
- Okunan düz anahtar, `safeStorage` varsa yerinde sarılarak yükseltiliyor.
- Okunamayan anahtar, veritabanı varken **asla** üzerine yazılmıyor:
  `keystore_unlock_failed` hatası veriliyor (sessiz veri kaybı yerine açık hata).

**Doğrulama:**

```
çalıştırma 1 -> key 44CCAFD9...  (100 karakter, sarılmış)
çalıştırma 2 -> key 44CCAFD9...  (aynı anahtar, veritabanı açıldı)
```

Eski 60 karakterlik anahtar dosyası da okunup sarılmış biçime yükseltiliyor:
`Keystore key upgraded to the safeStorage-wrapped format.`

### P-3 - Yanlış anahtar "bozuk veritabanı" sayılıp yedekle eziliyordu (Yüksek)

**Dosya:** `src/main/database/db.js` (73), `src/main/database/dbCompat.js`

**Sorun:** `better-sqlite3` tembel açılıyor; yanlış anahtarla açılan şifreli
dosya ancak ilk sorguda hata veriyor. Bu yüzden `openCompat` istisna atmıyor,
otomatik kurtarma hiç çalışmıyor, uygulama "file is not a database" ile açılışta
duruyordu. Kurtarma çalıştığında ise en yeni yedek doğrulanmadan ana dosyanın
üzerine kopyalanıyordu; yedek farklı anahtarla şifriliyse tek kopya da yok
ediliyordu.

**Düzeltme:**

- `openAndVerify()` eklendi: açılıştan sonra `SELECT count(*) FROM sqlite_master`
  ile gerçek bir okuma yapılıyor, hata varsa tanıtıcı kapatılıp kurtarma yoluna
  giriliyor.
- Yedek, ana dosyanın üzerine yazılmadan önce `verifyDbFile()` ile salt-okunur
  doğrulanıyor (önce mevcut anahtar, sonra düz metin eski yedekler).
- Kurtarma öncesi bozuk dosya `.unreadable-<zaman>` / `.corrupt-<zaman>` olarak
  saklanıyor; hiçbir dosya sessizce silinmiyor.
- Anahtar yoksa ve dosya şifreliyse önce uyarı loglanıyor, ardından yalnızca
  anahtarsız da okunabilen (düz metin) bir yedek varsa geri yükleme yapılıyor.
  Hiçbir yedek açılamıyorsa açık hata veriliyor; kilitli dosya silinmiyor.

**Doğrulama:** `keystore.test.js` 7 test (3 yeni: düz anahtar okuma, eski çift
kodlanmış biçim + yükseltme, veritabanı varken anahtar döndürmeyi reddetme);
`db.test.js` 11 test (1 yeni: anahtar yokken düz metin yedekten kurtarma ve
kilitli dosyayı saklama); tam paket `60 dosya / 350 test` yeşil.

### P-4 - CI Node 20'de yerel modülü derleyemiyordu (Yüksek)

**Dosya:** `.github/workflows/ci.yml`, `package.json` (engines)

**Sorun:** `better-sqlite3-multiple-ciphers@12` Node ABI 127/137/147 için ön
derlenmiş ikili yayınlıyor, Node 20 (ABI 115) için yok. `npm ci` node-gyp'e
düşüyor ve Visual Studio olmadığı için `npm error code 1` ile duruyordu.

**Düzeltme:** CI ve `engines` Node 22'ye çekildi; Electron ABI'si gereken işler
için `npx electron-builder install-app-deps` adımı eklendi.

```yaml
- name: Rebuild native modules for Electron
  run: npx electron-builder install-app-deps
```

**Not (yerel):** Yerel modül tek bir ABI için derlenir. Testler Node ABI'si,
paketleme ve ekran görüntüsü Electron ABI'si ister:

```powershell
# testler (Node ABI)
npx --yes prebuild-install --prefix node_modules/better-sqlite3-multiple-ciphers
# paketleme / ekran goruntusu (Electron ABI)
npx electron-builder install-app-deps
```

## 7. Veri kaybi zinciri ve yerel modul degistirici (ikinci tur)

Paketlenmis uygulama acilirken canli profildeki gercek veriler kayboldu: santiyeler
ve personel listesi bos geldi, oysa ayni klasordeki eski yedeklerde 12 santiye ve
280 personel vardi. Uc ayri hata birlikte calisti.

### P-5 - Bos veritabani, gercek veriyi gunluk yedege yazip gecmisi eziyordu (Kritik)

**Dosya:** `src/main/index.js` (315-343)

**Sorun:** Kapanista gunluk yedek kosulsuz uretiliyordu. Kurtarma bos bir dosya
getirdiginde, o bos veritabani `VACUUM INTO` ile gunun yedegine yaziliyor ve
var olan gercek yedek siliniyordu (`fs.unlinkSync`). Bir sonraki acilista kurtarma
en yeni yedegi -yani bos olani- sectigi icin veri her kapanista bir kat daha
kayboluyordu.

**Duzeltme:**

- Yedek oncesi `projects` sayisi okunuyor; sifirsa yedek yazilmiyor ve
  `clean_shutdown` yine de `1` yapiliyor.
- O gun icin yedek zaten varsa dosya silinmiyor, mevcut dosya korunuyor.
- Bos veritabaninin yedege yazilmasi ve gercek yedegin ezilmesi artik mumkun degil.

```js
let projects = 0;
try {
  const row = await db.get('SELECT count(*) AS c FROM projects');
  projects = row ? row.c : 0;
} catch (countErr) {
  logger.warn('Could not count projects before the daily backup:', countErr.message);
}
if (!projects) {
  logger.warn('[Safe Backup] Database holds no projects; skipping the daily backup.');
  await db.run("UPDATE app_settings SET setting_value = '1' WHERE setting_key = 'clean_shutdown'");
} else if (fs.existsSync(destPath)) {
  logger.info('[Safe Backup] Today already has a backup; keeping the existing file.');
  await db.run("UPDATE app_settings SET setting_value = '1' WHERE setting_key = 'clean_shutdown'");
} else {
  // VACUUM INTO + dogrulama
}
```

### P-6 - Kurtarma, dolu yedek dururken bos yedegi seciyordu (Kritik)

**Dosya:** `src/main/database/db.js` (122-140), `src/main/database/dbCompat.js` (68-104)

**Sorun:** `findUsableBackup` yalnizca "aciliyor mu" sorusunu soruyordu. Bos ama
saglam bir yedek, dolu bir yedekten daha yeni oldugu icin once seciliyor ve
kullaniciya bos uygulama aciliyordu. Ayrica yalnizca ilk 5 aday deneniyordu;
bozuk bes dosya gercek yedege hic sira birakmiyordu.

**Duzeltme:** `dbCompat.js` icine `inspectDbFile()` eklendi; dosya acilabiliyorsa
`PRAGMA integrity_check` sonucunu ve `projects` satir sayisini donduruyor.
`findUsableBackup` ilk 20 adayi gezip `projects > 0` olan en yeni yedegi seciyor;
bos ama saglam yedek yalnizca hic dolu yedek yoksa son care olarak kullaniliyor.

```js
let emptyCandidate = null;
for (const candidate of listBackups(backupDir).slice(0, 20)) {
  const info = inspectDbFile(candidate, dbKey);
  if (!info.ok) {
    logger.warn(`[Auto-Recovery] Backup unusable with the current key: ${candidate}`);
    continue;
  }
  if (info.projects > 0) return candidate;
  logger.warn(`[Auto-Recovery] Backup is empty, keeping it as a last resort: ${candidate}`);
  if (!emptyCandidate) emptyCandidate = candidate;
}
return emptyCandidate;
```

### P-7 - Degistirilen veritabaninin yan dosyalari geri yuklemeyi bozuyordu (Yuksek)

**Dosya:** `src/main/database/db.js` (39-70, 141-165)

**Sorun:** Ana dosya yedekle degistirilirken eski dosyanin `-wal` / `-shm`
dosyalari yerinde kaliyordu. SQLite acilista eski anahtarla sifreli WAL'i yeni
dosyaya uygulamaya calisip `file is not a database` ile dusuyordu; kurtarma
sonsuz donguye giriyordu. Windows, basarisiz acilistan hemen sonra tutamaci
birakmadigi icin ilk `unlink` `EBUSY` aliyordu.

**Duzeltme:** `removeSidecars()` eklendi: `-wal`, `-shm`, `-journal` dosyalarini
60 ms araliklarla 5 kez silmeyi dener. Silinemezse geri yukleme yapilmiyor
(`database_sidecars_locked`), boylece bozuk bir kopya yedegin de uzerine yazmiyor.

```js
function removeSidecars(dbPath) {
  let cleared = true;
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const sibling = `${dbPath}${suffix}`;
    let removed = !fs.existsSync(sibling);
    for (let attempt = 0; attempt < 5 && !removed; attempt += 1) {
      if (attempt > 0) sleepSync(60);
      try {
        fs.unlinkSync(sibling);
        removed = true;
      } catch (err) {
        if (attempt === 4) logger.error(`Could not remove stale ${suffix} sidecar:`, err.message);
      }
    }
    if (!removed) cleared = false;
  }
  return cleared;
}
```

### P-8 - Node/Electron ABI degisimi her paketlemeden sonra testleri kiriyordu (Orta)

**Dosya:** `scripts/nativeBinding.js` (yeni), `scripts/vitestGlobalSetup.js` (yeni),
`package.json` (16-19), `vitest.config.js` (7)

**Sorun:** `better_sqlite3.node` tek bir ABI icin derlenir. Paketleme Electron
ABI'sine ceviriyor, testler Node ABI'si istiyor; her paketlemeden sonra testler
`NODE_MODULE_VERSION 121 ... requires 147` ile dusuyordu. Elle
`prebuild-install` calistirmak unutuldugunda hata yanlis yerde (testte) gorunuyordu.

**Duzeltme:** `scripts/nativeBinding.js` her iki ikiliyi
`node_modules/.cache/tecton-native/` altinda saklayip gerekeni yerine kopyaliyor
(EBUSY'a karsi 10 deneme). `vitest.config.js` bir `globalSetup` ile test
baslamadan Node ikilisini yerine koyuyor; `npm run dev:electron` ve
`npm run build:electron` Electron ikilisini seciyor.

```powershell
node scripts/nativeBinding.js node       # testler
node scripts/nativeBinding.js electron   # paketleme / ekran goruntusu
```

**Dogrulama:** `db.test.js` 12 test (2 yeni: bos yedegin dolu yedegi gecmemesi,
kilitli yan dosyalarin temizlenmesi); `index.test.js` 8 test (1 yeni: bos
veritabaninda gunluk yedegin yazilmamasi); tam paket `60 dosya / 352 test` yesil.
Canli profilde 12 santiye / 280 personel iceren yedek geri yuklendi,
`integrity_check: ok`, `VACUUM` basarili.

### P-9 - Gunluk yedek dogrulamasi yanlis anahtarla calisabiliyordu (Dusuk)

**Dosya:** `src/main/index.js` (330-345)

**Sorun:** Anahtar deposu cevap vermedigi anda yedek dogrulamasi `null` anahtarla
yapiliyordu; sifreli bir yedek "bozuk" gorunup `clean_shutdown` isareti hic
konmuyor, sonraki acilis gereksiz butunluk kontrolu yapiyordu. Bu davranis
korundu ama artik bos veritabani korumasi sayesinde yanlis pozitif bir yedegi
ezemiyor; yalnizca gunluk bir butunluk taramasi fazladan kosuyor.
