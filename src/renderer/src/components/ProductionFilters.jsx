import React from 'react';
import CustomDatePicker from './ui/CustomDatePicker';

const ProductionFilters = ({ t, hasRecords, searchQuery, setSearchQuery, filterStartDate, onStartDateChange, filterEndDate, onEndDateChange, filterUnit, setFilterUnit }) => {
  if (!hasRecords) return null;

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
            placeholder={t('filters.search_production', 'İmalat, tarih, miktar veya notlarda ara...')}
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
              ✕
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.start_date', 'Başlangıç Tarihi')}</label>
        <CustomDatePicker
          className="form-input"
          value={filterStartDate}
          onChange={e => onStartDateChange(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('common.end_date', 'Bitiş Tarihi')}</label>
        <CustomDatePicker
          className="form-input"
          value={filterEndDate}
          onChange={e => onEndDateChange(e.target.value)}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 120px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('filters.unit', 'Birim')}</label>
        <select
          className="form-input"
          value={filterUnit}
          onChange={e => setFilterUnit(e.target.value)}
          style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
        >
          <option value="">{t('filters.all_units', 'Tümü')}</option>
          <option value="m²">m²</option>
          <option value="m³">m³</option>
          <option value="mt">mt</option>
          <option value="Adet">Adet</option>
          <option value="Kg">Kg</option>
          <option value="Ton">Ton</option>
        </select>
      </div>
    </div>
  );
};

export default ProductionFilters;
