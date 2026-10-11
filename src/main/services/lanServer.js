const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { app } = require('electron');

let serverInstance = null;
let currentPort = 5001;
let currentLang = 'tr';

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

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function sanitizeProjectId(raw) {
  const v = String(raw == null ? 'default' : raw);
  return /^[a-z0-9_-]{1,32}$/i.test(v) ? v : 'default';
}

// In-memory fallback rate limiter (used if express-rate-limit is unavailable).
// 15 requests / 60s per IP.
const _rateBuckets = new Map();
function inMemoryRateLimit(req, res, next) {
  try {
    const ip = (req.ip || req.connection?.remoteAddress || 'unknown').toString();
    const now = Date.now();
    const arr = (_rateBuckets.get(ip) || []).filter((t) => now - t < 60000);
    if (arr.length >= 15) {
      return res.status(429).json({ success: false, message: 'Too many requests.' });
    }
    arr.push(now);
    _rateBuckets.set(ip, arr);
    next();
  } catch (_) {
    next();
  }
}

function getUploadRateLimiter() {
  try {
    const { rateLimit } = require('express-rate-limit');
    return rateLimit({ windowMs: 60000, limit: 15, standardHeaders: false, legacyHeaders: false });
  } catch (_) {
    return inMemoryRateLimit;
  }
}

async function verifyImageMagic(filePath) {
  // allowlist: jpg, png, webp by magic bytes. ESM-only file-type -> dynamic import.
  try {
    const mod = await import('file-type');
    const fn = mod.fileTypeFromFile || (mod.default && mod.default.fileTypeFromFile);
    if (!fn) return { verified: false, reason: 'UNVERIFIED' };
    const t = await fn(filePath);
    if (!t) return { verified: false, reason: 'INVALID_CONTENT' };
    if (['image/jpeg', 'image/png', 'image/webp'].includes(t.mime)) {
      return { verified: true, mime: t.mime };
    }
    return { verified: false, reason: 'INVALID_CONTENT', detected: t.mime };
  } catch (_) {
    return { verified: false, reason: 'UNVERIFIED' };
  }
}

function startLANServer(mainWindow, lang) {
  if (lang) {
    currentLang = lang;
  }

  if (serverInstance) {
    return { success: true, port: currentPort, ip: getLocalIP() };
  }

  const expressApp = express();
  
  const storage = multer.diskStorage({
    destination: function (req, file, cb) {
      const projectId = sanitizeProjectId(req.query.projectId || 'default');
      const isDev = process.env.NODE_ENV === 'development';
      const baseDir = path.resolve(isDev
        ? path.join(__dirname, '../../../media')
        : path.join(app.getPath('userData'), 'media'));

      const projectDir = path.resolve(baseDir, `project_${projectId}`);
      if (!projectDir.startsWith(baseDir)) {
        return cb(new Error('INVALID_PROJECT'));
      }
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }
      cb(null, projectDir);
    },
    filename: function (req, file, cb) {
      const uniqueName = `${Date.now()}_${Math.floor(Math.random() * 10000)}.webp`;
      cb(null, uniqueName);
    }
  });

  // Sync fileFilter (CVE-2026-77063: async fileFilter bypasses limits.fileSize).
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'];
  const ALLOWED_EXT = ['.jpg', '.jpeg', '.png', '.webp'];
  function syncFileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_MIME.includes(file.mimetype) || !ALLOWED_EXT.includes(ext)) {
      return cb(new Error('INVALID_TYPE'), false);
    }
    cb(null, true);
  }

  const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 5, parts: 10 },
    fileFilter: syncFileFilter
  });

  expressApp.use('/upload', getUploadRateLimiter());

  expressApp.get('/', (req, res) => {
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    const projectId = sanitizeProjectId(req.query.projectId || '');
    const projectName = escapeHtml(req.query.projectName || 'Genel');
    const isTr = currentLang === 'tr';

    // Localized strings
    const txtTitle = isTr ? 'Şantiye Fotoğraf Yükleyici' : 'Site Photo Uploader';
    const txtHeader = isTr ? 'Şantiye Fotoğraf Yükle' : 'Upload Site Photo';
    const txtSite = isTr ? 'Şantiye' : 'Site';
    const txtTakeChoose = isTr ? '📸 Fotoğraf Çek / Seç' : '📸 Take / Choose Photo';
    const txtStartUpload = isTr ? 'Yüklemeyi Başlat' : 'Start Upload';
    
    // Dynamic JavaScript translation variables for client side
    const jsCompressing = isTr ? 'Görsel sıkıştırılıyor ve formatı optimize ediliyor...' : 'Compressing image and optimizing format...';
    const jsUploading = isTr ? 'Yükleniyor...' : 'Uploading...';
    const jsSuccess = isTr ? '✓ Fotoğraf başarıyla yüklendi!' : '✓ Photo uploaded successfully!';
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

              const res = await fetch('/upload?projectId=' + '${projectId}', {
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

  expressApp.post('/upload', upload.single('photo'), async (req, res) => {
    try {
      const isTr = currentLang === 'tr';
      if (!req.file) {
        return res.status(400).json({ success: false, message: isTr ? 'Fotoğraf dosyası bulunamadı.' : 'Photo file not found.' });
      }

      const projectId = sanitizeProjectId(req.query.projectId || 'default');
      // Magic-byte verification (defense-in-depth; UNVERIFIED still accepted for compat)
      const check = await verifyImageMagic(req.file.path);
      if (check.reason === 'INVALID_CONTENT') {
        try { fs.unlinkSync(req.file.path); } catch (_) { /* ignore */ }
        return res.status(400).json({ success: false, message: isTr ? 'Geçersiz dosya içeriği.' : 'Invalid file content.' });
      }

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
      res.status(500).json({ success: false, message: err.message });
    }
  });

  const bindIp = getLocalIP();
  serverInstance = expressApp.listen(currentPort, bindIp, () => {
    // LAN server started on LAN IP (not 0.0.0.0)
  });

  return { success: true, port: currentPort, ip: getLocalIP() };
}

function stopLANServer() {
  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }
}

module.exports = { startLANServer, stopLANServer, getLocalIP, sanitizeProjectId, escapeHtml, verifyImageMagic };
