// Minimal Electron stub for unit tests.
// Unit tests must not require the real Electron binary; only the few APIs used by
// main-process services are provided here.
const os = require('os');
const path = require('path');

const userData = path.join(os.tmpdir(), 'tecton-tests');

module.exports = {
  app: {
    getPath: (name) => {
      if (name === 'userData') return userData;
      if (name === 'documents') return path.join(userData, 'documents');
      if (name === 'desktop') return path.join(userData, 'desktop');
      return userData;
    },
    getAppPath: () => path.join(userData, 'app'),
    relaunch: () => {},
    exit: () => {},
    whenReady: () => Promise.resolve()
  },
  ipcMain: {
    handle: () => {},
    on: () => {},
    off: () => {}
  },
  dialog: {
    showSaveDialog: async () => ({ canceled: true }),
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
    showErrorBox: () => {}
  },
  BrowserWindow: Object.assign(
    function BrowserWindow() {},
    { fromWebContents: () => null, getAllWindows: () => [] }
  ),
  shell: {
    openPath: async () => '',
    showItemInFolder: () => {},
    writeShortcutLink: () => true
  }
};
