import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { API_DOCS_URL } from './devEngine.ts';

export function DevEvaluationCta() {
  const { t } = useTranslation('common');
  const navigate = useNavigate();
  const [sandboxOpen, setSandboxOpen] = useState(false);

  const chips = t('developers.evaluate.chips', { returnObjects: true }) as {
    label: string;
    class: string;
  }[];

  const steps = t('developers.evaluate.steps', { returnObjects: true }) as { title: string; body: string }[];

  const handlePilot = useCallback(() => {
    navigate('/partners/pilot');
  }, [navigate]);

  return (
    <section id="dev-evaluate" className="dev-section" aria-label="Evaluation and getting started">
      <header className="dev-dim-intro">
        <p className="dev-eyebrow uppercase">{t('developers.evaluate.eyebrow')}</p>
        <h2 className="dev-h2b uppercase">{t('developers.evaluate.title')}</h2>
        <p className="dev-lead">{t('developers.evaluate.lead')}</p>
      </header>

      <div className="dev-ctarow dev-eval-chips">
        {chips.map((chip) => (
          <span key={chip.label} className={`dev-st dev-st-${chip.class} uppercase`}>
            {chip.label}
          </span>
        ))}
      </div>

      <button
        type="button"
        className="dev-ghostbtn dev-sandbox-btn uppercase"
        aria-expanded={sandboxOpen}
        aria-controls="dev-sandboxexp"
        onClick={() => setSandboxOpen((v) => !v)}
      >
        {sandboxOpen ? t('developers.evaluate.sandboxOpen') : t('developers.evaluate.sandboxClosed')}
      </button>
      <div className={`dev-expandable dev-sandbox-note${sandboxOpen ? ' dev-open' : ''}`} id="dev-sandboxexp">
        <p className="dev-interp">
          <b>{t('developers.evaluate.sandboxBold')}</b> {t('developers.evaluate.sandboxBody')}
        </p>
      </div>

      <div className="dev-evalflow">
        {steps.map((step) => (
          <div key={step.title} className="dev-pstep">
            <span className="dev-vt uppercase">{step.title}</span>
            <p>{step.body}</p>
          </div>
        ))}
      </div>

      <div className="dev-final">
        <div>
          <p className="dev-eyebrow uppercase">{t('developers.cta.leftEyebrow')}</p>
          <h2 className="dev-h2b uppercase">{t('developers.cta.leftTitle')}</h2>
          <div className="dev-ctarow">
            <button type="button" className="dev-pill dev-pill-solid uppercase" onClick={handlePilot}>
              {t('developers.cta.leftBtn')}
            </button>
          </div>
          <span className="dev-lbl dev-note uppercase">{t('developers.cta.leftNote')}</span>
        </div>
        <div className="dev-finaldiv" aria-hidden="true" />
        <div>
          <p className="dev-eyebrow uppercase">{t('developers.cta.rightEyebrow')}</p>
          <h2 className="dev-h3b uppercase">{t('developers.cta.rightTitle')}</h2>
          <div className="dev-ctarow">
            <a
              className="dev-pill dev-pill-line uppercase"
              href={API_DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t('developers.cta.rightBtn')}
            </a>
          </div>
          <span className="dev-lbl-dim dev-note uppercase">{t('developers.cta.rightNote')}</span>
        </div>
      </div>
    </section>
  );
}
