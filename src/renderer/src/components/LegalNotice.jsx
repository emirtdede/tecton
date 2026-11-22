import { useTranslation } from 'react-i18next';
import { ExternalLink, Scale, ShieldCheck, FileText, Mail } from 'lucide-react';

const PUBLISHER = 'Emir Tarık Dede';
const REPOSITORY = 'https://github.com/emirtdede/tecton';

/**
 * Legal notice, privacy statement and publisher details.
 *
 * The licence itself is the canonical MIT text, so it is not translated: the
 * binding wording must stay identical everywhere. The explanatory copy around
 * it is localised.
 */
export default function LegalNotice() {
  const { t } = useTranslation();

  return (
    <div className="docs-view" style={{ animation: 'fadeIn 0.3s ease' }}>
      <div className="glass-card docs-hero">
        <div>
          <h2 className="card-title" style={{ marginBottom: '0.35rem' }}>
            <Scale size={20} /> {t('legal.title', 'Legal notice')}
          </h2>
          <p className="docs-subtitle">
            {t('legal.subtitle', 'Publisher, licence and privacy information for Tecton.')}
          </p>
        </div>
      </div>

      <div className="docs-grid">
        <div className="glass-card docs-card">
          <h3 className="card-title" style={{ marginBottom: '0.6rem' }}>
            <FileText size={17} /> {t('legal.publisher_title', 'Publisher')}
          </h3>
          <dl className="legal-list">
            <dt>{t('legal.publisher_name', 'Developer and publisher')}</dt>
            <dd>{PUBLISHER}</dd>
            <dt>{t('legal.product', 'Product')}</dt>
            <dd>Tecton 1.0.0</dd>
            <dt>{t('legal.license', 'Licence')}</dt>
            <dd>MIT</dd>
            <dt>{t('legal.repository', 'Source code')}</dt>
            <dd>
              <a href={REPOSITORY} target="_blank" rel="noreferrer">
                github.com/emirtdede/tecton <ExternalLink size={12} />
              </a>
            </dd>
          </dl>
        </div>

        <div className="glass-card docs-card">
          <h3 className="card-title" style={{ marginBottom: '0.6rem' }}>
            <ShieldCheck size={17} /> {t('legal.privacy_title', 'Privacy')}
          </h3>
          <p className="docs-muted">
            {t('legal.privacy_body', 'Tecton works offline. Your site, payroll, material and cash records stay in the local database on this computer and, only if you connect one, in the cloud folder you choose. There is no Tecton account, no telemetry and no third-party analytics.')}
          </p>
        </div>

        <div className="glass-card docs-card">
          <h3 className="card-title" style={{ marginBottom: '0.6rem' }}>
            {t('legal.terms_title', 'Terms of use')}
          </h3>
          <p className="docs-muted">
            {t('legal.terms_body', 'Tecton is provided as is, without warranty. You are responsible for the accuracy of the records you enter and for keeping backups. The MIT licence permits commercial use, modification and redistribution provided the copyright notice is kept.')}
          </p>
        </div>

        <div className="glass-card docs-card">
          <h3 className="card-title" style={{ marginBottom: '0.6rem' }}>
            {t('legal.third_party_title', 'Third-party software')}
          </h3>
          <p className="docs-muted">
            {t('legal.third_party_body', 'Tecton is built with Electron, React, Vite, SQLite, i18next, lucide-react, jsPDF and SheetJS. Each component keeps its own licence; the full list is available in the repository.')}
          </p>
        </div>

        <div className="glass-card docs-card docs-card-wide">
          <h3 className="card-title" style={{ marginBottom: '0.6rem' }}>
            <Mail size={17} /> {t('legal.contact_title', 'Contact')}
          </h3>
          <p className="docs-muted">
            {t('legal.contact_body', 'Questions, bug reports and feature requests are handled through the GitHub repository. For commercial support, contact the publisher directly.')}
          </p>
        </div>
      </div>

      <div className="glass-card legal-license">
        <h3 className="card-title" style={{ marginBottom: '0.6rem' }}>MIT License</h3>
        <pre>
{`Copyright (c) 2026 ${PUBLISHER}

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`}
        </pre>
      </div>
    </div>
  );
}
