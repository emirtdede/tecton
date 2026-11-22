# Changelog

All notable changes to Tecton are recorded here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

The product version is fixed at `1.0.0` for the first public release.

## [1.0.0] - 2026-11-22

### Added

- Two-level sidebar: a module icon rail plus a contextual page panel, with RTL support.
- Appearance panel: 15 palettes (14 curated plus a custom hex colour with automatic
  contrast-corrected foreground), selectable application icon, UI zoom from 80% to
  150%, high contrast, reduced motion, larger text and underlined links.
- Four-step welcome wizard: language, theme, welcome message and application tour.
- 73-language NSIS installer whose first page is the language picker, preselected
  from the Windows display language with English fallback.
- 19 complete interface dictionaries and an i18n gate that enforces key parity and
  placeholder consistency.
- Serverless cloud backup to OneDrive, Google Drive, Dropbox, iCloud Drive, Nextcloud
  or a custom folder: atomic writes, previous-file rotation, 15 daily backups,
  corrupt-file recovery chain and a post-format restore prompt.
- Cloud settings card with connection status, last sync time, backup summary,
  single-row actions and an auto-sync toggle.
- Windows platform service: silent tray start with Windows, global hotkey
  Ctrl + Alt + N, theme-matched tray icon, Jump List tasks and icon recolouring.
- Advanced updater on electron-updater and GitHub Releases with `.blockmap` delta
  download, SHA-512 verification, silent install and a `process.windowsStore` guard.
- Documentation page with a topic browser, shortcut reference, backup notes and a
  one-click support report.
- Legal notice page with publisher, privacy, third-party software and the MIT text.
- In-app update card with version, state, progress and a single action button.
- Quality gates: `scripts/check-style.js` (no em dashes, no emoji),
  `scripts/check-i18n.js` (19 dictionaries) and `scripts/quality-gate.js`.
- GitHub Actions CI that verifies typography, translations, tests, the renderer
  build and a full installer package on Windows.

### Changed

- Rebranded to Tecton with a single source of truth for brand assets in
  `tecton_assets/`; the tray icon switches between the dark and light badge to match
  the active surface.
- Version normalised to `1.0.0` in `package.json`, the installer, the About page and
  the update manifest.
- Build configuration moved to `electron-builder.config.cjs`; packaging uses
  `rcedit` through `scripts/afterPack.js` so a build works without Administrator
  rights or Developer Mode.
- Development database and logs moved to `.tecton-dev-data/`, keeping the real
  installation untouched.
- Every em dash replaced with a hyphen and every emoji placeholder replaced with an
  inline SVG icon across the interface.

### Fixed

- Payroll rounding now uses a single money helper, so overtime and deductions agree
  with the cash register to the kuruş.
- Media paths are resolved against the user data directory, so a moved database no
  longer loses its photos.
- Background cloud errors no longer surface as modal failures or block user actions.
- An empty local database can no longer overwrite a populated cloud snapshot.
- Log entries shown in the interface carry a user-safe message instead of an
  internal stack trace.

### Security

- Context isolation on, node integration off, and a single `window.api` bridge.
- Navigation allow-list, denied window open, denied webviews and denied permission
  requests.
- Every IPC handler validates its payload and maps internal errors through
  `toUserErrorPayload`.
- Single-instance lock prevents two processes writing the same database.
- The updater is disabled for Microsoft Store builds.
