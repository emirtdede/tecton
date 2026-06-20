const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

function processBackupArchiving(backupFolder) {
  try {
    if (!fs.existsSync(backupFolder)) return;

    // 1. Migration: Move legacy root files to YYYY/MM/ structure
    const rootFiles = fs.readdirSync(backupFolder);
    const dailyBackupRegex = /^elektronik-yevmiye-backup-(\d{4})-(\d{2})-\d{2}\.sqlite$/;
    const zipArchiveRegex = /^elektronik-yevmiye-backup-(\d{4})-\d{2}\.zip$/;

    rootFiles.forEach(file => {
      const filePath = path.join(backupFolder, file);
      if (!fs.statSync(filePath).isFile()) return;

      const dailyMatch = file.match(dailyBackupRegex);
      if (dailyMatch) {
        const year = dailyMatch[1];
        const month = dailyMatch[2];
        const destDir = path.join(backupFolder, year, month);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.renameSync(filePath, path.join(destDir, file));
        console.log(`Migrated daily backup file ${file} to ${destDir}`);
      }

      const zipMatch = file.match(zipArchiveRegex);
      if (zipMatch) {
        const year = zipMatch[1];
        const destDir = path.join(backupFolder, year);
        if (!fs.existsSync(destDir)) {
          fs.mkdirSync(destDir, { recursive: true });
        }
        fs.renameSync(filePath, path.join(destDir, file));
        console.log(`Migrated zip archive ${file} to ${destDir}`);
      }
    });

    // 2. Compress and archive previous months' folders
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = String(today.getMonth() + 1).padStart(2, '0');
    const currentYearMonth = `${currentYear}-${currentMonth}`;

    const years = fs.readdirSync(backupFolder);
    for (const year of years) {
      const yearPath = path.join(backupFolder, year);
      if (!fs.existsSync(yearPath) || !fs.statSync(yearPath).isDirectory()) continue;

      const months = fs.readdirSync(yearPath);
      for (const month of months) {
        const monthPath = path.join(yearPath, month);
        if (!fs.existsSync(monthPath) || !fs.statSync(monthPath).isDirectory()) continue;

        const folderYearMonth = `${year}-${month}`;
        if (folderYearMonth < currentYearMonth) {
          const files = fs.readdirSync(monthPath);
          const backupFiles = files.filter(f => dailyBackupRegex.test(f));

          if (backupFiles.length > 0) {
            const zipPath = path.join(yearPath, `elektronik-yevmiye-backup-${folderYearMonth}.zip`);
            const zip = new AdmZip();

            backupFiles.forEach(file => {
              const filePath = path.join(monthPath, file);
              if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
                zip.addLocalFile(filePath);
              }
            });

            zip.writeZip(zipPath);
            console.log(`Archived daily backups for ${folderYearMonth} to ${zipPath}`);
          }

          fs.rmSync(monthPath, { recursive: true, force: true });
        }
      }

      // Cleanup year directory if empty
      try {
        const remaining = fs.readdirSync(yearPath);
        if (remaining.length === 0) {
          fs.rmdirSync(yearPath);
        }
      } catch (e) {
        // ignore
      }
    }
  } catch (err) {
    console.error('Backup archiving error:', err);
  }
}

module.exports = { processBackupArchiving };
