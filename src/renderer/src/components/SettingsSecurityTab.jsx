import React from 'react';

const SettingsSecurityTab = ({ t, appSettings, fetchData, setModalConfig }) => {
  const handleBackup = async () => {
    if (window.api) {
      const res = await window.api.system.backupDB();
      if (res.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.backup_success', 'Yedekleme başarıyla tamamlandı!'), type: 'success' } }));
      } else if (res.message !== 'İşlem iptal edildi') {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.backup_error', 'Yedekleme Hatası:') + ' ' + res.message, type: 'error' } }));
      }
    }
  };

  const handleVacuum = async () => {
    setModalConfig({
      isOpen: true,
      title: t('settings.vacuum_db', 'Sistemi Optimize Et'),
      message: t('settings.vacuum_desc', 'Veritabanı vakumlanarak silinmiş kayıtların kapladığı boşluklar geri kazanılacaktır. Bu işlem sistem hızınızı artırır.'),
      type: 'primary',
      onConfirm: async () => {
        if (window.api && window.api.system.vacuumDB) {
          const res = await window.api.system.vacuumDB();
          if (res.success) window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.optimize_success', 'Veritabanı başarıyla optimize edildi.'), type: 'success' } }));
          else window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.optimize_error', 'Optimizasyon Hatası:') + ' ' + res.message, type: 'error' } }));
        }
      }
    });
  };

  const handleCloudSyncFolder = async () => {
    if (window.api && window.api.system.setCloudFolder) {
      const res = await window.api.system.setCloudFolder();
      if (res.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.cloud_folder_success', 'Sessiz bulut yedekleme klasörü başarıyla ayarlandı:') + '\n' + res.folderPath, type: 'success' } }));
        fetchData();
      }
    }
  };

  const handleOpenOldBackups = async () => {
    if (window.api && window.api.system.openOldBackupsFolder) {
      await window.api.system.openOldBackupsFolder();
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Kritik Veri İşlemleri - Kırmızı / Uyarı Tasarımı */}
      <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)', background: 'rgba(239, 68, 68, 0.02)' }}>
        <h3 className="card-title" style={{ color: 'var(--danger)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          ⚠️ {t('settings.critical_system_actions', 'Kritik Sistem Eylemleri')}
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div>
            <button className="btn btn-primary" onClick={handleBackup} style={{ width: '100%', background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)', marginBottom: '0.5rem' }}>
              📦 {t('settings.backup_db', 'Tüm Veritabanını Yedekle (.sqlite Export)')}
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t('settings.backup_db_desc', 'Tüm sisteminizi (.sqlite veritabanı dosyası olarak) yerel diskinize aktarır. Bilgisayar değişimi veya yedekleme için kullanabilirsiniz.')}
            </p>
          </div>

          <div>
            <button className="btn" onClick={handleOpenOldBackups} style={{ width: '100%', background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', border: '1px solid var(--glass-border)' }}>
              📂 {t('settings.open_old_backups', 'Eski Yedekleme Klasörünü Aç')}
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              {t('settings.old_backups_desc', 'Geri yükleme öncesinde otomatik alınan sistem yedeklerine (Time Machine) buradan ulaşabilirsiniz.')}
            </p>
          </div>

          <div style={{ borderTop: '1px solid rgba(239, 68, 68, 0.15)', paddingTop: '1.25rem' }}>
            <label className="form-label" style={{ color: '#fca5a5' }}>{t('settings.restore_db_label', 'Yedekten Geri Yükle (Drag & Drop)')}</label>
            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={async (e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file && (file.name.endsWith('.sqlite') || file.name.endsWith('.db'))) {
                  setModalConfig({
                    isOpen: true,
                    title: t('settings.restore_confirm_title', 'Geri Yükleme Onayı'),
                    message: t('settings.restore_confirm', 'Veritabanını geri yüklemek istediğinize emin misiniz? Mevcut tüm verileriniz silinecektir!'),
                    type: 'danger',
                    onConfirm: async () => {
                      const res = await window.api.system.restoreDBFile({ filePath: file.path });
                      if (res && !res.success) {
                        if (res.message === 'RESTORE_CORRUPTED') {
                          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.restore_corrupted_error', 'Geri yükleme başarısız, dosya bozuk veya hatalı. Güvenlik için eski veritabanına dönüldü.'), type: 'error' } }));
                        } else {
                          window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.restore_error', 'Geri yükleme hatası:') + ' ' + res.message, type: 'error' } }));
                        }
                      }
                    }
                  });
                } else {
                  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.restore_invalid_file', 'Lütfen geçerli bir SQLite (.sqlite veya .db) veritabanı dosyası sürükleyin.'), type: 'warning' } }));
                }
              }}
              style={{
                border: '2px dashed rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                padding: '1.75rem',
                textAlign: 'center',
                cursor: 'pointer',
                background: 'rgba(239, 68, 68, 0.04)',
                transition: 'all 0.2s',
              }}
              onDragEnter={(e) => e.currentTarget.style.borderColor = 'var(--danger)'}
              onDragLeave={(e) => e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)'}
            >
              <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📥</div>
              <strong style={{ fontSize: '0.85rem', color: '#fff', display: 'block' }}>{t('settings.restore_db_title', 'Yedek Veritabanını Üzerine Yazdır')}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('settings.restore_db_desc', '.sqlite dosyasını buraya sürükleyip bırakın (Uygulama otomatik olarak yeniden başlayacaktır)')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Otomasyon ve Bakım */}
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>{t('settings.system_maintenance', 'Sistem Bakımı')}</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <button className="btn" onClick={handleVacuum} style={{ width: '100%', marginBottom: '0.5rem', background: 'rgba(255,255,255,0.04)' }}>
              🧹 {t('settings.vacuum_db', 'Veritabanını Optimize Et (Vacuum)')}
            </button>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t('settings.vacuum_db_desc', 'Boşaltılan veya silinen kayıtların oluşturduğu veritabanı boşluklarını temizler, disk alanını geri kazanır ve sorgu hızlarını artırır.')}
            </p>
          </div>

          <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '1.25rem' }}>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#10B981', fontWeight: '500' }}>
              ☁️ {t('settings.keys.cloud_sync_folder', 'Bulut Yedekleme Klasörü')}
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                readOnly
                value={appSettings.find(s => s.setting_key === 'cloud_sync_folder')?.setting_value || ''}
                style={{ flex: 1, marginBottom: 0 }}
              />
              <button className="btn" onClick={handleCloudSyncFolder} style={{ border: '1px solid #10B981', color: '#10B981', background: 'transparent', whiteSpace: 'nowrap' }}>
                {t('settings.select_folder', 'Klasör Seç')}
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {t('settings.cloud_sync_desc', 'Her uygulama kapandığında arkaplanda (sessizce) otomatik yedeklerin kaydedileceği bir Dropbox, Drive vb. bulut klasörü seçmenizi sağlar.')}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SettingsSecurityTab;
