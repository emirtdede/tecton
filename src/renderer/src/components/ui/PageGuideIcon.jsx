import { useTranslation } from 'react-i18next';
import { Lightbulb } from 'lucide-react';

/**
 * The "page guide" lightbulb shown next to page titles.
 *
 * This markup was copy-pasted into 12 components (15 occurrences); the copies
 * had already drifted in font size and one had extra layout properties. A
 * single component keeps the hover behaviour, accessibility title and styling
 * in one place.
 */
const PageGuideIcon = ({ onClick, fontSize = '1.15rem', title }) => {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        opacity: 'var(--guide-icon-opacity, 0.4)',
        filter: 'var(--guide-icon-filter, none)',
        transition: 'opacity 0.25s ease-in-out',
        fontSize,
        padding: '0.25rem',
        display: 'inline-flex',
        alignItems: 'center',
        background: 'none',
        border: 'none',
        color: 'inherit',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = 'var(--guide-icon-opacity-hover, 1)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.opacity = 'var(--guide-icon-opacity, 0.4)'; }}
      title={title || t('common.page_guide', 'Page guide')}
      aria-label={title || t('common.page_guide', 'Page guide')}
    >
      <Lightbulb size="1em" aria-hidden="true" />
    </button>
  );
};

export default PageGuideIcon;
