/**
 * electron-builder configuration.
 *
 * Packaging is intentionally explicit: only the compiled renderer, the Electron
 * main/preload sources and the brand assets ship. `tecton_assets` is copied to
 * `resources/tecton_assets` because the tray/large-icon code resolves it from
 * `process.resourcesPath` in packaged builds.
 */

const fs = require('fs');
const path = require('path');

const languagesFile = path.join(__dirname, 'build', 'nsis-languages.json');
// English first: NSIS defaults `$LANGUAGE` to the first declared MUI_LANGUAGE,
// so everything rendered before the picker (init, UAC strings) is English.
const installerLanguages = (() => {
  if (!fs.existsSync(languagesFile)) return ['en_US'];
  const supported = JSON.parse(fs.readFileSync(languagesFile, 'utf8')).supported;
  return ['en_US', ...supported.filter((locale) => locale !== 'en_US')];
})();

module.exports = {
  appId: 'com.tecton.app',
  productName: 'Tecton',
  copyright: 'Copyright (c) 2026 Emir Tarik Dede',
  artifactName: 'Tecton-Setup-${version}.${ext}',
  directories: {
    output: 'release',
    buildResources: 'build',
  },
  files: [
    'dist/**/*',
    'src/main/**/*',
    'src/preload/**/*',
    'package.json',
    '!**/*.test.js',
    '!**/__tests__/**',
  ],
  extraResources: [
    { from: 'tecton_assets', to: 'tecton_assets' },
    // MCP and CLI are plain Node scripts. They must stay outside app.asar
    // because an external process (Node, an MCP client or Electron in
    // ELECTRON_RUN_AS_NODE mode) cannot read files inside the archive.
    { from: 'src/mcp', to: 'integrations/mcp' },
    { from: 'src/cli', to: 'integrations/cli' },
  ],
  asar: true,
  compression: 'maximum',
  // The executable metadata is written by scripts/afterPack.js with rcedit, so
  // electron-builder does not download the winCodeSign bundle (whose macOS
  // symlinks cannot be extracted without Administrator rights).
  afterPack: './scripts/afterPack.js',
  publish: [
    {
      provider: 'github',
      owner: 'emirtdede',
      repo: 'tecton',
      releaseType: 'release',
    },
  ],
  win: {
    icon: 'tecton_assets/tecton-tray-dark.ico',
    publisherName: 'Emir Tarik Dede',
    signAndEditExecutable: false,
    target: [{ target: 'nsis', arch: ['x64'] }],
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowElevation: true,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'Tecton',
    uninstallDisplayName: 'Tecton',
    installerIcon: 'tecton_assets/tecton-tray-dark.ico',
    uninstallerIcon: 'tecton_assets/tecton-tray-light.ico',
    installerHeaderIcon: 'tecton_assets/tecton-tray-dark.ico',
    include: 'build/installer.nsh',
    // multiUser.nsh does not translate every LangString for every language;
    // those fall back to English quietly instead of failing the build.
    warningsAsErrors: false,
    installerLanguages,
    multiLanguageInstaller: true,
    displayLanguageSelector: false,
    deleteAppDataOnUninstall: false,
    runAfterFinish: true,
  },
};
