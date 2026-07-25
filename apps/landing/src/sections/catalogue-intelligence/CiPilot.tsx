import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

const STEPS = ['useCase', 'deliver', 'process', 'review', 'decide'] as const;

const MEASURES = [
  { key: 'relevance', extra: false },
  { key: 'older', extra: false },
  { key: 'coverage', extra: false },
  { key: 'performance', extra: false },
  { key: 'acceptance', extra: true },
] as const;

export function CiPilot() {
  const { t } = useTranslation('common');

  return (
    <section id="ci-pilot" className="ci-section" aria-label="Test it on your own catalogue first">
      <header className="ci-dim-intro">
        <p className="ci-eyebrow uppercase">{t('catalogueIntelligence.pilot.eyebrow')}</p>
        <h2 className="ci-h2b uppercase">{t('catalogueIntelligence.pilot.title')}</h2>
        <p className="ci-lead">{t('catalogueIntelligence.pilot.lead')}</p>
      </header>

      <div className="ci-pilotflow">
        {STEPS.map((key) => (
          <div key={key} className="ci-pstep">
            <span className="ci-vt uppercase">{t(`catalogueIntelligence.pilot.steps.${key}.title`)}</span>
            <p>{t(`catalogueIntelligence.pilot.steps.${key}.copy`)}</p>
          </div>
        ))}
      </div>

      <div
        className="ci-scorecard"
        role="table"
        aria-label={t('catalogueIntelligence.pilot.scorecardAlt')}
      >
        <div className="ci-scrow ci-scrow-schead" role="row">
          <span>{t('catalogueIntelligence.pilot.scorecardHead.prove')}</span>
          <span>{t('catalogueIntelligence.pilot.scorecardHead.check')}</span>
          <span />
          <span />
        </div>
        {MEASURES.map(({ key, extra }) => (
          <div
            key={key}
            className={`ci-scrow${extra ? ' ci-scrow-extra' : ''}`}
            role="row"
          >
            <span className="ci-m uppercase">{t(`catalogueIntelligence.pilot.measures.${key}.label`)}</span>
            <p>{t(`catalogueIntelligence.pilot.measures.${key}.check`)}</p>
            <p />
            <p className="ci-lbl-dim">{t(`catalogueIntelligence.pilot.measures.${key}.evidence`)}</p>
          </div>
        ))}
      </div>

      <p className="ci-interp mt-[var(--px-28)]">
        <b>{t('catalogueIntelligence.pilot.trustBold')}</b>{' '}
        {t('catalogueIntelligence.pilot.trustBody')}{' '}
        <Link className="ci-bracket uppercase" to="/trust">
          {t('catalogueIntelligence.pilot.trustLink')}
        </Link>
      </p>
    </section>
  );
}
