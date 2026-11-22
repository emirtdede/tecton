# Tecton - Yayın Öncesi Kontrol Listesi

**Sürüm:** 1.0.0
**Tarih:** 22 Kasım 2026
**Platform:** Windows 10/11 x64
**Paket:** `release/Tecton-Setup-1.0.0.exe` (NSIS, tek tık olmayan, kullanıcı başına kurulum)

Her satır yayın öncesinde tekrar doğrulanmalıdır. `[x]` işaretli maddeler bu sürümde
çalıştırılıp sonucu görülmüştür.

---

## 1. Kod kalitesi kapıları

| # | Kontrol | Komut | Beklenen | Durum |
|---|---|---|---|---|
| 1.1 | Tipografi (em dash, emoji, mojibake) | `npm run style:check` | `clean` | [x] |
| 1.2 | Sözlük bütünlüğü | `npm run i18n:check` | 19 dil, 1222 anahtar | [x] |
| 1.3 | Birim testleri | `npm run test` | 17 dosya / 140 test | [x] |
| 1.4 | Üçünün birleşik kapısı | `npm run quality` | `all checks passed` | [x] |
| 1.5 | Renderer derlemesi | `npm run build:react` | hatasız, CSP enjekte edilmiş | [x] |

## 2. Dil ve yerelleştirme

| # | Kontrol | Beklenen | Durum |
|---|---|---|---|
| 2.1 | Uygulama dilleri | 19 tam sözlük (`UI_LOCALES`) | [x] |
| 2.2 | Kurulum dilleri | 73 dil (`INSTALLER_LANGUAGES`), 50'sinde yerel sihirbaz metni | [x] |
| 2.3 | Varsayılan dil | Windows dili, eşleşme yoksa İngilizce | [x] |
| 2.4 | İngilizce sızıntısı | 19 dilde 0 sızıntı | [x] |
| 2.5 | RTL | Yalnızca Arapça (`dir="rtl"`), diğerleri LTR | [x] |
| 2.6 | Sözlüğü olmayan dil | Sessizce İngilizceye düşmez, seçim listesinde görünmez | [x] |

## 3. Görünüm ve erişilebilirlik

| # | Kontrol | Beklenen | Durum |
|---|---|---|---|
| 3.1 | Tema sayısı | 14 hazır palet + 1 özel hex = 15 | [x] |
| 3.2 | Açık/koyu yüzey | Her palet iki yüzeyde de okunur kontrast verir | [x] |
| 3.3 | Simge seçici | Masaüstü kısayolu, görev çubuğu ve tepsi simgesini değiştirir | [x] |
| 3.4 | Yakınlaştırma | %80-%150 arası, kalıcı | [x] |
| 3.5 | Erişilebilirlik | Yüksek kontrast, azaltılmış hareket, yazı tipi ölçeği | [x] |
| 3.6 | Pencere kontrolleri | Sağ üstte üç Windows düğmesi (küçült / büyüt / kapat) | [x] |

## 4. Bulut yedekleme

| # | Kontrol | Beklenen | Durum |
|---|---|---|---|
| 4.1 | Sağlayıcı algılama | OneDrive, Google Drive, Dropbox, iCloud, Nextcloud | [x] |
| 4.2 | Sunucusuz | Hesap, oturum veya anahtar gerekmez | [x] |
| 4.3 | Atomik yazma | Geçici dosya + rename; yarım dosya kalmaz | [x] |
| 4.4 | Bozuk dosya kurtarma | Önceki kopya, sonra en yeni günlük yedek | [x] |
| 4.5 | Boş veri koruması | Boş yerel veri dolu bulut yedeğinin üzerine yazılmaz | [x] |
| 4.6 | Saklama | Son 15 gün, eskiler otomatik silinir | [x] |
| 4.7 | Yerel geri dönüş | Bulut yoksa yerel klasöre yazar, hata vermez | [x] |

## 5. Yapay zeka ve RAG

| # | Kontrol | Beklenen | Durum |
|---|---|---|---|
| 5.1 | Çalışma zamanı | Ollama, yalnızca `127.0.0.1:11434` | [x] |
| 5.2 | Donanım profili | RAM, çekirdek, ekran kartı, öneri katmanı | [x] |
| 5.3 | Model yönetimi | İndir / sil / etkinleştir / devre dışı bırak | [x] |
| 5.4 | RAG | 20 iki dilli belge parçası, BM25, Türkçe katlama | [x] |
| 5.5 | Model yokken | Çıkarımsal (extractive) yanıt, çökme yok | [x] |

## 6. Entegrasyonlar

| # | Kontrol | Beklenen | Durum |
|---|---|---|---|
| 6.1 | Yerel API | `127.0.0.1:43117` (+12 deneme), Bearer belirteç | [x] |
| 6.2 | MCP | `initialize`, `tools/list` (7 araç), `tools/call` | [x] |
| 6.3 | CLI | `status`, `projects`, `workers`, `cash`, `summary`, `docs`, `ask`, `webhooks` | [x] |
| 6.4 | Webhook imzası | HMAC-SHA256, 3 deneme (2s / 8s / 30s) | [x] |
| 6.5 | SSRF koruması | Yerel adres serbest, özel/link-local engelli, yönlendirme yok | [x] |
| 6.6 | Uygulama kapalıyken | Net, anlaşılır hata mesajı (ham `fetch failed` değil) | [x] |

## 7. Kurulum ve kaldırma

| # | Kontrol | Beklenen | Durum |
|---|---|---|---|
| 7.1 | İlk ekran | Dil seçimi, 73 dil, Windows diline göre önseçim | [x] |
| 7.2 | Kurulum boyutu | ~98 MB tek dosya | [x] |
| 7.3 | Kaynaklar | `resources/integrations/{mcp,cli}`, `resources/tecton_assets` | [x] |
| 7.4 | Kaldırma sayfası | "Verilerimi de sil" onay kutusu, varsayılan işaretsiz | [x] |
| 7.5 | Kayıt defteri | Publisher, destek, güncelleme bağlantıları, `DisplayIcon` | [x] |
| 7.6 | Kaldırma veri koruması | İşaretsizse veritabanı, yedek ve loglar korunur | [x] |

## 8. Güvenlik

| # | Kontrol | Beklenen | Durum |
|---|---|---|---|
| 8.1 | `nodeIntegration` | `false` | [x] |
| 8.2 | `contextIsolation` | `true` | [x] |
| 8.3 | Gezinme koruması | Dış URL'ler sistem tarayıcısında, uygulama içinde engelli | [x] |
| 8.4 | Webview | `will-attach-webview` iptal | [x] |
| 8.5 | CSP | Üretim HTML'inde `script-src 'self'`, `object-src 'none'` | [x] |
| 8.6 | SQL | Tablo/sütun beyaz listesi, parametreli sorgular | [x] |
| 8.7 | Hata sızıntısı | Kullanıcıya yol/stack gitmez (`toUserErrorPayload`) | [x] |

## 9. Depo ve sürüm

| # | Kontrol | Beklenen | Durum |
|---|---|---|---|
| 9.1 | Sürüm | Her yerde `1.0.0` (package.json, derleme, installer) | [x] |
| 9.2 | Etiket | `1.0.0`, `development` dalının son commit'inde | [x] |
| 9.3 | Dallar | Yalnızca `main` ve `development` | [x] |
| 9.4 | Depo adı | `tecton`, herkese açık (`github.com/emirtdede/tecton`) | [x] |
| 9.5 | CI | Yeşil (`development`), `main`e birleştirme yapılmadı | [x] |

> **Dal durumu (karar bekliyor):** Yayın hattı `development` dalında ve `1.0.0`
> etiketi orayı gösteriyor. `main` dalı, bu çalışma başlamadan önceki
> `41ae621` commit'inde (11 Ekim 2026) duruyor; o dalda ayrıştırılmış
> bileşenler, 50 test dosyası ve güvenlik modülleri (`allowlist`, `keystore`,
> `secret`) var, bu yayın hattında ise kurumsal katman (tema, sihirbaz, bulut,
> yapay zeka, MCP/CLI, 73 dilli kurulum) var. İki dal 330 dosyada ayrışıyor ve
> 30 dosyada çakışıyor; kullanıcı onayı olmadan birleştirilmedi. Bu nedenle
> README'deki CI rozeti `main` dalını gösterdiği için kırmızı görünür; yeşil
> koşu `development` dalındadır.

## 10. Kanıtlar

Ekran görüntüleri `docs/screenshots/` altında:

- `01`-`04` ilk çalıştırma sihirbazı (dil, tema, karşılama, tur)
- `05`-`08` ana modüller (şantiyeler, personel, imalat, kasa)
- `09`-`13` sistem sayfaları (genel, finans, güvenlik, loglar, çöp kutusu)
- `14`-`16` hakkında, belgeler, yasal
- `17`-`18` görünüm paneli ve açık tema
- `19`-`21` Türkçe, Almanca, Japonca doğrulama
- `22`-`23` entegrasyonlar ve yapay zeka
- `installer-01-language.png` kurulum dil ekranı

Çekim yöntemi: `PrintWindow(hwnd, dc, 2)` ile sessiz yakalama; pencere hiçbir
aşamada öne alınmadı (`SetForegroundWindow` çağrılmadı), her tur tek betikte
çalışıp pencereyi hemen kapattı.
