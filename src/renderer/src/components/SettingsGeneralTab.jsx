import React from 'react';
import { Save, X } from 'lucide-react';
import TectonDark from '../assets/tecton_dark.svg';
import TectonLight from '../assets/tecton_light.svg';

const SettingsGeneralTab = ({ t, appSettings, tempCompanyName, setTempCompanyName, tempCompanyLogo, handleSettingChange, handleSettingBlur, handleDesktopIconChange, handleLogoUpload, handleRemoveLogo, handleSaveCompanyInfo }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Tema ve Dil Seçimi */}
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>{t('settings.theme_language', 'Görünüm ve Dil')}</h3>

        {appSettings.map(setting => {
          if (setting.setting_key === 'theme') {
            return (
              <div key={setting.id} className="form-group">
                <label className="form-label">{t('settings.theme', 'Tema')}</label>
                <select
                  className="form-input"
                  value={setting.setting_value}
                  onChange={(e) => handleSettingChange(setting.id, setting.setting_key, e.target.value)}
                >
                  <option value="dark">{t('settings.theme_dark', 'Karanlık')}</option>
                  <option value="light">{t('settings.theme_light', 'Aydınlık')}</option>
                </select>
              </div>
            );
          }
          if (setting.setting_key === 'language') {
            return (
              <div key={setting.id} className="form-group">
                <label className="form-label">{t('settings.language', 'Dil')}</label>
                <select
                  className="form-input"
                  value={setting.setting_value}
                  onChange={(e) => handleSettingChange(setting.id, setting.setting_key, e.target.value)}
                >
                  <option value="tr">Türkçe (TR)</option>
                  <option value="en">English (EN)</option>
                  <option value="de">Deutsch (DE)</option>
                  <option value="sv">Svenska (SV)</option>
                  <option value="no">Norsk (NO)</option>
                  <option value="da">Dansk (DA)</option>
                  <option value="fr">Français (FR)</option>
                  <option value="pl">Polski (PL)</option>
                  <option value="it">Italiano (IT)</option>
                  <option value="nl">Nederlands (NL)</option>
                  <option value="cs">Čeština (CS)</option>
                  <option value="es">Español (ES)</option>
                  <option value="pt">Português (PT)</option>
                  <option value="ru">Русский (RU)</option>
                  <option value="zh">中文 (Mandarin)</option>
                  <option value="ja">日本語 (JA)</option>
                  <option value="ko">한국어 (KO)</option>
                  <option value="ar">العربية (AR)</option>
                  <option value="hi">हिन्दी (HI)</option>
                </select>
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* Masaüstü Kısayol İkonu (Desktop Icon) */}
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>{t('settings.desktop_icon', 'Masaüstü Kısayol İkonu')}</h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          {t('settings.desktop_icon_desc', 'Masaüstündeki uygulamanın kısayol ikonunu açık veya koyu tema ile uyumlu hale getirin.')}
        </p>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            className="btn"
            onClick={() => handleDesktopIconChange('dark')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}
          >
            <img src={TectonDark} alt="Dark Icon" style={{ width: '48px', height: '48px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.3))' }} />
            <span style={{ fontWeight: '500' }}>{t('settings.icon_dark', 'Koyu İkon')}</span>
          </button>
          <button
            className="btn"
            onClick={() => handleDesktopIconChange('light')}
            style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '1.5rem', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)' }}
          >
            <img src={TectonLight} alt="Light Icon" style={{ width: '48px', height: '48px', filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.1))' }} />
            <span style={{ fontWeight: '500' }}>{t('settings.icon_light', 'Açık İkon')}</span>
          </button>
        </div>
      </div>

      {/* Bölgesel Format Ayarları */}
      <div className="glass-card">
        <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>{t('settings.regionalFormatSettings', 'Bölgesel Format Ayarları')}</h3>

        {appSettings.some(s => s.setting_key === 'custom_currency') ? (
          <>
            {/* Para Birimi */}
            {appSettings.map(setting => {
              if (setting.setting_key === 'custom_currency') {
                return (
                  <div key={setting.id} className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">{t('settings.currencySelection', 'Para Birimi Seçimi')}</label>
                    <select
                      className="form-input"
                      value={setting.setting_value}
                      onChange={(e) => handleSettingChange(setting.id, setting.setting_key, e.target.value)}
                    >
                      <option value="auto">{t('settings.autoByLanguage', 'Otomatik (Dile Göre)')}</option>
                      <option value="TRY">TRY (₺)</option>
                      <option value="USD">USD ($)</option>
                      <option value="EUR">EUR (€)</option>
                      <option value="GBP">GBP (£)</option>
                      <option value="CNY">CNY (¥)</option>
                      <option value="JPY">JPY (¥)</option>
                      <option value="KRW">KRW (₩)</option>
                      <option value="RUB">RUB (₽)</option>
                      <option value="SAR">SAR (SR)</option>
                      <option value="AED">AED (د.إ)</option>
                      <option value="EGP">EGP (ج.م)</option>
                      <option value="INR">INR (₹)</option>
                      <option value="BRL">BRL (R$)</option>
                      <option value="SEK">SEK (kr)</option>
                      <option value="NOK">NOK (kr)</option>
                      <option value="DKK">DKK (kr)</option>
                      <option value="PLN">PLN (zł)</option>
                      <option value="CZK">CZK (Kč)</option>
                    </select>
                  </div>
                );
              }
              return null;
            })}

            {/* Tarih Formatı */}
            {appSettings.map(setting => {
              if (setting.setting_key === 'custom_date_format') {
                return (
                  <div key={setting.id} className="form-group" style={{ marginBottom: '1rem' }}>
                    <label className="form-label">{t('settings.dateFormatSelection', 'Tarih Formatı Seçimi')}</label>
                    <select
                      className="form-input"
                      value={setting.setting_value}
                      onChange={(e) => handleSettingChange(setting.id, setting.setting_key, e.target.value)}
                    >
                      <option value="auto">{t('settings.autoByLanguage', 'Otomatik (Dile Göre)')}</option>
                      <option value="DD.MM.YYYY">DD.MM.YYYY (01.01.2000)</option>
                      <option value="YYYY-MM-DD">YYYY-MM-DD (2000-01-01)</option>
                      <option value="MM/DD/YYYY">MM/DD/YYYY (01/01/2000)</option>
                      <option value="DD/MM/YYYY">DD/MM/YYYY (01/01/2000)</option>
                      <option value="DD-MM-YYYY">DD-MM-YYYY (01-01-2000)</option>
                      <option value="YYYY/MM/DD">YYYY/MM/DD (2000/01/01)</option>
                      <option value="YYYY.MM.DD">YYYY.MM.DD (2000.01.01)</option>
                    </select>
                  </div>
                );
              }
              return null;
            })}

            {/* Saat Formatı */}
            {appSettings.map(setting => {
              if (setting.setting_key === 'custom_time_format') {
                return (
                  <div key={setting.id} className="form-group">
                    <label className="form-label">{t('settings.timeFormatSelection', 'Saat Formatı Seçimi')}</label>
                    <select
                      className="form-input"
                      value={setting.setting_value}
                      onChange={(e) => handleSettingChange(setting.id, setting.setting_key, e.target.value)}
                    >
                      <option value="auto">{t('settings.autoByLanguage', 'Otomatik (Dile Göre)')}</option>
                      <option value="24h">{t('settings.time24h', '24 Saat (18:30)')}</option>
                      <option value="12h">{t('settings.time12h', '12 Saat AM/PM (06:30 PM)')}</option>
                    </select>
                  </div>
                );
              }
              return null;
            })}
          </>
        ) : (
          <div className="skeleton" style={{ height: '150px', borderRadius: '12px' }}></div>
        )}
      </div>

      {/* Şirket Kimliği ve PDF Anteti */}
      <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 className="card-title" style={{ margin: 0 }}>{t('settings.company_info', 'Şirket Kimliği & PDF Anteti')}</h3>

        {appSettings.map(setting => {
          if (setting.setting_key === 'company_name') {
            return (
              <div key={setting.id} className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('settings.company_name', 'Şirket / Kurum Adı')}</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder={t('settings.company_name_placeholder', 'Örn: ABC İnşaat A.Ş.')}
                  value={tempCompanyName}
                  onChange={(e) => setTempCompanyName(e.target.value)}
                />
              </div>
            );
          }
          if (setting.setting_key === 'company_logo') {
            return (
              <div key={setting.id} className="form-group" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', margin: 0 }}>
                <label className="form-label">{t('settings.company_logo', 'Şirket Logosu')}</label>
                {tempCompanyLogo && (
                  <div style={{ position: 'relative', display: 'inline-block', alignSelf: 'flex-start' }}>
                    <img
                      src={tempCompanyLogo}
                      alt="Company Logo"
                      style={{ maxWidth: '150px', maxHeight: '100px', objectFit: 'contain', background: 'rgba(255,255,255,0.05)', padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--glass-border)' }}
                    />
                    <button
                      type="button"
                      className="btn btn-danger"
                      style={{ position: 'absolute', top: '-10px', right: '-10px', width: '24px', height: '24px', padding: 0, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => handleRemoveLogo(setting.id)}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <label
                    htmlFor={`logo-upload-input-${setting.id}`}
                    className="btn"
                    style={{ cursor: 'pointer', margin: 0 }}
                  >
                     {t('settings.file_select_button')}
                  </label>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    {tempCompanyLogo ? t('settings.logo_uploaded', 'Logo yüklendi') : t('settings.file_not_selected')}
                  </span>
                  <input
                    id={`logo-upload-input-${setting.id}`}
                    type="file"
                    accept="image/png, image/jpeg"
                    style={{ display: 'none' }}
                    onChange={(e) => handleLogoUpload(setting.id, e.target.files[0])}
                  />
                </div>
              </div>
            );
          }
          return null;
        })}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleSaveCompanyInfo}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.625rem 1.25rem' }}
          >
            <Save size={16} /> {t('settings.company_info_save_btn', 'Kaydet')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsGeneralTab;
