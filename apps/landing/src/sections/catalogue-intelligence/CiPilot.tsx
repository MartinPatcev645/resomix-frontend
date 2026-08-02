import { useTranslation } from 'react-i18next';

const STAGES = ['s1', 's2', 's3', 's4', 's5'] as const;
const MEASURES = ['m1', 'm2', 'm3', 'm4', 'm5'] as const;

/* S8 · Guided catalogue pilot — five stage plates and an unpopulated
   scorecard (measures only, no fabricated numbers). Transplanted verbatim
   from the approved preview. */
export function CiPilot() {
  const { t } = useTranslation('common');

  return (
    <section className="ci-sec ci-section" id="ci-s8">
      <div className="ci-wrap">
        <div className="ci-eyebrow">{t('catalogueIntelligence.pilot.eyebrow')}</div>
        <h2 className="ci-h2">{t('catalogueIntelligence.pilot.h2')}</h2>
        <p className="ci-body-p ci-copycol">{t('catalogueIntelligence.pilot.body')}</p>

        <div className="ci-stages">
          {STAGES.map((key) => (
            <div key={key} className="ci-stage">
              <span className="ci-n">{t(`catalogueIntelligence.pilot.stages.${key}.n`)}</span>
              <h3>{t(`catalogueIntelligence.pilot.stages.${key}.title`)}</h3>
              <p>{t(`catalogueIntelligence.pilot.stages.${key}.copy`)}</p>
            </div>
          ))}
        </div>

        <div className="ci-scorecard">
          {MEASURES.map((key) => (
            <div key={key} className="ci-sr">
              <span className="ci-m">{t(`catalogueIntelligence.pilot.score.${key}`)}</span>
              <span className="ci-w">{t(`catalogueIntelligence.pilot.score.w${key.slice(1)}`)}</span>
            </div>
          ))}
        </div>
        <p className="ci-scorecard-note">{t('catalogueIntelligence.pilot.scoreNote')}</p>
      </div>
    </section>
  );
}
