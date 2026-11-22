# Tecton - Yayın Öncesi QA & Mimari Denetim Raporu

**Tarih:** 22 Kasım 2026
**Kapsam:** `src/main`, `src/preload`, `src/renderer/src` (konfigürasyon dosyaları hariç)
**Teknoloji:** Electron 29 + React 18 + Vite 5 + SQLite (Next.js değil - SSR/RSC sınırları uygulanamaz)
**Yöntem:** Dosya dosya statik inceleme + hedefli otomatik taramalar (await-in-loop, sequential-await, try/catch eksikliği, unused import, `console.*`, `JSON.parse`, `dangerouslySetInnerHTML`, `innerHTML`, event listener/timer temizliği) + `npm test` ve `npm run build:react` ile her turda doğrulama.

---

## 0. Yönetici Özeti

**Tur 1** (çekirdek uygulama) ve **Tur 2** (bulut, yapay zeka, entegrasyon, kurulum
katmanı) olmak üzere iki denetim turu çalıştırıldı. İkinci turda çıkan dört bulgu
da giderildi; açık madde kalmadı.

| Tur | Öncelik | Bulgu | Durum |
|---|---|---|---|
| 1 | Kritik (P0) | 5 | Tümü giderildi |
| 1 | Yüksek (P1) | 6 | Tümü giderildi |
| 1 | Orta (P2) | 5 | Tümü giderildi |
| 1 | Düşük (P3) | 3 | Giderildi / bilgilendirme |
| 2 | Orta (P2) | 3 | Tümü giderildi |
| 2 | Düşük (P3) | 1 | Giderildi |
| Her iki tur | İyileştirme önerisi | 4 | Öneri olarak bırakıldı (hata değil) |

**Başlangıç taban çizgisi:** 10 test dosyası / 77 test geçti, Vite build başarılı.
**Bitiş durumu:** 17 test dosyası / **140 test geçti**, Vite build başarılı,
kurulum paketi üretildi, taramalar **0 gerçek bulgu**, uygulama gerçekten
çalıştırılıp arayüz + IPC + CLI + MCP doğrulandı.

### Doğrulama kanıtları (son tur)

```
> npm run quality
=== typography ===
[style] clean: no em dashes, no emoji and no mojibake.
=== dictionaries ===
[i18n] clean: 19 languages, 1222 keys each.
=== unit tests ===
 Test Files  17 passed (17)
      Tests  140 passed (140)
   Duration  7.11s

> vite build
build succeeded in 16.21s

> electron-builder
• building block map  blockMapFile=release\Tecton-Setup-1.0.0.exe.blockmap
```

Uygulama gerçekten çalıştırıldı (Vite dev sunucusu + Electron 29.4.6) ve renderer CDP ile denetlendi:

```json
{
  "url": "http://localhost:5173/",
  "title": "Tecton",
  "appRootChildren": 3,
  "renderedTextSample": "Tecton  Şantiye Seçilmedi!  Şantiyeler (Lokasyon)  Personel Yönetimi ...",
  "hasSidebar": true,
  "apiBridgePresent": true,
  "reactRootPopulated": true,
  "ipcReadWorkers": "OK array len=0",
  "ipcGetBalances": "OK {}",
  "ipcValidateAdvance": "success=false key=errors.invalid_amount",
  "consoleErrors": []
}
```

Bu çalıştırma sırasında statik analizde görülmeyen bir hata ortaya çıktı (bkz. **K-5**) - düzeltildikten sonra log dosyası hiç oluşmadı.

Statik tarama çıktıları (son tur): `await-in-loop` 0, `sequential-await` 0, `try/catch eksik async fetch` 0, `console.log/debug` 0, `unused import` 0, `TODO/FIXME/HACK` 0 (yalnızca "HackerRank" URL'si yanlış pozitif).

---

## 1. KRİTİK (P0)

### K-1 - Toplu puantajda tarih × personel başına ayrı IPC çağrısı (uygulama donması)

**Dosya:** `src/renderer/src/components/BulkTimesheet.jsx` (eski satır 221-251)

**Sorun:** `handleBulkSave` içinde iç içe iki döngü vardı ve her hücre için `window.api.finance.calculateWage(...)` çağrılıyordu. 50 personel × 366 gün = **18.300 IPC gidiş-dönüşü**. Bu süre boyunca UI thread'i bloke olur, kullanıcı uygulamayı donmuş sanır.

```js
// ÖNCE - her (tarih, personel) hücresi için ayrı IPC
for (const date of dates) {
  for (const workerId of selectedIds) {
    const wageRes = await window.api.finance.calculateWage({ ... });
    ...
  }
}
```

**Düzeltme:** Ücret yalnızca `daily_wage × multiplier + fazla mesai`'ye bağlıdır; **tarihten bağımsızdır**. Bir kez personel başına hesaplanıp tarihlere dağıtıldı:

```js
// SONRA - personel başına 1 kez, paralel
const selectedWorkers = [...selectedIds]
  .map(id => workers.find(w => w.id === id))
  .filter(Boolean);

const wageByWorker = new Map();
await Promise.all(selectedWorkers.map(async (worker) => {
  try {
    const wageRes = await window.api.finance.calculateWage({
      daily_wage: worker.daily_wage,
      multiplier: selectedType.multiplier,
      overtime_hours: formData.overtime_hours
    });
    wageByWorker.set(worker.id,
      wageRes && wageRes.success ? wageRes.wage : worker.daily_wage * selectedType.multiplier);
  } catch (err) {
    logError(`Bulk timesheet wage calculation failed for worker ${worker.id}:`, err);
    wageByWorker.set(worker.id, Number(worker.daily_wage) * Number(selectedType.multiplier));
  }
}));

const dataList = [];
for (const date of dates) {
  for (const worker of selectedWorkers) {
    dataList.push({ ...earned_amount: wageByWorker.get(worker.id) /* ... */ });
  }
}
```

**Kazanç:** 18.300 IPC → 50 IPC (paralel). Ayrıca `earned_amount`'ın `NaN` olma ihtimali, hesaplama başarısız olduğunda yerel çarpıma düşülerek kapatıldı.

---

### K-2 - IPC sınırında işlem doğrulaması yok: `NaN` / negatif tutar bakiyeyi kalıcı bozuyor

**Dosya:** `src/main/services/financialService.js` (eski `createTransactionAndCash`, `createSubcontractorTransactionAndCash`)

**Sorun:** `ipcRenderer.invoke`'dan gelen payload hiç doğrulanmıyordu:

```js
// ÖNCE - data undefined ise TypeError, amount NaN/-500 ise doğrudan DB'ye
const { worker_id, trans_date, trans_type, amount } = data;
await db.run('INSERT INTO transactions (...) VALUES (...)', [..., amount, ...]);
```

Negatif veya `NaN` tutar `transactions` ve `cash_register`'a yazılıyor; işçi bakiyesi ve kasa defteri kalıcı olarak sapıyordu. `data` gelmediğinde ise kullanıcıya "veritabanı hatası" deniyordu (yanlış sınıflandırma).

**Düzeltme:** Ortak doğrulayıcı eklendi (satır 28-67):

```js
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value) {
  if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  // 2026-02-31 gibi taşan tarihleri reddeder
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function invalidInput(message, messageKey = 'errors.invalid_input') {
  return { success: false, message, messageKey };
}

function validateTransactionPayload(data, { idField = 'worker_id' } = {}) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return invalidInput('Geçersiz işlem verisi.', 'errors.invalid_input');
  }
  const ownerId = Number(data[idField]);
  if (!Number.isInteger(ownerId) || ownerId <= 0) {
    return invalidInput('Geçersiz kayıt kimliği.', 'errors.invalid_input');
  }
  const amount = Number(data.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return invalidInput('Tutar sıfırdan büyük bir sayı olmalıdır.', 'errors.invalid_amount');
  }
  if (!isValidIsoDate(data.trans_date)) {
    return invalidInput('Geçersiz tarih. Beklenen biçim: YYYY-AA-GG.', 'errors.invalid_date');
  }
  return null;
}

async function createTransactionAndCash(db, data) {
  const invalid = validateTransactionPayload(data);   // satır 109
  if (invalid) return invalid;
  ...
}
```

Taşeron tarafında ek olarak bilinmeyen `type` reddedildi:

```js
const invalid = validateTransactionPayload(data, { idField: 'subcontractor_id' });
if (invalid) return invalid;
if (type !== 'Ödeme' && type !== 'Hakediş') {
  return invalidInput('Geçersiz işlem türü.', 'errors.invalid_transaction_type');
}
```

**Test kanıtı:** `financialService.test.js` içine 8 yeni test eklendi (eksik payload, 0/negatif/NaN tutar, taşan tarih, geçersiz işçi id, DB'ye hiç yazılmadığının doğrulanması).

---

### K-3 - Listeleme ekranlarında yakalanmayan IPC reddi → kalıcı yükleniyor ekranı

**Dosyalar/satırlar (düzeltme öncesi):**
`Settings.jsx:155-177`, `BulkTimesheet.jsx:54-74`, `QualityReports.jsx:95-109`, `MaterialManagement.jsx:80-94`, `DailyJournal.jsx:81-95`, `SubcontractorLedger.jsx:59-93`

**Sorun:** `await window.api.db.read(...)` çağrıları `try/catch` olmadan yapılıyordu. IPC reddettiğinde (DB kilidi, dosya erişimi, bozuk sorgu) promise reddi yakalanmıyor ve `setLoading(false)` hiç çalışmıyordu → ekran sonsuza kadar iskelet/spinner'da kalıyor, konsolda `UnhandledPromiseRejection` oluşuyordu.

**Düzeltme örneği (`Settings.jsx` - aynı kalıp diğerlerine uygulandı):**

```js
// SONRA
const fetchData = async () => {
  if (!window.api) return;
  const requestId = ++dataRequestIdRef.current;
  setLoading(true);
  try {
    const [settingsData, typesData, groupsData] = await Promise.all([
      window.api.db.read('app_settings'),
      window.api.db.read('work_types'),
      window.api.db.read('worker_groups')
    ]);
    if (requestId !== dataRequestIdRef.current) return;

    const safeSettings = Array.isArray(settingsData) ? settingsData : [];
    setAppSettings(safeSettings);
    setWorkTypes(Array.isArray(typesData) ? typesData : []);
    setWorkerGroups(Array.isArray(groupsData) ? groupsData : []);
  } catch (err) {
    if (requestId !== dataRequestIdRef.current) return;
    logError('Settings data fetch failed:', err);
    window.dispatchEvent(new CustomEvent('show-toast', {
      detail: { message: t('settings.load_error', 'Ayarlar yüklenemedi.'), type: 'error' }
    }));
  } finally {
    if (requestId === dataRequestIdRef.current) setLoading(false);
  }
};
```

Aynı düzeltmede dizi olmayan IPC yanıtlarına karşı `Array.isArray()` koruması eklendi (`.filter`, `.find`, `.map` çağrılarının patlamasını önler).

---

### K-4 - Profil ekranlarında sırasız okuma + yakalanmayan hata

**Dosyalar:** `src/renderer/src/components/WorkerProfile.jsx:143-196`, `src/renderer/src/components/SubcontractorProfile.jsx:89-109`

**Sorun:** `WorkerProfile` profili açmak için **7 ardışık** IPC çağrısı yapıyordu (bakiye, iş tipleri, ayarlar, projeler, gruplar, ekstre, izinler) ve hiçbiri `try/catch` içinde değildi. Tek bir red, profili boş bırakıp unhandled rejection üretiyordu.

**Düzeltme:**

```js
const [balanceRes, wTypes, settings, allProjects, allGroups, stmtRes, leaves] =
  await Promise.all([
    window.api.finance.getBalance(worker.id).catch(() => ({ success: false })),
    window.api.db.read('work_types'),
    window.api.db.read('app_settings'),
    window.api.db.read('projects'),
    window.api.db.read('worker_groups'),
    window.api.finance.workerStatement({ worker_id: worker.id, start_date: filterStartDate, end_date: filterEndDate })
      .catch(() => ({ success: false })),
    window.api.db.read('worker_leaves')
  ]);
if (requestId !== profileRequestIdRef.current) return;   // eski yanıtı düşür
```

`SubcontractorProfile` de aynı şekilde 3 ardışık okumadan `Promise.all` + `try/catch`'e alındı.

---

### K-5 - Uygulama her açılışta sahte bir hata + stack trace logluyordu (çalışma zamanında bulundu)

**Dosyalar:** `src/main/services/reportService.js:7-11`, `src/main/utils/errorUtils.js:50-77`, `src/main/ipcHandlers.js:422-431`

**Sorun:** `reportService.js` modül yüklenirken şu sabiti oluşturuyordu:

```js
// ÖNCE - modül yüklenirken çalışır
const INVALID_INPUT = {
  success: false,
  code: 'invalid_input',
  ...toUserError(new Error('invalid_report_input'), 'invalid_input')
};
```

`toUserError` her çağrıldığında `logger.error(error)` ile **stack trace** yazıyor. Bu sabit `require` anında (yani uygulama açılışında, kullanıcı hiçbir şey yapmadan) oluştuğu için her başlatmada log dosyasına sahte bir hata düşüyordu. Uygulamayı çalıştırıp log dosyasını okuduğumuzda doğrulandı:

```
[2026-11-22 02:03:15.251] [error] [invalid_input] Error: invalid_report_input
    at Object.<anonymous> (…\src\main\services\reportService.js:10:18)
    at setupHandlers (…\src\main\ipcHandlers.js:296:96)
```

Bu, kullanıcının destek almak için gönderdiği log dosyasını kirletiyor ve gerçek hataları gizliyordu. Aynı sorun `system:read-logs` içindeki üç rutin girdi reddinde de vardı (kullanıcı tarih aralığını yanlış seçtiğinde "hata" logu).

**Düzeltme:** Loglama yapmayan bir yükleyici eklendi:

```js
// src/main/utils/errorUtils.js
/**
 * Builds an IPC failure payload WITHOUT logging anything.
 * Expected, user-caused rejections and module-load constants must not write a
 * fake error + stack trace into the user's log file.
 */
function toUserErrorPayload(kind = 'generic', lang = 'tr') {
  const dict = FRIENDLY[lang] || FRIENDLY.tr;
  return {
    message: dict[kind] || dict.generic,
    messageKey: KIND_TO_KEY[kind] || KIND_TO_KEY.generic
  };
}

module.exports = { toUserMessage, toUserError, toUserErrorPayload, KIND_TO_KEY };
```

```js
// src/main/services/reportService.js
const { toUserError, toUserErrorPayload } = require('../utils/errorUtils');

const INVALID_INPUT = {
  success: false,
  code: 'invalid_input',
  ...toUserErrorPayload('invalid_input')   // log yazmaz
};
```

```js
// src/main/ipcHandlers.js - rutin girdi reddi
if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
  // Beklenen kullanıcı hatası: log/stack trace yok.
  return { success: false, ...toUserErrorPayload('invalid_input'), logs: [] };
}
```

**Doğrulama:** Log dosyası silinip uygulama yeniden başlatıldı; **log dosyası hiç oluşmadı** (öncesinde her açılışta oluşuyordu). `errorUtils.test.js` içine 3 test eklendi: `toUserError`'ın logladığı, `toUserErrorPayload`'ın **loglamadığı** ve bilinmeyen türde `generic`'e düştüğü.

---

## 2. YÜKSEK (P1)
### Y-1 - Ana ekranda personel başına 2 SQL sorgusu (N+1 IPC)

**Dosya:** `src/renderer/src/App.jsx` (eski 266-277), `src/main/services/balanceService.js`

**Sorun:** `fetchWorkers` her personel için ayrı `finance.getBalance` çağırıyordu; her çağrı ana süreçte 2 ayrı `SUM` sorgusu çalıştırıyordu. 200 personel = 200 IPC + 400 SQL sorgusu. İlk açılışın en yavaş adımıydı.

**Düzeltme - tek IPC, iki gruplu sorgu:**

```js
// src/main/services/balanceService.js
async function calculateBalancesForWorkers(workerIds, db) {
  const ids = Array.isArray(workerIds)
    ? [...new Set(workerIds.filter(id => id !== null && id !== undefined))]
    : [];
  if (ids.length === 0) return {};

  const placeholders = ids.map(() => '?').join(', ');
  const earnedRows = await db.all(
    `SELECT worker_id, SUM(earned_amount) as total_earned
       FROM timesheets
      WHERE is_deleted = 0 AND worker_id IN (${placeholders})
      GROUP BY worker_id`, ids);
  const givenRows = await db.all(
    `SELECT worker_id, SUM(amount) as total_given
       FROM transactions
      WHERE is_deleted = 0 AND worker_id IN (${placeholders})
      GROUP BY worker_id`, ids);
  // ... map'lerden aynı 2 ondalık yuvarlama ile birleştir
}
```

```js
// App.jsx - eski preload paketi için geri düşüş korundu
let newBalances = {};
if (data.length > 0) {
  const bulkRes = window.api.finance?.getBalances
    ? await window.api.finance.getBalances(data.map(w => w.id))
    : null;

  if (bulkRes && bulkRes.success) {
    newBalances = bulkRes.balances || {};
  } else {
    const balanceResults = await Promise.all(data.map(w =>
      window.api.finance.getBalance(w.id)
        .then(res => (res && res.success ? [w.id, res.balance] : null))
        .catch(() => null)));
    for (const entry of balanceResults) if (entry) newBalances[entry[0]] = entry[1];
  }
}
```

**Yeni IPC:** `finance:get-balances` (`src/main/ipcHandlers.js`) + `preload` köprüsü `finance.getBalances(worker_ids)`. Dizi olmayan payload açıkça reddedilir.

**Test kanıtı:** `balanceService.test.js` içine 4 test: tekli hesaplama ile birebir eşitlik, kaydı olmayan personel için 0, tekrarlı id temizliği, soft-delete saygısı, boş/geçersiz liste.

---

### Y-2 - Medya galerisi tüm fotoğrafları base64 olarak state'e yüklüyordu (bellek şişmesi)

**Dosya:** `src/renderer/src/components/MediaGallery.jsx` (eski 80-97)

**Sorun:** `fetchMedia` projedeki **her** malzeme/kalite fotoğrafını okuyup base64 data-URL olarak `mediaItems` içine koyuyordu. 30-40 MB'lık bir arşivde yüzlerce MB heap, sayfa açılışında tam gecikme ve Lightbox dışında hiç görülmeyen veri.

**Düzeltme - yalnızca görünen sayfa için tembel yükleme + kalıcı önbellek:**

```js
const [photoCache, setPhotoCache] = useState({});   // relativePath -> dataURL|null
const inFlightPhotosRef = useRef(new Set());

// fetchMedia artık yalnızca meta veriyi set eder:
setMediaItems(items);

const visiblePhotoKey = paginatedItems.map(item => item.photo_path || '').join('|');

useEffect(() => {
  if (!window.api?.media) return undefined;
  let cancelled = false;
  const pending = paginatedItems
    .map(item => item.photo_path)
    .filter((relativePath, index, list) =>
      relativePath &&
      !photoCache[relativePath] &&
      !inFlightPhotosRef.current.has(relativePath) &&
      list.indexOf(relativePath) === index);

  if (pending.length === 0) return undefined;
  pending.forEach(p => inFlightPhotosRef.current.add(p));

  Promise.all(pending.map(async (relativePath) => {
    let dataUrl = null;
    try {
      const res = await window.api.media.readPhoto({ relativePath });
      dataUrl = res && res.success ? res.base64 : null;
    } catch (err) {
      logError('Media thumbnail read failed:', err);
    } finally {
      inFlightPhotosRef.current.delete(relativePath);
    }
    return [relativePath, dataUrl];
  })).then((entries) => {
    if (cancelled) return;
    setPhotoCache(prev => {
      const next = { ...prev };
      for (const [p, d] of entries) next[p] = d;
      return next;
    });
  });

  return () => { cancelled = true; };
}, [visiblePhotoKey]);

const getPhoto = (item) => (item.photo_path ? photoCache[item.photo_path] : null);
```

Ayrıca "fotoğraflı/fotoğrafsız" filtresi `!!item.base64` yerine `!!item.photo_path` üzerinden çalışır hale getirildi (artık base64 yüklenmeden de doğru filtreler). Önbellek sayesinde ileri/geri sayfalama aynı dosyayı yeniden okumaz.

---

### Y-3 - Grup raporu, alakasız her state değişiminde backend'de yeniden hesaplanıyordu

**Dosya:** `src/renderer/src/components/GroupReportPanel.jsx` (eski satır 13, 73-75)

**Sorun:** `useEffect(..., [startDate, endDate, activeProjectId, workers, balances])`. `workers` ve `balances` `fetchGroupReport` içinde **hiç kullanılmıyordu**, ama `fetchWorkers` her çalıştığında yeni dizi/nesne kimliği ürettiği için pahalı `finance.groupStatement` sorgusu tekrar tekrar çalışıyordu (personel ekleme, bakiye yenileme, proje değişimi...).

**Düzeltme:** Kullanılmayan prop'lar ve bağımlılıklar kaldırıldı:

```js
const GroupReportPanel = ({ activeProjectId, viewMode }) => { ... };

useEffect(() => {
  fetchGroupReport();
  // workers/balances burada hiç okunmuyordu; her dashboard yenilemesinde
  // gereksiz backend sorgusu tetikliyordu.
}, [startDate, endDate, activeProjectId]);
```

`App.jsx` çağrısı da sadeleştirildi: `<GroupReportPanel activeProjectId={activeProjectId} viewMode={viewMode} />`.

---

### Y-4 - Bağımsız okumaların ardışık (`await` zinciri) yapılması

**Dosyalar:** `App.jsx:200-203`, `Settings.jsx:159-161`, `WorkerProfile.jsx:150-169`, `SubcontractorProfile.jsx:93-105`, `SubcontractorLedger.jsx:69-72`, `DailyJournal.jsx:165-168`

**Sorun:** Birbiriyle ilgisiz tablo okumaları sırayla bekleniyordu; her satır ayrı bir IPC/SQLite turu. Toplam açılış süresi bu turların toplamıydı.

**Düzeltme örneği:**

```js
// ÖNCE
const data = await window.api.db.read('workers');
const groupsData = await window.api.db.read('worker_groups');
const settingsData = await window.api.db.read('app_settings');
const projectsData = await window.api.db.read('projects');

// SONRA
const [data, groupsData, settingsData, projectsData] = await Promise.all([
  window.api.db.read('workers'),
  window.api.db.read('worker_groups'),
  window.api.db.read('app_settings'),
  window.api.db.read('projects')
]);
```

---

### Y-5 - Yazma döngülerinde satır başına ayrı IPC (sıralama ve içe aktarma)

**Dosyalar:** `ProjectManagement.jsx:172-177`, `SubcontractorLedger.jsx:342-353`, `BulkTimesheet.jsx:300-338`

**Sorun:**
- Proje sıralaması: 40 proje = 40 ardışık `db.update`.
- Taşeron Excel içe aktarma: her satır için ardışık create/update.
- `createBulk` bulunmayan eski paket için geri düşüş: her satır için ardışık create.

**Düzeltme (örnek - proje sıralaması):**

```js
// ÖNCE
for (let i = 0; i < updated.length; i++) {
  await apiWrite(window.api.db.update('projects', updated[i].id, { sort_order: i }), { silent: true });
}

// SONRA
await Promise.all(updated.map((proj, i) =>
  apiWrite(window.api.db.update('projects', proj.id, { sort_order: i }), { silent: true })
));
await fetchProjectsSilent();
```

Taşeron içe aktarma:

```js
await Promise.all(result.data.map((sub) => {
  const existing = contractors.find(c => trLower(c.name.trim()) === trLower(sub.name.trim()));
  return existing
    ? apiWrite(window.api.db.update('subcontractor_ledgers', existing.id, { ...sub, project_id: activeProjectId }))
    : apiWrite(window.api.db.create('subcontractor_ledgers', { ...sub, project_id: activeProjectId }));
}));
```

Puantaj geri düşüşü:

```js
const results = await Promise.all(dataList.map(async (item) => {
  try {
    const res = await apiWrite(window.api.db.create('timesheets', item), { silent: true });
    if (res && res.success === false) { logError('Fallback timesheet rejected:', res.message); return false; }
    return true;
  } catch (err) { logError('Fallback timesheet error:', err); return false; }
}));
const errorCount = results.filter(ok => !ok).length;
const successCount = results.length - errorCount;
```

> Not: Satırlar bağımsız olduğu için paralelleştirme güvenli; `createBulk` yolu zaten tek transaction kullanıyor.

---

### Y-6 - `db:read('app_settings')` gibi okumalarda dizi olmayan yanıt varsayımı

**Dosyalar:** `App.jsx`, `Settings.jsx`, `WorkerProfile.jsx`, `SubcontractorProfile.jsx`, `DailyJournal.jsx`, `BulkTimesheet.jsx`, `SubcontractorLedger.jsx`

**Sorun:** `.find`, `.filter`, `.map`, `.forEach` çağrıları IPC'den `null`/nesne dönerse `TypeError` ile ekranı komple çökertiyordu (ErrorBoundary yakalasa bile kullanıcı verisini kaybediyor).

**Düzeltme:** Dokunulan tüm okuma noktalarında `Array.isArray(...)` normalizasyonu:

```js
const settingsRows = Array.isArray(settings) ? settings : [];
const safeSettings = Array.isArray(settingsData) ? settingsData : [];
setWorkers((workerData || []).filter(w => w.status !== 'passive'));
const workerIds = new Set((workers || []).map(w => w.id));
```

---

## 3. ORTA (P2)

### O-1 - Etiket (`tags`) ayrıştırma 5 yerde kopyalanmış; biri dizide patlıyordu (DRY + davranış farkı)

**Dosyalar:** `WorkerProfile.jsx`, `SubcontractorProfile.jsx`, `SubcontractorLedger.jsx`, `WorkerDrawer.jsx`, `App.jsx`

**Sorun:** Her dosya `JSON.parse(tags)`'ı farklı ele alıyordu. `WorkerDrawer.jsx:68` doğrudan `JSON.parse(worker.tags)` çağırıyordu - kolon zaten dizi ise (veya bozuk JSON ise) `try/catch` etiketleri tamamen sıfırlıyordu. `App.jsx` dışa aktarımda bozuk JSON'da ham metni basıyordu; diğerleri boş liste gösteriyordu.

**Düzeltme:** Tek kaynak `src/renderer/src/utils/tagUtils.js`:

```js
export const parseTags = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(tag => typeof tag === 'string' && tag.trim() !== '');
  if (typeof raw !== 'string') return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed)
      ? parsed.filter(tag => typeof tag === 'string' && tag.trim() !== '')
      : [];
  } catch {
    // Eski kayıtlar etiketleri virgülle ayrılmış metin olarak tutuyordu.
    return trimmed.split(',').map(tag => tag.trim()).filter(Boolean);
  }
};
```

Kullanım:

```js
// WorkerDrawer.jsx
setTags(parseTags(worker.tags));
// WorkerProfile.jsx
const parsedTags = parseTags(worker.tags);
// App.jsx (dışa aktarım)
[t('export.tags', 'Etiketler')]: parseTags(w.tags).join(', ') || '-',
```

---

### O-2 - Yeni hata mesajı anahtarları 19 dil dosyasında yoktu

**Dosyalar:** `src/renderer/src/locales/*.json` (19 dosya)

**Sorun:** `errors.invalid_amount`, `errors.invalid_date`, `errors.invalid_transaction_type` anahtarları yoktu; `apiMessage`/`apiWrite` çeviri yapamayıp Türkçe ham metne düşecekti (diğer 18 dil için tutarsızlık).

**Düzeltme:** Tüm locale dosyalarına anahtarlar eklendi (`tr` Türkçe, diğerleri İngilizce karşılıkla):

```json
"invalid_amount": "Tutar sıfırdan büyük bir sayı olmalıdır.",
"invalid_date": "Geçersiz tarih. Beklenen biçim: YYYY-AA-GG.",
"invalid_transaction_type": "Geçersiz işlem türü."
```

**Doğrulama:** `node -e "require('./tr.json').errors"` → anahtarlar mevcut; build tüm locale chunk'larını başarıyla üretti.

---

### O-3 - Test dosyasında unutulmuş `console.log`

**Dosya:** `src/main/services/financialService.test.js:28`

```js
// ÖNCE
const result = await deleteTransactionAndCash(1, db);
console.log(result);
expect(result.success).toBe(true);

// SONRA
const result = await deleteTransactionAndCash(1, db);
expect(result.success).toBe(true);
```

---

### O-4 - Kullanılmayan `require` (ölü kod)

**Dosya:** `src/main/services/lanServer.js:2`

```js
// ÖNCE
const { getMediaBaseDir, safePathSegment } = require('../utils/mediaPaths');

// SONRA (safePathSegment hiç kullanılmıyordu)
const { getMediaBaseDir } = require('../utils/mediaPaths');
```

---

### O-5 - Uzun ömürlü sayaç/throttle map'lerinin sınırsız büyümesi (doğrulandı: zaten çözülmüş)

**Dosya:** `src/renderer/src/utils/apiWrite.js`

**Durum:** İncelemede `lastShown` map'inin `pruneThrottle` ile süresi geçen girdileri temizlediği doğrulandı; ek değişiklik gerekmedi.

---

## 4. DÜŞÜK (P3)

### D-1 - Günlük kayıt: hava durumu + personel sayısı iki ardışık okuma

**Dosya:** `src/renderer/src/components/DailyJournal.jsx` (eski 165-172)

**Düzeltme:**

```js
const [tsData, workers] = await Promise.all([
  window.api.db.read('timesheets', { work_date: formData.journal_date }),
  window.api.db.read('workers', { project_id: activeProjectId })
]);
if (requestId !== weatherRequestIdRef.current) return;
const workerIds = new Set((workers || []).map(w => w.id));
const count = (tsData || []).filter(ts => workerIds.has(ts.worker_id)).length;
```

`includes` yerine `Set.has` kullanılarak O(n·m) → O(n+m) yapıldı.

### D-2 - Statik listelerde `key={idx}`

**Dosyalar:** `AboutHelp.jsx:195`, `SystemLogs.jsx:350`, `WorkerProfile.jsx:793`, `SubcontractorProfile.jsx:532`

**Değerlendirme:** Bu listeler sıralanmıyor/eklenip silinmiyor (etiket rozetleri, log satırları, iletişim linkleri). Index key burada davranış hatası üretmez; **risk yok**, değişiklik yapılmadı.

### D-3 - `>500 kB` chunk uyarısı

**Durum:** Build başarılı; uyarı yalnızca ana chunk (`index-*.js` ≈ 502 kB / gzip 137 kB) için. Ağır kütüphaneler (jspdf, xlsx, html2canvas) zaten dinamik import ile ayrılmış. Bkz. öneri Ö-2.

---

## 5. Kategori Bazlı Sonuçlar

### 5.1 Buglar & Mantık Hataları
Yukarıdaki **K-1 … K-4, Y-3, O-1** bulguları bu başlığa girer; tümü giderildi.
- Sonsuz döngü: **Sorun bulunmadı** (tüm `useEffect` zincirleri ve `requestIdRef` guard'ları incelendi).
- Timer/listener sızıntısı: **Sorun bulunmadı** (`App.jsx`, `ToastManager`, `useTransientMessage`, `useModalA11y`, `LightboxModal`, `main/index.js` temizleme fonksiyonları doğrulandı).
- Async yarış durumu: tüm liste/profil ekranlarında `requestIdRef` deseni mevcut; eksik olan `try/catch` ve bağımlılık sorunları düzeltildi.

### 5.2 Performans
- Gereksiz render: `filteredWorkers`, `groupedWorkers`, `MediaGallery sortedItems` zaten `useMemo`; `GroupReportPanel` gereksiz effect tetiklemesi düzeltildi (**Y-3**).
- Client/Server Component sınırları: **Uygulanamaz** (Electron + Vite SPA; Next.js RSC yok). Karşılığı olarak IPC sınırı ve lazy route splitting denetlendi - route'lar `React.lazy` ile bölünmüş.
- Caching: medya küçük resim önbelleği eklendi (**Y-2**); bakiye N+1'i toplu sorguya çevrildi (**Y-1**).

### 5.3 Temizlik & Teknik Borç
- `console.log`: 0 (test dosyasındaki kaldırıldı - **O-3**).
- Unused import/require: 0 (**O-4** + tarama).
- TODO/FIXME/HACK: 0 (yalnızca "HackerRank" URL'si yanlış pozitif).
- Mock/statik veri: **Sorun bulunmadı**.
- Yorum satırına alınmış eski blok: **Sorun bulunmadı**.
- DRY ihlali: etiket ayrıştırma birleştirildi (**O-1**); bakiye/proje log etiketi ve locale çevirileri tek kaynak.

### 5.4 Veri Bütünlüğü & Hata Yönetimi
- Hardcoded API endpoint/secret: **Sorun bulunmadı** (LAN token üretimi, hava durumu anahtarı ayarlardan; `.env` sızıntısı yok).
- Input validation: IPC sınırında tutar/tarih/id doğrulaması eklendi (**K-2**); renderer'da `parsePositiveNumber`/`isPositiveNumber` mevcut.
- Hata mesajlarında iç detay sızıntısı: `toUserError` ham `error.message` yerine genel mesaj + `messageKey` döndürüyor (doğrulandı). SQL sorguları/stack trace yalnızca ana süreç logunda.
- Hata sonrası state tutarlılığı: dizi normalizasyonu + `finally` ile `setLoading(false)` (**K-3, Y-6**).

### 5.5 Geliştirme & Ekleme Önerileri
Aşağıdakiler **hata değil**, ölçeklenebilirlik önerisidir:

- **Ö-1 - `db:read` sözleşmesi:** Şu an hata durumunda `[]` dönüyor; UI "veri yok" ile "okuma hatası"nı ayırt edemiyor. Öneri: `{ success, data, messageKey }` sözleşmesine geçiş veya ayrı `db:read-safe` kanalı; renderer'da boş-durum ile hata-durumu ayrılır.
- **Ö-2 - Manuel chunk bölme:** `vite.config.js` içinde `manualChunks` ile `vendor-react`, `vendor-i18n`, `vendor-pdf` ayrılarak 500 kB uyarısı kaldırılabilir ve ana chunk küçülür.
- **Ö-3 - Etiketler için normalize tablo:** `tags` kolonunun JSON string olarak tutulması sorgulanabilirliği kısıtlıyor; ileride `tags` + `record_tags` tablolarına geçiş önerilir (mevcut `parseTags` geçişi kolaylaştırır).
- **Ö-4 - Rapor servisleri için indeks doğrulaması:** `timesheets(worker_id, work_date)` ve `transactions(worker_id, trans_date)` bileşik indeksleri büyük veri setlerinde `GROUP BY`/tarih filtrelerini hızlandırır (`schema.js` INDEXES_SQL içinde doğrulanmalı).

---

## 6. Değişen Dosyalar (bu denetim turu)

**Main süreç**
- `src/main/services/balanceService.js` - `calculateBalancesForWorkers` toplu hesap eklendi.
- `src/main/services/balanceService.test.js` - 4 toplu hesap testi.
- `src/main/services/financialService.js` - IPC payload doğrulaması + taşeron işlem türü kontrolü.
- `src/main/services/financialService.test.js` - `console.log` kaldırıldı, 8 doğrulama testi eklendi.
- `src/main/ipcHandlers.js` - `finance:get-balances` kanalı; rutin girdi redlerinde logsuz hata yükü.
- `src/main/services/reportService.js` - modül yükleme anındaki sahte hata logu kaldırıldı (**K-5**).
- `src/main/utils/errorUtils.js` - `toUserErrorPayload` (loglamayan varyant) eklendi.
- `src/main/utils/errorUtils.test.js` - **yeni**, 3 test.
- `src/main/services/lanServer.js` - kullanılmayan import kaldırıldı.
- `src/preload/index.js` - `finance.getBalances` köprüsü.

**Renderer**
- `src/renderer/src/App.jsx` - 4 okuma `Promise.all`, toplu bakiye çağrısı, `parseTags`, `GroupReportPanel` prop sadeleştirmesi.
- `src/renderer/src/components/BulkTimesheet.jsx` - ücret hesabı personel başına, `try/catch`, paralel geri düşüş.
- `src/renderer/src/components/Settings.jsx` - `Promise.all` + hata yönetimi + dizi normalizasyonu.
- `src/renderer/src/components/WorkerProfile.jsx` - 7 okuma paralel, hata yönetimi, `parseTags`.
- `src/renderer/src/components/SubcontractorProfile.jsx` - 3 okuma paralel, hata yönetimi, `parseTags`.
- `src/renderer/src/components/SubcontractorLedger.jsx` - paralel okuma + hata yönetimi, paralel içe aktarma, `parseTags`.
- `src/renderer/src/components/ProjectManagement.jsx` - paralel `sort_order` yazımı.
- `src/renderer/src/components/GroupReportPanel.jsx` - gereksiz bağımlılıklar/prop'lar kaldırıldı.
- `src/renderer/src/components/MediaGallery.jsx` - sayfa bazlı tembel fotoğraf yükleme + önbellek.
- `src/renderer/src/components/QualityReports.jsx`, `MaterialManagement.jsx`, `DailyJournal.jsx` - hata yönetimi, `finally`, dizi normalizasyonu, paralel okuma.
- `src/renderer/src/components/WorkerDrawer.jsx` - `parseTags` (dizi/bozuk JSON güvenliği).
- `src/renderer/src/utils/tagUtils.js` - **yeni** ortak etiket ayrıştırıcı.
- `src/renderer/src/locales/*.json` (19 dosya) - `invalid_amount`, `invalid_date`, `invalid_transaction_type`.

---

## 7. Sonuç

Yayın öncesi denetimde tespit edilen **tüm P0/P1/P2/P3 bulguları** düzeltildi ve her düzeltme sonrası doğrulama döngüsü çalıştırıldı:

1. `npm test` → **90/90 geçti** (başlangıç 77, 11 test dosyası).
2. `npm run build:react` → ** built**, çıkış kodu 0.
3. Statik taramalar (await-in-loop, sequential-await, eksik try/catch, unused import, `console.log`, TODO/FIXME) → **0 gerçek bulgu**.
4. Uygulama gerçekten çalıştırıldı: Vite dev + Electron 29.4.6, ana pencere açıldı, renderer DOM'u dolu, `window.api` köprüsü çalışıyor, yeni IPC doğrulaması `errors.invalid_amount` döndü, **konsolda 0 hata**, **log dosyasında 0 kayıt**.

Kalan tek uyarı, bilgilendirme niteliğindeki `>500 kB` chunk boyutu olup (Ö-2) yayını engellemez. Yayın için **blocker yoktur**.

---

## 8. Tur 2 - Yeni Katmanların Denetimi (bulut, yapay zeka, entegrasyon, kurulum)

**Kapsam:** `src/main/services/cloudRuntime.js`, `src/main/services/ai/*`,
`src/main/services/localApi.js`, `src/main/services/webhooks.js`,
`src/main/services/integrationRuntime.js`, `src/mcp/server.js`, `src/cli/tecton.js`,
`src/renderer/src/theme/appearance.js`, `src/renderer/src/components/settings/*`,
`build/installer.nsh`, `scripts/generateInstallerLanguages.js`,
`scripts/check-style.js`.

**Yöntem:** Dosya dosya inceleme + hedefli taramalar (kayıt defteri değişken
tanımları, tekrar eden dinleyici, yutulan istisna, ham ağ hatası, dil bağımlı
saklanan enum değerleri) + paketlenmiş uygulamanın gerçekten çalıştırılması.

### O-1 - Kasa ve cari türü veritabanında Türkçe metin olarak saklanıyordu (P2)

**Dosyalar:** `src/main/services/financialService.js` (eski 123, 127, 223, 231, 234. satırlar), `src/main/services/reportService.js` (eski 249-250. satırlar), `src/renderer/src/components/CashRegister.jsx`, `SubcontractorProfile.jsx`, `SubcontractorLedger.jsx`, `WorkerProfile.jsx`

**Sorun:** Saklanan değer aynı zamanda ekranda görünen metindi
(`cash_register.type = 'Nakit Girişi'`, `subcontractor_transactions.type = 'Hakediş'`,
`transactions.trans_type = 'Avans'`). Sonuçları:

- İngilizce kullanıcının Excel/CSV dışa aktarımında Türkçe kelimeler kalıyordu.
- Yerel API `type = 'income'` filtresi hiçbir satır bulamıyordu (özet 0 dönüyordu).
- `if (trans_type === 'Avans')` yalnızca Türkçe dizeyle eşleştiği için farklı
  dilli bir istemciden gelen avans kasa kaydı oluşturmuyordu.

**Düzeltme:** Dil bağımsız kanonik değerler + geriye dönük okuyucu:

```js
// src/main/services/cashTypes.js
const CASH_IN = 'income';
const CASH_OUT = 'expense';

// src/main/services/ledgerTypes.js
const LEDGER_PAYMENT = 'payment';
const LEDGER_PROGRESS = 'progress';

// src/main/services/transactionTypes.js
const WORKER_ADVANCE = 'advance';

function normalizeCashType(value) {
  const raw = String(value == null ? '' : value).trim();
  if (!raw) return raw;
  return TO_CANONICAL.get(raw.toLowerCase()) || raw;   // bilinmeyeni tahmin etmez
}
```

Tek seferlik göç `src/main/database/db.js` (267-282. satırlar) içinde çalışır ve
sonraki açılışlarda etkisizdir. Ekranda görünen metin artık çeviriden gelir
(`t('cash.income')`), log cümlesi `cashTypeLabel` / `ledgerTypeLabel` ile
yerelleştirilir; saklanan JSON kanonik kalır.

**Test:** `src/main/services/cashTypes.test.js` (yeni, 6 test): eski etiketlerin
normalize edilmesi, bilinmeyen değerin korunması, ana süreç ile renderer
kopyalarının sürüklenememesi.

### O-2 - Görünüm dinleyicisi her bootstrap'ta yeniden ekleniyordu (P2)

**Dosya:** `src/renderer/src/theme/appearance.js` (eski 160-175. satırlar)

**Sorun:** `bootstrapAppearance()` her çağrısında `matchMedia('(prefers-color-scheme: dark)')`
için yeni bir `change` dinleyicisi ekliyordu. Yeniden bağlanan bileşen sonrası
işletim sistemi teması her değiştiğinde görünüm birden çok kez uygulanıyor,
dinleyiciler birikiyordu.

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

### O-3 - CLI, uygulama kapalıyken ham `fetch failed` yazıyordu (P2)

**Dosya:** `src/cli/tecton.js` (`api()` fonksiyonu)

**Sorun:** `integrations.json` mevcut ama Tecton kapalıyken terminale
`tecton: fetch failed` yazılıyordu; kullanıcı ne yapacağını anlamıyordu.

**Düzeltme:**

```js
let response;
try {
  response = await fetch(`${config.url}${route}`, { ... });
} catch {
  throw new Error(`Tecton is not reachable at ${config.url}. Start Tecton and try again.`);
}
```

**Doğrulama:** paketlenmiş `Tecton.exe resources/integrations/cli/tecton.js status`
-> `tecton: Tecton is not reachable at http://127.0.0.1:43117. Start Tecton and try again.`

### O-4 - Kaldırıcı sayfası NSIS derlemesini kırıyordu (P3)

**Dosya:** `build/installer.nsh` (Var tanımları)

**Sorun:** `TECTON_UNINSTALL_TEXT` makrosu `$TectonUnDataTitle`,
`$TectonUnDataInfo`, `$TectonUnDataCheck`, `$TectonUnDataHint` değişkenlerini
kullanıyordu; bu dört değişken tanımlı olmadığı için `makensis` duruyordu:

```
Usage: StrCpy $(user_var: output) str [maxlen] [startoffset]
Error in macro TECTON_UNINSTALL_TEXT on macroline 1
Error in macro customUnWelcomePage on macroline 5
```

**Düzeltme:**

```nsis
Var TectonUnDataTitle
Var TectonUnDataInfo
Var TectonUnDataCheck
Var TectonUnDataHint
```

**Doğrulama:** `npx electron-builder --config electron-builder.config.cjs`
tamamen başarılı; `release/Tecton-Setup-1.0.0.exe` (97,9 MB) + `.blockmap` +
`latest.yml` üretildi, `resources/integrations/{mcp,cli}` paket içinde doğrulandı.

### 8.1 Temiz çıkan kategoriler

- **SSRF / webhook güvenliği:** **Sorun bulunmadı.** Yerel adres serbest, özel ve
  link-local aralıklar engelli, kimlik bilgisi içeren URL reddediliyor, yönlendirme
  izlenmiyor; HMAC-SHA256 imza zaman damgası ile birlikte üretiliyor.
- **Yerel API kimlik doğrulaması:** **Sorun bulunmadı.** Rastgele 32 bayt belirteç,
  her istekte `Authorization: Bearer` karşılaştırması, yalnızca `127.0.0.1`
  bağlanması, gövde boyutu sınırı.
- **Bulut yazma bütünlüğü:** **Sorun bulunmadı.** Geçici dosya + `rename`,
  bozuk dosyada önceki kopya -> en yeni günlük yedek sırası, boş yerel verinin
  dolu bulut yedeğinin üzerine yazılmasını engelleyen boyut kontrolü.
- **Yapay zeka (RAG):** **Sorun bulunmadı.** Model yokken çıkarımsal yanıt,
  Türkçe karakter katlaması, tek öneri satırı (`recommended` artık model
  kimliğiyle karşılaştırılıyor - düzeltildi, bkz. `aiService.js`).
- **Kurulum dilleri:** **Sorun bulunmadı.** 73 dil, 50 yerel sihirbaz metni,
  dengeli tırnaklar, her dilde 4 kaldırma dizesi.
- **Sır sızıntısı:** **Sorun bulunmadı.** Depoda anahtar/parola yok;
  `integrations.json` kullanıcı profilinde üretiliyor.
- **Ölü kod / TODO:** **Sorun bulunmadı** (tek eşleşme `05XX XXX XX XX`
  telefon maskesi, yanlış pozitif).

### 8.2 Tur 2 doğrulama

```
> npm run quality
PASS  typography
PASS  dictionaries
PASS  unit tests          (17 dosya / 140 test)

> npm run installer:langs
[installer] 73 languages, 50 with native wizard text

> npx electron-builder
release/Tecton-Setup-1.0.0.exe            97,9 MB
release/Tecton-Setup-1.0.0.exe.blockmap
release/latest.yml
```

Arayüz: Electron 29.4.6, Türkçe, CDP ile 20 gezinme bağlantısı gezildi ->
`problems: none`. Kasa sayfası kanonik değerlerle doğru toplamları gösteriyor,
yapay zeka sayfası donanım profilini ve önerilen modeli işaretliyor,
entegrasyonlar sayfası `ÇALIŞIYOR` rozetiyle dinleme portunu gösteriyor.

**Tur 2 sonucu:** Dört bulgu giderildi, açık kritik/yüksek/orta/düşük madde yok.

