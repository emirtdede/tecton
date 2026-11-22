const { toUserMessage } = require('../utils/errorUtils');
const { getMediaBaseDir } = require('../utils/mediaPaths');
const logger = require('../logger');
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Only these content types may be stored, and the saved extension is derived
// from the MIME type - never from the client-supplied filename.
const ALLOWED_IMAGE_TYPES = new Map([
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
  ['image/heic', '.heic'],
  ['image/heif', '.heif']
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

let serverInstance = null;
let currentPort = 5001;
let currentLang = 'tr';
// Per-session upload token. The server binds to 0.0.0.0 so any device on the
// LAN can reach it; without a token anyone on the network (guest WiFi, a
// compromised phone) could POST arbitrary images into a project's media folder
// just by guessing the id. The QR code carries the token, so the legitimate
// flow is unchanged.
let uploadToken = null;

function createUploadToken() {
  return crypto.randomBytes(24).toString('hex');
}

/**
 * True only when the request carries the current token. Comparison is
 * constant-time so a timing oracle cannot be used to recover it byte by byte.
 */
function isAuthorizedRequest(req) {
  if (!uploadToken) return false;
  const provided = req.query.token;
  if (typeof provided !== 'string' || provided.length !== uploadToken.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(uploadToken, 'utf8'));
  } catch (err) {
    return false;
  }
}

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      const family = typeof iface.family === 'string' ? iface.family : `IPv${iface.family}`;
      if (family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeProjectId(projectId) {
  return String(projectId || 'default').replace(/[^a-zA-Z0-9_-]/g, '') || 'default';
}

async function startLANServer(mainWindow, lang) {
  if (lang) {
    currentLang = lang;
  }

  if (serverInstance) {
    return { success: true, port: currentPort, ip: getLocalIP(), token: uploadToken };
  }

  // A fresh token for every start: stopping and restarting the server revokes
  // any previously shared QR link.
  uploadToken = createUploadToken();

  const expressApp = express();
  
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const projectId = sanitizeProjectId(req.query.projectId);
      const baseDir = getMediaBaseDir();

      const projectDir = path.join(baseDir, `project_${projectId}`);
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      cb(null, projectDir);
    },
    filename: function (req, file, cb) {
      // Extension comes from the verified MIME type, not `originalname`:
      // a file named `payload.exe` sent with `Content-Type: image/jpeg` must
      // never be written to disk with an executable extension.
      const ext = ALLOWED_IMAGE_TYPES.get(String(file.mimetype || '').toLowerCase()) || '.bin';
      const uniqueName = `${Date.now()}_${Math.floor(Math.random() * 10000)}${ext}`;
      cb(null, uniqueName);
    }
  });

  const upload = multer({
    storage: storage,
    limits: { fileSize: 15 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      const mime = String(file.mimetype || '').toLowerCase();
      const ext = path.extname(file.originalname || '').toLowerCase();
      // BOTH checks must pass. The old `!isImageMime && !isImageExt` used OR,
      // so `payload.exe` with a spoofed `image/jpeg` header (or `photo.jpg`
      // whose bytes are HTML) was accepted.
      if (!ALLOWED_IMAGE_TYPES.has(mime) || !ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
        const err = new Error('Yalnızca görsel dosyaları yüklenebilir.');
        err.code = 'INVALID_FILE_TYPE';
        return cb(err);
      }
      cb(null, true);
    }
  });

  expressApp.get('/', (req, res) => {
    const isTr = currentLang === 'tr';

    if (!isAuthorizedRequest(req)) {
      return res
        .status(403)
        .send(
          isTr
            ? '<h1>403 - Geçersiz veya süresi dolmuş bağlantı</h1><p>Lütfen bilgisayardaki QR kodu yeniden okutun.</p>'
            : '<h1>403 - Invalid or expired link</h1><p>Please scan the QR code on the computer again.</p>'
        );
    }

    const projectId = sanitizeProjectId(req.query.projectId);
    const projectName = escapeHtml(req.query.projectName || 'Genel');

    // Localized strings
    const txtTitle = isTr ? 'Şantiye Fotoğraf Yükleyici' : 'Site Photo Uploader';
    const txtHeader = isTr ? 'Şantiye Fotoğraf Yükle' : 'Upload Site Photo';
    const txtSite = isTr ? 'Şantiye' : 'Site';
    const txtTakeChoose = isTr ? ' Fotoğraf Çek / Seç' : ' Take / Choose Photo';
    const txtStartUpload = isTr ? 'Yüklemeyi Başlat' : 'Start Upload';
    
    // Dynamic JavaScript translation variables for client side
    const jsCompressing = isTr ? 'Görsel sıkıştırılıyor ve formatı optimize ediliyor...' : 'Compressing image and optimizing format...';
    const jsUploading = isTr ? 'Yükleniyor...' : 'Uploading...';
    const jsSuccess = isTr ? ' Fotoğraf başarıyla yüklendi!' : ' Photo uploaded successfully!';
    const jsErrorPrefix = isTr ? 'Hata: ' : 'Error: ';
    const jsConnErrorPrefix = isTr ? 'Bağlantı hatası: ' : 'Connection error: ';
    const jsErrImageLoad = isTr ? 'Görsel yüklenemedi.' : 'Image could not be loaded.';
    const jsErrFileRead = isTr ? 'Dosya okunamadı.' : 'File could not be read.';

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${txtTitle}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #0f172a;
            color: #f8fafc;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 1rem;
            box-sizing: border-box;
          }
          .card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 2rem;
            border-radius: 16px;
            text-align: center;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            backdrop-filter: blur(10px);
          }
          h1 { font-size: 1.5rem; margin-bottom: 0.5rem; color: #38bdf8; }
          p { font-size: 0.9rem; color: #94a3b8; margin-bottom: 2rem; }
          .file-input-label {
            display: inline-block;
            background: linear-gradient(135deg, #8b5cf6 0%, #3b82f6 100%);
            color: white;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            transition: transform 0.2s;
            margin-bottom: 1rem;
            width: 100%;
            box-sizing: border-box;
          }
          .file-input-label:active { transform: scale(0.98); }
          input[type="file"] { display: none; }
          .btn-submit {
            background: #10B981;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 8px;
            font-weight: bold;
            width: 100%;
            cursor: pointer;
            margin-top: 1rem;
            display: none;
            box-sizing: border-box;
          }
          .status { margin-top: 1.5rem; font-size: 0.95rem; font-weight: 500; }
          .success { color: #34d399; }
          .error { color: #f87171; }
          .spinner {
            border: 4px solid rgba(255,255,255,0.1);
            width: 36px;
            height: 36px;
            border-radius: 50%;
            border-left-color: #38bdf8;
            animation: spin 1s linear infinite;
            display: inline-block;
            margin-top: 1rem;
          }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>${txtHeader}</h1>
          <p>${txtSite}: <strong style="color:#fff">${projectName}</strong></p>
          <form id="uploadForm" enctype="multipart/form-data">
            <label class="file-input-label" id="fileLabel">
              ${txtTakeChoose}
              <input type="file" name="photo" accept="image/*" id="fileInput" required />
            </label>
            <div id="fileName" style="margin-bottom:1rem;font-size:0.85rem;color:#cbd5e1"></div>
            <button type="submit" class="btn-submit" id="submitBtn">${txtStartUpload}</button>
          </form>
          <div id="loader" style="display:none;"><div class="spinner"></div></div>
          <div class="status" id="statusMsg"></div>
        </div>

        <script>
          const fileInput = document.getElementById('fileInput');
          const fileLabel = document.getElementById('fileLabel');
          const fileName = document.getElementById('fileName');
          const submitBtn = document.getElementById('submitBtn');
          const statusMsg = document.getElementById('statusMsg');
          const loader = document.getElementById('loader');

          fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
              const file = e.target.files[0];
              fileName.textContent = file.name;
              submitBtn.style.display = 'block';
            }
          });

          document.getElementById('uploadForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = fileInput.files[0];
            if (!file) return;

            submitBtn.style.display = 'none';
            fileLabel.style.display = 'none';
            loader.style.display = 'block';
            statusMsg.className = 'status';
            statusMsg.textContent = \`${jsCompressing}\`;

            try {
              const compressAndGetBlob = (inputFile) => {
                return new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                    const img = new Image();
                    img.onload = () => {
                      const canvas = document.createElement('canvas');
                      let width = img.width;
                      let height = img.height;
                      const maxWidth = 1200;
                      if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                      }
                      canvas.width = width;
                      canvas.height = height;
                      const ctx = canvas.getContext('2d');
                      ctx.drawImage(img, 0, 0, width, height);
                      canvas.toBlob((blob) => {
                        resolve(blob || inputFile);
                      }, 'image/webp', 0.8);
                    };
                    img.onerror = () => reject(new Error(\`${jsErrImageLoad}\`));
                    img.src = event.target.result;
                  };
                  reader.onerror = () => reject(new Error(\`${jsErrFileRead}\`));
                  reader.readAsDataURL(inputFile);
                });
              };

              const webpBlob = await compressAndGetBlob(file);
              const formData = new FormData();
              formData.append('photo', webpBlob, 'mobile_photo.webp');

              statusMsg.textContent = \`${jsUploading}\`;

              const res = await fetch('/upload?projectId=' + encodeURIComponent('${projectId}') + '&token=' + encodeURIComponent('${uploadToken}'), {
                method: 'POST',
                body: formData
              });
              const data = await res.json();
              loader.style.display = 'none';
              if (data.success) {
                statusMsg.className = 'status success';
                statusMsg.textContent = \`${jsSuccess}\`;
                setTimeout(() => {
                  fileLabel.style.display = 'inline-block';
                  fileName.textContent = '';
                  fileInput.value = '';
                }, 3000);
              } else {
                statusMsg.className = 'status error';
                statusMsg.textContent = \`${jsErrorPrefix}\` + data.message;
                submitBtn.style.display = 'block';
                fileLabel.style.display = 'inline-block';
              }
            } catch (err) {
              loader.style.display = 'none';
              statusMsg.className = 'status error';
              statusMsg.textContent = \`${jsConnErrorPrefix}\` + err.message;
              submitBtn.style.display = 'block';
              fileLabel.style.display = 'inline-block';
            }
          });
        </script>
      </body>
      </html>
    `);
  });

  // The token check runs BEFORE multer: multer writes the file to disk as part
  // of parsing the request, so validating afterwards would mean an unauthenticated
  // caller could still fill the disk - it would just be told "no" at the end.
  expressApp.post('/upload', (req, res, next) => {
    if (!isAuthorizedRequest(req)) {
      const isTr = currentLang === 'tr';
      return res.status(403).json({
        success: false,
        message: isTr ? 'Geçersiz veya süresi dolmuş bağlantı.' : 'Invalid or expired link.'
      });
    }
    next();
  }, upload.single('photo'), (req, res) => {
    try {
      const isTr = currentLang === 'tr';
      if (!req.file) {
        return res.status(400).json({ success: false, message: isTr ? 'Fotoğraf dosyası bulunamadı.' : 'Photo file not found.' });
      }

      const projectId = sanitizeProjectId(req.query.projectId);
      const relativePath = `project_${projectId}/${req.file.filename}`;
      
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('lan:photo-uploaded', {
          projectId,
          filename: req.file.filename,
          relativePath
        });
      }

      res.json({ success: true, relativePath });
    } catch (err) {
      res.status(500).json({ success: false, message: toUserMessage(err, 'file_error') });
    }
  });

  // Multer/Express error handler. Without this, a size-limit or file-filter
  // rejection fell through to Express's default handler, which responds with an
  // HTML page and (in development) a stack trace.
  expressApp.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const isTr = currentLang === 'tr';
    let message;
    if (err && err.code === 'LIMIT_FILE_SIZE') {
      message = isTr ? 'Dosya boyutu 15 MB sınırını aşıyor.' : 'The file exceeds the 15 MB limit.';
    } else if (err && err.code === 'LIMIT_FILE_COUNT') {
      message = isTr ? 'Aynı anda yalnızca bir fotoğraf yüklenebilir.' : 'Only one photo can be uploaded at a time.';
    } else if (err && err.code === 'INVALID_FILE_TYPE') {
      message = isTr ? 'Yalnızca görsel dosyaları yüklenebilir.' : 'Only image files can be uploaded.';
    } else {
      logger.error('LAN upload error:', err);
      message = toUserMessage(err, 'file_error');
    }
    res.status(400).json({ success: false, message });
  });

  // `listen` emits 'error' asynchronously (EADDRINUSE, EACCES). Without a
  // listener that becomes an unhandled 'error' event and kills the Electron
  // main process. Try a small range of ports and report failure instead.
  const listenOnPort = (port) => new Promise((resolve, reject) => {
    const server = expressApp.listen(port, '0.0.0.0');
    const onError = (err) => {
      server.removeListener('listening', onListening);
      reject(err);
    };
    const onListening = () => {
      server.removeListener('error', onError);
      resolve(server);
    };
    server.once('error', onError);
    server.once('listening', onListening);
  });

  let lastError = null;
  for (let offset = 0; offset < 10; offset++) {
    const port = currentPort + offset;
    try {
      serverInstance = await listenOnPort(port);
      currentPort = port;
      // Runtime errors after startup (EMFILE, socket errors) must be logged,
      // never allowed to become unhandled.
      serverInstance.on('error', (err) => logger.error('LAN server runtime error:', err));
      return { success: true, port, ip: getLocalIP(), token: uploadToken };
    } catch (err) {
      lastError = err;
      if (err.code !== 'EADDRINUSE' && err.code !== 'EACCES') break;
    }
  }

  // Windows can reserve the 5001-5010 range (Hyper-V/WinNAT exclusions), which
  // surfaces as EACCES even though no process is listening. Fall back to an
  // OS-assigned port; the QR code carries whatever port we report.
  if (lastError && (lastError.code === 'EADDRINUSE' || lastError.code === 'EACCES')) {
    try {
      serverInstance = await listenOnPort(0);
      currentPort = serverInstance.address().port;
      serverInstance.on('error', (err) => logger.error('LAN server runtime error:', err));
      return { success: true, port: currentPort, ip: getLocalIP(), token: uploadToken };
    } catch (ephemeralErr) {
      lastError = ephemeralErr;
    }
  }

  serverInstance = null;
  uploadToken = null;
  logger.error('LAN server failed to start:', lastError);
  return { success: false, message: toUserMessage(lastError, 'network_error') };
}

function stopLANServer() {
  if (serverInstance) {
    try {
      // Close idle keep-alive sockets immediately so the port is free for the
      // next start; otherwise the old server lingers until the OS times out.
      if (typeof serverInstance.closeAllConnections === 'function') {
        serverInstance.closeAllConnections();
      }
      serverInstance.close();
    } catch (err) {
      logger.warn('LAN server close error:', err.message);
    }
    serverInstance = null;
  }
  // Revoke the token even if the server had already stopped: a stale QR link
  // must never keep working after the user closes the modal.
  uploadToken = null;
}

module.exports = { startLANServer, stopLANServer, getLocalIP };
