const log = require('electron-log');
const path = require('path');
const fs = require('fs');

// Resolve the Electron app object defensively. When the code runs outside a packaged
// Electron binary (unit tests, tooling), requiring 'electron' throws; in that case we
// fall back to local test paths instead of crashing the whole main process.
let app = null;
try {
  ({ app } = require('electron'));
} catch (err) {
  app = null;
}

// Configure electron-log to resolve path dynamically based on current date
log.transports.file.resolvePathFn = () => {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');

  const baseDir = app && typeof app.getPath === 'function'
    ? path.join(app.getPath('documents'), 'TectonBackups', 'SystemLogs-Backups')
    : path.join(__dirname, '../../.tecton-dev-data/SystemLogs-Backups');
  const logDir = path.join(baseDir, year, month);
  
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  return path.join(logDir, `${year}-${month}-${day}.log`);
};

// Customize the format
log.transports.file.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';
log.transports.console.format = '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

// Disable default console logging if needed, or keep it
log.transports.console.level = 'info';
log.transports.file.level = 'info';

module.exports = log;
