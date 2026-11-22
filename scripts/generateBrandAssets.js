/**
 * Rasterizes the branding SVGs in `tecton_assets/` into the PNG and multi-size
 * ICO files Electron and electron-builder need.
 *
 * Windows cannot use an SVG for a window icon or a shortcut icon, so every
 * branding update must regenerate the binary derivatives. Run it with Electron
 * (not plain node) so the SVG is rendered by Chromium:
 *
 *   npx electron scripts/generateBrandAssets.js
 *
 * Outputs (overwritten in place):
 *   tecton_assets/tecton-tray-dark.png    512x512
 *   tecton_assets/tecton-tray-dark.ico    16, 24, 32, 48, 64, 128, 256
 *   tecton_assets/tecton-tray-light.png   same
 *   tecton_assets/tecton-tray-light.ico   same
 */
const { app, BrowserWindow, nativeImage } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT, 'tecton_assets');

const TARGETS = ['tecton-tray-dark', 'tecton-tray-light'];

const PNG_SIZE = 512;
// Windows picks the closest entry; 256 is the largest legal ICO dimension.
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];
// Render above the target size so downscaling keeps the fine grid lines crisp.
const RENDER_SIZE = 1024;

function buildIco(images) {
  // ICO container: 6-byte header, one 16-byte directory entry per image, then
  // the PNG payloads. PNG-compressed entries are supported since Windows Vista
  // and keep the file small (a BMP entry for 256x256 would be ~256 kB alone).
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const directory = Buffer.alloc(images.length * 16);
  let offset = 6 + images.length * 16;

  images.forEach(({ size, buffer }, index) => {
    const entry = index * 16;
    // 0 means 256 in the ICO directory.
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 0);
    directory.writeUInt8(size >= 256 ? 0 : size, entry + 1);
    directory.writeUInt8(0, entry + 2); // palette colours
    directory.writeUInt8(0, entry + 3); // reserved
    directory.writeUInt16LE(1, entry + 4); // colour planes
    directory.writeUInt16LE(32, entry + 6); // bits per pixel
    directory.writeUInt32LE(buffer.length, entry + 8);
    directory.writeUInt32LE(offset, entry + 12);
    offset += buffer.length;
  });

  return Buffer.concat([header, directory, ...images.map(i => i.buffer)]);
}

async function renderSvg(svgPath, label) {
  // One temp file and one window per target: reusing a single path raced the
  // previous file's deletion (ERR_FAILED) and a reused hidden window lost its
  // display surface after the first capture.
  const htmlPath = path.join(os.tmpdir(), `tecton-brand-${process.pid}-${label}.html`);
  const svgUrl = pathToFileURL(svgPath).href;
  const html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <style>
      html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; }
      img { display: block; width: ${RENDER_SIZE}px; height: ${RENDER_SIZE}px; }
    </style>
  </head>
  <body><img src="${svgUrl}" alt=""></body>
</html>`;
  fs.writeFileSync(htmlPath, html, 'utf8');

  const win = new BrowserWindow({
    width: RENDER_SIZE,
    height: RENDER_SIZE,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences: { backgroundThrottling: false, offscreen: true }
  });

  try {
    await win.loadURL(pathToFileURL(htmlPath).href);

    // Offscreen rendering pushes each painted frame through the `paint` event.
    // Waiting for a real frame (instead of capturePage, which needs an on-screen
    // surface) keeps this working with the window hidden.
    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error(`Timed out waiting for a paint frame (${label})`)),
        15000
      );
      // The SVG paints in a couple of frames; keep the last one.
      let last = null;
      win.webContents.on('paint', (_event, _dirty, image) => {
        last = image;
      });
      const deadline = Date.now() + 2500;
      const poll = () => {
        if (last && Date.now() > deadline) {
          clearTimeout(timeout);
          resolve(last);
          return;
        }
        if (!last && Date.now() > deadline + 5000) {
          clearTimeout(timeout);
          reject(new Error(`No frame painted (${label})`));
          return;
        }
        setTimeout(poll, 100);
      };
      poll();
    });
  } finally {
    win.destroy();
    fs.rmSync(htmlPath, { force: true });
  }
}

app.whenReady().then(async () => {
  // Closing the per-target window fires `window-all-closed`, and Electron's
  // default is to quit. Without this no-op listener the app shut down after
  // rasterizing the first logo and the second load failed with ERR_FAILED.
  app.on('window-all-closed', () => {});

  try {
    for (const name of TARGETS) {
      const svgPath = path.join(ASSETS_DIR, `${name}.svg`);
      if (!fs.existsSync(svgPath)) {
        throw new Error(`Missing source SVG: ${svgPath}`);
      }

      const captured = await renderSvg(svgPath, name);
      const image = captured.resize({ width: PNG_SIZE, height: PNG_SIZE, quality: 'best' });
      const pngBuffer = image.toPNG();
      fs.writeFileSync(path.join(ASSETS_DIR, `${name}.png`), pngBuffer);

      const entries = ICO_SIZES.map(size => {
        const resized = nativeImage.createFromBuffer(pngBuffer).resize({
          width: size,
          height: size,
          quality: 'best'
        });
        return { size, buffer: resized.toPNG() };
      });
      const icoBuffer = buildIco(entries);
      fs.writeFileSync(path.join(ASSETS_DIR, `${name}.ico`), icoBuffer);

      console.log(`${name}: png ${pngBuffer.length} B, ico ${icoBuffer.length} B (${ICO_SIZES.join(', ')})`);
    }
    app.exit(0);
  } catch (error) {
    console.error('Brand asset generation failed:', error);
    app.exit(1);
  }
});
