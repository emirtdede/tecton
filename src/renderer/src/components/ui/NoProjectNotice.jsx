import { useTranslation } from 'react-i18next';
import { ArrowRight, MapPin } from 'lucide-react';

/**
 * Shown by every page that needs an active site (payroll, materials, cash...).
 *
 * The pages cannot navigate on their own, so the button raises the same
 * `tecton:navigate` event the shell listens to. Without it a user landing on an
 * empty page had to find the site list in the sidebar themselves.
 */
export default function NoProjectNotice({ titleKey, titleFallback, onGoToSites }) {
  const { t } = useTranslation();

  const goToSites = () => {
    if (onGoToSites) {
      onGoToSites();
      return;
    }
    document.dispatchEvent(new CustomEvent('tecton:navigate', { detail: { view: 'projects' } }));
  };

  return (
    <div className="glass-card no-project-card">
      <span className="no-project-icon"><MapPin size={22} /></span>
      <h2 className="card-title">{t(titleKey, titleFallback)}</h2>
      <p className="no-project-text">
        {t('common.select_project_msg', 'Select an active site to use this page.')}
      </p>
      <button type="button" className="btn btn-primary" onClick={goToSites}>
        {t('common.go_to_sites', 'Choose a site')} <ArrowRight size={15} />
      </button>
    </div>
  );
}
