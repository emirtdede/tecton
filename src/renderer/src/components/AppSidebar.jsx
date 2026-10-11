import React from 'react';
import TectonDark from '../assets/tecton_dark.svg';
import TectonLight from '../assets/tecton_light.svg';

const AppSidebar = ({ t, view, setView, setSelectedWorkerProfile, sidebarState, isResizing, onSidebarStateChange, onMouseDown, activeProjectObj, isSettingsOpen, setIsSettingsOpen }) => {
  return (
    <>
      {sidebarState === 'hidden' && (
        <button
          type="button"
          onClick={() => onSidebarStateChange('full')}
          className="sidebar-restore-btn"
          title={t('nav.expand', 'Genişlet')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 8 12 12 7 16"></polyline><polyline points="13 8 18 12 13 16"></polyline></svg>
        </button>
      )}

      {/* Left fixed Sidebar Navigation */}
      <aside className="sidebar">
        {sidebarState === 'full' && (
          <div
            className={`sidebar-resizer ${isResizing ? 'is-resizing' : ''}`}
            onMouseDown={onMouseDown}
          />
        )}
        <div className="sidebar-logo">
          {sidebarState === 'collapsed' ? (
            <button
              type="button"
              className="sidebar-collapsed-logo-btn"
              onClick={() => onSidebarStateChange('full')}
              title={t('nav.expand', 'Genişlet')}
            >
              <img src={TectonDark} alt="Tecton" className="logo-dark" style={{ width: '24px', height: '24px' }} />
              <img src={TectonLight} alt="Tecton" className="logo-light" style={{ width: '24px', height: '24px' }} />
              <span className="hover-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </span>
            </button>
          ) : (
            <>
              <div className="sidebar-logo-brand" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <img src={TectonDark} alt="Tecton" className="logo-dark" style={{ height: '24px' }} />
                <img src={TectonLight} alt="Tecton" className="logo-light" style={{ height: '24px' }} />
                <span className="sidebar-text" style={{ fontSize: '1.2rem', fontWeight: 'bold', fontFamily: 'Inter, sans-serif' }}>{t('app.name', 'Tecton')}</span>
              </div>
              <div className="sidebar-controls">
                <button
                  type="button"
                  onClick={() => onSidebarStateChange('collapsed')}
                  className="sidebar-control-btn"
                  title={t('nav.collapse', 'Daralt')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <button
                  type="button"
                  onClick={() => onSidebarStateChange('hidden')}
                  className="sidebar-control-btn"
                  title={t('nav.hide', 'Gizle')}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Active project badge */}
        {activeProjectObj ? (
          <div className="sidebar-active-project" style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
            borderRadius: '8px',
            padding: '0.65rem 0.85rem',
            margin: '0 1rem 1.5rem 1rem',
            fontSize: '0.8rem'
          }}>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.05em' }}>{t('nav.active_project', 'Aktif Şantiye')}</div>
            <strong style={{ color: '#fff', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '0.15rem' }}>{activeProjectObj.name}</strong>
          </div>
        ) : (
          <div className="sidebar-active-project" style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: '0 1rem 1.5rem 1rem', fontWeight: 'bold' }}>⚠️ {t('nav.no_project_selected', 'Şantiye Seçilmedi!')}</div>
        )}

        <nav className="sidebar-nav">
          <div className={`sidebar-link ${view === 'projects' ? 'active' : ''}`} onClick={() => setView('projects')}>
            <span className="sidebar-icon">🏗️</span>
            <span className="sidebar-text">{t('nav.projects', 'Şantiyeler (Lokasyon)')}</span>
          </div>
          <div className={`sidebar-link ${view === 'list' || view === 'profile' ? 'active' : ''}`} onClick={() => { setView('list'); setSelectedWorkerProfile(null); }}>
            <span className="sidebar-icon">👥</span>
            <span className="sidebar-text">{t('nav.personnel')}</span>
          </div>
          <div className={`sidebar-link ${view === 'subcontractor' || view === 'subcontractor_profile' ? 'active' : ''}`} onClick={() => setView('subcontractor')}>
            <span className="sidebar-icon">🚜</span>
            <span className="sidebar-text">{t('nav.subcontractors', 'Taşeron Carileri')}</span>
          </div>
          <div className={`sidebar-link ${view === 'bulk_timesheet' ? 'active' : ''}`} onClick={() => setView('bulk_timesheet')}>
            <span className="sidebar-icon">📋</span>
            <span className="sidebar-text">{t('bulk_timesheet.nav_title', 'Çoklu Puantaj')}</span>
          </div>
          <div className={`sidebar-link ${view === 'production' ? 'active' : ''}`} onClick={() => setView('production')}>
            <span className="sidebar-icon">📐</span>
            <span className="sidebar-text">{t('nav.production', 'İmalat ve Metraj')}</span>
          </div>
          <div className={`sidebar-link ${view === 'materials' ? 'active' : ''}`} onClick={() => setView('materials')}>
            <span className="sidebar-icon">📄</span>
            <span className="sidebar-text">{t('nav.materials', 'İrsaliye & Malzeme')}</span>
          </div>
          <div className={`sidebar-link ${view === 'journal' ? 'active' : ''}`} onClick={() => setView('journal')}>
            <span className="sidebar-icon">📓</span>
            <span className="sidebar-text">{t('nav.journal', 'Günlük Jurnal')}</span>
          </div>
          <div className={`sidebar-link ${view === 'quality' ? 'active' : ''}`} onClick={() => setView('quality')}>
            <span className="sidebar-icon">🛡️</span>
            <span className="sidebar-text">{t('nav.quality', 'Kalite Kontrol')}</span>
          </div>
          <div className={`sidebar-link ${view === 'media' ? 'active' : ''}`} onClick={() => setView('media')}>
            <span className="sidebar-icon">📷</span>
            <span className="sidebar-text">{t('nav.media', 'Medya Galerisi')}</span>
          </div>
          <div className={`sidebar-link ${view === 'kasa' ? 'active' : ''}`} onClick={() => setView('kasa')}>
            <span className="sidebar-icon">💵</span>
            <span className="sidebar-text">{t('nav.cash')}</span>
          </div>
          <div className={`sidebar-link ${view === 'hakkinda' ? 'active' : ''}`} onClick={() => setView('hakkinda')}>
            <span className="sidebar-icon">❓</span>
            <span className="sidebar-text">{t('nav.help', 'Hakkında & Yardım')}</span>
          </div>
          <div>
            <div
              className={`sidebar-link ${view.startsWith('settings_') ? 'active' : ''}`}
              onClick={() => setIsSettingsOpen(prev => !prev)}
            >
              <span className="sidebar-icon">⚙️</span>
              <span className="sidebar-text" style={{ flex: 1 }}>{t('nav.settings')}</span>
              <span className="sidebar-text" style={{
                transform: isSettingsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                fontSize: '0.7rem',
                opacity: 0.7
              }}>▼</span>
            </div>

            <div className="sidebar-submenu" style={{
              maxHeight: isSettingsOpen ? '250px' : '0px',
              overflow: 'hidden',
              transition: 'max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              paddingLeft: sidebarState === 'collapsed' ? '0' : '1rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.2rem',
              marginTop: isSettingsOpen ? '0.25rem' : '0'
            }}>
              <div
                className={`sidebar-link ${view === 'settings_genel' ? 'active' : ''}`}
                onClick={() => setView('settings_genel')}
                style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
              >
                <span className="sidebar-icon">⚙️</span>
                <span className="sidebar-text">{t('nav.settings_genel', 'Genel Ayarlar')}</span>
              </div>
              <div
                className={`sidebar-link ${view === 'settings_finance' ? 'active' : ''}`}
                onClick={() => setView('settings_finance')}
                style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
              >
                <span className="sidebar-icon">💼</span>
                <span className="sidebar-text">{t('nav.settings_finance', 'Finans & Operasyon')}</span>
              </div>
              <div
                className={`sidebar-link ${view === 'settings_security' ? 'active' : ''}`}
                onClick={() => setView('settings_security')}
                style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
              >
                <span className="sidebar-icon">🛡️</span>
                <span className="sidebar-text">{t('nav.settings_security', 'Güvenlik & Yedek')}</span>
              </div>
              <div
                className={`sidebar-link ${view === 'settings_logs' ? 'active' : ''}`}
                onClick={() => setView('settings_logs')}
                style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
              >
                <span className="sidebar-icon">📋</span>
                <span className="sidebar-text">{t('nav.settings_logs', 'Sistem Kayıtları')}</span>
              </div>
              <div
                className={`sidebar-link ${view === 'settings_recycle' ? 'active' : ''}`}
                onClick={() => setView('settings_recycle')}
                style={{ fontSize: '0.825rem', padding: '0.5rem 0.75rem' }}
              >
                <span className="sidebar-icon">🗑️</span>
                <span className="sidebar-text">{t('sidebar_recycle_btn', 'Çöp Kutusu')}</span>
              </div>
            </div>
          </div>
        </nav>

        <div className="sidebar-footer" style={{ textAlign: 'center' }}>
          <div>{t('sidebar_spotlight', 'Spotlight: Ctrl + K')}</div>
        </div>
      </aside>
    </>
  );
};

export default AppSidebar;
