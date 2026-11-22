import { useTranslation } from 'react-i18next';

/**
 * Shared pagination control.
 *
 * Nine lists (cash register, journal, logs, materials, production,
 * subcontractors, projects, quality, subcontractor profile) each carried its
 * own copy of this markup. The copies had drifted: some used
 * `common.page_info` with a separate record count, others used
 * `common.pagination_info`; paddings, fonts and alignment differed for no
 * reason. Consolidating keeps behaviour and translations identical.
 *
 * Renders nothing when there is only one page.
 *
 * @param {object}  props
 * @param {number}  props.currentPage   1-based current page
 * @param {number}  props.totalPages    total page count
 * @param {Function} props.onPageChange called with the target page number
 * @param {number} [props.totalRecords] when provided, the label also shows the record count
 * @param {'inline'|'sticky'|'bordered'} [props.variant] visual placement
 * @param {'between'|'center'} [props.align] how the legend and buttons sit
 */
export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  totalRecords = null,
  variant = 'inline',
  align = 'between'
}) {
  const { t } = useTranslation();

  // A single page needs no controls.
  if (!totalPages || totalPages <= 1) return null;

  const label =
    totalRecords !== null
      ? t('common.pagination_info', 'Sayfa {{page}} / {{total}} ({{records}} Kayıt)', {
          page: currentPage,
          total: totalPages,
          records: totalRecords
        })
      : `${t('common.page_info', 'Sayfa')} ${currentPage} / ${totalPages}`;

  const isFirst = currentPage === 1;
  const isLast = currentPage === totalPages;

  const containerStyle =
    variant === 'sticky'
      ? {
          position: 'sticky',
          bottom: 0,
          background: 'var(--option-bg, #0f172a)',
          borderTop: '1px solid var(--glass-border)',
          zIndex: 10,
          padding: '0.85rem 1.25rem',
          marginTop: 0,
          display: 'flex',
          justifyContent: align === 'center' ? 'center' : 'space-between',
          alignItems: 'center',
          gap: '1rem',
          backdropFilter: 'blur(10px)',
          borderRadius: '0 0 12px 12px'
        }
      : variant === 'bordered'
        ? {
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '1.5rem',
            marginTop: '0.5rem',
            paddingTop: '0.5rem',
            borderTop: '1px solid var(--glass-border)'
          }
        : {
            display: 'flex',
            justifyContent: align === 'center' ? 'center' : 'space-between',
            alignItems: 'center',
            gap: '1rem',
            marginTop: '1rem',
            paddingTop: '1rem',
            borderTop: '1px solid var(--glass-border)'
          };

  return (
    <div style={containerStyle}>
      {align !== 'center' && (
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '500' }}>{label}</span>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          type="button"
          className="btn"
          disabled={isFirst}
          onClick={() => onPageChange(Math.max(currentPage - 1, 1))}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
        >
          {t('common.prev', 'Önceki')}
        </button>

        {align === 'center' && (
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{label}</span>
        )}

        <button
          type="button"
          className="btn"
          disabled={isLast}
          onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))}
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.85rem' }}
        >
          {t('common.next', 'Sonraki')}
        </button>
      </div>
    </div>
  );
}
