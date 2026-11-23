import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Github,
  Heart,
  Info,
  Scale,
  Tag,
} from 'lucide-react';
import UpdateCard from './settings/UpdateCard';
import TectonDark from '../../../../tecton_assets/tecton-tray-dark.svg';
import TectonLight from '../../../../tecton_assets/tecton-tray-light.svg';

const APP_VERSION = '1.0.0';

const SOCIAL_LINKS = {
  code: [
    { name: 'GitHub', url: 'https://github.com/emirtdede' },
    { name: 'LeetCode', url: 'https://leetcode.com/emirtdede/' },
    { name: 'HackerRank', url: 'https://www.hackerrank.com/emirtdede' },
    { name: 'Stack Overflow', url: 'https://stackoverflow.com/users/17289462/emir-dede' },
    { name: 'Kaggle', url: 'https://www.kaggle.com/emirdede' },
    { name: 'ORCID', url: 'https://orcid.org/0009-0006-1356-0316' },
  ],
  prof: [
    { name: 'LinkedIn', url: 'https://www.linkedin.com/in/emirtdede/' },
    { name: 'Google Developers', url: 'https://developers.google.com/profile/u/emirtdede' },
  ],
  social: [
    { name: 'YouTube', url: 'https://www.youtube.com/@emirtdede' },
    { name: 'Medium', url: 'https://emirtdede.medium.com/' },
    { name: 'X', url: 'https://twitter.com/emirtdede' },
    { name: 'Instagram', url: 'https://www.instagram.com/emirtdede/' },
    { name: 'Reddit', url: 'https://www.reddit.com/user/emirtdede/' },
  ],
};

const AboutHelp = () => {
  const { t } = useTranslation();
  const [openFaq, setOpenFaq] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const faqs = useMemo(
    () =>
      [1, 2, 3, 4, 5, 6].map((index) => ({
        q: t(`about.faq_q${index}`),
        a: t(`about.faq_a${index}`),
      })),
    [t]
  );

  const filteredFaqs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return faqs;
    return faqs.filter(
      (faq) => faq.q.toLowerCase().includes(query) || faq.a.toLowerCase().includes(query)
    );
  }, [faqs, searchQuery]);

  const facts = [
    { label: t('about.fact_version', 'Version'), value: APP_VERSION },
    { label: t('about.fact_license', 'Licence'), value: 'MIT' },
    { label: t('about.fact_publisher', 'Publisher'), value: 'Emir Tarık Dede' },
    { label: t('about.fact_stack', 'Built with'), value: 'Electron 29 / React 18 / Vite 5' },
    { label: t('about.fact_languages', 'Interface languages'), value: '19' },
    { label: t('about.fact_data', 'Data location'), value: '%APPDATA%/Tecton' },
  ];

  const links = [
    { icon: Heart, label: t('about.link_sponsor', 'Sponsor this project'), url: 'https://github.com/sponsors/emirtdede' },
    { icon: Github, label: t('about.link_github', 'Source code'), url: 'https://github.com/emirtdede/tecton' },
    { icon: BookOpen, label: t('about.link_docs', 'Documentation'), url: 'https://github.com/emirtdede/tecton/tree/main/docs' },
    { icon: Tag, label: t('about.link_releases', 'Releases'), url: 'https://github.com/emirtdede/tecton/releases' },
    { icon: Scale, label: t('about.link_license', 'MIT licence'), url: 'https://github.com/emirtdede/tecton/blob/main/LICENSE' },
  ];

  const renderLinks = (items) => (
    <div className="about-link-list">
      {items.map((link) => (
        <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="about-chip">
          {link.name} <ExternalLink size={11} />
        </a>
      ))}
    </div>
  );

  return (
    <div className="about-page" style={{ animation: 'fadeIn 0.3s ease' }}>
      <header className="page-head">
        <div>
          <h1 className="page-head-title">
            <Info size={18} aria-hidden="true" />
            {t('nav.help', 'Hakkında & Yardım')}
          </h1>
          <p className="page-head-sub">
            {t('about.page_subtitle', 'Uygulama bilgileri, proje bağlantıları ve sık sorulan sorular.')}
          </p>
        </div>
      </header>

      <UpdateCard />

      <section className="glass-card about-hero">
        <div className="about-brand">
          <img src={TectonDark} alt="" className="logo-dark" width="56" height="56" />
          <img src={TectonLight} alt="" className="logo-light" width="56" height="56" />
          <div>
            <h2 className="about-title">Tecton</h2>
            <p className="about-subtitle">
              {t('about.hero_subtitle', 'Construction site operating system for Windows')}
            </p>
          </div>
          <span className="about-version">v{APP_VERSION}</span>
        </div>

        <p className="about-desc">
          {t(
            'about.hero_desc',
            'Tecton keeps sites, people, payroll, materials and cash in one offline desktop application. Every record stays on this computer and, only if you connect one, in the cloud folder you choose.'
          )}
        </p>

        <h2 className="about-section-title">{t('about.facts_title', 'At a glance')}</h2>
        <dl className="about-facts">
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>

        <h2 className="about-section-title">{t('about.links_title', 'Project links')}</h2>
        <div className="about-link-grid">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <a key={link.url} href={link.url} target="_blank" rel="noreferrer" className="about-link-card">
                <Icon size={18} aria-hidden="true" />
                <span>{link.label}</span>
                <ExternalLink size={13} aria-hidden="true" />
              </a>
            );
          })}
        </div>
      </section>

      <section className="glass-card">
        <div className="about-faq-head">
          <div>
            <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>{t('about.faq', 'Frequently asked questions')}</h2>
            <p className="about-faq-desc">
              {t('about.help_desc', 'Short answers to the questions that come up most often.')}
            </p>
          </div>
          <div className="about-search">
            <input
              type="search"
              className="form-input"
              placeholder={t('about.faq_search_placeholder', 'Search the questions')}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label={t('about.faq_search_placeholder', 'Search the questions')}
            />
          </div>
        </div>

        {filteredFaqs.length === 0 ? (
          <p className="about-empty">{t('about.faq_no_results', 'No question matches your search.')}</p>
        ) : (
          <div className="about-faq-list">
            {filteredFaqs.map((faq) => {
              const open = openFaq === faq.q;
              return (
                <div key={faq.q} className={`about-faq-item ${open ? 'open' : ''}`}>
                  <button
                    type="button"
                    className="about-faq-question"
                    aria-expanded={open}
                    onClick={() => setOpenFaq(open ? null : faq.q)}
                  >
                    <span>{faq.q}</span>
                    {open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}
                  </button>
                  {open && <div className="about-faq-answer">{faq.a}</div>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="glass-card">
        <h2 className="card-title" style={{ marginBottom: '1.25rem' }}>
          {t('about.dev_info', 'Developer')} Emir Tarık Dede
        </h2>
        <div className="about-dev-grid">
          <div>
            <h3 className="about-dev-cat">{t('about.cat_code', 'Coding and technology')}</h3>
            {renderLinks(SOCIAL_LINKS.code)}
          </div>
          <div>
            <h3 className="about-dev-cat">{t('about.cat_prof', 'Professional network')}</h3>
            {renderLinks(SOCIAL_LINKS.prof)}
          </div>
          <div>
            <h3 className="about-dev-cat">{t('about.cat_social', 'Content and social')}</h3>
            {renderLinks(SOCIAL_LINKS.social)}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutHelp;
