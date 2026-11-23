import React from 'react';
import { formatCurrency } from '../utils/formatUtils';

const BulkWorkerGrid = ({ t, i18n, loading, filteredWorkers, selectedIds, existingTimesheets, workerGroups, searchQuery, onToggle }) => {
  return (
    <div className="glass-card" style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h3 className="card-title" style={{ fontSize: '1.1rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
         {t('bulk_timesheet.select_workers', 'Personel Seçin')} ({t('bulk_timesheet.selected_count', '{{count}} personel seçildi').replace('{{count}}', selectedIds.size)})
      </h3>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '0.75rem', marginTop: '0.25rem', paddingBottom: '2.5rem' }}>
        {loading ? (
          <div className="skeleton" style={{ height: '150px', width: '100%', gridColumn: '1 / -1' }}></div>
        ) : filteredWorkers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)', gridColumn: '1 / -1' }}>
            {searchQuery ? t('common.no_results', 'Sonuç bulunamadı.') : t('bulk_timesheet.no_workers', 'Aktif personel bulunamadı.')}
          </div>
        ) : (
          filteredWorkers.map(w => {
            const isSelected = selectedIds.has(w.id);
            const hasTimesheet = existingTimesheets.some(ts => ts.worker_id === w.id);
            const groupObj = workerGroups.find(g => g.id === w.group_id);
            const groupName = groupObj ? groupObj.name : '';
            return (
              <div
                key={w.id}
                onClick={() => onToggle(w.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  cursor: hasTimesheet ? 'not-allowed' : 'pointer',
                  border: `1px solid ${isSelected ? 'var(--primary)' : 'var(--glass-border)'}`,
                  background: hasTimesheet
                    ? 'rgba(16, 185, 129, 0.03)'
                    : (isSelected ? 'rgba(139, 92, 246, 0.08)' : 'rgba(255,255,255,0.02)'),
                  opacity: hasTimesheet ? 0.75 : 1,
                  transition: 'all 0.15s ease',
                  userSelect: 'none'
                }}
              >
                <div style={{
                  width: '20px', height: '20px', borderRadius: '4px', flexShrink: 0,
                  border: `2px solid ${hasTimesheet ? '#10b981' : (isSelected ? 'var(--primary)' : 'var(--text-muted)')}`,
                  background: hasTimesheet ? '#10b981' : (isSelected ? 'var(--primary)' : 'transparent'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'all 0.15s ease'
                }}>
                  {(isSelected || hasTimesheet) && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 'bold' }}></span>}
                </div>
                <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '0.9rem', color: hasTimesheet ? 'var(--text-muted)' : 'var(--text-main)' }}>{w.full_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {formatCurrency(w.daily_wage, i18n.language)} / {t('bulk_timesheet.day', 'gün')}
                      {groupName && ` • ${groupName}`}
                    </div>
                  </div>
                  {hasTimesheet && (
                    <span style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      padding: '0.2rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.75rem',
                      fontWeight: '600'
                    }}>
                      {t('bulk_timesheet.already_entered', ' Girildi')}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default BulkWorkerGrid;
