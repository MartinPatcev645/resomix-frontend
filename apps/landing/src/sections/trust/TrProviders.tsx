import { useTranslation } from 'react-i18next';
import { LEGAL_LIBRARY_URL, PROVIDER_ROWS } from './trData.ts';

export function TrProviders() {
  const { t } = useTranslation('common');

  return (
    <section id="providers" aria-label="Location, providers and transfers" className="tr-section">
      <header className="tr-dim-intro">
        <p className="tr-eyebrow uppercase">{t('trust.providers.eyebrow')}</p>
        <h2 className="tr-h2b uppercase">{t('trust.providers.title')}</h2>
      </header>
      <div
        className="tr-ptable"
        role="table"
        aria-label="Service providers named in the current Privacy Policy, with public purpose and location or role"
      >
        {PROVIDER_ROWS.map((row) => (
          <div key={row.id} className="tr-prow" role="row">
            <span className="tr-prow-c uppercase" role="cell">
              {t(row.nameKey)}
            </span>
            <p role="cell">{t(row.purposeKey)}</p>
            <p className="tr-lbl-dim uppercase" role="cell">
              {t(row.locationKey)}
            </p>
          </div>
        ))}
      </div>
      <p className="tr-note">
        <b>{t('trust.providers.transferBold')}</b>
        {t('trust.providers.transferRest')}{' '}
        <span className="tr-docref uppercase">{t('trust.providers.transferLegalDisclosure')}</span>
      </p>
      <a
        className="tr-bracket tr-privacy-link uppercase"
        href={LEGAL_LIBRARY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('trust.providers.privacyLinkAria')}
      >
        {t('trust.providers.privacyLink')}
      </a>
    </section>
  );
}
