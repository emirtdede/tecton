import React from 'react';
import CustomDatePicker from './ui/CustomDatePicker';
import { X } from 'lucide-react';

const QualityFilters = ({ t, hasReports, searchQuery, setSearchQuery, filterStartDate, onStartDateChange, filterEndDate, onEndDateChange, sortBy, setSortBy, filterPhoto, setFilterPhoto, filterStatus, setFilterStatus }) => {
  if (!hasReports) return null;

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
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
          <input
            type="text"
            className="form-input"
            placeholder={t('filters.search_reports', 'Tutanak başlıklarında, açıklamalarda veya tarihte ara...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingRight: '2.5rem', width: '100%', marginBottom: 0 }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                background: 'transparent',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '1rem',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10
              }}
              title={t('common.clear', 'Temizle')}
            >
              <X size={14} aria-hidden="true" />
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
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.photo_status', 'Görsel Durumu')}</label>
        <select
          className="form-input"
          value={filterPhoto}
          onChange={e => setFilterPhoto(e.target.value)}
          style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
        >
          <option value="">{t('filters.photo_all', 'Tümü')}</option>
          <option value="yes">{t('filters.with_photo', 'Fotoğraflı')}</option>
          <option value="no">{t('filters.without_photo', 'Fotoğrafsız')}</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.status', 'Durum')}</label>
        <select
          className="form-input"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
        >
          <option value="">{t('filters.status_all', 'Tümü')}</option>
          <option value="open">{t('quality.status_open', 'Açık')}</option>
          <option value="resolved">{t('filters.status_resolved', 'Çözüldü')}</option>
        </select>
      </div>
    </div>
  );
};

export default QualityFilters;
