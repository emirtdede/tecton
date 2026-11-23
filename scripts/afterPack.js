/**
 * Sets the Windows executable metadata and icon.
 *
 * electron-builder normally does this itself, but that path downloads the
 * `winCodeSign` bundle and extracts macOS symlinks, which fails on a Windows
 * machine without Administrator rights or Developer Mode. Calling `rcedit`
 * directly keeps the build reproducible for every contributor, and the result
 * is identical: product name, description, copyright, version and icon.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');

function resolveRcedit() {
  const candidates = [
    path.join(ROOT, 'node_modules', 'rcedit', 'bin', 'rcedit-x64.exe'),
    path.join(ROOT, 'node_modules', 'rcedit', 'bin', 'rcedit.exe'),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const appInfo = context.packager.appInfo;
  const exeName = `${appInfo.productFilename}.exe`;
  const exePath = path.join(context.appOutDir, exeName);
  if (!fs.existsSync(exePath)) {
    throw new Error(`afterPack: expected ${exePath} to exist`);
  }

  const rcedit = resolveRcedit();
  if (!rcedit) {
    throw new Error('afterPack: rcedit is missing. Run npm install before packaging.');
  }

  const iconPath = path.join(ROOT, 'tecton_assets', 'tecton-tray-dark.ico');
  const version = appInfo.version;
  const strings = {
    FileDescription: appInfo.productName,
    ProductName: appInfo.productName,
    LegalCopyright: appInfo.copyright,
    CompanyName: appInfo.companyName || 'Emir Tarık Dede',
    InternalName: appInfo.productFilename,
    OriginalFilename: exeName,
  };

  const args = [exePath, '--set-icon', iconPath, '--set-file-version', version, '--set-product-version', version];
  for (const [key, value] of Object.entries(strings)) {
    args.push('--set-version-string', key, value);
  }

  execFileSync(rcedit, args, { stdio: 'inherit', windowsHide: true });
  console.log(`  • executable metadata and icon applied  file=${exeName}`);
};
