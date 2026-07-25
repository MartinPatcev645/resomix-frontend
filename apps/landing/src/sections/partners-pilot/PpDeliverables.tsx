import { useTranslation } from 'react-i18next';
import { DOSSIER_ITEMS } from './ppData.ts';

export function PpDeliverables() {
  const { t } = useTranslation('common');

  const outcomes = t('partnersPilot.deliverables.outcomes', {
    returnObjects: true,
  }) as { title: string; body: string }[];

  return (
    <section id="deliverables" aria-label="What the partner receives" className="pp-section">
      <header className="pp-dim-intro">
        <p className="pp-eyebrow uppercase">{t('partnersPilot.deliverables.eyebrow')}</p>
        <h2 className="pp-h2b uppercase">{t('partnersPilot.deliverables.title')}</h2>
      </header>
      <div className="pp-dossier">
        <div>
          <p className="pp-body">{t('partnersPilot.deliverables.body')}</p>
          <div className="pp-outcomes">
            {outcomes.map((outcome) => (
              <div key={outcome.title} className="pp-outcome">
                <span className="pp-outcome-t uppercase">{outcome.title}</span>
                <p>{outcome.body}</p>
              </div>
            ))}
          </div>
          <p className="pp-lbl-dim pp-deliverables-note uppercase">
            {t('partnersPilot.deliverables.footnote')}
          </p>
        </div>
        <div
          className="pp-report"
          role="img"
          aria-label={t('partnersPilot.deliverables.reportAria')}
        >
          <div className="pp-report-head">
            <span className="pp-hudlbl uppercase">
              {t('partnersPilot.deliverables.reportLabel')}
            </span>
            <span className="pp-truth uppercase">
              {t('partnersPilot.deliverables.reportTruth')}
            </span>
          </div>
          <ol>
            {DOSSIER_ITEMS.map((item) => (
              <li key={item.title}>
                <span>
                  <b>{item.title}</b> — {item.body}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
