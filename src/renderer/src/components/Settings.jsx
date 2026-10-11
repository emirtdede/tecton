import React, { useState, useEffect } from 'react';
import SystemLogs from './SystemLogs';
import ConfirmationModal from './ui/ConfirmationModal';
import GuideDrawer from './ui/GuideDrawer';
import SettingsGeneralTab from './SettingsGeneralTab';
import SettingsFinanceTab from './SettingsFinanceTab';
import SettingsSecurityTab from './SettingsSecurityTab';
import SettingsRecycleTab from './SettingsRecycleTab';
import { useTranslation } from 'react-i18next';

const Settings = ({ activeTab = 'genel' }) => {
  const { t, i18n } = useTranslation();
  const [appSettings, setAppSettings] = useState([]);
  const [workTypes, setWorkTypes] = useState([]);
  const [workerGroups, setWorkerGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tempCompanyName, setTempCompanyName] = useState('');
  const [tempCompanyLogo, setTempCompanyLogo] = useState('');

  // Modal State
  const [modalConfig, setModalConfig] = useState({ isOpen: false, title: '', message: '', type: 'danger', onConfirm: () => {} });

  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const fetchData = async () => {
    if (window.api) {
      setLoading(true);
      const settingsData = await window.api.db.read('app_settings');
      const typesData = await window.api.db.read('work_types');
      const groupsData = await window.api.db.read('worker_groups');

      setAppSettings(settingsData);

      const nameSetting = settingsData.find(s => s.setting_key === 'company_name');
      const logoSetting = settingsData.find(s => s.setting_key === 'company_logo');
      if (nameSetting) setTempCompanyName(nameSetting.setting_value || '');
      if (logoSetting) setTempCompanyLogo(logoSetting.setting_value || '');

      setWorkTypes(typesData);
      setWorkerGroups(groupsData);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Update App Settings
  const handleSettingChange = async (id, key, value) => {
    if (key === 'standard_daily_hours') {
      // Local state update allows intermediate states (e.g. empty, "-", "0")
      setAppSettings(prev => prev.map(s => s.id === id ? { ...s, setting_value: value } : s));

      const numVal = Number(value);
      if (!isNaN(numVal) && numVal > 0) {
        if (window.api) {
          await window.api.db.update('app_settings', id, { setting_value: value });
        }
      }
      return;
    }

    if (window.api) {
      setAppSettings(prev => prev.map(s => s.id === id ? { ...s, setting_value: value } : s));
      await window.api.db.update('app_settings', id, { setting_value: value });

      if (key === 'theme') {
        document.documentElement.setAttribute('data-theme', value);
      }
      if (key === 'language') {
        i18n.changeLanguage(value);
        if (window.regionalSettings) window.regionalSettings.language = value;
      }
      if (key === 'custom_currency') {
        if (window.regionalSettings) window.regionalSettings.currency = value;
      }
      if (key === 'custom_date_format') {
        if (window.regionalSettings) window.regionalSettings.dateFormat = value;
      }
      if (key === 'custom_time_format') {
        if (window.regionalSettings) window.regionalSettings.timeFormat = value;
      }
    }
  };

  const handleSettingBlur = async (id, key, value) => {
    if (key === 'standard_daily_hours') {
      const numVal = Number(value);
      if (isNaN(numVal) || numVal <= 0) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.hours_zero_error', 'Çalışma saati 0 veya daha küçük olamaz.'), type: 'error' } }));

        if (window.api) {
          const settingsData = await window.api.db.read('app_settings');
          const dbSetting = settingsData.find(s => s.id === id);
          const fallbackValue = dbSetting && Number(dbSetting.setting_value) > 0 ? dbSetting.setting_value : "8";
          setAppSettings(prev => prev.map(s => s.id === id ? { ...s, setting_value: fallbackValue } : s));
        }
      }
    }
  };

  const handleLogoUpload = async (id, file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64Img = e.target.result;

      const img = new Image();
      img.src = base64Img;
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 200;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const resizedBase64 = canvas.toDataURL('image/png');
        setTempCompanyLogo(resizedBase64);
      };
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async (id) => {
    setTempCompanyLogo('');
  };

  const handleSaveCompanyInfo = async () => {
    if (window.api) {
      const nameSetting = appSettings.find(s => s.setting_key === 'company_name');
      const logoSetting = appSettings.find(s => s.setting_key === 'company_logo');

      if (nameSetting) {
        await window.api.db.update('app_settings', nameSetting.id, { setting_value: tempCompanyName });
      }
      if (logoSetting) {
        await window.api.db.update('app_settings', logoSetting.id, { setting_value: tempCompanyLogo });
      }

      setAppSettings(prev => prev.map(s => {
        if (s.setting_key === 'company_name') return { ...s, setting_value: tempCompanyName };
        if (s.setting_key === 'company_logo') return { ...s, setting_value: tempCompanyLogo };
        return s;
      }));

      window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
          message: t('settings.company_info_saved', 'Şirket bilgileri başarıyla kaydedildi.'),
          type: 'success'
        }
      }));
    }
  };

  const handleDesktopIconChange = async (theme) => {
    if (window.api && window.api.system.changeDesktopIcon) {
      const res = await window.api.system.changeDesktopIcon({ theme });
      if (res.success) {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.icon_change_success', 'Masaüstü kısayol ikonu başarıyla değiştirildi. (Değişikliğin yansıması birkaç saniye sürebilir)'), type: 'success' } }));
      } else {
        window.dispatchEvent(new CustomEvent('show-toast', { detail: { message: t('settings.icon_change_error', 'İkon değiştirme hatası: ') + res.message, type: 'error' } }));
      }
    }
  };

  if (loading) {
    return <div className="text-center"><div className="loading-spinner"></div></div>;
  }

  return (
    <div style={{ maxWidth: (activeTab === 'recycle' || activeTab === 'logs') ? '100%' : '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: 'calc(100vh - 100px)' }}>
      <header className="header" style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>
          {activeTab === 'genel' ? `⚙️ ${t('nav.settings_genel', 'Genel Ayarlar')}` :
           activeTab === 'finance' ? `💼 ${t('nav.settings_finance', 'Finans & Operasyon')}` :
           activeTab === 'security' ? `🛡️ ${t('nav.settings_security', 'Güvenlik ve Yedekleme')}` :
           activeTab === 'recycle' ? `🗑️ ${t('recycle.title', 'Geri Dönüşüm & Çöp Kutusu')}` :
           `📋 ${t('nav.settings_logs', 'Sistem Kayıtları')}`}
        </h2>
        {activeTab === 'finance' && (
          <span
            onClick={() => setIsGuideOpen(true)}
            style={{
              cursor: 'pointer',
              opacity: 'var(--guide-icon-opacity, 0.4)', filter: 'var(--guide-icon-filter, none)',
              transition: 'opacity 0.25s ease-in-out',
              fontSize: '1.6rem',
              userSelect: 'none',
              padding: '0.25rem'
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity-hover, 1)'}
            onMouseLeave={e => e.currentTarget.style.opacity = 'var(--guide-icon-opacity, 0.4)'}
            title={t('common.page_guide', 'Sayfa Kılavuzu')}
          >
            💡
          </span>
        )}
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto', paddingRight: '0.5rem' }}>

        {activeTab === 'genel' && (
          <SettingsGeneralTab
            t={t}
            appSettings={appSettings}
            tempCompanyName={tempCompanyName}
            setTempCompanyName={setTempCompanyName}
            tempCompanyLogo={tempCompanyLogo}
            handleSettingChange={handleSettingChange}
            handleSettingBlur={handleSettingBlur}
            handleDesktopIconChange={handleDesktopIconChange}
            handleLogoUpload={handleLogoUpload}
            handleRemoveLogo={handleRemoveLogo}
            handleSaveCompanyInfo={handleSaveCompanyInfo}
          />
        )}

        {activeTab === 'finance' && (
          <SettingsFinanceTab
            t={t}
            appSettings={appSettings}
            workTypes={workTypes}
            workerGroups={workerGroups}
            fetchData={fetchData}
            handleSettingChange={handleSettingChange}
            handleSettingBlur={handleSettingBlur}
            setModalConfig={setModalConfig}
          />
        )}

        {activeTab === 'security' && (
          <SettingsSecurityTab
            t={t}
            appSettings={appSettings}
            fetchData={fetchData}
            setModalConfig={setModalConfig}
          />
        )}

        {activeTab === 'logs' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <SystemLogs />
          </div>
        )}

        {activeTab === 'recycle' && (
          <SettingsRecycleTab
            setModalConfig={setModalConfig}
            setIsGuideOpen={setIsGuideOpen}
          />
        )}

      </div>

      <GuideDrawer
        isOpen={isGuideOpen && activeTab === 'recycle'}
        onClose={() => setIsGuideOpen(false)}
        title={t('guides.recycle.title', 'Geri Dönüşüm Kutusu Rehberi (5N1K)')}
        desc=""
        h1={t('guides.recycle.q1.title')}
        p1={t('guides.recycle.q1.desc')}
        h2={t('guides.recycle.q2.title')}
        p2={t('guides.recycle.q2.desc')}
        h3={t('guides.recycle.q3.title')}
        p3={t('guides.recycle.q3.desc')}
        h4={t('guides.recycle.q4.title')}
        p4={t('guides.recycle.q4.desc')}
        h5={t('guides.recycle.q5.title')}
        p5={t('guides.recycle.q5.desc')}
        h6={t('guides.recycle.q6.title')}
        p6={t('guides.recycle.q6.desc')}
      />

      <GuideDrawer
        isOpen={isGuideOpen && activeTab === 'finance'}
        onClose={() => setIsGuideOpen(false)}
        title={t('settings.finance_guide.title')}
        desc=""
        h1={t('settings.finance_guide.section1.title')}
        p1={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div><strong style={{ color: '#cbd5e1' }}>{t('settings.finance_guide.section1.p1_title')}</strong> {t('settings.finance_guide.section1.p1_desc')}</div>
            <div><strong style={{ color: '#cbd5e1' }}>{t('settings.finance_guide.section1.p2_title')}</strong> {t('settings.finance_guide.section1.p2_desc')}</div>
          </div>
        }
        h2={t('settings.finance_guide.section2.title')}
        p2={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div><strong style={{ color: '#cbd5e1' }}>{t('settings.finance_guide.section2.p1_title')}</strong> {t('settings.finance_guide.section2.p1_desc')}</div>
            <div><strong style={{ color: '#cbd5e1' }}>{t('settings.finance_guide.section2.p2_title')}</strong> {t('settings.finance_guide.section2.p2_desc')}</div>
          </div>
        }
        h3={t('settings.finance_guide.section3.title')}
        p3={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div><strong style={{ color: '#cbd5e1' }}>{t('settings.finance_guide.section3.p1_title')}</strong> {t('settings.finance_guide.section3.p1_desc')}</div>
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 'bold', color: 'var(--primary)' }}>{t('settings.finance_guide.section3.f_total')}</p>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <li>{t('settings.finance_guide.section3.f_base')}</li>
                <li>{t('settings.finance_guide.section3.f_hourly')}</li>
                <li>{t('settings.finance_guide.section3.f_overtime')}</li>
              </ul>
              <p style={{ margin: '0.75rem 0 0 0', fontSize: '0.8rem', fontStyle: 'italic', opacity: 0.8 }}>
                {t('settings.finance_guide.section3.example')}
              </p>
            </div>
          </div>
        }
        h4={t('settings.finance_guide.section4.title')}
        p4={
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <div><strong style={{ color: '#cbd5e1' }}>{t('settings.finance_guide.section4.p1_title')}</strong> {t('settings.finance_guide.section4.p1_desc')}</div>
            <div><strong style={{ color: '#cbd5e1' }}>{t('settings.finance_guide.section4.p2_title')}</strong> {t('settings.finance_guide.section4.p2_desc')}</div>
            <div><strong style={{ color: '#cbd5e1' }}>{t('settings.finance_guide.section4.p3_title')}</strong> {t('settings.finance_guide.section4.p3_desc')}</div>
            <div><strong style={{ color: '#cbd5e1' }}>{t('settings.finance_guide.section4.p4_title')}</strong> {t('settings.finance_guide.section4.p4_desc')}</div>
          </div>
        }
      />

      <ConfirmationModal
        isOpen={modalConfig.isOpen}
        onClose={() => setModalConfig({ ...modalConfig, isOpen: false })}
        onConfirm={() => {
          modalConfig.onConfirm();
          setModalConfig({ ...modalConfig, isOpen: false });
        }}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        confirmText={modalConfig.confirmText}
        cancelText={modalConfig.cancelText}
      />
    </div>
  );
};

export default Settings;
