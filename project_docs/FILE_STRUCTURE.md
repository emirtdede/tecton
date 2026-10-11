# Dosya Yapısı

## Genel Bakış

```text
project-root/                          # v1.0.0 (2026-10-11 doğrulandı)
├── src/
│   ├── main/                         # Electron Ana Süreci
│   │   ├── index.js                  # Pencere + CSP/navigasyon kilidi + shutdown backup
│   │   ├── ipcHandlers.js            # 40+ IPC kanalı (db/finance/system/media/window)
│   │   ├── logger.js                 # electron-log (YYYY/MM rotasyon)
│   │   ├── splash.html
│   │   ├── database/
│   │   │   ├── db.js                 # Şema (17 tablo) + migrasyon + integrity/auto-recovery
│   │   │   └── dbCompat.js           # better-sqlite3-multiple-ciphers async wrapper + verifyDbFile
│   │   ├── services/
│   │   │   ├── allowlist.js          # CRUD tablo/kolon allowlist
│   │   │   ├── secret.js             # Weather key (safeStorage)
│   │   │   ├── keystore.js           # TDE anahtarı (safeStorage + .tecton-key)
│   │   │   ├── crudService.js        # Jenerik CRUD + audit
│   │   │   ├── balanceService.js     # Tekli + toplu bakiye (N+1 fix)
│   │   │   ├── wageService.js        # Saf puantaj matematiği + validasyon
│   │   │   ├── financialService.js   # Avans/kasa atomik işlemler
│   │   │   ├── reportService.js      # Raporlar
│   │   │   ├── lanServer.js          # Express LAN upload (hardened)
│   │   │   └── testDb.js             # :memory: test şeması
│   │   └── utils/
│   │       └── archiveUtils.js       # YYYY/MM arşivleme (ZIP)
│   ├── preload/index.js              # contextBridge dar API (db/finance/system/media/window)
│   └── renderer/src/
│       ├── App.jsx                   # Root (toplu bakiye, debounce yok—tek IPC)
│       ├── main.jsx                  # ErrorBoundary sarmalı
│       ├── i18n.js                   # 19 dil
│       ├── components/
│       │   ├── Settings.jsx          # İnce kabuk (~340 satır) + 4 sekme:
│       │   ├── SettingsGeneralTab.jsx / SettingsFinanceTab.jsx
│       │   ├── SettingsSecurityTab.jsx / SettingsRecycleTab.jsx
│       │   ├── ErrorBoundary.jsx
│       │   └── *.jsx                # WorkerProfile, CashRegister, ...
│       ├── locales/*.json (19)       # tr,en,de,fr,es,zh,ru,ja,ko,it,nl,pt,ar,hi,sv,no,da,pl,cs
│       └── utils/                    # formatUtils, export/importUtils, validation, regionalPresets
├── scripts/seedDatabase.js           # fakerTR stres seeder (EBUSY korumalı)
├── e2e/*.spec.js + playwright.config.js
├── .github/workflows/ci.yml          # unit+coverage her push; e2e nightly(main)
├── project_docs/ (19 dosya)          # Mimari + DB + güvenlik + yol haritası
├── .nvmrc (=22) + LICENSE (MIT)
└── package.json                      # version 1.0.0 (semver, v prefix yok)
```