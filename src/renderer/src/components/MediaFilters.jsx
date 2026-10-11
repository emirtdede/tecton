import React from 'react';
import CustomDatePicker from './ui/CustomDatePicker';

const MediaFilters = ({ t, searchQuery, setSearchQuery, filterStartDate, onStartDateChange, filterEndDate, onEndDateChange, sortBy, setSortBy, filterType, setFilterType, filterPhoto, setFilterPhoto, viewMode, setViewMode }) => {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--glass-border)',
      borderRadius: '12px',
      padding: '0.75rem 1rem',
      marginBottom: '0.25rem',
      display: 'flex',
      gap: '1rem',
      alignItems: 'flex-end',
      flexWrap: 'wrap'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '2 1 200px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.search', 'Arama')}</label>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder={t('media.search_placeholder', 'Başlık, içerik türü veya tarihe göre ara...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingRight: '2.5rem', width: '100%', marginBottom: 0 }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '10px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1.1rem',
                padding: '4px'
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.start_date', 'Başlangıç Tarihi')}</label>
        <CustomDatePicker
          value={filterStartDate}
          onChange={e => onStartDateChange(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.end_date', 'Bitiş Tarihi')}</label>
        <CustomDatePicker
          value={filterEndDate}
          onChange={e => onEndDateChange(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 130px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.sort', 'Sıralama')}</label>
        <select
          className="form-input"
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
        >
          <option value="date_desc">{t('filters.newest', 'Yeniden Eskiye')}</option>
          <option value="date_asc">{t('filters.oldest', 'Eskiden Yeniye')}</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.type', 'Türü')}</label>
        <select
          className="form-input"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
        >
          <option value="">{t('filters.all_types', 'Tüm Türler')}</option>
          <option value="material">{t('filters.delivery_note', 'İrsaliye / Fiş')}</option>
          <option value="report">{t('filters.quality_report', 'Kalite Tutanak')}</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.photo_status', 'Görsel Durumu')}</label>
        <select
          className="form-input"
          value={filterPhoto}
          onChange={e => setFilterPhoto(e.target.value)}
          style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
        >
          <option value="">{t('common.all', 'Tümü')}</option>
          <option value="yes">{t('filters.with_photo', 'Fotoğraflı')}</option>
          <option value="no">{t('filters.without_photo', 'Fotoğrafsız')}</option>
        </select>
      </div>

      {/* View Mode Toggle Switcher */}
      <div style={{
        display: 'flex',
        gap: '0.25rem',
        background: 'rgba(255, 255, 255, 0.05)',
        padding: '4px',
        borderRadius: '10px',
        border: '1px solid var(--glass-border)',
        flexShrink: 0,
        marginLeft: 'auto'
      }}>
        <button
          type="button"
          onClick={() => setViewMode('list')}
          title={t('media.view_list', 'Liste Görünümü')}
          style={{
            background: viewMode === 'list' ? 'var(--primary)' : 'transparent',
            border: 'none',
            color: viewMode === 'list' ? '#fff' : 'var(--text-muted)',
            padding: '7px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="21" y2="18" />
            <line x1="3" y1="6" x2="3.01" y2="6" />
            <line x1="3" y1="12" x2="3.01" y2="12" />
            <line x1="3" y1="18" x2="3.01" y2="18" />
          </svg>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('gallery')}
          title={t('media.view_grid', 'Galeri Görünümü')}
          style={{
            background: viewMode === 'gallery' ? 'var(--primary)' : 'transparent',
            border: 'none',
            color: viewMode === 'gallery' ? '#fff' : 'var(--text-muted)',
            padding: '7px 10px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s ease-in-out'
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MediaFilters;
