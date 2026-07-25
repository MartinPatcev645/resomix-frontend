import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  LEGAL_DOCUMENTS,
  LEGAL_EMAIL,
  LEGAL_LIBRARY_URL,
  PARTNERS_CONTACT_HASH,
  PRIVACY_EMAIL,
} from './trData.ts';

export function TrLegalContact() {
  const { t } = useTranslation('common');

  return (
    <section id="contact-block" aria-label="Legal documents and contact" className="tr-section">
      <header className="tr-dim-intro">
        <p className="tr-eyebrow uppercase">{t('trust.legal.eyebrow')}</p>
        <h2 className="tr-h2b uppercase">{t('trust.legal.title')}</h2>
      </header>

      <ul className="tr-doclist">
        {LEGAL_DOCUMENTS.map((doc) => (
          <li key={doc.id}>
            <a
              href={LEGAL_LIBRARY_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t(doc.ariaLabelKey)}
            >
              {t(doc.labelKey)}
            </a>
          </li>
        ))}
      </ul>

      <div className="tr-ledger tr-contact-ledger" role="table" aria-label="Contact information">
        <div className="tr-lrow tr-contact-row" role="row">
          <span className="tr-lrow-c uppercase" role="cell">
            {t('trust.legal.contacts.privacy')}
          </span>
          <p role="cell">
            <a className="tr-bracket" href={`mailto:${PRIVACY_EMAIL}`}>
              {PRIVACY_EMAIL}
            </a>
          </p>
        </div>
        <div className="tr-lrow tr-contact-row" role="row">
          <span className="tr-lrow-c uppercase" role="cell">
            {t('trust.legal.contacts.legal')}
          </span>
          <p role="cell">
            <a className="tr-bracket" href={`mailto:${LEGAL_EMAIL}`}>
              {LEGAL_EMAIL}
            </a>
          </p>
        </div>
        <div className="tr-lrow tr-contact-row" role="row">
          <span className="tr-lrow-c uppercase" role="cell">
            {t('trust.legal.contacts.partnerships')}
          </span>
          <p role="cell">
            <Link className="tr-bracket" to={PARTNERS_CONTACT_HASH}>
              {PARTNERS_CONTACT_HASH}
            </Link>
          </p>
        </div>
      </div>

      <div className="tr-ctarow tr-legal-ctas">
        <a className="tr-pill tr-pill-solid uppercase" href="#contact-block">
          {t('trust.legal.ctaPartnerships')}
        </a>
        <a
          className="tr-pill tr-pill-line uppercase"
          href={LEGAL_LIBRARY_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={t('trust.legal.ctaLegalAria')}
        >
          {t('trust.legal.ctaLegal')}
        </a>
      </div>

      <p className="tr-docref tr-legal-source uppercase">{t('trust.hero.sourceNote')}</p>
    </section>
  );
}
