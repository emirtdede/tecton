import React from 'react';

const BulkFilters = ({ t, searchQuery, setSearchQuery, selectedGroup, setSelectedGroup, workerGroups, filterStatus, setFilterStatus, allEligibleSelected, onSelectAll }) => {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid var(--glass-border)',
      borderRadius: '12px',
      padding: '0.75rem 1rem',
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
            placeholder={t('bulk_timesheet.search_placeholder_new', 'İsim, TC, telefon, grup veya yevmiye ara...')}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ width: '100%', paddingRight: '2.5rem', marginBottom: 0 }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '12px', background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '4px' }}
            >✕</button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 150px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('bulk_timesheet.group_label', 'Grup')}</label>
        <select
          className="form-input"
          value={selectedGroup}
          onChange={e => setSelectedGroup(e.target.value)}
          style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
        >
          <option value="">{t('bulk_timesheet.group_filter_all', 'Tüm Gruplar')}</option>
          {workerGroups.map(g => (
            <option key={g.id} value={g.id}>{g.name}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: '1 1 150px' }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t('bulk_timesheet.status_label', 'Puantaj Durumu')}</label>
        <select
          className="form-input"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{ width: '100%', marginBottom: 0, padding: '6px 12px', flexShrink: 0 }}
        >
          <option value="">{t('bulk_timesheet.status_all', 'Tümü')}</option>
          <option value="entered">{t('bulk_timesheet.status_entered', 'Puantajı Girilenler')}</option>
          <option value="not_entered">{t('bulk_timesheet.status_not_entered', 'Puantajı Girilmeyenler')}</option>
        </select>
      </div>

      <button
        type="button"
        className="btn"
        onClick={onSelectAll}
        style={{ whiteSpace: 'nowrap', padding: '0.5rem 1rem', minWidth: '120px', height: '38px' }}
      >
        {allEligibleSelected
          ? t('bulk_timesheet.deselect_all', 'Seçimi Kaldır')
          : t('bulk_timesheet.select_all', 'Tümünü Seç')}
      </button>
    </div>
  );
};

export default BulkFilters;
